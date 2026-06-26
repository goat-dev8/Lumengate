import { useEffect, useMemo, useState } from 'react';

import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { ArrowRightLeft, Sparkles, Search, ShieldCheck, Filter } from 'lucide-react';

import { AppShell } from '../components/layout/Shell';
import { AppPageLayout } from '../components/design/AppPageLayout';
import { SectionHeader, Stagger, StaggerItem } from '../components/design/Primitives';
import { MarketplaceProductCard } from '../components/marketplace/MarketplaceProductCard';
import {
  MARKETPLACE_CATEGORIES,
  offeringMatchesCategory,
  type MarketplaceCategory,
} from '../lib/offeringDisplay';

import { Card } from '../components/ui/Card';

import { Button } from '../components/ui/Button';

import { Badge } from '../components/ui/Badge';

import { EmptyState, Skeleton } from '../components/ui/States';

import { useApp } from '../context/AppContext';

import { useOfferings } from '../hooks/useOfferings';

import { proofMatchesCredential } from '../lib/credentialProof';
import { currentSettlementOwner } from '../lib/settlementOwner';
import { ASSET_SCOPES } from '../lib/assetScope';
import { ProofLifecyclePanel } from '../components/product/ProofLifecyclePanel';
import { StaleSmartAccountUpgradePanel } from '../components/product/StaleSmartAccountUpgradePanel';
import { WalletSigningNotice } from '../components/product/WalletSigningNotice';
import { isProofUsable } from '../lib/proofLifecycle';
import { hasSufficientBalance, parseStellarAmount } from '../lib/assetAmount';

import {

  buildTransferTransaction,
  buildUsdcTransferTransaction,
  buildSwapCompliantTransaction,
  buildPayCompliantTransaction,
  buildVerifyTransaction,
  formatSorobanUserError,
  nullifierHexFromBundle,
  readBalance,
  readNullifierSpent,
  readComplianceAdminUsdcBalance,
} from '../lib/contracts';

import type { LiveOffering } from '../lib/offerings';

import { offeringMinimumBigInt } from '../lib/offerings';

import { policyByKey } from '../lib/policies';

import { explorerTxUrl, truncateMiddle } from '../lib/utils';

