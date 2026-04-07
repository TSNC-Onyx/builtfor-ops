import { ReactNode } from "react";
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
  const logoStroke = theme === "dark" ? "hsl(38,33%,92%)" : "hsl(213,58%,27%)";

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "hsl(var(--background))" }}>
      <header className="h-14 flex items-center px-6 gap-8 sticky top-0 z-40"
        style={{ backgroundColor: "hsl(var(--nav-bg))", borderBottom: "1px solid hsl(var(--nav-border))" }}
      >
        <div className="flex items-center gap-2.5 mr-4">
          <svg className="w-7 h-7" viewBox="0 0 38 38" fill="none">
            <rect x="4" y="12" width="30" height="22" rx="2" fill="none" stroke={logoStroke} strokeWidth="2.2"/>
            <path d="M13 12V9C13 7.34 14.34 6 16 6H22C23.66 6 25 7.34 25 9V12" fill="none" stroke={logoStroke} strokeWidth="2.2"/>
            <text x="7" y="29" fontFamily="'Bebas Neue'" fontSize="16" fill={logoStroke} fontWeight="bold">BF</text>
          </svg>
          <span className="font-display text-[18px] tracking-[0.04em]" style={{ color: "hsl(var(--nav-text))" }}>BuiltFor Ops</span>
        </div>
        <nav className="flex gap-1 flex-1">
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
        <ThemeToggle />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
