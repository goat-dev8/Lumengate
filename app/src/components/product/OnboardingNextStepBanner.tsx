import { Link } from 'react-router-dom';
import { ArrowRight, Droplets, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import type { OnboardingNextStep } from '../../lib/onboardingGuide';

type Props = {
  step: OnboardingNextStep;
  onDismiss?: () => void;
};

export function OnboardingNextStepBanner({ step, onDismiss }: Props) {
  if (step.kind === 'none') return null;

  const icon =
    step.kind === 'claim-faucet' ? (
      <Droplets className="h-5 w-5 shrink-0 text-[#007dfc]" />
    ) : (
      <Sparkles className="h-5 w-5 shrink-0 text-[#007dfc]" />
    );

  return (
    <div className="rounded-2xl border border-[#007dfc]/25 bg-gradient-to-br from-[#007dfc]/8 to-white px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {icon}
          <div>
            <p className="text-sm font-semibold text-[#012b54]">{step.title}</p>
            <p className="mt-1 text-sm text-[#64748b]">{step.description}</p>
          </div>
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs font-medium text-[#64748b] hover:text-[#012b54]"
          >
            Dismiss
          </button>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {step.href.startsWith('#') ? (
          <a href={step.href}>
            <Button size="sm">
              {step.cta}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </a>
        ) : (
          <Link to={step.href}>
            <Button size="sm">
              {step.cta}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        )}
        {step.secondaryHref && step.secondaryCta ? (
          <Link to={step.secondaryHref} className="inline-flex items-center text-sm font-semibold text-[#007dfc] hover:underline">
            {step.secondaryCta}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
