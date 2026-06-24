import { useEffect, useState, useMemo } from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { cn } from '../../lib/cn';

const NODES = [
  { id: 'issuer', label: 'Issuer', sub: 'Checks eligibility', x: 70, y: 200, layer: 'off' },
  { id: 'credential', label: 'Passport', sub: 'Private access record', x: 200, y: 100, layer: 'off' },
  { id: 'wallet', label: 'Passkey account', sub: 'Authorizes settlement', x: 200, y: 300, layer: 'off' },
  { id: 'local', label: 'Browser', sub: 'Confirms eligibility', x: 380, y: 200, layer: 'local' },
  { id: 'ready', label: 'Ready', sub: 'One settlement', x: 520, y: 100, layer: 'local' },
  { id: 'check', label: 'Stellar', sub: 'Allows or blocks', x: 660, y: 200, layer: 'chain' },
  { id: 'settlement', label: 'Settlement', sub: 'Assets move', x: 820, y: 200, layer: 'chain' },
];

const PATHS: { from: number; to: number }[] = [
  { from: 0, to: 1 },
  { from: 0, to: 2 },
  { from: 1, to: 3 },
  { from: 2, to: 3 },
  { from: 3, to: 4 },
  { from: 4, to: 5 },
  { from: 5, to: 6 },
];

const LAYER_COLORS = {
  off: '#64748b',
  local: '#6366f1',
  chain: '#007dfc',
};

function pathD(from: number, to: number): string {
  const a = NODES[from];
  const b = NODES[to];
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2 - 30;
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
}

export function ArchitectureFlowSvg() {
  const { ref, visible } = useScrollReveal();
  const [hovered, setHovered] = useState<number | null>(null);
  const [activeNode, setActiveNode] = useState(0);

  useEffect(() => {
    if (hovered !== null) return undefined;
    const timer = setInterval(() => {
      setActiveNode((n) => (n + 1) % NODES.length);
    }, 3200);
    return () => clearInterval(timer);
  }, [hovered]);

  const focus = hovered ?? activeNode;

  const pathStates = useMemo(() => {
    return PATHS.map(({ from, to }) => ({
      d: pathD(from, to),
      lit: focus === from || focus === to,
    }));
  }, [focus]);

  return (
    <div ref={ref} className={cn('lg-reveal', visible && 'lg-revealed')}>
      <div className="lg-arch-svg-wrap lg-arch-svg-compact">
        <svg
          className="lg-arch-svg"
          viewBox="0 0 900 400"
          preserveAspectRatio="xMidYMid meet"
          onMouseLeave={() => setHovered(null)}
        >
          <defs>
            <linearGradient id="arch-flow-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#007dfc" />
              <stop offset="100%" stopColor="#c9f31d" />
            </linearGradient>
          </defs>

          <rect x="0" y="0" width="280" height="340" fill="rgba(100,116,139,0.04)" rx="8" />
          <rect x="280" y="0" width="240" height="340" fill="rgba(99,102,241,0.05)" rx="8" />
          <rect x="520" y="0" width="380" height="340" fill="rgba(0,125,252,0.05)" rx="8" />
          <text x="140" y="24" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="600">
            OFF-CHAIN
          </text>
          <text x="400" y="24" textAnchor="middle" fill="#6366f1" fontSize="10" fontWeight="600">
            BROWSER
          </text>
          <text x="710" y="24" textAnchor="middle" fill="#007dfc" fontSize="10" fontWeight="600">
            STELLAR
          </text>

          {pathStates.map(({ d, lit }, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={lit ? 'url(#arch-flow-grad)' : 'rgba(0,125,252,0.18)'}
              strokeWidth={lit ? 2.5 : 1.5}
              strokeDasharray={lit ? undefined : '6 5'}
              strokeLinecap="round"
              style={{ opacity: lit ? 1 : 0.55, transition: 'opacity 0.25s ease, stroke 0.25s ease' }}
            />
          ))}

          {/* Single always-on motion dot on main spine — no mount/unmount on hover */}
          <circle r="5" fill="#c9f31d" opacity="0.9">
            <animateMotion
              dur="5s"
              repeatCount="indefinite"
              path={pathD(3, 4) + ' L ' + NODES[5].x + ' ' + NODES[5].y + ' L ' + NODES[6].x + ' ' + NODES[6].y}
            />
          </circle>

          {NODES.map((node, i) => {
            const color = LAYER_COLORS[node.layer as keyof typeof LAYER_COLORS];
            const isHot = focus === i;
            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseEnter={() => setHovered(i)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x="-52"
                  y="-36"
                  width="104"
                  height="72"
                  rx="16"
                  fill="#fff"
                  stroke={isHot ? color : '#eef0f3'}
                  strokeWidth={isHot ? 2 : 1}
                  style={{ transition: 'stroke 0.2s ease, stroke-width 0.2s ease' }}
                />
                <circle cx="0" cy="-18" r="6" fill={color} />
                <text textAnchor="middle" y="4" fill="#012b54" fontSize="12" fontWeight="600">
                  {node.label}
                </text>
                <text textAnchor="middle" y="22" fill="#64748b" fontSize="9">
                  {node.sub}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="lg-arch-detail lg-card-reveal">
        <div className="lg-arch-detail-title">{NODES[focus]?.label}</div>
        <div className="lg-arch-detail-desc">{NODES[focus]?.sub}</div>
      </div>
    </div>
  );
}
