import type { Prospect } from "@/types/pipeline";
import { verticalLabel } from "@/types/pipeline";
import { isOverdue, daysSince, formatDate } from "@/lib/utils";

export function ProspectCard({
  prospect,
  onClick,
  isDragging,
  onDragStart,
}: {
  prospect: Prospect;
  onClick: () => void;
  isDragging?: boolean;
  onDragStart?: () => void;
}) {
  const overdue = isOverdue(prospect.next_action_date);
  const age = daysSince(prospect.created_at);

  // Resolve vertical display label — shows custom text when vertical = 'other'
  const verticalDisplay = verticalLabel(prospect.vertical, prospect.vertical_custom);

  return (
    <div
      onClick={onClick}
      draggable
      onDragStart={e => { e.stopPropagation(); onDragStart?.(); }}
      className="p-3.5 cursor-pointer transition-colors select-none flex-shrink-0"
      style={{
        backgroundColor: "hsl(var(--card))",
        border: overdue ? "1px solid hsl(var(--rust))" : "1px solid hsl(var(--surface-border))",
        borderLeft: overdue ? "3px solid hsl(var(--rust))" : undefined,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      {/* Business name — semibold, full foreground */}
      <div className="font-body text-[13px] font-semibold leading-tight mb-0.5 truncate" style={{ color: "hsl(var(--foreground))" }}>
        {prospect.business_name}
      </div>

      {/* Owner name — bumped to 12px at full foreground weight 400 to clear WCAG AA (was 11px muted ≈3.6:1) */}
      <div className="font-body text-[12px] mb-2 truncate" style={{ color: "hsl(var(--foreground))", fontWeight: 400 }}>
        {prospect.full_name}
      </div>

      {/* Tag pills — bumped to 10px (was 9px, below mobile legibility floor); tracking tightened to offset size increase */}
      <div className="flex items-center gap-1 flex-wrap mb-1.5">
        {[prospect.source, prospect.state, verticalDisplay].filter(Boolean).map((tag, i) => (
          <span
            key={i}
            className="font-mono text-[10px] tracking-[0.08em] uppercase px-1.5 py-0.5"
            style={{ border: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}
          >
            {tag}
          </span>
        ))}
      </div>

      {prospect.next_action && (
        <div
          className="font-body text-[11px] leading-tight truncate"
          style={{ color: overdue ? "hsl(var(--rust))" : "hsl(var(--muted-foreground))", fontWeight: overdue ? 500 : 400 }}
        >
          → {prospect.next_action}
          {prospect.next_action_date && (
            <span className="ml-1 opacity-70">({formatDate(prospect.next_action_date)})</span>
          )}
        </div>
      )}

      <div
        className="font-mono text-[9px] tracking-[0.08em] uppercase mt-1.5"
        style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}
      >
        {age}d in pipeline
      </div>
    </div>
  );
}
