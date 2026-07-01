import { KeyRound, ShieldCheck, Landmark, ArrowRightLeft, ReceiptText } from 'lucide-react';
import { FlowDiagram, zigzagPositions, type FlowNode, type FlowPath } from './FlowDiagram';

const VIEWBOX_WIDTH = 1120;
const POS = zigzagPositions(5, { width: VIEWBOX_WIDTH, marginX: 110, topY: 104, bottomY: 216 });

const NODES: FlowNode[] = [
  { id: 'session', label: 'Session-signed request', sub: 'Smart account authorizes the transfer', layer: 'account', icon: KeyRound, ...POS[0] },
  { id: 'verify', label: 'PolicyVerifier', sub: 'verify_passport on a scoped nullifier (USDC = 2, EURC = 3)', layer: 'account', icon: ShieldCheck, ...POS[1] },
  { id: 'admin', label: 'ComplianceSacAdmin', sub: 'transfer_compliant / transfer_compliant_eurc', layer: 'chain', icon: Landmark, ...POS[2] },
  { id: 'sac', label: 'SAC transfer', sub: 'Amount, sender, and receiver visible on-chain', layer: 'chain', icon: ArrowRightLeft, ...POS[3] },
  { id: 'receipt', label: 'Receipt', sub: 'Public settlement recorded for compliance review', layer: 'chain', icon: ReceiptText, ...POS[4] },
];

const PATHS: FlowPath[] = [
  { from: 0, to: 1 },
  { from: 1, to: 2 },
  { from: 2, to: 3 },
  { from: 3, to: 4 },
];

const LAYER_COLORS = { account: '#6366f1', chain: '#007dfc' };
const LAYER_LABELS = { account: 'Smart account', chain: 'Stellar (public ledger)' };

const BANDS = [
  { x: 0, width: 440, label: 'SMART ACCOUNT', color: 'rgba(99,102,241,0.06)' },
  { x: 440, width: VIEWBOX_WIDTH - 440, label: 'STELLAR (PUBLIC LEDGER)', color: 'rgba(0,125,252,0.06)' },
];

export function PublicSettlementFlowDiagram() {
  return (
    <FlowDiagram
      nodes={NODES}
      paths={PATHS}
      layerColors={LAYER_COLORS}
      layerLabels={LAYER_LABELS}
      bands={BANDS}
      viewBox={`0 0 ${VIEWBOX_WIDTH} 320`}
      ariaLabel="Public settlement: a session-signed request is checked by PolicyVerifier, then ComplianceSacAdmin transfers USDC or EURC visibly on-chain and produces a receipt"
    />
  );
}
