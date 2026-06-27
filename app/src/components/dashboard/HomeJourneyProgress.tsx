import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Fingerprint, Send, ShieldCheck, Sparkles } from 'lucide-react';
import type { ProductStep } from '../../lib/productState';
import { cn } from '../../lib/cn';

const STEP_ICONS = {
  connect: Fingerprint,
  verify: ShieldCheck,
  passport: Sparkles,
  invest: Send,
  receipt: CheckCircle2,
} as const;

type Props = {
  steps: ProductStep[];
};

export function HomeJourneyProgress({ steps }: Props) {
  const journeySteps = steps.slice(0, 4);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
      aria-label="Your journey"
      className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm backdrop-blur-xl md:p-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">How it works</p>
          <h2 className="mt-1 lg-font-display text-2xl tracking-tight text-[#012b54] md:text-3xl">
            Four steps to private investing
          </h2>
        </div>
        <p className="text-sm text-[#64748b]">Passkey → Passport → Verify → Send privately</p>
      </div>

      <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {journeySteps.map((step, index) => {
          const Icon = STEP_ICONS[step.id] ?? Circle;
          const isComplete = step.state === 'complete';
          const isCurrent = step.state === 'current';

          return (
            <motion.li
              key={step.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08 * index }}
              className={cn(
                'relative rounded-2xl border p-4 transition-all duration-300',
                isComplete && 'border-emerald-200/80 bg-emerald-50/50',
                isCurrent && 'border-[#007dfc]/30 bg-[#007dfc]/[0.06] shadow-[0_8px_30px_rgba(0,125,252,0.12)] ring-1 ring-[#007dfc]/20',
                !isComplete && !isCurrent && 'border-[var(--lg-border)] bg-white/80 opacity-80',
              )}
            >
              {index < journeySteps.length - 1 ? (
                <span
                  className="pointer-events-none absolute -right-2 top-1/2 hidden h-px w-4 -translate-y-1/2 bg-gradient-to-r from-[#007dfc]/40 to-transparent lg:block"
                  aria-hidden
                />
              ) : null}
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'grid h-10 w-10 place-items-center rounded-xl transition-colors',
                    isComplete && 'bg-emerald-500/15 text-emerald-600',
                    isCurrent && 'bg-[#007dfc]/15 text-[#007dfc]',
                    !isComplete && !isCurrent && 'bg-[var(--lg-muted-bg)] text-[#64748b]',
                  )}
                >
                  {isComplete ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#012b54]">{step.label}</p>
                  <p className="mt-0.5 text-xs text-[#64748b]">{step.description}</p>
                </div>
              </div>
              {isCurrent ? (
                <motion.div
                  layoutId="journey-progress"
                  className="mt-3 h-1 overflow-hidden rounded-full bg-[#007dfc]/10"
                >
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-[#007dfc] to-[#5eb0ff]"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 1.8, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
                  />
                </motion.div>
              ) : null}
            </motion.li>
          );
        })}
      </ol>
    </motion.section>
  );
}
