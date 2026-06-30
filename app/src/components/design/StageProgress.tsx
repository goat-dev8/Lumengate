import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';

export type StageProgressItem = {
  id: string;
  label: string;
  hint?: string;
};

type Props = {
  stages: StageProgressItem[];
  currentStageId: string | null;
  className?: string;
  compact?: boolean;
  indeterminate?: boolean;
  'aria-label'?: string;
};

function stageIndex(stages: StageProgressItem[], id: string | null): number {
  if (!id) return -1;
  return stages.findIndex((s) => s.id === id);
}

export function StageProgress({
  stages,
  currentStageId,
  className,
  compact = false,
  indeterminate = false,
  'aria-label': ariaLabel = 'Progress',
}: Props) {
  const current = stageIndex(stages, currentStageId);
  const progressPct =
    current < 0 ? 0 : Math.min(100, Math.round(((current + 1) / stages.length) * 100));

  return (
    <div className={cn('w-full', className)} role="status" aria-label={ariaLabel} aria-live="polite">
      <div className="relative h-1.5 overflow-hidden rounded-full bg-[var(--lg-muted-bg)]">
        <div
          className={cn(
            'h-full rounded-full bg-gradient-to-r from-[#007dfc] to-[#0056b3] transition-all duration-500 ease-out',
            indeterminate && 'absolute inset-y-0 w-1/3 animate-[lg-indeterminate_1.4s_ease-in-out_infinite]',
          )}
          style={indeterminate ? undefined : { width: `${progressPct}%` }}
        />
      </div>
      {!compact ? (
        <ol className="mt-4 space-y-2">
          {stages.map((stage, index) => {
            const done = current >= 0 && index < current;
            const active = stage.id === currentStageId;
            return (
              <li
                key={stage.id}
                className={cn(
                  'flex items-start gap-3 text-sm transition-colors',
                  done ? 'text-emerald-600' : active ? 'text-[#012b54]' : 'text-[#94a3b8]',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] font-semibold',
                    done
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                      : active
                        ? 'border-[#007dfc]/30 bg-[#007dfc]/10 text-[#007dfc]'
                        : 'border-[var(--lg-border)] bg-white text-[#94a3b8]',
                  )}
                >
                  {done ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span className={cn('block font-medium', active && 'text-[#012b54]')}>{stage.label}</span>
                  {stage.hint && active ? (
                    <span className="mt-0.5 block text-xs text-[#64748b]">{stage.hint}</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      ) : currentStageId ? (
        <p className="mt-2 text-sm font-medium text-[#012b54]">
          {stages.find((s) => s.id === currentStageId)?.label}
        </p>
      ) : null}
    </div>
  );
}

export const SETTLEMENT_STAGES: StageProgressItem[] = [
  { id: 'preparing', label: 'Preparing secure transaction', hint: 'Checking passport eligibility' },
  { id: 'proving', label: 'Generating zero-knowledge proof', hint: 'Runs locally on your device' },
  { id: 'authorizing-bind', label: 'Binding private eligibility', hint: 'Passkey confirmation (1 of 2)' },
  { id: 'authorizing-settle', label: 'Confirming settlement', hint: 'Passkey confirmation (2 of 2)' },
  { id: 'submitting', label: 'Submitting to Stellar', hint: 'Recording settlement on ledger' },
  { id: 'complete', label: 'Completed', hint: 'Opening your receipt' },
];

export const PASSPORT_PROVE_STAGES: StageProgressItem[] = [
  { id: 'preparing', label: 'Preparing prover' },
  { id: 'registry', label: 'Syncing eligibility registry' },
  { id: 'witness', label: 'Generating witness' },
  { id: 'proof', label: 'Generating proof', hint: 'Usually takes about 30 seconds' },
  { id: 'complete', label: 'Proof ready' },
];

export const PASSPORT_REQUEST_STAGES: StageProgressItem[] = [
  { id: 'health', label: 'Connecting to issuer', hint: 'Checking passport service' },
  { id: 'registry', label: 'Syncing eligibility registry', hint: 'On-chain update — can take 1–3 min on testnet' },
  { id: 'issuing', label: 'Issuing passport', hint: 'Building attestation materials' },
  { id: 'complete', label: 'Passport ready' },
];

/** Two passkey ceremonies when enabling the 7-day trusted-device session. */
export const SESSION_ENABLE_STAGES: StageProgressItem[] = [
  {
    id: 'bind-eligibility',
    label: 'Bind passport eligibility',
    hint: 'Passkey confirmation (1 of 2) — stores your EURC scope in the session store',
  },
  {
    id: 'install-session',
    label: 'Install 7-day session rule',
    hint: 'Passkey confirmation (2 of 2) — adds your delegated device signer on-chain',
  },
  { id: 'done', label: 'Session active', hint: 'Shield, send, and marketplace reuse this device session' },
];
