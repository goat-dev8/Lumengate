import { useScrollReveal } from '../../hooks/useScrollReveal';
import { cn } from '../../lib/cn';
import { PublicSettlementFlowDiagram } from './PublicSettlementFlowDiagram';

const POINTS = [
  'USDC and EURC treasury settlement routes through `ComplianceSacAdmin.transfer_compliant` / `transfer_compliant_eurc`.',
  'Every transfer is gated by `PolicyVerifier.verify_passport` on an asset-scoped nullifier (USDC = asset id 2, EURC = asset id 3).',
  'Amount and counterparties stay visible on-chain by design — public settlement is for cases where transparency is the requirement, not a limitation.',
];

export function PublicSettlementSection() {
  const { ref, visible } = useScrollReveal();

  return (
    <div ref={ref} className={cn('lg-reveal', visible && 'lg-revealed')}>
      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <PublicSettlementFlowDiagram />
        <ul className="space-y-4">
          {POINTS.map((point, i) => (
            <li
              key={point}
              className="lg-card-reveal flex items-start gap-3 rounded-2xl border border-[#eef0f3] bg-white p-4 text-sm leading-relaxed text-[#31485f]"
              style={{ transitionDelay: visible ? `${i * 0.1}s` : '0s' }}
            >
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#007dfc]" />
              {point}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
