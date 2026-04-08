import { useState, useMemo } from "react";
import { toast } from "sonner";
import { OpsShell } from "@/components/ops/OpsShell";
import { MetricsBar } from "@/components/ops/MetricsBar";
import { DrillDownPanel } from "@/components/ops/DrillDownPanel";
import { useClients } from "@/hooks/useClients";
import { useProspects } from "@/hooks/useProspects";
import {
  useClientBillingViews,
  useSubscriptions,
  useBillingEvents,
  usePaymentMethod,
} from "@/hooks/useBilling";
import {
  buildSetupFeePaymentLink,
  manageSubscription,
  createCustomerPortalSession,
} from "@/lib/stripe.service";
import { computeBillingKpis } from "@/lib/billing.service";
import {
  formatCents,
  formatCentsDecimal,
  setupFeeCents,
  type ClientBillingView,
  type BillingEvent,
  type Subscription,
  type PaymentMethodSummary,
} from "@/types/billing";
import { TIER_LABELS } from "@/types/pipeline";
import { formatDate } from "@/lib/utils";

const RUST  = "hsl(20,63%,47%)";
const NAVY  = "hsl(213,58%,27%)";
const STEEL = "hsl(216,21%,62%)";
const GREEN = "hsl(145,50%,40%)";

function fmt(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function subStatusColor(s: string): string {
  const map: Record<string, string> = {
    active: GREEN, trialing: NAVY, off_season: STEEL,
    past_due: RUST, canceled: STEEL,
  };
  return map[s] ?? STEEL;
}

function eventTypeColor(t: string): string {
  if (t === "setup_fee" || t === "charge") return GREEN;
  if (t === "refund") return RUST;
  if (t === "adjustment") return NAVY;
  return STEEL;
}

export default function Billing() {
  const { data: clients = [], isLoading: cLoading } = useClients();
  const { data: prospects = [] } = useProspects();
  const { data: allSubs = [], isLoading: sLoading } = useSubscriptions();
  const { data: allEvents = [], isLoading: eLoading } = useBillingEvents();
  const billingViews = useClientBillingViews(clients);

  const [search, setSearch]             = useState("");
  const [selected, setSelected]         = useState<ClientBillingView | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isLoading = cLoading || sLoading || eLoading;

  // KPI computation delegated entirely to billing.service
  const kpis = useMemo(
    () => computeBillingKpis(allSubs, allEvents),
    [allSubs, allEvents]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return billingViews;
    return billingViews.filter(
      (v) =>
        v.business_name.toLowerCase().includes(q) ||
        v.owner_name.toLowerCase().includes(q) ||
        v.email?.toLowerCase().includes(q)
    );
  }, [billingViews, search]);

  async function handleCopyPaymentLink(view: ClientBillingView) {
    const url = await buildSetupFeePaymentLink({
      client_id: view.client_id,
      business_name: view.business_name,
      email: view.email,
      amount_cents: setupFeeCents(view.pricing_tier),
      pricing_tier: view.pricing_tier,
    });
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Payment link copied to clipboard");
    } catch {
      window.open(url, "_blank");
      toast.info("Opened payment link in new tab");
    }
  }

  async function handleOpenPaymentLink(view: ClientBillingView) {
    const url = await buildSetupFeePaymentLink({
      client_id: view.client_id,
      business_name: view.business_name,
      email: view.email,
      amount_cents: setupFeeCents(view.pricing_tier),
      pricing_tier: view.pricing_tier,
    });
    window.open(url, "_blank");
  }

  async function handleSubscriptionAction(
    view: ClientBillingView,
    action: "cancel" | "pause" | "resume"
  ) {
    if (!view.subscription?.stripe_subscription_id) {
      toast.error("No Stripe subscription ID on record for this client.");
      return;
    }
    setActionLoading(true);
    const result = await manageSubscription({
      client_id: view.client_id,
      stripe_subscription_id: view.subscription.stripe_subscription_id,
      action,
      cancel_at_period_end: action === "cancel" ? true : undefined,
    });
    setActionLoading(false);
    result.ok
      ? toast.success(result.message)
      : toast.error(result.message, { duration: 8000 });
  }

  return (
    <OpsShell>
      <MetricsBar prospects={prospects} clients={clients} />

      <div className="px-4 md:px-6 py-4" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <h1 className="font-display text-[24px] md:text-[28px] tracking-[0.02em] leading-none" style={{ color: "hsl(var(--foreground))" }}>Billing</h1>
        <p className="font-body text-[12px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
          Stripe payment history · subscription management · setup fee collection
        </p>
      </div>

      <div className="px-4 md:px-6 py-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <BillingKpi label="Active Subs"     value={kpis.activeSubCount}                   color={NAVY} />
        <BillingKpi label="MRR (Stripe)"    value={formatCents(kpis.mrr)}                  color={RUST} />
        <BillingKpi label="Total Collected" value={formatCents(kpis.totalCollected)} />
        <BillingKpi label="Setup Fees"      value={formatCents(kpis.setupFeesCollected)} />
        <BillingKpi label="Off-Season"      value={kpis.offSeasonSubCount}                color={kpis.offSeasonSubCount > 0 ? STEEL : undefined} />
        <BillingKpi label="Past Due"        value={kpis.pastDueSubCount}                  color={kpis.pastDueSubCount > 0 ? RUST : undefined} alert={kpis.pastDueSubCount > 0} />
      </div>

      <div className="px-4 md:px-6 py-3" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <input
          type="text" placeholder="Search client name, owner, email…"
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: "13px",
            padding: "7px 12px", width: "100%", maxWidth: "360px",
            border: "1px solid hsl(var(--border))",
            backgroundColor: "hsl(var(--surface-raised))",
            color: "hsl(var(--foreground))", outline: "none",
          }}
        />
      </div>

      {isLoading && (
        <div className="px-4 md:px-6 py-4 font-mono text-[11px] tracking-[0.14em] uppercase animate-pulse" style={{ color: "hsl(var(--muted-foreground))" }}>
          Loading billing data…
        </div>
      )}

      {!isLoading && (
        <div className="px-4 md:px-6 pb-6 space-y-1 mt-3">
          {filtered.length === 0 && (
            <div className="p-10 text-center" style={{ border: "1px dashed hsl(var(--border))" }}>
              <div className="font-mono text-[10px] tracking-[0.14em] uppercase" style={{ color: "hsl(var(--muted-foreground))" }}>
                {clients.length === 0
                  ? "No clients yet — convert a won prospect from Pipeline"
                  : "No results match search"}
              </div>
            </div>
          )}
          {filtered.map((view) => (
            <ClientBillingRow key={view.client_id} view={view} onSelect={() => setSelected(view)} />
          ))}
        </div>
      )}

      {selected && (
        <DrillDownPanel title={selected.business_name} onClose={() => setSelected(null)}>
          <ClientBillingDetail
            view={selected}
            actionLoading={actionLoading}
            onCopyLink={() => handleCopyPaymentLink(selected)}
            onOpenLink={() => handleOpenPaymentLink(selected)}
            onAction={(action) => handleSubscriptionAction(selected, action)}
          />
        </DrillDownPanel>
      )}
    </OpsShell>
  );
}

