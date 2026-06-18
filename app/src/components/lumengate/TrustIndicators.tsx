import { CheckCircle2 } from 'lucide-react';

export type TrustIndicatorItem = {
  label: string;
  pass: boolean;
  detail?: string;
};

export function TrustIndicators({ items }: { items: TrustIndicatorItem[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <li
          key={item.label}
          className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${
            item.pass ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-50 text-slate-muted'
          }`}
        >
          <CheckCircle2
            className={`mt-0.5 h-4 w-4 shrink-0 ${item.pass ? 'text-emerald-600' : 'text-slate-400'}`}
          />
          <div>
            <span className="font-medium">{item.pass ? '✓' : '○'} {item.label}</span>
            {item.detail ? (
              <div className="mt-0.5 break-all font-mono text-xs opacity-80">{item.detail}</div>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CredibilityStatement() {
  return (
    <div className="rounded-xl border-2 border-brand/30 bg-[#f0f6ff] p-4 text-sm font-medium leading-relaxed text-navy">
      Claims are signed by an Ethereum issuer, anchored into Stellar via Merkle roots, and verified
      on-chain before settlement. Nothing here is hardcoded — every field is bound to live issuer
      signatures and Soroban contract state.
    </div>
  );
}
