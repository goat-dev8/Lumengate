import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  FileCheck2,
  Send,
  ShieldCheck,
  Store,
} from 'lucide-react';
import { AppShell } from '../components/layout/Shell';
import { AppPageLayout } from '../components/design/AppPageLayout';
import { Stagger, StaggerItem, StatusDot } from '../components/design/Primitives';
import { useApp } from '../context/AppContext';
import { useOfferings } from '../hooks/useOfferings';
import { readBalance, readComplianceAdminUsdcBalance } from '../lib/contracts';
import { derivePassportPhase, phaseLabel } from '../lib/passportLifecycle';
import { formatHeroPortfolio, formatSettledLabel } from '../lib/dashboardPortfolio';
import { FundSmartAccountPanel } from '../components/product/FundSmartAccountPanel';
import { ProofLifecyclePanel } from '../components/product/ProofLifecyclePanel';
import { LiveOnStellarStrip } from '../components/product/LiveOnStellarStrip';
import { AssetPolicyMatrix } from '../components/product/AssetPolicyMatrix';
import { UsdcCompliancePanel } from '../components/product/UsdcCompliancePanel';
import { AdvancedModeToggle, useAdvancedMode } from '../components/product/AdvancedModeToggle';
import { ProductProgress } from '../components/product/ProductProgress';
import { buildProductSteps, getProductReadiness } from '../lib/productState';
import { currentSettlementOwner } from '../lib/settlementOwner';
import { DashboardHoldings } from '../components/dashboard/DashboardHoldings';
import { DashboardActivityFeed } from '../components/dashboard/DashboardActivityFeed';
import { DashboardHero } from '../components/dashboard/DashboardHero';
import { getOnboardingPath } from '../components/product/OnboardingPathPicker';

export function DashboardPage() {
  const {
    address,
    credential,
    proof,
    config,
    activity,
    proofReceipt,
    proofLifecycle,
    policyKey,
    beginProofRecovery,
    settlementAddress,
    fundSmartAccountUsdc,
    fundSmartAccountEurc,
    fundSmartAccountXlm,
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
        .then((s) => setUsdcBalance(s.formatted))
        .catch(() => setUsdcBalance(null));
    } else {
      setUsdcBalance(null);
    }
  }, [settlementOwner, config, activity]);

  const passkeyFirst = getOnboardingPath() === 'passkey';

  const readiness = getProductReadiness({
    address,
    settlementAddress,
    credential,
    proof: activeProof,
    lifecycle: proofLifecycle.lifecycle,
    passkeyFirst,
  });

  const advanced = useAdvancedMode();

  const productSteps = buildProductSteps({
    address,
    settlementAddress,
    credential,
    proof: activeProof,
    lifecycle: proofLifecycle.lifecycle,
    hasSettlement: Boolean(proofReceipt?.transactions.transfer || activity.some((e) => e.kind === 'transfer')),
    passkeyFirst,
  });

  const receiptCount = activity.filter((e) => e.kind === 'transfer' && e.status === 'success').length;
  const monthReceipts = activity.filter((e) => {
    if (e.kind !== 'transfer' || e.status !== 'success') return false;
    const d = new Date(e.timestamp);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const portfolio = useMemo(() => {
    if (balanceError) return { main: 'Unavailable' as const };
    if (!settlementOwner) return { main: '—' as const };
    return formatHeroPortfolio(usdcBalance, balance);
  }, [balanceError, settlementOwner, usdcBalance, balance]);

  const settledTotalLabel = useMemo(() => formatSettledLabel(activity), [activity]);

  const topSubtitle = readyToInvest
    ? "Your passport is live and you're cleared to subscribe."
    : proofSpent
      ? 'Your proof was used. Recover your passport to invest again.'
      : credential
        ? 'Finish proving eligibility to unlock the marketplace.'
        : settlementAddress
          ? 'Create your passport to prove eligibility without revealing private data.'
          : 'Start with a passkey, then connect a wallet only when you need to fund.';

  const dashboardTitle = readyToInvest
    ? 'Welcome back'
    : settlementAddress
      ? 'Your dashboard'
      : readiness.title;

  const quickActions = [
    {
      icon: ShieldCheck,
      label: 'Passport',
      desc: readyToInvest ? 'Active' : phaseLabel(phase),
      to: '/app/verify',
      tone: readyToInvest ? ('success' as const) : undefined,
    },
    {
      icon: Store,
      label: 'Marketplace',
      desc: `${offerings.length} live offering${offerings.length === 1 ? '' : 's'}`,
      to: '/app/marketplace',
    },
    {
      icon: Send,
      label: 'Send',
      desc: config.complianceSacAdminId ? 'USDC · EURC · Treasury' : 'Treasury units',
      to: '/app/send',
    },
    {
      icon: FileCheck2,
      label: 'Receipts',
      desc:
        monthReceipts > 0
          ? `${monthReceipts} this month`
          : receiptCount > 0
            ? `${receiptCount} total`
            : 'No settlements yet',
      to: '/app/compliance',
    },
  ];

  return (
    <AppShell>
      <AppPageLayout title={dashboardTitle} subtitle={topSubtitle}>
        {advanced ? (
          <div className="mb-6 space-y-4">
            <LiveOnStellarStrip config={config} />
            <AdvancedModeToggle />
            <ProductProgress steps={productSteps} />
          </div>
        ) : null}

        {proofSpent ? (
          <div className="mb-6">
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

        {settlementAddress && !readyToInvest && !address ? (
          <div className="mb-6">
            <FundSmartAccountPanel
              config={config}
              smartAccountAddress={settlementAddress}
              onFundUsdc={fundSmartAccountUsdc}
              onFundEurc={fundSmartAccountEurc}
              onFundXlm={fundSmartAccountXlm}
            />
          </div>
        ) : null}

        <DashboardHero
          phase={phase}
          readyToInvest={readyToInvest}
          policyKey={policyKey}
          hasCredential={Boolean(credential)}
          portfolioMain={portfolio.main}
          portfolioSub={portfolio.sub}
          settledTotalLabel={settledTotalLabel}
          readinessHref={readiness.href}
          readinessCta={readiness.cta}
          activity={activity}
        />

        <Stagger className="mt-8 grid gap-4 md:grid-cols-4">
          {quickActions.map(({ icon: Icon, label, desc, to, tone }) => (
            <StaggerItem key={label}>
              <Link
                to={to}
                className="group lg-surface-card lg-surface-card-hover flex items-center gap-4 p-4 transition-all hover:-translate-y-0.5"
              >
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--lg-muted-bg)] text-[#012b54]">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#012b54]">{label}</p>
                  <p className="truncate text-xs text-[#64748b]">{desc}</p>
                </div>
                {tone === 'success' ? (
                  <StatusDot />
                ) : (
                  <ArrowUpRight className="h-4 w-4 text-[#64748b] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                )}
              </Link>
            </StaggerItem>
          ))}
        </Stagger>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DashboardHoldings
              config={config}
              settlementOwner={settlementOwner}
              activity={activity}
              offerings={offerings}
            />
          </div>

          <DashboardActivityFeed activity={activity} />
        </div>

        {advanced ? (
          <div className="mt-10 grid gap-8 xl:grid-cols-2">
            <AssetPolicyMatrix />
            <UsdcCompliancePanel config={config} walletAddress={settlementOwner} />
          </div>
        ) : null}
      </AppPageLayout>
    </AppShell>
  );
}
