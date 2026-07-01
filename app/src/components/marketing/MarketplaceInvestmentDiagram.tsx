import { Compass, ShieldCheck, FileCheck, Clock, ArrowRightLeft, ReceiptText } from 'lucide-react';
import { FlowDiagram, zigzagPositions, type FlowNode, type FlowPath } from './FlowDiagram';

const VIEWBOX_WIDTH = 1160;
const POS = zigzagPositions(6, { width: VIEWBOX_WIDTH, marginX: 100, topY: 104, bottomY: 216 });

const NODES: FlowNode[] = [
  { id: 'browse', label: 'Browse offerings', sub: 'Treasury, real estate, and private credit from issuer fixtures', layer: 'off', icon: Compass, ...POS[0] },
  { id: 'gates', label: 'Eligibility gates', sub: 'canSettle checks account, credential, and policy match', layer: 'off', icon: ShieldCheck, ...POS[1] },
  { id: 'proof', label: 'Proof', sub: 'UltraHonk eligibility proof with a scoped nullifier', layer: 'local', icon: FileCheck, ...POS[2] },
  { id: 'session', label: 'Session', sub: 'Session-bound signer authorizes the settlement', layer: 'local', icon: Clock, ...POS[3] },
  { id: 'settlement', label: 'Settlement', sub: 'Routes to RwaToken, ComplianceSacAdmin, CompliantDex, or CompliantPayroll', layer: 'chain', icon: ArrowRightLeft, ...POS[4] },
  { id: 'receipt', label: 'Receipt', sub: 'buildProofReceipt() seals the settlement for compliance review', layer: 'chain', icon: ReceiptText, ...POS[5] },
];

const PATHS: FlowPath[] = [
  { from: 0, to: 1 },
  { from: 1, to: 2 },
  { from: 2, to: 3 },
  { from: 3, to: 4 },
  { from: 4, to: 5 },
];

const LAYER_COLORS = { off: '#64748b', local: '#6366f1', chain: '#007dfc' };
const LAYER_LABELS = { off: 'Issuer fixtures', local: 'Browser', chain: 'Stellar' };

const BANDS = [
  { x: 0, width: 380, label: 'ISSUER FIXTURES', color: 'rgba(100,116,139,0.05)' },
  { x: 380, width: 380, label: 'BROWSER', color: 'rgba(99,102,241,0.06)' },
  { x: 760, width: VIEWBOX_WIDTH - 760, label: 'STELLAR', color: 'rgba(0,125,252,0.06)' },
];

export function MarketplaceInvestmentDiagram() {
  return (
    <FlowDiagram
      nodes={NODES}
      paths={PATHS}
      layerColors={LAYER_COLORS}
      layerLabels={LAYER_LABELS}
      bands={BANDS}
      viewBox={`0 0 ${VIEWBOX_WIDTH} 320`}
      ariaLabel="Marketplace investment: browse offerings, pass eligibility gates, prove eligibility, authorize with a session, settle, and receive a receipt"
    />
  );
}
