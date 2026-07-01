import { FlowDiagram, type FlowNode, type FlowPath } from './FlowDiagram';

const NODES: FlowNode[] = [
  { id: 'session', label: 'Session-signed request', sub: 'Smart account authorizes transfer', x: 80, y: 200, layer: 'account' },
  { id: 'verify', label: 'PolicyVerifier', sub: 'verify_passport, scoped nullifier (USDC=2, EURC=3)', x: 280, y: 100, layer: 'account' },
  { id: 'admin', label: 'ComplianceSacAdmin', sub: 'transfer_compliant / transfer_compliant_eurc', x: 480, y: 200, layer: 'chain' },
  { id: 'sac', label: 'SAC transfer', sub: 'Amount, sender, receiver visible on-chain', x: 680, y: 100, layer: 'chain' },
  { id: 'receipt', label: 'Receipt', sub: 'Public settlement recorded for compliance review', x: 860, y: 200, layer: 'chain' },
];

const PATHS: FlowPath[] = [
  { from: 0, to: 1 },
  { from: 1, to: 2 },
  { from: 2, to: 3 },
  { from: 3, to: 4 },
];

const LAYER_COLORS = {
  account: '#6366f1',
  chain: '#007dfc',
};

const BANDS = [
  { x: 0, width: 380, label: 'SMART ACCOUNT', color: 'rgba(99,102,241,0.05)' },
  { x: 380, width: 540, label: 'STELLAR (PUBLIC LEDGER)', color: 'rgba(0,125,252,0.05)' },
];

export function PublicSettlementFlowDiagram() {
  return (
    <FlowDiagram
      nodes={NODES}
      paths={PATHS}
      layerColors={LAYER_COLORS}
      bands={BANDS}
      viewBox="0 0 940 360"
      ariaLabel="Public settlement: a session-signed request is checked by PolicyVerifier, then ComplianceSacAdmin transfers USDC or EURC visibly on-chain and produces a receipt"
    />
  );
}
