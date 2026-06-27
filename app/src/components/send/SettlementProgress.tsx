import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, Fingerprint } from 'lucide-react';
import { StageProgress, SETTLEMENT_STAGES } from '../design/StageProgress';
import { PrivacySplitCard } from '../design/PrivacySplitCard';
import { microcopy } from '../../lib/microcopy';

export type SettlementPhase =
  | 'idle'
  | 'preparing'
  | 'proving'
  | 'authorizing-bind'
  | 'waiting-passkey'
  | 'authorizing-settle'
  | 'submitting'
  | 'confirming'
  | 'receipt'
  | 'complete';

type Props = {
  phase: SettlementPhase;
  statusMessage?: string | null;
  assetLabel?: string;
  startedAt?: number | null;
};

const PHASE_MESSAGES: Record<Exclude<SettlementPhase, 'idle' | 'complete'>, string[]> = {
  preparing: ['Preparing secure transaction…', 'Checking passport eligibility…'],
  proving: [
    'Generating zero-knowledge proof…',
    'Building private witness on your device…',
    'Running local cryptography — nothing leaves this browser…',
  ],
  'authorizing-bind': [
    'Binding private eligibility…',
    'Waiting for secure confirmation…',
    'Passkey confirmation required (1 of 2)',
  ],
  'waiting-passkey': [
    'Waiting for your confirmation…',
    'The next passkey prompt will appear automatically.',
    'Secure cryptographic work is still running locally.',
  ],
  'authorizing-settle': [
    'Passkey confirmation required (2 of 2)',
    'Approve this transfer with your passkey…',
    'Waiting for your confirmation…',
  ],
  submitting: ['Submitting settlement…', 'Sending to Stellar…'],
  confirming: ['Waiting for Stellar confirmation…', 'Recording settlement on ledger…'],
  receipt: ['Generating institutional receipt…', 'Finalizing your compliance record…'],
};

export function mapStatusToSettlementPhase(
  statusMessage: string | null | undefined,
  loading: boolean,
): SettlementPhase {
  if (!loading && !statusMessage) return 'idle';
  const msg = (statusMessage ?? '').toLowerCase();
  if (msg.includes('receipt')) return 'receipt';
  if (msg.includes('confirm') && msg.includes('stellar')) return 'confirming';
  if (msg.includes('passkey step') && msg.includes('binding')) return 'authorizing-bind';
  if (msg.includes('passkey step') && (msg.includes('confirm') || msg.includes('send') || msg.includes('settlement'))) {
    return 'authorizing-settle';
  }
  if (msg.includes('waiting') && msg.includes('passkey')) return 'waiting-passkey';
  if (msg.includes('preparing')) return 'preparing';
  if (
    msg.includes('proof') ||
    msg.includes('witness') ||
    msg.includes('prover') ||
    msg.includes('registry')
  ) {
    return 'proving';
  }
  if (msg.includes('submit')) return 'submitting';
  if (loading) return 'submitting';
  return 'idle';
}

function useRotatingMessage(phase: SettlementPhase, statusMessage?: string | null) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (phase === 'idle' || phase === 'complete') return;
    const id = window.setInterval(() => setTick((t) => t + 1), 3200);
    return () => window.clearInterval(id);
  }, [phase]);

  return useMemo(() => {
    if (statusMessage?.trim()) return statusMessage.trim();
    if (phase === 'idle' || phase === 'complete') return '';
    const pool = PHASE_MESSAGES[phase];
    if (!pool?.length) return '';
    return pool[tick % pool.length];
  }, [phase, statusMessage, tick]);
}

export function SettlementProgressOverlay({ phase, statusMessage, assetLabel = 'USDC', startedAt }: Props) {
  const reduceMotion = useReducedMotion();
  const [elapsedMs, setElapsedMs] = useState(0);
  const displayMessage = useRotatingMessage(phase, statusMessage);
  const isComplete = phase === 'complete';
  const isActive = phase !== 'idle' && !isComplete;

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
      event.returnValue = microcopy.send.leaveWarning;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isActive]);

  useEffect(() => {
    if (phase === 'authorizing-settle' || phase === 'waiting-passkey') {
      window.focus();
    }
  }, [phase]);

  if (phase === 'idle') return null;

  const showLongWait = isActive && elapsedMs >= 12_000;
  const currentStageId =
    phase === 'waiting-passkey' ? 'authorizing-bind' : phase === 'confirming' ? 'submitting' : phase === 'receipt' ? 'submitting' : phase;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#012b54]/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-busy={isActive}
      aria-labelledby="settlement-progress-title"
    >
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-lg rounded-2xl border border-[var(--lg-border)] bg-white p-6 shadow-2xl md:p-8"
      >
        <div className="flex items-start gap-3">
          {isComplete ? (
            <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-500" aria-hidden />
          ) : (
            <motion.div
              animate={reduceMotion ? undefined : { scale: [1, 1.06, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Fingerprint className="h-8 w-8 shrink-0 text-[#007dfc]" aria-hidden />
            </motion.div>
          )}
          <div className="min-w-0">
            <h2 id="settlement-progress-title" className="text-lg font-semibold text-[#012b54]">
              {isComplete ? 'Settlement confirmed' : `Sending ${assetLabel} privately`}
            </h2>
            <p className="mt-1 text-sm text-[#64748b]">
              {isComplete
                ? 'Your institutional receipt is ready.'
                : 'Your identity stays off-chain. Only the settlement reaches Stellar.'}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <StageProgress
            stages={SETTLEMENT_STAGES}
            currentStageId={currentStageId}
            compact
            indeterminate={isActive && (phase === 'proving' || phase === 'waiting-passkey')}
          />
          {displayMessage && !isComplete ? (
            <motion.p
              key={displayMessage}
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 text-sm font-medium text-[#012b54]"
              role="status"
              aria-live="polite"
            >
              {displayMessage}
            </motion.p>
          ) : null}
          {showLongWait ? (
            <p className="mt-3 rounded-xl border border-[#007dfc]/20 bg-[#007dfc]/5 px-3 py-2 text-xs leading-relaxed text-[#475569]">
              {microcopy.send.processingSecurely}
            </p>
          ) : null}
        </div>

        {!isComplete ? (
          <div className="mt-6">
            <PrivacySplitCard compact />
          </div>
        ) : null}
      </motion.div>
    </motion.div>
  );
}
