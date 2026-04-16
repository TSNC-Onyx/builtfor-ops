import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/context/SessionContext";

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
export const BUILTFOR_TENANT_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Fetches the authenticated user's profile using the session already resolved
 * by AuthGate via SessionContext. Consuming the session from context eliminates
 * the getSession() race where auth.uid() is null on first render.
 *
 * Re-runs whenever the session changes (login / logout / token refresh).
 * Clears profile on sign-out (session = null).
 */
export function useProfile(): Profile | null {
  const session = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    // Clear profile immediately on sign-out
    if (!session) {
      setProfile(null);
      return;
    }

    const uid = session.user?.id;
    if (!uid) return;

    const SUPABASE_CONFIGURED =
      !!import.meta.env.VITE_SUPABASE_URL &&
      import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co';

    if (!SUPABASE_CONFIGURED) return;

    supabase
      .from('profiles')
      .select('id, full_name, role, tenant_id')
      .eq('id', uid)
      .maybeSingle()
      .then(({ data: row }) => {
        if (!row) return;

        // Fallback: resolve tenant_id from user_memberships if missing on profile row
        if (!row.tenant_id) {
          supabase
            .from('user_memberships')
            .select('tenant_id')
            .eq('user_id', uid)
            .maybeSingle()
            .then(({ data: membership }) => {
              row.tenant_id = membership?.tenant_id ?? BUILTFOR_TENANT_ID;
              setProfile(row as Profile);
            });
          return;
        }

        setProfile(row as Profile);
      });
  }, [session]);

  return profile;
}

/**
 * Ensures a user_memberships row exists for the given user.
 * Idempotent — safe to call on every SIGNED_IN event.
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
 */
export function formatDisplayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
}
