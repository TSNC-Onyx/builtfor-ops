import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

interface InviteResult {
  ok: boolean;
  email?: string;
  invite_link?: string;
  message?: string;
  error?: string;
}

/**
 * Calls the send-portal-invite Edge Function for a given client_id.
 * On success, invalidates the clients query so the UI reflects the updated
 * portal_invite_status ('invited') immediately.
 */
export function usePortalInvite() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  async function sendInvite(clientId: string): Promise<InviteResult> {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { ok: false, error: "Not authenticated" };

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-portal-invite`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ client_id: clientId }),
        }
      );

      const json: InviteResult = await res.json();

      if (res.ok && json.ok) {
        // Invalidate so the Clients list refetches updated portal_invite_status
        queryClient.invalidateQueries({ queryKey: ["clients"] });
        return json;
      }

      return { ok: false, error: json.error ?? "Unknown error" };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    } finally {
      setLoading(false);
    }
  }

  return { sendInvite, loading };
}
