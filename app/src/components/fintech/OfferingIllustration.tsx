import type { LiveOffering } from '../../lib/offerings';

const CATEGORY_LABEL: Record<LiveOffering['category'], string> = {
  treasury: 'Tokenized treasury exposure',
  'real-estate': 'Commercial real estate token',
  'private-credit': 'Private credit note',
};

const OFFERING_IMAGES: Record<LiveOffering['category'], string> = {
  treasury: '/offerings/treasury-fund.png',
  'real-estate': '/offerings/real-estate-fund.png',
  'private-credit': '/offerings/private-credit.png',
};

export function OfferingIllustration({
  offering,
  className = 'h-40',
  variant = 'card',
}: {
  offering: LiveOffering;
  className?: string;
  variant?: 'card' | 'hero';
}) {
  const src = OFFERING_IMAGES[offering.category];

  return (
    <div className={`relative overflow-hidden ${variant === 'card' ? 'rounded-t-2xl' : 'rounded-2xl'} ${className}`}>
      <img
        src={src}
        alt=""
        className="h-full w-full object-cover object-center"
        loading="lazy"
        decoding="async"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent p-4 pt-16">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/85">
          {CATEGORY_LABEL[offering.category]}
        </span>
      </div>
    </div>
  );
}

function TreasuryIcon() {
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11 shrink-0" fill="none" aria-hidden>
      <defs>
        <linearGradient id="tb-bg" x1="0" y1="0" x2="44" y2="44">
          <stop offset="0%" stopColor="#0d9488" />
          <stop offset="100%" stopColor="#064e3b" />
        </linearGradient>
        <linearGradient id="tb-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <rect width="44" height="44" rx="12" fill="url(#tb-bg)" />
      <rect width="44" height="22" rx="12" fill="url(#tb-shine)" />
      {/* Bond certificate stack */}
      <rect x="9" y="14" width="14" height="18" rx="2" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.35)" strokeWidth="0.75" />
      <rect x="11" y="16" width="10" height="2" rx="1" fill="rgba(201,243,29,0.7)" />
      <rect x="11" y="20" width="8" height="1.5" rx="0.75" fill="rgba(255,255,255,0.4)" />
      <rect x="11" y="23" width="6" height="1.5" rx="0.75" fill="rgba(255,255,255,0.25)" />
      {/* Yield curve */}
      <path
        d="M24 28 L28 24 L32 26 L36 20 L38 22"
        stroke="#c9f31d"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="38" cy="22" r="2" fill="#c9f31d" />
      {/* Treasury pediment */}
      <path d="M26 30 L30 26 L34 30 Z" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" />
      <rect x="27" y="30" width="6" height="4" rx="0.5" fill="rgba(255,255,255,0.15)" />
    </svg>
  );
}

function RealEstateIcon() {
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11 shrink-0" fill="none" aria-hidden>
      <defs>
        <linearGradient id="re-bg" x1="0" y1="0" x2="44" y2="44">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#312e81" />
        </linearGradient>
        <linearGradient id="re-glow" x1="22" y1="8" x2="22" y2="36">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="44" height="44" rx="12" fill="url(#re-bg)" />
      <ellipse cx="22" cy="18" rx="14" ry="10" fill="url(#re-glow)" />
      {/* Central tower */}
      <rect x="17" y="12" width="10" height="22" rx="1" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.4)" strokeWidth="0.75" />
      {[0, 1, 2, 3].map((r) =>
        [0, 1].map((c) => (
          <rect
            key={`${r}-${c}`}
            x={19 + c * 4}
            y={15 + r * 4}
            width="2.5"
            height="2.5"
            rx="0.5"
            fill={r === 0 && c === 1 ? '#c9f31d' : 'rgba(129,140,248,0.6)'}
          />
        )),
      )}
      {/* Side buildings */}
      <rect x="8" y="22" width="7" height="12" rx="1" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.25)" strokeWidth="0.6" />
      <rect x="29" y="18" width="7" height="16" rx="1" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.6" />
      {/* Token link arc */}
      <path
        d="M12 34 Q22 30 32 34"
        stroke="rgba(129,140,248,0.6)"
        strokeWidth="1"
        strokeDasharray="2 2"
        fill="none"
      />
      <circle cx="12" cy="34" r="1.5" fill="#818cf8" />
      <circle cx="32" cy="34" r="1.5" fill="#818cf8" />
    </svg>
  );
}

function PrivateCreditIcon() {
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11 shrink-0" fill="none" aria-hidden>
      <defs>
        <linearGradient id="pc-bg" x1="0" y1="0" x2="44" y2="44">
          <stop offset="0%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
        <linearGradient id="pc-flow" x1="8" y1="22" x2="36" y2="22">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.3" />
          <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <rect width="44" height="44" rx="12" fill="url(#pc-bg)" />
      {/* Credit flow pipeline */}
      <path d="M8 22 H36" stroke="url(#pc-flow)" strokeWidth="2" strokeLinecap="round" />
      {/* LP node */}
      <circle cx="10" cy="22" r="4" fill="rgba(251,191,36,0.25)" stroke="#fbbf24" strokeWidth="1" />
      <text x="10" y="23.5" textAnchor="middle" fill="#fef3c7" fontSize="5" fontWeight="700" fontFamily="system-ui">
        LP
      </text>
      {/* SPV hub */}
      <circle cx="22" cy="22" r="6" fill="rgba(251,191,36,0.2)" stroke="#fbbf24" strokeWidth="1.25" />
      <circle cx="22" cy="22" r="2.5" fill="#fbbf24" />
      {/* Note output */}
      <circle cx="34" cy="22" r="4" fill="rgba(251,191,36,0.25)" stroke="#fbbf24" strokeWidth="1" />
      <path d="M32.5 22 L33.5 23 L35.5 21" stroke="#fef3c7" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      {/* Growth arc */}
      <path
        d="M10 32 Q22 26 34 30"
        stroke="rgba(254,243,199,0.5)"
        strokeWidth="1.25"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="34" cy="30" r="1.5" fill="#fef3c7" />
    </svg>
  );
}

const OFFERING_ICONS: Record<LiveOffering['category'], () => JSX.Element> = {
  treasury: TreasuryIcon,
  'real-estate': RealEstateIcon,
  'private-credit': PrivateCreditIcon,
};

export function OfferingIconBadge({ category }: { category: LiveOffering['category'] }) {
  const Icon = OFFERING_ICONS[category];
  return (
    <div className="shrink-0 shadow-lg shadow-black/10 ring-1 ring-white/10" style={{ borderRadius: 12 }}>
      <Icon />
    </div>
  );
}
