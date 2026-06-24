/** Premium dashboard hero — Investor → Passport → ZK → Stellar → RWA */
export function DashboardFlowIllustration({ className = '' }: { className?: string }) {
  const steps = [
    { x: 60, label: 'Investor', sub: 'Qualified holder', color: '#64748b', accent: '#e2e8f0' },
    { x: 210, label: 'Passport', sub: 'Compliance ID', color: '#007dfc', accent: '#007dfc' },
    { x: 360, label: 'ZK Verify', sub: 'Private proof', color: '#627eea', accent: '#627eea' },
    { x: 510, label: 'Stellar', sub: 'On-chain settle', color: '#007dfc', accent: '#c9f31d' },
    { x: 660, label: 'RWA Access', sub: 'Token ownership', color: '#012b54', accent: '#012b54' },
  ];

  return (
    <svg viewBox="0 0 760 220" className={className} fill="none" aria-label="Compliance flow from investor to RWA ownership">
      <defs>
        <linearGradient id="flow-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f0f6ff" />
          <stop offset="50%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f8fbff" />
        </linearGradient>
        <linearGradient id="flow-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#007dfc" stopOpacity="0.2" />
          <stop offset="50%" stopColor="#007dfc" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#c9f31d" stopOpacity="0.6" />
        </linearGradient>
        <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="760" height="220" rx="20" fill="url(#flow-bg)" />
      <rect x="1" y="1" width="758" height="218" rx="19" stroke="rgba(0,125,252,0.1)" strokeWidth="1" />

      {/* Connection path */}
      <path
        d="M110 90 C160 90, 160 90, 160 90 L190 90"
        stroke="url(#flow-line)"
        strokeWidth="2"
        strokeDasharray="4 4"
        className="lg-flow-path"
      />
      <line x1="160" y1="90" x2="610" y2="90" stroke="url(#flow-line)" strokeWidth="2" />
      {[110, 260, 410, 560, 710].map((x, i) => (
        <g key={i}>
          <circle cx={x} cy="90" r="6" fill="#007dfc" opacity="0.3">
            <animate attributeName="opacity" values="0.3;0.8;0.3" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
          </circle>
        </g>
      ))}

      {steps.map((step, i) => (
        <g key={step.label} transform={`translate(${step.x - 50}, 28)`}>
          <rect
            x="0"
            y="0"
            width="100"
            height="124"
            rx="14"
            fill="#fff"
            stroke="rgba(0,125,252,0.12)"
            strokeWidth="1"
            filter={i === 1 || i === 4 ? 'url(#node-glow)' : undefined}
          />
          <rect x="0" y="0" width="100" height="4" rx="2" fill={step.accent} />
          <circle cx="50" cy="52" r="22" fill={`${step.color}15`} stroke={step.color} strokeWidth="1.5" />
          {i === 0 && (
            <g transform="translate(38, 40)">
              <circle cx="12" cy="8" r="6" fill={step.color} />
              <path d="M4 24c0-6 4-10 8-10s8 4 8 10" stroke={step.color} strokeWidth="2" fill="none" />
            </g>
          )}
          {i === 1 && (
            <g transform="translate(36, 38)">
              <rect x="4" y="4" width="20" height="16" rx="3" stroke={step.color} strokeWidth="1.5" fill="none" />
              <path d="M8 14l4 4 8-8" stroke={step.color} strokeWidth="1.5" strokeLinecap="round" />
            </g>
          )}
          {i === 2 && (
            <g transform="translate(38, 38)">
              <circle cx="12" cy="12" r="10" stroke={step.color} strokeWidth="1.5" />
              <circle cx="12" cy="12" r="4" fill={step.color} />
            </g>
          )}
          {i === 3 && (
            <g transform="translate(38, 38)">
              <path
                d="M12 2l3 9h9l-7 5 3 9-8-6-8 6 3-9-7-5h9z"
                stroke={step.color}
                strokeWidth="1.2"
                fill="none"
              />
            </g>
          )}
          {i === 4 && (
            <g transform="translate(36, 40)">
              <path d="M4 18V8l8-4 8 4v10" stroke={step.color} strokeWidth="1.5" fill="none" />
              <rect x="8" y="12" width="8" height="6" fill={step.color} opacity="0.3" />
            </g>
          )}
          <text x="50" y="98" textAnchor="middle" fill="#012b54" fontSize="11" fontWeight="600" fontFamily="system-ui">
            {step.label}
          </text>
          <text x="50" y="112" textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="system-ui">
            {step.sub}
          </text>
        </g>
      ))}

      <text x="380" y="200" textAnchor="middle" fill="#64748b" fontSize="10" fontFamily="system-ui">
        Private compliance path — issuer attestation → ZK proof → Stellar settlement
      </text>
    </svg>
  );
}
