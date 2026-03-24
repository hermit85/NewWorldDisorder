// ═══════════════════════════════════════════════════════════
// Auth Context — provides auth state to entire app
// ═══════════════════════════════════════════════════════════

import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth, AuthState } from './useAuth';
import { Profile } from '@/lib/database.types';
import { User } from '@supabase/supabase-js';

interface AuthContextValue {
  state: AuthState;
  signInWithEmail: (email: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  createProfile: (username: string, displayName?: string) => Promise<any>;
  refreshProfile: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  profile: Profile | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
