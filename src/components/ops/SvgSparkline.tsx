interface SparklineProps {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
}

export function SvgSparkline({ values, color = "hsl(var(--rust))", width = 80, height = 32, fill = false }: SparklineProps) {
  if (values.length < 2) {
    return <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height }} />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const xStep = width / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = i * xStep;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });
  const polyline = pts.join(" ");
  const fillPath = `M${pts[0]} L${pts.join(" L")} L${width},${height} L0,${height} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height }}>
      {fill && <path d={fillPath} fill={color} opacity="0.12" />}
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
