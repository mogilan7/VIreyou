import React from "react";

export interface RadarPoint {
  label: string;
  value: number; // 0..100
}

export default function RadarChart({ points, size = 320 }: { points: RadarPoint[]; size?: number }) {
  const n = points.length;
  const c = size / 2;
  const R = size / 2 - 52;
  const ang = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const xy = (i: number, r: number) => [c + r * Math.cos(ang(i)), c + r * Math.sin(ang(i))];
  const ring = (f: number) =>
    points.map((_, i) => xy(i, R * f).map((v) => v.toFixed(1)).join(",")).join(" ");
  const poly = points
    .map((p, i) => xy(i, (R * Math.max(0, Math.min(100, p.value))) / 100).map((v) => v.toFixed(1)).join(","))
    .join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size }} role="img" aria-label="Radar chart">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={ring(f)} fill="none" stroke="#d6e2d3" strokeWidth={f === 0.5 ? 1.5 : 1} strokeDasharray={f === 0.5 ? "4 3" : undefined} />
      ))}
      {points.map((_, i) => {
        const [x, y] = xy(i, R);
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="#d6e2d3" />;
      })}
      <polygon points={poly} fill="rgba(76,140,88,0.28)" stroke="#3f7d4c" strokeWidth={2} />
      {points.map((p, i) => {
        const [x, y] = xy(i, (R * Math.max(0, Math.min(100, p.value))) / 100);
        const [lx, ly] = xy(i, R + 22);
        const anchor = Math.abs(lx - c) < 8 ? "middle" : lx > c ? "start" : "end";
        return (
          <g key={p.label}>
            <circle cx={x} cy={y} r={4} fill="#3f7d4c" />
            <text x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle" fontSize={11} fontWeight={600} fill="#1f3d2b">
              {p.label}
            </text>
            <text x={lx} y={ly + 13} textAnchor={anchor} dominantBaseline="middle" fontSize={10} fill="#6b7c70">
              {Math.round(p.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
