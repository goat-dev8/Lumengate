type Slice = { label: string; value: number; color: string };

export function PortfolioChart({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;
  const radius = 54;
  const cx = 64;
  const cy = 64;

  const arcs = slices.map((slice) => {
    const pct = slice.value / total;
    const angle = pct * 360;
    const start = offset;
    offset += angle;
    const startRad = ((start - 90) * Math.PI) / 180;
    const endRad = ((start + angle - 90) * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);
    const large = angle > 180 ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`;
    return { ...slice, d, pct };
  });

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
      <svg viewBox="0 0 128 128" className="h-36 w-36 shrink-0">
        {arcs.map((arc) => (
          <path key={arc.label} d={arc.d} fill={arc.color} opacity="0.9" />
        ))}
        <circle cx={cx} cy={cy} r="28" fill="white" />
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-navy text-[11px] font-semibold">
          {total}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="fill-slate-muted text-[8px]">
          units
        </text>
      </svg>
      <ul className="flex-1 space-y-3">
        {arcs.map((arc) => (
          <li key={arc.label} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: arc.color }} />
              <span className="text-slate-ink">{arc.label}</span>
            </div>
            <span className="font-medium text-navy">{Math.round(arc.pct * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
