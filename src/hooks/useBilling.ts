import { useQuery } from "@tanstack/react-query";
import {
  fetchAllBillingEvents,
  fetchAllSubscriptions,
  fetchBillingEvents,
  fetchSubscription,
} from "@/lib/stripe.service";
import type { ClientBillingView } from "@/types/billing";
import type { Client } from "@/types/pipeline";

/** All billing events — for the ops Billing page overview */
export function useBillingEvents() {
  return useQuery({
    queryKey: ["billing_events"],
    queryFn: fetchAllBillingEvents,
  });
}

/** All subscriptions — for the ops Billing page overview */
export function useSubscriptions() {
  return useQuery({
    queryKey: ["subscriptions"],
    queryFn: fetchAllSubscriptions,
  });
}

/** Per-client billing events */
export function useClientBillingEvents(clientId: string) {
  return useQuery({
    queryKey: ["billing_events", clientId],
    queryFn: () => fetchBillingEvents(clientId),
    enabled: !!clientId,
  });
}

/** Per-client subscription */
export function useClientSubscription(clientId: string) {
  return useQuery({
    queryKey: ["subscription", clientId],
    queryFn: () => fetchSubscription(clientId),
    enabled: !!clientId,
  });
}

/**
 * Joins clients + subscriptions + billing_events into enriched ClientBillingView[]
 * for the ops Billing page table.
 */
export function useClientBillingViews(clients: Client[]): ClientBillingView[] {
  const { data: allSubs = [] } = useSubscriptions();
  const { data: allEvents = [] } = useBillingEvents();

  return clients.map((c) => {
    const subscription = allSubs.find((s) => s.client_id === c.id) ?? null;
    const billing_events = allEvents.filter((e) => e.client_id === c.id);
    const total_collected_cents = billing_events
      .filter((e) => e.status === "succeeded" || e.status === "recorded")
      .reduce((sum, e) => sum + (e.amount_cents ?? 0), 0);
    const setup_fee_paid = billing_events.some(
      (e) => e.event_type === "setup_fee" && (e.status === "succeeded" || e.status === "recorded")
    );

    return {
      client_id: c.id,
      business_name: c.business_name,
      owner_name: c.owner_name,
      email: c.email,
      pricing_tier: c.pricing_tier,
      subscription,
      billing_events,
      total_collected_cents,
      setup_fee_paid,
    };
  });
}
