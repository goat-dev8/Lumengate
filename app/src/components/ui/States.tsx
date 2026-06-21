import { cn } from '../../lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%] animate-shimmer',
        className,
      )}
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#e3e8ee] bg-[#f6f9fc] px-6 py-12 text-center">
      <h4 className="text-base font-semibold text-[#0d253d]">{title}</h4>
      <p className="mt-2 max-w-md text-sm text-[#64748b]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
