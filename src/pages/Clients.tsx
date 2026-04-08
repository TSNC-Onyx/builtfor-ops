import { useState, useMemo } from "react";
import { toast } from "sonner";
import { OpsShell } from "@/components/ops/OpsShell";
import { MetricsBar } from "@/components/ops/MetricsBar";
import { useProspects } from "@/hooks/useProspects";
import { useClients, type ClientWithSubscription } from "@/hooks/useClients";
import { usePortalInvite } from "@/hooks/usePortalInvite";
import { formatDate, displayPhone } from "@/lib/utils";
import type { ClientStatus, PricingTier, IndustryVertical, PortalInviteStatus } from "@/types/pipeline";
import { verticalLabel, TIER_LABELS, TIER_OPTIONS, PORTAL_INVITE_CONFIG } from "@/types/pipeline";
import { DrillDownPanel } from "@/components/ops/DrillDownPanel";
import { buildSetupFeePaymentLink } from "@/lib/stripe.service";
import { setupFeeCents, formatCents } from "@/types/billing";

const PAGE_SIZE = 15;

const STATUS_OPTIONS: ClientStatus[] = ["onboarding", "active", "at_risk", "churned", "paused"];
const VERTICAL_OPTIONS: IndustryVertical[] = ["landscaping", "hvac", "plumbing", "electrical", "pest_control", "cleaning", "other"];

const RUST  = "hsl(20,63%,47%)";
const NAVY  = "hsl(213,58%,27%)";
const GREEN = "hsl(145,50%,40%)";
const STEEL = "hsl(216,21%,62%)";

const STATUS_COLOR: Record<string, string> = {
  onboarding: RUST, active: NAVY,
  at_risk: "hsl(38,90%,50%)", churned: STEEL, paused: STEEL,
};
const HEALTH_COLOR: Record<string, string> = {
  healthy: GREEN, needs_attention: "hsl(38,90%,50%)", at_risk: RUST, critical: "hsl(0,72%,50%)",
};

function statusColor(s: string): string { return STATUS_COLOR[s] ?? STEEL; }
function healthColor(s: string): string { return HEALTH_COLOR[s] ?? STEEL; }
function formatEnum(s: string): string  { return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }

/**
 * Derives the effective monthly rate for display from the subscription row.
 * Reads effective_rate_cents (DB-generated column) when available.
 * Falls back to monthly_rate_cents, then zero.
 * Never uses hardcoded tier assumptions.
 */
function clientEffectiveRate(c: ClientWithSubscription): number {
  if (c.status === "churned" || c.status === "paused") return 0;
  const sub = c.subscription;
  if (!sub) return 0;
  return sub.effective_rate_cents ?? sub.monthly_rate_cents ?? 0;
}

