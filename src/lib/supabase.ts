import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !key) throw new Error("[ops] Missing Supabase env vars");

export const supabase = createClient(url, key, {
  auth: { storage: localStorage, persistSession: true, autoRefreshToken: true },
});
