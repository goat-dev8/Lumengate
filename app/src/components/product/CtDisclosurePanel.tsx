import { useCallback, useEffect, useState } from 'react';
import { Copy, RefreshCw, Share2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Pill } from '../design/Primitives';
import { useApp } from '../../context/AppContext';
import { fetchCtEvents, syncCtEvents, type CtIndexedEvent } from '../../lib/ctApi';
import { truncateMiddle } from '../../lib/utils';

export function CtDisclosurePanel() {
  const { config, settlementAddress } = useApp();
  const [events, setEvents] = useState<CtIndexedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!config.confidentialTokenId || !settlementAddress) {
      setEvents([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await syncCtEvents(config).catch(() => undefined);
      const res = await fetchCtEvents(config, { account: settlementAddress });
      setEvents(res.events.filter((ev) => ev.type === 'transfer'));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [config, settlementAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const copyRef = async (ev: CtIndexedEvent) => {
    const payload = JSON.stringify(
      { ledger: ev.ledger, id: ev.id, txHash: ev.txHash, from: ev.from, to: ev.to },
      null,
      2,
    );
    await navigator.clipboard.writeText(payload);
    setCopiedId(ev.id);
    window.setTimeout(() => setCopiedId(null), 2000);
  };

  if (!config.confidentialTokenId || !settlementAddress) return null;

  return (
    <div className="lg-surface-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-[#007dfc]" />
            <p className="text-sm font-semibold text-[#012b54]">Confidential transfer disclosure</p>
          </div>
          <p className="mt-2 text-sm text-[#64748b]">
            Share an event reference with a counterparty or auditor. Amounts stay shielded on-chain; disclosure proofs
            bind to the indexed event id.
          </p>
        </div>
        <Pill tone="brand">Selective disclosure</Pill>
      </div>

      <Button className="mt-4" variant="secondary" size="sm" loading={loading} onClick={() => void refresh()}>
        <RefreshCw className="h-4 w-4" />
        Refresh CT events
      </Button>

      {error ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="mt-5 space-y-3">
        {events.length === 0 ? (
          <li className="text-sm text-[#64748b]">No confidential transfers found for your account yet.</li>
        ) : (
          events.map((ev) => {
            const inbound = ev.to === settlementAddress;
            return (
              <li key={ev.id} className="rounded-2xl border border-[var(--lg-border)] bg-white px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[#012b54]">{inbound ? 'Received' : 'Sent'} transfer</span>
                  <Pill tone={inbound ? 'success' : 'neutral'}>Ledger {ev.ledger}</Pill>
                </div>
                <p className="mt-1 font-mono text-xs text-[#64748b]">
                  {truncateMiddle(ev.from ?? '', 8, 6)} → {truncateMiddle(ev.to ?? '', 8, 6)}
                </p>
                <p className="mt-1 break-all font-mono text-[10px] text-[#94a3b8]">{ev.id}</p>
                <Button className="mt-3" variant="secondary" size="sm" onClick={() => void copyRef(ev)}>
                  <Copy className="h-3.5 w-3.5" />
                  {copiedId === ev.id ? 'Copied event ref' : 'Copy event reference'}
                </Button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
