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

function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    // Hydrate from existing session immediately
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    // Keep in sync with auth state changes (login / logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Invalidate all queries on auth change so stale data is never shown
      queryClient.clear();
    });

    return () => subscription.unsubscribe();
  }, []);

  // Still resolving session from storage
  if (session === undefined) return null;

  if (!session) return <Login />;

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
