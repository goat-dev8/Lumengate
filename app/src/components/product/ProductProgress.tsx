import type { ProductStep } from '../../lib/productState';
import { cn } from '../../lib/utils';

export function ProductProgress({ steps, compact }: { steps: ProductStep[]; compact?: boolean }) {
  return (
    <nav
      aria-label="Lumengate progress"
      className={cn('rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-sm', compact && 'p-3')}
    >
      <ol className={cn('grid gap-2', compact ? 'sm:grid-cols-3' : 'sm:grid-cols-6')}>
        {steps.map((step) => (
          <li
            key={step.id}
            className={cn(
              'rounded-xl border px-3 py-2',
              step.state === 'complete' && 'border-emerald-200 bg-emerald-50/70',
              step.state === 'current' && 'border-brand-300 bg-brand-50/70 ring-1 ring-brand-200',
              step.state === 'upcoming' && 'border-slate-100 bg-slate-50/70 text-slate-muted',
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  step.state === 'complete' && 'bg-emerald-500',
                  step.state === 'current' && 'bg-brand',
                  step.state === 'upcoming' && 'bg-slate-300',
                )}
              />
              <p className="text-xs font-semibold text-navy">{step.label}</p>
            </div>
            {!compact ? <p className="mt-1 text-[11px] leading-snug text-slate-muted">{step.description}</p> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