export function MarketplacePage() {

  const {

    address,

    connect,

    connecting,

    credential,

    proof,

    pofProof,

    policyKey,

    selectedOfferingId,

    setPolicyKey,

    setSelectedOfferingId,

    requestCredential,

    generatePofProofForWallet,

    config,

    signAndSubmit,
    signAndSubmitSettlement,

    pushActivity,

    recordTransferTx,

    recordVerifyTx,
    proofLifecycle,
    beginProofRecovery,
    smartAccount,
    settlementAddress,
    smartAccountCreating,
    smartAccountStale,
    replaceSmartAccount,
    ensureProofForAsset,
  } = useApp();

  const { offerings, loading: offeringsLoading, error: offeringsError } = useOfferings();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [marketSearch, setMarketSearch] = useState(searchParams.get('q') ?? '');
  const [category, setCategory] = useState<MarketplaceCategory>('All');
  const visibleOfferings = useMemo(() => {
    const q = (marketSearch || searchParams.get('q') || '').trim().toLowerCase();
    return offerings.filter((o) => {
      if (!offeringMatchesCategory(o, category)) return false;
      if (!q) return true;
      return (
        o.title.toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q) ||
        o.category.toLowerCase().includes(q) ||
        o.eligibilityPolicy.toLowerCase().includes(q)
      );
    });
  }, [offerings, marketSearch, searchParams, category]);

  const selected =

    offerings.find((o) => o.id === selectedOfferingId) ?? offerings[0] ?? null;
  const selectedScope = ASSET_SCOPES[selected?.settlementAsset === 'usdc' ? 'usdc' : 'rwa'];
  const activeProof =
    proofLifecycle.lifecycle === 'ready' &&
    proofMatchesCredential(proof, credential) &&
    proof?.publicInputs.assetId === selectedScope.assetId &&
    proof.publicInputs.actionId === selectedScope.actionId
      ? proof
      : null;
  const proofConsumed = proofLifecycle.lifecycle === 'consumed';

  const [balance, setBalance] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [usdcBalanceRaw, setUsdcBalanceRaw] = useState<bigint | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const [settling, setSettling] = useState(false);

  const [pofLoading, setPofLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [txHash, setTxHash] = useState<string | null>(null);

  const [pofTxHash, setPofTxHash] = useState<string | null>(null);



  useEffect(() => {

    if (!address) {

      setBalance(null);

      setBalanceError(null);

      return;

    }

    const balanceHolder = currentSettlementOwner(config, address, settlementAddress) ?? address;
    readBalance(config, balanceHolder)
      .then((b) => {
        setBalance(b);
        setBalanceError(null);
      })
      .catch((err) => {
        setBalance(null);
        setBalanceError(err instanceof Error ? err.message : String(err));
      });
    if (config.complianceSacAdminId) {
      readComplianceAdminUsdcBalance(config, balanceHolder)
        .then((snap) => {
          setUsdcBalance(snap.formatted);
          setUsdcBalanceRaw(snap.raw);
        })
        .catch(() => {
          setUsdcBalance(null);
          setUsdcBalanceRaw(null);
        });
    } else {
      setUsdcBalance(null);
      setUsdcBalanceRaw(null);
    }

  }, [address, settlementAddress, config, txHash, pofTxHash]);



  const prepareOffering = async (offering: LiveOffering) => {
    setSelectedOfferingId(offering.id);
    setPolicyKey(offering.requiredPolicy);
    setError(null);

    if (!settlementAddress) {
      navigate('/app/verify');
      return;
    }

    if (!credential) {
      try {
        await requestCredential(offering.requiredPolicy);
        navigate('/app/verify');
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
      return;
    }

    navigate('/app/verify');
  };



  const fundsThreshold = (offering: LiveOffering): bigint | null => {

    if (!offering.fundsThreshold) return null;

    return BigInt(offering.fundsThreshold);

  };



  const handleGeneratePof = async (offering: LiveOffering) => {

    const threshold = fundsThreshold(offering);

    if (!threshold) return;

    setPofLoading(true);

    setError(null);

    try {

      await generatePofProofForWallet(threshold);

    } catch (err) {

      setError(err instanceof Error ? err.message : String(err));

    } finally {

      setPofLoading(false);

    }

  };



  const canSettle = (offering: LiveOffering): string | null => {
    if (proofConsumed) return 'Renew passport to invest again';
    if (!isProofUsable(proofLifecycle)) {
      return proofLifecycle.reason ?? 'Complete your passport first';
    }
    if (!settlementAddress || !credential) return 'Complete your passport first';
    if (!smartAccount) return 'Create your smart account first';
    if (smartAccountStale) return 'Upgrade your smart account on Verify or Send first';

    if (policyKey !== offering.requiredPolicy) {

      return `Credential required: ${policyByKey(offering.requiredPolicy).title}`;

    }

    if (activeProof && Number(activeProof.publicInputs.policyId) !== policyByKey(offering.requiredPolicy).policyId) {

      return 'Renew your passport for this investment';

    }

    const threshold = fundsThreshold(offering);

    if (threshold) {

      if (!pofProof || Number(pofProof.publicInputs.policyId) !== config.policyId2) {

        return 'Private balance check required';

      }

      if (balance !== null && BigInt(balance) < threshold) {

        return `Minimum balance ${threshold.toString()} units`;

      }

    }

    const amount = offeringMinimumBigInt(offering);
    const isUsdc = offering.settlementAsset === 'usdc';
    const route = offering.settlementRoute ?? (isUsdc ? 'sac' : 'rwa');
    if (route === 'dex' && !config.compliantDexId) return 'CompliantDEX not configured';
    if (route === 'payroll' && !config.compliantPayrollId) return 'CompliantPayroll not configured';
    if (isUsdc) {
      if (route === 'sac' && !config.complianceSacAdminId) return 'USDC settlement not configured';
      try {
        const minRaw = parseStellarAmount(offering.minimumAmount);
        if (usdcBalanceRaw !== null && !hasSufficientBalance(usdcBalanceRaw, minRaw)) {
          return `Minimum ${offering.minimumAmount} USDC (available ${usdcBalance ?? '0'})`;
        }
      } catch {
        return 'Invalid offering minimum amount';
      }
    } else if (balance !== null && BigInt(balance) < amount) {
      return `Minimum investment ${amount.toString()} units`;
    }

    return null;

  };



  const handleSettle = async (offering: LiveOffering) => {

    const block = canSettle(offering);

    if (block || !address || !credential) {

      setError(block || 'Complete your passport first');

      return;

    }

    setSettling(true);

    setError(null);

    try {

      const settlementAsset = offering.settlementAsset === 'usdc' ? 'usdc' : 'rwa';
      const scope = ASSET_SCOPES[settlementAsset];
      const scopedProof =
        activeProof ?? (await ensureProofForAsset(settlementAsset)).proof;
      const pid = Number(scopedProof.publicInputs.policyId);

      const spent = await readNullifierSpent(config, nullifierHexFromBundle(scopedProof), pid, scope);

      if (spent) {
        setError('Your passport was used. Renew it before investing again.');
        beginProofRecovery();
        navigate('/app/verify#recovery-credential');
        return;
      }



      const threshold = fundsThreshold(offering);

      if (threshold && pofProof) {

        const pofSpent = await readNullifierSpent(

          config,

          nullifierHexFromBundle(pofProof),

          config.policyId2,

        );

        if (pofSpent) {

          throw new Error('Private balance check was already used — run it again');

        }

        const verifyXdr = await buildVerifyTransaction(config, address, config.policyId2, pofProof);

        const verifyHash = await signAndSubmit(verifyXdr);

        setPofTxHash(verifyHash);

        await recordVerifyTx(verifyHash);

        pushActivity({

          kind: 'verify',

          title: 'Balance privately confirmed',

          detail: verifyHash,

          txHash: verifyHash,

          explorerUrl: explorerTxUrl(config.explorerBaseUrl, verifyHash),

          status: 'success',

        });

      }



      const recipient = offering.settlementAddress || config.marketplaceSettlementAddress;
      const amount = offering.minimumAmount;
      const route = offering.settlementRoute ?? (offering.settlementAsset === 'usdc' ? 'sac' : 'rwa');
      const settlementFrom = currentSettlementOwner(config, address, settlementAddress) ?? address;
      let tx: Parameters<typeof signAndSubmit>[0];
      if (route === 'dex') {
        tx = await buildSwapCompliantTransaction(
          config,
          address,
          settlementFrom,
          recipient,
          amount,
          scopedProof,
        );
      } else if (route === 'payroll') {
        tx = await buildPayCompliantTransaction(
          config,
          address,
          settlementFrom,
          recipient,
          amount,
          scopedProof,
        );
      } else if (offering.settlementAsset === 'usdc') {
        tx = await buildUsdcTransferTransaction(
          config,
          address,
          settlementFrom,
          recipient,
          amount,
          scopedProof,
          scope,
        );
      } else {
        tx = await buildTransferTransaction(
          config,
          address,
          settlementFrom,
          recipient,
          amount,
          scopedProof,
          scope,
        );
      }

      const hash = await signAndSubmitSettlement(settlementFrom, scopedProof, tx);

      setTxHash(hash);

      await recordTransferTx(hash, {

        from: settlementFrom,

        to: recipient,

        amount,

        success: true,

      });

      pushActivity({

        kind: 'transfer',

        title: `Settlement: ${offering.title}`,

        detail: `${amount} ${offering.settlementAsset === 'usdc' ? 'USDC' : 'units'} → ${truncateMiddle(recipient, 8, 6)} (${route})`,

        txHash: hash,

        explorerUrl: explorerTxUrl(config.explorerBaseUrl, hash),

        status: 'success',

      });

      navigate('/app/compliance');

    } catch (err) {

      const raw = err instanceof Error ? err.message : String(err);

      setError(formatSorobanUserError(raw));

    } finally {

      setSettling(false);

    }

  };



  if (offeringsLoading) {

    return (

      <AppShell>

        <Skeleton className="h-32 w-full" />

        <div className="mt-8 grid gap-8 xl:grid-cols-3">

          <Skeleton className="h-96" />

          <Skeleton className="h-96" />

          <Skeleton className="h-96" />

        </div>

      </AppShell>

    );

  }



  if (offeringsError || offerings.length === 0) {

    return (

      <AppShell>

        <EmptyState

          title="Offerings unavailable"

          description={

            offeringsError ||

            'Issuer service returned no offerings. Start issuer-service and verify /offerings.'

          }

        />

      </AppShell>

    );

  }



  return (
    <AppShell>
      <AppPageLayout
        title="Marketplace"
        subtitle="Regulated, tokenized, settlement-ready offerings on Stellar."
      >
        <SectionHeader
          eyebrow="Offerings"
          title="Curated by Lumengate"
          description={
            proofConsumed
              ? 'Your passport was used — renew it to invest again.'
              : activeProof
                ? 'You are verified. Choose an offering and authorize with your passkey.'
                : credential
                  ? 'Finish eligibility to unlock investing.'
                  : 'Every offering is permissioned. Your passport unlocks eligibility automatically.'
          }
          action={
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--lg-border)] bg-white px-3 py-1.5 text-xs text-[#64748b]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#007dfc]" />
              Eligible offerings shown first
            </div>
          }
        />

        {(settlementAddress || address) ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <div className="rounded-xl border border-[#e3e8ee] bg-white px-5 py-3 shadow-sm">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">
                Treasury units
              </div>
              {balanceError ? (
                <p className="mt-1 text-sm text-status-err">{balanceError}</p>
              ) : (
                <div className="text-xl font-semibold tabular-nums text-[#012b54]">
                  {balance !== null ? balance : 'Reading…'}
                </div>
              )}
            </div>
            {config.complianceSacAdminId ? (
              <div className="rounded-xl border border-[#e3e8ee] bg-white px-5 py-3 shadow-sm">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">
                  USDC for settlement
                </div>
                <div className="text-xl font-semibold tabular-nums text-[#012b54]">
                  {usdcBalance !== null ? `${usdcBalance} USDC` : 'Reading…'}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

      {proofConsumed || proofLifecycle.lifecycle === 'invalid' ? (
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

      {address && smartAccountStale ? (
        <div className="mb-6">
          <StaleSmartAccountUpgradePanel
            legacyAddress={settlementAddress}
            loading={smartAccountCreating}
            onReplace={replaceSmartAccount}
          />
        </div>
      ) : null}

      {address && activeProof ? (
        <div className="mb-6">
          <WalletSigningNotice compact />
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-[var(--lg-border)] bg-white px-3 py-2">
          <Search className="h-4 w-4 text-[#64748b]" />
          <input
            type="search"
            value={marketSearch}
            onChange={(e) => setMarketSearch(e.target.value)}
            placeholder="Search by name or issuer"
            className="w-48 bg-transparent text-sm outline-none placeholder:text-[#94a3b8] sm:w-64"
            aria-label="Search offerings"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {MARKETPLACE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                category === c
                  ? 'border-[#012b54] bg-[#012b54] text-white'
                  : 'border-[var(--lg-border)] bg-white text-[#64748b] hover:bg-[var(--lg-muted-bg)]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[var(--lg-border)] bg-white px-3 py-1.5 text-xs text-[#64748b]"
          onClick={() => {
            setCategory('All');
            setMarketSearch('');
          }}
        >
          <Filter className="h-3.5 w-3.5" /> Clear filters
        </button>
      </div>

      <Stagger className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">

        {visibleOfferings.map((offering) => {

          const policy = policyByKey(offering.requiredPolicy);

          const block = canSettle(offering);

          const isSelected = selected?.id === offering.id;

          const threshold = fundsThreshold(offering);

          return (
            <StaggerItem key={offering.id}>
            <MarketplaceProductCard offering={offering} selected={isSelected}>
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[var(--lg-border)] pt-4 text-sm">
                  <div>
                    <span className="text-[#64748b]">Settles in</span>
                    <p className="font-medium text-[#012b54]">
                      {offering.settlementAsset.toUpperCase()}
                      {offering.settlementRoute && offering.settlementRoute !== 'rwa'
                        ? ` · ${offering.settlementRoute}`
                        : ''}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#64748b]">Who can invest</span>
                    <p className="font-medium text-[#012b54]">{policy.title}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {policy.claims.slice(0, 3).map((c) => (
                    <span
                      key={c}
                      className="rounded-md bg-[var(--lg-muted-bg)] px-2 py-0.5 text-[10.5px] font-medium text-[#64748b]"
                    >
                      {c}
                    </span>
                  ))}
                </div>

                <div className="mt-6 flex flex-col gap-2">
                  <Button variant="secondary" onClick={() => prepareOffering(offering)}>
                    Get ready to invest
                  </Button>
                  {threshold ? (
                    <Button
                      variant="secondary"
                      loading={pofLoading && isSelected}
                      onClick={() => {
                        setSelectedOfferingId(offering.id);
                        handleGeneratePof(offering);
                      }}
                    >
                      <Sparkles className="h-4 w-4" />
                      Confirm balance privately
                    </Button>
                  ) : null}
                  <Button
                    loading={settling && isSelected}
                    disabled={Boolean(block)}
                    onClick={() => {
                      setSelectedOfferingId(offering.id);
                      handleSettle(offering);
                    }}
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    Invest now
                  </Button>
                  {block && address ? <p className="text-xs text-[#64748b]">{block}</p> : null}
                </div>
            </MarketplaceProductCard>
            </StaggerItem>
          );
        })}
      </Stagger>

      {visibleOfferings.length === 0 && !offeringsLoading ? (
        <div className="mt-16 lg-surface-card p-12 text-center">
          <p className="text-sm font-semibold text-[#012b54]">No offerings match</p>
          <p className="mt-1 text-sm text-[#64748b]">Try clearing filters or another category.</p>
        </div>
      ) : null}

      {!address ? (

        <EmptyState

          title="Connect to invest"

          description="Connect your account to unlock passport-gated investments."

          action={

            <Button loading={connecting} onClick={() => connect()}>

              Connect wallet

            </Button>

          }

        />

      ) : null}



      {error ? (

        <Card className="border-red-100 bg-red-50/50">

          <p className="text-sm text-status-err">{error}</p>

          <Link to="/app/verify" className="mt-3 inline-block">

            <Button variant="secondary" size="sm">

              Open passport

            </Button>

          </Link>

        </Card>

      ) : null}



      {txHash ? (

        <Card className="border-emerald-100 bg-emerald-50/30">

          <div className="flex flex-wrap items-center justify-between gap-3">

            <div>

              <Badge tone="ok">Settlement confirmed</Badge>

              <p className="mt-2 font-mono text-xs break-all text-[#012b54]">{txHash}</p>

            </div>

            <a

              href={explorerTxUrl(config.explorerBaseUrl, txHash)}

              target="_blank"

              rel="noreferrer"

              className="text-sm font-semibold text-[#007dfc] hover:underline"

            >

              View on Stellar Expert →

            </a>

          </div>

        </Card>

      ) : null}
      </AppPageLayout>
    </AppShell>
  );
}
