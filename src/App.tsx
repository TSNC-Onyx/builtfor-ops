import { useEffect, useState } from "react";
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
// AuthGate — session management
//
// Pattern validated against Supabase JS v2 source and community docs:
//
// 1. getSession() initialises session state. It handles token refresh
//    internally before resolving, so the returned session is always valid
//    or null (never an expired token).
//
// 2. onAuthStateChange listens for subsequent events (SIGNED_IN, SIGNED_OUT,
//    TOKEN_REFRESHED) after initial load. INITIAL_SESSION is ignored here
//    because getSession() already covers it — and INITIAL_SESSION can fire
//    with null on the first tick when a token refresh is in flight, which
//    would incorrectly flash <Login /> before the refreshed session arrives.
//
// 3. setSession is always called before any awaits to ensure React state
//    updates are not deferred by async side-effects.
// ---------------------------------------------------------------------------
function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(
    SUPABASE_CONFIGURED ? undefined : null
  );

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) return;

    // Step 1: initialise from storage (handles token refresh internally)
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    // Step 2: listen for subsequent auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        // Skip INITIAL_SESSION — getSession() above handles initialisation.
        // Responding to INITIAL_SESSION here risks overwriting a valid
        // in-flight token refresh with a null session.
        if (event === "INITIAL_SESSION") return;

        // For all other events, update session immediately — no awaits first.
        setSession(s);

        if (event === "SIGNED_OUT") {
          queryClient.clear();
          return;
        }

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
