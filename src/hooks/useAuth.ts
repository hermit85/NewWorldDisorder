// ═══════════════════════════════════════════════════════════
// Auth hook — manages Supabase session + profile
// OTP code sign-in with session persistence
// Falls back to demo mode when Supabase is not configured
// Sprint 25: fixed race conditions, error handling, session timing
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, handleAuthDeepLink } from '@/lib/supabase';
import { Profile } from '@/lib/database.types';
import * as Linking from 'expo-linking';
import { logDebugEvent } from '@/systems/debugEvents';

export type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'needs_profile'; user: User }
  | { status: 'authenticated'; user: User; profile: Profile }
  | { status: 'error'; message: string };

export function useAuth() {
  const [state, setState] = useState<AuthState>(
    isSupabaseConfigured ? { status: 'loading' } : { status: 'unauthenticated' },
  );

  // Race protection: prevent concurrent handleSession calls
  const handlingSessionRef = useRef(false);
  const mountedRef = useRef(true);

  const safeSetState = useCallback((newState: AuthState) => {
    if (mountedRef.current) setState(newState);
  }, []);

  // ── Session init + auth state listener ──
  useEffect(() => {
    mountedRef.current = true;
    if (!supabase) return;

    // Load existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    }).catch((e) => {
      logDebugEvent('auth', 'get_session_error', 'fail', { payload: { error: String(e) } });
      safeSetState({ status: 'unauthenticated' });
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      logDebugEvent('auth', 'state_change', 'info', { payload: { event: _event, hasSession: !!session } });
      handleSession(session);
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  // ── Deep link listener (silent fallback, not primary UX) ──
  // Primary auth is OTP code entry. Deep link only fires if user
  // somehow receives and clicks a magic link (e.g. desktop → mobile handoff)
  useEffect(() => {
    if (!supabase) return;

    const handleUrl = async (event: { url: string }) => {
      if (event.url.includes('login-callback')) {
        logDebugEvent('auth', 'deep_link_received', 'info', { payload: { url: event.url.slice(0, 60) } });
        await handleAuthDeepLink(event.url);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url && url.includes('login-callback')) {
        handleAuthDeepLink(url);
      }
    });

    const subscription = Linking.addEventListener('url', handleUrl);
    return () => subscription.remove();
  }, []);

  const handleSession = async (session: Session | null) => {
    if (!supabase) return;

    if (!session?.user) {
      logDebugEvent('auth', 'unauthenticated', 'info');
      safeSetState({ status: 'unauthenticated' });
      return;
    }

    // Race protection: skip if already handling a session
    if (handlingSessionRef.current) {
      logDebugEvent('auth', 'session_handling_skipped', 'info', { payload: { reason: 'concurrent' } });
      return;
    }
    handlingSessionRef.current = true;

    logDebugEvent('auth', 'session_found', 'ok', { sessionId: session.user.id });

    try {
      // Try to fetch existing profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profile && !error) {
        // Profile exists — fully authenticated
        logDebugEvent('auth', 'authenticated', 'ok', {
          sessionId: session.user.id,
          payload: { username: profile.username },
        });
        safeSetState({ status: 'authenticated', user: session.user, profile });
      } else if (error && error.code === 'PGRST116') {
        // PGRST116 = "no rows returned" — user exists but no profile yet
        logDebugEvent('auth', 'needs_profile', 'warn', { sessionId: session.user.id });
        safeSetState({ status: 'needs_profile', user: session.user });
      } else if (error) {
        // Real fetch error (network, RLS, etc.) — NOT "no profile"
        logDebugEvent('auth', 'profile_fetch_error', 'fail', {
          sessionId: session.user.id,
          payload: { code: error.code, message: error.message },
        });
        // Don't send to needs_profile — that's a lie.
        // Show error so user can retry.
        safeSetState({
          status: 'error',
          message: 'Nie udało się załadować profilu. Sprawdź połączenie.',
        });
      } else {
        // No error, no profile data — shouldn't happen, treat as needs_profile
        logDebugEvent('auth', 'needs_profile_no_error', 'warn', { sessionId: session.user.id });
        safeSetState({ status: 'needs_profile', user: session.user });
      }
    } catch (e) {
      logDebugEvent('auth', 'session_handling_crash', 'fail', {
        payload: { error: String(e) },
      });
      safeSetState({
        status: 'error',
        message: 'Błąd podczas logowania. Spróbuj ponownie.',
      });
    } finally {
      handlingSessionRef.current = false;
    }
  };

  // ── Auth actions ──

  const signInWithEmail = useCallback(async (email: string) => {
    if (!supabase) return { error: new Error('Logowanie jest chwilowo niedostępne. Spróbuj ponownie później.') };

    logDebugEvent('auth', 'otp_send_start', 'start', { payload: { email: email.slice(0, 3) + '***' } });

    try {
      // OTP-first: no emailRedirectTo so Supabase sends code-only email template
      // Deep link magic link is a secondary fallback, not the primary UX
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) {
        logDebugEvent('auth', 'otp_send_fail', 'fail', { payload: { message: error.message } });
      } else {
        logDebugEvent('auth', 'otp_send_ok', 'ok');
      }

      return { error };
    } catch (e) {
      logDebugEvent('auth', 'otp_send_crash', 'fail', { payload: { error: String(e) } });
      return { error: e as Error };
    }
  }, []);

  const verifyOtp = useCallback(async (email: string, token: string) => {
    if (!supabase) return { error: new Error('Logowanie jest chwilowo niedostępne. Spróbuj ponownie później.') };

    logDebugEvent('auth', 'otp_verify_start', 'start');

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });

      if (error) {
        logDebugEvent('auth', 'otp_verify_fail', 'fail', { payload: { message: error.message } });
        return { error };
      }

      logDebugEvent('auth', 'otp_verify_ok', 'ok', {
        payload: { hasSession: !!data.session, hasUser: !!data.user },
      });

      // Safety net: if onAuthStateChange hasn't fired yet, manually handle the session
      if (data.session) {
        handleSession(data.session);
      }

      return { error: null };
    } catch (e) {
      logDebugEvent('auth', 'otp_verify_crash', 'fail', { payload: { error: String(e) } });
      return { error: e as Error };
    }
  }, []);

  const signOut = useCallback(async () => {
    logDebugEvent('auth', 'sign_out', 'info');
    if (supabase) await supabase.auth.signOut();
    safeSetState({ status: 'unauthenticated' });
  }, []);

  const createProfile = useCallback(async (username: string, displayName?: string) => {
    if (state.status !== 'needs_profile' || !supabase) {
      return { error: new Error('Not ready'), data: null };
    }

    logDebugEvent('auth', 'create_profile_start', 'start', { payload: { username } });

    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: state.user.id,
          username: username.toLowerCase().trim(),
          display_name: displayName ?? username,
        })
        .select()
        .single();

      if (data && !error) {
        logDebugEvent('auth', 'create_profile_ok', 'ok', { payload: { username: data.username } });
        safeSetState({ status: 'authenticated', user: state.user, profile: data });
      } else if (error) {
        logDebugEvent('auth', 'create_profile_fail', 'fail', { payload: { code: error.code, message: error.message } });
      }
      return { data, error };
    } catch (e) {
      logDebugEvent('auth', 'create_profile_crash', 'fail', { payload: { error: String(e) } });
      return { data: null, error: e as Error };
    }
  }, [state]);

  const refreshProfile = useCallback(async () => {
    if (state.status !== 'authenticated' || !supabase) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', state.user.id)
      .single();

    if (profile) {
      safeSetState({ status: 'authenticated', user: state.user, profile });
    }
  }, [state]);

  // Retry from error state — re-check session
  const retryAuth = useCallback(async () => {
    if (!supabase) return;
    safeSetState({ status: 'loading' });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await handleSession(session);
    } catch {
      safeSetState({ status: 'unauthenticated' });
    }
  }, []);

  return {
    state,
    signInWithEmail,
    verifyOtp,
    signOut,
    createProfile,
    refreshProfile,
    retryAuth,
    isAuthenticated: state.status === 'authenticated',
    isLoading: state.status === 'loading',
    user: state.status === 'authenticated' ? state.user : null,
    profile: state.status === 'authenticated' ? state.profile : null,
  };
}
