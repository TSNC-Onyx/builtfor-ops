import { useQuery } from "@tanstack/react-query";
import {
  fetchAllBillingEvents,
  fetchAllSubscriptions,
  fetchBillingEvents,
  fetchSubscription,
  fetchPaymentMethod,
} from "@/lib/stripe.service";
import type { ClientBillingView, PaymentMethodSummary } from "@/types/billing";
import type { Client } from "@/types/pipeline";

export function useBillingEvents() {
  return useQuery({
    queryKey: ["billing_events"],
    queryFn: fetchAllBillingEvents,
  });
}

export function useSubscriptions() {
  return useQuery({
    queryKey: ["subscriptions"],
    queryFn: fetchAllSubscriptions,
  });
}

export function useClientBillingEvents(clientId: string) {
  return useQuery({
    queryKey: ["billing_events", clientId],
    queryFn: () => fetchBillingEvents(clientId),
    enabled: !!clientId,
  });
}

export function useClientSubscription(clientId: string) {
  return useQuery({
    queryKey: ["subscription", clientId],
    queryFn: () => fetchSubscription(clientId),
    enabled: !!clientId,
  });
}

/**
 * Fetches the payment method (card on file) for a Stripe customer.
 * Disabled when no stripe_customer_id is present.
 * Returns null when Edge Function not yet deployed.
 */
export function usePaymentMethod(stripeCustomerId: string | null | undefined): {
  data: PaymentMethodSummary | null;
  isLoading: boolean;
  isError: boolean;
} {
  const result = useQuery({
    queryKey: ["payment_method", stripeCustomerId],
    queryFn: () => fetchPaymentMethod(stripeCustomerId!),
    enabled: !!stripeCustomerId,
    staleTime: 60_000,
    retry: false, // don't retry — edge fn may not be deployed yet
  });
  return {
    data: result.data ?? null,
    isLoading: result.isLoading,
    isError: result.isError,
  };
}

/**
 * Joins clients + subscriptions + billing_events into enriched ClientBillingView[].
 * Uses occurred_at (actual DB column) for ordering.
 */
export function useClientBillingViews(clients: Client[]): ClientBillingView[] {
  const { data: allSubs = [] } = useSubscriptions();
  const { data: allEvents = [] } = useBillingEvents();

  return clients.map((c) => {
    const subscription = allSubs.find((s) => s.client_id === c.id) ?? null;
    const billing_events = allEvents.filter((e) => e.client_id === c.id);
    // total = all charge/setup_fee events (no status field on billing_events)
    const total_collected_cents = billing_events
      .filter((e) => e.event_type === "charge" || e.event_type === "setup_fee")
      .reduce((sum, e) => sum + (e.amount_cents ?? 0), 0);
    const setup_fee_paid = billing_events.some((e) => e.event_type === "setup_fee");

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
