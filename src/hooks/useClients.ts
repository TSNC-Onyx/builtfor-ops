import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/context/SessionContext";
import type { Client } from "@/types/pipeline";
import type { Subscription } from "@/types/billing";

/** Client record enriched with its subscription row for accurate rate display */
export interface ClientWithSubscription extends Client {
  subscription: Subscription | null;
}

// READ: gated on session readiness — prevents empty results on hard refresh.
export function useClients() {
  const session = useSession();
  return useQuery({
    queryKey: ["clients"],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select(`
          *,
          portal_invite_status,
          portal_invite_sent_at,
          portal_user_id,
          subscriptions (*)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: Client & { subscriptions: Subscription[] }) => ({
        ...row,
        subscription: row.subscriptions?.[0] ?? null,
      })) as ClientWithSubscription[];
    },
  });
}

// WRITE: routes through client-mutations service layer Edge Function.
async function invokeWithAuth(fn: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");
  const { data, error } = await supabase.functions.invoke(fn, {
    body,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.title ?? "Service error");
  return data.data;
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Client> }) =>
      invokeWithAuth("client-mutations", {
        client_id: id,
        updates,
        idempotency_key: `client_update_${id}_${Date.now()}`,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client saved.");
    },
    onError: (e: Error) => toast.error(`Save failed: ${e.message}`),
  });
}
