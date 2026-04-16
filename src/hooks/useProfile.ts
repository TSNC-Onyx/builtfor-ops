import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface Profile {
  id: string;
  full_name: string;
  role: string;
  tenant_id: string;
}

export interface UserMembership {
  user_id: string;
  tenant_id: string;
  role: string;
}

// The BuiltFor platform operator tenant ID — stable, seeded in migration.
// Used for membership seeding on first login when no membership row exists.
export const BUILTFOR_TENANT_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Fetches the authenticated user's profile and resolves tenant_id.
 *
 * Auth mode behaviour:
 *   legacy — reads profile.tenant_id (set during migration backfill).
 *              App behaviour is identical to before; RLS uses flat profiles check.
 *   v2     — reads tenant_id from user_memberships. Profile.tenant_id is the
 *              same value but the source of truth for RLS is user_memberships.
 *
 * In both modes the returned Profile shape is identical so no consumer changes
 * are needed when the flag is flipped.
 */
export function useProfile(): Profile | null {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const SUPABASE_CONFIGURED =
      !!import.meta.env.VITE_SUPABASE_URL &&
      import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co';

    if (!SUPABASE_CONFIGURED) return;

    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user?.id;
      if (!uid) return;

      // Fetch profile (now includes tenant_id after migration)
      const { data: row } = await supabase
        .from('profiles')
        .select('id, full_name, role, tenant_id')
        .eq('id', uid)
        .maybeSingle();

      if (!row) return;

      // If profile has no tenant_id (edge case: pre-migration row), attempt
      // to resolve from user_memberships before falling back to the platform default.
      if (!row.tenant_id) {
        const { data: membership } = await supabase
          .from('user_memberships')
          .select('tenant_id')
          .eq('user_id', uid)
          .maybeSingle();
        row.tenant_id = membership?.tenant_id ?? BUILTFOR_TENANT_ID;
      }

      setProfile(row as Profile);
    });
  }, []);

  return profile;
}

/**
 * Ensures a user_memberships row exists for the given user.
 * Called on first login in AuthGate. Idempotent — safe to call on every login.
 */
export async function ensureMembership(
  userId: string,
  tenantId: string,
  role: string
): Promise<void> {
  await supabase.from('user_memberships').upsert(
    { user_id: userId, tenant_id: tenantId, role },
    { onConflict: 'user_id,tenant_id', ignoreDuplicates: true }
  );
}

/**
 * Derives "J. Robinson" formatted display name from a full name string.
 * Falls back gracefully for single-word names or empty strings.
 */
export function formatDisplayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
}
