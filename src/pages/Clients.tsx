import { useState, useMemo } from "react";
import { OpsShell } from "@/components/ops/OpsShell";
import { MetricsBar } from "@/components/ops/MetricsBar";
import { useProspects } from "@/hooks/useProspects";
import { useClients } from "@/hooks/useClients";
import { formatDate, displayPhone } from "@/lib/utils";
import type { Client, ClientStatus, PricingTier, IndustryVertical } from "@/types/pipeline";
import { verticalLabel } from "@/types/pipeline";
import { DrillDownPanel } from "@/components/ops/DrillDownPanel";

const PAGE_SIZE = 15;

const STATUS_OPTIONS: ClientStatus[] = ["onboarding", "active", "at_risk", "churned", "paused"];
const TIER_OPTIONS: PricingTier[] = ["founding", "standard"];
const VERTICAL_OPTIONS: IndustryVertical[] = ["landscaping", "hvac", "plumbing", "electrical", "pest_control", "cleaning", "other"];

const STATUS_COLOR: Record<string, string> = {
  onboarding: "hsl(20,63%,47%)",
  active:     "hsl(213,58%,27%)",
  at_risk:    "hsl(38,90%,50%)",
  churned:    "hsl(216,21%,62%)",
  paused:     "hsl(216,21%,62%)",
};

const HEALTH_COLOR: Record<string, string> = {
  healthy:          "hsl(145,50%,40%)",
  needs_attention:  "hsl(38,90%,50%)",
  at_risk:          "hsl(20,63%,47%)",
  critical:         "hsl(0,72%,50%)",
};

function statusColor(s: string): string {
  return STATUS_COLOR[s] ?? "hsl(216,21%,62%)";
}

function healthColor(s: string): string {
  return HEALTH_COLOR[s] ?? "hsl(216,21%,62%)";
}

