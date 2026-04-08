// ═══════════════════════════════════════════════════════════
// Supabase Edge Function: delete-account
//
// Called from the app when a signed-in user taps "Usuń konto".
// Deletes the calling user's auth.users row, which cascades to
// public.profiles (see migration 001) and any other FK-linked
// tables. Also explicitly clears the user's avatar storage
// objects because storage does NOT cascade via FK.
//
// === DEPLOYMENT ===
//   supabase functions deploy delete-account \
//     --project-ref <your-project-ref>
//
// === REQUIRED SECRETS ===
// The function uses the service-role key, which is provided
// automatically via the built-in SUPABASE_SERVICE_ROLE_KEY env var.
// You do NOT need to set it manually — it is injected by Supabase
// at deploy time.
//
// === SECURITY NOTES ===
// - The function verifies the caller's JWT via the standard
//   supabase-js `auth.getUser(jwt)` call. Unauthenticated
//   requests are rejected.
// - Only the caller's own account is deleted. There is no
//   user_id parameter on the request body.
// - JWT verification (`verify_jwt = true` in the dashboard) is
//   enabled by default.
//
// === DEFENSE IN DEPTH ===
// Migration 005 adds ON DELETE CASCADE on every table that
// references profiles(id). Even so, this function explicitly
// wipes dependent rows BEFORE the auth deletion so it remains
// correct in two extra cases:
//   1. The cascade migration has not yet been applied to the
//      target Supabase project.
//   2. New tables are added in the future without cascades.
//
// === DEPLOY CHECKLIST (App Store submission) ===
//   [ ] Apply migration 005_account_deletion_cascade.sql in
//       the Supabase SQL editor (or `supabase db push`)
//   [ ] `supabase functions deploy delete-account`
//   [ ] Manually test end-to-end from a real device
//   [ ] Verify the avatars/{userId}/ folder is empty afterwards
// ═══════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const AVATAR_BUCKET = 'avatars';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── 1. Verify caller ─────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) {
    return json({ error: 'unauthenticated' }, 401);
  }

  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: userRes, error: userErr } = await anon.auth.getUser(jwt);
  if (userErr || !userRes?.user) {
    return json({ error: 'unauthenticated' }, 401);
  }
  const userId = userRes.user.id;

  // ── 2. Admin client for destructive ops ──────────────────
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── 3. Wipe storage: avatars/{userId}/... ────────────────
  try {
    const { data: files } = await admin.storage
      .from(AVATAR_BUCKET)
      .list(userId, { limit: 100 });
    if (files && files.length > 0) {
      const paths = files.map((f) => `${userId}/${f.name}`);
      await admin.storage.from(AVATAR_BUCKET).remove(paths);
    }
  } catch (e) {
    // Non-fatal: log and continue to auth deletion.
    console.warn('[delete-account] storage cleanup failed:', e);
  }

  // ── 4. Explicitly wipe dependent rows (defense in depth) ─
  // Migration 005 adds ON DELETE CASCADE, but we don't trust
  // that it's been applied to every environment. Order matters:
  // child rows first, then parents.
  const cleanupOps: { name: string; promise: Promise<unknown> }[] = [
    { name: 'leaderboard_entries', promise: admin.from('leaderboard_entries').delete().eq('user_id', userId) },
    { name: 'challenge_progress', promise: admin.from('challenge_progress').delete().eq('user_id', userId) },
    { name: 'user_achievements', promise: admin.from('user_achievements').delete().eq('user_id', userId) },
    { name: 'runs', promise: admin.from('runs').delete().eq('user_id', userId) },
    { name: 'profiles', promise: admin.from('profiles').delete().eq('id', userId) },
  ];
  for (const op of cleanupOps) {
    try {
      const { error } = (await op.promise) as { error: unknown };
      if (error) console.warn(`[delete-account] ${op.name} cleanup warning:`, error);
    } catch (e) {
      console.warn(`[delete-account] ${op.name} cleanup threw:`, e);
    }
  }

  // ── 5. Delete auth.users (final, irreversible) ───────────
  const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
  if (deleteErr) {
    console.error('[delete-account] deleteUser failed:', deleteErr);
    return json({ error: 'delete_failed', detail: deleteErr.message }, 500);
  }

  return json({ status: 'deleted', userId }, 200);
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
