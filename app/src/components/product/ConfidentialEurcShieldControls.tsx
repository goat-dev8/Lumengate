import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, EyeOff, RefreshCw, Shield } from 'lucide-react';
import { Button } from '../ui/Button';
import { StageProgress, type StageProgressItem } from '../design/StageProgress';
import { useApp } from '../../context/AppContext';
import {
  mergeConfidentialEurc,
  shieldConfidentialEurc,
  unshieldConfidentialEurc,
} from '../../lib/confidentialFlow';
import {
  confidentialAssetReady,
  resolveConfidentialAsset,
  withConfidentialContracts,
  type ConfidentialAssetKey,
} from '../../lib/confidentialAssetConfig';
import { formatConfidentialAmount } from '../../lib/confidentialBalance';
import { readComplianceAdminUsdcBalance, readEurcSacBalance, formatSorobanUserError } from '../../lib/contracts';
import { withRetry } from '../../lib/retry';

type CtActionStage = 'preparing' | 'proof' | 'deposit' | 'confirming' | 'merge' | 'sync' | 'done';

const CT_ACTION_STAGES: StageProgressItem[] = [
  { id: 'preparing', label: 'Preparing private operation', hint: 'Checking account and passport state' },
  { id: 'proof', label: 'Generating local proof', hint: 'Cryptography runs in this browser' },
  { id: 'deposit', label: 'Creating confidential commitment', hint: 'Shielding public EURC into the wrapper' },
  { id: 'confirming', label: 'Waiting for Stellar confirmation', hint: 'Testnet ledgers can briefly lag' },
  { id: 'merge', label: 'Merging spendable balance', hint: 'Moving received balance into spendable private EURC' },
  { id: 'sync', label: 'Synchronizing private balance', hint: 'Verifying local openings against chain commitments' },
  { id: 'done', label: 'Ready', hint: 'Private EURC balance is up to date' },
];

function stageFromProgress(step: string, message: string): CtActionStage {
  const lower = message.toLowerCase();
  if (lower.includes('proof') || lower.includes('passport') || lower.includes('eligibility')) return 'proof';
  if (step === 'deposit' || lower.includes('shield') || lower.includes('deposit')) return 'deposit';
  if (step === 'merge' || lower.includes('merge') || lower.includes('spendable')) return 'merge';
  if (lower.includes('sync') || lower.includes('balance')) return 'sync';
  if (lower.includes('stellar') || lower.includes('submit')) return 'confirming';
  return 'preparing';
}

type Props = {
  variant?: 'dashboard' | 'send';
  suggestedAmount?: string;
  onShielded?: () => void;
  assetKey?: ConfidentialAssetKey;
};

