import { AlertTriangle } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { cn } from '../../lib/cn';

const GAPS = [
  {
    approach: 'Public wallet + compliance memo',
    gap: 'Identity and policy attributes leak onto the public ledger with every transaction.',
  },
  {
    approach: 'Custodial server keys',
    gap: 'Not passkey-first — the user does not hold or control the authorization key.',
  },
  {
    approach: 'One ZK proof forever',
    gap: 'A single reusable proof cannot stop nullifier replay across different assets.',
  },
  {
    approach: 'Passkey on every operation',
    gap: 'Unacceptable UX for a shield → merge → send sequence that needs several steps.',
  },
  {
    approach: 'RPC-only confidential balance',
    gap: 'New accounts miss prior event history, producing an infinite "Syncing…" state.',
  },
];

export function TheProblemSection() {
  const { ref, visible } = useScrollReveal();

  return (
    <div ref={ref} className={cn('lg-reveal', visible && 'lg-revealed')}>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {GAPS.map((item, i) => (
          <div
            key={item.approach}
            className="lg-feature-card lg-card-reveal"
            style={{ transitionDelay: visible ? `${i * 0.08}s` : '0s' }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-[#012b54]">{item.approach}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#64748b]">{item.gap}</p>
          </div>
        ))}
        <div
          className="lg-feature-card lg-card-reveal bg-[#f0f6ff]"
          style={{ transitionDelay: visible ? `${GAPS.length * 0.08}s` : '0s' }}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#007dfc]/10">
            <span className="text-lg font-semibold text-[#007dfc]">→</span>
          </div>
          <h3 className="mt-4 text-base font-semibold text-[#012b54]">What Lumengate proves instead</h3>
          <p className="mt-2 text-sm leading-relaxed text-[#31485f]">
            Scoped nullifier + policy compliance on-chain — raw eligibility inputs, confidential balances, and
            receipt details stay private by default.
          </p>
        </div>
      </div>
    </div>
  );
}
