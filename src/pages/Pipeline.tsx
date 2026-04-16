import { useState, useRef } from "react";
import { OpsShell } from "@/components/ops/OpsShell";
import { MetricsBar } from "@/components/ops/MetricsBar";
import { PipelineColumn } from "@/components/ops/PipelineColumn";
import { ProspectDetail } from "@/components/ops/ProspectDetail";
import { AddProspectModal } from "@/components/ops/AddProspectModal";
import { useProspects, useAllProspects, useUpdateProspectStage } from "@/hooks/useProspects";
import { useClients } from "@/hooks/useClients";
import { useSession } from "@/context/SessionContext";
import { STAGE_ORDER, STAGE_LABELS } from "@/types/pipeline";
import type { Prospect, ProspectStage } from "@/types/pipeline";

const ACTIVE_STAGES: ProspectStage[] = ["lead", "contacted", "demo_scheduled", "proposal_sent", "design_partner"];

export default function Pipeline() {
  const session = useSession();
  // Active pipeline board uses filtered hook (no closed stages on board)
  const { data: activeProspects = [], isLoading, isError } = useProspects();
  // Full set needed for MetricsBar (founding spots, overdue counts) and "All stages" view
  const { data: allProspects = [] } = useAllProspects();
  const { data: clients = [] } = useClients();
  const updateStage = useUpdateProspectStage();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [viewMode, setViewMode] = useState<"active" | "all">("active");
  const [mobileStage, setMobileStage] = useState<ProspectStage>("lead");
  const dragRef = useRef<Prospect | null>(null);

  // Use the appropriate data set based on view mode
  const prospects = viewMode === "all" ? allProspects : activeProspects;
  const visibleStages = viewMode === "active" ? ACTIVE_STAGES : STAGE_ORDER;

  const byStage = STAGE_ORDER.reduce<Record<ProspectStage, Prospect[]>>((acc, s) => {
    acc[s] = prospects.filter(p => p.stage === s);
    return acc;
  }, {} as Record<ProspectStage, Prospect[]>);

  function handleDrop(targetStage: ProspectStage) {
    if (!dragRef.current || dragRef.current.stage === targetStage) return;
    updateStage.mutate({ id: dragRef.current.id, stage: targetStage });
    dragRef.current = null;
  }

  // In TanStack Query v5, a disabled query (enabled: false) has isLoading = true
  // when no cached data exists. Guard with !!session so the loading state only
  // shows when the query is actually running, not while waiting for auth.
  const queryLoading = isLoading && !!session;

  if (queryLoading) return (
    <OpsShell>
      <div className="flex items-center justify-center h-64">
        <span className="font-mono text-[11px] tracking-[0.14em] uppercase animate-pulse" style={{ color: "hsl(var(--muted-foreground))" }}>Loading pipeline…</span>
      </div>
    </OpsShell>
  );

  if (isError) return (
    <OpsShell>
      <div className="flex items-center justify-center h-64">
        <span className="font-mono text-[11px] tracking-[0.14em] uppercase" style={{ color: "hsl(var(--rust))" }}>Failed to load pipeline — check connection and refresh.</span>
      </div>
    </OpsShell>
  );

  return (
    <OpsShell>
      {/* MetricsBar always receives full prospect set for accurate counts */}
      <MetricsBar prospects={allProspects} clients={clients} />

      <div className="px-4 md:px-6 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <div>
          <h1 className="font-display text-[24px] md:text-[28px] tracking-[0.02em] leading-none" style={{ color: "hsl(var(--foreground))" }}>Pipeline</h1>
          <p className="font-body text-[12px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{allProspects.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex" style={{ border: "1px solid hsl(var(--border))" }}>
            {(["active", "all"] as const).map(v => (
              <button key={v} onClick={() => setViewMode(v)}
                className="font-mono text-[10px] tracking-[0.12em] uppercase px-3 py-1.5 transition-colors"
                style={{ backgroundColor: viewMode === v ? "hsl(var(--nav-active-bg))" : "transparent", color: viewMode === v ? "hsl(var(--nav-active-text))" : "hsl(var(--muted-foreground))" }}
              >{v === "active" ? "Active" : "All stages"}</button>
            ))}
          </div>
          <button onClick={() => setShowAdd(true)}
            className="font-mono text-[10px] tracking-[0.12em] uppercase px-3 py-1.5 hover:opacity-90"
            style={{ backgroundColor: "hsl(var(--rust))", color: "hsl(var(--off-white))" }}
          >+ Add</button>
        </div>
      </div>

      {/* MOBILE VIEW */}
      <div className="md:hidden flex flex-col" style={{ height: "calc(100vh - 190px)" }}>
        <div className="flex overflow-x-auto flex-shrink-0" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
          {visibleStages.map(s => (
            <button key={s} onClick={() => setMobileStage(s)}
              className="flex-shrink-0 px-3 py-2 font-mono text-[9px] tracking-[0.1em] uppercase transition-colors"
              style={{ borderBottom: mobileStage === s ? `2px solid hsl(var(--rust))` : "2px solid transparent", color: mobileStage === s ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))", backgroundColor: "transparent" }}
            >{STAGE_LABELS[s].replace("Closed — ", "")} ({byStage[s].length})</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <PipelineColumn stage={mobileStage} prospects={byStage[mobileStage]} onCardClick={p => setSelectedId(p.id)} onDrop={handleDrop} onDragStart={p => { dragRef.current = p; }} showHeader={false} />
        </div>
        {selectedId && (
          <div className="fixed inset-0 z-40 overflow-y-auto" style={{ backgroundColor: "hsl(var(--surface))", paddingTop: "56px" }}>
            <ProspectDetail prospectId={selectedId} onClose={() => setSelectedId(null)} />
          </div>
        )}
      </div>

      {/* DESKTOP VIEW */}
      <div className="hidden md:flex" style={{ height: "calc(100vh - 185px)", overflow: "hidden" }}>
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-2 p-3 h-full">
            {visibleStages.map(stage => (
              <PipelineColumn key={stage} stage={stage} prospects={byStage[stage]} onCardClick={p => setSelectedId(p.id)} onDrop={handleDrop} onDragStart={p => { dragRef.current = p; }} />
            ))}
          </div>
        </div>
        {selectedId && (
          <div className="w-80 flex-shrink-0 overflow-y-auto" style={{ borderLeft: "1px solid hsl(var(--border))" }}>
            <ProspectDetail prospectId={selectedId} onClose={() => setSelectedId(null)} />
          </div>
        )}
      </div>

      {showAdd && <AddProspectModal onClose={() => setShowAdd(false)} />}
    </OpsShell>
  );
}