function formatEnum(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function Clients() {
  const { data: clients = [], isLoading, isError } = useClients();
  const { data: prospects = [] } = useProspects();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<ClientStatus | "all">("all");
  const [filterTier, setFilterTier] = useState<PricingTier | "all">("all");
  const [filterVertical, setFilterVertical] = useState<IndustryVertical | "all">("all");
  const [page, setPage] = useState(1);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const resetPage = () => setPage(1);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clients.filter(c => {
      if (filterStatus !== "all" && c.status !== filterStatus) return false;
      if (filterTier !== "all" && c.pricing_tier !== filterTier) return false;
      if (filterVertical !== "all" && c.vertical !== filterVertical) return false;
      if (q && !
        [c.business_name, c.owner_name, c.email, c.state, c.vertical, c.vertical_custom]
          .some(f => f?.toLowerCase().includes(q))
      ) return false;
      return true;
    });
  }, [clients, search, filterStatus, filterTier, filterVertical]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safeP = Math.min(page, totalPages);
  const paginated = filtered.slice((safeP - 1) * PAGE_SIZE, safeP * PAGE_SIZE);

  function handleSearch(v: string) { setSearch(v); resetPage(); }
  function handleStatus(v: ClientStatus | "all") { setFilterStatus(v); resetPage(); }
  function handleTier(v: PricingTier | "all") { setFilterTier(v); resetPage(); }
  function handleVertical(v: IndustryVertical | "all") { setFilterVertical(v); resetPage(); }

  const mrr = clients.reduce((sum, c) => {
    if (c.status === "churned" || c.status === "paused") return sum;
    return sum + (c.pricing_tier === "founding" ? 300 : 400);
  }, 0);

  // Effective MRR for a single client — $0 for churned/paused
  function clientMrr(c: Client): string {
    if (c.status === "churned" || c.status === "paused") return "$0/mo";
    return `$${c.pricing_tier === "founding" ? 300 : 400}/mo`;
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
          type="text"
          placeholder="Search name, email, state…"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: "13px",
            padding: "7px 12px", flex: "1 1 200px", minWidth: "140px",
            border: "1px solid hsl(var(--border))",
            backgroundColor: "hsl(var(--surface-raised))",
            color: "hsl(var(--foreground))", outline: "none",
          }}
        />
        <FilterSelect value={filterStatus} onChange={v => handleStatus(v as ClientStatus | "all")} options={[("all" as const), ...STATUS_OPTIONS]} label="Status" />
        <FilterSelect value={filterTier} onChange={v => handleTier(v as PricingTier | "all")} options={[("all" as const), ...TIER_OPTIONS]} label="Tier" />
        <FilterSelect value={filterVertical} onChange={v => handleVertical(v as IndustryVertical | "all")} options={[("all" as const), ...VERTICAL_OPTIONS]} label="Vertical" />
        {(search || filterStatus !== "all" || filterTier !== "all" || filterVertical !== "all") && (
          <button
            onClick={() => { setSearch(""); setFilterStatus("all"); setFilterTier("all"); setFilterVertical("all"); setPage(1); }}
            className="font-mono text-[10px] tracking-[0.12em] uppercase px-3 py-2"
            style={{ color: "hsl(var(--rust))", border: "1px solid hsl(var(--rust) / 0.4)" }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="px-4 md:px-6 pt-3 pb-1">
        <span className="font-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: "hsl(var(--muted-foreground))" }}>
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          {filtered.length !== clients.length ? ` (filtered from ${clients.length})` : ""}
        </span>
      </div>

      {isLoading && (
        <div className="px-4 md:px-6 py-4 font-mono text-[11px] tracking-[0.14em] uppercase animate-pulse" style={{ color: "hsl(var(--muted-foreground))" }}>Loading clients…</div>
      )}
      {isError && (
        <div className="mx-4 md:mx-6 my-3 p-4 font-mono text-[11px] tracking-[0.12em] uppercase" style={{ color: "hsl(var(--rust))", border: "1px solid hsl(var(--rust) / 0.3)", backgroundColor: "hsl(var(--rust) / 0.06)" }}>
          Failed to load clients — check connection and refresh.
        </div>
      )}

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
          <div
            key={c.id}
            onClick={() => setSelectedClient(c)}
            className="flex items-center gap-3 md:gap-5 px-4 py-3 cursor-pointer transition-opacity active:opacity-70 hover:opacity-80"
            style={{ backgroundColor: "hsl(var(--surface-raised))", border: "1px solid hsl(var(--surface-border))" }}
          >
            {/* Primary info — always visible */}
            <div className="flex-1 min-w-0">
              {/* Business name — semibold full-foreground */}
              <div className="font-body text-[13px] md:text-[14px] font-semibold truncate" style={{ color: "hsl(var(--foreground))" }}>
                {c.business_name}
              </div>
              {/* Owner name — own line, 12px full-foreground weight-400, WCAG AA */}
              <div className="font-body text-[12px] truncate" style={{ color: "hsl(var(--foreground))", fontWeight: 400 }}>
                {c.owner_name}
              </div>
              {/* Email — separate line, secondary, hidden on xs to preserve owner visibility */}
              {c.email && (
                <div className="hidden sm:block font-body text-[11px] truncate" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {c.email}
                </div>
              )}
            </div>

            {/* Status badge — bumped to 10px (was 9px, below mobile legibility floor) */}
            <span
              className="font-mono text-[10px] tracking-[0.1em] uppercase px-2 py-1 flex-shrink-0"
              style={{ border: `1px solid ${statusColor(c.status)}`, color: statusColor(c.status) }}
            >
              {formatEnum(c.status)}
            </span>

            {/* Vertical — 10px, hidden below sm */}
            <span className="hidden sm:inline font-mono text-[10px] tracking-[0.08em] uppercase flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>
              {verticalLabel(c.vertical, c.vertical_custom)}
            </span>

            {/* Tier — 10px, hidden below md */}
            <span className="hidden md:inline font-mono text-[10px] tracking-[0.08em] uppercase flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>
              {formatEnum(c.pricing_tier)}
            </span>

            {/* Date — hidden below lg, tertiary */}
            <span className="hidden lg:inline font-mono text-[9px] flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>
              {formatDate(c.created_at)}
            </span>

            {/* Tap affordance — rust arrow, visible on all breakpoints */}
            <span className="font-mono text-[11px] flex-shrink-0" style={{ color: "hsl(var(--rust))" }}>→</span>
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
                acc.push(n);
                return acc;
              }, [])
              .map((n, i) =>
                n === "..." ? (
                  <span key={`e${i}`} className="font-mono text-[10px] px-2 py-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>…</span>
                ) : (
                  <PagBtn key={n} label={String(n)} active={n === safeP} onClick={() => setPage(n as number)} />
                )
              )}
            <PagBtn label="›" disabled={safeP === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} />
          </div>
        </div>
      )}

      {/* Client detail panel */}
      {selectedClient && (
        <DrillDownPanel title={selectedClient.business_name} onClose={() => setSelectedClient(null)}>
          <div className="space-y-3">

            {/* --- OPERATIONAL STATE FIRST --- */}
            <DetailRow label="Status">
              <span
                className="font-mono text-[10px] tracking-[0.1em] uppercase px-2 py-1"
                style={{ border: `1px solid ${statusColor(selectedClient.status)}`, color: statusColor(selectedClient.status) }}
              >
                {formatEnum(selectedClient.status)}
              </span>
            </DetailRow>

            <DetailRow label="Health">
              <span
                className="font-body text-[13px]"
                style={{ color: healthColor(selectedClient.health_signal), fontWeight: 500 }}
              >
                {formatEnum(selectedClient.health_signal || "healthy")}
              </span>
            </DetailRow>

            <DetailRow label="MRR" value={clientMrr(selectedClient)} />
            <DetailRow label="Vertical" value={verticalLabel(selectedClient.vertical, selectedClient.vertical_custom)} />
            <DetailRow label="Tier" value={formatEnum(selectedClient.pricing_tier)} />

            <div style={{ borderTop: "1px solid hsl(var(--border))", marginTop: "4px", paddingTop: "12px" }}>
              {/* --- CONTACT DETAILS SECOND --- */}
              <div className="space-y-3">
                <DetailRow label="Owner" value={selectedClient.owner_name} />

                {/* Email — tappable mailto: on mobile */}
                <DetailRow label="Email">
                  {selectedClient.email ? (
                    <a
                      href={`mailto:${selectedClient.email}`}
                      className="font-body text-[13px]"
                      style={{ color: "hsl(var(--foreground))", textDecorationLine: "underline", textDecorationColor: "hsl(var(--rust) / 0.5)" }}
                    >
                      {selectedClient.email}
                    </a>
                  ) : (
                    <span className="font-body text-[13px]" style={{ color: "hsl(var(--foreground))" }}>—</span>
                  )}
                </DetailRow>

                {/* Phone — tappable tel: on mobile */}
                <DetailRow label="Phone">
                  {selectedClient.phone ? (
                    <a
                      href={`tel:${selectedClient.phone.replace(/\D/g, "")}`}
                      className="font-body text-[13px]"
                      style={{ color: "hsl(var(--foreground))", textDecorationLine: "underline", textDecorationColor: "hsl(var(--rust) / 0.5)" }}
                    >
                      {displayPhone(selectedClient.phone)}
                    </a>
                  ) : (
                    <span className="font-body text-[13px]" style={{ color: "hsl(var(--foreground))" }}>—</span>
                  )}
                </DetailRow>

                <DetailRow label="State" value={selectedClient.state || "—"} />
                <DetailRow label="Started" value={formatDate(selectedClient.created_at)} />
                {selectedClient.notes && <DetailRow label="Notes" value={selectedClient.notes} />}
              </div>
            </div>

          </div>
        </DrillDownPanel>
      )}
    </OpsShell>
  );
}

