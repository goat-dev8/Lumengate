import { ArrowDown } from 'lucide-react';
import { Badge } from '../ui/Badge';

const STEPS = [
  'Ethereum Issuer',
  'Credential Signature (secp256k1)',
  'Merkle Commitment',
  'Stellar Credential Registry',
  'Policy Verifier (UltraHonk / BN254)',
  'RWA Marketplace Settlement',
];

export function CrossChainArchitecture({ showBadge = true }: { showBadge?: boolean }) {
  return (
    <div className="rounded-2xl border border-[#eef0f3] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-navy">Cross-chain compliance architecture</h3>
        {showBadge ? <Badge tone="ok">Cross-chain verified</Badge> : null}
      </div>
      <div className="mt-4 space-y-1">
        {STEPS.map((label, i) => (
          <div key={label}>
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-ink">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                {i + 1}
              </span>
              {label}
            </div>
            {i < STEPS.length - 1 ? (
              <div className="flex justify-center py-0.5 text-brand">
                <ArrowDown className="h-4 w-4" />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
