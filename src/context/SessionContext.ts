import { createContext, useContext } from "react";
import type { Session } from "@supabase/supabase-js";

/**
 * SessionContext — exposes the resolved Supabase session to all hooks.
 *
 * Purpose: gate all read queries on session readiness so they never fire
 * before auth.uid() is live. This prevents the post-refresh data failure
 * caused by v2 RLS policies returning empty results when auth.uid() = null.
 *
 * Usage in hooks:
 *   const session = useSession();
 *   useQuery({ ..., enabled: !!session });
 *
 * Populated by AuthGate in App.tsx once getSession() resolves.
 * null  = confirmed no session (logged out)
 * undefined = session not yet resolved (loading)
 */
export const SessionContext = createContext<Session | null | undefined>(undefined);

export function useSession(): Session | null | undefined {
  return useContext(SessionContext);
}
