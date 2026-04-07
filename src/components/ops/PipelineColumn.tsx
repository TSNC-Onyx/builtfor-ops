import type { Prospect, ProspectStage } from "@/types/pipeline";
import { STAGE_LABELS } from "@/types/pipeline";
import { ProspectCard } from "./ProspectCard";

export function PipelineColumn({ stage, prospects, onCardClick, onDrop, onDragStart }: {
  stage: ProspectStage; prospects: Prospect[];
  onCardClick: (p: Prospect) => void;
  onDrop: (stage: ProspectStage) => void;
  onDragStart: (p: Prospect) => void;
}) {
  const isWon = stage === "closed_won";
  const isLost = stage === "closed_lost";
  const headerBorderColor = isWon ? "hsl(var(--navy))" : isLost ? "hsl(var(--muted-foreground) / 0.3)" : "hsl(var(--rust) / 0.4)";

  return (
    <div className="flex flex-col min-w-[220px] w-[220px] flex-shrink-0"
      onDragOver={e => e.preventDefault()} onDrop={() => onDrop(stage)}
    >
      <div className="px-3 py-2.5 mb-2" style={{ borderBottom: `2px solid ${headerBorderColor}` }}>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-[0.14em] uppercase"
            style={{ color: isLost ? "hsl(var(--muted-foreground))" : "hsl(var(--foreground))" }}>{STAGE_LABELS[stage]}</span>
          <span className="font-display text-lg leading-none" style={{ color: "hsl(var(--muted-foreground))" }}>{prospects.length}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto max-h-[calc(100vh-200px)] pr-0.5">
        {prospects.length === 0 && (
          <div className="p-4 text-center" style={{ border: "1px dashed hsl(var(--border))" }}>
            <span className="font-mono text-[9px] tracking-[0.1em] uppercase" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>Empty</span>
          </div>
        )}
        {prospects.map(p => <ProspectCard key={p.id} prospect={p} onClick={() => onCardClick(p)} isDragging={false} />)}
      </div>
    </div>
  );
}
