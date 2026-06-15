import { ExternalLink, RefreshCw, ShieldCheck, Download, Copy, CheckCircle2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import type { ProofReceipt } from '../../lib/proofReceipt';
import { proofReceiptFilename } from '../../lib/proofReceipt';
import { truncateMiddle } from '../../lib/utils';

type Props = {
  receipt: ProofReceipt;
  loading?: boolean;
  onRefresh?: () => void;
  onDemonstrateReplay?: () => void;
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
  onDemonstrateReplay,
  replayLoading,
}: Props) {
  const download = () => {
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = proofReceiptFilename(receipt.walletAddress);
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#007dfc]/20 bg-gradient-to-br from-[#012b54] to-[#023d72] p-6 text-white shadow-lg">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
          Proof Receipt · Stellar testnet
        </p>
        <h1 className="mt-2 text-2xl font-semibold lg:text-3xl">{receipt.productLabel}</h1>
        <p className="mt-2 text-sm text-white/80">{receipt.tagline}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone={receipt.settlementStatus === 'verified' ? 'ok' : receipt.settlementStatus === 'pending' ? 'warn' : 'err'}>
            {receipt.settlementStatus === 'verified'
              ? 'Settlement verified'
              : receipt.settlementStatus === 'pending'
                ? 'Pending'
                : 'Settlement failed'}
          </Badge>
          {receipt.verificationResult === 'passed' && receipt.settlementStatus !== 'verified' ? (
            <Badge tone="ok">Policy passed</Badge>
          ) : null}
          <Badge tone="brand">{receipt.verifierVersion.protocol}</Badge>
          <Badge tone="neutral">SDK {receipt.verifierVersion.sorobanSdk}</Badge>
          {receipt.nullifierSpent ? <Badge tone="ok">Nullifier spent</Badge> : <Badge tone="warn">Nullifier available</Badge>}
          {receipt.replayBlocked ? <Badge tone="err">Replay blocked</Badge> : null}
        </div>
      </div>

      <Card>
        <CardHeader
          title="Replay protection"
          description="PolicyVerifier nullifier storage — one proof, one settlement"
          badge={
            receipt.nullifierSpent ? (
              <Badge tone="ok">Anti-replay active</Badge>
            ) : (
              <Badge tone="warn">Nullifier unspent</Badge>
            )
          }
        />
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div className="rounded-xl bg-[#f6f9fc] p-3">
            <dt className="text-[10px] font-semibold uppercase text-[#64748b]">Nullifier status</dt>
            <dd className="mt-1 font-medium text-[#012b54]">
              {receipt.nullifierSpent
                ? 'Spent on-chain — double-spend blocked (Error #7 on reuse)'
                : 'Available — complete a gated transfer to consume'}
            </dd>
          </div>
          <div className="rounded-xl bg-[#f6f9fc] p-3">
            <dt className="text-[10px] font-semibold uppercase text-[#64748b]">Settlement status</dt>
            <dd className="mt-1 font-medium text-[#012b54]">
              {receipt.settlementStatus === 'verified'
                ? 'Verified — transfer tx + TransferGated event + nullifier spent'
                : receipt.settlementStatus === 'pending'
                  ? 'Pending — execute a proof-gated transfer'
                  : 'Failed — transfer did not settle'}
            </dd>
          </div>
        </dl>
      </Card>

      <div className="flex flex-wrap gap-3">
        {onRefresh ? (
          <Button variant="secondary" loading={loading} onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
            Verify on RPC
          </Button>
        ) : null}
        <Button variant="secondary" onClick={download}>
          <Download className="h-4 w-4" />
          Export receipt JSON
        </Button>
        {onDemonstrateReplay ? (
          <Button variant="secondary" loading={replayLoading} onClick={onDemonstrateReplay}>
            <XCircle className="h-4 w-4" />
            Demonstrate replay block
          </Button>
        ) : null}
      </div>

      {receipt.replayBlocked && receipt.replayMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <strong>REPLAY BLOCKED</strong> — {receipt.replayMessage}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Wallet & policy" description="External compliance policy approval" />
          <dl className="grid gap-3">
            <CopyRow label="Wallet" value={receipt.walletAddress} />
            {receipt.walletModuleName ? (
              <CopyRow label="Wallet module" value={receipt.walletModuleName} />
            ) : null}
            <CopyRow label="Policy ID" value={String(receipt.policyId)} />
            <div className="rounded-xl bg-[#f6f9fc] p-3">
              <dt className="text-[10px] font-semibold uppercase text-[#64748b]">Claims proven (no PII)</dt>
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
          <CardHeader title="ZK verification" description="UltraHonk verified on PolicyVerifier" />
          <dl className="grid gap-3">
            <CopyRow label="Nullifier" value={receipt.nullifier} />
            <CopyRow label="Merkle root" value={receipt.merkleRoot} />
            <CopyRow label="Revocation root" value={receipt.revocationRoot} />
            <div className="rounded-xl bg-[#f6f9fc] p-3 text-sm">
              <dt className="text-[10px] font-semibold uppercase text-[#64748b]">On-chain checks</dt>
              <dd className="mt-2 space-y-1">
                <p className={receipt.rootsMatchOnChain ? 'text-emerald-700' : 'text-amber-700'}>
                  Roots match CredentialRegistry: {receipt.rootsMatchOnChain ? 'yes' : 'pending / mismatch'}
                </p>
                <p className={receipt.nullifierSpent ? 'text-emerald-700' : 'text-[#64748b]'}>
                  Nullifier on PolicyVerifier: {receipt.nullifierSpent ? 'spent (anti-replay active)' : 'not spent yet'}
                </p>
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card>
        <CardHeader title="Live on Stellar" description="Deployed contract IDs (testnet)" />
        <dl className="grid gap-3 md:grid-cols-2">
          <CopyRow label="PolicyVerifier" value={receipt.contractIds.policyVerifier} />
          <CopyRow label="RwaToken" value={receipt.contractIds.rwaToken} />
          <CopyRow label="CredentialRegistry" value={receipt.contractIds.credentialRegistry} />
          <CopyRow label="RwaAdapter" value={receipt.contractIds.rwaAdapter} />
          <CopyRow label="IssuerRegistry" value={receipt.contractIds.issuerRegistry} />
        </dl>
      </Card>

      {(receipt.transactions.transfer || receipt.transactions.verify) && (
        <Card>
          <CardHeader title="Transactions" description="Real testnet hashes" badge={<Badge tone="brand">On-chain</Badge>} />
          <dl className="grid gap-3">
            {receipt.transactions.transfer ? (
              <div className="rounded-xl bg-[#f6f9fc] p-3">
                <dt className="text-[10px] font-semibold uppercase text-[#64748b]">Transfer gated</dt>
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
              <CopyRow label="Verify proof" value={receipt.transactions.verify} />
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

      <Card>
        <CardHeader
          title="Chain events"
          description="Parsed from transaction meta (TransferGated) + on-chain nullifier read"
          badge={<Badge tone="brand">Live RPC</Badge>}
        />
        {receipt.events.length === 0 ? (
          <p className="text-sm text-[#64748b]">
            Complete a gated transfer to load TransferGated events from transaction meta. Nullifier spent status comes from PolicyVerifier storage read.
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
      </Card>

      <Card>
        <CardHeader title="Universal asset targets" description="Compliance layer gates RWA today; USDC SAC is the real-money target" />
        <dl className="grid gap-3 md:grid-cols-2">
          <CopyRow label={`${receipt.complianceTargets.usdcCode} issuer`} value={receipt.complianceTargets.usdcIssuer} />
          <CopyRow label="USDC SAC (SEP-41)" value={receipt.complianceTargets.usdcSac} />
        </dl>
        <p className="mt-3 text-xs text-[#64748b]">
          RWA settlement uses proof-gated RwaToken.transfer. USDC uses ComplianceSacAdmin.transfer_compliant when deployed.
        </p>
      </Card>
    </div>
  );
}
