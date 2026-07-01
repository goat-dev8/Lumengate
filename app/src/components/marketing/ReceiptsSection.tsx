import { CheckCircle2 } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { cn } from '../../lib/cn';

const STEPS = [
  { title: 'Settlement confirmed', detail: 'Transaction lands on Stellar and the smart account authorization succeeds.' },
  { title: 'Proof archived', detail: 'The session proof used for authorization is kept for the receipt record.' },
  { title: 'Nullifier marked consumed', detail: 'The scoped nullifier for this asset/action is spent, preventing replay.' },
  { title: 'Receipt sealed', detail: '`buildProofReceipt()` fetches chain events and seals proof roots, nullifier reference, and policy ID.' },
  { title: 'Shown in Compliance', detail: '`/app/compliance` renders the receipt and timeline immediately, ready for an optional viewing key.' },
];

export function ReceiptsSection() {
  const { ref, visible } = useScrollReveal();

  return (
    <div ref={ref} className={cn('lg-reveal mx-auto max-w-2xl', visible && 'lg-revealed')}>
      <div className="space-y-3">
        {STEPS.map((step, i) => (
          <div
            key={step.title}
            className="lg-card-reveal flex items-start gap-4 rounded-2xl border border-[#eef0f3] bg-white p-4"
            style={{ transitionDelay: visible ? `${i * 0.09}s` : '0s' }}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f0f6ff]">
              <CheckCircle2 className="h-4 w-4 text-[#007dfc]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#012b54]">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-[#64748b]">{step.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