export default function Clients() {
  const { data: clients = [], isLoading, isError } = useClients();
  const { data: prospects = [] } = useProspects();
  const { sendInvite, loading: inviteLoading } = usePortalInvite();

  const [search, setSearch]               = useState("");
  const [filterStatus, setFilterStatus]   = useState<ClientStatus | "all">("all");
  const [filterTier, setFilterTier]       = useState<PricingTier | "all">("all");
  const [filterVertical, setFilterVertical] = useState<IndustryVertical | "all">("all");
  const [page, setPage]                   = useState(1);
  const [selectedClient, setSelectedClient] = useState<ClientWithSubscription | null>(null);
  const [selectedTier, setSelectedTier]   = useState<PricingTier | null>(null);
  const [linkLoading, setLinkLoading]     = useState(false);
  const [inviteConfirm, setInviteConfirm] = useState(false);

  const resetPage = () => setPage(1);

  function openClient(c: ClientWithSubscription) {
    setSelectedClient(c);
    setSelectedTier(c.pricing_tier);
    setInviteConfirm(false);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clients.filter(c => {
      if (filterStatus   !== "all" && c.status       !== filterStatus)   return false;
      if (filterTier     !== "all" && c.pricing_tier !== filterTier)     return false;
      if (filterVertical !== "all" && c.vertical     !== filterVertical) return false;
      if (q && ![c.business_name, c.owner_name, c.email, c.state, c.vertical, c.vertical_custom]
        .some(f => f?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [clients, search, filterStatus, filterTier, filterVertical]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safeP      = Math.min(page, totalPages);
  const paginated  = filtered.slice((safeP - 1) * PAGE_SIZE, safeP * PAGE_SIZE);

  // MRR derived from actual subscription effective_rate_cents — never hardcoded
  const mrr = useMemo(() =>
    clients.reduce((sum, c) => sum + clientEffectiveRate(c), 0),
  [clients]);

  function clientMrrLabel(c: ClientWithSubscription): string {
    const rate = clientEffectiveRate(c);
    return rate > 0 ? `$${(rate / 100).toLocaleString("en-US")}/mo` : "$0/mo";
  }

  async function resolveLink(c: ClientWithSubscription, tier: PricingTier): Promise<string> {
    return buildSetupFeePaymentLink({
      client_id:     c.id,
      business_name: c.business_name,
      email:         c.email,
      amount_cents:  setupFeeCents(tier),
      pricing_tier:  tier,
    });
  }

  async function handleCopyLink(c: ClientWithSubscription, tier: PricingTier) {
    setLinkLoading(true);
    try {
      const url = await resolveLink(c, tier);
      await navigator.clipboard.writeText(url);
      toast.success(`Payment link copied \u2014 ${TIER_LABELS[tier]}`);
    } catch {
      toast.error("Failed to copy link \u2014 check connection and retry.");
    } finally {
      setLinkLoading(false);
    }
  }

  async function handleOpenLink(c: ClientWithSubscription, tier: PricingTier) {
    setLinkLoading(true);
    try {
      const url = await resolveLink(c, tier);
      window.open(url, "_blank");
    } catch {
      toast.error("Failed to open link \u2014 check connection and retry.");
    } finally {
      setLinkLoading(false);
    }
  }

  async function handleSendPortalInvite(c: ClientWithSubscription) {
    if (!inviteConfirm) {
      setInviteConfirm(true);
      return;
    }
    setInviteConfirm(false);
    const result = await sendInvite(c.id);
    if (result.ok) {
      toast.success(`Portal invite sent to ${result.email}`);
      // Optimistically update the selected client reference so the panel
      // reflects 'invited' without needing to re-open it
      setSelectedClient(prev =>
        prev ? { ...prev, portal_invite_status: "invited", portal_invite_sent_at: new Date().toISOString() } : prev
      );
    } else {
      if (result.error === "Client has already signed up") {
        toast.info("This client has already completed portal signup.");
      } else {
        toast.error(`Invite failed \u2014 ${result.error}`);
      }
    }
  }

  const activeTier: PricingTier = selectedTier ?? selectedClient?.pricing_tier ?? "standard";

  return (
    <OpsShell>
      <MetricsBar prospects={prospects} clients={clients} />

      <div className="px-4 md:px-6 py-4" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <h1 className="font-display text-[24px] md:text-[28px] tracking-[0.02em] leading-none" style={{ color: "hsl(var(--foreground))" }}>Clients</h1>
        <p className="font-body text-[12px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
          {clients.length} accounts \u00b7 ${mrr > 0 ? (mrr / 100).toLocaleString("en-US") : "0"}/mo MRR
        </p>
      </div>

      <div className="px-4 md:px-6 py-3 flex flex-wrap gap-2 items-center" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <input
          type="text" placeholder="Search name, email, state\u2026"
          value={search} onChange={e => { setSearch(e.target.value); resetPage(); }}
          style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: "13px",
            padding: "7px 12px", flex: "1 1 200px", minWidth: "140px",
            border: "1px solid hsl(var(--border))",
            backgroundColor: "hsl(var(--surface-raised))",
            color: "hsl(var(--foreground))", outline: "none",
          }}
        />
        <FilterSelect value={filterStatus}   onChange={v => { setFilterStatus(v as ClientStatus | "all");     resetPage(); }} options={[("all" as const), ...STATUS_OPTIONS]}   label="Status" />
        <FilterSelect value={filterTier}     onChange={v => { setFilterTier(v as PricingTier | "all");         resetPage(); }} options={[("all" as const), ...TIER_OPTIONS]}     label="Tier" />
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

      {isLoading && <div className="px-4 md:px-6 py-4 font-mono text-[11px] tracking-[0.14em] uppercase animate-pulse" style={{ color: "hsl(var(--muted-foreground))" }}>Loading clients\u2026</div>}
      {isError   && <div className="mx-4 md:mx-6 my-3 p-4 font-mono text-[11px] tracking-[0.12em] uppercase" style={{ color: RUST, border: `1px solid ${RUST}4d`, backgroundColor: `${RUST}0f` }}>Failed to load clients \u2014 check connection and refresh.</div>}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="mx-4 md:mx-6 my-6 p-10 text-center" style={{ border: "1px dashed hsl(var(--border))" }}>
          <div className="font-mono text-[10px] tracking-[0.14em] uppercase" style={{ color: "hsl(var(--muted-foreground))" }}>
            {clients.length === 0 ? "No clients yet \u2014 convert a won prospect from Pipeline" : "No results match filters"}
          </div>
        </div>
      )}

      <div className="px-4 md:px-6 pb-3 space-y-1 mt-1">
        {paginated.map(c => {
          const inviteCfg = PORTAL_INVITE_CONFIG[c.portal_invite_status ?? "not_invited"];
          return (
            <div key={c.id} onClick={() => openClient(c)}
              className="flex items-center gap-3 md:gap-5 px-4 py-3 cursor-pointer transition-opacity active:opacity-70 hover:opacity-80"
              style={{ backgroundColor: "hsl(var(--surface-raised))", border: "1px solid hsl(var(--surface-border))" }}
            >
              <div className="flex-1 min-w-0">
                <div className="font-body text-[13px] md:text-[14px] font-semibold truncate" style={{ color: "hsl(var(--foreground))" }}>{c.business_name}</div>
                <div className="font-body text-[12px] truncate" style={{ color: "hsl(var(--foreground))", fontWeight: 400 }}>{c.owner_name}</div>
                {c.email && <div className="hidden sm:block font-body text-[11px] truncate" style={{ color: "hsl(var(--muted-foreground))" }}>{c.email}</div>}
              </div>
              <span className="font-mono text-[10px] tracking-[0.1em] uppercase px-2 py-1 flex-shrink-0" style={{ border: `1px solid ${statusColor(c.status)}`, color: statusColor(c.status) }}>{formatEnum(c.status)}</span>
              {/* Portal invite status badge — shown on md+ screens */}
              <span
                className="hidden md:inline font-mono text-[9px] tracking-[0.08em] uppercase px-2 py-1 flex-shrink-0"
                style={{ border: `1px solid ${inviteCfg.color}66`, color: inviteCfg.color }}
                title={`Portal: ${inviteCfg.label}`}
              >
                {inviteCfg.label}
              </span>
              <span className="hidden sm:inline font-mono text-[10px] tracking-[0.08em] uppercase flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>{verticalLabel(c.vertical, c.vertical_custom)}</span>
              <span className="hidden md:inline font-mono text-[10px] tracking-[0.08em] uppercase flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>{TIER_LABELS[c.pricing_tier]}</span>
              <span className="hidden lg:inline font-mono text-[9px] flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>{formatDate(c.created_at)}</span>
              <span className="font-mono text-[11px] flex-shrink-0" style={{ color: RUST }}>\u2192</span>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="px-4 md:px-6 py-4 flex items-center gap-2 justify-between" style={{ borderTop: "1px solid hsl(var(--border))" }}>
          <span className="font-mono text-[10px] tracking-[0.12em] uppercase" style={{ color: "hsl(var(--muted-foreground))" }}>
            Page {safeP} of {totalPages} \u00b7 {filtered.length} results
          </span>
          <div className="flex gap-1">
            <PagBtn label="\u2039" disabled={safeP === 1} onClick={() => setPage(p => Math.max(1, p - 1))} />
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(n => n === 1 || n === totalPages || Math.abs(n - safeP) <= 1)
              .reduce<(number | "...")[]>((acc, n, i, arr) => {
                if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push("...");
                acc.push(n); return acc;
              }, [])
              .map((n, i) => n === "..." ? (
                <span key={`e${i}`} className="font-mono text-[10px] px-2 py-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>\u2026</span>
              ) : (
                <PagBtn key={n} label={String(n)} active={n === safeP} onClick={() => setPage(n as number)} />
              ))}
            <PagBtn label="\u203a" disabled={safeP === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} />
          </div>
        </div>
      )}

      {selectedClient && (
        <DrillDownPanel title={selectedClient.business_name} onClose={() => { setSelectedClient(null); setSelectedTier(null); setInviteConfirm(false); }}>
          <div className="space-y-4">

            {/* ── Portal Account Invite ─────────────────────────────────── */}
            <PortalInvitePanel
              client={selectedClient}
              inviteLoading={inviteLoading}
              inviteConfirm={inviteConfirm}
              onSend={() => handleSendPortalInvite(selectedClient)}
              onCancelConfirm={() => setInviteConfirm(false)}
            />

            {/* ── Setup Fee Payment Link ────────────────────────────────── */}
            <div style={{ backgroundColor: `${NAVY}12`, border: `1px solid ${NAVY}33`, padding: "14px 16px" }}>
              <div className="font-mono text-[9px] tracking-[0.16em] uppercase mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>Setup Fee Payment Link</div>
              <div className="mb-3">
                <label className="font-mono text-[9px] tracking-[0.12em] uppercase block mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>Select link type</label>
                <select
                  value={activeTier}
                  onChange={e => setSelectedTier(e.target.value as PricingTier)}
                  style={{
                    fontFamily: "'DM Mono', monospace", fontSize: "11px", letterSpacing: "0.06em",
                    padding: "7px 10px", width: "100%",
                    border: `1px solid ${NAVY}66`,
                    backgroundColor: "hsl(var(--surface-raised))",
                    color: "hsl(var(--foreground))", outline: "none",
                  }}
                >
                  {TIER_OPTIONS.map(t => (
                    <option key={t} value={t}>{TIER_LABELS[t]} \u2014 {formatCents(setupFeeCents(t))}</option>
                  ))}
                </select>
              </div>
              {activeTier !== selectedClient.pricing_tier && (
                <div className="font-mono text-[9px] tracking-[0.08em] mb-2" style={{ color: RUST }}>
                  \u26a0 Override active \u2014 client tier is {TIER_LABELS[selectedClient.pricing_tier]}
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => handleCopyLink(selectedClient, activeTier)} disabled={linkLoading}
                  className="font-mono text-[10px] tracking-[0.12em] uppercase px-4 py-2 transition-opacity disabled:opacity-40"
                  style={{ backgroundColor: NAVY, color: "hsl(38,33%,92%)", border: "none", cursor: linkLoading ? "not-allowed" : "pointer" }}
                >{linkLoading ? "Loading\u2026" : "Copy Link"}</button>
                <button onClick={() => handleOpenLink(selectedClient, activeTier)} disabled={linkLoading}
                  className="font-mono text-[10px] tracking-[0.12em] uppercase px-4 py-2 transition-opacity disabled:opacity-40"
                  style={{ border: `1px solid ${RUST}`, color: RUST, background: "none", cursor: linkLoading ? "not-allowed" : "pointer" }}
                >Open Link</button>
              </div>
              <p className="font-mono text-[9px] tracking-[0.08em] mt-2" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.7 }}>
                Prefills client email \u00b7 attaches client ID for reconciliation
              </p>
            </div>

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
              {/* MRR read from subscription effective_rate_cents — never hardcoded */}
              <DetailRow label="MRR" value={clientMrrLabel(selectedClient)} />
              <DetailRow label="Vertical" value={verticalLabel(selectedClient.vertical, selectedClient.vertical_custom)} />
              <DetailRow label="Tier"     value={TIER_LABELS[selectedClient.pricing_tier]} />
            </div>

            <div className="space-y-3" style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: "12px" }}>
              <DetailRow label="Owner" value={selectedClient.owner_name} />
              <DetailRow label="Email">
                {selectedClient.email ? (
                  <a href={`mailto:${selectedClient.email}`} className="font-body text-[13px]"
                    style={{ color: "hsl(var(--foreground))", textDecorationLine: "underline", textDecorationColor: `${RUST}80` }}>
                    {selectedClient.email}
                  </a>
                ) : <span className="font-body text-[13px]" style={{ color: "hsl(var(--foreground))" }}>\u2014</span>}
              </DetailRow>
              <DetailRow label="Phone">
                {selectedClient.phone ? (
                  <a href={`tel:${selectedClient.phone.replace(/\D/g, "")}`} className="font-body text-[13px]"
                    style={{ color: "hsl(var(--foreground))", textDecorationLine: "underline", textDecorationColor: `${RUST}80` }}>
                    {displayPhone(selectedClient.phone)}
                  </a>
                ) : <span className="font-body text-[13px]" style={{ color: "hsl(var(--foreground))" }}>\u2014</span>}
              </DetailRow>
              <DetailRow label="State"   value={selectedClient.state || "\u2014"} />
              <DetailRow label="Started" value={formatDate(selectedClient.created_at)} />
              {selectedClient.portal_invite_sent_at && (
                <DetailRow label="Invited" value={formatDate(selectedClient.portal_invite_sent_at)} />
              )}
              {selectedClient.notes && <DetailRow label="Notes" value={selectedClient.notes} />}
            </div>

          </div>
        </DrillDownPanel>
      )}
    </OpsShell>
  );
}

