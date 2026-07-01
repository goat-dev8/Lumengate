import { FlowDiagram, type FlowNode, type FlowPath } from './FlowDiagram';

const NODES: FlowNode[] = [
  { id: 'passkey', label: 'Passkey', sub: 'WebAuthn secp256r1, device-bound', x: 80, y: 200, layer: 'device' },
  { id: 'account', label: 'Smart account', sub: 'LumengateSmartAccount __check_auth', x: 260, y: 120, layer: 'account' },
  { id: 'context', label: 'Context rules', sub: 'Compliance policy + session-bound proof', x: 440, y: 200, layer: 'account' },
  { id: 'session', label: '7-day session', sub: 'Delegated Ed25519 signer installed', x: 620, y: 120, layer: 'session' },
  { id: 'reuse', label: 'Reused everywhere', sub: 'Shield · merge · send · marketplace — no repeat prompts', x: 800, y: 200, layer: 'session' },
];

const PATHS: FlowPath[] = [
  { from: 0, to: 1 },
  { from: 1, to: 2 },
  { from: 2, to: 3 },
  { from: 3, to: 4 },
];

const LAYER_COLORS = {
  device: '#64748b',
  account: '#007dfc',
  session: '#6366f1',
};

const BANDS = [
  { x: 0, width: 220, label: 'DEVICE', color: 'rgba(100,116,139,0.04)' },
  { x: 220, width: 340, label: 'SMART ACCOUNT', color: 'rgba(0,125,252,0.05)' },
  { x: 560, width: 340, label: 'SESSION', color: 'rgba(99,102,241,0.05)' },
];

export function SmartAccountSessionDiagram() {
  return (
    <FlowDiagram
      nodes={NODES}
      paths={PATHS}
      layerColors={LAYER_COLORS}
      bands={BANDS}
      viewBox="0 0 900 360"
      ariaLabel="Passkey authorizes a smart account, which enforces context rules and installs a 7-day session reused across every settlement"
    />
  );
}
