import { useEffect, useState, useCallback } from "react";
import { DrillDownPanel } from "@/components/ops/DrillDownPanel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ServiceState = "operational" | "degraded" | "outage" | "unknown";

interface ServiceStatus {
  name: string;
  state: ServiceState;
  description: string; // human-readable detail from the status page
  url: string;         // link to the vendor status page
  checkedAt: Date | null;
}

// ---------------------------------------------------------------------------
// Colour tokens — matched to brand spec
// ---------------------------------------------------------------------------
const STATE_COLOR: Record<ServiceState, string> = {
  operational: "hsl(145,50%,40%)",
  degraded:    "hsl(38,90%,50%)",
  outage:      "hsl(20,63%,47%)",  // rust
  unknown:     "hsl(216,21%,62%)", // steel
};

const STATE_LABEL: Record<ServiceState, string> = {
  operational: "Operational",
  degraded:    "Degraded",
  outage:      "Outage",
  unknown:     "Unknown",
};

// ---------------------------------------------------------------------------
// Status API fetchers
// Each vendor exposes a JSON status summary endpoint.
// Atlassian Statuspage (used by Supabase, Cloudflare, GitHub) returns:
//   { status: { indicator: "none"|"minor"|"major"|"critical" } }
// ---------------------------------------------------------------------------
function indicatorToState(indicator: string): ServiceState {
  if (indicator === "none")     return "operational";
  if (indicator === "minor")    return "degraded";
  if (indicator === "major")    return "outage";
  if (indicator === "critical") return "outage";
  return "unknown";
}

