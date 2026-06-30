import { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { Pill } from '../design/Primitives';
import { useApp } from '../../context/AppContext';
import {
  mergeConfidentialEurc,
  shieldConfidentialEurc,
  unshieldConfidentialEurc,
} from '../../lib/confidentialFlow';
import { formatConfidentialAmount } from '../../lib/confidentialBalance';
import { readEurcSacBalance } from '../../lib/contracts';
import { withRetry } from '../../lib/retry';
import { TrustedDeviceSessionPanel } from './TrustedDeviceSessionPanel';
import { StageProgress, type StageProgressItem } from '../design/StageProgress';

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

export function ConfidentialBalancePanel() {
  const {
    config,
    settlementAddress,
    ensureProofForAsset,
    signAndSubmitSettlement,
    confidentialEurcBalance,
    confidentialBalanceLoading,
    refreshConfidentialEurcBalance,
  } = useApp();
  const [publicBalance, setPublicBalance] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<'shield' | 'merge' | 'unshield' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [actionStage, setActionStage] = useState<CtActionStage | null>(null);
  const [amount, setAmount] = useState('');
  const [revealed, setRevealed] = useState(false);

  const refresh = useCallback(async () => {
    if (!settlementAddress || !config.confidentialTokenId) {
      return;
    }
    setError(null);
    try {
      await refreshConfidentialEurcBalance();
      const publicEurc = config.eurcSacId
        ? await withRetry(() => readEurcSacBalance(config, settlementAddress), {
            attempts: 5,
            baseDelayMs: 900,
            maxDelayMs: 6_000,
          }).catch(() => null)
        : null;
      setPublicBalance(publicEurc);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [config, settlementAddress, refreshConfidentialEurcBalance]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!config.confidentialTokenId || !settlementAddress) return null;

  const balance = confidentialEurcBalance;
  const loading = confidentialBalanceLoading;
  const registered = balance?.registered === true;
  const hasShielded = balance ? balance.total > 0n : false;
  const publicEurcAvailable = publicBalance !== null && Number(publicBalance) > 0;

  const runAction = async (kind: 'shield' | 'merge' | 'unshield') => {
    setActionLoading(kind);
    setError(null);
    setStatus(null);
    setActionStage('preparing');
    try {
      const ensured = await ensureProofForAsset('eurc', (message) => {
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
        await shieldConfidentialEurc({
          config,
          txSource: settlementAddress,
          smartAccount: settlementAddress,
          amount,
          onProgress: (p) => {
            setStatus(p.message);
            setActionStage(stageFromProgress(p.step, p.message));
          },
          submitTx,
        });
      } else if (kind === 'merge') {
        await mergeConfidentialEurc({
          config,
          txSource: settlementAddress,
          smartAccount: settlementAddress,
          onProgress: (p) => {
            setStatus(p.message);
            setActionStage(stageFromProgress(p.step, p.message));
          },
          submitTx,
        });
      } else {
        await unshieldConfidentialEurc({
          config,
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
      setAmount('');
      await refresh();
      setActionStage('done');
      setStatus(kind === 'merge' ? 'Private EURC is now spendable.' : 'Private EURC balance updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      window.setTimeout(() => {
        setActionLoading(null);
        setActionStage(null);
      }, 900);
    }
  };

  return (
    <div className="space-y-4">
      <TrustedDeviceSessionPanel />
      <div className="lg-surface-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#012b54]">Confidential EURC balance</p>
          <p className="mt-1 text-sm text-[#64748b]">
            Shielded amount stays off the public ledger. Public EURC must be deposited into the confidential wrapper
            before it appears here.
          </p>
        </div>
        {registered ? (
          <Pill tone={hasShielded ? 'success' : 'neutral'}>{hasShielded ? 'Shielded' : 'Registered'}</Pill>
        ) : (
          <Pill tone="warning">Not registered</Pill>
        )}
      </div>

      {registered && publicEurcAvailable ? (
        <p className="mt-3 rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2 text-sm text-[#335b7e]">
          {publicBalance} public EURC is available in this smart account. Shield it here, or Lumengate will shield
          the needed amount during a private send.
        </p>
      ) : null}

      <div className="mt-5 flex items-end justify-between gap-4 rounded-2xl bg-[#f6f9fc] px-5 py-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Spendable</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[#012b54]">
            {loading
              ? '…'
              : !registered
                ? '—'
                : revealed
                  ? `${formatConfidentialAmount(balance?.spendable ?? 0n)} EURC`
                  : '••••••'}
          </p>
          {registered && revealed && balance && balance.receiving > 0n ? (
            <p className="mt-1 text-xs text-[#64748b]">
              + {formatConfidentialAmount(balance.receiving)} receiving (merge before send)
            </p>
          ) : null}
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

      <div className="mt-4 rounded-2xl border border-[var(--lg-border)] bg-white p-4">
        <p className="text-sm font-semibold text-[#012b54]">Move EURC between public and private</p>
        <p className="mt-1 text-xs text-[#64748b]">
          Shield public EURC before private settlement, merge received private EURC into spendable balance, or unshield
          back to public EURC.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="Amount"
            className="min-w-[9rem] flex-1 rounded-xl border border-[var(--lg-border)] bg-[#f6f9fc] px-3 py-2 text-sm outline-none focus:border-[#007dfc]/40"
          />
          <Button
            variant="secondary"
            size="sm"
            loading={actionLoading === 'shield'}
            disabled={!amount || Boolean(actionLoading)}
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
      </div>

      {error ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
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
    </div>
  );
}
