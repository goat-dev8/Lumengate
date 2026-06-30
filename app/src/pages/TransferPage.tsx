import { useEffect, useState } from 'react';

import { useNavigate, useSearchParams } from 'react-router-dom';

import { ExternalLink } from 'lucide-react';

import { AppPageLayout } from '../components/design/AppPageLayout';
import { SendTransferForm } from '../components/send/SendTransferForm';
import {
  SettlementProgressOverlay,
  type SettlementPhase,
} from '../components/send/SettlementProgress';

import { Card, CardHeader } from '../components/ui/Card';

import { Button } from '../components/ui/Button';

import { Badge } from '../components/ui/Badge';

import { useApp } from '../context/AppContext';
import { ProofLifecyclePanel } from '../components/product/ProofLifecyclePanel';
import { PassportScopePanel } from '../components/product/PassportScopePanel';
import { usePassportScopeStatuses } from '../hooks/usePassportScopeStatuses';
import { FundsDrawer } from '../components/product/FundsDrawer';
import { StaleSmartAccountUpgradePanel } from '../components/product/StaleSmartAccountUpgradePanel';
import { AdvancedModeToggle, useAdvancedMode } from '../components/product/AdvancedModeToggle';
import { WalletSigningNotice } from '../components/product/WalletSigningNotice';
import { syncProofLifecycleOnChain } from '../lib/proofLifecycle';
import { ASSET_SCOPES } from '../lib/assetScope';
import { isScopeNullifierSpent, scopeNullifierSpentMessage } from '../lib/scopeNullifier';
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
import { resolvePasskeySimulationSource } from '../lib/smartAccount';
import type { ProofLifecycleState } from '../lib/proofLifecycle';

import { explorerTxUrl, truncateMiddle } from '../lib/utils';
import { executeConfidentialEurcSettlement, readConfidentialEurcRegistered } from '../lib/confidentialFlow';
import { ConfidentialEurcPanel } from '../components/product/ConfidentialEurcPanel';
import { ZkExplainerSection } from '../components/education/ZkExplainerSection';
import {
  SettlementPrivacyDiagram,
  SETTLEMENT_PRIVACY_TERMS,
} from '../components/education/diagrams/SettlementPrivacyDiagram';



type AssetKind = 'rwa' | 'usdc' | 'eurc';



