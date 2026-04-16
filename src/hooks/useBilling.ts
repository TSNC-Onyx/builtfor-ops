import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/context/SessionContext";
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
  const session = useSession();
  return useQuery({
    queryKey: ["billing_events"],
    enabled: !!session,
    queryFn: fetchAllBillingEvents,
  });
}

export function useSubscriptions() {
  const session = useSession();
  return useQuery({
    queryKey: ["subscriptions"],
    enabled: !!session,
    queryFn: fetchAllSubscriptions,
  });
}

export function useClientBillingEvents(clientId: string) {
  const session = useSession();
  return useQuery({
    queryKey: ["billing_events", clientId],
    enabled: !!session && !!clientId,
    queryFn: () => fetchBillingEvents(clientId),
  });
}

export function useClientSubscription(clientId: string) {
  const session = useSession();
  return useQuery({
    queryKey: ["subscription", clientId],
    enabled: !!session && !!clientId,
    queryFn: () => fetchSubscription(clientId),
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
  const session = useSession();
  const result = useQuery({
    queryKey: ["payment_method", stripeCustomerId],
    enabled: !!session && !!stripeCustomerId,
    queryFn: () => fetchPaymentMethod(stripeCustomerId!),
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
    return assembleClientBillingView(c, subscription, events);
  });
}
