import { AppShell } from '../components/layout/Shell';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { PageHeader } from '../components/fintech/PageHeader';
import { AssetPolicyMatrix } from '../components/product/AssetPolicyMatrix';
import { UsdcCompliancePanel } from '../components/product/UsdcCompliancePanel';
import { useApp } from '../context/AppContext';
import { truncateMiddle } from '../lib/utils';

export function SettingsPage() {
  const { config, address, disconnect } = useApp();

  const contracts = [
    { label: 'Passport registry', id: config.credentialRegistryId },
    { label: 'Eligibility checker', id: config.policyVerifierId },
    { label: 'Asset token', id: config.rwaTokenId },
    { label: 'Asset adapter', id: config.rwaAdapterId },
    { label: 'Issuer registry', id: config.issuerRegistryId },
  ];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Settings"
        title="Account & network"
        subtitle="Wallet connection, testnet configuration, and deployed contract references."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Wallet" badge={<Badge tone="brand">{config.network}</Badge>} />
          {address ? (
            <div className="space-y-3">
              <p className="font-mono text-sm text-navy">{address}</p>
              <button
                type="button"
                onClick={disconnect}
                className="text-sm font-semibold text-slate-muted hover:text-status-err"
              >
                Disconnect wallet
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-muted">No wallet connected. Use the header to connect a Stellar wallet.</p>
          )}
        </Card>

        <Card>
          <CardHeader title="Issuer service" />
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-slate-muted">Endpoint</dt>
              <dd className="mt-0.5 break-all text-navy">{config.issuerServiceUrl}</dd>
            </div>
            <div>
              <dt className="text-slate-muted">Settlement address</dt>
              <dd className="mt-0.5 font-mono text-xs">{config.marketplaceSettlementAddress}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Network" />
          <p className="text-sm text-slate-muted">
            Lumengate runs on Stellar Soroban testnet. All settlement uses live contracts and official
            testnet USDC/EURC — no simulated balances.
          </p>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Deployed contracts"
            description="Live Soroban testnet references used by all settlement flows."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {contracts.map((c) => (
              <div key={c.label} className="rounded-xl border border-slate-line bg-slate-50 p-4">
                <div className="text-xs font-medium uppercase text-slate-muted">{c.label}</div>
                <div className="mt-1 break-all font-mono text-xs text-navy">{c.id}</div>
                <a
                  href={`https://stellar.expert/explorer/testnet/contract/${c.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs font-semibold text-brand hover:underline"
                >
                  Stellar Expert →
                </a>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Eligibility plans" />
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge tone="ok">Plan {config.policyId} — Investor access</Badge>
            <Badge tone="ok">Plan {config.policyId2} — Balance confirmation</Badge>
          </div>
          <p className="mt-3 text-xs text-slate-muted">
            Explorer base: {config.explorerBaseUrl} · Issuer registry{' '}
            {truncateMiddle(config.issuerRegistryId, 8, 6)}
          </p>
        </Card>

        <div className="lg:col-span-2 grid gap-6 xl:grid-cols-2">
          <AssetPolicyMatrix />
          <UsdcCompliancePanel config={config} walletAddress={address} variant="compact" />
        </div>
      </div>
    </AppShell>
  );
}
