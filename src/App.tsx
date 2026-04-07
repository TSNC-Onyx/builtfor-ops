import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { ThemeProvider } from "@/hooks/useTheme";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import Dashboard from "./pages/Dashboard";
import Pipeline from "./pages/Pipeline";
import Clients from "./pages/Clients";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// When Supabase env vars are absent (Bolt.new visual preview), skip auth entirely.
const SUPABASE_CONFIGURED =
  !!import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_URL !== "https://placeholder.supabase.co";

function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(
    // If Supabase is not configured, treat as a passthrough immediately.
    SUPABASE_CONFIGURED ? undefined : null
  );

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) return;

    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      queryClient.clear();
    });

    return () => subscription.unsubscribe();
  }, []);

  // Still resolving session from storage
  if (session === undefined) return null;

  // No session and Supabase is live — show login
  if (!session && SUPABASE_CONFIGURED) return <Login />;

  return <>{children}</>;
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
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthGate>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
