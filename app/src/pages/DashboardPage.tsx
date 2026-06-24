import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { AppShell } from '../components/layout/Shell';
import { Button } from '../components/ui/Button';
import { OfferingIllustration } from '../components/fintech/OfferingIllustration';
import { useApp } from '../context/AppContext';
import { useOfferings } from '../hooks/useOfferings';
import { readBalance, readComplianceAdminUsdcBalance } from '../lib/contracts';
import { derivePassportPhase, phaseLabel } from '../lib/passportLifecycle';
import { ProofLifecyclePanel } from '../components/product/ProofLifecyclePanel';
import { LiveOnStellarStrip } from '../components/product/LiveOnStellarStrip';
import { AssetPolicyMatrix } from '../components/product/AssetPolicyMatrix';
import { UsdcCompliancePanel } from '../components/product/UsdcCompliancePanel';
import { AdvancedModeToggle, useAdvancedMode } from '../components/product/AdvancedModeToggle';
import { ProductProgress } from '../components/product/ProductProgress';
import { HowItWorks } from '../components/product/HowItWorks';
import { buildProductSteps, getProductReadiness } from '../lib/productState';
import { currentSettlementOwner } from '../lib/settlementOwner';

export function DashboardPage() {
  const {
    address,
    connect,
    connecting,
    credential,
    proof,
    config,
    activity,
    proofReceipt,
    proofLifecycle,
    beginProofRecovery,
    settlementAddress,
  } = useApp();
  const navigate = useNavigate();
  const { offerings } = useOfferings();
  const [balance, setBalance] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const settlementOwner = currentSettlementOwner(config, address, settlementAddress);
  const activeProof = proofLifecycle.lifecycle === 'ready' ? proof : null;
  const phase = derivePassportPhase({
    address,
    credential,
    proof,
    lifecycle: proofLifecycle,
  });
  const proofSpent = phase === 'proof-spent';
  const readyToInvest = phase === 'proof-generated';

  useEffect(() => {
    if (!settlementOwner) {
      setBalance(null);
      return;
    }
    readBalance(config, settlementOwner)
      .then((b) => {
        setBalance(b);
        setBalanceError(null);
      })
      .catch((err) => {
        setBalance(null);
        setBalanceError(err instanceof Error ? err.message : String(err));
      });
    if (config.complianceSacAdminId) {
      readComplianceAdminUsdcBalance(config, settlementOwner)
        .then((snap) => setUsdcBalance(snap.formatted))
        .catch(() => setUsdcBalance(null));
    }
  }, [settlementOwner, config]);

  const lastSettlement = useMemo(() => {
    const tx = activity.find((e) => e.kind === 'transfer' && e.status === 'success');
    return tx ? tx.title.replace(/^USDC settlement: /, '').replace(/^Settlement: /, '') : null;
  }, [activity]);

  const feed = useMemo(
    () =>
      activity.slice(0, 5).map((e) => ({
        title: e.title,
        time: new Date(e.timestamp).toLocaleString(),
        url: e.explorerUrl,
      })),
    [activity],
  );

  const readiness = getProductReadiness({
    address,
    credential,
    proof: activeProof,
    lifecycle: proofLifecycle.lifecycle,
  });

  const advanced = useAdvancedMode();

  const productSteps = buildProductSteps({
    address,
    credential,
    proof: activeProof,
    lifecycle: proofLifecycle.lifecycle,
    hasSettlement: Boolean(proofReceipt?.transactions.transfer || activity.some((e) => e.kind === 'transfer')),
  });

  const featured = offerings.slice(0, 3);

  return (
    <AppShell>
      {advanced ? <LiveOnStellarStrip config={config} /> : null}
      <div className="mt-4 flex justify-end">
        <AdvancedModeToggle />
      </div>
      <div className="mt-2">
        <ProductProgress steps={productSteps} />
      </div>
      {settlementAddress ? (
        <section className="mt-4 rounded-xl border border-brand-200 bg-brand-50/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-navy">Fund Smart Account</p>
              <p className="mt-1 text-xs text-slate-muted">Deposit address</p>
              <p className="mt-1 break-all font-mono text-xs text-slate-ink">{settlementAddress}</p>
            </div>
            <div className="grid gap-2 text-right text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-muted">RWA</p>
                <p className="font-semibold text-navy">{balanceError ? 'RPC error' : balance ?? '...'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-muted">USDC</p>
                <p className="font-semibold text-navy">{usdcBalance ?? '...'}</p>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-muted">
            Funding status: {BigInt(balance ?? '0') > 0n || Number(usdcBalance ?? '0') > 0 ? 'funded' : 'waiting for deposit'}
          </p>
        </section>
      ) : null}
      {proofSpent ? (
        <div className="mt-4">
          <ProofLifecyclePanel
            state={proofLifecycle}
            config={config}
            onBeginRecovery={() => {
              beginProofRecovery();
              navigate('/app/verify#recovery-credential');
            }}
          />
        </div>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-2xl border border-[#e3e8ee] bg-gradient-to-br from-[#f6f9fc] to-white p-8 shadow-sm">
        <span className="inline-flex rounded-full bg-[#007dfc]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#007dfc]">
          Private investing
        </span>
        <h1 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-[#012b54] md:text-4xl">
          {readiness.title}
        </h1>
        <p className="mt-3 max-w-2xl text-base text-[#475569]">{readiness.description}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full border border-[#e3e8ee] bg-white px-3 py-1 text-xs font-medium text-[#012b54]">
            Status: {phaseLabel(phase)}
          </span>
          <span className="rounded-full border border-[#e3e8ee] bg-white px-3 py-1 text-xs font-medium text-[#012b54]">
            {offerings.length} investments available
          </span>
          {readyToInvest ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
              Ready to invest
            </span>
          ) : null}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          {!address ? (
            <Button loading={connecting} onClick={() => connect()}>
              Connect wallet
            </Button>
          ) : (
            <Link to={readiness.href}>
              <Button>
                {readiness.cta}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
          <Link to="/app/marketplace">
            <Button variant="secondary">Browse investments</Button>
          </Link>
        </div>
      </section>

      <div className="mt-8">
        <HowItWorks />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#e3e8ee] bg-white p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">Eligibility</p>
          <p className="mt-2 text-lg font-semibold text-[#012b54]">{phaseLabel(phase)}</p>
          <Link to="/app/verify" className="mt-2 inline-block text-xs font-medium text-[#007dfc]">
            Manage passport →
          </Link>
        </div>
        <div className="rounded-xl border border-[#e3e8ee] bg-white p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">Investments</p>
          <p className="mt-2 text-lg font-semibold text-[#012b54]">{offerings.length}</p>
          <p className="text-xs text-[#64748b]">Passport-gated offerings</p>
        </div>
        <div className="rounded-xl border border-[#e3e8ee] bg-white p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">Treasury units</p>
          <p className="mt-2 text-lg font-semibold text-[#012b54]">
            {balanceError ? '—' : balance ?? (address ? '…' : '—')}
          </p>
          <Link to="/app/portfolio" className="mt-2 inline-block text-xs font-medium text-[#007dfc]">
            View portfolio →
          </Link>
        </div>
        <div className="rounded-xl border border-[#e3e8ee] bg-white p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">Last settlement</p>
          <p className="mt-2 text-lg font-semibold text-[#012b54]">{lastSettlement ?? 'None yet'}</p>
          <Link to="/app/compliance" className="mt-2 inline-block text-xs font-medium text-[#007dfc]">
            View receipt →
          </Link>
        </div>
      </div>

      <div className="mt-10 grid gap-8 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">Invest</p>
              <h2 className="text-xl font-semibold text-[#012b54]">Featured opportunities</h2>
            </div>
            <Link to="/app/marketplace" className="text-sm font-medium text-[#007dfc] hover:text-[#012b54]">
              View all →
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {featured.map((offering) => (
              <Link key={offering.id} to={`/app/marketplace/${offering.id}`} className="lg-offering-card group block">
                <OfferingIllustration offering={offering} className="h-32" />
                <div className="lg-offering-body">
                  <h3 className="font-semibold text-[#012b54] transition group-hover:text-[#007dfc]">
                    {offering.title}
                  </h3>
                  <div className="lg-offering-stats">
                    <div className="lg-offering-stat">
                      <div className="lg-offering-stat-label">Access</div>
                      <div className="lg-offering-stat-value">Passport</div>
                    </div>
                    <div className="lg-offering-stat">
                      <div className="lg-offering-stat-label">Risk</div>
                      <div className="lg-offering-stat-value">{offering.riskLevel}</div>
                    </div>
                    <div className="lg-offering-stat">
                      <div className="lg-offering-stat-label">Min</div>
                      <div className="lg-offering-stat-value">{offering.minimumAmount}</div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="xl:col-span-2">
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">Activity</p>
            <h2 className="text-xl font-semibold text-[#012b54]">Recent activity</h2>
          </div>
          <div className="overflow-hidden rounded-xl border border-[#e3e8ee] bg-white shadow-sm">
            <ul className="divide-y divide-[#eef0f3]">
              {feed.length === 0 ? (
                <li className="px-4 py-6">
                  <p className="text-sm text-[#64748b]">No activity yet — verify eligibility to get started.</p>
                </li>
              ) : (
                feed.map((item, i) => (
                  <li key={`${item.title}-${i}`} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#012b54]">{item.title}</p>
                      <p className="text-xs text-[#64748b]">{item.time}</p>
                    </div>
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#007dfc]"
                      >
                        View
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>

      {advanced ? (
        <div className="mt-8 grid gap-8 xl:grid-cols-2">
          <AssetPolicyMatrix />
          <UsdcCompliancePanel config={config} walletAddress={settlementOwner} />
        </div>
      ) : null}
    </AppShell>
  );
}
