// ============================================================
// STRIPE SERVICE — presentation-layer boundary
// All Stripe operations are initiated here.
// No UI component may call Stripe or mutate billing state directly.
//
// Architecture notes:
//   - Payment Links are stored in public.app_config (service role read)
//     keyed by stripe_payment_link_<tier>. Never in env vars.
//   - Mutations (cancel, pause, resume) invoke Supabase Edge
//     Functions which hold the secret key server-side.
//   - This service is a typed boundary; Edge Functions are
//     TODO stubs marked explicitly below.
// ============================================================

import { supabase } from "@/lib/supabase";
import type { BillingEvent, Subscription, SetupFeePayload, SubscriptionActionPayload } from "@/types/billing";

// --------------- PAYMENT LINK CONFIG (from app_config table) ---------------

const _linkCache: Record<string, string> = {};

/** Resolves a payment link URL from app_config by key. Cached after first fetch. */
async function resolvePaymentLink(key: string): Promise<string> {
  if (_linkCache[key]) return _linkCache[key];
  const { data, error } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error || !data?.value) return "https://dashboard.stripe.com/payments";
  _linkCache[key] = data.value;
  return data.value;
}

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
 * Resolves and builds the Stripe Payment Link URL for a client's setup fee.
 * Base link is read from public.app_config by pricing_tier key.
 * Appends prefilled_email and client_reference_id for reconciliation.
 */
export async function buildSetupFeePaymentLink(payload: SetupFeePayload): Promise<string> {
  const configKey =
    payload.pricing_tier === "founding"
      ? "stripe_payment_link_founding"
      : payload.pricing_tier === "tlcc"
      ? "stripe_payment_link_tlcc"
      : "stripe_payment_link_standard";

  const baseLink = await resolvePaymentLink(configKey);

  try {
    const url = new URL(baseLink);
    if (payload.email) url.searchParams.set("prefilled_email", payload.email);
    url.searchParams.set("client_reference_id", payload.client_id);
    return url.toString();
  } catch {
    return baseLink;
  }
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
