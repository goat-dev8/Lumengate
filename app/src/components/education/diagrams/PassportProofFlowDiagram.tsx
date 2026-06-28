/** Passport / eligibility proof flow — matches circuits/lumengate + browser prover. */

export function PassportProofFlowDiagram() {
  return (
    <svg
      className="zk-diagram"
      viewBox="0 0 480 200"
      role="img"
      aria-label="Flow from identity attributes through Noir circuit and UltraHonk to Soroban PolicyVerifier"
    >
      <defs>
        <linearGradient id="passport-node" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e8f4ff" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      <path className="zk-edge" d="M72 100 H128" />
      <path className="zk-edge" d="M168 100 H224" />
      <path className="zk-edge" d="M264 100 H320" />
      <path className="zk-edge" d="M360 100 H408" />

      {[
        { x: 24, label: 'Attributes', sub: 'Private witness' },
        { x: 120, label: 'Noir circuit', sub: 'Merkle + policy' },
        { x: 216, label: 'UltraHonk', sub: 'Browser prove' },
        { x: 312, label: 'Public inputs', sub: '6 × BN254' },
        { x: 408, label: 'PolicyVerifier', sub: 'Soroban' },
      ].map(({ x, label, sub }) => (
        <g key={label} className="zk-node" transform={`translate(${x}, 72)`}>
          <rect width="72" height="56" rx="12" fill="url(#passport-node)" stroke="#007dfc" strokeWidth="1.5" />
          <text className="zk-label" x="36" y="26" textAnchor="middle">
            {label}
          </text>
          <text className="zk-sublabel" x="36" y="42" textAnchor="middle">
            {sub}
          </text>
        </g>
      ))}
    </svg>
  );
}

export const PASSPORT_PROOF_TERMS = [
  {
    label: 'Noir',
    detail: 'Eligibility circuit in circuits/lumengate — proves Merkle membership and policy predicates without revealing attributes.',
  },
  {
    label: 'Poseidon2',
    detail: 'Nullifier derivation: Poseidon2(note_secret, policy_id, asset_id, action_id) in assetScope.ts and the circuit.',
  },
  {
    label: 'UltraHonk',
    detail: 'Barretenberg bb.js 0.87 prover in the browser (SyncUltraHonkBackend) — ~14,592-byte proof.',
  },
  {
    label: 'BN254',
    detail: 'Six 32-byte public inputs posted to PolicyVerifier on Soroban testnet.',
  },
  {
    label: 'Passkey',
    detail: 'WebAuthn secp256r1 signs SessionStore.set_proof — not used to hold assets.',
  },
  {
    label: 'Smart account',
    detail: 'C-address LumengateSmartAccount authorizes compliant settlement via CompliancePolicy.',
  },
];
