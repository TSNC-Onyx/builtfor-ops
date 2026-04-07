import { useState } from "react";
import { useAddProspect } from "@/hooks/useProspects";
import type { IndustryVertical } from "@/types/pipeline";

const VERTICALS: { value: IndustryVertical; label: string }[] = [
  { value: "landscaping", label: "Landscaping" },
  { value: "hvac", label: "HVAC" },
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "pest_control", label: "Pest Control" },
  { value: "cleaning", label: "Cleaning" },
];

export function AddProspectModal({ onClose }: { onClose: () => void }) {
  const add = useAddProspect();
  const [form, setForm] = useState({
    full_name: "", business_name: "", email: "", phone: "",
    state: "", source: "", vertical: "landscaping" as IndustryVertical,
    notes: "", next_action: "", next_action_date: "",
  });
  const [err, setErr] = useState("");
  const s = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const fieldStyle: React.CSSProperties = {
    width: "100%", fontFamily: "'DM Sans', sans-serif", fontSize: "13px",
    padding: "8px 12px", border: "1px solid hsl(var(--border))",
    backgroundColor: "hsl(var(--surface-raised))", color: "hsl(var(--foreground))", outline: "none",
  };

  function submit() {
    if (!form.full_name.trim() || !form.business_name.trim()) {
      setErr("Name and business name are required.");
      return;
    }
    setErr("");
    add.mutate(
      {
        full_name: form.full_name,
        business_name: form.business_name,
        email: form.email || null,
        phone: form.phone || null,
        state: (form.state || null) as any,
        source: form.source || null,
        vertical: form.vertical,
        notes: form.notes || null,
        next_action: form.next_action || null,
        next_action_date: form.next_action_date || null,
        stage: "lead",
        referrer_client_id: null,
        lost_reason: null,
      },
      {
        onSuccess: onClose,
        // onError is handled globally in useAddProspect — toast fires automatically.
        // Keep modal open on error so user can retry without data loss.
      }
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(10,20,40,0.6)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md" style={{ backgroundColor: "hsl(var(--surface))" }}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
          <div className="font-display text-[20px] tracking-[0.03em]" style={{ color: "hsl(var(--foreground))" }}>Add prospect</div>
          <button onClick={onClose} style={{ color: "hsl(var(--muted-foreground))" }}>✕</button>
        </div>
        <div className="px-6 py-5 space-y-3 max-h-[70vh] overflow-y-auto">
          {([
            { k: "full_name", label: "Owner name", placeholder: "First Last", required: true },
            { k: "business_name", label: "Business name", placeholder: "Acme Landscaping", required: true },
            { k: "email", label: "Email", placeholder: "owner@company.com" },
            { k: "phone", label: "Phone", placeholder: "(555) 000-0000" },
            { k: "state", label: "State", placeholder: "NC", maxLen: 2 },
            { k: "next_action", label: "Next action", placeholder: "Send intro email" },
            { k: "next_action_date", label: "Due date", type: "date" },
          ] as any[]).map(f => (
            <div key={f.k}>
              <label className="block font-mono text-[9px] tracking-[0.14em] uppercase mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                {f.label}{f.required && " *"}
              </label>
              <input
                type={f.type ?? "text"}
                maxLength={f.maxLen}
                placeholder={f.placeholder}
                value={(form as any)[f.k]}
                onChange={e => s(f.k, e.target.value)}
                style={fieldStyle}
              />
            </div>
          ))}
          <div>
            <label className="block font-mono text-[9px] tracking-[0.14em] uppercase mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>Vertical *</label>
            <select value={form.vertical} onChange={e => s("vertical", e.target.value)} style={fieldStyle}>
              {VERTICALS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-mono text-[9px] tracking-[0.14em] uppercase mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>Source</label>
            <select value={form.source} onChange={e => s("source", e.target.value)} style={fieldStyle}>
              <option value="">—</option>
              {["outreach", "referral", "trade_show", "inbound"].map(v => (
                <option key={v} value={v}>{v.replace("_", " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-mono text-[9px] tracking-[0.14em] uppercase mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>Notes</label>
            <textarea rows={3} value={form.notes} onChange={e => s("notes", e.target.value)} style={{ ...fieldStyle, resize: "none" }} />
          </div>
          {err && <p className="font-mono text-[10px]" style={{ color: "hsl(var(--rust))" }}>{err}</p>}
        </div>
        <div className="px-6 py-4 flex gap-2" style={{ borderTop: "1px solid hsl(var(--border))" }}>
          <button
            onClick={onClose}
            className="flex-1 font-mono text-[11px] tracking-[0.12em] uppercase py-2.5"
            style={{ border: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={add.isPending}
            className="flex-1 font-mono text-[11px] tracking-[0.12em] uppercase py-2.5 disabled:opacity-50"
            style={{ backgroundColor: "hsl(var(--nav-active-bg))", color: "hsl(var(--nav-active-text))" }}
          >
            {add.isPending ? "Adding…" : "Add prospect"}
          </button>
        </div>
      </div>
    </div>
  );
}
