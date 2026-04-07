import { useMemo } from "react";
import type { Prospect, Client } from "@/types/pipeline";
import { FOUNDING_SPOTS } from "@/types/pipeline";
import { isOverdue } from "@/lib/utils";

interface MetricsBarProps {
  prospects: Prospect[];
  clients: Client[];
}

export function MetricsBar({ prospects, clients }: MetricsBarProps) {
  const metrics = useMemo(() => {
    const overdue = prospects.filter(
      p => p.stage !== "closed_won" && p.stage !== "closed_lost" && isOverdue(p.next_action_date)
    ).length;
    const active = prospects.filter(p => p.stage !== "closed_won" && p.stage !== "closed_lost").length;
    const designPartners = prospects.filter(p => p.stage === "design_partner" || p.stage === "closed_won").length;
    const activeClients = clients.filter(c => c.status === "active" || c.status === "onboarding").length;
    // MRR: founding @ $300, standard @ $400; paused/churned = $0
    const mrr = clients.reduce((sum, c) => {
      if (c.status === "churned" || c.status === "paused") return sum;
      return sum + (c.pricing_tier === "founding" ? 300 : 400);
    }, 0);
    return { overdue, active, designPartners, activeClients, mrr };
  }, [prospects, clients]);

  const spotsLeft = Math.max(0, FOUNDING_SPOTS - metrics.designPartners);

  return (
    <div style={{ borderBottom: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--surface))" }}>
      {metrics.overdue > 0 && (
        <div style={{ backgroundColor: "hsl(var(--rust))", padding: "6px 24px" }}>
          <span className="font-mono text-[10px] tracking-[0.16em] uppercase" style={{ color: "hsl(var(--off-white))" }}>
            ⚠ {metrics.overdue} prospect{metrics.overdue > 1 ? "s" : ""} with overdue next action
          </span>
        </div>
      )}
      <div className="px-4 md:px-6 py-3 flex items-center gap-4 md:gap-8 overflow-x-auto flex-wrap md:flex-nowrap">
        {/* Founding spots */}
        <div className="flex-shrink-0">
          <div className="font-mono text-[9px] tracking-[0.16em] uppercase mb-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>Founding spots</div>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: FOUNDING_SPOTS }).map((_, i) => (
              <span key={i} className="inline-block w-3 h-3 border"
                style={i < metrics.designPartners
                  ? { backgroundColor: "hsl(var(--rust))", borderColor: "hsl(var(--rust))" }
                  : { borderColor: "hsl(var(--border))" }
                } />
            ))}
            <span className="font-mono text-[10px] ml-1" style={{ color: "hsl(var(--foreground))" }}>{spotsLeft} left</span>
          </div>
        </div>
        <div className="w-px h-8 flex-shrink-0" style={{ backgroundColor: "hsl(var(--border))" }} />
        <Stat label="Active prospects" value={metrics.active} />
        <div className="w-px h-8 flex-shrink-0" style={{ backgroundColor: "hsl(var(--border))" }} />
        <Stat label="Active clients" value={metrics.activeClients} />
        <div className="w-px h-8 flex-shrink-0" style={{ backgroundColor: "hsl(var(--border))" }} />
        <Stat label="MRR" value={`$${metrics.mrr.toLocaleString()}`} />
        <div className="w-px h-8 flex-shrink-0" style={{ backgroundColor: "hsl(var(--border))" }} />
        <Stat label="Overdue actions" value={metrics.overdue} highlight={metrics.overdue > 0} />
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex-shrink-0">
      <div className="font-mono text-[9px] tracking-[0.16em] uppercase mb-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{label}</div>
      <div className="font-display text-2xl leading-none" style={{ color: highlight ? "hsl(var(--rust))" : "hsl(var(--foreground))" }}>{value}</div>
    </div>
  );
}
