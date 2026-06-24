import type { ReactNode } from 'react';
import { BrandGridBackground } from '../fintech/BrandGridBackground';
import { Badge } from '../ui/Badge';

type Props = {
  eyebrow: string;
  title: string;
  subtitle: string;
  illustration?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
};

export function ProductHero({ eyebrow, title, subtitle, illustration, actions, badge }: Props) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-brand-50/30 to-slate-50">
      <BrandGridBackground />
      <div className="relative grid gap-8 p-8 lg:grid-cols-2 lg:items-center lg:p-10">
        <div>
          <Badge tone="brand">{eyebrow}</Badge>
          {badge ? <div className="mt-3">{badge}</div> : null}
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-navy sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-muted">{subtitle}</p>
          {actions ? <div className="mt-6 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {illustration ? <div className="hidden lg:block">{illustration}</div> : null}
      </div>
    </section>
  );
}
