import { useEffect, useState, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
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
// AuthGate
// Uses onAuthStateChange as the single source of session truth per Supabase
// JS v2 documentation. INITIAL_SESSION fires synchronously on subscription
// setup and carries the restored session — eliminating the getSession() race.
//
// ensureMembership is called only on SIGNED_IN (not TOKEN_REFRESHED) to avoid
// repeated upsert attempts. The membership row is already seeded for existing
// operators; this call is purely a safety net for future new hires.
// ---------------------------------------------------------------------------
function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(
    SUPABASE_CONFIGURED ? undefined : null
  );

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) return;

    // Single source of truth: onAuthStateChange handles INITIAL_SESSION,
    // SIGNED_IN, TOKEN_REFRESHED, and SIGNED_OUT in one place.
    // Do NOT call getSession() concurrently — it creates a race condition
    // where INITIAL_SESSION (null) from onAuthStateChange fires before
    // getSession() resolves, briefly rendering Login for authenticated users.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        // Update session state immediately on every event — no awaits before this.
        setSession(s);

        if (event === "SIGNED_OUT") {
          queryClient.clear();
          return;
        }

        // Ensure membership row on SIGNED_IN only.
        // Wrapped in try/catch — a failure here must never block session state.
        // TOKEN_REFRESHED excluded: membership already exists after first login.
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
            // Non-fatal: membership row already exists in all normal cases.
            // Silently ignored — session proceeds regardless.
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
