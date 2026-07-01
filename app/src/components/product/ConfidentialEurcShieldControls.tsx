import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, EyeOff, KeyRound, RefreshCw, Shield, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { StageProgress, type StageProgressItem } from '../design/StageProgress';
import { useApp } from '../../context/AppContext';
import {
  mergeConfidentialAsset,
  registerConfidentialAccount,
  shieldConfidentialAsset,
  unshieldConfidentialAsset,
} from '../../lib/confidentialFlow';
import {
  confidentialAssetReady,
  resolveConfidentialAsset,
  withConfidentialContracts,
  type ConfidentialAssetKey,
} from '../../lib/confidentialAssetConfig';
import { formatConfidentialAmount } from '../../lib/confidentialBalance';
import { readComplianceAdminUsdcBalance, readEurcSacBalance, formatSorobanUserError, isSessionProofBoundOnChain } from '../../lib/contracts';
import { withRetry } from '../../lib/retry';
import { ASSET_SCOPES } from '../../lib/assetScope';
import { proofMatchesCredential } from '../../lib/credentialProof';
import { isProofBoundLocally } from '../../lib/proofBindCache';
import { assertScopeNullifierAvailable } from '../../lib/scopeNullifier';
import { syncProofLifecycleOnChain } from '../../lib/proofLifecycle';
import { resolvePasskeySimulationSource } from '../../lib/smartAccount';
import { PasskeyAuthorizePanel } from './PasskeyAuthorizePanel';

type CtActionStage = 'preparing' | 'proof' | 'deposit' | 'confirming' | 'merge' | 'sync' | 'done';
type CtRegisterStage = 'preparing' | 'proof' | 'submit' | 'done';

function ctActionStages(assetCode: string): StageProgressItem[] {
  return [
    { id: 'preparing', label: 'Preparing private operation', hint: 'Checking account and passport state' },
    { id: 'proof', label: 'Generating local proof', hint: 'Cryptography runs in this browser' },
    { id: 'deposit', label: 'Creating confidential commitment', hint: `Shielding public ${assetCode} into the wrapper` },
    { id: 'confirming', label: 'Waiting for Stellar confirmation', hint: 'Testnet ledgers can briefly lag' },
    { id: 'merge', label: 'Merging spendable balance', hint: `Moving received balance into spendable private ${assetCode}` },
    { id: 'sync', label: 'Synchronizing private balance', hint: 'Verifying local openings against chain commitments' },
    { id: 'done', label: 'Ready', hint: `Private ${assetCode} balance is up to date` },
  ];
}

function ctRegisterStages(assetCode: string): StageProgressItem[] {
  return [
    { id: 'preparing', label: `Checking ${assetCode} passport scope`, hint: 'Uses the same passkey passport as compliant settlement' },
    { id: 'proof', label: 'Generating registration proof', hint: 'UltraHonk proof runs locally in this browser' },
    { id: 'submit', label: 'Registering on Stellar', hint: `One passkey confirmation to create your private ${assetCode} account` },
    { id: 'done', label: 'Registered', hint: `You can shield public ${assetCode} into private balance next` },
  ];
}

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
  onRegistered?: () => void;
  assetKey?: ConfidentialAssetKey;
};

