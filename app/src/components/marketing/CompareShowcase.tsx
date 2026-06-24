import { X, CheckCircle2 } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { cn } from '../../lib/cn';

const BAD = ['Name and DOB stored centrally', 'PII honeypot for attackers', 'Censorship chokepoint', 'On-chain correlation'];
const GOOD = ['Only eligibility is shared', 'Personal details stay off-chain', 'Each passport works once', 'Restricted accounts are blocked'];

export function CompareShowcase() {
  const { ref, visible } = useScrollReveal();

  return (
    <div ref={ref} className={cn('lg-reveal lg-compare-premium', visible && 'lg-revealed')}>
      <div className="lg-compare-side lg-compare-bad lg-card-reveal">
        <div className="lg-compare-icon-wrap bg-red-100">
          <X className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="mt-5 text-xl font-semibold text-[#b91c1c]">Traditional allowlist</h3>
        <p className="mt-2 text-sm text-[#64748b]">Centralized identity storage — high risk, low privacy.</p>
        <ul className="mt-6 space-y-4">
          {BAD.map((t) => (
            <li key={t} className="flex items-start gap-3 text-sm text-[#64748b]">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs text-red-600">
                ✗
              </span>
              {t}
            </li>
          ))}
        </ul>
      </div>

      <div className="lg-compare-side lg-compare-good lg-card-reveal" style={{ transitionDelay: '0.1s' }}>
        <div className="lg-compare-icon-wrap bg-emerald-100">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        </div>
        <h3 className="mt-5 text-xl font-semibold text-[#15803d]">Lumengate private access</h3>
        <p className="mt-2 text-sm text-[#31485f]">Confirm eligibility without putting identity details on the public ledger.</p>
        <ul className="mt-6 space-y-4">
          {GOOD.map((t) => (
            <li key={t} className="flex items-start gap-3 text-sm text-[#31485f]">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#15803d]" />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
