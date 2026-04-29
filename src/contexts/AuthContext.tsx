import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string, rememberMe: boolean) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);

  const loadProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .eq('id', userId)
        .single();
      if (data) setProfile(data as Profile);
      else setProfile(null);
    } catch {
      setProfile(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        setSession(data.session);
        setUser(data.session?.user ?? null);
        setLoading(false);

        if (data.session?.user) {
          void loadProfile(data.session.user.id);
        } else {
          setProfile(null);
        }
      } catch {
        if (mounted) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    };

    void init();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);

      if (nextSession?.user) {
        void loadProfile(nextSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    session,
    profile,
    loading,
    error,
    signIn: async (email, password, rememberMe) => {
      try {
        setLoading(true);
        try {
          localStorage.setItem('taskflow_remember_me', rememberMe ? 'true' : 'false');
        } catch {
          // ignore storage issues
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { error: error.message };
        setUser(data.user);
        setSession(data.session);
        setLoading(false);
        if (data.user) {
          void loadProfile(data.user.id);
        } else {
          setProfile(null);
        }
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