export function ConfidentialEurcShieldControls({
  variant = 'dashboard',
  suggestedAmount,
  onShielded,
  onRegistered,
  assetKey = 'eurc',
}: Props) {
  const {
    config,
    address,
    credential,
    proof,
    smartAccount,
    settlementAddress,
    ensureProofForAsset,
    bindSessionProofIfNeeded,
    signAndSubmitSettlement,
    confidentialEurcBalance,
    confidentialUsdcBalance,
    confidentialBalanceLoadingFor,
    refreshConfidentialBalance,
    consumedTxHash,
    proofLifecycle,
    sessionProofBound,
    refreshSessionProofBound,
  } = useApp();
  const assetConfig = resolveConfidentialAsset(config, assetKey);
  const scope = ASSET_SCOPES[assetKey];
  const ctConfig = assetConfig.contracts ? withConfidentialContracts(config, assetConfig) : config;
  const actionStages = useMemo(() => ctActionStages(assetConfig.assetCode), [assetConfig.assetCode]);
  const registerStages = useMemo(() => ctRegisterStages(assetConfig.assetCode), [assetConfig.assetCode]);
  const [publicBalance, setPublicBalance] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<'shield' | 'merge' | 'unshield' | null>(null);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerStage, setRegisterStage] = useState<CtRegisterStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [actionStage, setActionStage] = useState<CtActionStage | null>(null);
  const [amount, setAmount] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [scopeProofBound, setScopeProofBound] = useState<boolean | null>(null);

  const refreshPublicBalance = useCallback(async () => {
    if (!settlementAddress || !assetConfig.contracts) return;
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
  }, [assetConfig.contracts, assetKey, config, settlementAddress]);

  const refresh = useCallback(async () => {
    if (!settlementAddress || !assetConfig.contracts) return;
    setError(null);
    try {
      await refreshConfidentialBalance(assetKey);
      await refreshPublicBalance();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [assetConfig.contracts, assetKey, refreshConfidentialBalance, refreshPublicBalance, settlementAddress]);

  useEffect(() => {
    void refreshPublicBalance();
  }, [refreshPublicBalance]);

  useEffect(() => {
    if (
      !settlementAddress ||
      !proof ||
      !credential ||
      !proofMatchesCredential(proof, credential) ||
      proof.publicInputs.assetId !== scope.assetId
    ) {
      setScopeProofBound(null);
      return;
    }
    if (sessionProofBound === true || isProofBoundLocally(proof)) {
      setScopeProofBound(true);
      return;
    }
    let cancelled = false;
    void isSessionProofBoundOnChain(config, settlementAddress, proof).then((bound) => {
      if (!cancelled) setScopeProofBound(bound);
    });
    return () => {
      cancelled = true;
    };
  }, [config, settlementAddress, proof, credential, scope.assetId, sessionProofBound]);

  const effectiveScopeProofBound = scopeProofBound === true || sessionProofBound === true;

  useEffect(() => {
    if (suggestedAmount) {
      setAmount(suggestedAmount);
    }
  }, [suggestedAmount]);

  if (!confidentialAssetReady(config, assetKey) || !settlementAddress) return null;

  const balance = assetKey === 'usdc' ? confidentialUsdcBalance : confidentialEurcBalance;
  const loading = confidentialBalanceLoadingFor(assetKey);
  const registrationSettled = balance !== null || !loading;
  const registered = balance?.registered === true;
  const publicAssetAvailable = publicBalance !== null && Number(publicBalance) > 0;
  const compact = variant === 'send';

  const needsPasskeyAuth =
    registrationSettled &&
    !registered &&
    Boolean(credential) &&
    (!proof ||
      !credential ||
      !proofMatchesCredential(proof, credential) ||
      proof.publicInputs.assetId !== scope.assetId ||
      effectiveScopeProofBound !== true) &&
    proofLifecycle.lifecycle === 'ready';

  const proofReadyAndBound =
    proofLifecycle.lifecycle === 'ready' &&
    proof &&
    credential &&
    proofMatchesCredential(proof, credential) &&
    proof.publicInputs.assetId === scope.assetId &&
    effectiveScopeProofBound === true;

  const handleRegister = async () => {
    if (!smartAccount || !settlementAddress) {
      setError(`Create your passkey smart account on Verify before registering for confidential ${assetConfig.assetCode}.`);
      return;
    }
    if (!credential) {
      setError(`Request your Private Financial Passport on Verify before registering for confidential ${assetConfig.assetCode}.`);
      return;
    }
    setRegisterLoading(true);
    setRegisterStage('preparing');
    setError(null);
    setStatus(null);
    let registerSucceeded = false;
    try {
      let scopedProof = proof;
      let scopedCredential = credential;
      if (
        !scopedProof ||
        !proofMatchesCredential(scopedProof, credential) ||
        scopedProof.publicInputs.assetId !== scope.assetId
      ) {
        const ensured = await ensureProofForAsset(assetKey, (message) => {
          setStatus(message);
          if (message.toLowerCase().includes('proof')) setRegisterStage('proof');
        });
        scopedProof = ensured.proof;
        scopedCredential = ensured.credential;
      }
      setRegisterStage('proof');
      await assertScopeNullifierAvailable(config, credential, assetKey);
      const lifecycle = await syncProofLifecycleOnChain(config, scopedCredential, scopedProof, consumedTxHash);
      if (lifecycle.lifecycle !== 'ready') {
        throw new Error(lifecycle.reason ?? 'Passport not ready for confidential registration.');
      }
      await bindSessionProofIfNeeded(scopedProof);
      await refreshSessionProofBound(scopedProof);
      setScopeProofBound(true);
      setRegisterStage('submit');
      setStatus(`Confirm with your passkey to register confidential ${assetConfig.assetCode}…`);
      await registerConfidentialAccount({
        config: ctConfig,
        assetKey,
        txSource: resolvePasskeySimulationSource(address),
        smartAccount: settlementAddress,
        submitTx: (tx) => signAndSubmitSettlement(settlementAddress, scopedProof!, tx),
      });
      setRegisterStage('done');
      registerSucceeded = true;
      setStatus(`Confidential ${assetConfig.assetCode} account registered. You can shield next.`);
      await refresh();
      onRegistered?.();
    } catch (err) {
      setRegisterStage(null);
      setError(formatSorobanUserError(err instanceof Error ? err.message : String(err)));
    } finally {
      const delayMs = registerSucceeded ? 1200 : 0;
      window.setTimeout(() => {
        setRegisterLoading(false);
        if (!registerSucceeded) setRegisterStage(null);
      }, delayMs);
    }
  };

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
        await shieldConfidentialAsset({
          config: ctConfig,
          assetKey,
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
        await mergeConfidentialAsset({
          config: ctConfig,
          assetKey,
          txSource: settlementAddress,
          smartAccount: settlementAddress,
          onProgress: (p) => {
            setStatus(p.message);
            setActionStage(stageFromProgress(p.step, p.message));
          },
          submitTx,
        });
      } else {
        await unshieldConfidentialAsset({
          config: ctConfig,
          assetKey,
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
      setStatus(
        kind === 'merge'
          ? `Private ${assetConfig.assetCode} is now spendable.`
          : `Private ${assetConfig.assetCode} balance updated.`,
      );
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

        {needsPasskeyAuth ? (
          <div className="mt-4">
            <PasskeyAuthorizePanel
              asset={assetKey}
              onAuthorized={() => {
                void refreshSessionProofBound(proof ?? undefined);
                void refresh();
                onRegistered?.();
              }}
            />
          </div>
        ) : null}

        <AnimatePresence mode="wait">
          {registrationSettled && !registered ? (
            <motion.div
              key="register-cta"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="relative mt-4 overflow-hidden rounded-2xl border border-[#007dfc]/25 bg-gradient-to-br from-[#007dfc]/[0.08] via-white to-[#f6f9fc] p-4 shadow-[0_12px_40px_rgba(0,125,252,0.12)]"
            >
              <motion.span
                className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-[#007dfc]/20"
                animate={{ opacity: [0.35, 0.75, 0.35] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                aria-hidden
              />
              <div className="relative flex items-start gap-3">
                <motion.span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#007dfc] text-white shadow-[0_8px_24px_rgba(0,125,252,0.35)]"
                  animate={{ scale: [1, 1.04, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <KeyRound className="h-5 w-5" />
                </motion.span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#012b54]">
                    Register confidential {assetConfig.assetCode}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[#64748b]">
                    One-time setup on Stellar testnet. Uses your passkey passport — then you can shield and send
                    privately from this screen.
                  </p>
                  {proofReadyAndBound ? (
                    <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <Sparkles className="h-3.5 w-3.5" />
                      Passport ready — tap register below
                    </p>
                  ) : null}
                  <motion.div
                    className="mt-4"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <Button
                      className="w-full sm:w-auto"
                      loading={registerLoading}
                      disabled={Boolean(needsPasskeyAuth)}
                      onClick={() => void handleRegister()}
                    >
                      Register confidential {assetConfig.assetCode}
                    </Button>
                  </motion.div>
                  {registerStage ? (
                    <div className="mt-4 rounded-xl border border-[#007dfc]/15 bg-white px-3 py-3">
                      <StageProgress
                        stages={registerStages}
                        currentStageId={registerStage}
                        indeterminate={registerStage !== 'done'}
                        aria-label={`Confidential ${assetConfig.assetCode} registration progress`}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {registered && publicAssetAvailable ? (
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
              key={registered ? (revealed ? 'open' : 'closed') : 'register'}
              initial={{ opacity: 0, filter: 'blur(4px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.35 }}
              className="mt-1 text-xl font-semibold tabular-nums text-[#012b54]"
            >
              {loading && !balance
                ? '…'
                : !registered
                  ? 'Not registered yet'
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

        {registered ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.35 }}
            className="mt-4 flex flex-wrap items-center gap-2"
          >
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
              disabled={!amount || Boolean(actionLoading)}
              onClick={() => void runAction('shield')}
            >
              Shield
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={actionLoading === 'unshield'}
              disabled={!amount || Boolean(actionLoading)}
              onClick={() => void runAction('unshield')}
            >
              Unshield
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={actionLoading === 'merge'}
              disabled={!balance || balance.receiving <= 0n || Boolean(actionLoading)}
              onClick={() => void runAction('merge')}
            >
              Merge received
            </Button>
          </motion.div>
        ) : null}

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
              stages={actionStages}
              currentStageId={actionStage}
              indeterminate={actionStage !== 'done'}
              aria-label={`Confidential ${assetConfig.assetCode} operation progress`}
            />
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
