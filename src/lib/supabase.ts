// ═══════════════════════════════════════════════════════════
// Supabase client — single instance for the whole app
// Handles session persistence + deep link auth callback
// ═══════════════════════════════════════════════════════════

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

// Only create real client when env vars exist — otherwise app runs in demo/mock mode
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // We handle deep links manually
      },
    })
  : null;

// ── Auto-refresh on app foreground ──
// When user returns to app after clicking magic link, refresh the session
if (supabase) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase!.auth.startAutoRefresh();
    } else {
      supabase!.auth.stopAutoRefresh();
    }
  });
}

// ── Deep link session handler ──
// Call this when a deep link with auth tokens is received
export async function handleAuthDeepLink(url: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    // Parse fragment from URL: nwd://login-callback/#access_token=...&refresh_token=...
    const hashIndex = url.indexOf('#');
    if (hashIndex === -1) return false;

    const fragment = url.substring(hashIndex + 1);
    const params = new URLSearchParams(fragment);

    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken || !refreshToken) return false;

    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      console.error('[NWD] Failed to set session from deep link:', error.message);
      return false;
    }

    return true;
  } catch (e) {
    console.error('[NWD] Deep link auth error:', e);
    return false;
  }
}
