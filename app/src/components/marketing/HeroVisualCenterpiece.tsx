import { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, Cpu, ArrowRightLeft } from 'lucide-react';

const PHASES = [
  { id: 'credential', label: 'Credential', card: 0 },
  { id: 'proof', label: 'Proof', card: 1 },
  { id: 'verify', label: 'Verify', card: 2 },
  { id: 'transfer', label: 'Transfer', card: 3 },
] as const;

const NODES = [
  { id: 'issuer', label: 'Issuer', x: 80, y: 210, color: '#012b54' },
  { id: 'credential', label: 'Credential', x: 220, y: 120, color: '#007dfc' },
  { id: 'wallet', label: 'Wallet', x: 220, y: 300, color: '#007dfc' },
  { id: 'noir', label: 'Noir', x: 420, y: 210, color: '#6366f1' },
  { id: 'verifier', label: 'Verifier', x: 620, y: 210, color: '#007dfc' },
  { id: 'rwa', label: 'RWA', x: 820, y: 210, color: '#15803d' },
];

const EDGES: [number, number][] = [
  [0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [4, 5],
];

const FLOAT_CARDS = [
  {
    icon: KeyRound,
    label: 'Step 1',
    title: 'Credential signed',
    meta: 'Ed25519 · off-chain',
    type: 'proof' as const,
  },
  {
    icon: Cpu,
    label: 'Step 2',
    title: 'Proof generating',
    meta: 'UltraHonk · WASM',
    type: 'proof' as const,
  },
  {
    icon: ShieldCheck,
    label: 'Step 3',
    title: 'BN254 verified',
    meta: 'PolicyVerifier',
    type: 'verify' as const,
  },
  {
    icon: ArrowRightLeft,
    label: 'Step 4',
    title: 'Transfer settled',
    meta: 'RwaToken · Stellar',
    type: 'verify' as const,
  },
];

export function HeroVisualCenterpiece() {
  const [phase, setPhase] = useState(0);
  const [activeNode, setActiveNode] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhase((p) => (p + 1) % PHASES.length);
      setActiveNode((n) => (n + 1) % NODES.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  const activePhase = PHASES[phase];

  return (
    <div className="lg-hero-canvas lg-fade-up lg-fade-up-d4">
      <div className="lg-hero-canvas-bg">
        <div className="lg-hero-mesh" />
        <div className="lg-particles" aria-hidden="true">
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className="lg-particle"
              style={{
                left: `${8 + (i * 5.2) % 88}%`,
                top: `${12 + (i * 7.3) % 76}%`,
                animationDelay: `${i * 0.45}s`,
                animationDuration: `${6 + (i % 4)}s`,
              }}
            />
          ))}
        </div>

        {/* Desktop floating cards */}
        {FLOAT_CARDS.map((card, i) => {
          const Icon = card.icon;
          const isActive = activePhase.card === i;
          return (
            <div
              key={card.title}
              className={`lg-float-card lg-float-card-${i + 1} hidden md:block ${isActive ? 'lg-float-card-active' : ''}`}
            >
              <div className="lg-float-card-label">{card.label}</div>
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-[#007dfc]" />
                <span className="lg-float-card-title">{card.title}</span>
              </div>
              <div className="lg-float-card-meta">{card.meta}</div>
              {card.type === 'proof' && isActive ? (
                <div className="lg-proof-viz">
                  {[0, 1, 2, 3].map((b) => (
                    <div key={b} className="lg-proof-bar">
                      <div className="lg-proof-bar-fill" style={{ animationDelay: `${b * 0.15}s` }} />
                    </div>
                  ))}
                </div>
              ) : null}
              {card.type === 'verify' && isActive ? (
                <div className="lg-verify-pulse">
                  <span className="lg-verify-dot" />
                  On-chain ✓
                </div>
              ) : null}
            </div>
          );
        })}

        <svg
          className="lg-hero-flow-svg"
          viewBox="0 0 900 420"
          preserveAspectRatio="xMidYMid meet"
          aria-label="Lumengate compliance architecture flow"
        >
          <defs>
            <linearGradient id="lg-flow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#007dfc" />
              <stop offset="100%" stopColor="#c9f31d" />
            </linearGradient>
            <filter id="lg-glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {EDGES.map(([from, to], i) => {
            const a = NODES[from];
            const b = NODES[to];
            const midX = (a.x + b.x) / 2;
            const path = `M ${a.x} ${a.y} Q ${midX} ${(a.y + b.y) / 2 - 20} ${b.x} ${b.y}`;
            const lit = activeNode === from || activeNode === to;
            return (
              <path
                key={`${from}-${to}`}
                d={path}
                className={lit ? 'lg-flow-path-active' : 'lg-flow-path'}
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            );
          })}

          {NODES.map((node, i) => {
            const isActive = activeNode === i || activePhase.card === Math.min(i, 3);
            return (
              <g
                key={node.id}
                className={`lg-flow-node ${isActive ? 'lg-flow-node-active' : ''}`}
                transform={`translate(${node.x}, ${node.y})`}
              >
                <circle r="38" fill="#fff" stroke="#eef0f3" strokeWidth="1.5" />
                <circle
                  className="lg-flow-node-ring"
                  r="38"
                  fill="none"
                  stroke={isActive ? node.color : 'transparent'}
                  strokeWidth="2"
                />
                <circle r="28" fill={isActive ? `${node.color}18` : '#f8f9fb'} />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={node.color}
                  fontSize="11"
                  fontWeight="600"
                >
                  {node.label}
                </text>
              </g>
            );
          })}

          {/* Moving packet along main path */}
          <circle r="6" fill="#c9f31d" filter="url(#lg-glow)">
            <animateMotion
              dur="4s"
              repeatCount="indefinite"
              path="M 80 210 Q 150 165 220 120 Q 320 165 420 210 Q 520 210 620 210 Q 720 210 820 210"
            />
          </circle>
        </svg>

        {/* Mobile card grid */}
        <div className="lg-hero-canvas-mobile-cards md:hidden">
          {FLOAT_CARDS.map((card, i) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className={`lg-float-card ${activePhase.card === i ? 'lg-float-card-active' : ''}`}
                style={{ position: 'relative', animation: 'none' }}
              >
                <div className="lg-float-card-label">{card.label}</div>
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-[#007dfc]" />
                  <span className="lg-float-card-title text-xs">{card.title}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
