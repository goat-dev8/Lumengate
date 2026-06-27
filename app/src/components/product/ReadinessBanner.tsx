import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Pill } from '../design/Primitives';
import type { ProductReadiness } from '../../lib/productState';
import type { PassportPhase } from '../../lib/passportLifecycle';
import { phaseLabel } from '../../lib/passportLifecycle';
import { cn } from '../../lib/cn';

type Props = {
  readiness: ProductReadiness;
  phase: PassportPhase;
  readyToInvest: boolean;
  className?: string;
};

function phaseTone(phase: PassportPhase, ready: boolean): 'brand' | 'success' | 'warning' | 'neutral' {
  if (ready) return 'success';
  if (phase === 'proof-spent' || phase === 'expired') return 'warning';
  if (phase === 'passport-issued' || phase === 'proof-generated') return 'brand';
  return 'neutral';
}

function phaseBadgeLabel(phase: PassportPhase, ready: boolean): string {
  if (ready) return 'Verified · Ready to invest';
  if (phase === 'passport-issued') return 'Passport issued · Confirm eligibility';
  if (phase === 'proof-spent' || phase === 'expired') return 'Renew access';
  return phaseLabel(phase);
}

export function ReadinessBanner({ readiness, phase, readyToInvest, className }: Props) {
  const tone = readiness.tone === 'warning' ? 'warning' : phaseTone(phase, readyToInvest);
  const badge = phaseBadgeLabel(phase, readyToInvest);

  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-2xl border border-[var(--lg-border)] bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <Pill tone={tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : 'brand'}>
          {badge}
        </Pill>
        <p className="mt-2 text-base font-semibold text-[#012b54]">{readiness.title}</p>
        <p className="mt-1 max-w-xl text-sm text-[#64748b]">{readiness.description}</p>
      </div>
      {!readyToInvest || readiness.href !== '/app/marketplace' ? (
        <Link
          to={readiness.href}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#012b54] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#012b54]/90"
        >
          {readiness.cta}
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}
