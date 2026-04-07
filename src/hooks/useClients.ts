import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Client } from "@/types/pipeline";

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Client[];
    },
  });
}
