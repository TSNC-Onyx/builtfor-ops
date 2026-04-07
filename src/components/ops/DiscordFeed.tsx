import { useState, useEffect } from "react";
import { useTheme } from "@/hooks/useTheme";

const GUILD_ID = "1491163323490762872";

export function DiscordFeed() {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Delay iframe mount until panel opens to avoid background network hit
  useEffect(() => {
    if (open && !mounted) setMounted(true);
  }, [open, mounted]);

  const widgetTheme = theme === "dark" ? "dark" : "light";
  const src = `https://discord.com/widget?id=${GUILD_ID}&theme=${widgetTheme}`;

  return (
    // Desktop only — hidden on mobile
    <div className="hidden md:block">
      {/* Sliding panel */}
      <div
        aria-label="Discord live feed"
        aria-hidden={!open}
        style={{
          position: "fixed",
          top: "56px", // clears the 14-unit (56px) sticky header
          right: 0,
          bottom: 0,
          width: "360px",
          zIndex: 45,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "hsl(var(--surface))",
          borderLeft: "1px solid hsl(var(--surface-border))",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: open ? "-4px 0 24px rgba(10,20,40,0.12)" : "none",
        }}
      >
        {/* Panel header */}
        <div
          style={{
            height: "44px",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            borderBottom: "1px solid hsl(var(--surface-border))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Discord blurple dot */}
            <span
              style={{
                display: "inline-block",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "#5865F2",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: "10px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              Discord — Live
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close Discord feed"
            style={{
              width: "28px",
              height: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "hsl(var(--muted-foreground))",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
            </svg>
          </button>
        </div>

        {/* Discord widget iframe */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          {mounted && (
            <iframe
              src={src}
              title="Discord live feed"
              sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                display: "block",
              }}
            />
          )}
        </div>
      </div>

      {/* Floating bubble button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? "Close Discord feed" : "Open Discord feed"}
        style={{
          position: "fixed",
          bottom: "28px",
          right: "28px",
          zIndex: 46,
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          backgroundColor: open ? "hsl(var(--surface-raised))" : "hsl(var(--surface))",
          border: "1px solid hsl(var(--surface-border))",
          boxShadow: "0 2px 12px rgba(10,20,40,0.10)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "background-color 0.15s ease, box-shadow 0.15s ease",
          padding: 0,
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(10,20,40,0.18)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 2px 12px rgba(10,20,40,0.10)";
        }}
      >
        {/* Discord logo mark */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.053a19.9 19.9 0 0 0 5.993 3.03.077.077 0 0 0 .084-.026c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
            fill="#5865F2"
          />
        </svg>
      </button>
    </div>
  );
}
