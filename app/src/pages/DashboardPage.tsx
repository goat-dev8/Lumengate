import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  ArrowUpRight,
  FileCheck2,
  Send,
  ShieldCheck,
  Sparkles,
  Store,
} from 'lucide-react';
import { AppShell } from '../components/layout/Shell';
import { AppPageLayout } from '../components/design/AppPageLayout';
import { Pill, Stagger, StaggerItem, StatusDot } from '../components/design/Primitives';
import { Button } from '../components/ui/Button';
import { useApp } from '../context/AppContext';
import { useOfferings } from '../hooks/useOfferings';
import { readBalance, readComplianceAdminUsdcBalance } from '../lib/contracts';
import { derivePassportPhase, phaseLabel } from '../lib/passportLifecycle';
import { FundSmartAccountPanel } from '../components/product/FundSmartAccountPanel';
import { ProofLifecyclePanel } from '../components/product/ProofLifecyclePanel';
import { LiveOnStellarStrip } from '../components/product/LiveOnStellarStrip';
import { AssetPolicyMatrix } from '../components/product/AssetPolicyMatrix';
import { UsdcCompliancePanel } from '../components/product/UsdcCompliancePanel';
import { AdvancedModeToggle, useAdvancedMode } from '../components/product/AdvancedModeToggle';
import { ProductProgress } from '../components/product/ProductProgress';
import { buildProductSteps, getProductReadiness } from '../lib/productState';
import { policyByKey } from '../lib/policies';
import { currentSettlementOwner } from '../lib/settlementOwner';
import { DashboardHoldings } from '../components/dashboard/DashboardHoldings';
import { DashboardActivityFeed } from '../components/dashboard/DashboardActivityFeed';
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

  const lastSettlement = useMemo(() => {
    const tx = activity.find((e) => e.kind === 'transfer' && e.status === 'success');
    return tx ? tx.title.replace(/^USDC settlement: /, '').replace(/^Settlement: /, '') : null;
  }, [activity]);

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

  const passportBadge = credential
    ? `Passport active · ${policyByKey(policyKey).claims.slice(0, 2).join(' · ')}`
    : phaseLabel(phase);

  const portfolioDisplay = useMemo(() => {
    if (balanceError) return 'Unavailable';
    if (!settlementOwner) return '—';
    const parts: string[] = [];
    if (usdcBalance && usdcBalance !== '0' && usdcBalance !== '0.0000000') {
      parts.push(`${usdcBalance} USDC`);
    }
    if (balance && BigInt(balance) > 0n) {
      parts.push(`${balance} units`);
    }
    if (parts.length === 0) return balance !== null ? '0' : '…';
    return parts.join(' + ');
  }, [balanceError, settlementOwner, usdcBalance, balance]);

  const topSubtitle = readyToInvest
    ? "Your passport is live and you're cleared to subscribe."
    : proofSpent
      ? 'Your proof was used. Recover your passport to invest again.'
      : credential
        ? 'Finish proving eligibility to unlock the marketplace.'
        : settlementAddress
          ? 'Create your passport to prove eligibility without revealing private data.'
          : 'Start with a passkey, then connect a wallet only when you need to fund.';

  const heroMetric = portfolioDisplay;
  const heroMetricLabel = settlementOwner ? 'Portfolio value (on-chain)' : 'Portfolio value';

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

  const dashboardTitle = readyToInvest ? 'Welcome back' : settlementAddress ? 'Your dashboard' : readiness.title;

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
              onFundXlm={fundSmartAccountXlm}
            />
          </div>
        ) : null}

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-3xl lg-gradient-passport p-8 lg-shadow-lift md:p-10"
        >
          <div className="pointer-events-none absolute inset-0 lg-grid-bg opacity-10" />
          <div className="pointer-events-none absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full bg-[#5eb0ff]/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-40 -left-20 h-[360px] w-[360px] rounded-full bg-white/10 blur-3xl" />

          <div className="relative grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-end">
            <div>
              <Pill tone="brand" className="border-white/20 bg-white/10 text-white">
                <Sparkles className="h-3 w-3" />
                {passportBadge}
              </Pill>
              <p className="mt-5 text-sm uppercase tracking-[0.18em] text-white/60">{heroMetricLabel}</p>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-3">
                <h2 className="lg-font-display text-5xl leading-none tracking-tight text-white md:text-6xl lg:text-7xl">
                  {heroMetric}
                </h2>
              </div>
              <p className="mt-3 max-w-md text-sm text-white/70">
                You privately prove eligibility, invest in regulated assets, and receive auditor-grade receipts on
                Stellar.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/app/marketplace">
                  <Button className="rounded-full bg-white text-[#012b54] hover:bg-white/95">
                    Explore investments
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link
                  to="/app/send"
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/5 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10"
                >
                  Send funds
                </Link>
                {!readyToInvest ? (
                  <Link to={readiness.href}>
                    <Button
                      variant="secondary"
                      className="rounded-full border-white/25 bg-white/5 text-white hover:bg-white/10"
                    >
                      {readiness.cta}
                    </Button>
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Account summary</p>
              <ul className="mt-4 space-y-3 text-sm text-white/85">
                <li className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <span className="text-white/60">Eligibility</span>
                  <span className="font-medium">{phaseLabel(phase)}</span>
                </li>
                <li className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <span className="text-white/60">Settlements</span>
                  <span className="font-medium">{receiptCount}</span>
                </li>
                <li className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <span className="text-white/60">Offerings</span>
                  <span className="font-medium">{offerings.length} live</span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="text-white/60">Last action</span>
                  <span className="truncate font-medium">{lastSettlement ?? 'None yet'}</span>
                </li>
              </ul>
              <p className="mt-4 text-[11px] leading-relaxed text-white/50">
                Performance charts appear when issuer NAV history is available — not simulated here.
              </p>
            </div>
          </div>
        </motion.section>

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
