import { KeyRound, Cpu, ShieldCheck, ArrowRightLeft } from 'lucide-react';

const STEPS = [
  { icon: KeyRound, label: 'Passport' },
  { icon: Cpu, label: 'Eligibility' },
  { icon: ShieldCheck, label: 'Approve' },
  { icon: ArrowRightLeft, label: 'Settle' },
];

export function ProductStoryStrip() {
  return (
    <div className="lg-product-story">
      <div className="lg-product-story-inner">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Product flow</span>
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <span key={step.label} className="inline-flex items-center gap-2">
              {i > 0 ? <span className="lg-product-story-arrow">→</span> : null}
              <span className="lg-product-story-step">
                <Icon className="h-4 w-4 text-[#007dfc]" />
                {step.label}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
