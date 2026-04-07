import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { Prospect, ProspectStage, Client } from "@/types/pipeline";

export function useProspects() {
  return useQuery({
    queryKey: ["prospects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("prospects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Prospect[];
    },
  });
}

export function useUpdateProspectStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: ProspectStage }) => {
      const { error } = await supabase.from("prospects").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prospects"] }),
    onError: (err: Error) => toast.error(`Stage update failed: ${err.message}`),
  });
}

export function useUpdateProspect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Prospect> }) => {
      const { error } = await supabase.from("prospects").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospects"] });
      toast.success("Prospect saved.");
    },
    onError: (err: Error) => toast.error(`Save failed: ${err.message}`),
  });
}

export function useAddProspect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prospect: Omit<Prospect, "id" | "created_at" | "updated_at">) => {
      const { error } = await supabase.from("prospects").insert(prospect);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospects"] });
      toast.success("Prospect added.");
    },
    onError: (err: Error) => toast.error(`Add failed: ${err.message}`),
  });
}

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Client[];
    },
  });
}

export function useConvertToClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prospect: Prospect) => {
      const { error: clientError } = await supabase.from("clients").insert({
        prospect_id: prospect.id,
        business_name: prospect.business_name,
        owner_name: prospect.full_name,
        email: prospect.email ?? "",
        phone: prospect.phone,
        vertical: prospect.vertical,
        state: prospect.state,
        status: "onboarding",
        pricing_tier: "founding",
      });
      if (clientError) throw clientError;
      const { error: stageError } = await supabase.from("prospects").update({ stage: "closed_won" }).eq("id", prospect.id);
      if (stageError) throw stageError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospects"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Prospect converted to client.");
    },
    onError: (err: Error) => toast.error(`Conversion failed: ${err.message}`),
  });
}
