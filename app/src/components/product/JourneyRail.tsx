import { Link } from 'react-router-dom';
import type { JourneyStep } from '../../lib/journey';
import { cn } from '../../lib/utils';

type Props = {
  steps: JourneyStep[];
  compact?: boolean;
};

export function JourneyRail({ steps, compact }: Props) {
  return (
    <nav
      aria-label="Verification progress"
      className={cn(
        'rounded-2xl border border-slate-200/80 bg-white/80 p-4 backdrop-blur',
        compact && 'p-3',
      )}
    >
      <ol className={cn('flex flex-col gap-3', !compact && 'sm:grid sm:grid-cols-3 sm:gap-4 lg:grid-cols-6')}>
        {steps.map((step) => (
          <li key={step.id}>
            <Link
              to={step.href}
              className={cn(
                'block rounded-xl border px-3 py-2 transition-colors',
                step.state === 'complete' && 'border-emerald-200 bg-emerald-50/60',
                step.state === 'current' && 'border-brand-300 bg-brand-50/50 ring-1 ring-brand-200',
                step.state === 'upcoming' && 'border-slate-100 bg-slate-50/50 opacity-80',
              )}
            >
              <p className="text-xs font-semibold text-navy">{step.label}</p>
              {!compact && (
                <p className="mt-1 text-[11px] leading-snug text-slate-muted">{step.description}</p>
              )}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** @deprecated use JourneyRail */
export const DemoJourneyRail = JourneyRail;
