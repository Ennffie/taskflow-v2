import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Disable all storage to prevent lock conflicts
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    },
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});
