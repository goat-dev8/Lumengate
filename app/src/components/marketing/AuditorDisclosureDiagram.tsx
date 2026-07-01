import { ReceiptText, KeyRound, PackageOpen, Eye, ShieldCheck } from 'lucide-react';
import { FlowDiagram, zigzagPositions, type FlowNode, type FlowPath } from './FlowDiagram';

const VIEWBOX_WIDTH = 1120;
const POS = zigzagPositions(5, { width: VIEWBOX_WIDTH, marginX: 110, topY: 104, bottomY: 216 });

const NODES: FlowNode[] = [
  { id: 'receipt', label: 'Receipt', sub: 'Sealed at the moment of settlement', layer: 'user', icon: ReceiptText, ...POS[0] },
  { id: 'key', label: 'Viewing key', sub: '`lgvk_…` read-only capability token', layer: 'user', icon: KeyRound, ...POS[1] },
  { id: 'pack', label: 'Disclosure pack', sub: 'Claims and public inputs only — no personal data', layer: 'store', icon: PackageOpen, ...POS[2] },
  { id: 'portal', label: 'Auditor portal', sub: 'verifyAuditorInput() checks the disclosure pack', layer: 'auditor', icon: Eye, ...POS[3] },
  { id: 'compliance', label: 'Compliance', sub: 'Regulated fact confirmed, identity stays private', layer: 'auditor', icon: ShieldCheck, ...POS[4] },
];

const PATHS: FlowPath[] = [
  { from: 0, to: 1 },
  { from: 1, to: 2 },
  { from: 2, to: 3 },
  { from: 3, to: 4 },
];

const LAYER_COLORS = { user: '#6366f1', store: '#64748b', auditor: '#007dfc' };
const LAYER_LABELS = { user: 'Settling party', store: 'Issuer store', auditor: 'Auditor' };

const BANDS = [
  { x: 0, width: 440, label: 'SETTLING PARTY', color: 'rgba(99,102,241,0.06)' },
  { x: 440, width: 240, label: 'ISSUER STORE', color: 'rgba(100,116,139,0.05)' },
  { x: 680, width: VIEWBOX_WIDTH - 680, label: 'AUDITOR', color: 'rgba(0,125,252,0.06)' },
];

export function AuditorDisclosureDiagram() {
  return (
    <FlowDiagram
      nodes={NODES}
      paths={PATHS}
      layerColors={LAYER_COLORS}
      layerLabels={LAYER_LABELS}
      bands={BANDS}
      viewBox={`0 0 ${VIEWBOX_WIDTH} 320`}
      ariaLabel="Selective disclosure: a sealed receipt generates a viewing key, which unlocks a disclosure pack for the auditor portal to verify without exposing identity"
    />
  );
}
