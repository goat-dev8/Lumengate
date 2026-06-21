import { cn } from '../../lib/utils';

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('rounded-2xl border border-slate-line bg-white p-6 shadow-card', className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  badge,
}: {
  title: string;
  description?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-lg font-semibold text-navy">{title}</h3>
        {description ? <p className="mt-1 text-sm text-slate-muted">{description}</p> : null}
      </div>
      {badge}
    </div>
  );
}
