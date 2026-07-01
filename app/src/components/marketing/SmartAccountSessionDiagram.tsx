import { Fingerprint, ShieldCheck, SlidersHorizontal, Clock, RefreshCw } from 'lucide-react';
import { FlowDiagram, zigzagPositions, type FlowNode, type FlowPath } from './FlowDiagram';

const VIEWBOX_WIDTH = 1120;
const POS = zigzagPositions(5, { width: VIEWBOX_WIDTH, marginX: 110, topY: 104, bottomY: 216 });

const NODES: FlowNode[] = [
  { id: 'passkey', label: 'Passkey', sub: 'WebAuthn secp256r1, device-bound authentication', layer: 'device', icon: Fingerprint, ...POS[0] },
  { id: 'account', label: 'Smart account', sub: 'LumengateSmartAccount enforces __check_auth on every operation', layer: 'account', icon: ShieldCheck, ...POS[1] },
  { id: 'context', label: 'Context rules', sub: 'Compliance policy + session-bound proof checked together', layer: 'account', icon: SlidersHorizontal, ...POS[2] },
  { id: 'session', label: '7-day session', sub: 'Delegated Ed25519 signer installed after eligibility confirms', layer: 'session', icon: Clock, ...POS[3] },
  { id: 'reuse', label: 'Reused everywhere', sub: 'Shield, merge, send, and marketplace settlement — no repeat prompts', layer: 'session', icon: RefreshCw, ...POS[4] },
];

const PATHS: FlowPath[] = [
  { from: 0, to: 1 },
  { from: 1, to: 2 },
  { from: 2, to: 3 },
  { from: 3, to: 4 },
];

const LAYER_COLORS = { device: '#64748b', account: '#007dfc', session: '#6366f1' };
const LAYER_LABELS = { device: 'Device', account: 'Smart account', session: 'Session' };

const BANDS = [
  { x: 0, width: 300, label: 'DEVICE', color: 'rgba(100,116,139,0.05)' },
  { x: 300, width: 420, label: 'SMART ACCOUNT', color: 'rgba(0,125,252,0.06)' },
  { x: 720, width: VIEWBOX_WIDTH - 720, label: 'SESSION', color: 'rgba(99,102,241,0.06)' },
];

export function SmartAccountSessionDiagram() {
  return (
    <FlowDiagram
      nodes={NODES}
      paths={PATHS}
      layerColors={LAYER_COLORS}
      layerLabels={LAYER_LABELS}
      bands={BANDS}
      viewBox={`0 0 ${VIEWBOX_WIDTH} 320`}
      ariaLabel="Passkey authorizes a smart account, which enforces context rules and installs a 7-day session reused across every settlement"
    />
  );
}
