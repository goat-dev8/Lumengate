import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Fingerprint } from 'lucide-react';
import { StageProgress, PASSPORT_REQUEST_STAGES } from '../design/StageProgress';
import { microcopy } from '../../lib/microcopy';

export type PassportRequestStage =
  | 'health'
  | 'registry'
  | 'issuing'
  | 'complete'
  | 'error';

type Props = {
  active: boolean;
  stage: PassportRequestStage;
  message?: string | null;
  startedAt?: number;
};

const STAGE_MESSAGES: Record<Exclude<PassportRequestStage, 'complete' | 'error'>, string[]> = {
  health: ['Connecting to Lumengate issuer…', 'Checking passport service…'],
  registry: [
    'Syncing eligibility registry on Stellar…',
    'Updating on-chain Merkle root — testnet can take 1–3 minutes…',
    'Waiting for ledger confirmation…',
  ],
  issuing: [
    'Building your private passport…',
    'Signing issuer attestation…',
    'Finalizing passport materials…',
  ],
};

function useRotatingMessage(stage: PassportRequestStage, override: string | null | undefined): string {
  const pool = useMemo(() => {
    if (override?.trim()) return [override.trim()];
    if (stage === 'complete') return ['Passport issued'];
    if (stage === 'error') return ['Passport request failed'];
    return STAGE_MESSAGES[stage] ?? ['Working…'];
  }, [stage, override]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
    if (pool.length <= 1) return undefined;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % pool.length), 4500);
    return () => window.clearInterval(id);
  }, [pool, stage]);

  return pool[index] ?? pool[0] ?? 'Working…';
}

export function PassportRequestProgress({ active, stage, message, startedAt }: Props) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const displayMessage = useRotatingMessage(stage, message);
  const isComplete = stage === 'complete';
  const isError = stage === 'error';
  const isActive = active && !isComplete && !isError;

  useEffect(() => {
    if (!isActive) {
      setElapsedMs(0);
      return;
    }
    const origin = startedAt ?? Date.now();
    const id = window.setInterval(() => setElapsedMs(Date.now() - origin), 500);
    return () => window.clearInterval(id);
  }, [isActive, startedAt]);

  useEffect(() => {
    if (!isActive) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = microcopy.passport.leaveWarning;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isActive]);

  if (!active) return null;

  const showLongWait = isActive && elapsedMs >= 15_000;
  const currentStageId = stage === 'error' ? 'issuing' : stage;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#012b54]/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-busy={isActive}
      aria-labelledby="passport-request-progress-title"
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-lg rounded-2xl border border-[var(--lg-border)] bg-white p-6 shadow-2xl md:p-8"
      >
        <div className="flex items-start gap-3">
          {isComplete ? (
            <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-500" aria-hidden />
          ) : (
            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Fingerprint className="h-8 w-8 shrink-0 text-[#007dfc]" aria-hidden />
            </motion.div>
          )}
          <div className="min-w-0">
            <h2 id="passport-request-progress-title" className="text-lg font-semibold text-[#012b54]">
              {isComplete ? 'Passport issued' : isError ? 'Passport request failed' : 'Requesting your passport'}
            </h2>
            <p className="mt-1 text-sm text-[#64748b]">
              {isComplete
                ? 'Eligibility attested — your identity stays off-chain.'
                : 'Usually takes 1–3 minutes on testnet when the registry syncs. Please keep this tab open.'}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <StageProgress
            stages={PASSPORT_REQUEST_STAGES}
            currentStageId={currentStageId}
            indeterminate={isActive && stage === 'registry' && elapsedMs < 8_000}
            aria-label="Passport request progress"
          />
          <p className="mt-4 text-sm font-medium text-[#012b54]" role="status">
            {displayMessage}
          </p>
          {showLongWait ? (
            <p className="mt-2 text-xs text-[#64748b]">
              Testnet ledger sync is still running — this is normal. Do not refresh or close the tab.
            </p>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}
