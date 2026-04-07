import { useState, useRef } from "react";
import { OpsShell } from "@/components/ops/OpsShell";
import { MetricsBar } from "@/components/ops/MetricsBar";
import { PipelineColumn } from "@/components/ops/PipelineColumn";
import { ProspectDetail } from "@/components/ops/ProspectDetail";
import { AddProspectModal } from "@/components/ops/AddProspectModal";
import { useProspects, useUpdateProspectStage } from "@/hooks/useProspects";
import { STAGE_ORDER } from "@/types/pipeline";
import type { Prospect, ProspectStage } from "@/types/pipeline";

export default function Pipeline() {
  const { data: prospects = [], isLoading, isError } = useProspects();
  const updateStage = useUpdateProspectStage();
  // Store selected prospect ID only — derive live data from query cache in ProspectDetail.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [viewMode, setViewMode] = useState<"active" | "all">("active");
  const dragRef = useRef<Prospect | null>(null);

  const activeStages: ProspectStage[] = ["lead", "contacted", "demo_scheduled", "proposal_sent", "design_partner"];
  const visibleStages = viewMode === "active" ? activeStages : STAGE_ORDER;
  const byStage = STAGE_ORDER.reduce<Record<ProspectStage, Prospect[]>>((acc, s) => {
    acc[s] = prospects.filter(p => p.stage === s);
    return acc;
  }, {} as Record<ProspectStage, Prospect[]>);

  function handleDrop(targetStage: ProspectStage) {
    if (!dragRef.current || dragRef.current.stage === targetStage) return;
    updateStage.mutate({ id: dragRef.current.id, stage: targetStage });
    dragRef.current = null;
  }

  if (isLoading) return (
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
      <MetricsBar prospects={prospects} />
      <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <div>
          <h1 className="font-display text-[28px] tracking-[0.02em] leading-none" style={{ color: "hsl(var(--foreground))" }}>Pipeline</h1>
          <p className="font-body text-[12px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{prospects.length} total prospects</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex" style={{ border: "1px solid hsl(var(--border))" }}>
            {(["active", "all"] as const).map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className="font-mono text-[10px] tracking-[0.12em] uppercase px-3 py-1.5 transition-colors"
                style={{
                  backgroundColor: viewMode === v ? "hsl(var(--nav-active-bg))" : "transparent",
                  color: viewMode === v ? "hsl(var(--nav-active-text))" : "hsl(var(--muted-foreground))",
                }}
              >
                {v === "active" ? "Active" : "All stages"}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="font-mono text-[10px] tracking-[0.12em] uppercase px-4 py-1.5 hover:opacity-90"
            style={{ backgroundColor: "hsl(var(--rust))", color: "hsl(var(--off-white))" }}
          >
            + Add prospect
          </button>
        </div>
      </div>
      <div className="flex h-[calc(100vh-185px)] overflow-hidden">
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-2 p-4 h-full">
            {visibleStages.map(stage => (
              <PipelineColumn
                key={stage}
                stage={stage}
                prospects={byStage[stage]}
                onCardClick={p => setSelectedId(p.id)}
                onDrop={handleDrop}
                onDragStart={p => { dragRef.current = p; }}
              />
            ))}
          </div>
        </div>
        {selectedId && (
          <div className="w-80 flex-shrink-0 overflow-y-auto">
            <ProspectDetail prospectId={selectedId} onClose={() => setSelectedId(null)} />
          </div>
        )}
      </div>
      {showAdd && <AddProspectModal onClose={() => setShowAdd(false)} />}
    </OpsShell>
  );
}
