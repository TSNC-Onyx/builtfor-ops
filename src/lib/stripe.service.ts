// ============================================================
// STRIPE SERVICE — presentation-layer boundary
// All Stripe operations are initiated here.
// No UI component may call Stripe or mutate billing state directly.
//
// Architecture notes:
//   - Frontend: Stripe.js (loaded via CDN in index.html) for
//     Payment Links and Checkout redirect flows only.
//   - Mutations (cancel, pause, resume) invoke Supabase Edge
//     Functions which hold the secret key server-side.
//   - This service is a typed boundary; Edge Functions are
//     TODO stubs marked explicitly below.
// ============================================================

import { supabase } from "@/lib/supabase";
import type { BillingEvent, Subscription, SetupFeePayload, SubscriptionActionPayload } from "@/types/billing";

// --------------- QUERIES (read-only, safe from frontend) ---------------

/** Fetch all billing_events for a given client, newest first. */
export async function fetchBillingEvents(clientId: string): Promise<BillingEvent[]> {
  const { data, error } = await supabase
    .from("billing_events")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BillingEvent[];
}

/** Fetch all billing_events across all clients (ops dashboard view). */
export async function fetchAllBillingEvents(): Promise<BillingEvent[]> {
  const { data, error } = await supabase
    .from("billing_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as BillingEvent[];
}

/** Fetch subscription record for a given client. */
export async function fetchSubscription(clientId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  return data as Subscription | null;
}

/** Fetch all subscriptions (ops view). */
export async function fetchAllSubscriptions(): Promise<Subscription[]> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Subscription[];
}

// --------------- PAYMENT LINK (setup fee) ---------------

/**
 * Generates a Stripe Payment Link URL for the one-time setup fee.
 *
 * IMPLEMENTATION DIRECTION:
 *   - Payment Links are created in the Stripe Dashboard ahead of time
 *     (one per pricing tier) and stored as env vars or in a config table.
 *   - This function assembles the correct link + prefills client email
 *     via Stripe's `prefilled_email` query param.
 *   - No secret key needed on the frontend — the link itself is public.
 *
 * TODO (Phase 2): Replace static links with dynamic Checkout Session
 *   creation via Edge Function for per-client metadata tagging.
 */
export function buildSetupFeePaymentLink(payload: SetupFeePayload): string {
  const baseLink =
    payload.pricing_tier === "founding"
      ? import.meta.env.VITE_STRIPE_PAYMENT_LINK_FOUNDING ?? ""
      : import.meta.env.VITE_STRIPE_PAYMENT_LINK_STANDARD ?? "";

  if (!baseLink) {
    // Graceful degradation — opens Stripe dashboard for manual charge
    return "https://dashboard.stripe.com/payments";
  }

  const url = new URL(baseLink);
  if (payload.email) url.searchParams.set("prefilled_email", payload.email);
  // Attach client_id as client_reference_id via query param for webhook reconciliation
  url.searchParams.set("client_reference_id", payload.client_id);
  return url.toString();
}

// --------------- SUBSCRIPTION MUTATIONS (via Edge Function) ---------------

/**
 * Invokes a Supabase Edge Function to perform subscription mutations.
 *
 * TODO (Edge Function): Deploy `manage-subscription` edge function.
 *   It must:
 *     1. Authenticate the caller via Supabase session
 *     2. Resolve the Stripe secret key from Vault (never from env on client)
 *     3. Call the appropriate Stripe API (cancel, pause, resume, update)
 *     4. Write audit record to billing_events
 *     5. Update subscriptions table status
 *     6. Return canonical success/error shape
 *
 * DEMO SCAFFOLD — marked explicit:
 *   Until the edge function is deployed, this throws a descriptive error
 *   rather than silently failing or performing the action client-side.
 */
export async function manageSubscription(
  payload: SubscriptionActionPayload
): Promise<{ ok: boolean; message: string }> {
  const { data, error } = await supabase.functions.invoke("manage-subscription", {
    body: payload,
  });

  if (error) {
    // Edge function not yet deployed — surface as actionable message
    const isNotDeployed =
      error.message?.includes("404") ||
      error.message?.includes("not found") ||
      error.message?.includes("FunctionsFetchError");

    if (isNotDeployed) {
      return {
        ok: false,
        message:
          `Subscription management requires the 'manage-subscription' Edge Function. ` +
          `Deploy it from the Supabase dashboard or via CLI. ` +
          `In the meantime, manage this subscription directly at dashboard.stripe.com.`,
      };
    }
    return { ok: false, message: error.message };
  }

  return { ok: true, message: data?.message ?? "Action completed." };
}
