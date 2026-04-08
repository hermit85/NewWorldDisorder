// ═══════════════════════════════════════════════════════════
// Account Deletion Service
//
// App Store Guideline 5.1.1(v): users with accounts must be able
// to initiate account deletion from inside the app.
//
// This service calls a Supabase Edge Function `delete-account`
// that must:
//   1. Verify the caller via their JWT (req.headers.Authorization)
//   2. Call `supabase.auth.admin.deleteUser(user.id)` with
//      service-role key
//   3. ON DELETE CASCADE in 001_initial_schema.sql already wipes
//      `public.profiles` when `auth.users` row is deleted
//   4. Also explicitly wipe `runs`, storage objects in `avatars/`
//      bucket prefixed with `{userId}/`, and any downstream tables
//      that don't cascade
//
// === BACKEND TODO ===
// The Edge Function `delete-account` is NOT deployed yet.
// Until it is deployed, this service returns a clear error
// so the UI can tell the user truthfully that deletion is
// pending manual handling.
//
// See: supabase/functions/delete-account/index.ts (stub)
// ═══════════════════════════════════════════════════════════

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { logDebugEvent } from '@/systems/debugEvents';

export type DeleteAccountResult =
  | { status: 'success' }
  | { status: 'not_authenticated' }
  | { status: 'backend_unavailable'; supportEmail: string }
  | { status: 'error'; message: string };

const SUPPORT_EMAIL = 'support@nwdisorder.com';

/**
 * Initiate full account deletion for the currently signed-in user.
 * Calls the `delete-account` Supabase Edge Function.
 *
 * On success:
 *   - auth.users row removed (cascades to profiles + runs via FK)
 *   - storage objects under avatars/{userId}/ removed server-side
 *   - local session cleared via supabase.auth.signOut()
 *
 * On failure:
 *   - Returns a structured error — UI MUST surface this to the
 *     user rather than silently pretending it worked.
 */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { status: 'backend_unavailable', supportEmail: SUPPORT_EMAIL };
  }

  // Must be signed in
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    return { status: 'not_authenticated' };
  }

  logDebugEvent('auth', 'delete_account_start', 'start', {
    payload: { userId: session.user.id },
  });

  try {
    // Call the Edge Function. The user's JWT is attached automatically
    // by supabase-js via the `Authorization: Bearer <jwt>` header.
    const { data, error } = await supabase.functions.invoke('delete-account', {
      method: 'POST',
    });

    if (error) {
      // Distinguish "function not found / not deployed" (status 404)
      // from real server errors.
      const msg = String(error.message ?? error);
      const notDeployed =
        msg.toLowerCase().includes('not found') ||
        msg.includes('404') ||
        (error as any)?.context?.status === 404;

      logDebugEvent('auth', 'delete_account_error', 'fail', {
        payload: { error: msg, notDeployed },
      });

      if (notDeployed) {
        return { status: 'backend_unavailable', supportEmail: SUPPORT_EMAIL };
      }
      return { status: 'error', message: msg };
    }

    logDebugEvent('auth', 'delete_account_success', 'ok', {
      payload: { response: data },
    });

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
