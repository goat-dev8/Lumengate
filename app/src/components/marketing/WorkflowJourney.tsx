import { KeyRound, Cpu, ShieldCheck, ArrowRightLeft } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { cn } from '../../lib/cn';

const STEPS = [
  {
    icon: KeyRound,
    title: 'Get credential',
    tag: 'Issuer service',
    color: '#012b54',
  },
  {
    icon: Cpu,
    title: 'Generate proof',
    tag: 'Browser WASM',
    color: '#6366f1',
  },
  {
    icon: ShieldCheck,
    title: 'Verify',
    tag: 'BN254 on-chain',
    color: '#007dfc',
  },
  {
    icon: ArrowRightLeft,
    title: 'Transfer',
    tag: 'RwaToken',
    color: '#15803d',
  },
];

export function WorkflowJourney() {
  const { ref, visible } = useScrollReveal();

  return (
    <div ref={ref} className={cn('lg-reveal', visible && 'lg-revealed')}>
      <div className="lg-journey">
        <div className="lg-journey-track" aria-hidden="true">
          <div
            className="lg-journey-track-fill"
            style={{ transform: visible ? 'scaleX(1)' : 'scaleX(0)' }}
          />
        </div>

        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <div
              key={step.title}
              className={cn(
                'lg-journey-step lg-card-reveal',
                visible && 'lg-journey-step-active',
              )}
              style={{ transitionDelay: visible ? `${i * 0.12}s` : '0s' }}
            >
              <div className="relative">
                <span className="lg-journey-num">{i + 1}</span>
                <div className="lg-journey-icon">
                  <Icon className="h-8 w-8" style={{ color: step.color }} />
                </div>
              </div>
              <div className="lg-journey-title">{step.title}</div>
              <span className="lg-journey-tag">{step.tag}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
