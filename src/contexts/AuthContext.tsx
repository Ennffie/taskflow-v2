import { createContext, useContext, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error] = useState<string | null>(null);

  // No auto-auth check - storage disabled
  const loadProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, role')
      .eq('id', userId)
      .single();
    if (data) setProfile(data as Profile);
  };

  const value = useMemo<AuthContextValue>(() => ({
    user,
    session,
    profile,
    loading,
    error,
    signIn: async (email, password) => {
      try {
        setLoading(true);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { error: error.message };
        setUser(data.user);
        setSession(data.session);
        if (data.user) await loadProfile(data.user.id);
        return {};
      } catch (err: any) {
        return { error: err.message || 'Sign in failed' };
      } finally {
        setLoading(false);
      }
    },
    signOut: async () => {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
    },
    refreshProfile: async () => {
      if (user) await loadProfile(user.id);
    },
  }), [user, session, profile, loading, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
