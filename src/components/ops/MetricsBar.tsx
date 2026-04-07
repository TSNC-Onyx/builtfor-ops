import { useMemo } from "react";
import type { Prospect } from "@/types/pipeline";
import { FOUNDING_SPOTS } from "@/types/pipeline";
import { isOverdue } from "@/lib/utils";

export function MetricsBar({ prospects }: { prospects: Prospect[] }) {
  const metrics = useMemo(() => {
    const overdue = prospects.filter(p => p.stage !== "closed_won" && p.stage !== "closed_lost" && isOverdue(p.next_action_date)).length;
    const active = prospects.filter(p => p.stage !== "closed_won" && p.stage !== "closed_lost").length;
    const designPartners = prospects.filter(p => p.stage === "design_partner" || p.stage === "closed_won").length;
    const bySource = prospects.reduce<Record<string, number>>((acc, p) => { const s = p.source ?? "unknown"; acc[s] = (acc[s] ?? 0) + 1; return acc; }, {});
    const topSource = Object.entries(bySource).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    return { overdue, active, designPartners, topSource };
  }, [prospects]);

  const spotsLeft = Math.max(0, FOUNDING_SPOTS - metrics.designPartners);

  return (
    <div style={{ borderBottom: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--surface))" }}>
      {metrics.overdue > 0 && (
        <div className="bg-rust px-6 py-2">
          <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-off-white">
            ⚠ {metrics.overdue} prospect{metrics.overdue > 1 ? "s" : ""} with overdue next action
          </span>
        </div>
      )}
      <div className="px-6 py-3 flex items-center gap-8 flex-wrap">
        <div>
          <div className="font-mono text-[9px] tracking-[0.16em] uppercase mb-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>Founding spots</div>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: FOUNDING_SPOTS }).map((_, i) => (
              <span key={i} className={`inline-block w-3 h-3 border ${i < metrics.designPartners ? "bg-rust border-rust" : ""}`}
                style={i < metrics.designPartners ? {} : { borderColor: "hsl(var(--border))" }} />
            ))}
            <span className="font-mono text-[10px] ml-1" style={{ color: "hsl(var(--foreground))" }}>{spotsLeft} left</span>
          </div>
        </div>
        <div className="w-px h-8" style={{ backgroundColor: "hsl(var(--border))" }} />
        <div>
          <div className="font-mono text-[9px] tracking-[0.16em] uppercase mb-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>Active prospects</div>
          <div className="font-display text-2xl leading-none" style={{ color: "hsl(var(--foreground))" }}>{metrics.active}</div>
        </div>
        <div className="w-px h-8" style={{ backgroundColor: "hsl(var(--border))" }} />
        <div>
          <div className="font-mono text-[9px] tracking-[0.16em] uppercase mb-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>Overdue actions</div>
          <div className="font-display text-2xl leading-none" style={{ color: metrics.overdue > 0 ? "hsl(var(--rust))" : "hsl(var(--foreground))" }}>{metrics.overdue}</div>
        </div>
        <div className="w-px h-8" style={{ backgroundColor: "hsl(var(--border))" }} />
        <div>
          <div className="font-mono text-[9px] tracking-[0.16em] uppercase mb-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>Top source</div>
          <div className="font-mono text-[11px] tracking-[0.08em] uppercase" style={{ color: "hsl(var(--foreground))" }}>{metrics.topSource}</div>
        </div>
      </div>
    </div>
  );
}
