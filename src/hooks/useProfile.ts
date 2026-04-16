import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/context/SessionContext";
import { useProfileContext } from "@/context/ProfileContext";

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
 * Returns the resolved profile from ProfileContext.
 *
 * The profile is fetched once at the AuthGate level and held in context,
 * so it survives page navigation without re-fetching or flickering.
 * OpsShell and all other consumers call this hook unchanged.
 */
export function useProfile(): Profile | null {
  return useProfileContext();
}

/**
 * Fetches the profile for a given user ID from Supabase.
 * Called by AuthGate — not by component hooks directly.
 * Dependency is user ID only, not the session object, so token refreshes
 * (which produce a new session object reference) do not trigger re-fetches.
 */
export async function fetchProfile(uid: string): Promise<Profile | null> {
  const SUPABASE_CONFIGURED =
    !!import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co';

  if (!SUPABASE_CONFIGURED) return null;

  const { data: row } = await supabase
    .from('profiles')
    .select('id, full_name, role, tenant_id')
    .eq('id', uid)
    .maybeSingle();

  if (!row) return null;

  if (!row.tenant_id) {
    const { data: membership } = await supabase
      .from('user_memberships')
      .select('tenant_id')
      .eq('user_id', uid)
      .maybeSingle();
    row.tenant_id = membership?.tenant_id ?? BUILTFOR_TENANT_ID;
  }

  return row as Profile;
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
