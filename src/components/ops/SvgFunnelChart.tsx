import { useMemo } from "react";

interface FunnelStep {
  label: string;
  count: number;
  color: string;
}

export function SvgFunnelChart({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(...steps.map(s => s.count), 1);
  const barH = 28;
  const gap = 6;
  const labelW = 108;
  const countW = 36;
  const totalH = steps.length * (barH + gap);
  const barAreaW = 260;

  return (
    <svg
      viewBox={`0 0 ${labelW + barAreaW + countW + 8} ${totalH}`}
      style={{ width: "100%", overflow: "visible" }}
    >
      {steps.map((s, i) => {
        const barW = max > 0 ? Math.max(4, (s.count / max) * barAreaW) : 4;
        const y = i * (barH + gap);
        return (
          <g key={s.label}>
            <text
              x={labelW - 6}
              y={y + barH / 2 + 4}
              textAnchor="end"
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: "9px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fill: "hsl(var(--muted-foreground))",
              }}
            >
              {s.label}
            </text>
            <rect x={labelW} y={y} width={barAreaW} height={barH}
              fill="hsl(var(--surface-raised))" />
            <rect x={labelW} y={y} width={barW} height={barH}
              fill={s.color} opacity="0.85" />
            <text
              x={labelW + barAreaW + 6}
              y={y + barH / 2 + 4}
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: "16px",
                fill: "hsl(var(--foreground))",
              }}
            >
              {s.count}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
