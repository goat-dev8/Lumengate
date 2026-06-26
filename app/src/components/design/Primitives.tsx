import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem(props: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 14 },
        show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
      }}
      {...props}
    />
  );
}

export function StatusDot({ tone = 'success' }: { tone?: 'success' | 'warning' | 'neutral' }) {
  const color =
    tone === 'success'
      ? 'bg-emerald-500'
      : tone === 'warning'
        ? 'bg-amber-500'
        : 'bg-slate-400';
  return (
    <span className="relative inline-flex h-2 w-2">
      <span className={cn('absolute inset-0 rounded-full opacity-60 animate-ping', color)} />
      <span className={cn('relative inline-block h-2 w-2 rounded-full', color)} />
    </span>
  );
}

export function Pill({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'brand' | 'success' | 'warning';
  className?: string;
}) {
  const tones = {
    neutral: 'border-[var(--lg-border)] bg-[var(--lg-muted-bg)] text-[var(--lg-muted)]',
    brand: 'border-[#007dfc]/25 bg-[#007dfc]/10 text-[#007dfc]',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
  } as const;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#007dfc]">{eyebrow}</p>
        ) : null}
        <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-[#012b54] md:text-[28px]">{title}</h2>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-[#64748b]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: EASE },
} as const;
