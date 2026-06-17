import { cn } from '../../lib/cn';

type Tab = { id: string; label: string; icon?: React.ReactNode };

export function TabGroup({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('lg-tabs', className)} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={cn('lg-tab', active === tab.id && 'lg-tab-active')}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
