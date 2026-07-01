import { useEffect, useId, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { cn } from '../../lib/cn';

export type FlowNode = {
  id: string;
  label: string;
  sub: string;
  x: number;
  y: number;
  layer: string;
  icon?: LucideIcon;
};

export type FlowPath = { from: number; to: number };

export type FlowBand = { x: number; width: number; label: string; color: string; glow?: string };

export type FlowDiagramProps = {
  nodes: FlowNode[];
  paths: FlowPath[];
  layerColors: Record<string, string>;
  layerLabels?: Record<string, string>;
  bands?: FlowBand[];
  viewBox?: string;
  ariaLabel: string;
  compact?: boolean;
  cardWidth?: number;
  cardHeight?: number;
};

/** Evenly spaces `count` nodes left-to-right in a gentle two-row zigzag. */
export function zigzagPositions(
  count: number,
  opts: { width: number; marginX?: number; topY?: number; bottomY?: number; startHigh?: boolean } = { width: 960 },
): { x: number; y: number }[] {
  const { width, marginX = 90, topY = 108, bottomY = 216, startHigh = false } = opts;
  const usable = width - marginX * 2;
  const step = count > 1 ? usable / (count - 1) : 0;
  return Array.from({ length: count }, (_, i) => ({
    x: Math.round(marginX + step * i),
    y: (i % 2 === 0) === startHigh ? topY : bottomY,
  }));
}

function pathD(a: FlowNode, b: FlowNode): string {
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2 - 34;
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
}

/**
 * Premium interactive flow-diagram engine shared by every curated landing-page
 * diagram: glass HTML node cards rendered inside SVG via foreignObject, glowing
 * gradient connectors with continuously flowing particles, and a synced detail
 * panel — all driven by grounded nodes/paths/layers data per diagram.
 */
export function FlowDiagram({
  nodes,
  paths,
  layerColors,
  layerLabels,
  bands,
  viewBox = '0 0 960 340',
  ariaLabel,
  compact = true,
  cardWidth = 168,
  cardHeight = 92,
}: FlowDiagramProps) {
  const { ref, visible } = useScrollReveal();
  const [hovered, setHovered] = useState<number | null>(null);
  const [activeNode, setActiveNode] = useState(0);
  const uid = useId().replace(/[:]/g, '');

  useEffect(() => {
    if (hovered !== null) return undefined;
    const timer = setInterval(() => {
      setActiveNode((n) => (n + 1) % nodes.length);
    }, 3400);
    return () => clearInterval(timer);
  }, [hovered, nodes.length]);

  const focus = hovered ?? activeNode;

  const pathStates = useMemo(
    () =>
      paths.map(({ from, to }) => ({
        d: pathD(nodes[from], nodes[to]),
        lit: focus === from || focus === to,
        from,
        to,
      })),
    [focus, paths, nodes],
  );

  const routeD = useMemo(
    () => nodes.map((n, i) => `${i === 0 ? 'M' : 'L'} ${n.x} ${n.y}`).join(' '),
    [nodes],
  );

  const totalDur = Math.max(5, nodes.length * 1.3);
  const focusedNode = nodes[focus];

  return (
    <div ref={ref} className={cn('lg-reveal', visible && 'lg-revealed')} role="img" aria-label={ariaLabel}>
      <div className={cn('lg-flow-canvas', compact && 'lg-flow-canvas-compact')}>
        <div className="lg-flow-blob lg-flow-blob-a" aria-hidden="true" />
        <div className="lg-flow-blob lg-flow-blob-b" aria-hidden="true" />
        <div className="lg-flow-grid" aria-hidden="true" />

        <svg className="lg-flow-svg" viewBox={viewBox} preserveAspectRatio="xMidYMid meet" onMouseLeave={() => setHovered(null)}>
          <defs>
            <linearGradient id={`fg-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#007dfc" />
              <stop offset="100%" stopColor="#c9f31d" />
            </linearGradient>
            <filter id={`glow-${uid}`} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {bands?.map((band) => (
            <g key={band.label}>
              <rect x={band.x} y="6" width={band.width} height="290" rx="20" fill={band.color} />
              <text
                x={band.x + band.width / 2}
                y="26"
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="10"
                fontWeight="700"
                letterSpacing="1.5"
              >
                {band.label}
              </text>
            </g>
          ))}

          {pathStates.map(({ d, lit }, i) => (
            <path
              key={`base-${i}`}
              d={d}
              fill="none"
              stroke={lit ? `url(#fg-${uid})` : 'rgba(0,125,252,0.15)'}
              strokeWidth={lit ? 3 : 1.5}
              strokeDasharray={lit ? undefined : '2 7'}
              strokeLinecap="round"
              filter={lit ? `url(#glow-${uid})` : undefined}
              style={{ transition: 'opacity 0.3s ease, stroke 0.3s ease' }}
            />
          ))}

          {[0, 1, 2].map((i) => (
            <circle key={i} r="4.5" fill="#c9f31d" filter={`url(#glow-${uid})`}>
              <animateMotion
                dur={`${totalDur}s`}
                begin={`${(i * totalDur) / 3}s`}
                repeatCount="indefinite"
                path={routeD}
              />
            </circle>
          ))}

          {nodes.map((node, i) => {
            const color = layerColors[node.layer] ?? '#007dfc';
            const isHot = focus === i;
            const Icon = node.icon;
            return (
              <g key={node.id}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isHot ? 56 : 44}
                  fill={color}
                  opacity={isHot ? 0.16 : 0}
                  style={{ transition: 'r 0.4s ease, opacity 0.4s ease' }}
                />
                <foreignObject
                  x={node.x - cardWidth / 2}
                  y={node.y - cardHeight / 2}
                  width={cardWidth}
                  height={cardHeight}
                  style={{ overflow: 'visible' }}
                >
                  <div
                    onMouseEnter={() => setHovered(i)}
                    className={cn('lg-flow-node', isHot && 'lg-flow-node-active')}
                    style={{ borderColor: isHot ? color : undefined }}
                  >
                    <span className="lg-flow-node-icon" style={{ background: `linear-gradient(135deg, ${color}, ${color}99)` }}>
                      {Icon ? <Icon className="h-4 w-4 text-white" strokeWidth={2.25} /> : null}
                    </span>
                    <span className="lg-flow-node-label">{node.label}</span>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={focusedNode?.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="lg-flow-detail"
        >
          <span
            className="lg-flow-detail-icon"
            style={{
              background: `linear-gradient(135deg, ${layerColors[focusedNode?.layer ?? ''] ?? '#007dfc'}, ${layerColors[focusedNode?.layer ?? ''] ?? '#007dfc'}99)`,
            }}
          >
            {focusedNode?.icon ? <focusedNode.icon className="h-5 w-5 text-white" strokeWidth={2.25} /> : null}
          </span>
          <div>
            <div className="lg-flow-detail-title">
              {focusedNode?.label}
              {layerLabels?.[focusedNode?.layer ?? ''] ? (
                <span className="lg-flow-detail-tag">{layerLabels[focusedNode.layer]}</span>
              ) : null}
            </div>
            <div className="lg-flow-detail-desc">{focusedNode?.sub}</div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
