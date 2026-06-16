import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

type Props = {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'success' | 'accent';
  href?: string;
  icon?: React.ReactNode;
};

export function InstitutionalWidget({ label, value, sub, tone = 'default', href, icon }: Props) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="lg-widget-label">{label}</span>
        {icon ? <div className="lg-widget-icon">{icon}</div> : null}
        {href ? <ArrowUpRight className="h-4 w-4 shrink-0 text-[#007dfc] opacity-0 transition group-hover:opacity-100" /> : null}
      </div>
      <div className={`lg-widget-value ${tone === 'success' ? 'lg-widget-value-success' : ''} ${tone === 'accent' ? 'lg-widget-value-accent' : ''}`}>
        {value}
      </div>
      {sub ? <p className="lg-widget-sub">{sub}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link to={href} className={`lg-widget group lg-widget-${tone}`}>
        {inner}
      </Link>
    );
  }

  return <div className={`lg-widget lg-widget-${tone}`}>{inner}</div>;
}
