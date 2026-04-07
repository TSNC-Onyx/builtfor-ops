import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface Profile {
  id: string;
  full_name: string;
  role: string;
}

/**
 * Fetches the authenticated user's profile from public.profiles.
 * Returns null when Supabase is not configured (Bolt preview) or no session exists.
 */
export function useProfile(): Profile | null {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const SUPABASE_CONFIGURED =
      !!import.meta.env.VITE_SUPABASE_URL &&
      import.meta.env.VITE_SUPABASE_URL !== "https://placeholder.supabase.co";

    if (!SUPABASE_CONFIGURED) return;

    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user?.id;
      if (!uid) return;
      const { data: row } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", uid)
        .maybeSingle();
      if (row) setProfile(row as Profile);
    });
  }, []);

  return profile;
}

/**
 * Derives "J. Robinson" formatted display name from a full name string.
 * Falls back gracefully for single-word names or empty strings.
 */
export function formatDisplayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}
