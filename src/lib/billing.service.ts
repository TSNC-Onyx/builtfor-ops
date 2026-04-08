// ============================================================
// BILLING SERVICE — domain logic boundary
// All billing aggregation and computation lives here.
// No hook or component may compute billing domain state directly.
//
// Aligns with Master Constitution:
//   - Service Layer §1.1: all domain reads/writes through service
//   - Non-negotiable rule §6: no workflow/business logic in components
//   - Non-negotiable rule §2: no domain DB access from UI
// ============================================================

import type { BillingEvent, Subscription, ClientBillingView } from "@/types/billing";
import type { Client } from "@/types/pipeline";

/**
 * Computes total collected cents from a set of billing events.
 * Only charge and setup_fee event types count as collected revenue.
 * Logic lives here — not in hooks or components.
 */
export function computeTotalCollected(events: BillingEvent[]): number {
  return events
    .filter((e) => e.event_type === "charge" || e.event_type === "setup_fee")
    .reduce((sum, e) => sum + (e.amount_cents ?? 0), 0);
}

/**
 * Determines whether setup fee has been paid for a client.
 * A setup_fee event of any amount being present is sufficient.
 */
export function computeSetupFeePaid(events: BillingEvent[]): boolean {
  return events.some((e) => e.event_type === "setup_fee");
}

/**
 * Assembles a ClientBillingView from raw domain records.
 * All derivation logic is here — hook and page receive the final view object.
 */
export function assembleClientBillingView(
  client: Client,
  subscription: Subscription | null,
  events: BillingEvent[]
): ClientBillingView {
  return {
    client_id: client.id,
    business_name: client.business_name,
    owner_name: client.owner_name,
    email: client.email,
    pricing_tier: client.pricing_tier,
    subscription,
    billing_events: events,
    total_collected_cents: computeTotalCollected(events),
    setup_fee_paid: computeSetupFeePaid(events),
  };
}

/**
 * Builds the full billing KPI summary from all subscriptions and events.
 * Called once at the page level — no inline useMemo computation in components.
 */
export interface BillingKpiSummary {
  activeSubCount: number;
  offSeasonSubCount: number;
  pastDueSubCount: number;
  mrr: number;
  totalCollected: number;
  setupFeesCollected: number;
}

export function computeBillingKpis(
  allSubs: Subscription[],
  allEvents: BillingEvent[]
): BillingKpiSummary {
  const activeSubs    = allSubs.filter((s) => s.status === "active");
  const offSeasonSubs = allSubs.filter((s) => s.status === "off_season");
  const pastDueSubs   = allSubs.filter((s) => s.status === "past_due");

  const mrr = activeSubs.reduce(
    (sum, s) => sum + (s.effective_rate_cents ?? s.monthly_rate_cents ?? 0),
    0
  );

  const totalCollected = allEvents
    .filter((e) => e.event_type === "charge" || e.event_type === "setup_fee")
    .reduce((sum, e) => sum + (e.amount_cents ?? 0), 0);

  const setupFeesCollected = allEvents
    .filter((e) => e.event_type === "setup_fee")
    .reduce((sum, e) => sum + (e.amount_cents ?? 0), 0);

  return {
    activeSubCount:    activeSubs.length,
    offSeasonSubCount: offSeasonSubs.length,
    pastDueSubCount:   pastDueSubs.length,
    mrr,
    totalCollected,
    setupFeesCollected,
  };
}
