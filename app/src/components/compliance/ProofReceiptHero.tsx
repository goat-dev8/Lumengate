import {
  Check,
  Copy,
  Download,
  ExternalLink,
  RefreshCw,
  Share2,
  Shield,
  XCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Stagger, StaggerItem, StatusDot, Pill } from '../design/Primitives';
import type { ProofReceipt } from '../../lib/proofReceipt';
import { proofReceiptFilename } from '../../lib/proofReceipt';
import { receiptDisplayAssetLabel } from '../../lib/passportScopeStatus';
import { truncateMiddle } from '../../lib/utils';
import { useAdvancedMode } from '../product/AdvancedModeToggle';
import { useCountUp } from '../../hooks/useCountUp';
import { cn } from '../../lib/cn';

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

type TimelineStep = {
  id: string;
  title: string;
  detail: string;
  time?: string;
};

type Props = {
  receipt: ProofReceipt;
  loading?: boolean;
  onRefresh?: () => void;
  onVerifyDuplicate?: () => void;
  replayLoading?: boolean;
  generatedViewingKey: string | null;
  viewingKeyRevealed: boolean;
  onToggleViewingKeyReveal: () => void;
  onGenerateViewingKey: () => void;
  onCopyViewingKey: () => void;
  onDownloadDisclosure: () => void;
  onDownloadAuditorPackage: () => void;
  generateLoading?: boolean;
  storeMessage?: string | null;
  storeError?: string | null;
};

