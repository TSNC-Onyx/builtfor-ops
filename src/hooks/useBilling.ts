import { useQuery } from "@tanstack/react-query";
import {
  fetchAllBillingEvents,
  fetchAllSubscriptions,
  fetchBillingEvents,
  fetchSubscription,
  fetchPaymentMethod,
} from "@/lib/stripe.service";
import { assembleClientBillingView } from "@/lib/billing.service";
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
 * Returns null when Edge Function not yet deployed — caller handles scaffold state.
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
    retry: false,
  });
  return {
    data: result.data ?? null,
    isLoading: result.isLoading,
    isError: result.isError,
  };
}

/**
 * Joins clients + subscriptions + billing_events into ClientBillingView[].
 * Aggregation logic delegated to billing.service — hook is data assembly only.
 */
export function useClientBillingViews(clients: Client[]): ClientBillingView[] {
  const { data: allSubs = [] } = useSubscriptions();
  const { data: allEvents = [] } = useBillingEvents();

  return clients.map((c) => {
    const subscription = allSubs.find((s) => s.client_id === c.id) ?? null;
    const events = allEvents.filter((e) => e.client_id === c.id);
    // All derivation delegated to service — hook does not compute domain state
    return assembleClientBillingView(c, subscription, events);
  });
}
