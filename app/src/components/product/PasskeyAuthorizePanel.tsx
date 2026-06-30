import { useState } from 'react';
import { Fingerprint } from 'lucide-react';
import { Button } from '../ui/Button';
import { useApp } from '../../context/AppContext';
import { proofMatchesCredential } from '../../lib/credentialProof';
import {
  ASSET_SCOPES,
  proofScopeMatches,
  type SettlementAsset,
} from '../../lib/assetScope';

type Props = {
  asset?: SettlementAsset;
};

export function PasskeyAuthorizePanel({ asset }: Props) {
  const {
    credential,
    proof,
    proofLifecycle,
    sessionProofBound,
    ensureProofForAsset,
    bindSessionProofIfNeeded,
    refreshSessionProofBound,
  } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const proofReadyForCredential =
    proofLifecycle.lifecycle === 'ready' &&
    proof &&
    credential &&
    proofMatchesCredential(proof, credential);
  const activeProof = proofReadyForCredential ? proof : null;
  const requestedScope = asset ? ASSET_SCOPES[asset] : null;
  const activeProofMatchesScope =
    activeProof && requestedScope ? proofScopeMatches(activeProof, requestedScope) : Boolean(activeProof);
  const requestedScopeAuthorized =
    Boolean(activeProof && activeProofMatchesScope && sessionProofBound === true);

  if (!credential) return null;
  if (asset) {
    if (requestedScopeAuthorized) return null;
  } else if (!activeProof || sessionProofBound !== false) {
    return null;
  }

  const handleAuthorize = async () => {
    setLoading(true);
    setError(null);
    setStatus('Opening passkey — confirm with Face ID, fingerprint, or device PIN…');
    try {
      const proofToBind =
        asset && (!activeProof || !activeProofMatchesScope)
          ? (await ensureProofForAsset(asset, (message) => setStatus(message))).proof
          : activeProof;
      if (!proofToBind) {
        throw new Error('Generate your private passport proof before authorizing your passkey.');
      }
      setStatus('Opening passkey — confirm with Face ID, fingerprint, or device PIN…');
      const bindHash = await bindSessionProofIfNeeded(proofToBind);
      await refreshSessionProofBound(proofToBind);
      setStatus(
        bindHash
          ? 'Passkey authorized on-chain for this passport scope.'
          : 'Passkey already authorized for this proof.',
      );
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#007dfc]/25 bg-gradient-to-br from-[#007dfc]/8 to-white px-5 py-5">
      <div className="flex items-start gap-3">
        <Fingerprint className="mt-0.5 h-5 w-5 shrink-0 text-[#007dfc]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#012b54]">Authorize with your passkey</p>
          <p className="mt-1 text-sm text-[#64748b]">
            One passkey confirmation binds your proof on-chain so you can send, invest, or register for confidential
            EURC.
          </p>
          <Button className="mt-4" size="sm" loading={loading} onClick={() => void handleAuthorize()}>
            Authorize passkey
          </Button>
          {status ? (
            <p className="mt-3 text-sm text-[#007dfc]" role="status">
              {status}
            </p>
          ) : null}
          {error ? (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
