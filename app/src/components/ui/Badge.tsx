import { cn } from '../../lib/utils';

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'ok' | 'warn' | 'err' | 'brand';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-slate-100 text-slate-ink',
    ok: 'bg-emerald-50 text-status-ok',
    warn: 'bg-amber-50 text-status-warn',
    err: 'bg-red-50 text-status-err',
    brand: 'bg-blue-50 text-brand',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
