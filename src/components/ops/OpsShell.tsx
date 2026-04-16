import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";
import { useTheme } from "@/hooks/useTheme";
import { useProfile, formatDisplayName } from "@/hooks/useProfile";
import { supabase } from "@/lib/supabase";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/pipeline", label: "Pipeline" },
  { to: "/clients", label: "Clients" },
  { to: "/billing", label: "Billing" },
];

const ROLE_DISPLAY: Record<string, string> = {
  platform_admin: "Platform Admin",
  tenant_owner:   "Chief Builder",
  manager:        "Manager",
  staff:          "Staff",
  portal_user:    "Portal User",
};

function roleLabel(role: string | null): string | null {
  if (!role) return null;
  return ROLE_DISPLAY[role] ?? role;
}

export function OpsShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { theme } = useTheme();
  const profile = useProfile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const logoStroke = theme === "dark" ? "hsl(38,33%,92%)" : "hsl(213,58%,27%)";

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  // Sign-out: call signOut() and let onAuthStateChange in AuthGate drive the
  // rest. SIGNED_OUT fires → AuthGate sets session = null → <Login /> renders.
  // No manual navigate() needed — avoids the same-route no-op and flash.
  async function handleLogout() {
    await supabase.auth.signOut();
  }

  const displayName = profile ? formatDisplayName(profile.full_name) : null;
  const role = profile?.role ?? null;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "hsl(var(--background))" }}>
      <header
        className="h-14 flex items-center px-4 gap-4 sticky top-0 z-40"
        style={{ backgroundColor: "hsl(var(--nav-bg))", borderBottom: "1px solid hsl(var(--nav-border))" }}
      >
        <button
          className="md:hidden flex flex-col justify-center gap-[5px] w-8 h-8 flex-shrink-0"
          onClick={() => setDrawerOpen(o => !o)}
          aria-label="Open navigation"
        >
          {[0, 1, 2].map(i => (
            <span key={i} className="block h-[2px] w-5 transition-all duration-200" style={{
              backgroundColor: "hsl(var(--nav-text))",
              transform: drawerOpen
                ? i === 0 ? "translateY(7px) rotate(45deg)" : i === 2 ? "translateY(-7px) rotate(-45deg)" : "scaleX(0)"
                : "none",
              opacity: drawerOpen && i === 1 ? 0 : 1,
            }} />
          ))}
        </button>

        <div className="flex items-center gap-2.5">
          <svg className="w-7 h-7 flex-shrink-0" viewBox="0 0 38 38" fill="none">
            <rect x="4" y="12" width="30" height="22" rx="0" fill="none" stroke={logoStroke} strokeWidth="2.2" />
            <path d="M13 12V9C13 7.34 14.34 6 16 6H22C23.66 6 25 7.34 25 9V12" fill="none" stroke={logoStroke} strokeWidth="2.2" />
            <text x="7" y="29" fontFamily="'Bebas Neue'" fontSize="16" fill={logoStroke} fontWeight="bold">BF</text>
          </svg>
          <span className="font-display text-[18px] tracking-[0.04em] hidden sm:inline" style={{ color: "hsl(var(--nav-text))" }}>BuiltFor Ops</span>
        </div>

        <nav className="hidden md:flex gap-1 flex-1">
          {NAV.map(n => (
            <Link key={n.to} to={n.to}
              className="font-mono text-[11px] tracking-[0.12em] uppercase px-3 py-1.5 transition-colors"
              style={{
                backgroundColor: pathname === n.to ? "hsl(var(--nav-active-bg))" : "transparent",
                color: pathname === n.to ? "hsl(var(--nav-active-text))" : "hsl(var(--nav-text-muted))",
              }}
            >{n.label}</Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {displayName && (
            <div className="hidden md:flex flex-col items-end gap-0">
              <span className="font-body text-[12px] leading-tight" style={{ color: "hsl(var(--nav-text-muted))", fontWeight: 500 }}>
                {displayName}
              </span>
              {role && (
                <span className="font-mono text-[9px] tracking-[0.12em] uppercase leading-tight" style={{ color: "hsl(var(--nav-text-muted))", opacity: 0.65 }}>
                  {roleLabel(role)}
                </span>
              )}
            </div>
          )}

          <ThemeToggle />

          <button
            onClick={handleLogout}
            aria-label="Sign out"
            title="Sign out"
            style={{
              width: "28px", height: "28px",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "none", border: "none", cursor: "pointer", padding: 0,
              color: "hsl(var(--nav-text-muted))", opacity: 0.55,
              transition: "opacity 0.15s ease",
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "0.55")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden" style={{ backgroundColor: "rgba(10,20,40,0.5)" }} onClick={() => setDrawerOpen(false)} />
      )}

      <div className="fixed top-0 left-0 h-full z-50 md:hidden flex flex-col" style={{
        width: "240px",
        backgroundColor: "hsl(var(--nav-bg))",
        borderRight: "1px solid hsl(var(--nav-border))",
        transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.22s cubic-bezier(0.4,0,0.2,1)",
      }}>
        <div className="h-14 flex items-center px-5 gap-2.5 flex-shrink-0" style={{ borderBottom: "1px solid hsl(var(--nav-border))" }}>
          <svg className="w-7 h-7 flex-shrink-0" viewBox="0 0 38 38" fill="none">
            <rect x="4" y="12" width="30" height="22" rx="0" fill="none" stroke={logoStroke} strokeWidth="2.2" />
            <path d="M13 12V9C13 7.34 14.34 6 16 6H22C23.66 6 25 7.34 25 9V12" fill="none" stroke={logoStroke} strokeWidth="2.2" />
            <text x="7" y="29" fontFamily="'Bebas Neue'" fontSize="16" fill={logoStroke} fontWeight="bold">BF</text>
          </svg>
          <span className="font-display text-[18px] tracking-[0.04em]" style={{ color: "hsl(var(--nav-text))" }}>BuiltFor Ops</span>
        </div>
        <nav className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
          {NAV.map(n => (
            <Link key={n.to} to={n.to}
              className="font-mono text-[11px] tracking-[0.12em] uppercase px-4 py-3 transition-colors"
              style={{
                backgroundColor: pathname === n.to ? "hsl(var(--nav-active-bg))" : "transparent",
                color: pathname === n.to ? "hsl(var(--nav-active-text))" : "hsl(var(--nav-text-muted))",
              }}
            >{n.label}</Link>
          ))}
        </nav>
        <div className="flex-shrink-0 px-5 py-4" style={{ borderTop: "1px solid hsl(var(--nav-border))" }}>
          {profile ? (
            <>
              <div className="font-body text-[13px] leading-tight" style={{ color: "hsl(var(--nav-text))", fontWeight: 500 }}>{profile.full_name}</div>
              <div className="font-mono text-[9px] tracking-[0.12em] uppercase mt-0.5" style={{ color: "hsl(var(--nav-text-muted))", opacity: 0.7 }}>{roleLabel(profile.role)}</div>
            </>
          ) : (
            <>
              <div className="h-3 w-28 animate-pulse" style={{ backgroundColor: "hsl(var(--nav-border))" }} />
              <div className="h-2 w-16 mt-1.5 animate-pulse" style={{ backgroundColor: "hsl(var(--nav-border))" }} />
            </>
          )}
          <button
            onClick={handleLogout}
            style={{
              marginTop: "12px", display: "flex", alignItems: "center", gap: "6px",
              background: "none", border: "none", cursor: "pointer", padding: 0,
              color: "hsl(var(--nav-text-muted))", opacity: 0.6,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="font-mono text-[9px] tracking-[0.12em] uppercase">Sign out</span>
          </button>
        </div>
      </div>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
