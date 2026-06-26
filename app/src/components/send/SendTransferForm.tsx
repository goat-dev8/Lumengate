import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Fingerprint,
  ShieldCheck,
  Wallet,
  XCircle,
} from 'lucide-react';
import { Pill, SectionHeader } from '../design/Primitives';
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
  onSubmit: () => void;
  showTreasuryOption?: boolean;
};

function ComplianceLineRow({ label, status, ok }: ComplianceLine) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-[#334155]">{label}</span>
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-medium ${
          ok ? 'text-emerald-600' : 'text-amber-600'
        }`}
      >
        {ok ? <Check className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
        {status}
      </span>
    </li>
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
    <>
      <SectionHeader
        eyebrow="Transfer"
        title="Send funds privately"
        description="Compliance checks run client-side. Your passport handles eligibility — the public ledger only sees the settlement."
      />

      <div className="mt-7 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="lg-surface-card p-7">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">Amount</label>
          <div className="mt-3 flex flex-wrap items-baseline gap-3">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              className="min-w-0 flex-1 bg-transparent lg-font-display text-5xl outline-none tabular-nums tracking-tight text-[#012b54] md:text-6xl"
              aria-label="Transfer amount"
            />
            <div className="inline-flex rounded-full border border-[var(--lg-border)] bg-[var(--lg-muted-bg)] p-1">
              {assetPills.map(({ id, label, disabled: pillDisabled }) => (
                <button
                  type="button"
                  key={id}
                  disabled={pillDisabled}
                  onClick={() => onAssetChange(id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    asset === id ? 'bg-[#012b54] text-white' : 'text-[#64748b] hover:text-[#012b54]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-1 text-xs text-[#64748b]">
            {usdApprox ? `≈ $${usdApprox} USD · ` : null}
            network fee ~ $0.0001
          </p>

          <div className="mt-7">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">
              Recipient
            </label>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--lg-border)] bg-white px-3 py-2.5">
              <Wallet className="h-4 w-4 shrink-0 text-[#64748b]" />
              <input
                value={to}
                onChange={(e) => onToChange(e.target.value)}
                className="min-w-0 flex-1 bg-transparent font-mono text-sm outline-none text-[#012b54]"
                aria-label="Recipient Stellar address"
              />
              {recipientValid === true ? (
                <Pill tone="success">Verified</Pill>
              ) : recipientValid === false && to ? (
                <Pill tone="warning">Invalid</Pill>
              ) : null}
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-[var(--lg-border)] bg-[#f6f9fc]/80 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">
              Compliance check
            </p>
            <ul className="mt-2.5 space-y-2 text-sm">
              {complianceLines.map((line) => (
                <ComplianceLineRow key={line.label} {...line} />
              ))}
            </ul>
          </div>

          <Button
            className="group mt-7 w-full rounded-full bg-gradient-to-r from-[#007dfc] to-[#0056b3] py-3.5 text-sm font-semibold shadow-[0_8px_24px_rgba(0,125,252,0.35)] hover:-translate-y-0.5"
            loading={loading}
            disabled={disabled}
            onClick={onSubmit}
          >
            <Fingerprint className="h-4 w-4" />
            Authorize with passkey
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        </div>

        <aside className="space-y-4">
          <div className="lg-surface-card p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">From</p>
            <p className="mt-1.5 text-sm font-semibold text-[#012b54]">{fromLabel}</p>
            {fromAddress ? (
              <p className="font-mono text-[11px] text-[#64748b]">{truncateMiddle(fromAddress, 6, 4)}</p>
            ) : null}
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-[#64748b]">Available</span>
              <span className="font-semibold tabular-nums text-[#012b54]">{balanceLabel}</span>
            </div>
          </div>
          <div className="lg-surface-card p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#007dfc]" />
              <p className="text-sm font-semibold text-[#012b54]">What stays private</p>
            </div>
            <ul className="mt-3 space-y-1.5 text-xs text-[#64748b]">
              <li>• Counterparty identity &amp; address details off public memo</li>
              <li>• Memo, invoice, and metadata</li>
              <li>• Source-of-funds documentation</li>
            </ul>
          </div>
          <Link
            to="/app/compliance"
            className="block text-center text-xs text-[#64748b] hover:text-[#012b54]"
          >
            View past sends →
          </Link>
        </aside>
      </div>
    </>
  );
}
