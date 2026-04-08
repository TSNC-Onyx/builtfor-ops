import { useState, useMemo } from "react";
import { toast } from "sonner";
import { OpsShell } from "@/components/ops/OpsShell";
import { MetricsBar } from "@/components/ops/MetricsBar";
import { useProspects } from "@/hooks/useProspects";
import { useClients } from "@/hooks/useClients";
import { formatDate, displayPhone } from "@/lib/utils";
import type { Client, ClientStatus, PricingTier, IndustryVertical } from "@/types/pipeline";
import { verticalLabel, TIER_LABELS } from "@/types/pipeline";
import { DrillDownPanel } from "@/components/ops/DrillDownPanel";
import { buildSetupFeePaymentLink } from "@/lib/stripe.service";
import { setupFeeCents, formatCents } from "@/types/billing";

const PAGE_SIZE = 15;

const STATUS_OPTIONS: ClientStatus[] = ["onboarding", "active", "at_risk", "churned", "paused"];
const TIER_OPTIONS: PricingTier[] = ["founding", "standard", "tlcc"];
const VERTICAL_OPTIONS: IndustryVertical[] = ["landscaping", "hvac", "plumbing", "electrical", "pest_control", "cleaning", "other"];

const RUST  = "hsl(20,63%,47%)";
const NAVY  = "hsl(213,58%,27%)";
const GREEN = "hsl(145,50%,40%)";
const STEEL = "hsl(216,21%,62%)";

const STATUS_COLOR: Record<string, string> = {
  onboarding: RUST,
  active:     NAVY,
  at_risk:    "hsl(38,90%,50%)",
  churned:    STEEL,
  paused:     STEEL,
};

const HEALTH_COLOR: Record<string, string> = {
  healthy:          GREEN,
  needs_attention:  "hsl(38,90%,50%)",
  at_risk:          RUST,
  critical:         "hsl(0,72%,50%)",
};

function statusColor(s: string): string { return STATUS_COLOR[s] ?? STEEL; }
function healthColor(s: string): string { return HEALTH_COLOR[s] ?? STEEL; }
function formatEnum(s: string): string { return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }

