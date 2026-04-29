import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const REMEMBER_ME_KEY = 'taskflow_remember_me';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

function safeGetRememberMeFlag() {
  try {
    return localStorage.getItem(REMEMBER_ME_KEY) === 'true';
  } catch {
    return false;
  }
}

function getPrimaryStorage() {
  return safeGetRememberMeFlag() ? localStorage : sessionStorage;
}

function getSecondaryStorage() {
  return safeGetRememberMeFlag() ? sessionStorage : localStorage;
}

const hybridStorageAdapter = {
  getItem: (key: string) => {
    try {
      return getPrimaryStorage().getItem(key) ?? getSecondaryStorage().getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      getPrimaryStorage().setItem(key, value);
      getSecondaryStorage().removeItem(key);
    } catch { /* ignore */ }
  },
  removeItem: (key: string) => {
    try {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    } catch { /* ignore */ }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: hybridStorageAdapter,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  }
});
