import { useEffect, useState, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { ThemeProvider } from "@/hooks/useTheme";
import { supabase } from "@/lib/supabase";
import { ensureMembership, fetchProfile, BUILTFOR_TENANT_ID } from "@/hooks/useProfile";
import type { Profile } from "@/hooks/useProfile";
import { SessionContext } from "@/context/SessionContext";
import { ProfileContext } from "@/context/ProfileContext";
import type { Session } from "@supabase/supabase-js";
import Dashboard from "./pages/Dashboard";
import Pipeline from "./pages/Pipeline";
import Clients from "./pages/Clients";
import Billing from "./pages/Billing";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import { DiscordFeed } from "./components/ops/DiscordFeed";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error: unknown) => {
        const msg = error instanceof Error ? error.message : "";
        if (msg.includes("JWT") || msg.includes("not authenticated")) return false;
        return failureCount < 2;
      },
    },
  },
});

const SUPABASE_CONFIGURED =
  !!import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_URL !== "https://placeholder.supabase.co";

// ---------------------------------------------------------------------------
// AuthGate — authoritative session + profile source
//
// Session pattern:
//   getSession() initialises (handling token refresh internally), then
//   onAuthStateChange handles subsequent events. A ref guard prevents
//   onAuthStateChange events that fire during the getSession() async window
//   from overwriting the resolved session with stale or null state.
//
// Profile pattern:
//   Fetched once after session resolves, keyed on user ID (not session object).
//   Stored in ProfileContext so it survives page navigation without re-fetching.
//   Token refreshes produce a new session object reference but same user ID —
//   the profile is NOT re-fetched, eliminating the nav flicker entirely.
// ---------------------------------------------------------------------------
function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(
    SUPABASE_CONFIGURED ? undefined : null
  );
  const [profile, setProfile] = useState<Profile | null>(null);
  const initialised = useRef(false);
  // Track which user ID we've already fetched a profile for — prevents
  // redundant fetches on token refresh (same uid, new session object).
  const profileUid = useRef<string | null>(null);

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) return;

    // Step 1: initialise session from storage (handles token refresh internally)
    supabase.auth.getSession().then(async ({ data }) => {
      const s = data.session;
      setSession(s);
      initialised.current = true;

      // Fetch profile immediately after session resolves
      if (s?.user?.id && profileUid.current !== s.user.id) {
        profileUid.current = s.user.id;
        const p = await fetchProfile(s.user.id);
        setProfile(p);
      }
    });

    // Step 2: handle subsequent auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        // SIGNED_OUT always clears immediately
        if (event === "SIGNED_OUT") {
          initialised.current = true;
          profileUid.current = null;
          setSession(null);
          setProfile(null);
          queryClient.clear();
          return;
        }

        // Hold all other events until getSession() has resolved
        if (!initialised.current) return;

        setSession(s);

        // Only re-fetch profile if the user ID has actually changed
        // (i.e. a different user signed in). Token refreshes share the same
        // user ID — profile is retained, no flicker.
        if (s?.user?.id && profileUid.current !== s.user.id) {
          profileUid.current = s.user.id;
          const p = await fetchProfile(s.user.id);
          setProfile(p);
        }

        // Ensure membership row on SIGNED_IN. Non-fatal if it fails.
        if (event === "SIGNED_IN" && s?.user?.id) {
          try {
            const role = profile?.role ?? "tenant_owner";
            await ensureMembership(s.user.id, BUILTFOR_TENANT_ID, role);
          } catch {
            // Non-fatal — membership row already exists in all normal cases.
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "hsl(var(--background))" }}>
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase animate-pulse"
          style={{ color: "hsl(var(--muted-foreground))" }}>Loading\u2026</span>
      </div>
    );
  }

  if (!session && SUPABASE_CONFIGURED) return <Login />;

  return (
    <SessionContext.Provider value={session}>
      <ProfileContext.Provider value={profile}>
        {children}
        <DiscordFeed />
      </ProfileContext.Provider>
    </SessionContext.Provider>
  );
}

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster richColors position="top-right" />
        <BrowserRouter>
          <AuthGate>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/pipeline" element={<Pipeline />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthGate>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
