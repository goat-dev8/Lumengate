import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyRound, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/Button';
import { Pill } from '../design/Primitives';
import { useApp } from '../../context/AppContext';
import { fetchCtEvents, syncCtEvents, type CtIndexedEvent } from '../../lib/ctApi';
import { auditTransfer } from '../../lib/confidentialToken/auditor/decrypt';
import { Grumpkin } from '../../lib/confidentialToken/crypto/grumpkin';
import { truncateMiddle } from '../../lib/utils';

function parseAuditorSecret(input: string): bigint {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Enter the auditor secret key.');
  const hex = trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed;
  return BigInt(`0x${hex}`);
}

function eventToTransfer(ev: CtIndexedEvent) {
  if (!ev.rE || !ev.sigma || !ev.vAudR || !ev.rAudR || !ev.vAudS || !ev.bAudS) {
    throw new Error('Transfer event missing auditor ciphertext fields. Run CT sync on the issuer service.');
  }
  const x = BigInt(ev.rE.x);
  const y = BigInt(ev.rE.y);
  const rE = x === 0n && y === 0n ? Grumpkin.ZERO : Grumpkin.fromAffine({ x, y });
  return {
    type: 'transfer' as const,
    ledger: ev.ledger,
    txHash: ev.txHash,
    cursor: ev.id,
    from: ev.from!,
    to: ev.to!,
    rE,
    vTilde: 0n,
    sigma: BigInt(ev.sigma),
    bTilde: 0n,
    vAudR: BigInt(ev.vAudR),
    rAudR: BigInt(ev.rAudR),
    vAudS: BigInt(ev.vAudS),
    bAudS: BigInt(ev.bAudS),
  };
}

export function CtAuditorPanel() {
  const { config } = useApp();
  const [auditorSecret, setAuditorSecret] = useState('');
  const [events, setEvents] = useState<CtIndexedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountFilter, setAccountFilter] = useState('');

  const refresh = useCallback(async () => {
    if (!config.confidentialTokenId) return;
    setLoading(true);
    setError(null);
    try {
      await syncCtEvents(config).catch(() => undefined);
      const res = await fetchCtEvents(config, accountFilter ? { account: accountFilter.trim() } : undefined);
      setEvents(res.events.filter((ev) => ev.type === 'transfer'));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [config, accountFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const decrypted = useMemo(() => {
    if (!auditorSecret.trim()) return [];
    let k: bigint;
    try {
      k = parseAuditorSecret(auditorSecret);
    } catch {
      return [];
    }
    return events
      .map((ev) => {
        try {
          const transfer = eventToTransfer(ev);
          const audit = auditTransfer(k, transfer);
          if (!audit.channelsAgree) return null;
          return { ev, audit };
        } catch {
          return null;
        }
      })
      .filter(Boolean) as { ev: CtIndexedEvent; audit: ReturnType<typeof auditTransfer> }[];
  }, [events, auditorSecret]);

  if (!config.confidentialTokenId) return null;

  return (
    <div className="lg-surface-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#007dfc]" />
            <p className="text-sm font-semibold text-[#012b54]">Confidential transfer auditor view</p>
          </div>
          <p className="mt-2 text-sm text-[#64748b]">
            Decrypt auditor ciphertexts from indexed CT transfer events. Testnet auditor secret is configured in
            deployments.json.
          </p>
        </div>
        <Pill tone="brand">CT auditor</Pill>
      </div>

      <label className="mt-5 block text-sm font-medium text-[#334155]">
        Auditor secret (hex)
        <div className="mt-2 flex items-center gap-3 rounded-2xl border border-[var(--lg-border)] bg-[#f6f9fc]/80 px-4 py-3">
          <KeyRound className="h-4 w-4 shrink-0 text-[#64748b]" />
          <input
            type="password"
            value={auditorSecret}
            onChange={(e) => setAuditorSecret(e.target.value)}
            className="min-w-0 flex-1 bg-transparent font-mono text-sm outline-none"
            placeholder="0x000…001"
          />
        </div>
      </label>

      <label className="mt-4 block text-sm font-medium text-[#334155]">
        Filter by account (optional)
        <input
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
          className="mt-2 w-full rounded-2xl border border-[var(--lg-border)] bg-white px-4 py-3 font-mono text-sm outline-none focus:border-[#007dfc]/40"
          placeholder="C… smart account"
        />
      </label>

      <Button className="mt-4" variant="secondary" loading={loading} onClick={() => void refresh()}>
        <RefreshCw className="h-4 w-4" />
        Sync & refresh transfers
      </Button>

      {error ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="mt-6 space-y-3">
        {decrypted.length === 0 ? (
          <li className="text-sm text-[#64748b]">
            {events.length === 0
              ? 'No confidential transfers indexed yet.'
              : auditorSecret.trim()
                ? 'No transfers decrypted — check auditor secret or sync.'
                : 'Enter auditor secret to decrypt transfer amounts.'}
          </li>
        ) : (
          decrypted.map(({ ev, audit }) => (
            <li key={ev.id} className="rounded-2xl border border-[var(--lg-border)] bg-white px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-[#012b54]">{audit.amount.toString()} units</span>
                <Pill tone="success">Decrypted</Pill>
              </div>
              <p className="mt-1 font-mono text-xs text-[#64748b]">
                {truncateMiddle(ev.from ?? '', 8, 6)} → {truncateMiddle(ev.to ?? '', 8, 6)}
              </p>
              <p className="mt-1 font-mono text-xs text-[#64748b]">tx {truncateMiddle(ev.txHash, 10, 8)}</p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
