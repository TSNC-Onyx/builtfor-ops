import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";
import { useTheme } from "@/hooks/useTheme";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/pipeline", label: "Pipeline" },
  { to: "/clients", label: "Clients" },
];

export function OpsShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { theme } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const logoStroke = theme === "dark" ? "hsl(38,33%,92%)" : "hsl(213,58%,27%)";

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Lock body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "hsl(var(--background))" }}>
      {/* Sticky header */}
      <header
        className="h-14 flex items-center px-4 gap-4 sticky top-0 z-40"
        style={{ backgroundColor: "hsl(var(--nav-bg))", borderBottom: "1px solid hsl(var(--nav-border))" }}
      >
        {/* Hamburger — mobile only */}
        <button
          className="md:hidden flex flex-col justify-center gap-[5px] w-8 h-8 flex-shrink-0"
          onClick={() => setDrawerOpen(o => !o)}
          aria-label="Open navigation"
        >
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="block h-[2px] w-5 transition-all duration-200"
              style={{
                backgroundColor: "hsl(var(--nav-text))",
                transform: drawerOpen
                  ? i === 0 ? "translateY(7px) rotate(45deg)" : i === 2 ? "translateY(-7px) rotate(-45deg)" : "scaleX(0)"
                  : "none",
                opacity: drawerOpen && i === 1 ? 0 : 1,
              }}
            />
          ))}
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <svg className="w-7 h-7 flex-shrink-0" viewBox="0 0 38 38" fill="none">
            <rect x="4" y="12" width="30" height="22" rx="0" fill="none" stroke={logoStroke} strokeWidth="2.2" />
            <path d="M13 12V9C13 7.34 14.34 6 16 6H22C23.66 6 25 7.34 25 9V12" fill="none" stroke={logoStroke} strokeWidth="2.2" />
            <text x="7" y="29" fontFamily="'Bebas Neue'" fontSize="16" fill={logoStroke} fontWeight="bold">BF</text>
          </svg>
          <span className="font-display text-[18px] tracking-[0.04em] hidden sm:inline" style={{ color: "hsl(var(--nav-text))" }}>BuiltFor Ops</span>
        </div>

        {/* Desktop nav */}
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

        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          style={{ backgroundColor: "rgba(10,20,40,0.5)" }}
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer panel */}
      <div
        className="fixed top-0 left-0 h-full z-50 md:hidden flex flex-col transition-transform duration-250"
        style={{
          width: "240px",
          backgroundColor: "hsl(var(--nav-bg))",
          borderRight: "1px solid hsl(var(--nav-border))",
          transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.22s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <div className="h-14 flex items-center px-5 gap-2.5" style={{ borderBottom: "1px solid hsl(var(--nav-border))" }}>
          <svg className="w-7 h-7 flex-shrink-0" viewBox="0 0 38 38" fill="none">
            <rect x="4" y="12" width="30" height="22" rx="0" fill="none" stroke={logoStroke} strokeWidth="2.2" />
            <path d="M13 12V9C13 7.34 14.34 6 16 6H22C23.66 6 25 7.34 25 9V12" fill="none" stroke={logoStroke} strokeWidth="2.2" />
            <text x="7" y="29" fontFamily="'Bebas Neue'" fontSize="16" fill={logoStroke} fontWeight="bold">BF</text>
          </svg>
          <span className="font-display text-[18px] tracking-[0.04em]" style={{ color: "hsl(var(--nav-text))" }}>BuiltFor Ops</span>
        </div>
        <nav className="flex flex-col gap-1 p-3 flex-1">
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
      </div>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
