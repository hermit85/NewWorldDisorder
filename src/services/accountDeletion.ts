// ═══════════════════════════════════════════════════════════
// Account Deletion Service
//
// App Store Guideline 5.1.1(v): users with accounts must be able
// to initiate account deletion from inside the app.
//
// Calls Supabase Edge Function `delete-account` which:
//   1. Verifies caller JWT via `auth.getUser()`
//   2. Wipes storage under avatars/{userId}/
//   3. Deletes dependent rows (defense in depth — migration 005
//      also CASCADEs, but the function doesn't trust every env
//      has migrated)
//   4. Calls `auth.admin.deleteUser(userId)` with service-role key
//
// === Transport: raw fetch, not functions.invoke ===
// supabase-js `functions.invoke` has historical issues with
// header propagation when the request has no body (attaches
// Authorization inconsistently across SDK versions). bzzt ran
// into this and switched to raw fetch; we follow the same
// pattern so the delete call is not at the mercy of SDK magic.
// Always pulls a fresh session via getSession() first — that
// triggers an auto-refresh if the access token is near expiry.
// ═══════════════════════════════════════════════════════════

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { logDebugEvent } from '@/systems/debugEvents';

export type DeleteAccountResult =
  | { status: 'success' }
  | { status: 'not_authenticated' }
  | { status: 'backend_unavailable'; supportEmail: string }
  | { status: 'error'; message: string };

const SUPPORT_EMAIL = 'support@nwdisorder.com';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export async function deleteAccount(): Promise<DeleteAccountResult> {
  if (!isSupabaseConfigured || !supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { status: 'backend_unavailable', supportEmail: SUPPORT_EMAIL };
  }

  // Force-refresh path: getSession() returns current session and, with
  // autoRefreshToken=true on the client, will refresh a near-expiry
  // token transparently before handing it back.
  const { data: { session }, error: sessErr } = await supabase.auth.getSession();
  if (sessErr || !session?.user) {
    return { status: 'not_authenticated' };
  }

  logDebugEvent('auth', 'delete_account_start', 'start', {
    payload: { userId: session.user.id },
  });

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      logDebugEvent('auth', 'delete_account_error', 'fail', {
        payload: { status: res.status, body: bodyText.slice(0, 200) },
      });

      if (res.status === 404) {
        return { status: 'backend_unavailable', supportEmail: SUPPORT_EMAIL };
      }
      return { status: 'error', message: `HTTP ${res.status}: ${bodyText || 'no body'}` };
    }

    logDebugEvent('auth', 'delete_account_success', 'ok');

    // Clear local session after successful deletion.
    await supabase.auth.signOut();
    return { status: 'success' };
  } catch (e: any) {
    logDebugEvent('auth', 'delete_account_exception', 'fail', {
      payload: { error: String(e) },
    });
    return { status: 'error', message: String(e?.message ?? e) };
  }
}
