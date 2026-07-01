import { Landmark, Building2, Briefcase } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { cn } from '../../lib/cn';
import { MarketplaceInvestmentDiagram } from './MarketplaceInvestmentDiagram';

const CATEGORIES = [
  {
    icon: Landmark,
    title: 'Treasury',
    offering: 'Tokenized Treasury Fund',
    policy: 'general-eligibility',
    route: 'RwaToken',
  },
  {
    icon: Building2,
    title: 'Real estate',
    offering: 'Commercial Real Estate Token',
    policy: 'us-jurisdiction',
    route: 'RwaToken',
  },
  {
    icon: Briefcase,
    title: 'Private credit',
    offering: 'Private Credit Note',
    policy: 'accredited-investor',
    route: 'RwaToken',
  },
];

export function TokenizedAssetsSection() {
  const { ref, visible } = useScrollReveal();

  return (
    <div ref={ref} className={cn('lg-reveal', visible && 'lg-revealed')}>
      <MarketplaceInvestmentDiagram />
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {CATEGORIES.map((cat, i) => (
          <div
            key={cat.title}
            className="lg-feature-card lg-card-reveal"
            style={{ transitionDelay: visible ? `${i * 0.1}s` : '0s' }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0f6ff]">
              <cat.icon className="h-5 w-5 text-[#007dfc]" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-[#012b54]">{cat.title}</h3>
            <p className="mt-1 text-sm text-[#64748b]">{cat.offering}</p>
            <div className="mt-4 space-y-1.5 border-t border-[#eef0f3] pt-3 text-xs text-[#64748b]">
              <div>
                Policy: <span className="font-mono text-[#012b54]">{cat.policy}</span>
              </div>
              <div>
                Settles via: <span className="font-mono text-[#012b54]">{cat.route}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
