export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ProspectStage =
  | "lead" | "contacted" | "demo_scheduled" | "proposal_sent"
  | "design_partner" | "closed_won" | "closed_lost";

export type IndustryVertical =
  | "landscaping" | "hvac" | "plumbing" | "electrical" | "pest_control" | "cleaning";

export type ClientStatus = "onboarding" | "active" | "at_risk" | "churned" | "paused";
export type PricingTier = "founding" | "standard";

export interface Prospect {
  id: string;
  full_name: string;
  business_name: string;
  email: string | null;
  phone: string | null;
  vertical: IndustryVertical;
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

export const FOUNDING_SPOTS = 5;
