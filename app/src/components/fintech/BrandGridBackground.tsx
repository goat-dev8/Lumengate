/** Lumengate branded grid + gradient wash — unique visual identity */
export function BrandGridBackground({ className = '' }: { className?: string }) {
  return (
    <div className={`lg-brand-grid ${className}`} aria-hidden>
      <svg className="lg-brand-grid-svg" preserveAspectRatio="none">
        <defs>
          <pattern id="lg-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M32 0H0V32" fill="none" stroke="rgba(0,125,252,0.06)" strokeWidth="0.5" />
          </pattern>
          <linearGradient id="lg-grid-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(246,249,252,0)" />
            <stop offset="100%" stopColor="#f6f9fc" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#lg-grid)" />
        <rect width="100%" height="100%" fill="url(#lg-grid-fade)" />
      </svg>
    </div>
  );
}
