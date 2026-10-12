import { createClient, type SupabaseClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
/** null when credentials are absent: the app then runs in local-demo mode. */
export const supabase: SupabaseClient | null = url && key && /^https?:\/\//.test(url) ? createClient(url, key) : null;
export const cloudConfigured = supabase !== null;