export default function Clients() {
  const { data: clients = [], isLoading, isError } = useClients();
  const { data: prospects = [] } = useProspects();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<ClientStatus | "all">("all");
  const [filterTier, setFilterTier] = useState<PricingTier | "all">("all");
  const [filterVertical, setFilterVertical] = useState<IndustryVertical | "all">("all");
  const [page, setPage] = useState(1);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);

  const resetPage = () => setPage(1);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clients.filter(c => {
      if (filterStatus !== "all" && c.status !== filterStatus) return false;
      if (filterTier !== "all" && c.pricing_tier !== filterTier) return false;
      if (filterVertical !== "all" && c.vertical !== filterVertical) return false;
      if (q && ![c.business_name, c.owner_name, c.email, c.state, c.vertical, c.vertical_custom]
        .some(f => f?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [clients, search, filterStatus, filterTier, filterVertical]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safeP = Math.min(page, totalPages);
  const paginated = filtered.slice((safeP - 1) * PAGE_SIZE, safeP * PAGE_SIZE);

  const mrr = clients.reduce((sum, c) => {
    if (c.status === "churned" || c.status === "paused") return sum;
    return sum + (c.pricing_tier === "standard" ? 400 : 300);
  }, 0);

  function clientMrr(c: Client): string {
    if (c.status === "churned" || c.status === "paused") return "$0/mo";
    return `$${c.pricing_tier === "standard" ? 400 : 300}/mo`;
  }

  async function handleCopyLink(c: Client) {
    setLinkLoading(true);
    try {
      const url = await buildSetupFeePaymentLink({
        client_id: c.id,
        business_name: c.business_name,
        email: c.email,
        amount_cents: setupFeeCents(c.pricing_tier),
        pricing_tier: c.pricing_tier,
      });
      await navigator.clipboard.writeText(url);
      toast.success(`Payment link copied — ${TIER_LABELS[c.pricing_tier]}`);
    } catch {
      toast.error("Failed to copy link — check connection and retry.");
    } finally {
      setLinkLoading(false);
    }
  }

  async function handleOpenLink(c: Client) {
    setLinkLoading(true);
    try {
      const url = await buildSetupFeePaymentLink({
        client_id: c.id,
        business_name: c.business_name,
        email: c.email,
        amount_cents: setupFeeCents(c.pricing_tier),
        pricing_tier: c.pricing_tier,
      });
      window.open(url, "_blank");
    } catch {
      toast.error("Failed to open link — check connection and retry.");
    } finally {
      setLinkLoading(false);
    }
  }

  return (
    <OpsShell>
      <MetricsBar prospects={prospects} clients={clients} />

      <div className="px-4 md:px-6 py-4" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <h1 className="font-display text-[24px] md:text-[28px] tracking-[0.02em] leading-none" style={{ color: "hsl(var(--foreground))" }}>Clients</h1>
        <p className="font-body text-[12px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
          {clients.length} accounts · ${mrr.toLocaleString()}/mo MRR
        </p>
      </div>

      {/* Search + Filters */}
      <div className="px-4 md:px-6 py-3 flex flex-wrap gap-2 items-center" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <input
          type="text" placeholder="Search name, email, state…"
          value={search} onChange={e => { setSearch(e.target.value); resetPage(); }}
          style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: "13px",
            padding: "7px 12px", flex: "1 1 200px", minWidth: "140px",
            border: "1px solid hsl(var(--border))",
            backgroundColor: "hsl(var(--surface-raised))",
            color: "hsl(var(--foreground))", outline: "none",
          }}
        />
        <FilterSelect value={filterStatus} onChange={v => { setFilterStatus(v as ClientStatus | "all"); resetPage(); }} options={[("all" as const), ...STATUS_OPTIONS]} label="Status" />
        <FilterSelect value={filterTier}   onChange={v => { setFilterTier(v as PricingTier | "all"); resetPage(); }}   options={[("all" as const), ...TIER_OPTIONS]}   label="Tier" />
        <FilterSelect value={filterVertical} onChange={v => { setFilterVertical(v as IndustryVertical | "all"); resetPage(); }} options={[("all" as const), ...VERTICAL_OPTIONS]} label="Vertical" />
        {(search || filterStatus !== "all" || filterTier !== "all" || filterVertical !== "all") && (
          <button
            onClick={() => { setSearch(""); setFilterStatus("all"); setFilterTier("all"); setFilterVertical("all"); setPage(1); }}
            className="font-mono text-[10px] tracking-[0.12em] uppercase px-3 py-2"
            style={{ color: "hsl(var(--rust))", border: "1px solid hsl(var(--rust) / 0.4)" }}
          >Clear</button>
        )}
      </div>

      <div className="px-4 md:px-6 pt-3 pb-1">
        <span className="font-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: "hsl(var(--muted-foreground))" }}>
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          {filtered.length !== clients.length ? ` (filtered from ${clients.length})` : ""}
        </span>
      </div>

      {isLoading && <div className="px-4 md:px-6 py-4 font-mono text-[11px] tracking-[0.14em] uppercase animate-pulse" style={{ color: "hsl(var(--muted-foreground))" }}>Loading clients…</div>}
      {isError  && <div className="mx-4 md:mx-6 my-3 p-4 font-mono text-[11px] tracking-[0.12em] uppercase" style={{ color: RUST, border: `1px solid ${RUST}4d`, backgroundColor: `${RUST}0f` }}>Failed to load clients — check connection and refresh.</div>}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="mx-4 md:mx-6 my-6 p-10 text-center" style={{ border: "1px dashed hsl(var(--border))" }}>
          <div className="font-mono text-[10px] tracking-[0.14em] uppercase" style={{ color: "hsl(var(--muted-foreground))" }}>
            {clients.length === 0 ? "No clients yet — convert a won prospect from Pipeline" : "No results match filters"}
          </div>
        </div>
      )}

      {/* Client rows */}
      <div className="px-4 md:px-6 pb-3 space-y-1 mt-1">
        {paginated.map(c => (
          <div key={c.id} onClick={() => setSelectedClient(c)}
            className="flex items-center gap-3 md:gap-5 px-4 py-3 cursor-pointer transition-opacity active:opacity-70 hover:opacity-80"
            style={{ backgroundColor: "hsl(var(--surface-raised))", border: "1px solid hsl(var(--surface-border))" }}
          >
            <div className="flex-1 min-w-0">
              <div className="font-body text-[13px] md:text-[14px] font-semibold truncate" style={{ color: "hsl(var(--foreground))" }}>{c.business_name}</div>
              <div className="font-body text-[12px] truncate" style={{ color: "hsl(var(--foreground))", fontWeight: 400 }}>{c.owner_name}</div>
              {c.email && <div className="hidden sm:block font-body text-[11px] truncate" style={{ color: "hsl(var(--muted-foreground))" }}>{c.email}</div>}
            </div>
            <span className="font-mono text-[10px] tracking-[0.1em] uppercase px-2 py-1 flex-shrink-0" style={{ border: `1px solid ${statusColor(c.status)}`, color: statusColor(c.status) }}>{formatEnum(c.status)}</span>
            <span className="hidden sm:inline font-mono text-[10px] tracking-[0.08em] uppercase flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>{verticalLabel(c.vertical, c.vertical_custom)}</span>
            <span className="hidden md:inline font-mono text-[10px] tracking-[0.08em] uppercase flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>{TIER_LABELS[c.pricing_tier]}</span>
            <span className="hidden lg:inline font-mono text-[9px] flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>{formatDate(c.created_at)}</span>
            <span className="font-mono text-[11px] flex-shrink-0" style={{ color: RUST }}>→</span>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 md:px-6 py-4 flex items-center gap-2 justify-between" style={{ borderTop: "1px solid hsl(var(--border))" }}>
          <span className="font-mono text-[10px] tracking-[0.12em] uppercase" style={{ color: "hsl(var(--muted-foreground))" }}>
            Page {safeP} of {totalPages} · {filtered.length} results
          </span>
          <div className="flex gap-1">
            <PagBtn label="‹" disabled={safeP === 1} onClick={() => setPage(p => Math.max(1, p - 1))} />
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(n => n === 1 || n === totalPages || Math.abs(n - safeP) <= 1)
              .reduce<(number | "...")[]>((acc, n, i, arr) => {
                if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push("...");
                acc.push(n); return acc;
              }, [])
              .map((n, i) => n === "..." ? (
                <span key={`e${i}`} className="font-mono text-[10px] px-2 py-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>…</span>
              ) : (
                <PagBtn key={n} label={String(n)} active={n === safeP} onClick={() => setPage(n as number)} />
              ))}
            <PagBtn label="›" disabled={safeP === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} />
          </div>
        </div>
      )}

      {/* Client detail panel */}
      {selectedClient && (
        <DrillDownPanel title={selectedClient.business_name} onClose={() => setSelectedClient(null)}>
          <div className="space-y-4">

            {/* ── PAYMENT LINK ── prominent, top of panel */}
            <div style={{ backgroundColor: `${NAVY}12`, border: `1px solid ${NAVY}33`, padding: "14px 16px" }}>
              <div className="font-mono text-[9px] tracking-[0.16em] uppercase mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>Setup Fee Payment Link</div>
              <div className="font-body text-[13px] font-semibold mb-3" style={{ color: "hsl(var(--foreground))" }}>
                {TIER_LABELS[selectedClient.pricing_tier]} — {formatCents(setupFeeCents(selectedClient.pricing_tier))}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => handleCopyLink(selectedClient)}
                  disabled={linkLoading}
                  className="font-mono text-[10px] tracking-[0.12em] uppercase px-4 py-2 transition-opacity disabled:opacity-40"
                  style={{ backgroundColor: NAVY, color: "hsl(38,33%,92%)", border: "none", cursor: linkLoading ? "not-allowed" : "pointer" }}
                >
                  {linkLoading ? "Loading…" : "Copy Link"}
                </button>
                <button
                  onClick={() => handleOpenLink(selectedClient)}
                  disabled={linkLoading}
                  className="font-mono text-[10px] tracking-[0.12em] uppercase px-4 py-2 transition-opacity disabled:opacity-40"
                  style={{ border: `1px solid ${RUST}`, color: RUST, background: "none", cursor: linkLoading ? "not-allowed" : "pointer" }}
                >
                  Open Link
                </button>
              </div>
              <p className="font-mono text-[9px] tracking-[0.08em] mt-2" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.7 }}>
                Prefills client email · attaches client ID for reconciliation
              </p>
            </div>

            {/* ── OPERATIONAL STATE ── */}
            <div className="space-y-3">
              <DetailRow label="Status">
                <span className="font-mono text-[10px] tracking-[0.1em] uppercase px-2 py-1"
                  style={{ border: `1px solid ${statusColor(selectedClient.status)}`, color: statusColor(selectedClient.status) }}>
                  {formatEnum(selectedClient.status)}
                </span>
              </DetailRow>
              <DetailRow label="Health">
                <span className="font-body text-[13px]" style={{ color: healthColor(selectedClient.health_signal), fontWeight: 500 }}>
                  {formatEnum(selectedClient.health_signal || "healthy")}
                </span>
              </DetailRow>
              <DetailRow label="MRR" value={clientMrr(selectedClient)} />
              <DetailRow label="Vertical" value={verticalLabel(selectedClient.vertical, selectedClient.vertical_custom)} />
              <DetailRow label="Tier" value={TIER_LABELS[selectedClient.pricing_tier]} />
            </div>

            {/* ── CONTACT DETAILS ── */}
            <div className="space-y-3" style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: "12px" }}>
              <DetailRow label="Owner" value={selectedClient.owner_name} />
              <DetailRow label="Email">
                {selectedClient.email ? (
                  <a href={`mailto:${selectedClient.email}`} className="font-body text-[13px]"
                    style={{ color: "hsl(var(--foreground))", textDecorationLine: "underline", textDecorationColor: `${RUST}80` }}>
                    {selectedClient.email}
                  </a>
                ) : <span className="font-body text-[13px]" style={{ color: "hsl(var(--foreground))" }}>—</span>}
              </DetailRow>
              <DetailRow label="Phone">
                {selectedClient.phone ? (
                  <a href={`tel:${selectedClient.phone.replace(/\D/g, "")}`} className="font-body text-[13px]"
                    style={{ color: "hsl(var(--foreground))", textDecorationLine: "underline", textDecorationColor: `${RUST}80` }}>
                    {displayPhone(selectedClient.phone)}
                  </a>
                ) : <span className="font-body text-[13px]" style={{ color: "hsl(var(--foreground))" }}>—</span>}
              </DetailRow>
              <DetailRow label="State" value={selectedClient.state || "—"} />
              <DetailRow label="Started" value={formatDate(selectedClient.created_at)} />
              {selectedClient.notes && <DetailRow label="Notes" value={selectedClient.notes} />}
            </div>
          </div>
        </DrillDownPanel>
      )}
    </OpsShell>
  );
}

function FilterSelect({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: string[]; label: string }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{
        fontFamily: "'DM Mono', monospace", fontSize: "10px", letterSpacing: "0.1em",
        textTransform: "uppercase", padding: "7px 10px",
        border: "1px solid hsl(var(--border))",
        backgroundColor: "hsl(var(--surface-raised))",
        color: "hsl(var(--foreground))", outline: "none",
      }}
    >
      <option value="all">All {label}</option>
      {options.filter(o => o !== "all").map(o => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
    </select>
  );
}

function PagBtn({ label, active, disabled, onClick }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="font-mono text-[10px] tracking-[0.1em] px-2.5 py-1.5 transition-colors disabled:opacity-30"
      style={{
        backgroundColor: active ? "hsl(var(--navy))" : "transparent",
        color: active ? "hsl(var(--off-white))" : "hsl(var(--muted-foreground))",
        border: "1px solid hsl(var(--border))",
      }}
    >{label}</button>
  );
}

function DetailRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="font-mono text-[10px] tracking-[0.12em] uppercase w-20 flex-shrink-0 pt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{label}</span>
      {children ?? <span className="font-body text-[13px]" style={{ color: "hsl(var(--foreground))" }}>{value}</span>}
    </div>
  );
}