export function TransferPage() {
  const {
    address,
    connect,
    connecting,
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
  const [settlementPhase, setSettlementPhase] = useState<SettlementPhase>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [settlementStartedAt, setSettlementStartedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [balanceRefresh, setBalanceRefresh] = useState(0);
  const [scopeBlocked, setScopeBlocked] = useState<ProofLifecycleState | null>(null);
  const [passkeyStep, setPasskeyStep] = useState<{ index: number; total: number } | null>(null);
  const [confidentialMode, setConfidentialMode] = useState(false);
  const [ctRecipientRegistered, setCtRecipientRegistered] = useState<boolean | null>(null);
  const [senderCtRegistered, setSenderCtRegistered] = useState<boolean | null>(null);
  useEffect(() => {
    const prefilled = searchParams.get('to');
    if (prefilled && validateStellarAddress(prefilled)) {
      setTo(prefilled);
    }
  }, [searchParams]);
  const usdcReady = Boolean(config.complianceSacAdminId);
  const eurcReady = Boolean(config.complianceSacAdminId && config.eurcSacId);
  const confidentialAvailable = Boolean(config.confidentialTokenId && eurcReady);
  const advanced = useAdvancedMode();
  const { rows: scopeRows, refresh: refreshScopeStatuses } = usePassportScopeStatuses();
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

  useEffect(() => {
    if (!credential) {
      setScopeBlocked(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const spent = await isScopeNullifierSpent(config, credential, scope);
        if (cancelled) return;
        if (spent) {
          setScopeBlocked({
            lifecycle: 'consumed',
            consumedTxHash,
            reason: scopeNullifierSpentMessage(asset),
          });
        } else {
          setScopeBlocked(null);
        }
      } catch {
        if (!cancelled) setScopeBlocked(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [credential, asset, scope, config, consumedTxHash]);

  useEffect(() => {
    if (!confidentialMode || !config.confidentialTokenId || !to || !validateStellarAddress(to.trim())) {
      setCtRecipientRegistered(null);
      return;
    }
    let cancelled = false;
    void readConfidentialEurcRegistered(config, to.trim()).then((ok) => {
      if (!cancelled) setCtRecipientRegistered(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [confidentialMode, config, to]);

  useEffect(() => {
    if (!confidentialMode || !config.confidentialTokenId || !settlementAddress) {
      setSenderCtRegistered(null);
      return;
    }
    let cancelled = false;
    void readConfidentialEurcRegistered(config, settlementAddress).then((ok) => {
      if (!cancelled) setSenderCtRegistered(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [confidentialMode, config, settlementAddress, txHash]);

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
    if (scopeBlocked?.lifecycle === 'consumed') {
      setError(scopeBlocked.reason ?? scopeNullifierSpentMessage(asset));
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

    if (asset === 'usdc' && recipient.startsWith('G')) {

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

    if (asset === 'eurc' && confidentialMode && confidentialRecipientIsG) {
      setError(confidentialRecipientWarning ?? 'Use a C… smart account address for confidential EURC.');
      return;
    }
    if (asset === 'eurc' && confidentialMode && senderCtRegistered === false) {
      setError('Register your confidential EURC account in Settings before sending.');
      return;
    }
    if (asset === 'eurc' && confidentialMode && ctRecipientRegistered === false) {
      setError(
        'Recipient is not registered for confidential EURC. Use their Lumengate smart account address (C…), not a funding wallet (G…). They must register in Settings first.',
      );
      return;
    }

    setLoading(true);
    setError(null);
    setStatusMessage(null);
    setSettlementStartedAt(Date.now());
    setSettlementPhase('preparing');
    let completed = false;
    try {
      let scopedCredential = credential;
      let scopedProof = activeProof;
      if (!scopedProof) {
        setSettlementPhase('preparing');
        setStatusMessage(`Preparing private ${friendlyAssetName(asset)} eligibility on your device…`);
        const ensured = await ensureProofForAsset(asset, (message) => {
          setStatusMessage(message);
          const lower = message.toLowerCase();
          if (
            lower.includes('proof') ||
            lower.includes('witness') ||
            lower.includes('prover') ||
            lower.includes('registry')
          ) {
            setSettlementPhase('proving');
          }
        });
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
      let hash: string;
      if (asset === 'eurc' && confidentialMode && config.confidentialTokenId) {
        setSettlementPhase('proving');
        setStatusMessage('Preparing confidential EURC settlement…');
        const result = await executeConfidentialEurcSettlement({
          config,
          txSource,
          smartAccount: settlementFrom,
          recipient,
          amount,
          onProgress: ({ step, message }) => {
            setStatusMessage(message);
            if (step === 'prove-transfer' || step === 'register') {
              setSettlementPhase('proving');
            } else if (step === 'transfer') {
              setSettlementPhase('submitting');
            } else {
              setSettlementPhase('authorizing-settle');
            }
          },
          submitTx: async (ctTx, _stepLabel) => {
            setSettlementPhase('waiting-passkey');
            setStatusMessage('Waiting for secure confirmation…');
            return signAndSubmitSettlement(settlementFrom, scopedProof, ctTx, (step, index, total) => {
              setPasskeyStep({ index, total });
              if (step === 'bind') {
                setSettlementPhase('authorizing-bind');
                setStatusMessage(`Passkey confirmation required (${index} of ${total}) — eligibility binding`);
              } else {
                setSettlementPhase('authorizing-settle');
                setStatusMessage(`Passkey confirmation required (${index} of ${total}) — approve confidential step`);
              }
            });
          },
        });
        hash = result.txHash;
      } else {
        const tx =
          asset === 'usdc'
            ? await buildUsdcTransferTransaction(config, txSource, settlementFrom, recipient, amount, scopedProof, scope)
            : asset === 'eurc'
              ? await buildEurcTransferTransaction(config, txSource, settlementFrom, recipient, amount, scopedProof, scope)
              : await buildTransferTransaction(config, txSource, settlementFrom, recipient, amount, scopedProof, scope);

        setSettlementPhase('submitting');
        setStatusMessage('Submitting settlement…');
        hash = await signAndSubmitSettlement(settlementFrom, scopedProof, tx, (step, index, total) => {
          setPasskeyStep({ index, total });
          if (step === 'bind') {
            setSettlementPhase('authorizing-bind');
            setStatusMessage(`Passkey confirmation required (${index} of ${total}) — eligibility binding`);
          } else {
            setSettlementPhase('waiting-passkey');
            setStatusMessage('Waiting for secure confirmation… The next passkey prompt will appear automatically.');
            window.setTimeout(() => {
              setSettlementPhase('authorizing-settle');
              setStatusMessage(`Passkey confirmation required (${index} of ${total}) — approve transfer`);
            }, 500);
          }
        });
      }

      setSettlementPhase('confirming');
      setStatusMessage('Waiting for Stellar confirmation…');

      setSettlementPhase('receipt');
      setStatusMessage('Generating institutional receipt…');
      await new Promise((resolve) => setTimeout(resolve, 700));
      setSettlementPhase('complete');
      setTxHash(hash);
      completed = true;

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
              ? confidentialMode
                ? `Confidential EURC settlement: ${amount}`
                : `EURC settlement: ${amount}`
              : 'Transfer completed',
        detail: `${amount} ${asset === 'usdc' ? 'USDC' : asset === 'eurc' ? (confidentialMode ? 'confidential EURC' : 'EURC') : 'units'} → ${truncateMiddle(recipient, 8, 6)}`,
        txHash: hash,
        explorerUrl: explorerTxUrl(config.explorerBaseUrl, hash),
        status: 'success',
      });

      await new Promise((resolve) => setTimeout(resolve, 900));
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
      if (!completed) {
        setSettlementPhase('idle');
        setStatusMessage(null);
        setSettlementStartedAt(null);
        setPasskeyStep(null);
      }
    }
  };

  const assetProofReady = Boolean(activeProof);
  const confidentialRecipientIsG =
    confidentialMode && to.trim().startsWith('G') && validateStellarAddress(to.trim());
  const confidentialRecipientWarning = confidentialRecipientIsG
    ? 'Confidential EURC requires the recipient’s Lumengate smart account (C… address). G… funding wallets cannot receive shielded EURC.'
    : null;

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
    ...(confidentialMode && config.confidentialTokenId
      ? [
          {
            label: 'Your confidential account',
            status:
              senderCtRegistered === true
                ? 'Registered'
                : senderCtRegistered === false
                  ? 'Register in Settings'
                  : 'Checking…',
            ok: senderCtRegistered === true,
          },
        ]
      : []),
    {
      label: 'Passport eligibility',
      status: assetProofReady ? 'Ready' : credential ? 'Prepared on send' : 'Passport needed',
      ok: Boolean(assetProofReady || credential),
    },
    {
      label: 'Sanctions screening',
      status: credential ? 'Cleared' : 'Not verified',
      ok: Boolean(credential),
    },
    {
      label: 'Counterparty allowlist',
      status: recipientValid
        ? confidentialRecipientIsG
          ? 'Use C… smart account'
          : confidentialMode && ctRecipientRegistered === false
          ? 'Not CT registered'
          : confidentialMode && ctRecipientRegistered === true
            ? 'CT registered'
            : 'Verified'
        : to
          ? 'Invalid address'
          : 'Enter recipient',
      ok: Boolean(
        recipientValid &&
          !confidentialRecipientIsG &&
          (!confidentialMode || ctRecipientRegistered === true || ctRecipientRegistered === null),
      ),
    },
    {
      label: 'Receipt generation',
      status: assetProofReady ? 'Ready' : credential ? 'After send' : 'Pending eligibility',
      ok: Boolean(assetProofReady),
    },
  ];

  return (
    
      <AppPageLayout
        title="Send"
        subtitle="Safer than banking. Settles in seconds on Stellar."
        width="5xl"
      >
      <SettlementProgressOverlay
        phase={settlementPhase}
        statusMessage={statusMessage}
        assetLabel={friendlyAssetName(asset)}
        passkeyStep={passkeyStep}
        startedAt={settlementStartedAt}
      />
      <div className="space-y-8">
        {sendAccountReady ? (
          <>
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
                  recipientValid === false ||
                  confidentialRecipientIsG ||
                  scopeBlocked?.lifecycle === 'consumed' ||
                  loading
                }
                error={error}
                statusMessage={statusMessage}
                onSubmit={handleTransfer}
                showTreasuryOption={advanced}
                confidentialAvailable={confidentialAvailable}
                confidentialMode={confidentialMode}
                onConfidentialModeChange={setConfidentialMode}
                ctRecipientRegistered={ctRecipientRegistered}
                confidentialRecipientWarning={confidentialRecipientWarning}
              />
            )}

            {confidentialMode && config.confidentialTokenId && senderCtRegistered === false ? (
              <ConfidentialEurcPanel />
            ) : null}

            {txHash ? (
              <>
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
                <ZkExplainerSection
                  id="send-settlement-privacy"
                  eyebrow="What happened"
                  title="Private settlement on Stellar"
                  summary="Your passkey authorized a compliant transfer. Personal eligibility data stayed in the browser; the ledger records amount, addresses, and the scoped nullifier that prevents replay."
                  diagram={<SettlementPrivacyDiagram />}
                  terms={SETTLEMENT_PRIVACY_TERMS}
                  defaultOpen
                />
              </>
            ) : null}

            {proofLifecycle.lifecycle === 'invalid' ||
            proofLifecycle.lifecycle === 'consumed' ||
            scopeBlocked?.lifecycle === 'consumed' ? (
              <ProofLifecyclePanel
                state={scopeBlocked?.lifecycle === 'consumed' ? scopeBlocked : proofLifecycle}
                config={config}
                scopeRows={scopeRows}
                onBeginRecovery={handleRecovery}
                onRefreshProof={() => syncProofLifecycle()}
              />
            ) : null}

            {credential ? (
              <PassportScopePanel
                rows={scopeRows}
                onRefresh={() => refreshScopeStatuses()}
                onRenew={handleRecovery}
                showActions={false}
                compact
              />
            ) : null}

            {settlementAddress ? (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <FundsDrawer
                  config={config}
                  smartAccountAddress={settlementAddress}
                  hasFundingWallet={Boolean(address)}
                  onConnectWallet={() => connect()}
                  connectingWallet={connecting}
                  onFundUsdc={fundSmartAccountUsdc}
                  onFundEurc={fundSmartAccountEurc}
                  onFundXlm={fundSmartAccountXlm}
                  onFunded={() => setBalanceRefresh((n: number) => n + 1)}
                />
              </div>
            ) : null}

            <div className="flex justify-end border-t border-[var(--lg-border)] pt-6">
              <AdvancedModeToggle />
            </div>
          </>
        ) : (
          <>
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
                    {!address && !config.passkeyOnlyDeployEnabled ? (
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

            {!smartAccount ? (
              <Card>
                <CardHeader title="Secure account required" badge={<Badge tone="warn">Setup</Badge>} />
                <p className="text-sm text-slate-muted">
                  Create your secure Lumengate account with a passkey, then return here to send privately.
                </p>
                <Button className="mt-4" variant="secondary" onClick={() => navigate('/app/welcome?intent=new')}>
                  Create secure account
                </Button>
              </Card>
            ) : null}
          </>
        )}
      </div>
      </AppPageLayout>
    
  );
}
