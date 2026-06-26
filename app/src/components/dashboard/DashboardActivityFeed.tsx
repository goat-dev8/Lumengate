import { FileCheck2, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SectionHeader } from '../design/Primitives';
import type { ActivityEntry } from '../../lib/activity';
import { formatRelativeTime } from '../../lib/formatTime';

function activityIcon(kind: ActivityEntry['kind']) {
  switch (kind) {
    case 'transfer':
      return FileCheck2;
    case 'proof':
      return ShieldCheck;
    case 'credential':
      return ShieldCheck;
    default:
      return Sparkles;
  }
}

function activityTone(kind: ActivityEntry['kind']) {
  switch (kind) {
    case 'transfer':
      return 'bg-emerald-500/15 text-emerald-600';
    case 'proof':
      return 'bg-[#007dfc]/15 text-[#007dfc]';
    default:
      return 'bg-[var(--lg-muted-bg)] text-[#012b54]';
  }
}

function extractAmount(detail: string): string | null {
  const usd = detail.match(/\$[\d,.]+/);
  if (usd) return usd[0];
  const num = detail.match(/^(\d+(?:\.\d+)?)\s*(USDC|XLM|EURC|units)?/i);
  if (num) {
    const suffix = num[2] ? ` ${num[2].toUpperCase()}` : '';
    return `+${num[1]}${suffix}`;
  }
  return null;
}

export function DashboardActivityFeed({ activity }: { activity: ActivityEntry[] }) {
  const feed = activity.slice(0, 6);

  return (
    <div id="activity">
      <SectionHeader eyebrow="Activity" title="Recent" />
      <div className="mt-5 lg-surface-card divide-y divide-[var(--lg-border)] overflow-hidden">
        {feed.length === 0 ? (
          <p className="p-5 text-sm text-[#64748b]">
            No activity yet — verify eligibility to get started.
          </p>
        ) : (
          feed.map((item) => {
            const Icon = activityIcon(item.kind);
            const amount = extractAmount(item.detail);
            const receiptLink =
              item.kind === 'transfer' && item.txHash
                ? `/app/compliance?tx=${item.txHash}`
                : null;
            return (
              <div key={item.id} className="flex items-start gap-3 p-4">
                <div
                  className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${activityTone(item.kind)}`}
                >
                  {item.kind === 'transfer' ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#012b54]">{item.title}</p>
                  <p className="truncate text-xs text-[#64748b]">{item.detail}</p>
                </div>
                <div className="shrink-0 text-right">
                  {amount ? (
                    <p className="text-sm font-semibold tabular-nums text-[#012b54]">{amount}</p>
                  ) : receiptLink ? (
                    <Link to={receiptLink} className="text-xs font-medium text-[#007dfc] hover:underline">
                      View receipt
                    </Link>
                  ) : null}
                  <p className="text-[11px] text-[#94a3b8]">{formatRelativeTime(item.timestamp)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
