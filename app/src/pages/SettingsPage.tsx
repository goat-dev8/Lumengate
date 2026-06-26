import { useEffect, useState } from 'react';
import { ExternalLink, LogOut, Network, ShieldCheck } from 'lucide-react';
import { AppShell } from '../components/layout/Shell';
import { AppPageLayout } from '../components/design/AppPageLayout';
import { Pill, SectionHeader, StatusDot } from '../components/design/Primitives';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { AssetPolicyMatrix } from '../components/product/AssetPolicyMatrix';
import { UsdcCompliancePanel } from '../components/product/UsdcCompliancePanel';
import { useApp } from '../context/AppContext';
import { truncateMiddle } from '../lib/utils';
import { currentSettlementOwner } from '../lib/settlementOwner';
import { fetchLatestLedger } from '../lib/horizonLedger';

export function SettingsPage() {
  const { config, address, settlementAddress, disconnect } = useApp();
  const [ledger, setLedger] = useState<number | null>(null);
  const settlementOwner = currentSettlementOwner(config, address, settlementAddress);

  useEffect(() => {
    fetchLatestLedger(config).then(setLedger).catch(() => setLedger(null));
  }, [config]);

  const contracts = [
    { label: 'Passport registry', id: config.credentialRegistryId },
    { label: 'Eligibility checker', id: config.policyVerifierId },
    { label: 'Asset token', id: config.rwaTokenId },
    { label: 'Asset adapter', id: config.rwaAdapterId },
    { label: 'Issuer registry', id: config.issuerRegistryId },
    { label: 'Session store', id: config.sessionStoreId },
    { label: 'Compliance policy', id: config.compliancePolicyId },
  ].filter((c) => Boolean(c.id));

  const metrics = [
    { label: 'Network', value: config.network, detail: ledger ? `Ledger #${ledger.toLocaleString()}` : 'Reading Horizon' },
    { label: 'Contracts', value: String(contracts.length), detail: 'Live Soroban IDs' },
    { label: 'Wallet', value: address ? 'Connected' : 'Not connected', detail: address ? truncateMiddle(address, 8, 6) : 'Connect when funding' },
    {
      label: 'Smart account',
      value: settlementAddress ? 'Ready' : 'Not created',
      detail: settlementAddress ? truncateMiddle(settlementAddress, 8, 6) : 'Create on Passport',
    },
  ];

  return (
    <AppShell>
      <AppPageLayout
        title="Settings"
        subtitle="Account, network, and deployed contract references."
      >
        <SectionHeader
          eyebrow="Configuration"
          title="Account & network"
          description="Everything shown here is read from the active environment and live app session."
          action={
            <Pill tone={config.network === 'testnet' ? 'brand' : 'warning'}>
              <Network className="h-3 w-3" /> {config.network}
            </Pill>
          }
        />

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {metrics.map((m) => (
            <div key={m.label} className="lg-surface-card p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">{m.label}</p>
              <p className="mt-2 lg-font-display text-3xl tracking-tight text-[#012b54]">{m.value}</p>
              <p className="mt-1 truncate text-xs text-[#64748b]">{m.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Wallet" badge={<Badge tone={address ? 'ok' : 'warn'}>{address ? 'Connected' : 'Optional'}</Badge>} />
            {address ? (
              <div className="space-y-3">
                <div className="rounded-xl bg-[#f6f9fc] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">Funding wallet</p>
                  <p className="mt-1 break-all font-mono text-xs text-[#012b54]">{address}</p>
                </div>
                {settlementAddress ? (
                  <div className="rounded-xl bg-[#f6f9fc] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">Smart account</p>
                    <p className="mt-1 break-all font-mono text-xs text-[#012b54]">{settlementAddress}</p>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={disconnect}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#64748b] hover:text-red-600"
                >
                  <LogOut className="h-4 w-4" />
                  Disconnect funding wallet
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-muted">
                No funding wallet connected. Passkey-first users only need a wallet when adding funds.
              </p>
            )}
          </Card>

          <Card>
            <CardHeader title="Issuer service" badge={<Badge tone="brand">Live endpoint</Badge>} />
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-slate-muted">Endpoint</dt>
                <dd className="mt-0.5 break-all text-navy">{config.issuerServiceUrl}</dd>
              </div>
              <div>
                <dt className="text-slate-muted">Marketplace settlement</dt>
                <dd className="mt-0.5 break-all font-mono text-xs">{config.marketplaceSettlementAddress}</dd>
              </div>
              <div>
                <dt className="text-slate-muted">Explorer</dt>
                <dd className="mt-0.5 break-all text-navy">{config.explorerBaseUrl}</dd>
              </div>
            </dl>
          </Card>
        </div>

        <div className="mt-10 lg-surface-card divide-y divide-[var(--lg-border)] overflow-hidden">
          <div className="p-5">
            <SectionHeader
              title="Deployed contracts"
              description="Live Soroban testnet references used by passport, proof, and settlement flows."
            />
          </div>
          {contracts.map((c) => (
            <div key={c.label} className="flex flex-wrap items-center gap-4 p-5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#007dfc] to-[#012b54] text-white">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#012b54]">{c.label}</p>
                <p className="break-all font-mono text-xs text-[#64748b]">{c.id}</p>
              </div>
              <a
                href={`${config.explorerBaseUrl.replace(/\/$/, '')}/contract/${c.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#007dfc] hover:underline"
              >
                Stellar Expert <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          ))}
        </div>

        <Card className="mt-8">
          <CardHeader title="Eligibility plans" />
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge tone="ok">Plan {config.policyId} — Investor access</Badge>
            <Badge tone="ok">Plan {config.policyId2} — Balance confirmation</Badge>
            {config.sessionStoreId ? (
              <Badge tone="brand">
                <span className="inline-flex items-center gap-1"><StatusDot /> SessionStore</span>
              </Badge>
            ) : null}
          </div>
          <p className="mt-3 text-xs text-slate-muted">
            Issuer registry {truncateMiddle(config.issuerRegistryId, 8, 6)} · Wallet role: funding only.
          </p>
        </Card>

        <Card className="mt-8">
          <CardHeader title="Passkey recovery" badge={<Badge tone="warn">No key recovery</Badge>} />
          <div className="space-y-3 text-sm text-slate-muted">
            <p>
              Lumengate cannot recover a lost platform passkey. Passkeys authorize the smart account directly, so a lost
              authenticator means that account cannot sign protected settlement calls.
            </p>
            <p>
              The supported recovery path is replacement: create a new passkey smart account on Passport, fund the new
              deposit address with XLM and the settlement asset, then request a fresh passport proof. Funds left on an
              old account remain on that old contract address.
            </p>
            <p>
              For the hackathon testnet deployment, multi-device passkey backup depends on the user platform provider
              (for example iCloud Keychain or Google Password Manager), not Lumengate custody.
            </p>
          </div>
        </Card>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <AssetPolicyMatrix />
          <UsdcCompliancePanel config={config} walletAddress={settlementOwner} variant="compact" />
        </div>
      </AppPageLayout>
    </AppShell>
  );
}
