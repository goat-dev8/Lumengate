import { useCallback, useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Pill } from '../design/Primitives';
import { useApp } from '../../context/AppContext';
import { registerConfidentialEurcAccount } from '../../lib/confidentialFlow';
import { readEurcSacBalance, formatSorobanUserError } from '../../lib/contracts';
import { withRetry } from '../../lib/retry';
import { TrustedDeviceSessionPanel } from './TrustedDeviceSessionPanel';
import { StageProgress, type StageProgressItem } from '../design/StageProgress';
import { proofMatchesCredential } from '../../lib/credentialProof';
import { ASSET_SCOPES } from '../../lib/assetScope';
import { assertScopeNullifierAvailable } from '../../lib/scopeNullifier';
import { syncProofLifecycleOnChain } from '../../lib/proofLifecycle';
import { resolvePasskeySimulationSource } from '../../lib/smartAccount';
import { PasskeyAuthorizePanel } from './PasskeyAuthorizePanel';
import { ConfidentialEurcShieldControls } from './ConfidentialEurcShieldControls';

const CT_REGISTER_STAGES: StageProgressItem[] = [
  { id: 'preparing', label: 'Checking EURC passport scope', hint: 'Uses the same passkey passport as compliant settlement' },
  { id: 'proof', label: 'Generating registration proof', hint: 'UltraHonk proof runs locally in this browser' },
  { id: 'submit', label: 'Registering on Stellar', hint: 'One passkey confirmation to create your private EURC account' },
  { id: 'done', label: 'Registered', hint: 'You can shield public EURC into private balance next' },
];

type CtRegisterStage = 'preparing' | 'proof' | 'submit' | 'done';

