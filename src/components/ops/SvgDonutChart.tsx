interface Slice { label: string; value: number; color: string; }

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polarToXY(cx, cy, r, startDeg);
  const e = polarToXY(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M${s.x},${s.y} A${r},${r},0,${large},1,${e.x},${e.y}`;
}

export function SvgDonutChart({ slices, size = 120, thickness = 26 }: { slices: Slice[]; size?: number; thickness?: number }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - thickness / 2;
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) {
    return (
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={thickness} />
        <text x={cx} y={cy + 5} textAnchor="middle" style={{ fontSize: "11px", fill: "hsl(var(--muted-foreground))", fontFamily: "'DM Sans'" }}>—</text>
      </svg>
    );
  }
  let cursor = 0;
  const arcs = slices.map(sl => {
    const deg = (sl.value / total) * 360;
    const start = cursor;
    const end = cursor + deg;
    cursor = end;
    return { ...sl, start, end, deg };
  });
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
      {arcs.map((a, i) => (
        <path
          key={i}
          d={describeArc(cx, cy, r, a.start, Math.min(a.end, a.start + 359.99))}
          fill="none"
          stroke={a.color}
          strokeWidth={thickness}
          strokeLinecap="butt"
        />
      ))}
    </svg>
  );
}
