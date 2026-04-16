import { useState, useMemo } from "react";
import { OpsShell } from "@/components/ops/OpsShell";
import { MetricsBar } from "@/components/ops/MetricsBar";
import { DrillDownPanel } from "@/components/ops/DrillDownPanel";
import { SvgFunnelChart } from "@/components/ops/SvgFunnelChart";
import { SvgDonutChart } from "@/components/ops/SvgDonutChart";
import { useProspects } from "@/hooks/useProspects";
import { useClients } from "@/hooks/useClients";
import { STAGE_LABELS, STAGE_ORDER } from "@/types/pipeline";
import { isOverdue, formatDate, daysSince } from "@/lib/utils";
import type { ProspectStage } from "@/types/pipeline";

const RUST = "hsl(20,63%,47%)";
const NAVY = "hsl(213,58%,27%)";
const STEEL = "hsl(216,21%,62%)";
const GREEN = "hsl(145,50%,40%)";

type Drill =
  | "overdue"
  | "pipeline_breakdown"
  | "funnel"
  | "source"
  | "vertical"
  | "client_status"
  | "conversion"
  | null;

export default function Dashboard() {
  const { data: prospects = [], isLoading: pLoading } = useProspects();
  const { data: clients = [], isLoading: cLoading } = useClients();
  const [drill, setDrill] = useState<Drill>(null);

  const metrics = useMemo(() => {
    const active = prospects.filter(p => p.stage !== "closed_won" && p.stage !== "closed_lost");
    const won = prospects.filter(p => p.stage === "closed_won");
    const lost = prospects.filter(p => p.stage === "closed_lost");
    const overdue = prospects.filter(
      p => p.stage !== "closed_won" && p.stage !== "closed_lost" && isOverdue(p.next_action_date)
    );
    const designPartners = prospects.filter(p => p.stage === "design_partner" || p.stage === "closed_won");
    const activeClients = clients.filter(c => c.status === "active" || c.status === "onboarding");
    const mrr = clients.reduce((sum, c) => {
      if (c.status === "churned" || c.status === "paused") return sum;
      return sum + (c.pricing_tier === "founding" ? 300 : 400);
    }, 0);
    const totalClosed = won.length + lost.length;
    const convRate = totalClosed > 0 ? Math.round((won.length / totalClosed) * 100) : null;
    const avgAge = active.length > 0
      ? Math.round(active.reduce((s, p) => s + daysSince(p.created_at), 0) / active.length)
      : 0;

    const bySource: Record<string, number> = {};
    prospects.forEach(p => {
      const s = p.source ?? "unknown";
      bySource[s] = (bySource[s] ?? 0) + 1;
    });

    const byVertical: Record<string, number> = {};
    clients.forEach(c => {
      byVertical[c.vertical] = (byVertical[c.vertical] ?? 0) + 1;
    });

    const byStatus: Record<string, number> = {};
    clients.forEach(c => {
      byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    });

    const stageCounts = STAGE_ORDER.reduce<Record<string, number>>((acc, s) => {
      acc[s] = prospects.filter(p => p.stage === s).length;
      return acc;
    }, {});

    return {
      active, won, lost, overdue, designPartners,
      activeClients, mrr, convRate, avgAge,
      bySource, byVertical, byStatus, stageCounts,
      totalProspects: prospects.length,
    };
  }, [prospects, clients]);

  const isLoading = pLoading || cLoading;

  const sourceColors: Record<string, string> = {
    outreach: NAVY, referral: RUST, trade_show: GREEN, inbound: STEEL, unknown: "hsl(var(--border))",
  };
  const sourceSlices = Object.entries(metrics.bySource).map(([k, v]) => ({
    label: k, value: v, color: sourceColors[k] ?? STEEL,
  }));

  const statusColors: Record<string, string> = {
    onboarding: RUST, active: NAVY, at_risk: "hsl(38,90%,50%)", churned: STEEL, paused: "hsl(var(--border))",
  };
  const statusSlices = Object.entries(metrics.byStatus).map(([k, v]) => ({
    label: k, value: v, color: statusColors[k] ?? STEEL,
  }));

  return (
    <OpsShell>
      <MetricsBar prospects={prospects} clients={clients} />

      {isLoading && (
        <div className="px-5 py-4">
          <span className="font-mono text-[11px] tracking-[0.14em] uppercase animate-pulse" style={{ color: "hsl(var(--muted-foreground))" }}>Loading…</span>
        </div>
      )}

      <div className="px-4 md:px-6 py-5">
        <h1 className="font-display text-[28px] md:text-[32px] tracking-[0.02em] leading-none mb-5"
          style={{ color: "hsl(var(--foreground))" }}>Dashboard</h1>

        {/* --- KPI CARDS ROW 1 --- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          <KpiCard
            label="Total Prospects"
            value={metrics.totalProspects}
            sub={`${metrics.active.length} active`}
            onClick={() => setDrill("pipeline_breakdown")}
          />
          <KpiCard
            label="Active Clients"
            value={metrics.activeClients.length}
            sub={`${clients.length} total`}
            onClick={() => setDrill("client_status")}
          />
          <KpiCard
            label="Monthly Recurring"
            value={`$${metrics.mrr.toLocaleString()}`}
            sub={`${metrics.activeClients.length} paying`}
            color={RUST}
          />
          <KpiCard
            label="Founding Spots Used"
            value={`${metrics.designPartners.length}/5`}
            sub={`${Math.max(0, 5 - metrics.designPartners.length)} remaining`}
            color={metrics.designPartners.length >= 5 ? RUST : undefined}
          />
        </div>

        {/* --- KPI CARDS ROW 2 --- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
          <KpiCard
            label="Overdue Actions"
            value={metrics.overdue.length}
            sub="require follow-up"
            color={metrics.overdue.length > 0 ? RUST : undefined}
            onClick={metrics.overdue.length > 0 ? () => setDrill("overdue") : undefined}
            alert={metrics.overdue.length > 0}
          />
          <KpiCard
            label="Conversion Rate"
            value={metrics.convRate !== null ? `${metrics.convRate}%` : "—"}
            sub={`${metrics.won.length} won / ${metrics.lost.length} lost`}
            onClick={() => setDrill("conversion")}
          />
          <KpiCard
            label="Avg Pipeline Age"
            value={`${metrics.avgAge}d`}
            sub="active prospects"
          />
          <KpiCard
            label="Top Source"
            value={Object.entries(metrics.bySource).sort((a, b) => b[1] - a[1])[0]?.[0]?.replace("_", " ") ?? "—"}
            sub="by volume"
            onClick={() => setDrill("source")}
            capitalize
          />
        </div>

        {/* --- CHARTS GRID --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Pipeline funnel */}
          <ChartCard title="Pipeline Funnel" onExpand={() => setDrill("funnel")}>
            <SvgFunnelChart
              steps={STAGE_ORDER.filter(s => s !== "closed_lost").map(s => ({
                label: STAGE_LABELS[s],
                count: metrics.stageCounts[s] ?? 0,
                color: s === "closed_won" ? NAVY : RUST,
              }))}
            />
          </ChartCard>

          {/* Source breakdown — donut fills the card on desktop */}
          <ChartCard title="Prospects by Source" onExpand={() => setDrill("source")}>
            <div className="flex items-center gap-5 h-full">
              {/* Constrain donut to a square that fills available card height on desktop */}
              <div className="hidden md:flex items-center justify-center" style={{ width: 140, height: 140, flexShrink: 0 }}>
                <SvgDonutChart slices={sourceSlices} size={140} thickness={28} />
              </div>
              {/* Mobile keeps original compact size */}
              <div className="md:hidden">
                <SvgDonutChart slices={sourceSlices} size={96} thickness={20} />
              </div>
              <Legend slices={sourceSlices} />
            </div>
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
          {/* Client status donut — same treatment */}
          <ChartCard title="Client Health" onExpand={() => setDrill("client_status")}>
            <div className="flex items-center gap-5 h-full">
              <div className="hidden md:flex items-center justify-center" style={{ width: 140, height: 140, flexShrink: 0 }}>
                <SvgDonutChart slices={statusSlices} size={140} thickness={28} />
              </div>
              <div className="md:hidden">
                <SvgDonutChart slices={statusSlices} size={96} thickness={20} />
              </div>
              <Legend slices={statusSlices} />
            </div>
          </ChartCard>

          {/* Stage breakdown bar */}
          <ChartCard title="Stage Counts" onExpand={() => setDrill("pipeline_breakdown")}>
            <SvgFunnelChart
              steps={STAGE_ORDER.map(s => ({
                label: STAGE_LABELS[s].replace("Closed — ", ""),
                count: metrics.stageCounts[s] ?? 0,
                color: s === "closed_lost" ? STEEL : s === "closed_won" ? NAVY : RUST,
              }))}
            />
          </ChartCard>
        </div>

        {/* --- OVERDUE ALERT LIST --- */}
        {metrics.overdue.length > 0 && (
          <div className="mt-6">
            <div className="font-mono text-[10px] tracking-[0.16em] uppercase mb-2" style={{ color: "hsl(var(--rust))" }}>
              Overdue actions ({metrics.overdue.length})
            </div>
            <div className="space-y-1">
              {metrics.overdue.slice(0, 5).map(p => (
                <div key={p.id} className="flex items-center gap-4 px-4 py-2.5"
                  style={{ backgroundColor: "hsl(var(--rust) / 0.07)", border: "1px solid hsl(var(--rust) / 0.20)" }}>
                  <div className="flex-1 min-w-0">
                    <span className="font-body text-[13px] font-semibold truncate block" style={{ color: "hsl(var(--foreground))" }}>{p.business_name}</span>
                    <span className="font-body text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{p.next_action}</span>
                  </div>
                  <span className="font-mono text-[10px] flex-shrink-0" style={{ color: "hsl(var(--rust))" }}>{formatDate(p.next_action_date)}</span>
                  <span className="font-mono text-[9px] tracking-[0.1em] uppercase flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>{STAGE_LABELS[p.stage as ProspectStage]}</span>
                </div>
              ))}
              {metrics.overdue.length > 5 && (
                <button onClick={() => setDrill("overdue")} className="font-mono text-[10px] tracking-[0.12em] uppercase px-2 py-1" style={{ color: "hsl(var(--rust))" }}>
                  + {metrics.overdue.length - 5} more →
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* --- DRILL-DOWN PANELS --- */}
      {drill === "overdue" && (
        <DrillDownPanel title={`Overdue Actions (${metrics.overdue.length})`} onClose={() => setDrill(null)}>
          <div className="space-y-2">
            {metrics.overdue.map(p => (
              <div key={p.id} className="p-3" style={{ border: "1px solid hsl(var(--rust) / 0.3)" }}>
                <div className="font-body text-[13px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>{p.business_name}</div>
                <div className="font-body text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>{p.full_name}</div>
                <div className="font-body text-[12px] mt-1" style={{ color: "hsl(var(--rust))" }}>→ {p.next_action} · {formatDate(p.next_action_date)}</div>
                <div className="font-mono text-[9px] tracking-[0.1em] uppercase mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>{STAGE_LABELS[p.stage as ProspectStage]}</div>
              </div>
            ))}
          </div>
        </DrillDownPanel>
      )}

      {drill === "pipeline_breakdown" && (
        <DrillDownPanel title="Pipeline Breakdown" onClose={() => setDrill(null)}>
          <div className="space-y-2">
            {STAGE_ORDER.map(s => {
              const list = prospects.filter(p => p.stage === s);
              return (
                <div key={s}>
                  <div className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: "hsl(var(--surface-raised))", borderLeft: `3px solid ${s === "closed_won" ? NAVY : s === "closed_lost" ? STEEL : RUST}` }}>
                    <span className="font-mono text-[10px] tracking-[0.12em] uppercase" style={{ color: "hsl(var(--foreground))" }}>{STAGE_LABELS[s]}</span>
                    <span className="font-display text-xl" style={{ color: "hsl(var(--foreground))" }}>{list.length}</span>
                  </div>
                  {list.length > 0 && (
                    <div className="pl-3 space-y-0.5 mt-0.5">
                      {list.slice(0, 3).map(p => (
                        <div key={p.id} className="font-body text-[12px] px-2 py-1" style={{ color: "hsl(var(--muted-foreground))", borderLeft: "1px solid hsl(var(--border))" }}>
                          {p.business_name}
                        </div>
                      ))}
                      {list.length > 3 && <div className="font-mono text-[9px] pl-2" style={{ color: "hsl(var(--muted-foreground))" }}>+{list.length - 3} more</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DrillDownPanel>
      )}

      {drill === "source" && (
        <DrillDownPanel title="Prospects by Source" onClose={() => setDrill(null)}>
          <div className="flex items-center gap-8 mb-6">
            <SvgDonutChart slices={sourceSlices} size={140} thickness={30} />
            <div className="space-y-2">
              {sourceSlices.map(sl => (
                <div key={sl.label} className="flex items-center gap-2">
                  <span className="w-3 h-3 flex-shrink-0" style={{ backgroundColor: sl.color }} />
                  <span className="font-body text-[13px]" style={{ color: "hsl(var(--foreground))" }}>{sl.label.replace("_", " ")}</span>
                  <span className="font-display text-lg ml-2" style={{ color: "hsl(var(--foreground))" }}>{sl.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            {Object.entries(metrics.bySource).sort((a, b) => b[1] - a[1]).map(([src, count]) => (
              <div key={src}>
                <div className="font-mono text-[10px] tracking-[0.12em] uppercase mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>{src.replace("_", " ")} — {count}</div>
                {prospects.filter(p => (p.source ?? "unknown") === src).slice(0, 4).map(p => (
                  <div key={p.id} className="font-body text-[12px] px-2 py-1 ml-2" style={{ borderLeft: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
                    {p.business_name}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </DrillDownPanel>
      )}

      {drill === "client_status" && (
        <DrillDownPanel title="Client Health" onClose={() => setDrill(null)}>
          <div className="flex items-center gap-8 mb-6">
            <SvgDonutChart slices={statusSlices} size={140} thickness={30} />
            <Legend slices={statusSlices} />
          </div>
          <div className="space-y-1">
            {clients.map(c => (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2.5" style={{ backgroundColor: "hsl(var(--surface-raised))", border: "1px solid hsl(var(--surface-border))" }}>
                <div className="flex-1 min-w-0">
                  <div className="font-body text-[13px] font-semibold truncate" style={{ color: "hsl(var(--foreground))" }}>{c.business_name}</div>
                  <div className="font-body text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{c.vertical}</div>
                </div>
                <span className="font-mono text-[9px] tracking-[0.12em] uppercase px-2 py-1 flex-shrink-0" style={{ border: `1px solid ${statusColors[c.status] ?? STEEL}`, color: statusColors[c.status] ?? STEEL }}>{c.status}</span>
              </div>
            ))}
            {clients.length === 0 && <div className="font-mono text-[11px] uppercase" style={{ color: "hsl(var(--muted-foreground))" }}>No clients yet.</div>}
          </div>
        </DrillDownPanel>
      )}

      {drill === "conversion" && (
        <DrillDownPanel title="Conversion Detail" onClose={() => setDrill(null)}>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <StatBlock label="Won" value={metrics.won.length} color={NAVY} />
            <StatBlock label="Lost" value={metrics.lost.length} color={STEEL} />
            <StatBlock label="Rate" value={metrics.convRate !== null ? `${metrics.convRate}%` : "—"} color={RUST} />
          </div>
          {metrics.lost.length > 0 && (
            <>
              <div className="font-mono text-[10px] tracking-[0.12em] uppercase mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>Lost prospects</div>
              <div className="space-y-1">
                {metrics.lost.map(p => (
                  <div key={p.id} className="px-3 py-2" style={{ border: "1px solid hsl(var(--border))" }}>
                    <div className="font-body text-[13px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>{p.business_name}</div>
                    {p.lost_reason && <div className="font-body text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>{p.lost_reason}</div>}
                  </div>
                ))}
              </div>
            </>
          )}
        </DrillDownPanel>
      )}

      {drill === "funnel" && (
        <DrillDownPanel title="Pipeline Funnel" onClose={() => setDrill(null)}>
          <SvgFunnelChart
            steps={STAGE_ORDER.filter(s => s !== "closed_lost").map(s => ({
              label: STAGE_LABELS[s],
              count: metrics.stageCounts[s] ?? 0,
              color: s === "closed_won" ? NAVY : RUST,
            }))}
          />
        </DrillDownPanel>
      )}
    </OpsShell>
  );
}

// --- Sub-components ---

function KpiCard({ label, value, sub, color, onClick, alert, capitalize }: {
  label: string; value: string | number; sub?: string;
  color?: string; onClick?: () => void; alert?: boolean; capitalize?: boolean;
}) {
  const isClickable = !!onClick;
  return (
    <div
      onClick={onClick}
      className={isClickable ? "cursor-pointer transition-opacity hover:opacity-80" : ""}
      style={{
        backgroundColor: "hsl(var(--surface-raised))",
        border: alert ? "1px solid hsl(var(--rust) / 0.4)" : "1px solid hsl(var(--surface-border))",
        padding: "14px 16px",
      }}
    >
      <div className="font-mono text-[9px] tracking-[0.14em] uppercase mb-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>{label}</div>
      <div
        className="font-display text-[26px] md:text-[30px] leading-none mb-1"
        style={{ color: color ?? "hsl(var(--foreground))", textTransform: capitalize ? "capitalize" : undefined }}
      >
        {value}
      </div>
      {sub && <div className="font-mono text-[9px] tracking-[0.1em] uppercase" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.7 }}>{sub}</div>}
      {isClickable && <div className="font-mono text-[9px] mt-1" style={{ color: "hsl(var(--rust))" }}>drill down →</div>}
    </div>
  );
}

function ChartCard({ title, onExpand, children }: { title: string; onExpand?: () => void; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: "hsl(var(--surface-raised))", border: "1px solid hsl(var(--surface-border))", padding: "14px 16px 16px" }}>
      <div className="flex items-center justify-between mb-4">
        <span className="font-mono text-[9px] tracking-[0.16em] uppercase" style={{ color: "hsl(var(--muted-foreground))" }}>{title}</span>
        {onExpand && (
          <button onClick={onExpand} className="font-mono text-[8px] tracking-[0.12em] uppercase transition-opacity hover:opacity-60" style={{ color: "hsl(var(--rust))" }}>expand ↗</button>
        )}
      </div>
      {children}
    </div>
  );
}

function Legend({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  return (
    <div className="flex-1 min-w-0 space-y-2">
      {slices.map(s => (
        <div key={s.label} className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
          <span className="font-mono text-[8.5px] tracking-[0.08em] uppercase truncate" style={{ color: "hsl(var(--muted-foreground))" }}>{s.label.replace(/_/g, " ")}</span>
          <span className="font-display text-sm ml-auto flex-shrink-0 pl-2" style={{ color: "hsl(var(--foreground))" }}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}

function StatBlock({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="p-3 text-center" style={{ backgroundColor: "hsl(var(--surface-raised))", border: "1px solid hsl(var(--surface-border))" }}>
      <div className="font-display text-3xl leading-none" style={{ color }}>{value}</div>
      <div className="font-mono text-[9px] tracking-[0.12em] uppercase mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>{label}</div>
    </div>
  );
}

const statusColors: Record<string, string> = {
  onboarding: RUST, active: NAVY, at_risk: "hsl(38,90%,50%)", churned: STEEL, paused: "hsl(var(--border))",
};
