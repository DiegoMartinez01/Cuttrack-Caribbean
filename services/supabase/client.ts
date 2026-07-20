import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fjtkatnhtffjrexifarh.supabase.co';
const supabaseAnonKey = 'sb_publishable_Ag3Au4He6jehuegdABCV3w_Wf3i23AK';

// Configuración que funciona en web y Android
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: false,
    storage: typeof window !== 'undefined' 
      ? window.localStorage 
      : undefined,
  },
});