import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, Fingerprint } from 'lucide-react';
import { StageProgress, SETTLEMENT_STAGES } from '../design/StageProgress';
import { PrivacySplitCard } from '../design/PrivacySplitCard';

export type SettlementPhase =
  | 'idle'
  | 'preparing'
  | 'proving'
  | 'authorizing-bind'
  | 'authorizing-settle'
  | 'submitting'
  | 'complete';

type Props = {
  phase: SettlementPhase;
  statusMessage?: string | null;
  assetLabel?: string;
};

export function mapStatusToSettlementPhase(
  statusMessage: string | null | undefined,
  loading: boolean,
): SettlementPhase {
  if (!loading && !statusMessage) return 'idle';
  const msg = (statusMessage ?? '').toLowerCase();
  if (msg.includes('passkey step') && msg.includes('binding')) return 'authorizing-bind';
  if (msg.includes('passkey step') && (msg.includes('confirm') || msg.includes('send'))) {
    return 'authorizing-settle';
  }
  if (msg.includes('preparing')) return 'preparing';
  if (
    msg.includes('proof') ||
    msg.includes('witness') ||
    msg.includes('prover') ||
    msg.includes('registry')
  ) {
    return 'proving';
  }
  if (loading) return 'submitting';
  return 'idle';
}

export function SettlementProgressOverlay({ phase, statusMessage, assetLabel = 'USDC' }: Props) {
  const reduceMotion = useReducedMotion();
  if (phase === 'idle') return null;

  const currentStageId = phase;
  const isComplete = phase === 'complete';

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#012b54]/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
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
            <Fingerprint className="h-8 w-8 shrink-0 text-[#007dfc] animate-pulse" aria-hidden />
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
          <StageProgress stages={SETTLEMENT_STAGES} currentStageId={currentStageId} compact />
          {statusMessage && !isComplete ? (
            <p className="mt-3 text-xs text-[#64748b]">{statusMessage}</p>
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
