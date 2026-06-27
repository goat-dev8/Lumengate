import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  Fingerprint,
  ShieldCheck,
  Wallet,
  XCircle,
} from 'lucide-react';
import { Pill } from '../design/Primitives';
import { Button } from '../ui/Button';
import { truncateMiddle } from '../../lib/utils';

type AssetKind = 'rwa' | 'usdc' | 'eurc';

type ComplianceLine = { label: string; status: string; ok: boolean };

type Props = {
  amount: string;
  onAmountChange: (v: string) => void;
  asset: AssetKind;
  onAssetChange: (a: AssetKind) => void;
  usdcReady: boolean;
  eurcReady: boolean;
  to: string;
  onToChange: (v: string) => void;
  recipientValid: boolean | null;
  complianceLines: ComplianceLine[];
  balanceLabel: string;
  fromLabel: string;
  fromAddress: string | null;
  loading: boolean;
  disabled: boolean;
  error: string | null;
  statusMessage?: string | null;
  onSubmit: () => void;
  showTreasuryOption?: boolean;
};

function ComplianceLineRow({ label, status, ok }: ComplianceLine) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center justify-between gap-3"
    >
      <span className="text-[#334155]">{label}</span>
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-medium ${
          ok ? 'text-emerald-600' : 'text-amber-600'
        }`}
      >
        {ok ? <Check className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
        {status}
      </span>
    </motion.li>
  );
}

export function SendTransferForm({
  amount,
  onAmountChange,
  asset,
  onAssetChange,
  usdcReady,
  eurcReady,
  to,
  onToChange,
  recipientValid,
  complianceLines,
  balanceLabel,
  fromLabel,
  fromAddress,
  loading,
  disabled,
  error,
  statusMessage,
  onSubmit,
  showTreasuryOption = true,
}: Props) {
  const assetPills: { id: AssetKind; label: string; disabled?: boolean }[] = [
    ...(showTreasuryOption ? [{ id: 'rwa' as const, label: 'Treasury' }] : []),
    { id: 'usdc', label: 'USDC', disabled: !usdcReady },
    { id: 'eurc', label: 'EURC', disabled: !eurcReady },
  ];

  const usdApprox =
    asset === 'usdc' || asset === 'eurc'
      ? Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">Transfer</p>
        <h2 className="mt-1 lg-font-display text-3xl tracking-tight text-[#012b54] md:text-4xl">
          Send funds privately
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-[#64748b]">
          Compliance checks run on your device. Your passport proves eligibility — Stellar records only the settlement.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <motion.div
          layout
          className="relative overflow-hidden rounded-3xl border border-[#007dfc]/15 bg-white p-8 shadow-[0_20px_60px_rgba(1,43,84,0.08)] md:p-10"
        >
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#007dfc]/10 blur-3xl" />
          <div className="relative">
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Amount</label>
            <div className="mt-4 flex flex-wrap items-baseline gap-4">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
                placeholder="0.00"
                className="min-w-0 flex-1 bg-transparent lg-font-display text-6xl outline-none tabular-nums tracking-tight text-[#012b54] placeholder:text-[#cbd5e1] md:text-7xl"
                aria-label="Transfer amount"
              />
              <div className="inline-flex rounded-full border border-[var(--lg-border)] bg-[var(--lg-muted-bg)] p-1 shadow-inner">
                {assetPills.map(({ id, label, disabled: pillDisabled }) => (
                  <button
                    type="button"
                    key={id}
                    disabled={pillDisabled}
                    onClick={() => onAssetChange(id)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                      asset === id
                        ? 'bg-[#012b54] text-white shadow-sm'
                        : 'text-[#64748b] hover:text-[#012b54]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-2 text-sm text-[#64748b]">
              {usdApprox ? `≈ $${usdApprox} USD · ` : null}
              Network fee ~ $0.0001 on Stellar testnet
            </p>

            <div className="mt-10">
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
                Recipient
              </label>
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[var(--lg-border)] bg-[#f6f9fc]/80 px-4 py-3.5 transition-shadow focus-within:border-[#007dfc]/40 focus-within:shadow-[0_0_0_4px_rgba(0,125,252,0.08)]">
                <Wallet className="h-5 w-5 shrink-0 text-[#64748b]" />
                <input
                  value={to}
                  onChange={(e) => onToChange(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent font-mono text-sm outline-none text-[#012b54]"
                  aria-label="Recipient Stellar address"
                  placeholder="G… Stellar address"
                />
                {recipientValid === true ? (
                  <Pill tone="success">Verified</Pill>
                ) : recipientValid === false && to ? (
                  <Pill tone="warning">Invalid</Pill>
                ) : null}
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-[#007dfc]/10 bg-gradient-to-br from-[#007dfc]/[0.04] to-transparent p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
                Compliance check
              </p>
              <ul className="mt-3 space-y-2.5 text-sm">
                {complianceLines.map((line) => (
                  <ComplianceLineRow key={line.label} {...line} />
                ))}
              </ul>
            </div>

            <motion.div whileHover={{ scale: disabled ? 1 : 1.01 }} whileTap={{ scale: disabled ? 1 : 0.99 }}>
              <Button
                className="group mt-8 w-full rounded-2xl bg-gradient-to-r from-[#007dfc] to-[#0056b3] py-4 text-base font-semibold shadow-[0_12px_32px_rgba(0,125,252,0.35)] hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(0,125,252,0.45)]"
                loading={loading}
                disabled={disabled}
                onClick={onSubmit}
              >
                <Fingerprint className="h-5 w-5" />
                {loading ? (statusMessage ? 'Working…' : 'Processing…') : 'Send privately'}
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </motion.div>
            {statusMessage ? (
              <p className="mt-3 text-sm font-medium text-[#007dfc]" role="status">
                {statusMessage}
              </p>
            ) : null}
            {error ? (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </motion.div>

        <aside className="space-y-4">
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg-surface-card p-6"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">From</p>
            <p className="mt-2 text-base font-semibold text-[#012b54]">{fromLabel}</p>
            {fromAddress ? (
              <p className="mt-1 font-mono text-xs text-[#64748b]">{truncateMiddle(fromAddress, 8, 6)}</p>
            ) : null}
            <div className="mt-5 flex items-center justify-between rounded-xl bg-[#f6f9fc] px-4 py-3">
              <span className="text-sm text-[#64748b]">Available balance</span>
              <span className="text-base font-semibold tabular-nums text-[#012b54]">{balanceLabel}</span>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.16 }}
            className="lg-surface-card p-6"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#007dfc]" />
              <p className="text-sm font-semibold text-[#012b54]">What stays private</p>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-[#64748b]">
              <li>Counterparty identity off the public memo</li>
              <li>Invoice and payment metadata</li>
              <li>Source-of-funds documentation</li>
            </ul>
          </motion.div>
          <Link
            to="/app/compliance"
            className="block rounded-xl border border-[var(--lg-border)] bg-white/80 py-3 text-center text-sm font-medium text-[#64748b] transition hover:border-[#007dfc]/30 hover:text-[#012b54]"
          >
            View settlement receipts →
          </Link>
        </aside>
      </div>
    </motion.div>
  );
}
