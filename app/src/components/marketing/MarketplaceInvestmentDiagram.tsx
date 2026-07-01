import { FlowDiagram, type FlowNode, type FlowPath } from './FlowDiagram';

const NODES: FlowNode[] = [
  { id: 'browse', label: 'Browse offerings', sub: 'Treasury, real estate, private credit', x: 70, y: 200, layer: 'off' },
  { id: 'gates', label: 'Eligibility gates', sub: 'canSettle checks account + credential + policy', x: 230, y: 100, layer: 'off' },
  { id: 'proof', label: 'Proof', sub: 'UltraHonk eligibility proof, scoped nullifier', x: 400, y: 200, layer: 'local' },
  { id: 'session', label: 'Session', sub: 'Session-bound signer authorizes', x: 570, y: 100, layer: 'local' },
  { id: 'settlement', label: 'Settlement', sub: 'RwaToken · ComplianceSacAdmin · CompliantDex · CompliantPayroll', x: 740, y: 200, layer: 'chain' },
  { id: 'receipt', label: 'Receipt', sub: 'buildProofReceipt seals the settlement', x: 880, y: 100, layer: 'chain' },
];

const PATHS: FlowPath[] = [
  { from: 0, to: 1 },
  { from: 1, to: 2 },
  { from: 2, to: 3 },
  { from: 3, to: 4 },
  { from: 4, to: 5 },
];

const LAYER_COLORS = {
  off: '#64748b',
  local: '#6366f1',
  chain: '#007dfc',
};

const BANDS = [
  { x: 0, width: 300, label: 'ISSUER FIXTURES', color: 'rgba(100,116,139,0.04)' },
  { x: 300, width: 320, label: 'BROWSER', color: 'rgba(99,102,241,0.05)' },
  { x: 620, width: 320, label: 'STELLAR', color: 'rgba(0,125,252,0.05)' },
];

export function MarketplaceInvestmentDiagram() {
  return (
    <FlowDiagram
      nodes={NODES}
      paths={PATHS}
      layerColors={LAYER_COLORS}
      bands={BANDS}
      viewBox="0 0 940 360"
      ariaLabel="Marketplace investment: browse offerings, pass eligibility gates, prove eligibility, authorize with a session, settle, and receive a receipt"
    />
  );
}
