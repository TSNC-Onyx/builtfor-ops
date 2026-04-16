import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/context/SessionContext";
import type { Prospect, ProspectStage } from "@/types/pipeline";

// ---------------------------------------------------------------------------
// READ: direct Supabase query — RLS enforces tenant scope at DB level.
// enabled: !!session gates all reads behind auth resolution, preventing the
// post-refresh race where auth.uid() is null and RLS returns empty results.
// ---------------------------------------------------------------------------
export function useProspects() {
  const session = useSession();
  return useQuery({
    queryKey: ["prospects"],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospects")
        .select("*")
        .not("stage", "in", "(closed_won,closed_lost)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Prospect[];
    },
  });
}

export function useAllProspects() {
  const session = useSession();
  return useQuery({
    queryKey: ["prospects", "all"],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Prospect[];
    },
  });
}

// ---------------------------------------------------------------------------
// WRITES: all mutations route through service layer Edge Functions.
// Implements Service Layer v1 pipeline: authorize → validate → load →
// invariants → transact → audit → canonical response.
// ---------------------------------------------------------------------------

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

export function useUpdateProspectStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: ProspectStage }) =>
      invokeWithAuth("prospect-mutations", {
        action: "stage_change",
        prospect_id: id,
        stage,
        idempotency_key: `stage_${id}_${stage}_${Date.now()}`,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prospects"] }),
    onError: (e: Error) => toast.error(`Stage update failed: ${e.message}`),
  });
}

export function useUpdateProspect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Prospect> }) =>
      invokeWithAuth("prospect-mutations", {
        action: "update",
        prospect_id: id,
        updates,
        idempotency_key: `update_${id}_${Date.now()}`,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospects"] });
      toast.success("Prospect saved.");
    },
    onError: (e: Error) => toast.error(`Save failed: ${e.message}`),
  });
}

export function useAddProspect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prospect: Omit<Prospect, "id" | "created_at" | "updated_at">) =>
      invokeWithAuth("prospect-create", {
        ...prospect,
        idempotency_key: `create_${prospect.business_name}_${Date.now()}`,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospects"] });
      toast.success("Prospect added.");
    },
    onError: (e: Error) => toast.error(`Add failed: ${e.message}`),
  });
}

export function useConvertToClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prospect: Prospect) =>
      invokeWithAuth("prospect-convert", {
        prospect_id: prospect.id,
        pricing_tier: "founding",
        idempotency_key: `convert_${prospect.id}_${Date.now()}`,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospects"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Prospect converted to client.");
    },
    onError: (e: Error) => toast.error(`Conversion failed: ${e.message}`),
  });
}

export function useDismissProspect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      invokeWithAuth("prospect-mutations", {
        action: "dismiss",
        prospect_id: id,
        reason,
        idempotency_key: `dismiss_${id}_${Date.now()}`,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospects"] });
      toast.success("Lead dismissed and recorded.");
    },
    onError: (e: Error) => toast.error(`Dismiss failed: ${e.message}`),
  });
}
