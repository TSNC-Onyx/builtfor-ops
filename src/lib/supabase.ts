import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Warn in dev/preview rather than hard-throwing — allows Lovable to render
// the UI without crashing on missing env vars during preview builds.
if (!url || !key) {
  console.warn("[ops] Missing Supabase env vars — data features will not work.");
}

export const supabase = createClient(url ?? "https://placeholder.supabase.co", key ?? "placeholder", {
  auth: { storage: localStorage, persistSession: true, autoRefreshToken: true },
});
