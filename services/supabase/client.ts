import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fvvlzfnnnhxbilmxbuum.supabase.co';
const supabaseAnonKey = 'sb_publishable_sFM5ERFxV82YAxnZ0yDJnA_FSYbSmXL';

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