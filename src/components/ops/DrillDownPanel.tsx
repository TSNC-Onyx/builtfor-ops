import { ReactNode } from "react";

export function DrillDownPanel({ title, onClose, children }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: "rgba(10,20,40,0.6)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full sm:max-w-lg max-h-[85vh] flex flex-col"
        style={{ backgroundColor: "hsl(var(--surface))", border: "1px solid hsl(var(--border))" }}
      >
        <div className="px-5 py-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
          <span className="font-display text-[18px] tracking-[0.03em]" style={{ color: "hsl(var(--foreground))" }}>{title}</span>
          <button onClick={onClose} className="font-mono text-[16px]" style={{ color: "hsl(var(--muted-foreground))" }}>✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