function formatIssued(isoOrMs: string | number | undefined): string {
  if (!isoOrMs) return '—';
  const d = typeof isoOrMs === 'number' ? new Date(isoOrMs) : new Date(isoOrMs);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseAmountValue(raw: string | undefined): number | null {
  if (!raw) return null;
  if (raw.toLowerCase().includes('shielded')) return null;
  const n = Number.parseFloat(raw.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function isConfidentialReceipt(receipt: ProofReceipt): boolean {
  const assetText = `${receipt.asset?.label ?? ''} ${receipt.transferResult?.amount ?? ''}`.toLowerCase();
  return assetText.includes('eurc') && receipt.events.some((event) => {
    const topicText = `${event.kind} ${event.summary} ${JSON.stringify(event.rawTopic ?? [])}`.toLowerCase();
    return topicText.includes('confidential') || topicText.includes('transfer');
  });
}

function buildReceiptTimeline(receipt: ProofReceipt): TimelineStep[] {
  const transferEvent = receipt.events.find((e) => e.txHash === receipt.transactions.transfer);
  const bindEvent = receipt.events.find((e) => e.txHash === receipt.transactions.sessionBind);
  const assetLabel = receiptDisplayAssetLabel(receipt);
  const confidential = isConfidentialReceipt(receipt);
  const steps: TimelineStep[] = [];

  steps.push({
    id: 'eligibility',
    title: `${assetLabel} eligibility prepared`,
    detail: `Asset scope ${receipt.policyId} — proof stays on your device until you authorize`,
    time: formatIssued(receipt.createdAt),
  });

  if (receipt.transactions.sessionBind) {
    steps.push({
      id: 'bind',
      title: 'Passkey session bound',
      detail: truncateMiddle(receipt.transactions.sessionBind, 12, 10),
      time: bindEvent?.ledgerClosedAt
        ? formatIssued(bindEvent.ledgerClosedAt)
        : formatIssued(receipt.verificationTimestamp),
    });
  }

  steps.push({
    id: 'proof',
    title: 'Eligibility proof verified',
    detail: receipt.claims.length ? receipt.claims.join(' · ') : 'ZK proof verified locally',
    time: formatIssued(receipt.verificationTimestamp ?? receipt.createdAt),
  });

  if (receipt.transactions.transfer) {
    const amount = receipt.transferResult?.amount ?? '';
    const to = receipt.transferResult?.to ? truncateMiddle(receipt.transferResult.to, 8, 6) : 'counterparty';
    steps.push({
      id: 'settlement',
      title: confidential ? 'Confidential settlement' : 'Stellar settlement',
      detail: `${confidential ? `Shielded amount → ${to}` : amount ? `${amount} → ${to}` : 'Recorded on ledger'}${transferEvent?.ledger ? ` · Ledger #${transferEvent.ledger.toLocaleString()}` : ''}`,
      time: formatIssued(receipt.verificationTimestamp ?? transferEvent?.ledgerClosedAt),
    });
  }

  if (receipt.settlementStatus === 'verified') {
    steps.push({
      id: 'sealed',
      title: 'Receipt sealed',
      detail: 'Selective disclosure ready for auditor viewing key',
      time: formatIssued(receipt.verificationTimestamp ?? Date.now()),
    });
  }

  return steps;
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl bg-[#f6f9fc] p-3 ring-1 ring-[var(--lg-border)]/60">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">{label}</p>
      <div className="mt-2 flex items-start gap-2">
        <p className="min-w-0 flex-1 break-all font-mono text-[11px] leading-relaxed text-[#012b54]">{value}</p>
        <button
          type="button"
          aria-label={`Copy ${label}`}
          className="shrink-0 rounded-lg p-1.5 text-[#64748b] transition hover:bg-white hover:text-[#007dfc]"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function AnimatedAmount({ amount, assetLabel }: { amount: string; assetLabel: string }) {
  const numeric = parseAmountValue(amount);
  const counted = useCountUp(numeric != null ? Math.round(numeric * 100) : 0, 1200, 0, false);
  const display =
    numeric != null
      ? numeric >= 1
        ? counted / 100
        : (counted / 100).toFixed(2)
      : amount || '—';

  return (
    <motion.p
      className="mt-4 lg-font-display text-5xl tabular-nums tracking-tight md:text-6xl"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
    >
      {display}
      {numeric == null && amount ? null : (
        <span className="ml-2 text-3xl font-normal text-white/80 md:text-4xl">{assetLabel.split('·')[0]?.trim()}</span>
      )}
    </motion.p>
  );
}

export function ProofReceiptHero({
  receipt,
  loading,
  onRefresh,
  onVerifyDuplicate,
  replayLoading,
  generatedViewingKey,
  viewingKeyRevealed,
  onToggleViewingKeyReveal,
  onGenerateViewingKey,
  onCopyViewingKey,
  onDownloadDisclosure,
  onDownloadAuditorPackage,
  generateLoading,
  storeMessage,
  storeError,
}: Props) {
  const advanced = useAdvancedMode();
  const timeline = useMemo(() => buildReceiptTimeline(receipt), [receipt]);

  const receiptId = receipt.transactions.transfer
    ? `RCPT-${receipt.transactions.transfer.slice(0, 8).toUpperCase()}`
    : 'RCPT-PENDING';
  const confidentialReceipt = isConfidentialReceipt(receipt);
  const displayAmount = confidentialReceipt ? 'Shielded amount' : (receipt.transferResult?.amount ?? '—');
  const assetLabel = receiptDisplayAssetLabel(receipt);
  const ledger =
    receipt.events.find((e) => e.txHash === receipt.transactions.transfer)?.ledger ??
    receipt.events[0]?.ledger;
  const counterparty = receipt.transferResult?.to
    ? truncateMiddle(receipt.transferResult.to, 10, 8)
    : '—';
  const isSealed = receipt.settlementStatus === 'verified';

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = proofReceiptFilename(receipt.walletAddress);
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 28, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.65, ease: EASE }}
      className="overflow-hidden rounded-3xl border border-[var(--lg-border)] bg-white shadow-[0_24px_80px_rgba(1,43,84,0.12)]"
    >
      {/* Header band */}
      <div className="relative overflow-hidden bg-[#012b54] px-6 py-8 text-white md:px-10 md:py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(0,125,252,0.35),transparent_55%)]" />
        <div className="pointer-events-none absolute -right-16 top-0 h-64 w-64 rounded-full bg-[#007dfc]/20 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20">
              <img src="/stellar-mark.svg" alt="" className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">Lumengate</p>
              <p className="text-sm font-semibold tracking-wide text-white/90">
                {confidentialReceipt ? 'Confidential settlement receipt' : 'Settlement receipt'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
              onClick={downloadJson}
            >
              <Download className="h-4 w-4" />
              PDF / JSON
            </Button>
            <Button size="sm" className="bg-white text-[#012b54] hover:bg-white/90" onClick={onDownloadAuditorPackage}>
              <Share2 className="h-4 w-4" />
              Share auditor package
            </Button>
          </div>
        </div>

        <div className="relative mt-8 grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-end">
          <div>
            <AnimatedAmount amount={displayAmount} assetLabel={assetLabel} />
            <motion.p
              className="mt-2 text-sm text-white/70"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.5 }}
            >
              {confidentialReceipt
                ? `${assetLabel} · amount private by default · Stellar ${receipt.network}`
                : `${assetLabel} · Stellar ${receipt.network}`}
            </motion.p>
          </div>

          <motion.dl
            className="grid grid-cols-2 gap-x-6 gap-y-4 text-xs sm:grid-cols-3 lg:grid-cols-2"
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.25 } } }}
          >
            {[
              { label: 'Receipt', value: receiptId },
              { label: 'Issued', value: formatIssued(receipt.verificationTimestamp ?? receipt.createdAt) },
              { label: 'Counterparty', value: counterparty },
              { label: 'Ledger', value: ledger ? `#${ledger.toLocaleString()}` : '—' },
              { label: 'Proof', value: confidentialReceipt ? 'ZK verified' : truncateMiddle(receipt.nullifier, 6, 4) },
              {
                label: 'Status',
                value: isSealed ? 'Sealed' : receipt.settlementStatus === 'failed' ? 'Failed' : 'Pending',
                status: true,
              },
            ].map(({ label, value, status }) => (
              <motion.div
                key={label}
                variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } } }}
              >
                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">{label}</dt>
                <dd className="mt-1 flex items-center gap-2 font-medium text-white">
                  {status && isSealed ? <StatusDot tone="success" /> : null}
                  <span className={cn(status && isSealed && 'font-semibold')}>{value}</span>
                </dd>
              </motion.div>
            ))}
          </motion.dl>
        </div>
      </div>

      {/* Body */}
      <div className="grid gap-8 p-6 md:p-8 lg:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">Timeline</p>
          <Stagger className="mt-5">
            {timeline.map((step, index) => (
              <StaggerItem key={step.id} className="relative pb-6 pl-8 last:pb-0">
                {index < timeline.length - 1 ? (
                  <span className="absolute left-[11px] top-6 bottom-0 w-px bg-gradient-to-b from-[#007dfc]/40 to-[var(--lg-border)]" />
                ) : null}
                <motion.span
                  className="absolute left-0 top-0.5 grid h-6 w-6 place-items-center rounded-full bg-[#007dfc] text-white shadow-[0_0_0_4px_white,0_0_0_5px_rgba(0,125,252,0.25)]"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2 + index * 0.12, type: 'spring', stiffness: 380, damping: 22 }}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </motion.span>
                <p className="text-sm font-semibold text-[#012b54]">{step.title}</p>
                <p className="mt-0.5 text-xs text-[#64748b]">{step.detail}</p>
                {step.time ? (
                  <p className="mt-1 font-mono text-[10px] text-[#94a3b8]">{step.time}</p>
                ) : null}
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        <div className="space-y-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">Compliance badges</p>
            <motion.div
              className="mt-4 flex flex-wrap gap-2"
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.4 } } }}
            >
              {receipt.claims.map((claim) => (
                <motion.span key={claim} variants={{ hidden: { opacity: 0, scale: 0.9 }, show: { opacity: 1, scale: 1 } }}>
                  <Pill tone="success">{claim}</Pill>
                </motion.span>
              ))}
              <motion.span variants={{ hidden: { opacity: 0, scale: 0.9 }, show: { opacity: 1, scale: 1 } }}>
                <Pill tone="brand">Selective disclosure</Pill>
              </motion.span>
              <motion.span variants={{ hidden: { opacity: 0, scale: 0.9 }, show: { opacity: 1, scale: 1 } }}>
                <Pill tone="brand">SEP-41 asset</Pill>
              </motion.span>
            </motion.div>
          </div>

          <CopyField label="Proof hash" value={receipt.nullifier} />

          {receipt.explorerLinks.transfer ? (
            <a
              href={receipt.explorerLinks.transfer}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#007dfc] hover:underline"
            >
              View on Stellar Expert
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}

          <motion.div
            className="rounded-2xl border border-[#007dfc]/20 bg-gradient-to-br from-[#007dfc]/8 to-[#f6f9fc] p-5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.55, ease: EASE }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#007dfc]">
              Selective disclosure
            </p>
            <p className="mt-2 text-sm text-[#64748b]">
              Generate a read-only viewing key for this receipt. Share the key or auditor package with a regulator —
              they verify eligibility claims without accessing your identity on the public ledger.
            </p>

            {generatedViewingKey ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-[var(--lg-border)] bg-white p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
                    Your viewing key
                  </p>
                  <p className="mt-2 break-all font-mono text-xs text-[#012b54]">
                    {viewingKeyRevealed
                      ? generatedViewingKey
                      : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                  </p>
                  <p className="mt-2 text-xs text-[#64748b]">
                    Read-only · scoped to this disclosure · cannot sign transactions or move funds
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={onToggleViewingKeyReveal}>
                    {viewingKeyRevealed ? 'Hide key' : 'Reveal key'}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={onCopyViewingKey}>
                    <Copy className="h-4 w-4" />
                    Copy key
                  </Button>
                  <Button variant="secondary" size="sm" onClick={onDownloadAuditorPackage}>
                    <Download className="h-4 w-4" />
                    Download package
                  </Button>
                  <Link to="/app/auditor">
                    <Button variant="secondary" size="sm">
                      <Shield className="h-4 w-4" />
                      Auditor portal
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button className="flex-1 sm:flex-none" loading={generateLoading} onClick={onGenerateViewingKey}>
                  Generate viewing key
                </Button>
                <Button variant="secondary" onClick={onDownloadDisclosure}>
                  <Download className="h-4 w-4" />
                  Disclosure JSON
                </Button>
                <Link to="/app/auditor">
                  <Button variant="secondary">
                    <Shield className="h-4 w-4" />
                    Auditor portal
                  </Button>
                </Link>
              </div>
            )}
            {storeMessage ? <p className="mt-3 text-sm text-emerald-700">{storeMessage}</p> : null}
            {storeError ? <p className="mt-3 text-sm text-red-600">{storeError}</p> : null}
          </motion.div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--lg-border)] bg-[#f6f9fc]/80 px-6 py-4 md:px-8">
        {onRefresh ? (
          <Button variant="secondary" size="sm" loading={loading} onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
            Refresh status
          </Button>
        ) : null}
        <Badge tone={isSealed ? 'ok' : 'warn'}>{isSealed ? 'Compliant' : 'Pending verification'}</Badge>
        {receipt.nullifierSpent ? (
          <Badge tone="neutral">Nullifier spent — one-time use</Badge>
        ) : null}
        {onVerifyDuplicate ? (
          <Button variant="secondary" size="sm" loading={replayLoading} onClick={onVerifyDuplicate}>
            <XCircle className="h-4 w-4" />
            Test replay protection
          </Button>
        ) : null}
      </div>

      {advanced && receipt.replayBlocked && receipt.replayMessage ? (
        <div className="border-t border-red-200 bg-red-50 px-6 py-4 text-sm text-red-800 md:px-8">
          <strong>Replay blocked</strong> — {receipt.replayMessage}
        </div>
      ) : null}
    </motion.div>
  );
}
