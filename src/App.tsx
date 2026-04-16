import { useEffect, useState, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { ThemeProvider } from "@/hooks/useTheme";
import { supabase } from "@/lib/supabase";
import { ensureMembership, BUILTFOR_TENANT_ID } from "@/hooks/useProfile";
import { SessionContext } from "@/context/SessionContext";
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
// AuthGate — authoritative session source
//
// Pattern: getSession() initialises (handling token refresh internally),
// then onAuthStateChange handles all subsequent events. A ref guard prevents
// the race where SIGNED_IN / TOKEN_REFRESHED from onAuthStateChange fires
// before getSession() resolves, which would cause a double-setSession and
// potential null flash that traps the user in an empty unauthenticated state.
//
// The initialised ref ensures:
//   - getSession() always wins the initial state assignment
//   - onAuthStateChange only updates state after initialisation is confirmed
//   - SIGNED_OUT always clears state regardless of init order
// ---------------------------------------------------------------------------
function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(
    SUPABASE_CONFIGURED ? undefined : null
  );
  // Tracks whether getSession() has resolved and set initial state.
  // Prevents onAuthStateChange from overwriting the initialised state
  // with a stale event that fired during the getSession() async window.
  const initialised = useRef(false);

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) return;

    // Step 1: getSession() resolves the current session including any
    // in-flight token refresh. This is always the authoritative initial state.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      initialised.current = true;
    });

    // Step 2: onAuthStateChange handles all events after initialisation.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        // SIGNED_OUT must always be processed — even before init — to handle
        // the case where the session is invalidated server-side during load.
        if (event === "SIGNED_OUT") {
          initialised.current = true;
          setSession(null);
          queryClient.clear();
          return;
        }

        // All other events are held until getSession() has resolved.
        // This prevents a TOKEN_REFRESHED or SIGNED_IN event from firing
        // before getSession() completes and overwriting it with a duplicate
        // or out-of-order state update.
        if (!initialised.current) return;

        setSession(s);

        // Ensure membership row on SIGNED_IN. Non-fatal if it fails.
        if (event === "SIGNED_IN" && s?.user?.id) {
          try {
            const { data: profile } = await supabase
              .from("profiles")
              .select("role")
              .eq("id", s.user.id)
              .maybeSingle();
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
          style={{ color: "hsl(var(--muted-foreground))" }}>Loading…</span>
      </div>
    );
  }

  if (!session && SUPABASE_CONFIGURED) return <Login />;

  return (
    <SessionContext.Provider value={session}>
      {children}
      <DiscordFeed />
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
