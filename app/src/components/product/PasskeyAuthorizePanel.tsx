import { useState } from 'react';
import { Fingerprint } from 'lucide-react';
import { Button } from '../ui/Button';
import { StageProgress, SESSION_ENABLE_STAGES } from '../design/StageProgress';
import { useApp } from '../../context/AppContext';
import type { LumengateSessionEnableProgress } from '../../context/AppContext';
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
    lumengateSessionStatus,
    ensureProofForAsset,
    bindSessionProofIfNeeded,
    enableLumengateSession,
    refreshSessionProofBound,
  } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [sessionStage, setSessionStage] = useState<LumengateSessionEnableProgress['stage'] | null>(null);

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
  const sessionEnabled = lumengateSessionStatus?.enabled === true;

  if (!credential) return null;
  if (asset) {
    if (requestedScopeAuthorized && sessionEnabled) return null;
  } else if ((!activeProof || sessionProofBound !== false) && sessionEnabled) {
    return null;
  }

  const handleAuthorize = async () => {
    setLoading(true);
    setError(null);
    setSessionStage(null);
    setStatus(null);
    try {
      if (!sessionEnabled) {
        await enableLumengateSession({
          onProgress: (progress) => {
            setSessionStage(progress.stage);
            setStatus(progress.message);
          },
        });
        setSessionStage('done');
        setStatus('7-day Lumengate session installed and passport eligibility is bound.');
      } else {
        const needsProofBind = asset ? !requestedScopeAuthorized : Boolean(activeProof && sessionProofBound === false);
        const proofToBind = needsProofBind
          ? asset && (!activeProof || !activeProofMatchesScope)
            ? (await ensureProofForAsset(asset, (message) => setStatus(message))).proof
            : activeProof
          : null;
        if (needsProofBind && !proofToBind) {
          throw new Error('Generate your private passport proof before authorizing your passkey.');
        }
        const bindHash = proofToBind ? await bindSessionProofIfNeeded(proofToBind) : null;
        if (proofToBind) {
          await refreshSessionProofBound(proofToBind);
        }
        setStatus(
          bindHash
            ? 'Passkey authorized on-chain for this passport scope.'
            : '7-day Lumengate session is ready.',
        );
      }
    } catch (err) {
      setSessionStage(null);
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
            Approve a delegated 7-day Lumengate session, then eligible Passport, shield, merge, transfer, unshield,
            receipt, and disclosure actions reuse it while the on-chain rules remain valid.
          </p>
          {!sessionEnabled ? (
            <p className="mt-2 text-xs text-[#64748b]">
              You will see two passkey prompts in order: bind eligibility, then install the session rule.
            </p>
          ) : null}
          <Button className="mt-4" size="sm" loading={loading} onClick={() => void handleAuthorize()}>
            {sessionEnabled ? 'Authorize passkey' : 'Enable 7-day session'}
          </Button>
          {loading && !sessionEnabled ? (
            <div className="mt-4 rounded-2xl border border-[#007dfc]/15 bg-white px-4 py-4 shadow-[0_12px_32px_rgba(1,43,84,0.06)]">
              <StageProgress
                stages={SESSION_ENABLE_STAGES}
                currentStageId={sessionStage}
                indeterminate={sessionStage !== 'done' && sessionStage !== null}
                aria-label="Enable 7-day session progress"
              />
            </div>
          ) : null}
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
