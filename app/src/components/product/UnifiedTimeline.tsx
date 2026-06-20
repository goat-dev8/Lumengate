import { ExternalLink } from 'lucide-react';
import { Badge } from '../ui/Badge';
import type { ActivityEntry } from '../../lib/activity';
import type { ProofReceipt } from '../../lib/proofReceipt';

export type TimelineItem = {
  id: string;
  title: string;
  detail: string;
  timestamp: number | string;
  tone: 'ok' | 'brand' | 'warn' | 'neutral';
  txHash?: string;
  explorerUrl?: string;
  source: 'session' | 'chain' | 'receipt';
};

export function buildUnifiedTimeline(
  activity: ActivityEntry[],
  receipt: ProofReceipt | null,
): TimelineItem[] {
  const items: TimelineItem[] = [];

  for (const entry of activity) {
    if (entry.kind === 'verify' && entry.title === 'Wallet connected') continue;
    items.push({
      id: entry.id,
      title: entry.title,
      detail: entry.detail,
      timestamp: entry.timestamp,
      tone: entry.status === 'error' ? 'warn' : entry.kind === 'transfer' ? 'ok' : 'brand',
      txHash: entry.txHash,
      explorerUrl: entry.explorerUrl,
      source: 'session',
    });
  }

  if (receipt?.transactions.transfer) {
    items.push({
      id: `receipt-transfer-${receipt.transactions.transfer}`,
      title: 'Settlement verified',
      detail: receipt.transferResult
        ? `${receipt.transferResult.amount} RWA → ${receipt.transferResult.to.slice(0, 8)}…`
        : receipt.transactions.transfer,
      timestamp: receipt.verificationTimestamp ?? receipt.createdAt,
      tone: receipt.settlementStatus === 'verified' ? 'ok' : 'warn',
      txHash: receipt.transactions.transfer,
      explorerUrl: receipt.explorerLinks.transfer,
      source: 'receipt',
    });
  }

  for (const ev of receipt?.events ?? []) {
    items.push({
      id: `${ev.txHash}-${ev.kind}-${ev.ledger}`,
      title: ev.kind,
      detail: ev.summary,
      timestamp: ev.ledgerClosedAt,
      tone: ev.kind === 'TransferGated' || ev.kind === 'NullifierSpent' ? 'ok' : 'brand',
      txHash: ev.txHash,
      explorerUrl: receipt?.explorerLinks.transfer,
      source: 'chain',
    });
  }

  return items
    .sort((a, b) => {
      const ta = typeof a.timestamp === 'number' ? a.timestamp : Date.parse(String(a.timestamp));
      const tb = typeof b.timestamp === 'number' ? b.timestamp : Date.parse(String(b.timestamp));
      return tb - ta;
    })
    .filter((item, idx, arr) => arr.findIndex((x) => x.id === item.id) === idx);
}

type Props = {
  items: TimelineItem[];
  emptyMessage?: string;
};

export function UnifiedTimeline({ items, emptyMessage }: Props) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-[#64748b]">
        {emptyMessage ?? 'Complete credential → proof → transfer to populate timeline.'}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item, index) => (
        <li key={item.id} className="relative flex gap-4 pl-1">
          {index < items.length - 1 ? (
            <span className="absolute left-[11px] top-8 h-[calc(100%-8px)] w-px bg-[#e2e8f0]" aria-hidden />
          ) : null}
          <span className="relative z-10 mt-1 h-3 w-3 shrink-0 rounded-full bg-[#007dfc] ring-4 ring-[#007dfc]/15" />
          <div className="min-w-0 flex-1 rounded-xl bg-[#f6f9fc] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-[#012b54]">{item.title}</span>
              <Badge tone={item.tone}>{item.source}</Badge>
            </div>
            <p className="mt-1 text-sm text-[#64748b]">{item.detail}</p>
            <p className="mt-1 text-xs text-[#94a3b8]">
              {typeof item.timestamp === 'number'
                ? new Date(item.timestamp).toLocaleString()
                : new Date(item.timestamp).toLocaleString()}
            </p>
            {item.explorerUrl ? (
              <a
                href={item.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#007dfc] hover:underline"
              >
                Stellar Expert <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
