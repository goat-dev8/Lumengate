import { useEffect, useState } from 'react';

import { useNavigate, useSearchParams } from 'react-router-dom';

import { ExternalLink } from 'lucide-react';

import { AppShell } from '../components/layout/Shell';
import { AppPageLayout } from '../components/design/AppPageLayout';
import { SendTransferForm } from '../components/send/SendTransferForm';

import { Card, CardHeader } from '../components/ui/Card';

import { Button } from '../components/ui/Button';

import { Badge } from '../components/ui/Badge';

import { useApp } from '../context/AppContext';
import { ProofLifecyclePanel } from '../components/product/ProofLifecyclePanel';
import { FundSmartAccountPanel } from '../components/product/FundSmartAccountPanel';
import { StaleSmartAccountUpgradePanel } from '../components/product/StaleSmartAccountUpgradePanel';
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
import { resolvePasskeySimulationSource } from '../lib/smartAccount';

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
    fundSmartAccountEurc,
    fundSmartAccountXlm,
  } = useApp();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const handleRecovery = () => {
    beginProofRecovery();
    navigate('/app/verify#recovery-credential');
  };
  const [asset, setAsset] = useState<AssetKind>('usdc');
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
  useEffect(() => {
    const prefilled = searchParams.get('to');
    if (prefilled && validateStellarAddress(prefilled)) {
      setTo(prefilled);
    }
  }, [searchParams]);
  const usdcReady = Boolean(config.complianceSacAdminId);
  const eurcReady = Boolean(config.complianceSacAdminId && config.eurcSacId);
  const advanced = useAdvancedMode();
  const scope = ASSET_SCOPES[asset];
  const balanceOwner = currentSettlementOwner(config, address, settlementAddress);
  const sendAccountReady = Boolean(smartAccount && settlementAddress && !smartAccountStale);
  const activeProof =
    proofLifecycle.lifecycle === 'ready' &&
    proofMatchesCredential(proof, credential) &&
    proof?.publicInputs.assetId === scope.assetId &&
    proof.publicInputs.actionId === scope.actionId
      ? proof
      : null;



  useEffect(() => {
    if (!balanceOwner) return;
    readBalance(config, balanceOwner)
      .then(setRwaBalance)
      .catch(() => setRwaBalance(null));
    if (config.complianceSacAdminId) {
      readComplianceAdminUsdcBalance(config, balanceOwner)
        .then((snap) => setUsdcBalance(snap.formatted))
        .catch(() => setUsdcBalance(null));
    } else {
      setUsdcBalance(null);
    }
    if (config.eurcSacId) {
      readEurcSacBalance(config, balanceOwner)
        .then(setEurcBalance)
        .catch(() => setEurcBalance(null));
    }
  }, [balanceOwner, settlementAddress, config, txHash, asset, balanceRefresh]);

  useEffect(() => {
    if (asset === 'usdc' && config.marketplaceSettlementAddress && !to) {
      setTo(config.marketplaceSettlementAddress);
    }
  }, [asset, config.marketplaceSettlementAddress, to]);

  const handleTransfer = async () => {
    if (!credential || !to || !amount) return;
    if (!smartAccount || !settlementAddress) {
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
      const settlementFrom = currentSettlementOwner(config, address, settlementAddress);
      if (!settlementFrom) {
        setError('Create your smart account before settlement.');
        return;
      }
      const txSource = resolvePasskeySimulationSource(address);
      const tx =
        asset === 'usdc'
          ? await buildUsdcTransferTransaction(config, txSource, settlementFrom, recipient, amount, scopedProof, scope)
          : asset === 'eurc'
            ? await buildEurcTransferTransaction(config, txSource, settlementFrom, recipient, amount, scopedProof, scope)
            : await buildTransferTransaction(config, txSource, settlementFrom, recipient, amount, scopedProof, scope);

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



  const sendReady = proofLifecycle.lifecycle === 'ready' && Boolean(activeProof);

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

  const recipientValid = to ? validateStellarAddress(to) : null;
  const complianceLines = [
    {
      label: 'Passport eligibility',
      status: sendReady && credential ? 'Cleared' : credential ? 'Confirm for asset' : 'Passport needed',
      ok: Boolean(sendReady && credential),
    },
    {
      label: 'Sanctions screening',
      status: credential ? 'Cleared' : 'Not verified',
      ok: Boolean(credential),
    },
    {
      label: 'Counterparty allowlist',
      status: recipientValid ? 'Verified' : to ? 'Invalid address' : 'Enter recipient',
      ok: Boolean(recipientValid),
    },
    {
      label: 'Receipt generation',
      status: sendReady ? 'Ready' : 'Pending eligibility',
      ok: Boolean(sendReady),
    },
  ];

  return (
    <AppShell>
      <AppPageLayout
        title="Send"
        subtitle="Safer than banking. Settles in seconds on Stellar."
        width="5xl"
      >
      <div className="space-y-6">
        <div className="flex justify-end">
          <AdvancedModeToggle />
        </div>

        {!sendAccountReady ? (
          <>
            <WalletSigningNotice compact />

            {!smartAccount ? (
              <Card>
                <CardHeader title="Fund Smart Account" badge={<Badge>Required</Badge>} />
                <p className="text-sm text-slate-muted">
                  Create your personal smart account and fund this deposit address before sending.
                </p>
                {!address && !config.openZeppelinRelayerUrl ? (
                  <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Connect Freighter once to pay deploy fees, or configure the OpenZeppelin relayer for passkey-only
                    setup.
                  </p>
                ) : null}
                <Button className="mt-4" loading={smartAccountCreating} onClick={() => createSmartAccount()}>
                  Create passkey smart account
                </Button>
              </Card>
            ) : null}

            {smartAccountStale ? (
              <StaleSmartAccountUpgradePanel
                legacyAddress={settlementAddress}
                loading={smartAccountCreating}
                onReplace={replaceSmartAccount}
              />
            ) : null}
          </>
        ) : null}

        {sendAccountReady && address && settlementAddress ? (
          <FundSmartAccountPanel
            config={config}
            smartAccountAddress={settlementAddress}
            onFundUsdc={fundSmartAccountUsdc}
            onFundEurc={fundSmartAccountEurc}
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
        ) : null}

        {sendAccountReady ? (
          <>
            {!sendReady && credential ? (
              <Card className="border-brand-200 bg-brand-50/40">
                <CardHeader title="Private confirmation required" badge={<Badge tone="brand">Action needed</Badge>} />
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
            ) : null}

            {asset === 'rwa' && rwaBalance !== null && BigInt(rwaBalance) === 0n ? (
              <div className="lg-surface-card p-6 text-sm text-[#64748b]">
                Treasury units are minted when you invest on Marketplace — they are not deposited like USDC.{' '}
                <button type="button" className="text-[#007dfc] underline" onClick={() => navigate('/app/marketplace')}>
                  Browse investments
                </button>
              </div>
            ) : (
              <SendTransferForm
                amount={amount}
                onAmountChange={setAmount}
                asset={asset}
                onAssetChange={(next) => {
                  setAsset(next);
                  if (next === 'usdc' || next === 'eurc') {
                    setTo(config.marketplaceSettlementAddress);
                  }
                }}
                usdcReady={usdcReady}
                eurcReady={eurcReady}
                to={to}
                onToChange={setTo}
                recipientValid={recipientValid}
                complianceLines={complianceLines}
                balanceLabel={balanceLabel}
                fromLabel={settlementAddress ? 'Your Lumengate account' : 'Smart account'}
                fromAddress={settlementAddress}
                loading={loading}
                disabled={
                  !credential ||
                  !smartAccount ||
                  !to ||
                  !amount ||
                  !sendReady ||
                  recipientValid === false
                }
                error={error}
                onSubmit={handleTransfer}
                showTreasuryOption={advanced}
              />
            )}

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
        ) : !smartAccount ? (
          <Card>
            <CardHeader title="Passkey smart account required" badge={<Badge tone="warn">Setup</Badge>} />
            <p className="text-sm text-slate-muted">
              Create your passkey smart account on Passport, then return here to send privately.
            </p>
            <Button className="mt-4" variant="secondary" onClick={() => navigate('/app/verify')}>
              Go to Passport
            </Button>
          </Card>
        ) : null}

      </div>
      </AppPageLayout>
    </AppShell>
  );
}
