import { useEffect, useState, useCallback, useRef } from "react";
import { DrillDownPanel } from "@/components/ops/DrillDownPanel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ServiceState = "operational" | "degraded" | "outage" | "fetch_error" | "pending";
type DisplayState = ServiceState | "loading";

interface ServiceStatus {
  name: string;
  state: ServiceState;
  description: string;
  url: string;
  live: boolean;
  latencyMs?: number;
  category: "platform" | "database" | "hosting" | "ci";
}

interface ProxyPayload {
  services: ServiceStatus[];
  checkedAt: string;
}

// ---------------------------------------------------------------------------
// Colour tokens — matched to brand spec
// ---------------------------------------------------------------------------
const STATE_COLOR: Record<DisplayState, string> = {
  operational: "hsl(145,50%,40%)",
  degraded:    "hsl(38,90%,50%)",
  outage:      "hsl(20,63%,47%)",
  fetch_error: "hsl(38,90%,50%)",
  pending:     "hsl(216,21%,62%)",
  loading:     "hsl(216,21%,62%)",
};

const STATE_LABEL: Record<DisplayState, string> = {
  operational: "Operational",
  degraded:    "Degraded",
  outage:      "Outage",
  fetch_error: "Unreachable",
  pending:     "Pending",
  loading:     "—",
};

const CATEGORY_LABEL: Record<ServiceStatus["category"], string> = {
  platform: "Platform",
  database: "Databases",
  hosting:  "Hosting",
  ci:       "CI / Deploy",
};

const PROXY_URL =
  "https://tsdcxvmywimqfpdkevdx.supabase.co/functions/v1/platform-status";

