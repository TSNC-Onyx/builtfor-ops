// ============================================================
// BILLING TYPES — aligned with Stripe object model
// All mutations route through stripe.service.ts — never direct DB
// ============================================================

export type StripePaymentStatus =
  | "requires_payment_method"
  | "requires_confirmation"
  | "requires_action"
  | "processing"
  | "succeeded"
  | "canceled"
  | "uncaptured";

export type StripeSubscriptionStatus =
  | "active"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "paused";

export type BillingEventType =
  | "setup_fee"
  | "subscription_created"
  | "subscription_updated"
  | "subscription_canceled"
  | "subscription_paused"
  | "subscription_resumed"
  | "payment_succeeded"
  | "payment_failed"
  | "refund";

/** Mirrors the billing_events Supabase table */
export interface BillingEvent {
  id: string;
  client_id: string;
  event_type: BillingEventType;
  amount_cents: number;
  currency: string;
  stripe_payment_intent_id: string | null;
  stripe_subscription_id: string | null;
  stripe_invoice_id: string | null;
  stripe_customer_id: string | null;
  status: StripePaymentStatus | StripeSubscriptionStatus | "recorded";
  description: string | null;
  created_at: string;
}

/** Mirrors the subscriptions Supabase table */
export interface Subscription {
  id: string;
  client_id: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  stripe_price_id: string | null;
  status: StripeSubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  amount_cents: number;
  currency: string;
  created_at: string;
  updated_at: string;
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

// Canonical pricing constants (cents) — mirrors @builtfor/config
export const PRICING = {
  founding_setup_cents: 249900,
  standard_setup_cents: 299900,
  tlcc_setup_cents: 249900,       // TLCC matches founding rate
  founding_monthly_cents: 30000,
  standard_monthly_cents: 40000,
  tlcc_monthly_cents: 30000,      // TLCC matches founding monthly
  off_season_monthly_cents: 9900,
} as const;

/** Map tier to setup fee amount in cents */
export function setupFeeCents(tier: "founding" | "standard" | "tlcc"): number {
  if (tier === "founding" || tier === "tlcc") return PRICING.founding_setup_cents;
  return PRICING.standard_setup_cents;
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatCentsDecimal(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