// ─── Portal Invite Panel ──────────────────────────────────────────────────────

const RUST  = "hsl(20,63%,47%)";
const GREEN = "hsl(145,50%,40%)";
const AMBER = "hsl(38,90%,50%)";

function PortalInvitePanel({
  client, inviteLoading, inviteConfirm, onSend, onCancelConfirm,
}: {
  client: ClientWithSubscription;
  inviteLoading: boolean;
  inviteConfirm: boolean;
  onSend: () => void;
  onCancelConfirm: () => void;
}) {
  const status: PortalInviteStatus = client.portal_invite_status ?? "not_invited";
  const cfg = PORTAL_INVITE_CONFIG[status];
  const isSignedUp = status === "signed_up";
  const isInvited  = status === "invited";

  return (
    <div style={{ backgroundColor: `${cfg.color}10`, border: `1px solid ${cfg.color}44`, padding: "14px 16px" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-[9px] tracking-[0.16em] uppercase" style={{ color: "hsl(var(--muted-foreground))" }}>Portal Account</div>
        <span
          className="font-mono text-[9px] tracking-[0.1em] uppercase px-2 py-1"
          style={{ border: `1px solid ${cfg.color}`, color: cfg.color }}
        >
          {cfg.label}
        </span>
      </div>

      {isSignedUp && (
        <p className="font-mono text-[10px] tracking-[0.06em]" style={{ color: GREEN }}>
          \u2713 Client has created their portal account.
        </p>
      )}

      {!isSignedUp && (
        <>
          {isInvited && client.portal_invite_sent_at && (
            <p className="font-mono text-[9px] tracking-[0.06em] mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>
              Invite sent {formatDate(client.portal_invite_sent_at)} \u00b7 awaiting signup
            </p>
          )}

          {inviteConfirm ? (
            <div style={{ border: `1px solid ${AMBER}66`, padding: "10px 12px", backgroundColor: `${AMBER}0f` }}>
              <p className="font-mono text-[9px] tracking-[0.08em] mb-3" style={{ color: AMBER }}>
                {isInvited
                  ? `Resend invite to ${client.email}?`
                  : `Send portal signup link to ${client.email}?`}
              </p>
              <div className="flex gap-2">
                <button onClick={onSend} disabled={inviteLoading}
                  className="font-mono text-[10px] tracking-[0.12em] uppercase px-4 py-2 transition-opacity disabled:opacity-40"
                  style={{ backgroundColor: AMBER, color: "hsl(0,0%,10%)", border: "none", cursor: inviteLoading ? "not-allowed" : "pointer" }}
                >{inviteLoading ? "Sending\u2026" : "Confirm Send"}</button>
                <button onClick={onCancelConfirm} disabled={inviteLoading}
                  className="font-mono text-[10px] tracking-[0.12em] uppercase px-4 py-2 transition-opacity disabled:opacity-40"
                  style={{ border: `1px solid hsl(var(--border))`, color: "hsl(var(--muted-foreground))", background: "none", cursor: "pointer" }}
                >Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={onSend} disabled={inviteLoading}
              className="font-mono text-[10px] tracking-[0.12em] uppercase px-4 py-2 transition-opacity disabled:opacity-40"
              style={{
                backgroundColor: isInvited ? "transparent" : "hsl(var(--navy))",
                color: isInvited ? AMBER : "hsl(38,33%,92%)",
                border: isInvited ? `1px solid ${AMBER}` : "none",
                cursor: inviteLoading ? "not-allowed" : "pointer",
              }}
            >
              {inviteLoading ? "Sending\u2026" : isInvited ? "Resend Invite" : "Send Portal Invite"}
            </button>
          )}

          <p className="font-mono text-[9px] tracking-[0.06em] mt-2" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.7 }}>
            Sends a magic link to {client.email} \u00b7 client sets their password on first login
          </p>
        </>
      )}
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

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
