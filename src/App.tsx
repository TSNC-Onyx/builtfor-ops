import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { ThemeProvider } from "@/hooks/useTheme";
import { supabase } from "@/lib/supabase";
import { ensureMembership, BUILTFOR_TENANT_ID } from "@/hooks/useProfile";
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

function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(
    SUPABASE_CONFIGURED ? undefined : null
  );

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) return;

    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s);
      if (event === "SIGNED_OUT") {
        queryClient.clear();
        return;
      }
      // On sign-in or token refresh, ensure membership row exists.
      // This is idempotent — safe on every auth event. Covers:
      //   • First login after migration (row already seeded, upsert is no-op)
      //   • Any future new operator added via Supabase Auth admin
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && s?.user?.id) {
        // Resolve role from profiles if available, fall back to tenant_owner
        // for the platform operator (only role that can access this app).
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", s.user.id)
          .maybeSingle();
        const role = profile?.role ?? "tenant_owner";
        await ensureMembership(s.user.id, BUILTFOR_TENANT_ID, role);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "hsl(var(--background))" }}>
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase animate-pulse" style={{ color: "hsl(var(--muted-foreground))" }}>Loading…</span>
      </div>
    );
  }

  if (!session && SUPABASE_CONFIGURED) return <Login />;

  return (
    <>
      {children}
      <DiscordFeed />
    </>
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
