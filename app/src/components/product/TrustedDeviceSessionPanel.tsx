import { useMemo, useState } from 'react';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { Button } from '../ui/Button';
import { Pill } from '../design/Primitives';
import { StageProgress, SESSION_ENABLE_STAGES } from '../design/StageProgress';
import { useApp } from '../../context/AppContext';
import type { LumengateSessionEnableProgress } from '../../context/AppContext';

function formatExpiry(expiresAt: number | null, validUntilLedger: number | null): string {
  if (expiresAt) {
    return new Date(expiresAt).toLocaleString();
  }
  if (validUntilLedger) {
    return `Ledger #${validUntilLedger.toLocaleString()}`;
  }
  return '—';
}

export function TrustedDeviceSessionPanel() {
  const {
    smartAccount,
    lumengateSessionStatus,
    enableLumengateSession,
    revokeLumengateSession,
    refreshLumengateSessionStatus,
    passkeyBusy,
  } = useApp();
  const [enabling, setEnabling] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [sessionStage, setSessionStage] = useState<LumengateSessionEnableProgress['stage'] | null>(null);

  const active = lumengateSessionStatus?.enabled === true;
  const expiryLabel = useMemo(
    () => formatExpiry(lumengateSessionStatus?.expiresAt ?? null, lumengateSessionStatus?.validUntilLedger ?? null),
    [lumengateSessionStatus],
  );

  if (!smartAccount) return null;

  const handleEnable = async () => {
    setEnabling(true);
    setError(null);
    setStatus(null);
    setSessionStage(null);
    try {
      const result = await enableLumengateSession({
        onProgress: (progress) => {
          setSessionStage(progress.stage);
          setStatus(progress.message);
        },
      });
      await refreshLumengateSessionStatus();
      setSessionStage('done');
      if (result.enabled) {
        setStatus('Trusted device session is active for 7 days.');
      } else {
        setStatus('Session rule was not detected on-chain yet. Approve both passkey prompts and try again.');
      }
    } catch (err) {
      setSessionStage(null);
      setStatus(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setEnabling(false);
    }
  };

  const handleRevoke = async () => {
    setRevoking(true);
    setError(null);
    setStatus(null);
    setSessionStage(null);
    try {
      await revokeLumengateSession();
      await refreshLumengateSessionStatus();
      setStatus('Local session key cleared. On-chain rules expire at their ledger deadline.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="lg-surface-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#012b54]">Trusted device (7 days)</p>
          <p className="mt-1 text-sm text-[#64748b]">
            Two passkey approvals in order: bind passport eligibility, then install the delegated session rule.
            Shield, merge, private send, passport, marketplace, and settlement reuse it until expiry.
          </p>
        </div>
        <Pill tone={active ? 'success' : 'neutral'}>{active ? 'Active' : 'Off'}</Pill>
      </div>

      <dl className="mt-4 grid gap-3 rounded-2xl border border-[var(--lg-border)] bg-[#f6f9fc] px-4 py-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Status</dt>
          <dd className="mt-1 font-medium text-[#012b54]">{active ? 'Session active' : 'Not enabled'}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Expires</dt>
          <dd className="mt-1 font-medium text-[#012b54]">{active ? expiryLabel : '—'}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {!active ? (
          <Button size="sm" loading={enabling || passkeyBusy} onClick={() => void handleEnable()}>
            <ShieldCheck className="mr-1.5 h-4 w-4" />
            Enable trusted device
          </Button>
        ) : (
          <Button variant="secondary" size="sm" loading={revoking} onClick={() => void handleRevoke()}>
            <ShieldOff className="mr-1.5 h-4 w-4" />
            Revoke session
          </Button>
        )}
      </div>

      {enabling ? (
        <div className="mt-4 rounded-2xl border border-[#007dfc]/15 bg-white px-4 py-4 shadow-[0_12px_32px_rgba(1,43,84,0.06)]">
          <StageProgress
            stages={SESSION_ENABLE_STAGES}
            currentStageId={sessionStage}
            indeterminate={sessionStage !== 'done' && sessionStage !== null}
            aria-label="Enable trusted device progress"
          />
        </div>
      ) : null}

      {status ? (
        <p className="mt-3 rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2 text-sm text-[#335b7e]" role="status">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
