import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Circle, Fingerprint, Sparkles, Wallet } from 'lucide-react';
import { AppPageLayout } from '../components/design/AppPageLayout';
import { PassportHero } from '../components/design/PassportHero';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useApp } from '../context/AppContext';
import { fetchIssuerHealth } from '../lib/config';
import { policyList } from '../lib/policies';
import { credentialRootMatchesChain } from '../lib/contracts';
import {
  publicInputsPanel,
  type ProveProgress,
} from '../lib/prover';
import { friendlyIssuerError } from '../lib/advancedMode';
import { AdvancedModeToggle, useAdvancedMode } from '../components/product/AdvancedModeToggle';
import { ProofLifecyclePanel } from '../components/product/ProofLifecyclePanel';
import { FundSmartAccountPanel } from '../components/product/FundSmartAccountPanel';
import { StaleSmartAccountUpgradePanel } from '../components/product/StaleSmartAccountUpgradePanel';
import { OnboardingPathPicker, getOnboardingPath, setOnboardingPath, type OnboardingPath } from '../components/product/OnboardingPathPicker';
import { WalletSigningNotice } from '../components/product/WalletSigningNotice';
import { recoveryLog, verifyStepFlags, type VerifyStepId } from '../lib/proofRecovery';
import { derivePassportPhase } from '../lib/passportLifecycle';
import { PrivacySplitCard } from '../components/design/PrivacySplitCard';
import { StageProgress, PASSPORT_PROVE_STAGES } from '../components/design/StageProgress';
import { PassportScopePanel } from '../components/product/PassportScopePanel';
import { usePassportScopeStatuses } from '../hooks/usePassportScopeStatuses';
import { microcopy } from '../lib/microcopy';

const PASSKEY_STEP_META: { id: VerifyStepId | 'passkey'; label: string; hint: string }[] = [
  { id: 'passkey', label: 'Passkey account', hint: 'Create your smart account' },
  { id: 'credential', label: 'Verify eligibility', hint: 'Issuer confirms access' },
  { id: 'proof', label: 'Private passport', hint: 'Confirm locally in browser' },
  { id: 'ready', label: 'Unlock investments', hint: 'Invest or send privately' },
];

const WALLET_STEP_META: { id: VerifyStepId; label: string; hint: string }[] = [
  { id: 'wallet', label: 'Connect wallet', hint: 'Link your Stellar account' },
  { id: 'credential', label: 'Verify eligibility', hint: 'Issuer confirms access' },
  { id: 'proof', label: 'Private passport', hint: 'Confirm locally in browser' },
  { id: 'ready', label: 'Unlock investments', hint: 'Invest or send privately' },
];

function stepState(
  id: VerifyStepId | 'passkey',
  flags: Record<string, boolean>,
  order: (VerifyStepId | 'passkey')[],
): 'complete' | 'current' | 'upcoming' {
  const idx = order.indexOf(id);
  if (flags[id]) return 'complete';
  const firstIncomplete = order.findIndex((k) => !flags[k]);
  return idx === firstIncomplete ? 'current' : 'upcoming';
}

