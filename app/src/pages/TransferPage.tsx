import { useEffect, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { ArrowRightLeft, ExternalLink } from 'lucide-react';

import { AppShell } from '../components/layout/Shell';

import { Card, CardHeader } from '../components/ui/Card';

import { Button } from '../components/ui/Button';

import { Badge } from '../components/ui/Badge';

import { useApp } from '../context/AppContext';
import { ProofLifecyclePanel } from '../components/product/ProofLifecyclePanel';
import { FundSmartAccountPanel } from '../components/product/FundSmartAccountPanel';
import { StaleSmartAccountUpgradePanel } from '../components/product/StaleSmartAccountUpgradePanel';
import { ProductHero } from '../components/product/ProductHero';
import { PrivacyJourney } from '../components/product/PrivacyJourney';
import { AdvancedModeToggle, useAdvancedMode } from '../components/product/AdvancedModeToggle';
import { WalletSigningNotice } from '../components/product/WalletSigningNotice';
import { syncProofLifecycleOnChain } from '../lib/proofLifecycle';
import { friendlyAssetName } from '../lib/productState';
import { parseStellarAmount } from '../lib/assetAmount';
import {
  buildTransferTransaction,
  buildUsdcTransferTransaction,
  buildEurcTransferTransaction,
  formatSorobanUserError,
  readBalance,
  readComplianceAdminUsdcBalance,
  readEurcSacBalance,
  validateStellarAddress,
} from '../lib/contracts';

import { checkRecipientUsdcCapacity } from '../lib/horizon';
import { proofMatchesCredential } from '../lib/credentialProof';
import { currentSettlementOwner } from '../lib/settlementOwner';
import { ASSET_SCOPES } from '../lib/assetScope';

import { explorerTxUrl, truncateMiddle } from '../lib/utils';



type AssetKind = 'rwa' | 'usdc' | 'eurc';



export function TransferPage() {
  const {
    address,
    credential,
    proof,
    config,
    signAndSubmitSettlement,
    pushActivity,
    recordTransferTx,
    proofLifecycle,
    syncProofLifecycle,
    beginProofRecovery,
    consumedTxHash,
    smartAccount,
    settlementAddress,
    smartAccountCreating,
    smartAccountStale,
    createSmartAccount,
    replaceSmartAccount,
    ensureProofForAsset,
    fundSmartAccountUsdc,
    fundSmartAccountXlm,
  } = useApp();

  const navigate = useNavigate();
  const handleRecovery = () => {
    beginProofRecovery();
    navigate('/app/verify#recovery-credential');
  };
  const [asset, setAsset] = useState<AssetKind>('rwa');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [rwaBalance, setRwaBalance] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [eurcBalance, setEurcBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [confirmingEligibility, setConfirmingEligibility] = useState(false);
  const [balanceRefresh, setBalanceRefresh] = useState(0);
  const usdcReady = Boolean(config.complianceSacAdminId);
  const eurcReady = Boolean(config.complianceSacAdminId && config.eurcSacId);
  const advanced = useAdvancedMode();
  const scope = ASSET_SCOPES[asset];
  const activeProof =
    proofLifecycle.lifecycle === 'ready' &&
    proofMatchesCredential(proof, credential) &&
    proof?.publicInputs.assetId === scope.assetId &&
    proof.publicInputs.actionId === scope.actionId
      ? proof
      : null;



  useEffect(() => {
    if (!address) return;
    const balanceHolder = currentSettlementOwner(config, address, settlementAddress) ?? address;
    readBalance(config, balanceHolder)
      .then(setRwaBalance)
      .catch(() => setRwaBalance(null));
    if (config.complianceSacAdminId) {
      readComplianceAdminUsdcBalance(config, balanceHolder)
        .then((snap) => setUsdcBalance(snap.formatted))
        .catch(() => setUsdcBalance(null));
    } else {
      setUsdcBalance(null);
    }
    if (config.eurcSacId) {
      readEurcSacBalance(config, balanceHolder)
        .then(setEurcBalance)
        .catch(() => setEurcBalance(null));
    }
  }, [address, settlementAddress, config, txHash, asset, balanceRefresh]);

  useEffect(() => {
    if (asset === 'usdc' && config.marketplaceSettlementAddress && !to) {
      setTo(config.marketplaceSettlementAddress);
    }
  }, [asset, config.marketplaceSettlementAddress, to]);

  const handleTransfer = async () => {
    if (!address || !credential || !to || !amount) return;
    if (!smartAccount) {
      setError('Create your smart account before settlement.');
      return;
    }
    if (proofLifecycle.lifecycle === 'invalid' || proofLifecycle.lifecycle === 'consumed') {
      setError(proofLifecycle.reason ?? 'Your passport is not ready for settlement.');
      return;
    }

    const recipient = to.trim();

    if (!validateStellarAddress(recipient)) {

      setError('Enter a valid Stellar recipient address.');

      return;

    }

    if (Number(amount) <= 0) {
      setError('Enter a positive amount.');
      return;
    }

    try {
      parseStellarAmount(amount);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }

    if (asset === 'usdc') {

      const trustlineStatus = await checkRecipientUsdcCapacity(config, recipient, amount);

      if (trustlineStatus === 'missing') {

        setError(

          `This recipient is not ready for USDC yet. Use treasury ` +

            `${truncateMiddle(config.marketplaceSettlementAddress, 8, 6)} or invest through Marketplace.`,

        );

        return;

      }
      if (trustlineStatus === 'insufficient_limit') {
        setError('This recipient USDC trustline limit is too low for the amount.');
        return;
      }

    }

    setLoading(true);
    setError(null);
    try {
      let scopedCredential = credential;
      let scopedProof = activeProof;
      if (!scopedProof) {
        const ensured = await ensureProofForAsset(asset);
        scopedProof = ensured.proof;
        scopedCredential = ensured.credential;
      }
      const freshLifecycle = await syncProofLifecycleOnChain(
        config,
        scopedCredential,
        scopedProof,
        consumedTxHash,
      );
      if (freshLifecycle.lifecycle !== 'ready') {
        await syncProofLifecycle();
        setError(freshLifecycle.reason ?? 'Your passport is not ready for settlement.');
        return;
      }
      const settlementFrom = currentSettlementOwner(config, address, settlementAddress) ?? address;
      const tx =
        asset === 'usdc'
          ? await buildUsdcTransferTransaction(config, address, settlementFrom, recipient, amount, scopedProof, scope)
          : asset === 'eurc'
            ? await buildEurcTransferTransaction(config, address, settlementFrom, recipient, amount, scopedProof, scope)
            : await buildTransferTransaction(config, address, settlementFrom, recipient, amount, scopedProof, scope);

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
        title:
          asset === 'usdc'
            ? `USDC settlement: ${amount}`
            : asset === 'eurc'
              ? `EURC settlement: ${amount}`
              : 'Transfer completed',
        detail: `${amount} ${asset === 'usdc' ? 'USDC' : asset === 'eurc' ? 'EURC' : 'units'} → ${truncateMiddle(recipient, 8, 6)}`,
        txHash: hash,
        explorerUrl: explorerTxUrl(config.explorerBaseUrl, hash),
        status: 'success',
      });

      navigate('/app/compliance');
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const friendly = formatSorobanUserError(raw);
      setError(friendly);
      if (raw.includes('Error(Contract, #6)') || raw.includes('Error(Contract, #5)')) {
        await syncProofLifecycle();
      }

      pushActivity({

        kind: 'transfer',

        title: 'Transfer failed',

        detail: raw,

        status: 'error',

      });

    } finally {

      setLoading(false);

    }

  };



  const sendReady =
    proofLifecycle.lifecycle === 'ready' &&
    Boolean(activeProof) &&
    proofMatchesCredential(proof, credential);

  const handleConfirmForAsset = async () => {
    if (!credential) {
      handleRecovery();
      return;
    }
    setConfirmingEligibility(true);
    setError(null);
    try {
      await ensureProofForAsset(asset);
      await syncProofLifecycle();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setConfirmingEligibility(false);
    }
  };

  const balanceLabel =
    asset === 'usdc'
      ? usdcBalance !== null
        ? `${usdcBalance} USDC`
        : 'USDC unavailable'
      : asset === 'eurc'
        ? eurcBalance !== null
          ? `${eurcBalance} EURC`
          : 'EURC unavailable'
        : rwaBalance !== null
          ? `${rwaBalance} treasury units`
          : 'Loading…';

  return (

    <AppShell>

      <div className="space-y-6">
        <div className="flex justify-end">
          <AdvancedModeToggle />
        </div>
        <ProductHero
          eyebrow="Send"
          title="Send privately"
          subtitle="Move regulated assets with a private eligibility check. Your passkey smart account authorizes settlement."
        />

        <WalletSigningNotice compact />
        <PrivacyJourney compact />



        {address && !smartAccount ? (
          <Card>
            <CardHeader title="Fund Smart Account" badge={<Badge>Required</Badge>} />
            <p className="text-sm text-slate-muted">
              Create your personal smart account and fund this deposit address before sending.
            </p>
            <Button className="mt-4" loading={smartAccountCreating} onClick={() => createSmartAccount()}>
              Create passkey smart account
            </Button>
          </Card>
        ) : null}

        {address && smartAccountStale ? (
          <StaleSmartAccountUpgradePanel
            legacyAddress={settlementAddress}
            loading={smartAccountCreating}
            onReplace={replaceSmartAccount}
          />
        ) : null}

        {address && smartAccount && settlementAddress && !smartAccountStale ? (
          <FundSmartAccountPanel
            config={config}
            smartAccountAddress={settlementAddress}
            onFundUsdc={fundSmartAccountUsdc}
            onFundXlm={fundSmartAccountXlm}
            onFunded={() => setBalanceRefresh((n: number) => n + 1)}
          />
        ) : null}

        {proofLifecycle.lifecycle === 'invalid' || proofLifecycle.lifecycle === 'consumed' ? (
          <ProofLifecyclePanel
            state={proofLifecycle}
            config={config}
            onBeginRecovery={handleRecovery}
            onRefreshProof={() => syncProofLifecycle()}
          />
        ) : !sendReady && credential && smartAccount ? (
          <Card className="border-brand-200 bg-brand-50/40">
            <CardHeader title="Confirm for this asset" badge={<Badge tone="brand">Action needed</Badge>} />
            <p className="text-sm text-slate-muted">
              Each asset type needs its own private confirmation. Confirm eligibility for{' '}
              {friendlyAssetName(asset)} before sending — this runs locally in your browser (~30s).
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button loading={confirmingEligibility} onClick={handleConfirmForAsset}>
                Confirm eligibility for {friendlyAssetName(asset)}
              </Button>
              <Button variant="secondary" onClick={handleRecovery}>
                Renew passport
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <ProofLifecyclePanel state={proofLifecycle} config={config} compact />

            {advanced ? (
              <Card>
                <CardHeader title="Private settlement layer" badge={<Badge tone="brand">Nethermind ASP</Badge>} />
                <p className="text-sm text-slate-muted">
                  Unlinkable deposit/withdraw via Stellar Private Payments testnet pool. Eligibility proofs gate
                  compliant ASP membership before private USDC flows.
                </p>
                <dl className="mt-3 space-y-1 text-xs font-mono">
                  <div>
                    <dt className="text-slate-muted">Privacy pool</dt>
                    <dd className="break-all">{config.privacyPoolId}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-muted">ASP membership verifier</dt>
                    <dd className="break-all">{config.aspMembershipVerifierId}</dd>
                  </div>
                </dl>
              </Card>
            ) : (
              <Card>
                <CardHeader title="How this send is protected" badge={<Badge tone="brand">Private by default</Badge>} />
                <div className="grid gap-3 text-sm text-slate-muted sm:grid-cols-3">
                  <p>1. Lumengate checks your passport privately.</p>
                  <p>2. Stellar settles only if you are eligible.</p>
                  <p>3. Your identity details stay off-chain.</p>
                </div>
              </Card>
            )}

            <div className="flex flex-wrap gap-2">

              <Button variant={asset === 'rwa' ? 'primary' : 'secondary'} size="sm" onClick={() => setAsset('rwa')}>

                Treasury units

              </Button>

              <Button

                variant={asset === 'usdc' ? 'primary' : 'secondary'}

                size="sm"

                disabled={!usdcReady}

                onClick={() => {

                  setAsset('usdc');

                  setTo(config.marketplaceSettlementAddress);

                }}

              >

                USDC

              </Button>

              <Button
                variant={asset === 'eurc' ? 'primary' : 'secondary'}
                size="sm"
                disabled={!eurcReady}
                onClick={() => {
                  setAsset('eurc');
                  setTo(config.marketplaceSettlementAddress);
                }}
              >
                EURC
              </Button>

            </div>



            <Card>

              <CardHeader

                title={`Send ${friendlyAssetName(asset)}`}

                description={

                  asset === 'usdc'

                    ? advanced
                      ? `Compliance contract ${truncateMiddle(config.complianceSacAdminId ?? '', 6, 4)} → official USDC`
                      : 'Private passport check before USDC settlement'

                    : advanced
                      ? 'Policy check inside asset settlement'
                      : 'Private passport check before asset settlement'

                }

                badge={<Badge tone="ok">{balanceLabel}</Badge>}

              />

              {!address ? (

                <p className="text-sm text-slate-muted">Connect wallet to transfer.</p>

              ) : asset === 'rwa' && rwaBalance !== null && BigInt(rwaBalance) === 0n ? (

                <div className="rounded-xl border border-brand-200 bg-brand-50/50 px-4 py-3 text-sm text-slate-muted">
                  Treasury units are minted when you invest on Marketplace — they are not deposited like USDC.
                  {' '}
                  <button type="button" className="text-brand underline" onClick={() => navigate('/app/marketplace')}>
                    Browse investments
                  </button>
                </div>

              ) : (

                <div className="grid gap-4 md:grid-cols-2">

                  <label className="block">

                    <span className="text-sm text-slate-muted">Recipient</span>

                    <input

                      className="mt-2 w-full rounded-xl border border-slate-line px-4 py-3 font-mono text-sm outline-none focus:border-brand"

                      value={to}

                      onChange={(e) => setTo(e.target.value)}

                      aria-label={asset === 'usdc' ? 'USDC settlement recipient' : 'Recipient Stellar address'}

                    />

                    {asset === 'usdc' ? (

                      <p className="mt-2 text-xs text-slate-muted">

                        We prefill the treasury settlement account because it is ready to receive testnet USDC.

                      </p>

                    ) : null}

                  </label>

                  <label className="block">

                    <span className="text-sm text-slate-muted">Amount</span>

                    <input

                      className="mt-2 w-full rounded-xl border border-slate-line px-4 py-3 text-sm outline-none focus:border-brand"

                      value={amount}

                      onChange={(e) => setAmount(e.target.value)}

                      type="number"

                      min="0"

                      step={asset === 'usdc' ? '0.0000001' : '1'}

                    />

                  </label>

                </div>

              )}

              <Button

                className="mt-6"

                loading={loading}

                disabled={
                  !address ||
                  !credential ||
                  !smartAccount ||
                  smartAccountStale ||
                  !to ||
                  !amount ||
                  !sendReady
                }

                onClick={handleTransfer}

              >

                <ArrowRightLeft className="h-4 w-4" />

                Send privately

              </Button>

              {error ? <p className="mt-4 text-sm text-status-err">{error}</p> : null}

            </Card>



            {txHash ? (

              <Card>

                <CardHeader title="Transfer confirmed" badge={<Badge tone="ok">On-chain</Badge>} />

                <p className="font-mono text-xs break-all text-slate-ink">{txHash}</p>

                <a

                  href={explorerTxUrl(config.explorerBaseUrl, txHash)}

                  target="_blank"

                  rel="noreferrer"

                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline"

                >

                  View on Stellar Expert

                  <ExternalLink className="h-4 w-4" />

                </a>

              </Card>

            ) : null}

          </>

        )}

      </div>

    </AppShell>

  );

}
