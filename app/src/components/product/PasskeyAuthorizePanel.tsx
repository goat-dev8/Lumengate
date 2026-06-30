import { useState } from 'react';
import { Fingerprint } from 'lucide-react';
import { Button } from '../ui/Button';
import { useApp } from '../../context/AppContext';
import { proofMatchesCredential } from '../../lib/credentialProof';

export function PasskeyAuthorizePanel() {
  const {
    credential,
    proof,
    proofLifecycle,
    sessionProofBound,
    bindSessionProofIfNeeded,
    refreshSessionProofBound,
  } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const activeProof =
    proofLifecycle.lifecycle === 'ready' &&
    proof &&
    credential &&
    proofMatchesCredential(proof, credential)
      ? proof
      : null;

  if (!activeProof || sessionProofBound !== false) return null;

  const handleAuthorize = async () => {
    setLoading(true);
    setError(null);
    setStatus('Opening passkey — confirm with Face ID, fingerprint, or device PIN…');
    try {
      const bindHash = await bindSessionProofIfNeeded(activeProof);
      await refreshSessionProofBound(activeProof);
      setStatus(
        bindHash
          ? 'Passkey authorized on-chain. You can register for confidential EURC or send funds.'
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
