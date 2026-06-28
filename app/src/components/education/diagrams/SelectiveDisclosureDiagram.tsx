/** Selective disclosure — viewing key to auditor portal. */

export function SelectiveDisclosureDiagram() {
  return (
    <svg
      className="zk-diagram"
      viewBox="0 0 480 200"
      role="img"
      aria-label="User generates viewing key, auditor verifies claims without personal identity"
    >
      <path className="zk-edge" d="M80 100 H140" />
      <path className="zk-edge" d="M180 100 H240" />
      <path className="zk-edge" d="M280 100 H340" />
      <path className="zk-edge" d="M380 100 H440" />

      {[
        { x: 8, label: 'Receipt', sub: 'Sealed' },
        { x: 108, label: 'Viewing key', sub: 'Read-only' },
        { x: 208, label: 'Disclosure pack', sub: 'Claims only' },
        { x: 308, label: 'Auditor portal', sub: 'Verify' },
        { x: 408, label: 'Compliance', sub: 'No PII' },
      ].map(({ x, label, sub }) => (
        <g key={label} className="zk-node" transform={`translate(${x}, 72)`}>
          <rect width="72" height="56" rx="12" fill="#f6f9fc" stroke="#007dfc" strokeWidth="1.5" />
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

export const SELECTIVE_DISCLOSURE_TERMS = [
  {
    label: 'Viewing key',
    detail: '256-bit read-only capability token (lgvk_…). SHA-256 hashed for issuer lookup — not a wallet or passkey.',
  },
  {
    label: 'Disclosure pack',
    detail: 'Eligibility claims, public inputs, nullifier, and settlement tx — no legal name or government ID.',
  },
  {
    label: 'AuditorRegistry',
    detail: 'On-chain verify_viewing_key for platform auditors; user-generated keys use capability-token storage.',
  },
  {
    label: 'Selective disclosure',
    detail: 'Auditor confirms regulated facts against live Merkle roots and nullifier spent status.',
  },
];
