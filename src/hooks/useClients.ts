import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Client } from "@/types/pipeline";
import type { Subscription } from "@/types/billing";

/** Client record enriched with its subscription row for accurate rate display */
export interface ClientWithSubscription extends Client {
  subscription: Subscription | null;
}

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      // Join subscriptions so MRR and rate displays read from actual DB values,
      // never from hardcoded tier assumptions.
      const { data, error } = await supabase
        .from("clients")
        .select(`
          *,
          subscriptions (*)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Supabase returns subscriptions as an array (one-to-many shape).
      // Normalise to a single subscription or null.
      return (data ?? []).map((row: Client & { subscriptions: Subscription[] }) => ({
        ...row,
        subscription: row.subscriptions?.[0] ?? null,
      })) as ClientWithSubscription[];
    },
  });
}
