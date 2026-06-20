import { cn } from '../../lib/cn';

export function SectionBadge({
  suffix,
  label,
  dark = false,
  className,
}: {
  suffix: string;
  label: string;
  dark?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5',
        dark ? 'border-white/20' : 'border-[#eef0f3]',
        className,
      )}
    >
      <span className="rounded-full bg-[#007dfc] px-2 py-1 text-sm font-semibold leading-tight text-white shadow-sm">
        {suffix}
      </span>
      <span className={cn('text-sm font-medium leading-tight', dark ? 'text-white/90' : 'text-[#012b54]')}>
        {label}
      </span>
    </div>
  );
}
