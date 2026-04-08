export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ProspectStage =
  | "lead" | "contacted" | "demo_scheduled" | "proposal_sent"
  | "design_partner" | "closed_won" | "closed_lost";

export type IndustryVertical =
  | "landscaping" | "hvac" | "plumbing" | "electrical" | "pest_control" | "cleaning" | "other";

export type ClientStatus = "onboarding" | "active" | "at_risk" | "churned" | "paused";

/** Mirrors the pricing_tier DB enum — must stay in sync with Supabase */
export type PricingTier = "founding" | "standard" | "tlcc";

export interface Prospect {
  id: string;
  full_name: string;
  business_name: string;
  email: string | null;
  phone: string | null;
  vertical: IndustryVertical;
  vertical_custom: string | null;
  stage: ProspectStage;
  state: string | null;
  source: string | null;
  referrer_client_id: string | null;
  notes: string | null;
  next_action: string | null;
  next_action_date: string | null;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  prospect_id: string | null;
  business_name: string;
  owner_name: string;
  email: string;
  phone: string | null;
  vertical: IndustryVertical;
  vertical_custom: string | null;
  state: string | null;
  status: ClientStatus;
  pricing_tier: PricingTier;
  tenant_project_ref: string | null;
  health_signal: string;
  health_score: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const STAGE_ORDER: ProspectStage[] = [
  "lead", "contacted", "demo_scheduled", "proposal_sent",
  "design_partner", "closed_won", "closed_lost",
];

export const STAGE_LABELS: Record<ProspectStage, string> = {
  lead: "Lead",
  contacted: "Contacted",
  demo_scheduled: "Demo Scheduled",
  proposal_sent: "Proposal Sent",
  design_partner: "Design Partner",
  closed_won: "Closed — Won",
  closed_lost: "Closed — Lost",
};

export const SOURCE_LABELS: Record<string, string> = {
  outreach: "Outreach",
  referral: "Referral",
  trade_show: "Trade Show",
  inbound: "Inbound",
};

export const TIER_LABELS: Record<PricingTier, string> = {
  founding: "Founding Member",
  standard: "Standard Member",
  tlcc:     "TLCC Member",
};

/**
 * Canonical ordered list of all pricing tiers.
 * Single source of truth for dropdowns and selects across the ops portal.
 */
export const TIER_OPTIONS: PricingTier[] = ["founding", "standard", "tlcc"];

/** Maps pricing tier to its app_config key for payment link resolution */
export const TIER_CONFIG_KEY: Record<PricingTier, string> = {
  founding: "stripe_payment_link_founding",
  standard: "stripe_payment_link_standard",
  tlcc:     "stripe_payment_link_tlcc",
};

export const FOUNDING_SPOTS = 5;

/** Returns the display label for a vertical, using custom text when vertical = 'other' */
export function verticalLabel(vertical: IndustryVertical, custom: string | null | undefined): string {
  if (vertical === "other") return custom?.trim() || "Other";
  return vertical.replace("_", " ");
}
