import { FlowDiagram, type FlowNode, type FlowPath } from './FlowDiagram';

const NODES: FlowNode[] = [
  { id: 'receipt', label: 'Receipt', sub: 'Sealed at settlement', x: 70, y: 200, layer: 'user' },
  { id: 'key', label: 'Viewing key', sub: 'lgvk_… read-only capability', x: 260, y: 100, layer: 'user' },
  { id: 'pack', label: 'Disclosure pack', sub: 'Claims + public inputs, no PII', x: 470, y: 200, layer: 'store' },
  { id: 'portal', label: 'Auditor portal', sub: 'verifyAuditorInput checks the pack', x: 660, y: 100, layer: 'auditor' },
  { id: 'compliance', label: 'Compliance', sub: 'Regulated fact confirmed, identity stays private', x: 850, y: 200, layer: 'auditor' },
];

const PATHS: FlowPath[] = [
  { from: 0, to: 1 },
  { from: 1, to: 2 },
  { from: 2, to: 3 },
  { from: 3, to: 4 },
];

const LAYER_COLORS = {
  user: '#6366f1',
  store: '#64748b',
  auditor: '#007dfc',
};

const BANDS = [
  { x: 0, width: 380, label: 'SETTLING PARTY', color: 'rgba(99,102,241,0.05)' },
  { x: 380, width: 200, label: 'ISSUER STORE', color: 'rgba(100,116,139,0.04)' },
  { x: 580, width: 360, label: 'AUDITOR', color: 'rgba(0,125,252,0.05)' },
];

export function AuditorDisclosureDiagram() {
  return (
    <FlowDiagram
      nodes={NODES}
      paths={PATHS}
      layerColors={LAYER_COLORS}
      bands={BANDS}
      viewBox="0 0 940 340"
      ariaLabel="Selective disclosure: a sealed receipt generates a viewing key, which unlocks a disclosure pack for the auditor portal to verify without exposing identity"
    />
  );
}