function FilterSelect({ value, onChange, options, label }: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        fontFamily: "'DM Mono', monospace", fontSize: "10px", letterSpacing: "0.1em",
        textTransform: "uppercase", padding: "7px 10px",
        border: "1px solid hsl(var(--border))",
        backgroundColor: "hsl(var(--surface-raised))",
        color: "hsl(var(--foreground))", outline: "none",
      }}
    >
      <option value="all">All {label}</option>
      {options.filter(o => o !== "all").map(o => (
        <option key={o} value={o}>{o.replace(/_/g, " ")}</option>
      ))}
    </select>
  );
}

function PagBtn({ label, active, disabled, onClick }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="font-mono text-[10px] tracking-[0.1em] px-2.5 py-1.5 transition-colors disabled:opacity-30"
      style={{
        backgroundColor: active ? "hsl(var(--navy))" : "transparent",
        color: active ? "hsl(var(--off-white))" : "hsl(var(--muted-foreground))",
        border: "1px solid hsl(var(--border))",
      }}
    >
      {label}
    </button>
  );
}

// DetailRow label bumped to 10px (was 9px — below mobile legibility floor)
function DetailRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="font-mono text-[10px] tracking-[0.12em] uppercase w-20 flex-shrink-0 pt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
        {label}
      </span>
      {children ?? <span className="font-body text-[13px]" style={{ color: "hsl(var(--foreground))" }}>{value}</span>}
    </div>
  );
}
