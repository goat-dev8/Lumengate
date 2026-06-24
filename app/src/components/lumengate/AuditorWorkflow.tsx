import { ArrowDown } from 'lucide-react';

const STEPS = [
  'Audit record',
  'Eligibility check',
  'Settlement check',
  'Stellar records',
  'Verification result',
];

export function AuditorWorkflowDiagram() {
  return (
    <div className="rounded-2xl border border-[#eef0f3] bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase text-slate-muted">Auditor workflow</div>
      <div className="mt-3 space-y-1">
        {STEPS.map((step, i) => (
          <div key={step}>
            <div className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-navy">{step}</div>
            {i < STEPS.length - 1 ? (
              <div className="flex justify-center py-0.5 text-brand">
                <ArrowDown className="h-3 w-3" />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