export function VerifyPage() {
  const [searchParams] = useSearchParams();
  const pathParam = searchParams.get('path');
  const [onboardingPath, setOnboardingPathState] = useState<OnboardingPath>(() =>
    pathParam === 'wallet' ? 'wallet' : getOnboardingPath(),
  );

  useEffect(() => {
    if (pathParam === 'wallet') {
      setOnboardingPath('wallet');
      setOnboardingPathState('wallet');
    } else {
      setOnboardingPath('passkey');
      setOnboardingPathState('passkey');
    }
  }, [pathParam]);

  const passkeyFirst = onboardingPath === 'passkey';
  const stepMeta = passkeyFirst ? PASSKEY_STEP_META : WALLET_STEP_META;
  const {
    address,
    connect,
    connecting,
    credential,
    proof,
    requestCredential,
    config,
    pushActivity,
    policyKey,
    setPolicyKey,
    confirmPassportEligibility,
    bindSessionProofIfNeeded,
    sessionProofBound,
    refreshSessionProofBound,
    proofLifecycle,
    syncProofLifecycle,
    beginProofRecovery,
    smartAccount,
    smartAccountCreating,
    smartAccountStale,
    createSmartAccount,
    replaceSmartAccount,
    settlementAddress,
    fundSmartAccountUsdc,
    fundSmartAccountEurc,
    fundSmartAccountXlm,
    proverReady,
    proverWarmupMessage,
    proverWarmupError,
    passkeyBusy,
  } = useApp();
  const [credLoading, setCredLoading] = useState(false);
  const [proveLoading, setProveLoading] = useState(false);
  const [bindLoading, setBindLoading] = useState(false);
  const [bindStatus, setBindStatus] = useState<string | null>(null);
  const [proveProgress, setProveProgress] = useState<ProveProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const advanced = useAdvancedMode();
  const { rows: scopeRows, loading: scopeLoading, refresh: refreshScopeStatuses } = usePassportScopeStatuses();
  const activeProof = proofLifecycle.lifecycle === 'ready' ? proof : null;
  const proofConsumed = proofLifecycle.lifecycle === 'consumed';
  const recoveryHint = proofLifecycle.lifecycle === 'none' && Boolean(proofLifecycle.reason);

  const flags = useMemo((): Record<string, boolean> => {
    const base = verifyStepFlags({
      address: Boolean(address),
      credential: Boolean(credential),
      activeProof: Boolean(activeProof),
      lifecycle: proofLifecycle.lifecycle,
    });
    if (passkeyFirst) {
      return {
        passkey: Boolean(smartAccount && settlementAddress),
        credential: base.credential,
        proof: base.proof,
        ready: base.ready,
        wallet: base.wallet,
      };
    }
    return base;
  }, [
    address,
    credential,
    activeProof,
    proofLifecycle.lifecycle,
    passkeyFirst,
    smartAccount,
    settlementAddress,
  ]);

  const stepOrder = useMemo(
    () => stepMeta.map((s) => s.id),
    [stepMeta],
  );

  const currentStep = useMemo(() => {
    return stepOrder.find((id) => !flags[id]) ?? 'ready';
  }, [flags, stepOrder]);

  useEffect(() => {
    if (window.location.hash === '#recovery-credential') {
      document.getElementById('recovery-credential')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [proofLifecycle.lifecycle, credential]);

  const handleCredential = async () => {
    if (!address && !settlementAddress && !config.openZeppelinRelayerUrl) {
      await connect();
      return;
    }
    setCredLoading(true);
    setError(null);
    recoveryLog('credential.request', { policyKey, proofConsumed, recoveryHint });
    try {
      await fetchIssuerHealth(config.issuerServiceUrl);
      const cred = await requestCredential(policyKey);
      recoveryLog('credential.api.response', {
        nullifier: cred.proverInputs?.nullifier,
        policyId: cred.credential.policyId,
      });
      const synced = await credentialRootMatchesChain(config, cred.credential.root);
      setError(null);
      pushActivity({
        kind: 'credential',
        title: recoveryHint || proofConsumed ? 'New passport issued' : 'Passport issued',
        detail: synced
          ? 'Eligibility attested — identity stays off-chain'
          : 'Passport issued — registry still syncing on-chain; you can confirm eligibility next',
        status: 'success',
      });
    } catch (err) {
      const msg = friendlyIssuerError(err instanceof Error ? err.message : String(err));
      recoveryLog('credential.api.error', { message: msg });
      setError(msg);
    } finally {
      setCredLoading(false);
    }
  };

  const handleProve = async () => {
    setProveLoading(true);
    setError(null);
    setProveProgress({ stage: 'init', message: 'Starting private confirmation…', percent: 5 });
    recoveryLog('proof.generate.begin', { nullifier: credential?.proverInputs?.nullifier });
    try {
      await confirmPassportEligibility('rwa', (message) => {
        setProveProgress({
          stage: message.toLowerCase().includes('passkey') ? 'done' : 'prove',
          message,
          percent: message.toLowerCase().includes('passkey') ? 95 : 70,
        });
      });
      setError(null);
      setProveProgress(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      recoveryLog('proof.generate.error', { message: msg });
      setError(msg);
      setProveProgress({ stage: 'error', message: msg, percent: 0 });
    } finally {
      setProveLoading(false);
    }
  };

  const handleAuthorizePasskey = async () => {
    if (!activeProof || bindLoading || passkeyBusy) return;
    setBindLoading(true);
    setBindStatus('Opening passkey — confirm with Face ID, fingerprint, or device PIN…');
    setError(null);
    try {
      const bindHash = await bindSessionProofIfNeeded(activeProof);
      setBindStatus(bindHash ? 'Passkey authorized on-chain.' : 'Passkey already authorized for this proof.');
      await refreshSessionProofBound(activeProof);
      setError(null);
    } catch (err) {
      setBindStatus(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBindLoading(false);
    }
  };

  const showCredentialStep =
    (currentStep === 'credential' || flags.credential || proofConsumed || recoveryHint) &&
    (passkeyFirst ? Boolean(smartAccount) : Boolean(address));
  const needsNewPassport = proofConsumed || recoveryHint || currentStep === 'credential' || !credential;
  const showProofStep =
    Boolean(credential) && !proofConsumed && flags.credential && (currentStep === 'proof' || flags.proof);

  const phase = derivePassportPhase({
    address,
    credential,
    proof,
    lifecycle: proofLifecycle,
  });

  const wizardMode = !advanced;
  const showWizardStep = (stepId: VerifyStepId | 'passkey') =>
    !wizardMode || currentStep === stepId || (stepId === 'credential' && proofConsumed);

  const scrollToRenew = () => {
    beginProofRecovery();
    document.getElementById('recovery-credential')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleRequestNewPassport = async () => {
    setError(null);
    setCredLoading(true);
    try {
      scrollToRenew();
      await requestCredential(policyKey);
      pushActivity({
        kind: 'credential',
        title: 'Passport renewed',
        detail: policyKey,
        status: 'success',
      });
    } catch (err) {
      setError(friendlyIssuerError(err instanceof Error ? err.message : String(err)));
    } finally {
      setCredLoading(false);
    }
  };

  return (
    
      <AppPageLayout
        title={microcopy.passport.title}
        subtitle={microcopy.passport.subtitle}
      >
        <PassportHero
          phase={phase}
          credential={credential}
          policyKey={policyKey}
          settlementAddress={settlementAddress}
        />

        <div className="mt-10 space-y-6">
        {advanced && (!smartAccount || !settlementAddress) ? <OnboardingPathPicker compact /> : null}

        {advanced ? (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <AdvancedModeToggle />
          </div>
        ) : null}

        {advanced ? <WalletSigningNotice compact /> : null}
        <PrivacySplitCard compact className="mt-2" />

        {credential ? (
          <PassportScopePanel
            rows={scopeRows}
            loading={scopeLoading}
            onRefresh={() => refreshScopeStatuses()}
            onRenew={scrollToRenew}
            onRequestNew={handleRequestNewPassport}
          />
        ) : null}

        {(proofConsumed || proofLifecycle.lifecycle === 'invalid') && (
          <ProofLifecyclePanel
            state={proofLifecycle}
            config={config}
            scopeRows={scopeRows}
            onBeginRecovery={beginProofRecovery}
            onRefreshProof={() => syncProofLifecycle()}
          />
        )}

        {recoveryHint ? (
          <div className="rounded-xl border border-brand-200 bg-brand-50/50 px-4 py-3 text-sm text-slate-muted">
            {proofLifecycle.reason}
          </div>
        ) : null}

        <nav aria-label="Verification steps" className="grid gap-2 sm:grid-cols-4">
          {stepMeta.map((step) => {
            const state = stepState(step.id, flags, stepOrder);
            return (
              <div
                key={step.id}
                className={`rounded-xl border px-3 py-3 text-left ${
                  state === 'complete'
                    ? 'border-emerald-200 bg-emerald-50/70'
                    : state === 'current'
                      ? 'border-brand-300 bg-brand-50/60 ring-1 ring-brand-200'
                      : 'border-slate-100 bg-slate-50/80 opacity-75'
                }`}
              >
                <div className="flex items-center gap-2">
                  {state === 'complete' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Circle className={`h-4 w-4 ${state === 'current' ? 'text-brand' : 'text-slate-300'}`} />
                  )}
                  <span className="text-xs font-semibold text-navy">{step.label}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-muted">{step.hint}</p>
              </div>
            );
          })}
        </nav>

        {passkeyFirst && showWizardStep('passkey') && (currentStep === 'passkey' || !smartAccount) ? (
          <Card>
            <CardHeader
              title="Step 1 — Create secure account"
              badge={<Badge tone="brand">Passkey</Badge>}
            />
            <p className="text-sm text-slate-muted">
              {microcopy.account.passkeyPrompt}. Your passkey authorizes every settlement — no seed phrase.
            </p>
            {!address && !config.openZeppelinRelayerUrl ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Relayer not configured — connect Freighter once to pay deploy fees, then create your passkey.
              </p>
            ) : null}
            {!address && !config.openZeppelinRelayerUrl ? (
              <Button className="mt-4" loading={connecting} onClick={() => connect()}>
                Connect wallet for deploy
              </Button>
            ) : null}
            {address && smartAccountStale ? (
              <StaleSmartAccountUpgradePanel
                legacyAddress={settlementAddress}
                loading={smartAccountCreating}
                onReplace={replaceSmartAccount}
              />
            ) : null}
            {(!smartAccount || smartAccountStale) && (address || config.openZeppelinRelayerUrl) ? (
              <Button
                className="mt-4"
                loading={smartAccountCreating}
                onClick={() => createSmartAccount()}
              >
                <Fingerprint className="h-4 w-4" />
                {microcopy.welcome.createAccount}
              </Button>
            ) : null}
            {smartAccount && settlementAddress && !smartAccountStale ? (
              <p className="mt-4 text-sm text-brand">
                <CheckCircle2 className="mr-1 inline h-4 w-4" />
                Smart account ready — {settlementAddress.slice(0, 8)}…
              </p>
            ) : null}
          </Card>
        ) : null}

        {!passkeyFirst && currentStep === 'wallet' ? (
          <Card>
            <CardHeader title="Step 1 — Connect wallet" badge={<Badge tone="brand">Stellar</Badge>} />
            <p className="text-sm text-slate-muted">
              Use Freighter or another Stellar wallet for onboarding and funding. Your passkey smart account authorizes settlement.
            </p>
            {address ? (
              <p className="mt-4 text-sm text-brand">
                <Wallet className="mr-1 inline h-4 w-4" />
                Wallet connected — continue to verify eligibility
              </p>
            ) : (
              <Button className="mt-4" loading={connecting} onClick={() => connect()}>
                Connect wallet
              </Button>
            )}
          </Card>
        ) : null}

        {!passkeyFirst && address && smartAccountStale ? (
          <StaleSmartAccountUpgradePanel
            legacyAddress={settlementAddress}
            loading={smartAccountCreating}
            onReplace={replaceSmartAccount}
          />
        ) : null}

        {!passkeyFirst && address && !smartAccount ? (
          <Card>
            <CardHeader title="Step 2 — Create passkey smart account" badge={<Badge tone="brand">Passkey</Badge>} />
            <p className="text-sm text-slate-muted">
              Create a WebAuthn passkey and deploy your personal smart account. This account receives funds and authorizes settlement.
            </p>
            <Button className="mt-4" loading={smartAccountCreating} onClick={() => createSmartAccount()}>
              Create passkey smart account
            </Button>
          </Card>
        ) : null}

        {passkeyFirst && smartAccount && settlementAddress && !smartAccountStale && !address && advanced ? (
          <Card>
            <CardHeader title="Add funds when ready" badge={<Badge tone="brand">Optional</Badge>} />
            <p className="text-sm text-slate-muted">
              Connect Freighter only to fund your smart account with USDC or XLM. Your passkey still authorizes settlement.
            </p>
            <Button className="mt-4" loading={connecting} onClick={() => connect()}>
              Connect wallet to fund
            </Button>
          </Card>
        ) : null}

        {address && smartAccount && settlementAddress && !smartAccountStale && advanced ? (
          <FundSmartAccountPanel
            config={config}
            smartAccountAddress={settlementAddress}
            onFundUsdc={fundSmartAccountUsdc}
            onFundEurc={fundSmartAccountEurc}
            onFundXlm={fundSmartAccountXlm}
            compact
          />
        ) : null}

        {showCredentialStep && showWizardStep('credential') ? (
          <div id="recovery-credential">
            <Card>
              <CardHeader
                title="Step 2 — Request passport"
                badge={<Badge>{advanced ? 'Issuer attestation' : 'Private'}</Badge>}
              />
              <p className="text-sm text-slate-muted">
                {needsNewPassport && (proofConsumed || recoveryHint)
                  ? microcopy.passport.renewBody
                  : 'Request your Private Financial Passport. The issuer confirms you meet the policy without publishing personal data.'}
              </p>
              {needsNewPassport && (proofConsumed || recoveryHint) ? (
                <p className="mt-2 text-xs text-slate-muted">
                  After a USDC send, renew here first — then Confirm eligibility and Authorize with passkey on the steps below.
                </p>
              ) : null}
              <label className="mt-4 block text-sm">
                <span className="text-slate-muted">Eligibility type</span>
                <select
                  className="mt-2 w-full rounded-xl border border-slate-line px-3 py-2"
                  value={policyKey}
                  onChange={(e) => setPolicyKey(e.target.value as typeof policyKey)}
                >
                  {policyList().map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
              {needsNewPassport ? (
                <Button className="mt-4" loading={credLoading || connecting} onClick={handleCredential}>
                  {proofConsumed || recoveryHint ? 'Request new passport' : 'Request passport'}
                </Button>
              ) : null}
              {credential && flags.credential ? (
                <p className="mt-4 text-sm text-brand">
                  <CheckCircle2 className="mr-1 inline h-4 w-4" />
                  Passport issued
                </p>
              ) : null}
            </Card>
          </div>
        ) : null}

        {showProofStep && showWizardStep('proof') ? (
          <div id="recovery-proof">
            <Card>
              <CardHeader title="Step 3 — Verify eligibility privately" badge={<Badge tone="brand">Private</Badge>} />
              <p className="text-sm text-slate-muted">
                {microcopy.prove.proofHint}
              </p>
              {proveLoading ? (
                <div className="mt-4">
                  <StageProgress
                    stages={PASSPORT_PROVE_STAGES}
                    currentStageId={
                      proveProgress?.message?.toLowerCase().includes('witness')
                        ? 'witness'
                        : proveProgress?.message?.toLowerCase().includes('proof')
                          ? 'proof'
                          : 'preparing'
                    }
                  />
                </div>
              ) : null}
              {!activeProof ? (
                <>
                  <p className="mt-3 text-sm text-slate-muted">
                    {proveProgress?.message ||
                      proverWarmupMessage ||
                      (proverWarmupError
                        ? proverWarmupError
                        : proverReady
                          ? 'Ready to confirm eligibility — proof runs locally (~30s). You will authorize with passkey on the next step.'
                          : 'Private proofs are unavailable in this browser context.')}
                  </p>
                  {proverWarmupError ? (
                    <p className="mt-2 text-sm text-amber-700">
                      Private prover failed to initialize. Hard-refresh the page. If this persists, try a normal browser window without strict privacy extensions.
                    </p>
                  ) : null}
                  <Button
                    className="mt-4"
                    loading={proveLoading}
                    disabled={!credential || !smartAccount || !proverReady}
                    onClick={handleProve}
                  >
                    <Sparkles className="h-4 w-4" />
                    {microcopy.passport.verify}
                  </Button>
                </>
              ) : null}
              {activeProof ? (
                <div className="mt-6 space-y-3">
                  <Badge tone="ok">Private passport ready</Badge>
                  {sessionProofBound === false ? (
                    <>
                      <p className="text-sm text-slate-muted">
                        Your browser generated the proof locally. Authorize once with your passkey to bind it on-chain for settlement.
                      </p>
                      <Button
                        className="mt-2"
                        loading={bindLoading || passkeyBusy}
                        disabled={passkeyBusy && !bindLoading}
                        onClick={handleAuthorizePasskey}
                      >
                        {microcopy.passport.authorize}
                      </Button>
                      {bindStatus ? (
                        <p className="text-sm text-slate-muted" role="status">
                          {bindStatus}
                        </p>
                      ) : null}
                    </>
                  ) : sessionProofBound ? (
                    <p className="text-sm text-brand">
                      <CheckCircle2 className="mr-1 inline h-4 w-4" />
                      Passkey authorized — ready for Marketplace or Send
                    </p>
                  ) : (
                    <p className="text-sm text-slate-muted">Checking passkey authorization…</p>
                  )}
                  {advanced ? (
                    <ul className="text-xs text-slate-muted">
                      {publicInputsPanel(activeProof).map((row) => (
                        <li key={row.label}>
                          {row.label}: {row.value}
                        </li>
                      ))}
                    </ul>
                  ) : sessionProofBound ? (
                    <p className="text-sm text-slate-muted">
                      You can invest or send with an asset-scoped proof. Your passkey smart account authorizes settlement.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </Card>
          </div>
        ) : null}

        {(currentStep === 'ready' || flags.ready) && activeProof && showWizardStep('ready') ? (
          <Card>
            <CardHeader title="You're verified" badge={<Badge tone="ok">Ready</Badge>} />
            <p className="text-sm text-slate-muted">
              Your private passport is active. Invest in regulated offerings or send funds privately.
            </p>
            {scopeRows?.some((r) => r.status === 'renewal_required') ? (
              <p className="mt-2 text-xs text-amber-800">{microcopy.passport.scopeRenewHint}</p>
            ) : null}
            <div className="mt-4">
              <Link to="/app/marketplace">
                <Button className="w-full sm:w-auto">
                  Browse investments
                  <Sparkles className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/app/send" className="mt-3 block text-center text-sm font-medium text-[#007dfc] hover:underline sm:mt-2 sm:inline sm:ml-4">
                Send privately instead
              </Link>
            </div>
          </Card>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-status-err" role="alert">
            <p className="font-medium">Something went wrong</p>
            <p className="mt-1">{error}</p>
          </div>
        ) : null}
        </div>
      </AppPageLayout>
    
  );
}
