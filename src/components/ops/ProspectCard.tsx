import { useState } from "react";
import type { Prospect } from "@/types/pipeline";
import { verticalLabel } from "@/types/pipeline";
import { isOverdue, daysSince, formatDate } from "@/lib/utils";
import { DismissProspectModal } from "./DismissProspectModal";

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
  const verticalDisplay = verticalLabel(prospect.vertical, prospect.vertical_custom);
  const [showDismiss, setShowDismiss] = useState(false);

  return (
    <>
      <div
        draggable
        onDragStart={e => { e.stopPropagation(); onDragStart?.(); }}
        className="p-3.5 select-none flex-shrink-0 group relative"
        style={{
          backgroundColor: "hsl(var(--card))",
          border: overdue ? "1px solid hsl(var(--rust))" : "1px solid hsl(var(--surface-border))",
          borderLeft: overdue ? "3px solid hsl(var(--rust))" : undefined,
          opacity: isDragging ? 0.5 : 1,
        }}
      >
        {/* Dismiss button — top-right, visible on hover */}
        <button
          onClick={e => { e.stopPropagation(); setShowDismiss(true); }}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Dismiss lead"
          style={{ color: "hsl(var(--muted-foreground))" }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeOpacity="0.5" />
            <path d="M4 4L8 8M8 4L4 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>

        {/* Clickable content area */}
        <div onClick={onClick} className="cursor-pointer">
          <div className="font-body text-[13px] font-semibold leading-tight mb-0.5 truncate pr-4" style={{ color: "hsl(var(--foreground))" }}>
            {prospect.business_name}
          </div>
          <div className="font-body text-[12px] mb-2 truncate" style={{ color: "hsl(var(--foreground))", fontWeight: 400 }}>
            {prospect.full_name}
          </div>
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
              \u2192 {prospect.next_action}
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
      </div>

      {showDismiss && (
        <DismissProspectModal
          prospectId={prospect.id}
          businessName={prospect.business_name}
          onClose={() => setShowDismiss(false)}
        />
      )}
    </>
  );
}
