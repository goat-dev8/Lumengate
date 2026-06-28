/** Settlement privacy split — what stays local vs what reaches Stellar. */

export function SettlementPrivacyDiagram() {
  return (
    <svg
      className="zk-diagram"
      viewBox="0 0 480 220"
      role="img"
      aria-label="Private data stays in browser; proof hash and nullifier reach Stellar for verification"
    >
      <rect x="16" y="24" width="160" height="172" rx="16" fill="#f0f7ff" stroke="#007dfc" strokeWidth="1.5" />
      <text className="zk-label" x="96" y="52" textAnchor="middle">
        Your browser
      </text>
      <text className="zk-sublabel" x="96" y="68" textAnchor="middle">
        Private witness
      </text>
      <text className="zk-sublabel" x="96" y="100" textAnchor="middle">
        Name · DOB · ID
      </text>
      <text className="zk-sublabel" x="96" y="116" textAnchor="middle">
        note_secret
      </text>

      <rect x="304" y="24" width="160" height="172" rx="16" fill="#fff7ed" stroke="#f59e0b" strokeWidth="1.5" />
      <text className="zk-label" x="384" y="52" textAnchor="middle">
        Stellar ledger
      </text>
      <text className="zk-sublabel" x="384" y="68" textAnchor="middle">
        Public settlement
      </text>
      <text className="zk-sublabel" x="384" y="100" textAnchor="middle">
        from · to · amount
      </text>
      <text className="zk-sublabel" x="384" y="116" textAnchor="middle">
        nullifier · roots
      </text>

      <path className="zk-edge" d="M176 110 H240" />
      <g className="zk-node" transform="translate(208, 88)">
        <rect width="64" height="44" rx="10" fill="#ffffff" stroke="#007dfc" strokeWidth="1.5" />
        <text className="zk-label" x="32" y="20" textAnchor="middle">
          Proof
        </text>
        <text className="zk-sublabel" x="32" y="34" textAnchor="middle">
          UltraHonk
        </text>
      </g>

      <path className="zk-edge" d="M272 110 H304" />
    </svg>
  );
}

export const SETTLEMENT_PRIVACY_TERMS = [
  {
    label: 'Nullifier',
    detail: 'Scoped Poseidon2 hash spent once on PolicyVerifier — prevents double use without revealing identity.',
  },
  {
    label: 'Replay protection',
    detail: 'is_nullifier_spent persists on-chain per (policy_id, asset_id, action_id, nullifier).',
  },
  {
    label: 'Proof hash',
    detail: 'UltraHonk proof bytes bind eligibility; only public inputs and settlement details appear on ledger.',
  },
  {
    label: 'SessionStore',
    detail: 'Passkey binds proof digest before ComplianceSacAdmin.transfer_compliant executes.',
  },
  {
    label: 'Soroban verification',
    detail: 'PolicyVerifier.verify_and_record checks UltraHonk proof via deployed verifier contract.',
  },
  {
    label: 'Host functions',
    detail: 'WebAuthn verifier + policy enforce run inside smart account __check_auth.',
  },
];
