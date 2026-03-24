// ═══════════════════════════════════════════════════════════
// Auth hook — manages Supabase session + profile
// Magic link email auth for beta testers
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/lib/database.types';

export type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'needs_profile'; user: User }
  | { status: 'authenticated'; user: User; profile: Profile };

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  // Load session on mount and listen for changes
  useEffect(() => {
    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSession = async (session: Session | null) => {
    if (!session?.user) {
      setState({ status: 'unauthenticated' });
      return;
    }

    // Try to fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profile) {
      setState({ status: 'authenticated', user: session.user, profile });
    } else {
      setState({ status: 'needs_profile', user: session.user });
    }
  };

  // ── Auth actions ──

  const signInWithEmail = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({ status: 'unauthenticated' });
  }, []);

  const createProfile = useCallback(async (username: string, displayName?: string) => {
    if (state.status !== 'needs_profile') return { error: new Error('Not in needs_profile state') };

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
      setState({ status: 'authenticated', user: state.user, profile: data });
    }

    return { data, error };
  }, [state]);

  const refreshProfile = useCallback(async () => {
    if (state.status !== 'authenticated') return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', state.user.id)
      .single();

    if (profile) {
      setState({ status: 'authenticated', user: state.user, profile });
    }
  }, [state]);

  return {
    state,
    signInWithEmail,
    signOut,
    createProfile,
    refreshProfile,
    isAuthenticated: state.status === 'authenticated',
    isLoading: state.status === 'loading',
    user: state.status === 'authenticated' ? state.user : null,
    profile: state.status === 'authenticated' ? state.profile : null,
  };
}
