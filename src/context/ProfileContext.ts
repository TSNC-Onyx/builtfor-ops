import { createContext, useContext } from "react";
import type { Profile } from "@/hooks/useProfile";

/**
 * ProfileContext — holds the resolved operator profile for the current session.
 *
 * Populated once by AuthGate after session resolves. Survives page navigation
 * because it lives above the route tree — OpsShell consumes it via useProfile()
 * without triggering a re-fetch on every mount/unmount cycle.
 *
 * null  = no profile loaded yet or signed out
 */
export const ProfileContext = createContext<Profile | null>(null);

export function useProfileContext(): Profile | null {
  return useContext(ProfileContext);
}
