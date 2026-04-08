// ============================================================
// STRIPE SERVICE — presentation-layer boundary
// All Stripe operations initiated here.
// No UI component may call Stripe or mutate billing state directly.
//
// Architecture:
//   - All Stripe config stored in public.app_config
//   - Payment method reads → get-payment-method Edge Function
//   - Customer portal (payment method update) → create-customer-portal-session Edge Function
//   - Subscription mutations → manage-subscription Edge Function
//   - Secret key never touches the frontend
// ============================================================

import { supabase } from "@/lib/supabase";
import type {
  BillingEvent,
  Subscription,
  SetupFeePayload,
  SubscriptionActionPayload,
  PaymentMethodSummary,
} from "@/types/billing";

// --------------- APP CONFIG CACHE ---------------

const _configCache: Record<string, string> = {};

async function resolveConfig(key: string, fallback = ""): Promise<string> {
  if (_configCache[key]) return _configCache[key];
  const { data, error } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error || !data?.value) return fallback;
  _configCache[key] = data.value;
  return data.value;
}

export async function getStripePublishableKey(): Promise<string> {
  return resolveConfig("stripe_publishable_key", "");
}

// --------------- QUERIES ---------------

/** Fetch billing_events for a client ordered by occurred_at desc */
export async function fetchBillingEvents(clientId: string): Promise<BillingEvent[]> {
  const { data, error } = await supabase
    .from("billing_events")
    .select("*")
    .eq("client_id", clientId)
    .order("occurred_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BillingEvent[];
}

/** Fetch all billing_events across all clients */
export async function fetchAllBillingEvents(): Promise<BillingEvent[]> {
  const { data, error } = await supabase
    .from("billing_events")
    .select("*")
    .order("occurred_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as BillingEvent[];
}

/** Fetch subscription for a client */
export async function fetchSubscription(clientId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  return data as Subscription | null;
}

/** Fetch all subscriptions */
export async function fetchAllSubscriptions(): Promise<Subscription[]> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Subscription[];
}

// --------------- PAYMENT METHOD (via Edge Function) ---------------

/**
 * Fetches the default payment method (card on file) for a Stripe customer.
 * Calls the get-payment-method Edge Function which holds the secret key.
 *
 * TODO: Deploy `get-payment-method` Edge Function:
 *   1. Receive stripe_customer_id
 *   2. Call stripe.customers.retrieve(id, { expand: ['invoice_settings.default_payment_method'] })
 *   3. Return { brand, last4, exp_month, exp_year, cardholder_name }
 */
export async function fetchPaymentMethod(
  stripeCustomerId: string
): Promise<PaymentMethodSummary | null> {
  const { data, error } = await supabase.functions.invoke("get-payment-method", {
    body: { stripe_customer_id: stripeCustomerId },
  });
  if (error) {
    // Edge function not yet deployed — return null so UI shows scaffold state
    return null;
  }
  return data as PaymentMethodSummary | null;
}

// --------------- CUSTOMER PORTAL (payment method update) ---------------

/**
 * Generates a Stripe Customer Portal session URL.
 * The portal is Stripe-hosted — card data never touches BuiltFor servers.
 * Calls the create-customer-portal-session Edge Function.
 *
 * TODO: Deploy `create-customer-portal-session` Edge Function:
 *   1. Authenticate caller
 *   2. Receive stripe_customer_id and return_url
 *   3. Call stripe.billingPortal.sessions.create({ customer, return_url })
 *   4. Return { url }
 */
export async function createCustomerPortalSession(
  stripeCustomerId: string,
  returnUrl: string
): Promise<{ url: string } | null> {
  const { data, error } = await supabase.functions.invoke("create-customer-portal-session", {
    body: { stripe_customer_id: stripeCustomerId, return_url: returnUrl },
  });
  if (error) return null;
  return data as { url: string };
}

// --------------- PAYMENT LINK ---------------

export async function buildSetupFeePaymentLink(payload: SetupFeePayload): Promise<string> {
  const configKey =
    payload.pricing_tier === "founding" ? "stripe_payment_link_founding"
    : payload.pricing_tier === "tlcc"    ? "stripe_payment_link_tlcc"
    : "stripe_payment_link_standard";

  const baseLink = await resolveConfig(configKey, "https://dashboard.stripe.com/payments");

  try {
    const url = new URL(baseLink);
    if (payload.email) url.searchParams.set("prefilled_email", payload.email);
    url.searchParams.set("client_reference_id", payload.client_id);
    return url.toString();
  } catch {
    return baseLink;
  }
}

// --------------- SUBSCRIPTION MUTATIONS ---------------

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
