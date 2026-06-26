import { ExternalLink, RefreshCw, ShieldCheck, Download, Copy, CheckCircle2, XCircle, Check } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import type { ProofReceipt } from '../../lib/proofReceipt';
import { proofReceiptFilename } from '../../lib/proofReceipt';
import { truncateMiddle } from '../../lib/utils';
import { useAdvancedMode } from '../product/AdvancedModeToggle';
import { Pill } from '../design/Primitives';

type Props = {
  receipt: ProofReceipt;
  loading?: boolean;
  onRefresh?: () => void;
  onVerifyDuplicate?: () => void;
  replayLoading?: boolean;
};

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl bg-[#f6f9fc] p-3">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">{label}</dt>
      <dd className="mt-1 flex items-center gap-2">
        <span className="min-w-0 flex-1 break-all font-mono text-xs text-[#012b54]">{value}</span>
        <button
          type="button"
          className="shrink-0 rounded-lg p-1.5 text-[#64748b] hover:bg-white hover:text-[#007dfc]"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        </button>
      </dd>
    </div>
  );
}

export function ProofReceiptHero({
  receipt,
  loading,
  onRefresh,
  onVerifyDuplicate,
  replayLoading,
}: Props) {
  const advanced = useAdvancedMode();
  const download = () => {
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = proofReceiptFilename(receipt.walletAddress);
    a.click();
    URL.revokeObjectURL(url);
  };

  const receiptId = receipt.transactions.transfer
    ? `RCPT-${receipt.transactions.transfer.slice(0, 8).toUpperCase()}`
    : 'RCPT-PENDING';
  const displayAmount = receipt.transferResult?.amount ?? '—';
  const assetLabel = receipt.asset?.label ?? 'RWA';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Pill tone="brand">Receipt</Pill>
          <h2 className="mt-3 lg-font-display text-4xl tracking-tight text-[#012b54]">{receiptId}</h2>
          <p className="mt-1 text-sm text-[#64748b]">
            A cryptographically sealed record of a regulated settlement.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={download}>
            <Download className="h-4 w-4" />
            PDF / JSON
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl lg-shadow-lift">
        <div className="relative lg-gradient-passport p-8 text-white md:p-10">
          <div className="pointer-events-none absolute inset-0 lg-grid-bg opacity-10" />
          <div className="relative grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                Lumengate · Settlement receipt
              </p>
              <p className="mt-4 lg-font-display text-5xl tabular-nums tracking-tight md:text-6xl">
                {displayAmount}
              </p>
              <p className="mt-1 text-sm text-white/70">
                {assetLabel} · {receipt.network}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
              <div>
                <dt className="text-white/50">Receipt</dt>
                <dd className="mt-0.5 font-mono">{receiptId}</dd>
              </div>
              <div>
                <dt className="text-white/50">Status</dt>
                <dd className="mt-0.5 capitalize">{receipt.settlementStatus}</dd>
              </div>
              <div>
                <dt className="text-white/50">Proof</dt>
                <dd className="mt-0.5 font-mono">{truncateMiddle(receipt.nullifier, 8, 6)}</dd>
              </div>
              <div>
                <dt className="text-white/50">Policy</dt>
                <dd className="mt-0.5">{receipt.policyId}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="grid gap-6 bg-white p-6 md:grid-cols-2 md:p-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">Timeline</p>
            <ul className="mt-4 space-y-4 border-l border-[var(--lg-border)] pl-4">
              {receipt.transactions.sessionBind ? (
                <li className="relative">
                  <span className="absolute -left-[21px] top-0.5 grid h-3 w-3 place-items-center rounded-full bg-[#007dfc] ring-4 ring-white">
                    <Check className="h-2 w-2 text-white" />
                  </span>
                  <p className="text-sm font-medium text-[#012b54]">Session proof bound</p>
                  <p className="font-mono text-[10px] text-[#64748b]">{truncateMiddle(receipt.transactions.sessionBind, 10, 8)}</p>
                </li>
              ) : null}
              {receipt.transactions.transfer ? (
                <li className="relative">
                  <span className="absolute -left-[21px] top-0.5 grid h-3 w-3 place-items-center rounded-full bg-[#007dfc] ring-4 ring-white">
                    <Check className="h-2 w-2 text-white" />
                  </span>
                  <p className="text-sm font-medium text-[#012b54]">Stellar settlement</p>
                  <p className="font-mono text-[10px] text-[#64748b]">{truncateMiddle(receipt.transactions.transfer, 10, 8)}</p>
                </li>
              ) : null}
              <li className="relative">
                <span className="absolute -left-[21px] top-0.5 grid h-3 w-3 place-items-center rounded-full bg-emerald-500 ring-4 ring-white">
                  <Check className="h-2 w-2 text-white" />
                </span>
                <p className="text-sm font-medium text-[#012b54]">Eligibility verified</p>
                <p className="text-xs text-[#64748b]">{receipt.claims.join(' · ') || 'ZK proof verified'}</p>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">Compliance badges</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {receipt.claims.map((c) => (
                <Pill key={c} tone="success">
                  {c}
                </Pill>
              ))}
              <Pill tone="brand">Selective disclosure</Pill>
            </div>
            <div className="mt-5 rounded-xl bg-[#f6f9fc] p-3">
              <dt className="text-[10px] font-semibold uppercase text-[#64748b]">Proof hash</dt>
              <dd className="mt-1 break-all font-mono text-[11px] text-[#012b54]">{receipt.nullifier}</dd>
            </div>
            {receipt.explorerLinks.transfer ? (
              <a
                href={receipt.explorerLinks.transfer}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#007dfc] hover:underline"
              >
                View on Stellar Expert <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader title="What this receipt proves" badge={<Badge tone="ok">Compliant</Badge>} />
        <dl className="grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded-xl bg-[#f6f9fc] p-3">
            <dt className="text-[10px] font-semibold uppercase text-[#64748b]">Eligibility</dt>
            <dd className="mt-1 font-medium text-[#012b54]">Passed without revealing identity</dd>
          </div>
          <div className="rounded-xl bg-[#f6f9fc] p-3">
            <dt className="text-[10px] font-semibold uppercase text-[#64748b]">Settlement</dt>
            <dd className="mt-1 font-medium text-[#012b54]">
              {receipt.settlementStatus === 'verified' ? 'Completed on Stellar' : 'Pending confirmation'}
            </dd>
          </div>
          <div className="rounded-xl bg-[#f6f9fc] p-3">
            <dt className="text-[10px] font-semibold uppercase text-[#64748b]">Audit</dt>
            <dd className="mt-1 font-medium text-[#012b54]">Shareable with a viewing key</dd>
          </div>
        </dl>
      </Card>

      <div className="flex flex-wrap gap-3">
        {onRefresh ? (
          <Button variant="secondary" loading={loading} onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
            Refresh status
          </Button>
        ) : null}
        <Button variant="secondary" onClick={download}>
          <Download className="h-4 w-4" />
          Download receipt
        </Button>
        {onVerifyDuplicate ? (
          <Button variant="secondary" loading={replayLoading} onClick={onVerifyDuplicate}>
            <XCircle className="h-4 w-4" />
            Test duplicate protection
          </Button>
        ) : null}
      </div>

      {advanced && receipt.replayBlocked && receipt.replayMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <strong>REPLAY BLOCKED</strong> — {receipt.replayMessage}
        </div>
      ) : null}

      {advanced ? <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Wallet & eligibility" description="Private eligibility approval" />
          <dl className="grid gap-3">
            <CopyRow label="Wallet" value={receipt.walletAddress} />
            {receipt.walletModuleName ? (
              <CopyRow label="Wallet module" value={receipt.walletModuleName} />
            ) : null}
            <CopyRow label="Eligibility rule" value={String(receipt.policyId)} />
            <div className="rounded-xl bg-[#f6f9fc] p-3">
              <dt className="text-[10px] font-semibold uppercase text-[#64748b]">Confirmed requirements</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {receipt.claims.map((c) => (
                  <Badge key={c} tone="ok">
                    {c}
                  </Badge>
                ))}
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Private confirmation" description="Internal proof details" />
          <dl className="grid gap-3">
            <CopyRow label="Settlement reference" value={receipt.nullifier} />
            <CopyRow label="Eligibility record" value={receipt.merkleRoot} />
            <CopyRow label="Restriction record" value={receipt.revocationRoot} />
            <div className="rounded-xl bg-[#f6f9fc] p-3 text-sm">
              <dt className="text-[10px] font-semibold uppercase text-[#64748b]">On-chain checks</dt>
              <dd className="mt-2 space-y-1">
                <p className={receipt.rootsMatchOnChain ? 'text-emerald-700' : 'text-amber-700'}>
                  Eligibility records match Stellar: {receipt.rootsMatchOnChain ? 'yes' : 'pending / mismatch'}
                </p>
                <p className={receipt.nullifierSpent ? 'text-emerald-700' : 'text-[#64748b]'}>
                  Passport status: {receipt.nullifierSpent ? 'used once' : 'not used yet'}
                </p>
              </dd>
            </div>
          </dl>
        </Card>
      </div> : null}

      {advanced ? <Card>
        <CardHeader title="Live on Stellar" description="Internal contract IDs (testnet)" />
        <dl className="grid gap-3 md:grid-cols-2">
          <CopyRow label="Eligibility checker" value={receipt.contractIds.policyVerifier} />
          <CopyRow label="Treasury asset" value={receipt.contractIds.rwaToken} />
          <CopyRow label="Eligibility registry" value={receipt.contractIds.credentialRegistry} />
          <CopyRow label="Asset adapter" value={receipt.contractIds.rwaAdapter} />
          <CopyRow label="Issuer registry" value={receipt.contractIds.issuerRegistry} />
        </dl>
      </Card> : null}

      {(receipt.transactions.transfer || receipt.transactions.verify || receipt.transactions.sessionBind) && (
        <Card>
          <CardHeader title="Settlement reference" description="Real testnet transactions" badge={<Badge tone="brand">On-chain</Badge>} />
          <dl className="grid gap-3">
            {receipt.transactions.sessionBind ? (
              <div className="rounded-xl bg-[#f6f9fc] p-3">
                <dt className="text-[10px] font-semibold uppercase text-[#64748b]">Session bind (tx 1)</dt>
                <dd className="mt-1 font-mono text-xs break-all">{receipt.transactions.sessionBind}</dd>
                {receipt.explorerLinks.sessionBind ? (
                  <a
                    href={receipt.explorerLinks.sessionBind}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#007dfc] hover:underline"
                  >
                    Stellar Expert <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            ) : null}
            {receipt.transactions.transfer ? (
              <div className="rounded-xl bg-[#f6f9fc] p-3">
                <dt className="text-[10px] font-semibold uppercase text-[#64748b]">Settlement (tx 2)</dt>
                <dd className="mt-1 font-mono text-xs break-all">{receipt.transactions.transfer}</dd>
                {receipt.explorerLinks.transfer ? (
                  <a
                    href={receipt.explorerLinks.transfer}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#007dfc] hover:underline"
                  >
                    Stellar Expert <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            ) : null}
            {receipt.transactions.verify ? (
              <CopyRow label="Private confirmation" value={receipt.transactions.verify} />
            ) : null}
          </dl>
          {receipt.transferResult ? (
            <p className="mt-4 text-sm text-[#475569]">
              Transferred <strong>{receipt.transferResult.amount}</strong> RWA from{' '}
              {truncateMiddle(receipt.transferResult.from, 6, 4)} to{' '}
              {truncateMiddle(receipt.transferResult.to, 6, 4)}
              {receipt.transferResult.success ? ' — success' : ' — failed'}
            </p>
          ) : null}
        </Card>
      )}

      {advanced ? <Card>
        <CardHeader
          title="Chain events"
          description="Internal chain diagnostics from transaction metadata and contract reads"
          badge={<Badge tone="brand">Live RPC</Badge>}
        />
        {receipt.events.length === 0 ? (
          <p className="text-sm text-[#64748b]">
            Complete a settlement to load internal event diagnostics.
          </p>
        ) : (
          <ul className="space-y-3">
            {receipt.events.map((ev) => (
              <li key={`${ev.txHash}-${ev.ledger}-${ev.kind}`} className="rounded-xl bg-[#f6f9fc] p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#007dfc]" />
                  <span className="font-semibold text-[#012b54]">{ev.kind}</span>
                  <Badge tone="neutral">ledger {ev.ledger}</Badge>
                  {ev.source === 'chain_read' ? <Badge tone="warn">chain read</Badge> : null}
                </div>
                <p className="mt-1 text-[#64748b]">{ev.summary}</p>
                <p className="mt-1 font-mono text-[10px] break-all text-[#64748b]">{ev.txHash}</p>
              </li>
            ))}
          </ul>
        )}
      </Card> : null}

      {advanced ? <Card>
        <CardHeader title="Asset targets" description="Internal settlement contract references" />
        <dl className="grid gap-3 md:grid-cols-2">
          <CopyRow label={`${receipt.complianceTargets.usdcCode} issuer`} value={receipt.complianceTargets.usdcIssuer} />
          <CopyRow label="USDC SAC (SEP-41)" value={receipt.complianceTargets.usdcSac} />
        </dl>
        <p className="mt-3 text-xs text-[#64748b]">
          Treasury units and USDC use separate Stellar settlement contracts.
        </p>
      </Card> : null}
    </div>
  );
}
