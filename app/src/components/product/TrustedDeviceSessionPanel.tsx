import { useMemo, useState } from 'react';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { Button } from '../ui/Button';
import { Pill } from '../design/Primitives';
import { useApp } from '../../context/AppContext';

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

  const active = lumengateSessionStatus?.enabled === true;
  const expiryLabel = useMemo(
    () => formatExpiry(lumengateSessionStatus?.expiresAt ?? null, lumengateSessionStatus?.validUntilLedger ?? null),
    [lumengateSessionStatus],
  );

  if (!smartAccount) return null;

  const handleEnable = async () => {
    setEnabling(true);
    setError(null);
    setStatus('Installing delegated session rules — approve with your passkey when prompted…');
    try {
      const result = await enableLumengateSession();
      await refreshLumengateSessionStatus();
      if (result.enabled) {
        setStatus('Trusted device session is active for 7 days.');
      } else {
        setStatus(
          `Session partially installed (${result.installedContracts.length}/${result.installedContracts.length + result.missingContracts.length} contracts). Retry to finish setup.`,
        );
      }
    } catch (err) {
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
            One passkey approval installs delegated CallContract session rules. Shield, merge, private send, passport,
            marketplace, and settlement reuse the session until expiry.
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
