import { OpsShell } from "@/components/ops/OpsShell";
import { useClients } from "@/hooks/useProspects";
import { formatDate } from "@/lib/utils";

export default function Clients() {
  const { data: clients = [], isLoading } = useClients();
  const statusColor = (s: string) => ({ onboarding: "hsl(var(--rust))", active: "hsl(var(--navy))", at_risk: "hsl(var(--rust))", churned: "hsl(var(--muted-foreground))", paused: "hsl(var(--muted-foreground))" }[s] ?? "hsl(var(--muted-foreground))");

  return (
    <OpsShell>
      <div className="px-6 py-5" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <h1 className="font-display text-[28px] tracking-[0.02em] leading-none" style={{ color: "hsl(var(--foreground))" }}>Clients</h1>
        <p className="font-body text-[12px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{clients.length} active accounts</p>
      </div>
      <div className="px-6 py-4">
        {isLoading && <div className="font-mono text-[11px] tracking-[0.14em] uppercase animate-pulse" style={{ color: "hsl(var(--muted-foreground))" }}>Loading clients…</div>}
        {!isLoading && clients.length === 0 && (
          <div className="p-12 text-center" style={{ border: "1px dashed hsl(var(--border))" }}>
            <div className="font-mono text-[10px] tracking-[0.14em] uppercase" style={{ color: "hsl(var(--muted-foreground))" }}>No clients yet</div>
            <div className="font-body text-[12px] mt-1" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>Convert a won prospect from the Pipeline view</div>
          </div>
        )}
        <div className="space-y-1">
          {clients.map(c => (
            <div key={c.id} className="flex items-center gap-5 px-5 py-3.5 transition-colors" style={{ backgroundColor: "hsl(var(--surface-raised))", border: "1px solid hsl(var(--surface-border))" }}>
              <div className="flex-1 min-w-0">
                <div className="font-body text-[14px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>{c.business_name}</div>
                <div className="font-body text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{c.owner_name} · {c.email}</div>
              </div>
              <span className="font-mono text-[9px] tracking-[0.12em] uppercase px-2 py-1" style={{ border: `1px solid ${statusColor(c.status)}`, color: statusColor(c.status) }}>{c.status}</span>
              <span className="font-mono text-[9px] tracking-[0.12em] uppercase" style={{ color: "hsl(var(--muted-foreground))" }}>{c.vertical}</span>
              <span className="font-mono text-[9px] tracking-[0.12em] uppercase" style={{ color: "hsl(var(--muted-foreground))" }}>{c.pricing_tier}</span>
              <span className="font-mono text-[9px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>{formatDate(c.created_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </OpsShell>
  );
}
