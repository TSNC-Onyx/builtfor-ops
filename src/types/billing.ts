// ============================================================
// BILLING TYPES — aligned with actual Supabase schema
// billing_events columns: id, client_id, subscription_id,
//   event_type, amount_cents, currency, stripe_payment_intent_id,
//   stripe_invoice_id, stripe_invoice_url, stripe_customer_id,
//   description, occurred_at
// subscriptions columns: id, client_id, pricing_tier,
//   setup_fee_cents, monthly_rate_cents, off_season_rate_cents,
//   is_off_season, effective_rate_cents (generated),
//   stripe_customer_id, stripe_subscription_id, status,
//   started_at, canceled_at, created_at, updated_at
// ============================================================

export type PaymentEventType =
  | "charge"
  | "payout"
  | "refund"
  | "adjustment"
  | "setup_fee";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "off_season"
  | "past_due"
  | "canceled";

/** Mirrors the billing_events Supabase table exactly */
export interface BillingEvent {
  id: string;
  client_id: string;
  subscription_id: string | null;
  event_type: PaymentEventType;
  amount_cents: number;
  currency: string;
  stripe_payment_intent_id: string | null;
  stripe_invoice_id: string | null;
  stripe_invoice_url: string | null;
  stripe_customer_id: string | null;
  description: string | null;
  occurred_at: string;
}

/** Mirrors the subscriptions Supabase table exactly */
export interface Subscription {
  id: string;
  client_id: string;
  pricing_tier: "founding" | "standard" | "tlcc";
  setup_fee_cents: number | null;
  monthly_rate_cents: number | null;
  off_season_rate_cents: number;
  is_off_season: boolean;
  effective_rate_cents: number | null;  // generated column
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: SubscriptionStatus;
  started_at: string;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Card on file — returned by get-payment-method Edge Function */
export interface PaymentMethodSummary {
  brand: string;           // e.g. "visa", "mastercard"
  last4: string;
  exp_month: number;
  exp_year: number;
  cardholder_name: string | null;
}

/** Enriched view used by the Billing page — client + sub + events joined */
export interface ClientBillingView {
  client_id: string;
  business_name: string;
  owner_name: string;
  email: string;
  pricing_tier: "founding" | "standard" | "tlcc";
  subscription: Subscription | null;
  billing_events: BillingEvent[];
  total_collected_cents: number;
  setup_fee_paid: boolean;
}

/** Payload to generate a Stripe Payment Link for setup fee */
export interface SetupFeePayload {
  client_id: string;
  business_name: string;
  email: string;
  amount_cents: number;
  pricing_tier: "founding" | "standard" | "tlcc";
}

/** Payload for subscription management actions */
export interface SubscriptionActionPayload {
  client_id: string;
  stripe_subscription_id: string;
  action: "cancel" | "pause" | "resume" | "update_price";
  new_price_id?: string;
  cancel_at_period_end?: boolean;
}

// Canonical pricing constants (cents)
export const PRICING = {
  founding_setup_cents:  249900,
  standard_setup_cents:  299900,
  tlcc_setup_cents:       20000,
  founding_monthly_cents: 30000,
  standard_monthly_cents: 40000,
  tlcc_monthly_cents:     20000,
  off_season_monthly_cents: 9900,
} as const;

/** Map tier to setup fee amount in cents */
export function setupFeeCents(tier: "founding" | "standard" | "tlcc"): number {
  if (tier === "tlcc")     return PRICING.tlcc_setup_cents;
  if (tier === "founding") return PRICING.founding_setup_cents;
  return PRICING.standard_setup_cents;
}

/** Map tier to monthly rate in cents */
export function monthlyRateCents(tier: "founding" | "standard" | "tlcc"): number {
  if (tier === "tlcc")     return PRICING.tlcc_monthly_cents;
  if (tier === "founding") return PRICING.founding_monthly_cents;
  return PRICING.standard_monthly_cents;
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatCentsDecimal(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
