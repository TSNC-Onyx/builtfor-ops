import { useState } from "react";
import { useDismissProspect } from "@/hooks/useProspects";

// ---------------------------------------------------------------------------
// Pre-determined dismiss reasons
// Each maps to an analytics-meaningful category. These are the only valid
// values — free-text notes are additive, not a substitute for reason selection.
// ---------------------------------------------------------------------------
export const DISMISS_REASONS: { value: string; label: string; description: string }[] = [
  {
    value: "not_a_fit",
    label: "Not a fit",
    description: "Wrong service type, geography, or business size",
  },
  {
    value: "price_budget",
    label: "Price / budget mismatch",
    description: "Cost was the primary blocker",
  },
  {
    value: "no_response",
    label: "No response",
    description: "Went dark after initial contact",
  },
  {
    value: "chose_competitor",
    label: "Chose a competitor",
    description: "Went with another software or provider",
  },
  {
    value: "not_ready",
    label: "Not ready",
    description: "Timing issue — may revisit later",
  },
  {
    value: "duplicate",
    label: "Duplicate entry",
    description: "Same business exists under another record",
  },
  {
    value: "test_internal",
    label: "Test / internal record",
    description: "Created for testing purposes",
  },
];

interface Props {
  prospectId: string;
  businessName: string;
  onClose: () => void;
  onDismissed?: () => void;
}

export function DismissProspectModal({ prospectId, businessName, onClose, onDismissed }: Props) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const dismiss = useDismissProspect();

  function handleConfirm() {
    if (!selectedReason) return;
    // Compose stored value: reason key + optional note appended
    const stored = notes.trim()
      ? `${selectedReason} — ${notes.trim()}`
      : selectedReason;
    dismiss.mutate(
      { id: prospectId, reason: stored },
      {
        onSuccess: () => {
          onDismissed?.();
          onClose();
        },
      },
    );
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "12px",
    padding: "7px 10px",
    border: "1px solid hsl(var(--border))",
    backgroundColor: "hsl(var(--surface-raised))",
    color: "hsl(var(--foreground))",
    outline: "none",
    resize: "none",
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm"
        style={{
          backgroundColor: "hsl(var(--surface))",
          border: "1px solid hsl(var(--border))",
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-start justify-between gap-3"
          style={{ borderBottom: "1px solid hsl(var(--border))" }}
        >
          <div>
            <div
              className="font-mono text-[9px] tracking-[0.16em] uppercase mb-0.5"
              style={{ color: "hsl(var(--rust))" }}
            >
              Dismiss Lead
            </div>
            <div
              className="font-body text-[13px] font-semibold"
              style={{ color: "hsl(var(--foreground))" }}
            >
              {businessName}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-base leading-none mt-0.5 flex-shrink-0"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            &#x2715;
          </button>
        </div>

        {/* Reason list */}
        <div className="px-5 pt-4 pb-3">
          <div
            className="font-mono text-[9px] tracking-[0.14em] uppercase mb-3"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            Reason — required
          </div>
          <div className="space-y-1.5">
            {DISMISS_REASONS.map(r => {
              const isSelected = selectedReason === r.value;
              return (
                <button
                  key={r.value}
                  onClick={() => setSelectedReason(r.value)}
                  className="w-full text-left px-3 py-2.5 transition-colors"
                  style={{
                    backgroundColor: isSelected
                      ? "hsl(var(--rust) / 0.10)"
                      : "hsl(var(--surface-raised))",
                    border: isSelected
                      ? "1px solid hsl(var(--rust) / 0.5)"
                      : "1px solid hsl(var(--surface-border))",
                    borderLeft: isSelected ? "3px solid hsl(var(--rust))" : "1px solid hsl(var(--surface-border))",
                  }}
                >
                  <div
                    className="font-body text-[12px] font-medium"
                    style={{ color: isSelected ? "hsl(var(--rust))" : "hsl(var(--foreground))" }}
                  >
                    {r.label}
                  </div>
                  <div
                    className="font-mono text-[9px] tracking-[0.06em] uppercase mt-0.5"
                    style={{ color: "hsl(var(--muted-foreground))", opacity: 0.7 }}
                  >
                    {r.description}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Optional notes */}
          <div className="mt-4">
            <label
              className="block font-mono text-[9px] tracking-[0.14em] uppercase mb-1.5"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              Additional notes — optional
            </label>
            <textarea
              rows={2}
              placeholder="Any context worth keeping…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={fieldStyle}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 flex gap-2"
          style={{ borderTop: "1px solid hsl(var(--border))" }}
        >
          <button
            onClick={onClose}
            className="flex-1 font-mono text-[10px] tracking-[0.12em] uppercase py-2.5"
            style={{
              border: "1px solid hsl(var(--border))",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedReason || dismiss.isPending}
            className="flex-1 font-mono text-[10px] tracking-[0.12em] uppercase py-2.5 disabled:opacity-40"
            style={{
              backgroundColor: selectedReason ? "hsl(var(--rust) / 0.15)" : "transparent",
              border: "1px solid hsl(var(--rust) / 0.5)",
              color: "hsl(var(--rust))",
            }}
          >
            {dismiss.isPending ? "Dismissing…" : "Dismiss lead"}
          </button>
        </div>
      </div>
    </div>
  );
}
