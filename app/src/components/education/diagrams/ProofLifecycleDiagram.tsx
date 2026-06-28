/** Proof lifecycle — witness to accepted on-chain. */

export function ProofLifecycleDiagram() {
  return (
    <svg
      className="zk-diagram"
      viewBox="0 0 480 120"
      role="img"
      aria-label="Witness through circuit, UltraHonk prover, verifier contract, to accepted settlement"
    >
      <path className="zk-edge" d="M64 60 H120" />
      <path className="zk-edge" d="M160 60 H216" />
      <path className="zk-edge" d="M256 60 H312" />
      <path className="zk-edge" d="M352 60 H408" />

      {[
        { x: 8, label: 'Witness' },
        { x: 104, label: 'Circuit' },
        { x: 200, label: 'UltraHonk' },
        { x: 296, label: 'Verifier' },
        { x: 392, label: 'Accepted' },
      ].map(({ x, label }) => (
        <g key={label} className="zk-node" transform={`translate(${x}, 32)`}>
          <circle cx="28" cy="28" r="26" fill="#e8f4ff" stroke="#007dfc" strokeWidth="1.5" />
          <text className="zk-label" x="28" y="32" textAnchor="middle">
            {label}
          </text>
        </g>
      ))}
    </svg>
  );
}
