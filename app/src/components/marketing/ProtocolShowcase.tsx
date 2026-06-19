import { useScrollReveal } from '../../hooks/useScrollReveal';
import { cn } from '../../lib/cn';

function Protocol25Diagram() {
  return (
    <svg viewBox="0 0 280 120" className="w-full h-auto" aria-hidden="true">
      <defs>
        <linearGradient id="p25-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c9f31d" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#007dfc" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      {/* BN254 pairing arcs */}
      <path d="M 40 90 Q 80 30 120 90" fill="none" stroke="#c9f31d" strokeWidth="2" opacity="0.8" />
      <path d="M 120 90 Q 160 30 200 90" fill="none" stroke="#c9f31d" strokeWidth="2" opacity="0.8" />
      <circle cx="40" cy="90" r="8" fill="#c9f31d" />
      <circle cx="120" cy="90" r="8" fill="#c9f31d" />
      <circle cx="200" cy="90" r="8" fill="#c9f31d" />
      <text x="120" y="55" textAnchor="middle" fill="#c9f31d" fontSize="11" fontWeight="600">
        BN254 pairing
      </text>
      {/* Poseidon hash blocks */}
      <rect x="20" y="12" width="36" height="24" rx="6" fill="url(#p25-grad)" stroke="rgba(255,255,255,0.2)" />
      <rect x="62" y="12" width="36" height="24" rx="6" fill="url(#p25-grad)" stroke="rgba(255,255,255,0.2)" />
      <rect x="104" y="12" width="36" height="24" rx="6" fill="url(#p25-grad)" stroke="rgba(255,255,255,0.2)" />
      <text x="140" y="28" fill="rgba(255,255,255,0.7)" fontSize="10">Poseidon2</text>
      {/* Verification check */}
      <path d="M 230 50 L 245 65 L 270 35" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" />
      <text x="250" y="90" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="10">Verified</text>
    </svg>
  );
}

function Protocol26Diagram() {
  return (
    <svg viewBox="0 0 280 120" className="w-full h-auto" aria-hidden="true">
      {/* Freeze shield */}
      <path
        d="M 60 25 L 60 55 Q 60 85 90 95 Q 120 85 120 55 L 120 25 Q 90 15 60 25 Z"
        fill="rgba(0,125,252,0.2)"
        stroke="#007dfc"
        strokeWidth="2"
      />
      <text x="90" y="58" textAnchor="middle" fill="#7ec8ff" fontSize="10" fontWeight="600">
        Freeze
      </text>
      {/* Compliance check */}
      <rect x="150" y="30" width="50" height="50" rx="10" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" />
      <path d="M 165 55 L 175 65 L 190 45" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" />
      <text x="175" y="92" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="9">Compliance</text>
      {/* Governance nodes */}
      <circle cx="230" cy="40" r="12" fill="rgba(201,243,29,0.2)" stroke="#c9f31d" strokeWidth="1.5" />
      <circle cx="250" cy="70" r="12" fill="rgba(201,243,29,0.2)" stroke="#c9f31d" strokeWidth="1.5" />
      <circle cx="210" cy="70" r="12" fill="rgba(201,243,29,0.2)" stroke="#c9f31d" strokeWidth="1.5" />
      <line x1="230" y1="40" x2="250" y2="70" stroke="#c9f31d" strokeWidth="1" opacity="0.5" />
      <line x1="230" y1="40" x2="210" y2="70" stroke="#c9f31d" strokeWidth="1" opacity="0.5" />
      <text x="230" y="100" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="9">Governance</text>
    </svg>
  );
}

export function ProtocolShowcase() {
  const { ref, visible } = useScrollReveal();

  return (
    <div ref={ref} className={cn('lg-reveal lg-protocol-grid', visible && 'lg-revealed')}>
      <div className="lg-protocol-premium lg-card-reveal">
        <div className="lg-protocol-premium-inner">
          <span className="lg-protocol-badge lg-protocol-badge-p25">Protocol 25 · X-Ray</span>
          <h3 className="mt-4 text-2xl font-semibold">Native ZK verification</h3>
          <p className="mt-2 text-sm text-white/75 leading-relaxed">
            Stellar host functions for BN254 pairing and Poseidon2 — UltraHonk proofs verified inside Soroban.
          </p>
          <div className="lg-protocol-diagram">
            <Protocol25Diagram />
          </div>
          {['BN254 multi-pairing check', 'Poseidon2 hash', 'On-chain proof verification'].map((f) => (
            <div key={f} className="lg-protocol-feature">
              <span className="lg-protocol-feature-dot" />
              {f}
            </div>
          ))}
        </div>
      </div>

      <div className="lg-protocol-premium lg-card-reveal" style={{ transitionDelay: '0.12s' }}>
        <div className="lg-protocol-premium-inner">
          <span className="lg-protocol-badge lg-protocol-badge-p26">Protocol 26 · Yardstick</span>
          <h3 className="mt-4 text-2xl font-semibold">Compliance enforcement</h3>
          <p className="mt-2 text-sm text-white/75 leading-relaxed">
            CAP-77 freeze narrative with contract-level enforcement for revoked and sanctioned holders.
          </p>
          <div className="lg-protocol-diagram">
            <Protocol26Diagram />
          </div>
          {['RwaToken.freeze', 'is_frozen checks', 'Governance-ready compliance'].map((f) => (
            <div key={f} className="lg-protocol-feature">
              <span className="lg-protocol-feature-dot" />
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