// ============================================================
// Presentation components — render and collect input only.
// No service calls, no domain logic, no business derivation.
// ============================================================

function BillingKpi({ label, value, color, alert }: {
  label: string; value: string | number; color?: string; alert?: boolean;
}) {
  return (
    <div style={{
      backgroundColor: "hsl(var(--surface-raised))",
      border: alert ? "1px solid hsl(var(--rust) / 0.4)" : "1px solid hsl(var(--surface-border))",
      padding: "12px 14px",
    }}>
      <div className="font-mono text-[9px] tracking-[0.14em] uppercase mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>{label}</div>
      <div className="font-display text-[22px] leading-none" style={{ color: color ?? "hsl(var(--foreground))" }}>{value}</div>
    </div>
  );
}

function ClientBillingRow({ view, onSelect }: { view: ClientBillingView; onSelect: () => void }) {
  const sub = view.subscription;
  const subStatus = sub?.status ?? null;
  return (
    <div
      onClick={onSelect}
      className="flex items-center gap-3 md:gap-5 px-4 py-3 cursor-pointer hover:opacity-80 transition-opacity"
      style={{ backgroundColor: "hsl(var(--surface-raised))", border: "1px solid hsl(var(--surface-border))" }}
    >
      <div className="flex-1 min-w-0">
        <div className="font-body text-[13px] font-semibold truncate" style={{ color: "hsl(var(--foreground))" }}>{view.business_name}</div>
        <div className="font-body text-[11px] truncate" style={{ color: "hsl(var(--muted-foreground))" }}>{view.owner_name}</div>
      </div>
      <span
        className="hidden sm:inline font-mono text-[9px] tracking-[0.1em] uppercase px-2 py-1 flex-shrink-0"
        style={{ border: `1px solid ${view.setup_fee_paid ? GREEN : RUST}`, color: view.setup_fee_paid ? GREEN : RUST }}
      >
        {view.setup_fee_paid ? "Setup Paid" : "Setup Pending"}
      </span>
      {subStatus ? (
        <span
          className="font-mono text-[9px] tracking-[0.1em] uppercase px-2 py-1 flex-shrink-0"
          style={{ border: `1px solid ${subStatusColor(subStatus)}`, color: subStatusColor(subStatus) }}
        >
          {fmt(subStatus)}
        </span>
      ) : (
        <span
          className="hidden md:inline font-mono text-[9px] tracking-[0.1em] uppercase px-2 py-1 flex-shrink-0"
          style={{ border: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}
        >
          No Sub
        </span>
      )}
      <span className="hidden md:inline font-display text-[16px] flex-shrink-0" style={{ color: "hsl(var(--foreground))" }}>
        {sub && sub.status === "active"
          ? formatCents(sub.effective_rate_cents ?? sub.monthly_rate_cents ?? 0)
          : "—"}
        <span className="font-mono text-[8px] ml-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>/mo</span>
      </span>
      <span className="hidden lg:inline font-mono text-[10px] flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>
        {formatCents(view.total_collected_cents)} collected
      </span>
      <span className="font-mono text-[11px] flex-shrink-0" style={{ color: "hsl(var(--rust))" }}>→</span>
    </div>
  );
}

/**
 * ClientBillingDetail — pure presentation.
 * Receives all data and callbacks from parent page.
 * No service calls, no domain computation.
 */
function ClientBillingDetail({
  view, actionLoading, onCopyLink, onOpenLink, onAction,
}: {
  view: ClientBillingView;
  actionLoading: boolean;
  onCopyLink: () => void;
  onOpenLink: () => void;
  onAction: (action: "cancel" | "pause" | "resume") => void;
}) {
  const sub = view.subscription;
  const stripeCustomerId = sub?.stripe_customer_id ?? null;

  // Payment method data fetched here — closest stateful ancestor that owns
  // both the data need and the Update callback. Kept at this level per
  // Constitution §Presentation rule: hooks that fetch data for display
  // are permitted in components; service mutation callbacks flow up.
  const { data: pm, isLoading: pmLoading, isError: pmError } = usePaymentMethod(stripeCustomerId);
  const [portalLoading, setPortalLoading] = useState(false);

  async function handleUpdatePaymentMethod() {
    if (!stripeCustomerId) {
      toast.error("No Stripe customer ID on record — cannot open payment portal.");
      return;
    }
    setPortalLoading(true);
    // Mutation delegated to service — component only triggers and handles response
    const result = await createCustomerPortalSession(stripeCustomerId, window.location.href);
    setPortalLoading(false);
    if (result?.url) {
      window.location.href = result.url;
    } else {
      toast.error(
        "Payment portal requires the 'create-customer-portal-session' Edge Function. " +
        "Deploy it to Supabase to enable self-serve payment method updates. " +
        "In the meantime, update the card directly at dashboard.stripe.com.",
        { duration: 10000 }
      );
    }
  }

  return (
    <div className="space-y-5">

      {/* ── PAYMENT METHOD ── */}
      <PaymentMethodDisplay
        stripeCustomerId={stripeCustomerId}
        pm={pm}
        isLoading={pmLoading}
        isError={pmError}
        portalLoading={portalLoading}
        onUpdate={handleUpdatePaymentMethod}
      />

      {/* ── SUBSCRIPTION ── */}
      <section>
        <div className="font-mono text-[9px] tracking-[0.16em] uppercase mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>Subscription</div>
        <SubscriptionBlock sub={sub} onAction={onAction} actionLoading={actionLoading} />
      </section>

      {/* ── SETUP FEE ── */}
      <section>
        <div className="font-mono text-[9px] tracking-[0.16em] uppercase mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>Setup Fee</div>
        <div
          className="p-3 flex items-center justify-between gap-3"
          style={{
            backgroundColor: "hsl(var(--surface-raised))",
            border: view.setup_fee_paid ? `1px solid ${GREEN}33` : `1px solid ${RUST}33`,
          }}
        >
          <div>
            <div className="font-body text-[13px] font-semibold" style={{ color: view.setup_fee_paid ? GREEN : RUST }}>
              {view.setup_fee_paid ? "✓ Paid" : "Pending"}
            </div>
            <div className="font-mono text-[10px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
              {TIER_LABELS[view.pricing_tier]} — {formatCents(setupFeeCents(view.pricing_tier))}
            </div>
          </div>
          {!view.setup_fee_paid && (
            <div className="flex gap-2">
              <ActionBtn label="Copy Link" color={NAVY} onClick={onCopyLink} />
              <ActionBtn label="Open Link" color={RUST} onClick={onOpenLink} />
            </div>
          )}
        </div>
      </section>

      {/* ── INVOICE HISTORY ── */}
      <InvoiceHistorySection
        events={view.billing_events}
        totalCollected={view.total_collected_cents}
      />
    </div>
  );
}

/**
 * PaymentMethodDisplay — pure display component.
 * Receives all data and callbacks as props.
 * Calls no services, computes no domain state.
 */
function PaymentMethodDisplay({
  stripeCustomerId, pm, isLoading, isError, portalLoading, onUpdate,
}: {
  stripeCustomerId: string | null;
  pm: PaymentMethodSummary | null;
  isLoading: boolean;
  isError: boolean;
  portalLoading: boolean;
  onUpdate: () => void;
}) {
  return (
    <section>
      <div className="font-mono text-[9px] tracking-[0.16em] uppercase mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>Payment Method</div>
      <div
        className="p-3 flex items-center justify-between gap-3"
        style={{ backgroundColor: "hsl(var(--surface-raised))", border: "1px solid hsl(var(--surface-border))" }}
      >
        <div>
          {!stripeCustomerId ? (
            <div className="font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: "hsl(var(--muted-foreground))" }}>No Stripe customer on record</div>
          ) : isLoading ? (
            <div className="font-mono text-[10px] uppercase tracking-[0.1em] animate-pulse" style={{ color: "hsl(var(--muted-foreground))" }}>Loading card…</div>
          ) : isError || !pm ? (
            <div className="space-y-0.5">
              <div className="font-body text-[13px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>Card on file</div>
              <div className="font-mono text-[9px] tracking-[0.08em]" style={{ color: "hsl(var(--muted-foreground))" }}>
                Deploy <span style={{ color: RUST }}>get-payment-method</span> Edge Function to display card details
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              <div className="font-body text-[13px] font-semibold capitalize" style={{ color: "hsl(var(--foreground))" }}>
                {pm.brand} •••• {pm.last4}
              </div>
              <div className="font-mono text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                Expires {pm.exp_month.toString().padStart(2, "0")}/{pm.exp_year}
                {pm.cardholder_name ? ` · ${pm.cardholder_name}` : ""}
              </div>
            </div>
          )}
        </div>
        <ActionBtn
          label={portalLoading ? "Opening…" : "Update"}
          color={NAVY}
          disabled={portalLoading || !stripeCustomerId}
          onClick={onUpdate}
        />
      </div>
    </section>
  );
}

function SubscriptionBlock({
  sub, onAction, actionLoading,
}: {
  sub: Subscription | null;
  onAction: (action: "cancel" | "pause" | "resume") => void;
  actionLoading: boolean;
}) {
  if (!sub) {
    return (
      <div className="p-3 font-mono text-[10px] tracking-[0.12em] uppercase" style={{ border: "1px dashed hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
        No subscription on record
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="p-3 space-y-2" style={{ backgroundColor: "hsl(var(--surface-raised))", border: "1px solid hsl(var(--surface-border))" }}>
        <DetailRow label="Status">
          <span className="font-mono text-[10px] tracking-[0.1em] uppercase px-2 py-1"
            style={{ border: `1px solid ${subStatusColor(sub.status)}`, color: subStatusColor(sub.status) }}>
            {fmt(sub.status)}
          </span>
        </DetailRow>
        <DetailRow label="Rate" value={formatCentsDecimal(sub.effective_rate_cents ?? sub.monthly_rate_cents ?? 0) + "/mo"} />
        <DetailRow label="Started" value={formatDate(sub.started_at)} />
        {sub.canceled_at && <DetailRow label="Canceled" value={formatDate(sub.canceled_at)} />}
        {sub.stripe_subscription_id && (
          <DetailRow label="Stripe ID">
            <a
              href={`https://dashboard.stripe.com/subscriptions/${sub.stripe_subscription_id}`}
              target="_blank" rel="noreferrer"
              className="font-mono text-[10px]"
              style={{ color: "hsl(var(--foreground))", textDecoration: "underline", textDecorationColor: "hsl(var(--rust) / 0.5)" }}
            >
              {sub.stripe_subscription_id}
            </a>
          </DetailRow>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {sub.status === "active" && (
          <>
            <ActionBtn label="Pause Subscription"   color={STEEL} disabled={actionLoading} onClick={() => onAction("pause")} />
            <ActionBtn label="Cancel at Period End" color={RUST}  disabled={actionLoading} onClick={() => onAction("cancel")} />
          </>
        )}
        {sub.status === "off_season" && (
          <ActionBtn label="Resume Subscription" color={GREEN} disabled={actionLoading} onClick={() => onAction("resume")} />
        )}
        {sub.stripe_subscription_id && (
          <ActionBtn
            label="Open in Stripe" color={NAVY}
            onClick={() => window.open(`https://dashboard.stripe.com/subscriptions/${sub.stripe_subscription_id}`, "_blank")}
          />
        )}
      </div>
      <p className="font-mono text-[9px] tracking-[0.08em]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.7 }}>
        Pause/cancel requires the manage-subscription Edge Function deployed to Supabase.
      </p>
    </div>
  );
}

function InvoiceHistorySection({
  events, totalCollected,
}: {
  events: BillingEvent[];
  totalCollected: number;
}) {
  return (
    <section>
      <div className="font-mono text-[9px] tracking-[0.16em] uppercase mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>
        Invoice History ({events.length})
      </div>
      {events.length === 0 ? (
        <div className="p-3 font-mono text-[10px] tracking-[0.12em] uppercase"
          style={{ border: "1px dashed hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
          No payment events recorded
        </div>
      ) : (
        <div className="space-y-1">
          {events.map((e) => <InvoiceRow key={e.id} event={e} />)}
        </div>
      )}
      {events.length > 0 && (
        <div className="mt-2 px-3 py-2 flex items-center justify-between"
          style={{ backgroundColor: "hsl(var(--surface-raised))", border: "1px solid hsl(var(--surface-border))" }}>
          <span className="font-mono text-[9px] tracking-[0.12em] uppercase" style={{ color: "hsl(var(--muted-foreground))" }}>Total Collected</span>
          <span className="font-display text-[18px]" style={{ color: "hsl(var(--foreground))" }}>{formatCents(totalCollected)}</span>
        </div>
      )}
    </section>
  );
}

function InvoiceRow({ event }: { event: BillingEvent }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2"
      style={{ backgroundColor: "hsl(var(--surface-raised))", border: "1px solid hsl(var(--surface-border))" }}>
      <span className="font-mono text-[9px] tracking-[0.1em] uppercase px-1.5 py-0.5 flex-shrink-0"
        style={{ color: eventTypeColor(event.event_type), border: `1px solid ${eventTypeColor(event.event_type)}44` }}>
        {fmt(event.event_type)}
      </span>
      <span className="font-display text-[16px] flex-shrink-0" style={{ color: "hsl(var(--foreground))" }}>
        {formatCentsDecimal(event.amount_cents)}
      </span>
      <span className="flex-1 font-body text-[11px] truncate" style={{ color: "hsl(var(--muted-foreground))" }}>
        {event.description ?? ""}
      </span>
      <span className="font-mono text-[9px] flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.7 }}>
        {formatDate(event.occurred_at)}
      </span>
      {event.stripe_invoice_url ? (
        <a
          href={event.stripe_invoice_url}
          target="_blank" rel="noreferrer"
          className="font-mono text-[9px] tracking-[0.1em] uppercase px-2 py-1 flex-shrink-0 transition-opacity hover:opacity-70"
          style={{ border: `1px solid ${NAVY}`, color: NAVY }}
          onClick={(e) => e.stopPropagation()}
        >
          Invoice ↗
        </a>
      ) : (
        <span className="font-mono text-[9px] uppercase px-2 py-1 flex-shrink-0"
          style={{ border: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>
          No invoice
        </span>
      )}
    </div>
  );
}

function DetailRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="font-mono text-[10px] tracking-[0.12em] uppercase w-20 flex-shrink-0 pt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{label}</span>
      {children ?? <span className="font-body text-[13px]" style={{ color: "hsl(var(--foreground))" }}>{value}</span>}
    </div>
  );
}

function ActionBtn({ label, color, disabled, onClick }: {
  label: string; color: string; disabled?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      className="font-mono text-[10px] tracking-[0.12em] uppercase px-3 py-2 transition-opacity disabled:opacity-40"
      style={{ border: `1px solid ${color}`, color, background: "none", cursor: disabled ? "not-allowed" : "pointer" }}
    >
      {label}
    </button>
  );
}
