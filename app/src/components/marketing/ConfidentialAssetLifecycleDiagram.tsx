import { useMemo } from 'react';
import { FlowDiagram, type FlowNode, type FlowPath } from './FlowDiagram';

const PATHS: FlowPath[] = [
  { from: 0, to: 1 },
  { from: 1, to: 2 },
  { from: 2, to: 3 },
  { from: 3, to: 4 },
  { from: 4, to: 5 },
];

const LAYER_COLORS = {
  setup: '#6366f1',
  shielded: '#007dfc',
  disclose: '#64748b',
};

const BANDS = [
  { x: 0, width: 300, label: 'SETUP', color: 'rgba(99,102,241,0.05)' },
  { x: 300, width: 320, label: 'SHIELDED (AMOUNTS HIDDEN)', color: 'rgba(0,125,252,0.05)' },
  { x: 620, width: 320, label: 'RECEIPT + DISCLOSURE', color: 'rgba(100,116,139,0.04)' },
];

export function ConfidentialAssetLifecycleDiagram({ assetKey }: { assetKey: 'eurc' | 'usdc' }) {
  const label = assetKey.toUpperCase();

  const nodes = useMemo<FlowNode[]>(
    () => [
      { id: 'register', label: `Register ${label}`, sub: 'Confidential account bound to session proof', x: 60, y: 200, layer: 'setup' },
      { id: 'shield', label: 'Shield', sub: `Public ${label} → Pedersen commitment`, x: 210, y: 100, layer: 'setup' },
      { id: 'merge', label: 'Merge', sub: 'Combine shielded notes into one balance', x: 380, y: 200, layer: 'shielded' },
      { id: 'transfer', label: 'Private transfer', sub: 'confidential_transfer — amount hidden on-chain', x: 550, y: 100, layer: 'shielded' },
      { id: 'receipt', label: 'Receipt', sub: 'Shielded-amount receipt sealed', x: 720, y: 200, layer: 'disclose' },
      { id: 'disclosure', label: 'Disclosure', sub: 'Optional viewing key → auditor decrypt', x: 880, y: 100, layer: 'disclose' },
    ],
    [label],
  );

  return (
    <FlowDiagram
      nodes={nodes}
      paths={PATHS}
      layerColors={LAYER_COLORS}
      bands={BANDS}
      viewBox="0 0 940 340"
      ariaLabel={`Confidential ${label} lifecycle: register, shield, merge, private transfer, receipt, and optional disclosure`}
    />
  );
}