export function ConfidentialEurcShieldControls({
  variant = 'dashboard',
  suggestedAmount,
  onShielded,
  assetKey = 'eurc',
}: Props) {
  const {
    config,
    settlementAddress,
    ensureProofForAsset,
    signAndSubmitSettlement,
    confidentialEurcBalance,
    confidentialBalanceLoading,
    refreshConfidentialEurcBalance,
  } = useApp();
  const assetConfig = resolveConfidentialAsset(config, assetKey);
  const ctConfig = assetConfig.contracts ? withConfidentialContracts(config, assetConfig) : config;
  const [publicBalance, setPublicBalance] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<'shield' | 'merge' | 'unshield' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [actionStage, setActionStage] = useState<CtActionStage | null>(null);
  const [amount, setAmount] = useState('');
  const [revealed, setRevealed] = useState(false);

  const refresh = useCallback(async () => {
    if (!settlementAddress || !assetConfig.contracts) return;
    setError(null);
    try {
      if (assetKey === 'eurc') {
        await refreshConfidentialEurcBalance();
      }
      if (assetKey === 'eurc' && config.eurcSacId) {
        const publicEurc = await withRetry(() => readEurcSacBalance(config, settlementAddress), {
          attempts: 5,
          baseDelayMs: 900,
          maxDelayMs: 6_000,
        }).catch(() => null);
        setPublicBalance(publicEurc);
      } else if (assetKey === 'usdc') {
        const snap = await withRetry(() => readComplianceAdminUsdcBalance(config, settlementAddress), {
          attempts: 5,
          baseDelayMs: 900,
          maxDelayMs: 6_000,
        }).catch(() => null);
        setPublicBalance(snap?.formatted ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [assetConfig.contracts, assetKey, config, settlementAddress, refreshConfidentialEurcBalance]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (suggestedAmount) {
      setAmount(suggestedAmount);
    }
  }, [suggestedAmount]);

  if (!confidentialAssetReady(config, assetKey) || !settlementAddress) return null;

  const balance = assetKey === 'eurc' ? confidentialEurcBalance : null;
  const loading = confidentialBalanceLoading;
  const registered = balance?.registered === true;
  const publicEurcAvailable = publicBalance !== null && Number(publicBalance) > 0;
  const compact = variant === 'send';

  const runAction = async (kind: 'shield' | 'merge' | 'unshield') => {
    setActionLoading(kind);
    setError(null);
    setStatus(null);
    setActionStage('preparing');
    try {
      const ensured = await ensureProofForAsset(assetKey, (message) => {
        setStatus(message);
        setActionStage(stageFromProgress('proof', message));
      });
      const submitTx = async (tx: Parameters<typeof signAndSubmitSettlement>[2], stepLabel: string) => {
        setActionStage(stageFromProgress(stepLabel, `Submitting ${stepLabel} to Stellar…`));
        const hash = await signAndSubmitSettlement(settlementAddress, ensured.proof, tx);
        setActionStage('sync');
        return hash;
      };

      if (kind === 'shield') {
        if (assetKey !== 'eurc') {
          throw new Error(`${assetConfig.label} confidential shield is not deployed on this network yet.`);
        }
        await shieldConfidentialEurc({
          config: ctConfig,
          txSource: settlementAddress,
          smartAccount: settlementAddress,
          amount,
          onProgress: (p) => {
            setStatus(p.message);
            setActionStage(stageFromProgress(p.step, p.message));
          },
          submitTx,
        });
        onShielded?.();
      } else if (kind === 'merge') {
        if (assetKey !== 'eurc') {
          throw new Error(`${assetConfig.label} confidential merge is not deployed on this network yet.`);
        }
        await mergeConfidentialEurc({
          config: ctConfig,
          txSource: settlementAddress,
          smartAccount: settlementAddress,
          onProgress: (p) => {
            setStatus(p.message);
            setActionStage(stageFromProgress(p.step, p.message));
          },
          submitTx,
        });
      } else {
        if (assetKey !== 'eurc') {
          throw new Error(`${assetConfig.label} confidential unshield is not deployed on this network yet.`);
        }
        await unshieldConfidentialEurc({
          config: ctConfig,
          txSource: settlementAddress,
          smartAccount: settlementAddress,
          amount,
          onProgress: (p) => {
            setStatus(p.message);
            setActionStage(stageFromProgress(p.step, p.message));
          },
          submitTx,
        });
      }
      if (kind !== 'shield') setAmount('');
      await refresh();
      setActionStage('done');
      setStatus(kind === 'merge' ? `Private ${assetConfig.assetCode} is now spendable.` : `Private ${assetConfig.assetCode} balance updated.`);
    } catch (err) {
      setError(formatSorobanUserError(err instanceof Error ? err.message : String(err)));
    } finally {
      window.setTimeout(() => {
        setActionLoading(null);
        setActionStage(null);
      }, 900);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className={
          compact
            ? 'rounded-2xl border border-[#007dfc]/20 bg-gradient-to-br from-[#007dfc]/[0.06] via-white to-[#f6f9fc] p-5 shadow-[0_16px_48px_rgba(0,125,252,0.08)]'
            : 'mt-4 rounded-2xl border border-[var(--lg-border)] bg-white p-4'
        }
      >
        <div className="flex items-start gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#007dfc]/10 text-[#007dfc]">
            <Shield className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#012b54]">
              {compact ? 'Shield before you send' : `Move ${assetConfig.assetCode} between public and private`}
            </p>
            <p className="mt-0.5 text-xs text-[#64748b]">
              {compact
                ? `Deposit public ${assetConfig.assetCode} into your confidential wrapper — same flow as Dashboard, without leaving Send.`
                : `Shield public ${assetConfig.assetCode} before private settlement, merge received private balance, or unshield back to public.`}
            </p>
          </div>
        </div>

        {registered && publicEurcAvailable ? (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2 text-sm text-[#335b7e]"
          >
            {publicBalance} public {assetConfig.assetCode} available — shield here or Lumengate auto-shields during send.
          </motion.p>
        ) : null}

        <div className="mt-4 flex items-end justify-between gap-4 rounded-2xl bg-[#f6f9fc] px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Spendable private</p>
            <motion.p
              key={revealed ? 'open' : 'closed'}
              initial={{ opacity: 0, filter: 'blur(4px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.35 }}
              className="mt-1 text-xl font-semibold tabular-nums text-[#012b54]"
            >
              {loading && !balance
                ? '…'
                : !registered
                  ? 'Register first'
                  : !balance?.spendableSynced
                    ? 'Syncing…'
                    : revealed
                      ? `${formatConfidentialAmount(balance?.spendable ?? 0n)} ${assetConfig.assetCode}`
                      : '••••••'}
            </motion.p>
          </div>
          <div className="flex gap-2">
            {registered ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRevealed((v) => !v)}
                aria-label={revealed ? 'Hide balance' : 'Reveal balance'}
              >
                {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" loading={loading} onClick={() => void refresh()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="Amount"
            className="min-w-[9rem] flex-1 rounded-xl border border-[var(--lg-border)] bg-[#f6f9fc] px-3 py-2 text-sm outline-none transition focus:border-[#007dfc]/40 focus:shadow-[0_0_0_4px_rgba(0,125,252,0.08)]"
          />
          <Button
            variant="secondary"
            size="sm"
            loading={actionLoading === 'shield'}
            disabled={!registered || !amount || Boolean(actionLoading)}
            onClick={() => void runAction('shield')}
          >
            Shield
          </Button>
          <Button
            variant="secondary"
            size="sm"
            loading={actionLoading === 'unshield'}
            disabled={!amount || !registered || Boolean(actionLoading)}
            onClick={() => void runAction('unshield')}
          >
            Unshield
          </Button>
          <Button
            variant="secondary"
            size="sm"
            loading={actionLoading === 'merge'}
            disabled={!registered || !balance || balance.receiving <= 0n || Boolean(actionLoading)}
            onClick={() => void runAction('merge')}
          >
            Merge received
          </Button>
        </div>

        <AnimatePresence>
          {error ? (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {error}
            </motion.p>
          ) : null}
        </AnimatePresence>
        {status ? (
          <p className="mt-3 rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2 text-sm text-[#335b7e]" role="status">
            {status}
          </p>
        ) : null}
        {actionStage ? (
          <div className="mt-3 rounded-2xl border border-[#007dfc]/15 bg-white px-4 py-4 shadow-[0_12px_32px_rgba(1,43,84,0.06)]">
            <StageProgress
              stages={CT_ACTION_STAGES}
              currentStageId={actionStage}
              indeterminate={actionStage !== 'done'}
              aria-label="Confidential EURC operation progress"
            />
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
