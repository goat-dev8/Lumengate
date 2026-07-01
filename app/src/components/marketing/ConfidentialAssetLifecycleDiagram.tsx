import { useMemo } from 'react';
import { UserPlus, Lock, GitMerge, Send, ReceiptText, Eye } from 'lucide-react';
import { FlowDiagram, zigzagPositions, type FlowNode, type FlowPath } from './FlowDiagram';

const VIEWBOX_WIDTH = 1160;
const POS = zigzagPositions(6, { width: VIEWBOX_WIDTH, marginX: 100, topY: 104, bottomY: 216 });

const PATHS: FlowPath[] = [
  { from: 0, to: 1 },
  { from: 1, to: 2 },
  { from: 2, to: 3 },
  { from: 3, to: 4 },
  { from: 4, to: 5 },
];

const LAYER_COLORS = { setup: '#6366f1', shielded: '#007dfc', disclose: '#64748b' };
const LAYER_LABELS = { setup: 'Setup', shielded: 'Shielded', disclose: 'Auditor' };

const BANDS = [
  { x: 0, width: 380, label: 'SETUP', color: 'rgba(99,102,241,0.06)' },
  { x: 380, width: 380, label: 'SHIELDED (AMOUNTS HIDDEN)', color: 'rgba(0,125,252,0.06)' },
  { x: 760, width: VIEWBOX_WIDTH - 760, label: 'RECEIPT + DISCLOSURE', color: 'rgba(100,116,139,0.05)' },
];

export function ConfidentialAssetLifecycleDiagram({ assetKey }: { assetKey: 'eurc' | 'usdc' }) {
  const label = assetKey.toUpperCase();

  const nodes = useMemo<FlowNode[]>(
    () => [
      { id: 'register', label: `Register ${label}`, sub: 'Confidential account bound to the session proof', layer: 'setup', icon: UserPlus, ...POS[0] },
      { id: 'shield', label: 'Shield', sub: `Public ${label} converts into a Pedersen commitment`, layer: 'setup', icon: Lock, ...POS[1] },
      { id: 'merge', label: 'Merge', sub: 'Combine shielded notes into one private balance', layer: 'shielded', icon: GitMerge, ...POS[2] },
      { id: 'transfer', label: 'Private transfer', sub: 'confidential_transfer — amount hidden on-chain', layer: 'shielded', icon: Send, ...POS[3] },
      { id: 'receipt', label: 'Receipt', sub: 'Shielded-amount receipt sealed at settlement', layer: 'disclose', icon: ReceiptText, ...POS[4] },
      { id: 'disclosure', label: 'Disclosure', sub: 'Optional viewing key lets an auditor decrypt one transfer', layer: 'disclose', icon: Eye, ...POS[5] },
    ],
    [label],
  );

  return (
    <FlowDiagram
      nodes={nodes}
      paths={PATHS}
      layerColors={LAYER_COLORS}
      layerLabels={LAYER_LABELS}
      bands={BANDS}
      viewBox={`0 0 ${VIEWBOX_WIDTH} 320`}
      ariaLabel={`Confidential ${label} lifecycle: register, shield, merge, private transfer, receipt, and optional disclosure`}
    />
  );
}