export function ConfidentialBalancePanel() {
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
    consumedTxHash,
    sessionProofBound,
    proofLifecycle,
    confidentialEurcBalance,
    confidentialBalanceLoading,
    refreshConfidentialEurcBalance,
  } = useApp();
  const [publicBalance, setPublicBalance] = useState<string | null>(null);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerStage, setRegisterStage] = useState<CtRegisterStage | null>(null);
  const [registerTxHash, setRegisterTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!settlementAddress || !config.confidentialTokenId) return;
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
  const registrationSettled = balance !== null || !loading;
  const registered = balance?.registered === true;
  const hasShielded = balance ? balance.total > 0n : false;
  const publicEurcAvailable = publicBalance !== null && Number(publicBalance) > 0;

  const needsPasskeyAuth =
    registrationSettled &&
    !registered &&
    Boolean(credential) &&
    (!proof ||
      !credential ||
      !proofMatchesCredential(proof, credential) ||
      proof.publicInputs.assetId !== ASSET_SCOPES.eurc.assetId ||
      sessionProofBound === false) &&
    proofLifecycle.lifecycle === 'ready';

  const eurcProofReadyAndBound =
    proofLifecycle.lifecycle === 'ready' &&
    proof &&
    credential &&
    proofMatchesCredential(proof, credential) &&
    proof.publicInputs.assetId === ASSET_SCOPES.eurc.assetId &&
    sessionProofBound === true;

  const handleRegister = async () => {
    if (!smartAccount || !settlementAddress) {
      setError('Create your passkey smart account on Verify before registering for confidential EURC.');
      return;
    }
    if (!credential) {
      setError('Request your Private Financial Passport on Verify before registering for confidential EURC.');
      return;
    }
    setRegisterLoading(true);
    setRegisterStage('preparing');
    setError(null);
    setStatus(null);
    let registerSucceeded = false;
    try {
      const scope = ASSET_SCOPES.eurc;
      let scopedProof = proof;
      let scopedCredential = credential;
      if (
        !scopedProof ||
        !proofMatchesCredential(scopedProof, credential) ||
        scopedProof.publicInputs.assetId !== scope.assetId
      ) {
        setRegisterStage('preparing');
        const ensured = await ensureProofForAsset('eurc', (message) => {
          setStatus(message);
          if (message.toLowerCase().includes('proof')) setRegisterStage('proof');
        });
        scopedProof = ensured.proof;
        scopedCredential = ensured.credential;
      }
      setRegisterStage('proof');
      await assertScopeNullifierAvailable(config, credential, 'eurc');
      const lifecycle = await syncProofLifecycleOnChain(config, scopedCredential, scopedProof, consumedTxHash);
      if (lifecycle.lifecycle !== 'ready') {
        throw new Error(lifecycle.reason ?? 'Passport not ready for confidential registration.');
      }
      await bindSessionProofIfNeeded(scopedProof);
      setRegisterStage('submit');
      setStatus('Confirm with your passkey to register confidential EURC…');
      const hash = await registerConfidentialEurcAccount({
        config,
        txSource: resolvePasskeySimulationSource(address),
        smartAccount: settlementAddress,
        submitTx: (tx) => signAndSubmitSettlement(settlementAddress, scopedProof!, tx),
      });
      if (hash) setRegisterTxHash(hash);
      setRegisterStage('done');
      registerSucceeded = true;
      setStatus('Confidential EURC account registered. You can shield public EURC next.');
      await refresh();
    } catch (err) {
      setRegisterStage(null);
      const raw = err instanceof Error ? err.message : String(err);
      setError(formatSorobanUserError(raw));
    } finally {
      const delayMs = registerSucceeded ? 1200 : 0;
      window.setTimeout(() => {
        setRegisterLoading(false);
        if (!registerSucceeded) setRegisterStage(null);
      }, delayMs);
    }
  };

  return (
    <div className="space-y-4">
      <TrustedDeviceSessionPanel />
      {needsPasskeyAuth ? <PasskeyAuthorizePanel asset="eurc" /> : null}
      <div className="lg-surface-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#012b54]">Confidential EURC balance</p>
            <p className="mt-1 text-sm text-[#64748b]">
              Shielded amount stays off the public ledger. Public EURC must be deposited into the confidential wrapper
              before it appears here.
            </p>
          </div>
          {!registrationSettled ? (
            <Pill tone="neutral">Checking…</Pill>
          ) : registered ? (
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

        {registrationSettled && !registered ? (
          <div className="mt-4 rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4">
            <p className="text-sm font-semibold text-[#012b54]">Register confidential EURC</p>
            <p className="mt-1 text-sm text-[#64748b]">
              Register once to send and receive shielded EURC. Uses the same passkey passport as compliant settlement.
              One passkey confirmation is required.
            </p>
            {needsPasskeyAuth ? (
              <p className="mt-3 text-sm text-amber-800">
                Authorize the EURC passport scope above before registering.
              </p>
            ) : eurcProofReadyAndBound ? (
              <p className="mt-3 text-sm text-emerald-700">
                EURC passport scope authorized. Register confidential EURC next.
              </p>
            ) : null}
            <Button
              className="mt-4"
              loading={registerLoading}
              disabled={Boolean(needsPasskeyAuth)}
              onClick={() => void handleRegister()}
            >
              Register confidential EURC
            </Button>
            {registerTxHash ? (
              <p className="mt-3 break-all font-mono text-xs text-emerald-700">
                Registered — tx {registerTxHash.slice(0, 16)}…
              </p>
            ) : null}
            {registerStage ? (
              <div className="mt-4 rounded-2xl border border-[#007dfc]/15 bg-white px-4 py-4 shadow-[0_12px_32px_rgba(1,43,84,0.06)]">
                <StageProgress
                  stages={CT_REGISTER_STAGES}
                  currentStageId={registerStage}
                  indeterminate={registerStage !== 'done'}
                  aria-label="Confidential EURC registration progress"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {registered ? <ConfidentialEurcShieldControls variant="dashboard" onShielded={() => void refresh()} /> : null}

        {error ? (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {!error && balance?.syncError ? (
          <p
            className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            role="alert"
          >
            {balance.syncError}
          </p>
        ) : null}
        {status && !registered ? (
          <p className="mt-3 rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2 text-sm text-[#335b7e]" role="status">
            {status}
          </p>
        ) : null}
      </div>
    </div>
  );
}
