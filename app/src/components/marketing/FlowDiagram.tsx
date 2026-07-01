import { useEffect, useMemo, useState } from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { cn } from '../../lib/cn';

export type FlowNode = {
  id: string;
  label: string;
  sub: string;
  x: number;
  y: number;
  layer: string;
};

export type FlowPath = { from: number; to: number };

export type FlowBand = { x: number; width: number; label: string; color: string };

export type FlowDiagramProps = {
  nodes: FlowNode[];
  paths: FlowPath[];
  layerColors: Record<string, string>;
  bands?: FlowBand[];
  viewBox?: string;
  ariaLabel: string;
  intervalMs?: number;
  compact?: boolean;
};

function pathD(a: FlowNode, b: FlowNode): string {
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2 - 30;
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
}

/**
 * Shared interactive flow-diagram renderer used by every curated landing-page
 * diagram. Same scroll-reveal + hover-focus + auto-advance behavior as
 * ArchitectureFlowSvg, parameterized by nodes/paths/layers so each diagram
 * only needs to supply its own grounded data.
 */
export function FlowDiagram({
  nodes,
  paths,
  layerColors,
  bands,
  viewBox = '0 0 900 400',
  ariaLabel,
  intervalMs = 3200,
  compact = true,
}: FlowDiagramProps) {
  const { ref, visible } = useScrollReveal();
  const [hovered, setHovered] = useState<number | null>(null);
  const [activeNode, setActiveNode] = useState(0);

  useEffect(() => {
    if (hovered !== null) return undefined;
    const timer = setInterval(() => {
      setActiveNode((n) => (n + 1) % nodes.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [hovered, nodes.length, intervalMs]);

  const focus = hovered ?? activeNode;

  const pathStates = useMemo(() => {
    return paths.map(({ from, to }) => ({
      d: pathD(nodes[from], nodes[to]),
      lit: focus === from || focus === to,
    }));
  }, [focus, paths, nodes]);

  const motionD = useMemo(() => {
    if (nodes.length < 2) return '';
    return nodes.map((n, i) => `${i === 0 ? 'M' : 'L'} ${n.x} ${n.y}`).join(' ');
  }, [nodes]);

  return (
    <div ref={ref} className={cn('lg-reveal', visible && 'lg-revealed')} role="img" aria-label={ariaLabel}>
      <div className={cn('lg-arch-svg-wrap', compact && 'lg-arch-svg-compact')}>
        <svg
          className="lg-arch-svg"
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
          onMouseLeave={() => setHovered(null)}
        >
          <defs>
            <linearGradient id={`flow-grad-${ariaLabel.replace(/\s+/g, '-')}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#007dfc" />
              <stop offset="100%" stopColor="#c9f31d" />
            </linearGradient>
          </defs>

          {bands?.map((band) => (
            <g key={band.label}>
              <rect x={band.x} y="0" width={band.width} height="340" fill={band.color} rx="8" />
              <text x={band.x + band.width / 2} y="24" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="600">
                {band.label}
              </text>
            </g>
          ))}

          {pathStates.map(({ d, lit }, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={lit ? `url(#flow-grad-${ariaLabel.replace(/\s+/g, '-')})` : 'rgba(0,125,252,0.18)'}
              strokeWidth={lit ? 2.5 : 1.5}
              strokeDasharray={lit ? undefined : '6 5'}
              strokeLinecap="round"
              style={{ opacity: lit ? 1 : 0.55, transition: 'opacity 0.25s ease, stroke 0.25s ease' }}
            />
          ))}

          <circle r="5" fill="#c9f31d" opacity="0.9">
            <animateMotion dur={`${Math.max(4, nodes.length * 1.1)}s`} repeatCount="indefinite" path={motionD} />
          </circle>

          {nodes.map((node, i) => {
            const color = layerColors[node.layer] ?? '#007dfc';
            const isHot = focus === i;
            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseEnter={() => setHovered(i)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x="-56"
                  y="-36"
                  width="112"
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
        <div className="lg-arch-detail-title">{nodes[focus]?.label}</div>
        <div className="lg-arch-detail-desc">{nodes[focus]?.sub}</div>
      </div>
    </div>
  );
}
