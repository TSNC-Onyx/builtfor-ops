import { OpsShell } from "@/components/ops/OpsShell";
import { MetricsBar } from "@/components/ops/MetricsBar";
import { useProspects } from "@/hooks/useProspects";
import { STAGE_LABELS, STAGE_ORDER } from "@/types/pipeline";
import { isOverdue, formatDate } from "@/lib/utils";

export default function Dashboard() {
  const { data: prospects = [], isLoading } = useProspects();
  const overdue = prospects.filter(p => p.stage !== "closed_won" && p.stage !== "closed_lost" && isOverdue(p.next_action_date));
  const stageCounts = STAGE_ORDER.reduce<Record<string, number>>((acc, s) => { acc[s] = prospects.filter(p => p.stage === s).length; return acc; }, {});

  return (
    <OpsShell>
      <MetricsBar prospects={prospects} />
      <div className="px-6 py-6 max-w-4xl">
        <h1 className="font-display text-[32px] tracking-[0.02em] leading-none mb-6" style={{ color: "hsl(var(--foreground))" }}>Dashboard</h1>
        {overdue.length > 0 && (
          <div className="mb-6">
            <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-rust mb-3">Overdue actions</div>
            <div className="space-y-1">
              {overdue.map(p => (
                <div key={p.id} className="flex items-center gap-4 px-4 py-2.5" style={{ backgroundColor: "hsl(var(--rust) / 0.07)", border: "1px solid hsl(var(--rust) / 0.20)" }}>
                  <div className="flex-1"><span className="font-body text-[13px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>{p.business_name}</span><span className="font-body text-[12px] ml-2" style={{ color: "hsl(var(--muted-foreground))" }}>{p.next_action}</span></div>
                  <span className="font-mono text-[10px] text-rust">{formatDate(p.next_action_date)}</span>
                  <span className="font-mono text-[9px] tracking-[0.1em] uppercase" style={{ color: "hsl(var(--muted-foreground))" }}>{STAGE_LABELS[p.stage]}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="font-mono text-[10px] tracking-[0.16em] uppercase mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>Pipeline by stage</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
          {STAGE_ORDER.filter(s => s !== "closed_lost").map(s => (
            <div key={s} className="px-4 py-3" style={{ backgroundColor: "hsl(var(--surface-raised))", border: "1px solid hsl(var(--surface-border))" }}>
              <div className="font-mono text-[9px] tracking-[0.12em] uppercase mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>{STAGE_LABELS[s]}</div>
              <div className="font-display text-3xl leading-none" style={{ color: "hsl(var(--foreground))" }}>{stageCounts[s] ?? 0}</div>
            </div>
          ))}
        </div>
        {isLoading && <div className="mt-8 font-mono text-[11px] tracking-[0.14em] uppercase animate-pulse" style={{ color: "hsl(var(--muted-foreground))" }}>Loading…</div>}
      </div>
    </OpsShell>
  );
}
