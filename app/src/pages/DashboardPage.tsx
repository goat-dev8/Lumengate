import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppPageLayout } from '../components/design/AppPageLayout';
import { useApp } from '../context/AppContext';
import { useOfferings } from '../hooks/useOfferings';
import { readBalance, readComplianceAdminUsdcBalance } from '../lib/contracts';
import { derivePassportPhase, phaseLabel } from '../lib/passportLifecycle';
import { formatHeroPortfolio, formatSettledLabel } from '../lib/dashboardPortfolio';
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
import { HomeJourneyProgress } from '../components/dashboard/HomeJourneyProgress';
import { HomeQuickActions } from '../components/dashboard/HomeQuickActions';
import { RecentSettlements } from '../components/dashboard/RecentSettlements';
import { FloatingTestnetFaucet } from '../components/product/FloatingTestnetFaucet';
import { ConfidentialBalancePanel } from '../components/product/ConfidentialBalancePanel';
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

  const showStoryHero = !readyToInvest && (portfolio.main === '—' || !settlementOwner);

  const topSubtitle = readyToInvest
    ? "You're verified and cleared for private investing and settlement."
    : proofSpent
      ? 'Your last settlement succeeded. Renew your passport to invest or send again.'
      : showStoryHero
        ? 'Passkey accounts, zero-knowledge passports, and private settlements on Stellar.'
        : phase === 'passport-issued'
          ? 'Confirm eligibility on your device to activate your private passport.'
          : settlementAddress
            ? 'Request your passport to prove eligibility without revealing private data.'
            : 'Create your secure account with a passkey — no seed phrase required.';

  const dashboardTitle = readyToInvest
    ? 'Welcome back'
    : showStoryHero
      ? 'Private investing, privately proven'
      : settlementAddress
        ? 'Your dashboard'
        : readiness.title;

  const receiptsDesc =
    monthReceipts > 0
      ? `${monthReceipts} settlement${monthReceipts === 1 ? '' : 's'} this month`
      : receiptCount > 0
        ? `${receiptCount} sealed receipt${receiptCount === 1 ? '' : 's'} on record`
        : 'Auditor-grade proof after your first transfer';

  return (
    <AppPageLayout title={dashboardTitle} subtitle={topSubtitle}>
      {advanced ? (
        <div className="mb-8 space-y-4">
          <LiveOnStellarStrip config={config} />
          <AdvancedModeToggle />
          <ProductProgress steps={productSteps} />
        </div>
      ) : null}

      {proofSpent ? (
        <div className="mb-8">
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
        showStory={showStoryHero}
      />

      <div className="mt-10 space-y-12">
        <section aria-labelledby="home-quick-actions">
          <div className="mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">Next steps</p>
            <h2 id="home-quick-actions" className="mt-1 lg-font-display text-2xl tracking-tight text-[#012b54] md:text-3xl">
              Quick actions
            </h2>
          </div>
          <HomeQuickActions
            readiness={readiness}
            readyToInvest={readyToInvest}
            passportDesc={readyToInvest ? 'Active · manage scopes' : phaseLabel(phase)}
            marketplaceDesc={`${offerings.length} regulated offering${offerings.length === 1 ? '' : 's'} on Stellar testnet`}
            receiptsDesc={receiptsDesc}
            sendDesc={
              config.complianceSacAdminId
                ? 'USDC · EURC · Treasury — private settlement'
                : 'Treasury units on Stellar'
            }
          />
        </section>

        <HomeJourneyProgress steps={productSteps} />

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            <DashboardHoldings
              config={config}
              settlementOwner={settlementOwner}
              activity={activity}
              offerings={offerings}
            />
            {config.confidentialTokenId && settlementOwner ? <ConfidentialBalancePanel /> : null}
          </div>
          <DashboardActivityFeed activity={activity} />
        </div>

        <RecentSettlements activity={activity} />
      </div>

      {advanced ? (
        <div className="mt-12 grid gap-8 xl:grid-cols-2">
          <AssetPolicyMatrix />
          <UsdcCompliancePanel config={config} walletAddress={settlementOwner} />
        </div>
      ) : null}

      {settlementAddress && config.network === 'testnet' ? (
        <FloatingTestnetFaucet config={config} smartAccountAddress={settlementAddress} />
      ) : null}
    </AppPageLayout>
  );
}
