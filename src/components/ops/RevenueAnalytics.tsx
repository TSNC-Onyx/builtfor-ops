import { useState } from "react";
import { DrillDownPanel } from "@/components/ops/DrillDownPanel";
import { useSubscriptions } from "@/hooks/useBilling";
import { useBillingEvents } from "@/hooks/useBilling";
import { useClients } from "@/hooks/useClients";

const RUST  = "hsl(20,63%,47%)";
const NAVY  = "hsl(213,58%,27%)";
const STEEL = "hsl(216,21%,62%)";
const GREEN = "hsl(145,50%,40%)";

// Target for 24-month goal
const TARGET_CLIENTS   = 150;
const FOUNDING_SLOTS   = 5;
const FOUNDING_RATE    = 300;
const STANDARD_RATE    = 400;

function fmt$(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

// ── Deferred placeholder card ─────────────────────────────────────────────
function DeferredCard({ title, reason }: { title: string; reason: string }) {
  return (
    <div
      className="flex flex-col justify-between"
      style={{
        backgroundColor: "hsl(var(--surface-raised))",
        border: "1px dashed hsl(var(--surface-border))",
        padding: "14px 16px 16px",
        minHeight: 120,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className="font-mono text-[9px] tracking-[0.16em] uppercase"
          style={{ color: "hsl(var(--muted-foreground))" }}
        >
          {title}
        </span>
        <span
          className="font-mono text-[8px] tracking-[0.12em] uppercase px-2 py-0.5"
          style={{ color: STEEL, border: `1px solid ${STEEL}40` }}
        >
          Deferred
        </span>
      </div>
      <p
        className="font-mono text-[9px] tracking-[0.08em] uppercase"
        style={{ color: "hsl(var(--muted-foreground))", opacity: 0.45 }}
      >
        {reason}
      </p>
    </div>
  );
}

// ── Main analytics card ───────────────────────────────────────────────────
export function RevenueAnalytics() {
  const { data: subscriptions = [], isLoading: subLoading } = useSubscriptions();
  const { data: billingEvents = [], isLoading: evLoading } = useBillingEvents();
  const { data: clients = [], isLoading: cLoading } = useClients();
  const [open, setOpen] = useState(false);

  const isLoading = subLoading || evLoading || cLoading;

  // ── Derived metrics from real subscription data ──────────────────────────
  const activeSubs = subscriptions.filter(s => s.status === "active" || s.status === "trialing");

  // MRR from subscriptions table — uses effective_rate_cents (off-season aware)
  const mrr = activeSubs.reduce((sum, s) => sum + (s.effective_rate_cents ?? s.monthly_rate_cents ?? 0), 0);

  // Setup fees collected from billing_events
  const setupFeesCollected = billingEvents
    .filter(e => e.event_type === "setup_fee")
    .reduce((sum, e) => sum + e.amount_cents, 0);

  // Founding cohort
  const foundingActive = activeSubs.filter(s => s.pricing_tier === "founding").length;
  const foundingRemaining = Math.max(0, FOUNDING_SLOTS - foundingActive);

  // Projected MRR at target — assumes remaining founding slots fill + rest standard
  const projectedMrr =
    (foundingActive * FOUNDING_RATE +
      foundingRemaining * FOUNDING_RATE +
      Math.max(0, TARGET_CLIENTS - FOUNDING_SLOTS) * STANDARD_RATE) * 100;

  // Days since first subscription
  const earliestSub = subscriptions
    .map(s => s.started_at)
    .filter(Boolean)
    .sort()[0];
  const daysActive = earliestSub ? daysSince(earliestSub) : 0;

  // Per-client subscription detail for drill-down
  const subDetail = subscriptions.map(s => {
    const client = clients.find(c => c.id === s.client_id);
    const events = billingEvents.filter(e => e.client_id === s.client_id);
    const totalBilled = events.reduce((sum, e) => sum + e.amount_cents, 0);
    return { s, client, events, totalBilled };
  });

  return (
    <>
      {/* ── Compact card ── */}
      <div
        style={{
          backgroundColor: "hsl(var(--surface-raised))",
          border: "1px solid hsl(var(--surface-border))",
          padding: "14px 16px 16px",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <span
            className="font-mono text-[9px] tracking-[0.16em] uppercase"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            Revenue & Growth
          </span>
          <button
            onClick={() => setOpen(true)}
            className="font-mono text-[8px] tracking-[0.12em] uppercase transition-opacity hover:opacity-60"
            style={{ color: RUST }}
          >
            expand ↗
          </button>
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-4 rounded" style={{ backgroundColor: "hsl(var(--surface-border))", width: `${60 + i * 10}%` }} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Stat label="MRR (contracts)" value={fmt$(mrr)} color={RUST} />
            <Stat label="Setup fees collected" value={fmt$(setupFeesCollected)} />
            <Stat
              label="Founding cohort"
              value={`${foundingActive} / ${FOUNDING_SLOTS}`}
              color={foundingRemaining === 0 ? RUST : undefined}
              sub={`${foundingRemaining} slot${foundingRemaining !== 1 ? "s" : ""} remaining`}
            />
            <Stat
              label="Days since first client"
              value={`${daysActive}d`}
              sub="of ~730 target window"
            />
          </div>
        )}
      </div>

      {/* ── Drill-down ── */}
      {open && (
        <DrillDownPanel title="Revenue & Growth" onClose={() => setOpen(false)}>
          <div className="space-y-5">

            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-3">
              <StatBlock label="MRR (contracts)" value={fmt$(mrr)} color={RUST} />
              <StatBlock label="Setup fees" value={fmt$(setupFeesCollected)} color={NAVY} />
              <StatBlock
                label={`Projected MRR @ ${TARGET_CLIENTS} clients`}
                value={fmt$(projectedMrr)}
                color={STEEL}
              />
              <StatBlock
                label="Founding slots left"
                value={`${foundingRemaining} / ${FOUNDING_SLOTS}`}
                color={foundingRemaining === 0 ? RUST : GREEN}
              />
            </div>

            {/* Runway context */}
            <div
              className="px-3 py-2.5"
              style={{ borderLeft: `3px solid ${NAVY}`, backgroundColor: "hsl(var(--surface-raised))" }}
            >
              <p className="font-mono text-[9px] tracking-[0.1em] uppercase" style={{ color: "hsl(var(--muted-foreground))" }}>
                Target: {TARGET_CLIENTS} active clients · $
                {((FOUNDING_SLOTS * FOUNDING_RATE) + (TARGET_CLIENTS - FOUNDING_SLOTS) * STANDARD_RATE).toLocaleString()}/mo projected MRR
              </p>
              <p className="font-mono text-[9px] tracking-[0.1em] uppercase mt-1" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>
                Day {daysActive} of ~730 · {TARGET_CLIENTS - activeSubs.length} clients to go
              </p>
            </div>

            {/* Per-subscription breakdown */}
            <div>
              <div
                className="font-mono text-[8px] tracking-[0.14em] uppercase mb-2"
                style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}
              >
                Active Subscriptions
              </div>
              <div className="space-y-2">
                {subDetail.map(({ s, client, events, totalBilled }) => (
                  <div
                    key={s.id}
                    className="px-3 py-3"
                    style={{
                      backgroundColor: "hsl(var(--surface-raised))",
                      border: "1px solid hsl(var(--surface-border))",
                      borderLeft: `3px solid ${s.pricing_tier === "founding" ? RUST : NAVY}`,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className="font-mono text-[10px] tracking-[0.1em] uppercase"
                        style={{ color: "hsl(var(--foreground))" }}
                      >
                        {client?.business_name ?? "Unknown"}
                      </span>
                      <span
                        className="font-mono text-[8px] tracking-[0.1em] uppercase px-1.5 py-0.5"
                        style={{ color: s.pricing_tier === "founding" ? RUST : NAVY, border: `1px solid ${s.pricing_tier === "founding" ? RUST : NAVY}40` }}
                      >
                        {s.pricing_tier}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <MiniStat label="Monthly" value={fmt$(s.effective_rate_cents ?? s.monthly_rate_cents ?? 0)} />
                      <MiniStat label="Setup fee" value={fmt$(s.setup_fee_cents ?? 0)} />
                      <MiniStat label="Total billed" value={fmt$(totalBilled)} />
                    </div>
                    {events.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {events.map(e => (
                          <div key={e.id} className="flex items-center justify-between">
                            <span
                              className="font-mono text-[8px] tracking-[0.08em] uppercase"
                              style={{ color: "hsl(var(--muted-foreground))" }}
                            >
                              {e.event_type.replace("_", " ")} · {new Date(e.occurred_at).toLocaleDateString()}
                            </span>
                            <span
                              className="font-mono text-[8px]"
                              style={{ color: GREEN }}
                            >
                              {fmt$(e.amount_cents)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {subDetail.length === 0 && (
                  <p
                    className="font-mono text-[10px] uppercase"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                  >
                    No active subscriptions.
                  </p>
                )}
              </div>
            </div>

            <p
              className="font-mono text-[8px] tracking-[0.08em] uppercase"
              style={{ color: "hsl(var(--muted-foreground))", opacity: 0.35 }}
            >
              MRR sourced from subscriptions.effective_rate_cents (off-season aware).
              Setup fees from billing_events. Projection assumes {FOUNDING_SLOTS} founding @ ${FOUNDING_RATE}/mo,
              remaining {TARGET_CLIENTS - FOUNDING_SLOTS} @ ${STANDARD_RATE}/mo.
            </p>
          </div>
        </DrillDownPanel>
      )}
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────
function Stat({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div>
      <div
        className="font-mono text-[8px] tracking-[0.1em] uppercase mb-0.5"
        style={{ color: "hsl(var(--muted-foreground))" }}
      >
        {label}
      </div>
      <div
        className="font-display text-[22px] leading-none"
        style={{ color: color ?? "hsl(var(--foreground))" }}
      >
        {value}
      </div>
      {sub && (
        <div
          className="font-mono text-[8px] tracking-[0.08em] uppercase mt-0.5"
          style={{ color: "hsl(var(--muted-foreground))", opacity: 0.55 }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function StatBlock({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="p-3"
      style={{
        backgroundColor: "hsl(var(--surface-raised))",
        border: "1px solid hsl(var(--surface-border))",
      }}
    >
      <div
        className="font-mono text-[8px] tracking-[0.1em] uppercase mb-1"
        style={{ color: "hsl(var(--muted-foreground))" }}
      >
        {label}
      </div>
      <div className="font-display text-2xl leading-none" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="font-mono text-[7.5px] tracking-[0.08em] uppercase"
        style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}
      >
        {label}
      </div>
      <div
        className="font-display text-[14px] leading-snug"
        style={{ color: "hsl(var(--foreground))" }}
      >
        {value}
      </div>
    </div>
  );
}

export { DeferredCard };
