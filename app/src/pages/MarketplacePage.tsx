import { useEffect, useState } from 'react';

import { Link, useNavigate } from 'react-router-dom';

import { ArrowRightLeft, Sparkles } from 'lucide-react';

import { AppShell } from '../components/layout/Shell';

import { Card } from '../components/ui/Card';

import { Button } from '../components/ui/Button';

import { Badge } from '../components/ui/Badge';

import { EmptyState, Skeleton } from '../components/ui/States';

import { OfferingIconBadge, OfferingIllustration } from '../components/fintech/OfferingIllustration';

import { useApp } from '../context/AppContext';

import { useOfferings } from '../hooks/useOfferings';

import { proofMatchesCredential } from '../lib/credentialProof';
import { ProofLifecyclePanel } from '../components/product/ProofLifecyclePanel';
import { isProofUsable } from '../lib/proofLifecycle';

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
  readUsdcSacBalance,
} from '../lib/contracts';

import type { LiveOffering } from '../lib/offerings';

import { offeringMinimumBigInt } from '../lib/offerings';

import { policyByKey } from '../lib/policies';

import { explorerTxUrl, truncateMiddle } from '../lib/utils';



function riskTone(risk: string) {

  if (risk === 'Low') return 'ok' as const;

  if (risk === 'Medium') return 'warn' as const;

  return 'err' as const;

}



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

    pushActivity,

    recordTransferTx,

    recordVerifyTx,
    proofLifecycle,
    beginProofRecovery,
  } = useApp();

  const { offerings, loading: offeringsLoading, error: offeringsError } = useOfferings();
  const navigate = useNavigate();

  const activeProof = proofLifecycle.lifecycle === 'ready' && proofMatchesCredential(proof, credential) ? proof : null;
  const proofConsumed = proofLifecycle.lifecycle === 'consumed';

  const [balance, setBalance] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const [settling, setSettling] = useState(false);

  const [pofLoading, setPofLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [txHash, setTxHash] = useState<string | null>(null);

  const [pofTxHash, setPofTxHash] = useState<string | null>(null);



  const selected =

    offerings.find((o) => o.id === selectedOfferingId) ?? offerings[0] ?? null;



  useEffect(() => {

    if (!address) {

      setBalance(null);

      setBalanceError(null);

      return;

    }

    readBalance(config, address)
      .then((b) => {
        setBalance(b);
        setBalanceError(null);
      })
      .catch((err) => {
        setBalance(null);
        setBalanceError(err instanceof Error ? err.message : String(err));
      });
    readUsdcSacBalance(config, address)
      .then(setUsdcBalance)
      .catch(() => setUsdcBalance(null));

  }, [address, config, txHash, pofTxHash]);



  const prepareOffering = async (offering: LiveOffering) => {

    setSelectedOfferingId(offering.id);

    setPolicyKey(offering.requiredPolicy);

    setError(null);

    if (!address) {

      await connect();

      return;

    }

    try {

      await requestCredential(offering.requiredPolicy);

      navigate('/app/verify');

    } catch (err) {

      setError(err instanceof Error ? err.message : String(err));

    }

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
    if (!address || !activeProof) return 'Complete your passport first';

    if (policyKey !== offering.requiredPolicy) {

      return `Credential required: ${policyByKey(offering.requiredPolicy).title}`;

    }

    if (Number(activeProof.publicInputs.policyId) !== policyByKey(offering.requiredPolicy).policyId) {

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
      if (route === 'sac' && !config.complianceSacAdminId) return 'USDC admin contract not configured';
      const min = Number(offering.minimumAmount);
      const bal = usdcBalance !== null ? Number(usdcBalance) : NaN;
      if (!Number.isNaN(bal) && bal < min) {
        return `Minimum ${min} USDC (available ${usdcBalance})`;
      }
    } else if (balance !== null && BigInt(balance) < amount) {
      return `Minimum investment ${amount.toString()} units`;
    }

    return null;

  };



  const handleSettle = async (offering: LiveOffering) => {

    const block = canSettle(offering);

    if (block || !address || !activeProof) {

      setError(block || 'Complete your passport first');

      return;

    }

    setSettling(true);

    setError(null);

    try {

      const pid = Number(activeProof.publicInputs.policyId);

      const spent = await readNullifierSpent(config, nullifierHexFromBundle(activeProof), pid);

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
      let xdr: string;
      if (route === 'dex') {
        xdr = await buildSwapCompliantTransaction(
          config,
          address,
          address,
          recipient,
          amount,
          activeProof,
        );
      } else if (route === 'payroll') {
        xdr = await buildPayCompliantTransaction(
          config,
          address,
          address,
          recipient,
          amount,
          activeProof,
        );
      } else if (offering.settlementAsset === 'usdc') {
        xdr = await buildUsdcTransferTransaction(
          config,
          address,
          address,
          recipient,
          amount,
          activeProof,
        );
      } else {
        xdr = await buildTransferTransaction(
          config,
          address,
          address,
          recipient,
          amount,
          activeProof,
        );
      }

      const hash = await signAndSubmit(xdr);

      setTxHash(hash);

      await recordTransferTx(hash, {

        from: address,

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

      <div className="lg-section-head flex flex-wrap items-end justify-between gap-4">

        <div>

          <p className="lg-section-eyebrow">Invest</p>

          <h1 className="lg-section-title text-2xl lg:text-3xl">Passport-gated investments</h1>

          <p className="mt-2 max-w-2xl text-[15px] text-[#475569]">

            {proofConsumed
              ? 'Your passport was used — renew it to invest again.'
              : activeProof
                ? 'Your passport is verified. Select an offering to invest.'
                : credential
                  ? 'Confirm eligibility to unlock investing.'
                  : `${offerings.length} investments available — get your passport first.`}

          </p>

        </div>

        {address ? (

          <div className="rounded-xl border border-[#e3e8ee] bg-white px-5 py-3 shadow-sm">

            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">Available treasury units</div>

            {balanceError ? (

              <p className="mt-1 text-sm text-status-err">{balanceError}</p>

            ) : (

              <div className="text-xl font-semibold tabular-nums text-[#012b54]">

                {balance !== null ? `${balance} units` : 'Reading…'}

              </div>

            )}

          </div>

        ) : null}

      </div>

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

      <div className="grid gap-8 xl:grid-cols-3">

        {offerings.map((offering) => {

          const policy = policyByKey(offering.requiredPolicy);

          const block = canSettle(offering);

          const isSelected = selected?.id === offering.id;

          const threshold = fundsThreshold(offering);

          return (

            <div

              key={offering.id}

              className={`lg-offering-card ${isSelected ? 'ring-2 ring-[#007dfc]' : ''}`}

            >

              <OfferingIllustration offering={offering} className="h-44" variant="card" />

              <div className="lg-offering-body">

                <div className="flex items-start gap-3">

                  <OfferingIconBadge category={offering.category} />

                  <div className="min-w-0 flex-1">

                    <div className="flex flex-wrap items-start justify-between gap-2">

                      <Link to={`/app/marketplace/${offering.id}`}>

                        <h3 className="text-lg font-semibold text-[#012b54] hover:text-[#007dfc]">

                          {offering.title}

                        </h3>

                      </Link>

                      <Badge tone="brand">{offering.offeringStatus}</Badge>

                    </div>

                    <p className="mt-1 text-sm text-[#64748b]">{offering.description}</p>

                  </div>

                </div>



                <div className="lg-offering-stats">

                  <div className="lg-offering-stat">

                    <div className="lg-offering-stat-label">Access</div>

                    <div className="lg-offering-stat-value">Passport</div>

                  </div>

                  <div className="lg-offering-stat">

                    <div className="lg-offering-stat-label">Risk</div>

                    <div className="lg-offering-stat-value">

                      <Badge tone={riskTone(offering.riskLevel)}>{offering.riskLevel}</Badge>

                    </div>

                  </div>

                  <div className="lg-offering-stat">

                    <div className="lg-offering-stat-label">Minimum</div>

                    <div className="lg-offering-stat-value">

                      {offering.minimumAmount} {offering.unitLabel}

                    </div>

                  </div>

                </div>



                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[#eef0f3] pt-4 text-sm">

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

                    <span key={c} className="lg-verified-chip text-[#012b54] !bg-[#f0f6ff] !border-[#e3e8ee]">

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

              </div>

            </div>

          );

        })}

      </div>



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

    </AppShell>

  );

}