async function fetchAtlassianStatus(
  summaryUrl: string
): Promise<{ state: ServiceState; description: string }> {
  const res = await fetch(summaryUrl, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return { state: "unknown", description: "Status page unavailable" };
  const json = await res.json();
  const indicator: string = json?.status?.indicator ?? "";
  const description: string = json?.status?.description ?? "All systems operational";
  return { state: indicatorToState(indicator), description };
}

// ---------------------------------------------------------------------------
// Service definitions
// ---------------------------------------------------------------------------
const SERVICES: Omit<ServiceStatus, "state" | "description" | "checkedAt">[] = [
  {
    name: "Supabase",
    url: "https://status.supabase.com",
  },
  {
    name: "Cloudflare",
    url: "https://www.cloudflarestatus.com",
  },
  {
    name: "GitHub",
    url: "https://www.githubstatus.com",
  },
];

// Atlassian Statuspage summary JSON endpoints
const STATUS_ENDPOINTS: Record<string, string> = {
  Supabase:   "https://status.supabase.com/api/v2/status.json",
  Cloudflare: "https://www.cloudflarestatus.com/api/v2/status.json",
  GitHub:     "https://www.githubstatus.com/api/v2/status.json",
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
function usePlatformStatus(intervalMs = 60_000) {
  const [statuses, setStatuses] = useState<ServiceStatus[]>(
    SERVICES.map(s => ({ ...s, state: "unknown", description: "Checking…", checkedAt: null }))
  );
  const [isChecking, setIsChecking] = useState(false);

  const check = useCallback(async () => {
    setIsChecking(true);
    const results = await Promise.all(
      SERVICES.map(async s => {
        try {
          const { state, description } = await fetchAtlassianStatus(STATUS_ENDPOINTS[s.name]);
          return { ...s, state, description, checkedAt: new Date() } as ServiceStatus;
        } catch {
          return { ...s, state: "unknown" as ServiceState, description: "Check failed", checkedAt: new Date() };
        }
      })
    );
    setStatuses(results);
    setIsChecking(false);
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, intervalMs);
    return () => clearInterval(id);
  }, [check, intervalMs]);

  return { statuses, isChecking, refresh: check };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function PlatformStatus() {
  const { statuses, isChecking, refresh } = usePlatformStatus();
  const [open, setOpen] = useState(false);

  // Overall state = worst of the three
  const overallState: ServiceState = statuses.reduce<ServiceState>((worst, s) => {
    const rank: Record<ServiceState, number> = { operational: 0, unknown: 1, degraded: 2, outage: 3 };
    return rank[s.state] > rank[worst] ? s.state : worst;
  }, "operational");

  const lastChecked = statuses.find(s => s.checkedAt)?.checkedAt;
  const lastCheckedStr = lastChecked
    ? lastChecked.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <>
      {/* ── Compact status bar ── */}
      <div
        className="px-4 md:px-6 py-2.5 flex items-center justify-between gap-4"
        style={{
          backgroundColor: "hsl(var(--surface-raised))",
          borderBottom: "1px solid hsl(var(--surface-border))",
        }}
      >
        {/* Left: label + pills */}
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className="font-mono text-[8.5px] tracking-[0.14em] uppercase flex-shrink-0"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            Platform
          </span>

          {statuses.map(s => (
            <span
              key={s.name}
              className="flex items-center gap-1.5"
            >
              {/* Status dot */}
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
          ))}

          {/* Checking spinner */}
          {isChecking && (
            <span
              className="font-mono text-[8px] tracking-[0.1em] uppercase animate-pulse"
              style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}
            >
              checking…
            </span>
          )}
        </div>

        {/* Right: overall badge + expand */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {lastCheckedStr && (
            <span
              className="font-mono text-[8px] tracking-[0.08em] uppercase hidden md:block"
              style={{ color: "hsl(var(--muted-foreground))", opacity: 0.45 }}
            >
              {lastCheckedStr}
            </span>
          )}

          <span
            className="font-mono text-[8px] tracking-[0.1em] uppercase px-1.5 py-0.5"
            style={{
              color: STATE_COLOR[overallState],
              border: `1px solid ${STATE_COLOR[overallState]}40`,
            }}
          >
            {STATE_LABEL[overallState]}
          </span>

          <button
            onClick={() => setOpen(true)}
            className="font-mono text-[8px] tracking-[0.12em] uppercase transition-opacity hover:opacity-60"
            style={{ color: "hsl(var(--rust))" }}
          >
            details ↗
          </button>
        </div>
      </div>

      {/* ── Drill-down panel ── */}
      {open && (
        <DrillDownPanel title="Platform Status" onClose={() => setOpen(false)}>
          <div className="space-y-4">
            {/* Refresh + last checked */}
            <div className="flex items-center justify-between">
              <span
                className="font-mono text-[9px] tracking-[0.1em] uppercase"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                {lastCheckedStr ? `Last checked ${lastCheckedStr}` : "Checking…"}
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

            {/* Service rows */}
            {statuses.map(s => (
              <div
                key={s.name}
                className="flex items-start gap-3 px-3 py-3"
                style={{
                  backgroundColor: "hsl(var(--surface-raised))",
                  border: `1px solid ${STATE_COLOR[s.state]}30`,
                  borderLeft: `3px solid ${STATE_COLOR[s.state]}`,
                }}
              >
                {/* Dot */}
                <span
                  className="w-2 h-2 rounded-full mt-0.5 flex-shrink-0"
                  style={{ backgroundColor: STATE_COLOR[s.state] }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="font-mono text-[10px] tracking-[0.1em] uppercase font-semibold"
                      style={{ color: "hsl(var(--foreground))" }}
                    >
                      {s.name}
                    </span>
                    <span
                      className="font-mono text-[8px] tracking-[0.1em] uppercase flex-shrink-0"
                      style={{ color: STATE_COLOR[s.state] }}
                    >
                      {STATE_LABEL[s.state]}
                    </span>
                  </div>
                  <p
                    className="font-body text-[11px] mt-0.5"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                  >
                    {s.description}
                  </p>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[8px] tracking-[0.08em] uppercase mt-1 inline-block transition-opacity hover:opacity-60"
                    style={{ color: "hsl(var(--rust))" }}
                  >
                    {s.url.replace("https://", "")} ↗
                  </a>
                </div>
              </div>
            ))}

            {/* Footer note */}
            <p
              className="font-mono text-[8px] tracking-[0.08em] uppercase"
              style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}
            >
              Polled every 60 seconds via vendor Statuspage APIs.
              Alerts also route to Discord ops channel via webhook.
            </p>
          </div>
        </DrillDownPanel>
      )}
    </>
  );
}
