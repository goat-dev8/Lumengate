/** Lumengate brand flow — matches landing page (#007dfc, #012b54, #c9f31d) */

const BRAND = {
  navy: '#012b54',
  brand: '#007dfc',
  text: '#31485f',
  muted: '#64748b',
  eth: '#627eea',
  accent: '#c9f31d',
  line: '#eef0f3',
};

type Step = {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  Icon: () => JSX.Element;
};

function IconEth() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path d="M12 2L4 7v10l8 5 8-5V7l-8-5z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function IconCredential() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IconProof() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}
function IconStellar() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path d="M12 2l2.5 7.5H22l-6 4.5 2.5 7.5L12 17l-6.5 4.5 2.5-7.5-6-4.5h7.5L12 2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}
function IconRwa() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path d="M4 18V6l8-3 8 3v12" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 18v-6h6v6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

const STEPS: Step[] = [
  { id: 'eth', title: 'Ethereum', subtitle: 'Issuer signs', color: BRAND.eth, Icon: IconEth },
  { id: 'cred', title: 'Credential', subtitle: 'Merkle anchored', color: BRAND.brand, Icon: IconCredential },
  { id: 'zk', title: 'ZK Proof', subtitle: 'Private verify', color: BRAND.brand, Icon: IconProof },
  { id: 'stellar', title: 'Stellar', subtitle: 'Policy check', color: BRAND.brand, Icon: IconStellar },
  { id: 'rwa', title: 'RWA Access', subtitle: 'Settle', color: BRAND.navy, Icon: IconRwa },
];

export function BrandFlowDiagram({
  variant = 'standard',
  animated = false,
  className = '',
}: {
  variant?: 'compact' | 'standard' | 'wide';
  animated?: boolean;
  className?: string;
}) {
  const isCompact = variant === 'compact';
  const isWide = variant === 'wide';

  return (
    <div
      className={`brand-flow ${isCompact ? 'brand-flow-compact' : ''} ${isWide ? 'brand-flow-wide' : ''} ${className}`}
      role="img"
      aria-label="Ethereum issuer to credential, ZK proof, Stellar verification, RWA access"
    >
      <div className="brand-flow-track" aria-hidden>
        <div className={`brand-flow-track-line ${animated ? 'brand-flow-track-animated' : ''}`} />
      </div>
      <ol className="brand-flow-steps">
        {STEPS.map((step, i) => {
          const Icon = step.Icon;
          return (
            <li key={step.id} className="brand-flow-step">
              <div
                className={`brand-flow-node ${animated ? 'brand-flow-node-pulse' : ''}`}
                style={{ animationDelay: animated ? `${i * 0.35}s` : undefined }}
              >
                <span className="brand-flow-node-bar" style={{ background: step.color }} />
                <span className="brand-flow-node-icon" style={{ color: step.color }}>
                  <Icon />
                </span>
              </div>
              <div className="brand-flow-copy">
                <span className="brand-flow-title">{step.title}</span>
                <span className="brand-flow-sub">{step.subtitle}</span>
              </div>
              {i < STEPS.length - 1 ? (
                <span className="brand-flow-arrow" aria-hidden>
                  <svg viewBox="0 0 24 12" className="h-3 w-6 text-[#007dfc]">
                    <path d="M0 6h18M14 2l6 4-6 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  </svg>
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
