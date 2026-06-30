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
import { truncateMiddle } from '../../lib/utils';

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
    consumedTxHash,
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
    if (!credential || !smartAccount || !settlementAddress || !address) {
      setError('Complete passport verification and create your smart account first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const scope = ASSET_SCOPES.eurc;
      let scopedProof = proof;
      if (!scopedProof || !proofMatchesCredential(scopedProof, credential) || scopedProof.publicInputs.assetId !== scope.assetId) {
        const ensured = await ensureProofForAsset('eurc');
        scopedProof = ensured.proof;
      }
      const lifecycle = await syncProofLifecycleOnChain(config, credential, scopedProof, consumedTxHash);
      if (lifecycle.lifecycle !== 'ready') {
        throw new Error(lifecycle.reason ?? 'Passport not ready for confidential registration.');
      }
      const hash = await registerConfidentialEurcAccount({
        config,
        txSource: resolvePasskeySimulationSource(address),
        smartAccount: settlementAddress,
        submitTx: (tx) => signAndSubmitSettlement(settlementAddress, scopedProof!, tx),
      });
      if (hash) setTxHash(hash);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
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
        <Button className="mt-4 w-full" loading={loading} onClick={() => void handleRegister()}>
          Register confidential EURC
        </Button>
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
  );
}
