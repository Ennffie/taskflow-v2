import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile, Role } from '../types';

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

async function ensureProfile(user: User): Promise<Profile | null> {
  try {
    const { data: existing } = await supabase
      .from('profiles')
      .select('id, name, email, role')
      .eq('id', user.id)
      .maybeSingle();

    if (existing) return existing as Profile;

    const fallbackProfile = {
      id: user.id,
      name: (user.user_metadata?.name as string) || user.email?.split('@')[0] || 'User',
      email: user.email || '',
      role: 'member' as Role,
    };

    const { data, error } = await supabase
      .from('profiles')
      .upsert(fallbackProfile, { onConflict: 'id' })
      .select('id, name, email, role')
      .single();

    if (error) {
      console.error('ensureProfile error', error);
      return null;
    }

    return data as Profile;
  } catch (err) {
    console.error('ensureProfile failed', err);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = async (nextUser: User | null) => {
    if (!nextUser) {
      setProfile(null);
      return;
    }
    try {
      const nextProfile = await ensureProfile(nextUser);
      setProfile(nextProfile);
    } catch (err) {
      console.error('loadProfile failed', err);
      setProfile(null);
    }
  };

  useEffect(() => {
    // Timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('Auth loading timeout - forcing ready state');
        setLoading(false);
        setError('Auth initialization timeout');
      }
    }, 5000);

    const initAuth = async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('getSession error', sessionError);
          setError(sessionError.message);
        }
        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
        await loadProfile(data.session?.user ?? null);
      } catch (err) {
        console.error('Auth init failed', err);
        setError('Auth initialization failed');
      } finally {
        setLoading(false);
        clearTimeout(timeoutId);
      }
    };

    initAuth();

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      await loadProfile(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    session,
    profile,
    loading,
    error,
    signIn: async (email, password) => {
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error ? { error: error.message } : {};
      } catch (err) {
        return { error: 'Sign in failed' };
      }
    },
    signOut: async () => {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Sign out error', err);
      }
    },
    refreshProfile: async () => {
      await loadProfile(user);
    },
  }), [user, session, profile, loading, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
