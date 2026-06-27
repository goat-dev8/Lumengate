import { Lock, Globe2 } from 'lucide-react';
import { cn } from '../../lib/cn';

export type PrivacySplitRow = {
  private: string;
  public: string;
};

const DEFAULT_ROWS: PrivacySplitRow[] = [
  { private: 'Name, date of birth, ID', public: 'Settlement amount' },
  { private: 'Sanctions screening result', public: 'Nullifier reference' },
  { private: 'Source of funds', public: 'Policy ID' },
  { private: 'Memo & invoice details', public: 'Transaction hash' },
];

type Props = {
  rows?: PrivacySplitRow[];
  className?: string;
  compact?: boolean;
  title?: string;
};

export function PrivacySplitCard({
  rows = DEFAULT_ROWS,
  className,
  compact = false,
  title = 'What stays private vs what reaches Stellar',
}: Props) {
  return (
    <div
      className={cn(
        'lg-surface-card overflow-hidden',
        compact ? 'p-4' : 'p-5 md:p-6',
        className,
      )}
    >
      {!compact ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">{title}</p>
      ) : null}
      <div className={cn('grid gap-3', compact ? 'mt-0 md:grid-cols-2' : 'mt-4 md:grid-cols-2 md:gap-4')}>
        <div className="rounded-xl border border-[#007dfc]/15 bg-[#007dfc]/[0.04] p-4">
          <div className="flex items-center gap-2 text-[#007dfc]">
            <Lock className="h-4 w-4 shrink-0" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-wide">Stays private</p>
          </div>
          <ul className="mt-3 space-y-1.5 text-sm text-[#334155]">
            {rows.map((row) => (
              <li key={row.private} className="flex gap-2">
                <span className="text-[#94a3b8]" aria-hidden>
                  •
                </span>
                <span>{row.private}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-[var(--lg-border)] bg-[#f6f9fc] p-4">
          <div className="flex items-center gap-2 text-[#012b54]">
            <Globe2 className="h-4 w-4 shrink-0" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-wide">On Stellar ledger</p>
          </div>
          <ul className="mt-3 space-y-1.5 text-sm text-[#334155]">
            {rows.map((row) => (
              <li key={row.public} className="flex gap-2">
                <span className="text-[#94a3b8]" aria-hidden>
                  •
                </span>
                <span>{row.public}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
