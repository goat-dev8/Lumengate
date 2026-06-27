import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Fingerprint, LogOut, Network, ShieldCheck, Wallet } from 'lucide-react';
import { AppPageLayout } from '../components/design/AppPageLayout';
import { Pill, SectionHeader, StatusDot } from '../components/design/Primitives';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { AssetPolicyMatrix } from '../components/product/AssetPolicyMatrix';
import { UsdcCompliancePanel } from '../components/product/UsdcCompliancePanel';
import { AdvancedModeToggle, useAdvancedMode } from '../components/product/AdvancedModeToggle';
import { useApp } from '../context/AppContext';
import { truncateMiddle } from '../lib/utils';
import { currentSettlementOwner } from '../lib/settlementOwner';
import { fetchLatestLedger } from '../lib/horizonLedger';
import { cn } from '../lib/cn';

type SettingsTab = 'account' | 'advanced';

function TabBar({ tab, onTab }: { tab: SettingsTab; onTab: (t: SettingsTab) => void }) {
  const items: { id: SettingsTab; label: string }[] = [
    { id: 'account', label: 'Account' },
    { id: 'advanced', label: 'Advanced' },
  ];
  return (
    <div className="flex gap-1 rounded-xl border border-[var(--lg-border)] bg-[var(--lg-muted-bg)] p-1" role="tablist">
      {items.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          onClick={() => onTab(id)}
          className={cn(
            'flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition',
            tab === id ? 'bg-white text-[#012b54] shadow-sm' : 'text-[#64748b] hover:text-[#012b54]',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function SettingsPage() {
  const { config, address, settlementAddress, connect, connecting, disconnect } = useApp();
  const [ledger, setLedger] = useState<number | null>(null);
  const [tab, setTab] = useState<SettingsTab>('account');
  const advanced = useAdvancedMode();
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

  return (
    <AppPageLayout
      title="Settings"
      subtitle="Account, network, and optional developer tools."
    >
      <TabBar tab={tab} onTab={setTab} />

      {tab === 'account' ? (
        <div className="mt-8 space-y-8" role="tabpanel">
          <SectionHeader
            eyebrow="Your account"
            title="Passkey smart account"
            description="Your Lumengate account is secured with a passkey — no seed phrase required."
            action={
              <Pill tone={config.network === 'testnet' ? 'brand' : 'warning'}>
                <Network className="h-3 w-3" /> {config.network}
              </Pill>
            }
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="lg-surface-card p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#007dfc]/10">
                  <Fingerprint className="h-5 w-5 text-[#007dfc]" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Smart account</p>
                  <p className="mt-0.5 text-sm font-semibold text-[#012b54]">
                    {settlementAddress ? 'Active' : 'Not created'}
                  </p>
                </div>
              </div>
              {settlementAddress ? (
                <p className="mt-3 break-all font-mono text-xs text-[#64748b]">{settlementAddress}</p>
              ) : (
                <Link to="/app/welcome" className="mt-3 inline-block text-sm font-semibold text-[#007dfc] hover:underline">
                  Create your secure account →
                </Link>
              )}
            </div>
            <div className="lg-surface-card p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Network</p>
              <p className="mt-2 lg-font-display text-2xl tracking-tight text-[#012b54]">{config.network}</p>
              <p className="mt-1 text-xs text-[#64748b]">
                {ledger ? `Ledger #${ledger.toLocaleString()}` : 'Reading Horizon…'}
              </p>
            </div>
          </div>

          <Card>
            <CardHeader
              title="Funding wallet"
              badge={<Badge tone={address ? 'ok' : 'warn'}>{address ? 'Connected' : 'Optional'}</Badge>}
            />
            <p className="text-sm text-slate-muted">
              Only needed when transferring funds from an external wallet. Passkey-first users can claim demo USDC instead.
            </p>
            {address ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl bg-[#f6f9fc] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">Funding wallet</p>
                  <p className="mt-1 break-all font-mono text-xs text-[#012b54]">{address}</p>
                </div>
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
              <Button className="mt-4" loading={connecting} onClick={() => connect()}>
                <Wallet className="h-4 w-4" />
                Connect funding wallet
              </Button>
            )}
          </Card>

          <Card>
            <CardHeader title="Passkey recovery" badge={<Badge tone="warn">No key recovery</Badge>} />
            <div className="space-y-3 text-sm text-slate-muted">
              <p>
                Lumengate cannot recover a lost platform passkey. Passkeys authorize the smart account directly, so a lost
                authenticator means that account cannot sign protected settlement calls.
              </p>
              <p>
                The supported recovery path is replacement: create a new passkey smart account on Passport, fund the new
                deposit address, then request a fresh passport proof.
              </p>
            </div>
          </Card>
        </div>
      ) : (
        <div className="mt-8 space-y-8" role="tabpanel">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <SectionHeader
              eyebrow="Developer"
              title="Advanced settings"
              description="Contract references, issuer endpoints, and operator tools."
            />
            <AdvancedModeToggle />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { label: 'Network', value: config.network, detail: ledger ? `Ledger #${ledger.toLocaleString()}` : '—' },
              { label: 'Contracts', value: String(contracts.length), detail: 'Live Soroban IDs' },
              {
                label: 'Settlement owner',
                value: settlementOwner ? truncateMiddle(settlementOwner, 6, 4) : '—',
                detail: 'Active signing address',
              },
            ].map((m) => (
              <div key={m.label} className="lg-surface-card p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">{m.label}</p>
                <p className="mt-2 lg-font-display text-2xl tracking-tight text-[#012b54]">{m.value}</p>
                <p className="mt-1 truncate text-xs text-[#64748b]">{m.detail}</p>
              </div>
            ))}
          </div>

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

          <div className="lg-surface-card divide-y divide-[var(--lg-border)] overflow-hidden">
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

          <Card>
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
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              to="/app/auditor"
              className="lg-surface-card flex items-center gap-3 p-5 transition hover:border-[#007dfc]/30"
            >
              <ShieldCheck className="h-5 w-5 text-[#007dfc]" />
              <div>
                <p className="text-sm font-semibold text-[#012b54]">Auditor portal</p>
                <p className="text-xs text-[#64748b]">Verify disclosure packs</p>
              </div>
            </Link>
            {advanced ? (
              <Link
                to="/app/admin"
                className="lg-surface-card flex items-center gap-3 p-5 transition hover:border-[#007dfc]/30"
              >
                <Network className="h-5 w-5 text-[#007dfc]" />
                <div>
                  <p className="text-sm font-semibold text-[#012b54]">Operator console</p>
                  <p className="text-xs text-[#64748b]">Issuer and registry tools</p>
                </div>
              </Link>
            ) : null}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <AssetPolicyMatrix />
            <UsdcCompliancePanel config={config} walletAddress={settlementOwner} variant="compact" />
          </div>
        </div>
      )}
    </AppPageLayout>
  );
}
