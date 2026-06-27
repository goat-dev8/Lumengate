import { motion } from 'framer-motion';
import { ArrowUpRight, FileCheck2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SectionHeader } from '../design/Primitives';
import type { ActivityEntry } from '../../lib/activity';
import { formatRelativeTime } from '../../lib/formatTime';
import { cn } from '../../lib/cn';

type Props = {
  activity: ActivityEntry[];
};

function parseSettlement(entry: ActivityEntry) {
  const amountMatch = entry.title.match(/:\s*([\d.]+)/);
  const detailMatch = entry.detail?.match(/^([\d.]+)\s+(\S+)/);
  const amount = amountMatch?.[1] ?? detailMatch?.[1] ?? null;
  const asset = detailMatch?.[2] ?? 'USDC';
  return { amount, asset };
}

export function RecentSettlements({ activity }: Props) {
  const settlements = activity.filter((e) => e.kind === 'transfer' && e.status === 'success').slice(0, 5);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
    >
      <SectionHeader
        eyebrow="Settlements"
        title="Recent private settlements"
        description="Compliant transfers sealed with zero-knowledge proofs — only amounts and hashes reach Stellar."
        action={
          settlements.length > 0 ? (
            <Link to="/app/compliance" className="text-sm font-medium text-[#007dfc] hover:underline">
              All receipts →
            </Link>
          ) : null
        }
      />

      <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--lg-border)] bg-white/80 backdrop-blur-sm">
        {settlements.length === 0 ? (
          <div className="lg-empty-panel m-4 p-8 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#007dfc]/10 text-[#007dfc]">
              <FileCheck2 className="h-6 w-6" />
            </div>
            <p className="mt-4 text-sm font-semibold text-[#012b54]">No settlements yet</p>
            <p className="mt-1 text-sm text-[#64748b]">
              Your first private transfer will appear here with an auditor-grade receipt.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--lg-border)]">
            {settlements.map((entry, index) => {
              const { amount, asset } = parseSettlement(entry);
              return (
                <motion.li
                  key={entry.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.06 }}
                >
                  <Link
                    to={entry.txHash ? `/app/compliance?tx=${entry.txHash}` : '/app/compliance'}
                    className={cn(
                      'group flex items-center gap-4 px-5 py-4 transition-all hover:bg-[#f6f9fc]',
                      'hover:shadow-[inset_4px_0_0_0_#007dfc]',
                    )}
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
                      <FileCheck2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#012b54]">{entry.title}</p>
                      <p className="truncate text-xs text-[#64748b]">{entry.detail}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      {amount ? (
                        <p className="text-sm font-semibold tabular-nums text-[#012b54]">
                          {amount} {asset}
                        </p>
                      ) : null}
                      <p className="text-[11px] text-[#94a3b8]">{formatRelativeTime(entry.timestamp)}</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-[#64748b] opacity-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </motion.section>
  );
}
