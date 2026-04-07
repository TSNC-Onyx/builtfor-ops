import { useState, useEffect } from "react";
import type { Prospect, ProspectStage, IndustryVertical } from "@/types/pipeline";
import { STAGE_LABELS, STAGE_ORDER, SOURCE_LABELS } from "@/types/pipeline";
import { useUpdateProspect, useConvertToClient, useProspects } from "@/hooks/useProspects";
import { formatDate, formatPhone } from "@/lib/utils";

const VERTICALS: { value: IndustryVertical; label: string }[] = [
  { value: "landscaping", label: "Landscaping" },
  { value: "hvac",        label: "HVAC" },
  { value: "plumbing",    label: "Plumbing" },
  { value: "electrical",  label: "Electrical" },
  { value: "pest_control",label: "Pest Control" },
  { value: "cleaning",    label: "Cleaning" },
  { value: "other",       label: "Other…" },
];

const fieldStyle: React.CSSProperties = {
  width: "100%", fontFamily: "'DM Sans', sans-serif", fontSize: "13px",
  padding: "8px 12px", border: "1px solid hsl(var(--border))",
  backgroundColor: "hsl(var(--surface-raised))", color: "hsl(var(--foreground))", outline: "none",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-mono text-[9px] tracking-[0.14em] uppercase mb-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function ProspectDetail({ prospectId, onClose }: { prospectId: string; onClose: () => void }) {
  const { data: prospects = [] } = useProspects();
  const prospect = prospects.find(p => p.id === prospectId);

  const [form, setForm] = useState<Partial<Prospect>>(prospect ?? {});
  const [dirty, setDirty] = useState(false);
  const update = useUpdateProspect();
  const convert = useConvertToClient();

  useEffect(() => {
    if (prospect) { setForm(prospect); setDirty(false); }
  }, [prospect]);

  useEffect(() => {
    if (prospects.length > 0 && !prospect) onClose();
  }, [prospect, prospects.length]);

  if (!prospect) return null;

  function set<K extends keyof Prospect>(k: K, v: Prospect[K]) {
    setForm(f => ({ ...f, [k]: v }));
    setDirty(true);
  }

  function handleVerticalChange(v: IndustryVertical) {
    setForm(f => ({
      ...f,
      vertical: v,
      vertical_custom: v === "other" ? (f.vertical_custom ?? "") : null,
    }));
    setDirty(true);
  }

  function handlePhone(raw: string) {
    set("phone", formatPhone(raw));
  }

  function save() {
    update.mutate({ id: prospect!.id, updates: form }, {
      onSuccess: () => setDirty(false),
    });
  }

  function handleConvert() {
    if (confirm(`Convert ${prospect!.business_name} to a client?`)) {
      convert.mutate(prospect!, { onSuccess: onClose });
    }
  }

  const showCustom = (form.vertical ?? prospect.vertical) === "other";

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: "hsl(var(--surface))", borderLeft: "1px solid hsl(var(--border))" }}>
      <div className="px-6 py-4 flex items-start justify-between gap-4" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <div>
          <div className="font-display text-[22px] tracking-[0.02em] leading-tight" style={{ color: "hsl(var(--foreground))" }}>{prospect.business_name}</div>
          <div className="font-body text-[12px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{prospect.full_name}</div>
        </div>
        <button onClick={onClose} className="text-lg leading-none" style={{ color: "hsl(var(--muted-foreground))" }}>✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        <Field label="Stage">
          <select value={form.stage ?? prospect.stage} onChange={e => set("stage", e.target.value as ProspectStage)} style={fieldStyle}>
            {STAGE_ORDER.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </select>
        </Field>

        <Field label="Vertical">
          <select
            value={form.vertical ?? prospect.vertical}
            onChange={e => handleVerticalChange(e.target.value as IndustryVertical)}
            style={fieldStyle}
          >
            {VERTICALS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
        </Field>

        {showCustom && (
          <Field label="Specify trade / industry *">
            <input
              type="text"
              placeholder="e.g. Tree service, Irrigation…"
              value={form.vertical_custom ?? ""}
              onChange={e => set("vertical_custom", e.target.value)}
              autoFocus
              style={{ ...fieldStyle, border: "1px solid hsl(var(--rust) / 0.5)" }}
            />
          </Field>
        )}

        <Field label="Email"><input value={form.email ?? ""} onChange={e => set("email", e.target.value)} style={fieldStyle} /></Field>

        {/* Phone — auto-formatted */}
        <Field label="Phone">
          <input
            type="tel"
            placeholder="(555) 000-0000"
            value={form.phone ?? ""}
            onChange={e => handlePhone(e.target.value)}
            style={fieldStyle}
          />
        </Field>

        <Field label="State"><input maxLength={2} value={form.state ?? ""} onChange={e => set("state", e.target.value as any)} style={fieldStyle} placeholder="NC" /></Field>
        <Field label="Source">
          <select value={form.source ?? ""} onChange={e => set("source", e.target.value)} style={fieldStyle}>
            <option value="">—</option>
            {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Next action"><input value={form.next_action ?? ""} onChange={e => set("next_action", e.target.value)} style={fieldStyle} placeholder="Send proposal" /></Field>
        <Field label="Due date"><input type="date" value={form.next_action_date ?? ""} onChange={e => set("next_action_date", e.target.value)} style={fieldStyle} /></Field>
        <Field label="Notes"><textarea rows={4} value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} style={{ ...fieldStyle, resize: "none" }} /></Field>
        {form.stage === "closed_lost" && (
          <Field label="Lost reason"><input value={form.lost_reason ?? ""} onChange={e => set("lost_reason", e.target.value)} style={fieldStyle} /></Field>
        )}
        <div className="pt-2 space-y-1" style={{ borderTop: "1px solid hsl(var(--border))" }}>
          <div className="font-mono text-[9px] tracking-[0.12em] uppercase" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>Created {formatDate(prospect.created_at)}</div>
          <div className="font-mono text-[9px] tracking-[0.12em] uppercase" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>Updated {formatDate(prospect.updated_at)}</div>
        </div>
      </div>

      <div className="px-6 py-4 flex gap-2" style={{ borderTop: "1px solid hsl(var(--border))" }}>
        {dirty && (
          <button
            onClick={save}
            disabled={update.isPending}
            className="flex-1 font-mono text-[11px] tracking-[0.12em] uppercase py-2.5 disabled:opacity-50"
            style={{ backgroundColor: "hsl(var(--nav-active-bg))", color: "hsl(var(--nav-active-text))" }}
          >
            {update.isPending ? "Saving…" : "Save changes"}
          </button>
        )}
        {prospect.stage !== "closed_won" && (
          <button
            onClick={handleConvert}
            disabled={convert.isPending}
            className="flex-1 font-mono text-[11px] tracking-[0.12em] uppercase py-2.5 disabled:opacity-50"
            style={{ border: "1px solid hsl(var(--rust))", color: "hsl(var(--rust))" }}
          >
            {convert.isPending ? "Converting…" : "Convert to client"}
          </button>
        )}
      </div>
    </div>
  );
}
