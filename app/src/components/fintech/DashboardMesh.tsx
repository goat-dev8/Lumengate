export function DashboardMesh({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`pointer-events-none absolute inset-0 z-0 h-full w-full ${className}`}
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 1200 400"
      aria-hidden
    >
      <defs>
        <radialGradient id="mesh-a" cx="20%" cy="30%" r="50%">
          <stop offset="0%" stopColor="#f0f6ff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#f0f6ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mesh-b" cx="55%" cy="20%" r="45%">
          <stop offset="0%" stopColor="#007dfc" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#007dfc" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mesh-c" cx="85%" cy="40%" r="40%">
          <stop offset="0%" stopColor="#c9f31d" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#c9f31d" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="400" fill="#ffffff" />
      <ellipse cx="240" cy="120" rx="320" ry="180" fill="url(#mesh-a)" />
      <ellipse cx="660" cy="80" rx="380" ry="200" fill="url(#mesh-b)" />
      <ellipse cx="1020" cy="160" rx="260" ry="140" fill="url(#mesh-c)" />
    </svg>
  );
}

export function DashboardHeroVisual({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 420 280" className={className} fill="none" aria-hidden>
      <defs>
        <linearGradient id="card-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#012b54" />
          <stop offset="100%" stopColor="#007dfc" />
        </linearGradient>
        <filter id="card-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="12" stdDeviation="16" floodColor="#012b54" floodOpacity="0.15" />
        </filter>
      </defs>
      <g filter="url(#card-shadow)">
        <rect x="40" y="30" width="340" height="220" rx="16" fill="url(#card-grad)" />
        <rect x="60" y="50" width="120" height="8" rx="4" fill="white" opacity="0.25" />
        <rect x="60" y="68" width="80" height="6" rx="3" fill="white" opacity="0.15" />
        <rect x="60" y="100" width="300" height="48" rx="8" fill="white" opacity="0.08" />
        <rect x="72" y="112" width="60" height="6" rx="3" fill="#007dfc" opacity="0.9" />
        <circle cx="330" cy="124" r="14" fill="#c9f31d" opacity="0.5" />
        <path d="M324 124l4 4 8-8" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <text x="72" y="192" fill="white" opacity="0.5" fontSize="10" fontFamily="system-ui">Compliance</text>
        <text x="72" y="210" fill="white" fontSize="14" fontWeight="600" fontFamily="system-ui">Verified</text>
        <text x="232" y="192" fill="white" opacity="0.5" fontSize="10" fontFamily="system-ui">RWA Access</text>
        <text x="232" y="210" fill="#c9f31d" fontSize="14" fontWeight="600" fontFamily="system-ui">Active</text>
      </g>
    </svg>
  );
}
