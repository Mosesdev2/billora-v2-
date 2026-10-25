import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client = null;

try {
  if (url && key) client = createClient(url, key);
} catch (err) {
  console.error('Supabase failed to start:', err.message);
}

export const supabase = client;
export const supabaseReady = Boolean(client);