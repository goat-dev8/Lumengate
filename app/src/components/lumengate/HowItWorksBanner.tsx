import { ChevronRight } from 'lucide-react';

const STEPS = [
  'Receive credential from Ethereum issuer',
  'Generate proof locally (Noir + UltraHonk)',
  'Verify eligibility on Stellar',
  'Access RWA offering',
  'Settle on-chain',
  'Independent compliance verification',
];

export function HowItWorksBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-2xl border border-brand/20 bg-gradient-to-r from-[#f0f6ff] to-white px-4 py-3 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-brand">How Lumengate works</div>
      {!compact ? (
        <ol className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-slate-ink md:text-sm">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-1">
              <span className="font-medium text-navy">{i + 1}.</span>
              <span>{step}</span>
              {i < STEPS.length - 1 ? (
                <ChevronRight className="hidden h-3 w-3 text-slate-muted sm:inline" />
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-1 text-xs text-slate-muted">
          Ethereum issuer → local ZK proof → Stellar verification → RWA settlement → auditor check
        </p>
      )}
    </div>
  );
}