const STALE_THRESHOLD_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
function usePlatformStatus(intervalMs = 60_000) {
  const [statuses, setStatuses] = useState<ServiceStatus[] | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [proxyError, setProxyError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const check = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setIsChecking(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);
      const res = await fetch(PROXY_URL, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        setProxyError(`Proxy returned HTTP ${res.status}`);
      } else {
        const payload: ProxyPayload = await res.json();
        setStatuses(payload.services);
        setCheckedAt(new Date(payload.checkedAt));
        setProxyError(null);
      }
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "AbortError";
      setProxyError(isTimeout ? "Proxy timed out" : "Proxy unreachable");
    } finally {
      setIsChecking(false);
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, intervalMs);
    return () => clearInterval(id);
  }, [check, intervalMs]);

  const isStale =
    checkedAt !== null && Date.now() - checkedAt.getTime() > STALE_THRESHOLD_MS;

  return { statuses, checkedAt, isChecking, proxyError, isStale, refresh: check };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function worstState(statuses: ServiceStatus[]): DisplayState {
  const rank: Record<DisplayState, number> = {
    loading:     0,
    pending:     0,
    operational: 1,
    fetch_error: 2,
    degraded:    3,
    outage:      4,
  };
  return statuses
    .filter(s => s.state !== "pending")
    .reduce<DisplayState>((worst, s) => {
      return rank[s.state] > rank[worst] ? s.state : worst;
    }, "operational");
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function groupByCategory(statuses: ServiceStatus[]) {
  const order: ServiceStatus["category"][] = ["platform", "database", "hosting", "ci"];
  const map = new Map<ServiceStatus["category"], ServiceStatus[]>();
  for (const cat of order) map.set(cat, []);
  for (const s of statuses) map.get(s.category)?.push(s);
  return order.map(cat => ({ cat, items: map.get(cat) ?? [] })).filter(g => g.items.length > 0);
}

const SKELETON_NAMES = ["Supabase", "Cloudflare", "Ops DB", "Tenant DB", "getbuiltfor.com", "GitHub"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function PlatformStatus() {
  const { statuses, checkedAt, isChecking, proxyError, isStale, refresh } =
    usePlatformStatus();
  const [open, setOpen] = useState(false);

  const isLoading = statuses === null && !proxyError;

  const overallState: DisplayState = isLoading
    ? "loading"
    : proxyError
    ? "fetch_error"
    : worstState(statuses!);

  const barServices = statuses?.filter(s => s.state !== "pending") ?? [];

  // ── Right-side controls (badge + details) — shared between mobile and desktop
  const controls = (
    <div className="flex items-center gap-3 flex-shrink-0">
      {checkedAt && (
        <span
          className="font-mono text-[8px] tracking-[0.08em] uppercase hidden md:block"
          style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}
        >
          {fmtTime(checkedAt)}
        </span>
      )}
      {!isLoading && (
        <span
          className="font-mono text-[8px] tracking-[0.1em] uppercase px-1.5 py-0.5"
          style={{
            color: STATE_COLOR[overallState],
            border: `1px solid ${STATE_COLOR[overallState]}40`,
          }}
        >
          {STATE_LABEL[overallState]}
        </span>
      )}
      <button
        onClick={() => setOpen(true)}
        className="font-mono text-[8px] tracking-[0.12em] uppercase transition-opacity hover:opacity-60"
        style={{ color: "hsl(var(--rust))" }}
      >
        details ↗
      </button>
    </div>
  );

  return (
    <>
      {/* ── Compact status bar ──
          Mobile:  flex-col — pills span full width, controls pinned bottom-right
          Desktop: flex-row — single line, unchanged from before               */}
      <div
        className="px-4 md:px-6 py-2.5 flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4"
        style={{
          backgroundColor: "hsl(var(--surface-raised))",
          borderBottom: "1px solid hsl(var(--surface-border))",
        }}
      >
        {/* Pills row — spans full width on mobile, natural width on desktop */}
        <div className="flex items-center gap-3 flex-wrap flex-1">
          <span
            className="font-mono text-[8.5px] tracking-[0.14em] uppercase flex-shrink-0"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            Platform
          </span>

          {isLoading ? (
            SKELETON_NAMES.map(name => (
              <span key={name} className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse"
                  style={{ backgroundColor: STATE_COLOR.loading }}
                />
                <span
                  className="font-mono text-[8.5px] tracking-[0.08em] uppercase"
                  style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}
                >
                  {name}
                </span>
              </span>
            ))
          ) : proxyError ? (
            <span className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: STATE_COLOR.fetch_error }}
              />
              <span
                className="font-mono text-[8.5px] tracking-[0.08em] uppercase"
                style={{ color: STATE_COLOR.fetch_error }}
              >
                Check failed
              </span>
            </span>
          ) : (
            barServices.map(s => (
              <span key={s.name} className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: STATE_COLOR[s.state] }}
                />
                <span
                  className="font-mono text-[8.5px] tracking-[0.08em] uppercase"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  {s.name}
                </span>
              </span>
            ))
          )}

          {isChecking && (
            <span
              className="font-mono text-[8px] tracking-[0.1em] uppercase animate-pulse"
              style={{ color: "hsl(var(--muted-foreground))", opacity: 0.45 }}
            >
              checking…
            </span>
          )}

          {isStale && !isChecking && (
            <span
              className="font-mono text-[8px] tracking-[0.1em] uppercase"
              style={{ color: STATE_COLOR.degraded }}
            >
              stale
            </span>
          )}
        </div>

        {/* Controls — on mobile: right-aligned below pills; on desktop: inline right */}
        <div className="flex justify-end md:justify-start md:flex-shrink-0">
          {controls}
        </div>
      </div>

      {/* ── Drill-down panel ── */}
      {open && (
        <DrillDownPanel title="Platform Status" onClose={() => setOpen(false)}>
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span
                className="font-mono text-[9px] tracking-[0.1em] uppercase"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                {isLoading
                  ? "Checking…"
                  : checkedAt
                  ? `Last checked ${fmtTime(checkedAt)}${isStale ? " — stale" : ""}`
                  : "Check failed"}
              </span>
              <button
                onClick={refresh}
                disabled={isChecking}
                className="font-mono text-[8px] tracking-[0.12em] uppercase transition-opacity hover:opacity-60 disabled:opacity-30"
                style={{ color: "hsl(var(--rust))" }}
              >
                {isChecking ? "checking…" : "refresh ↺"}
              </button>
            </div>

            {proxyError && (
              <div
                className="px-3 py-2.5"
                style={{
                  border: `1px solid ${STATE_COLOR.fetch_error}40`,
                  borderLeft: `3px solid ${STATE_COLOR.fetch_error}`,
                }}
              >
                <span
                  className="font-mono text-[9px] tracking-[0.1em] uppercase"
                  style={{ color: STATE_COLOR.fetch_error }}
                >
                  Proxy error — {proxyError}
                </span>
                <p
                  className="font-body text-[11px] mt-1"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  Status data unavailable. Check vendor status pages directly.
                </p>
              </div>
            )}

            {statuses &&
              groupByCategory(statuses).map(({ cat, items }) => (
                <div key={cat}>
                  <div
                    className="font-mono text-[8px] tracking-[0.14em] uppercase mb-2"
                    style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}
                  >
                    {CATEGORY_LABEL[cat]}
                  </div>
                  <div className="space-y-2">
                    {items.map(s => (
                      <div
                        key={s.name}
                        className="flex items-start gap-3 px-3 py-3"
                        style={{
                          backgroundColor: "hsl(var(--surface-raised))",
                          border: `1px solid ${STATE_COLOR[s.state]}25`,
                          borderLeft: `3px solid ${STATE_COLOR[s.state]}`,
                        }}
                      >
                        <span
                          className="w-2 h-2 rounded-full mt-0.5 flex-shrink-0"
                          style={{ backgroundColor: STATE_COLOR[s.state] }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="font-mono text-[10px] tracking-[0.1em] uppercase"
                              style={{ color: "hsl(var(--foreground))" }}
                            >
                              {s.name}
                            </span>
                            <span
                              className="font-mono text-[8px] tracking-[0.1em] uppercase flex-shrink-0"
                              style={{ color: STATE_COLOR[s.state] }}
                            >
                              {s.state === "pending"
                                ? "Pending"
                                : s.live
                                ? STATE_LABEL[s.state]
                                : "Unreachable"}
                            </span>
                          </div>
                          <p
                            className="font-body text-[11px] mt-0.5"
                            style={{ color: "hsl(var(--muted-foreground))" }}
                          >
                            {s.description}
                          </p>
                          {s.url && (
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-[8px] tracking-[0.08em] uppercase mt-1 inline-block transition-opacity hover:opacity-60"
                              style={{ color: "hsl(var(--rust))" }}
                            >
                              {s.url.replace("https://", "")} ↗
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

            {isLoading &&
              SKELETON_NAMES.map(name => (
                <div
                  key={name}
                  className="px-3 py-3 animate-pulse"
                  style={{
                    backgroundColor: "hsl(var(--surface-raised))",
                    border: "1px solid hsl(var(--surface-border))",
                    borderLeft: `3px solid ${STATE_COLOR.loading}`,
                  }}
                >
                  <span
                    className="font-mono text-[10px] tracking-[0.1em] uppercase"
                    style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}
                  >
                    {name}
                  </span>
                </div>
              ))}

            <p
              className="font-mono text-[8px] tracking-[0.08em] uppercase"
              style={{ color: "hsl(var(--muted-foreground))", opacity: 0.35 }}
            >
              DB checks: live SELECT round-trip via Edge Function.
              Hosting: HEAD request to production URL.
              Platform: Atlassian Statuspage v2.
              Polled every 60s. Stale warning after 5 min.
            </p>
          </div>
        </DrillDownPanel>
      )}
    </>
  );
}
