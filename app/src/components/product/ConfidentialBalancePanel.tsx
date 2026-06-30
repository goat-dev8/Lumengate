import { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { Pill } from '../design/Primitives';
import { useApp } from '../../context/AppContext';
import {
  formatConfidentialAmount,
  readConfidentialEurcBalance,
  type ConfidentialEurcBalance,
} from '../../lib/confidentialBalance';

export function ConfidentialBalancePanel() {
  const { config, settlementAddress } = useApp();
  const [balance, setBalance] = useState<ConfidentialEurcBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const refresh = useCallback(async () => {
    if (!settlementAddress || !config.confidentialTokenId) {
      setBalance(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setBalance(await readConfidentialEurcBalance(config, settlementAddress));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [config, settlementAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!config.confidentialTokenId || !settlementAddress) return null;

  const registered = balance?.registered === true;
  const hasShielded = balance ? balance.total > 0n : false;

  return (
    <div className="lg-surface-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#012b54]">Confidential EURC balance</p>
          <p className="mt-1 text-sm text-[#64748b]">
            Shielded amount stays off the public ledger. Synced from your browser state and Stellar events.
          </p>
        </div>
        {registered ? (
          <Pill tone={hasShielded ? 'success' : 'neutral'}>{hasShielded ? 'Shielded' : 'Registered'}</Pill>
        ) : (
          <Pill tone="warning">Not registered</Pill>
        )}
      </div>

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

      {error ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
