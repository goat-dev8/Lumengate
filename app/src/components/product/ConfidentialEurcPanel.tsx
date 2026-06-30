import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '../ui/Button';
import { Pill } from '../design/Primitives';
import { useApp } from '../../context/AppContext';
import { readConfidentialEurcRegistered, registerConfidentialEurcAccount } from '../../lib/confidentialFlow';
import { resolvePasskeySimulationSource } from '../../lib/smartAccount';
import { syncProofLifecycleOnChain } from '../../lib/proofLifecycle';
import { proofMatchesCredential } from '../../lib/credentialProof';
import { ASSET_SCOPES } from '../../lib/assetScope';
import { assertScopeNullifierAvailable } from '../../lib/scopeNullifier';
import { truncateMiddle } from '../../lib/utils';
import { formatSorobanUserError } from '../../lib/contracts';
import { PasskeyAuthorizePanel } from './PasskeyAuthorizePanel';

export function ConfidentialEurcPanel() {
  const {
    config,
    address,
    credential,
    proof,
    smartAccount,
    settlementAddress,
    signAndSubmitSettlement,
    ensureProofForAsset,
    bindSessionProofIfNeeded,
    consumedTxHash,
    sessionProofBound,
    proofLifecycle,
  } = useApp();
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!settlementAddress || !config.confidentialTokenId) {
      setRegistered(null);
      return;
    }
    setRegistered(await readConfidentialEurcRegistered(config, settlementAddress));
  }, [config, settlementAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh, txHash]);

  if (!config.confidentialTokenId || !settlementAddress) return null;

  const handleRegister = async () => {
    if (!smartAccount || !settlementAddress) {
      setError('Create your passkey smart account on Verify before registering for confidential EURC.');
      return;
    }
    if (!credential) {
      setError('Request your Private Financial Passport on Verify before registering for confidential EURC.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const scope = ASSET_SCOPES.eurc;
      let scopedProof = proof;
      if (
        !scopedProof ||
        !proofMatchesCredential(scopedProof, credential) ||
        scopedProof.publicInputs.assetId !== scope.assetId
      ) {
        const ensured = await ensureProofForAsset('eurc');
        scopedProof = ensured.proof;
      }
      await assertScopeNullifierAvailable(config, credential, 'eurc');
      const lifecycle = await syncProofLifecycleOnChain(config, credential, scopedProof, consumedTxHash);
      if (lifecycle.lifecycle !== 'ready') {
        throw new Error(lifecycle.reason ?? 'Passport not ready for confidential registration.');
      }
      await bindSessionProofIfNeeded(scopedProof);
      const hash = await registerConfidentialEurcAccount({
        config,
        txSource: resolvePasskeySimulationSource(address),
        smartAccount: settlementAddress,
        submitTx: (tx) => signAndSubmitSettlement(settlementAddress, scopedProof!, tx),
      });
      if (hash) setTxHash(hash);
      await refresh();
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      setError(formatSorobanUserError(raw));
    } finally {
      setLoading(false);
    }
  };

  const needsPasskeyAuth =
    proofLifecycle.lifecycle === 'ready' &&
    proof &&
    credential &&
    proofMatchesCredential(proof, credential) &&
    sessionProofBound === false;

  return (
    <div className="space-y-4">
      {needsPasskeyAuth ? <PasskeyAuthorizePanel /> : null}
      <div className="lg-surface-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#007dfc]" />
              <p className="text-sm font-semibold text-[#012b54]">Confidential EURC account</p>
            </div>
            <p className="mt-2 text-sm text-[#64748b]">
              Register once to send and receive shielded EURC on Stellar testnet. Uses the same passkey and passport as
              compliant settlement.
            </p>
            <p className="mt-2 font-mono text-xs text-[#64748b]">{truncateMiddle(settlementAddress, 10, 8)}</p>
          </div>
          {registered === true ? (
            <Pill tone="success">Registered</Pill>
          ) : registered === false ? (
            <Pill tone="warning">Not registered</Pill>
          ) : null}
        </div>
        {registered === false ? (
          <Button
            className="mt-4 w-full"
            loading={loading}
            disabled={Boolean(needsPasskeyAuth)}
            onClick={() => void handleRegister()}
          >
            Register confidential EURC
          </Button>
        ) : null}
        {needsPasskeyAuth ? (
          <p className="mt-3 text-sm text-amber-800">Authorize with passkey above before registering.</p>
        ) : null}
        {txHash ? (
          <p className="mt-3 break-all font-mono text-xs text-emerald-700">Registered — tx {txHash.slice(0, 16)}…</p>
        ) : null}
        {error ? (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
