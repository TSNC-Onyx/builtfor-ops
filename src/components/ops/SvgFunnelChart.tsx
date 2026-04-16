import { useMemo } from "react";

interface FunnelStep {
  label: string;
  count: number;
  color: string;
}

export function SvgFunnelChart({ steps }: { steps: FunnelStep[] }) {
  const max = useMemo(() => Math.max(...steps.map(s => s.count), 1), [steps]);
  const barH = 20;
  const gap = 10;
  const labelW = 96;
  const countW = 28;
  const barAreaW = 220;
  const totalW = labelW + barAreaW + countW + 14;
  const totalH = steps.length * (barH + gap) - gap;

  return (
    <svg
      viewBox={`0 0 ${totalW} ${totalH}`}
      style={{ width: "100%", display: "block", overflow: "visible" }}
    >
      {steps.map((s, i) => {
        const barW = max > 0 ? Math.max(3, (s.count / max) * barAreaW) : 3;
        const y = i * (barH + gap);
        const midY = y + barH / 2;
        return (
          <g key={s.label}>
            <text
              x={labelW - 8}
              y={midY + 3.5}
              textAnchor="end"
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: "8px",
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                fill: "hsl(var(--muted-foreground))",
              }}
            >
              {s.label}
            </text>
            <rect
              x={labelW} y={y}
              width={barAreaW} height={barH}
              fill="hsl(var(--surface-border))" opacity="0.3" rx="1"
            />
            <rect
              x={labelW} y={y}
              width={barW} height={barH}
              fill={s.color} opacity="0.9" rx="1"
            />
            <text
              x={labelW + barAreaW + 8}
              y={midY + 5.5}
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: "15px",
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
