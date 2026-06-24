import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import { AppShell } from '../components/layout/Shell';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useApp } from '../context/AppContext';
import { fetchIssuerHealth, registerSmartAccountPasskey } from '../lib/config';
import { policyList } from '../lib/policies';
import { readOnChainRoots } from '../lib/contracts';
import {
  generateProof,
  publicInputsPanel,
  type ProveProgress,
} from '../lib/prover';
import {
  createPasskey,
  loadStoredPasskey,
  markPasskeyRegistered,
  passkeyEnvSummary,
  passkeyRegisteredFor,
  passkeySupported,
  type StoredPasskey,
} from '../lib/passkeys';
import { friendlyIssuerError } from '../lib/advancedMode';
import { AdvancedModeToggle, useAdvancedMode } from '../components/product/AdvancedModeToggle';
import { ProofLifecyclePanel } from '../components/product/ProofLifecyclePanel';
import { ProductHero } from '../components/product/ProductHero';
import { PrivacyJourney } from '../components/product/PrivacyJourney';
import { WalletSigningNotice } from '../components/product/WalletSigningNotice';
import { recoveryLog, verifyStepFlags, type VerifyStepId } from '../lib/proofRecovery';

const STEP_META: { id: VerifyStepId; label: string; hint: string }[] = [
  { id: 'wallet', label: 'Connect wallet', hint: 'Link your Stellar account' },
  { id: 'credential', label: 'Verify eligibility', hint: 'Issuer confirms access' },
  { id: 'proof', label: 'Private passport', hint: 'Confirm locally in your browser' },
  { id: 'ready', label: 'Unlock investments', hint: 'Invest or send privately' },
];

function stepState(
  id: VerifyStepId,
  flags: Record<VerifyStepId, boolean>,
): 'complete' | 'current' | 'upcoming' {
  const order = STEP_META.map((s) => s.id);
  const idx = order.indexOf(id);
  if (flags[id]) return 'complete';
  const firstIncomplete = order.findIndex((k) => !flags[k]);
  return idx === firstIncomplete ? 'current' : 'upcoming';
}

export function VerifyPage() {
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
    setProof,
    proofLifecycle,
    syncProofLifecycle,
    beginProofRecovery,
  } = useApp();
  const [credLoading, setCredLoading] = useState(false);
  const [proveLoading, setProveLoading] = useState(false);
  const [proveProgress, setProveProgress] = useState<ProveProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passkey, setPasskey] = useState<StoredPasskey | null>(() => loadStoredPasskey());
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const passkeyEnv = passkeyEnvSummary();
  const advanced = useAdvancedMode();
  const activeProof = proofLifecycle.lifecycle === 'ready' ? proof : null;
  const proofConsumed = proofLifecycle.lifecycle === 'consumed';
  const recoveryHint = proofLifecycle.lifecycle === 'none' && Boolean(proofLifecycle.reason);

  const flags = useMemo(
    () =>
      verifyStepFlags({
        address: Boolean(address),
        credential: Boolean(credential),
        activeProof: Boolean(activeProof),
        lifecycle: proofLifecycle.lifecycle,
      }),
    [address, credential, activeProof, proofLifecycle.lifecycle],
  );

  const currentStep = useMemo(() => {
    const order = STEP_META.map((s) => s.id);
    return order.find((id) => !flags[id]) ?? 'ready';
  }, [flags]);

  useEffect(() => {
    if (window.location.hash === '#recovery-credential') {
      document.getElementById('recovery-credential')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [proofLifecycle.lifecycle, credential]);

  const handlePasskey = async () => {
    setPasskeyLoading(true);
    setError(null);
    try {
      const created = await createPasskey(address || 'lumengate-user');
      let next = created;
      if (config.lumengateSmartAccountId && config.webauthnVerifierId) {
        const registration = await registerSmartAccountPasskey(config.issuerServiceUrl, {
          smartAccountId: config.lumengateSmartAccountId,
          verifierId: config.webauthnVerifierId,
          keyDataHex: created.keyDataHex,
        });
        next = markPasskeyRegistered({
          smartAccountId: registration.smartAccountId,
          verifierId: registration.verifierId,
          txHash: registration.txHash,
        });
      }
      setPasskey(next);
      pushActivity({
        kind: 'credential',
        title: 'Passkey registered',
        detail: next.registrationTxHash ?? 'Passkey saved on this browser',
        status: 'success',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleCredential = async () => {
    if (!address) {
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
      const onChain = await readOnChainRoots(config);
      const matches =
        onChain.root.toLowerCase() === cred.credential.root.toLowerCase() ||
        onChain.root.replace(/^0x/i, '') === cred.credential.root.replace(/^0x/i, '');
      if (!matches) throw new Error('Compliance registry is syncing — wait a moment and retry.');
      pushActivity({
        kind: 'credential',
        title: recoveryHint || proofConsumed ? 'New passport issued' : 'Passport issued',
        detail: 'Eligibility attested — identity stays off-chain',
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
    if (!credential) {
      setError('Request a passport first — each settlement needs a fresh private confirmation.');
      return;
    }
    setProveLoading(true);
    setError(null);
    setProveProgress(null);
    recoveryLog('proof.generate.begin', { nullifier: credential.proverInputs?.nullifier });
    try {
      const fresh = await requestCredential(policyKey);
      const { bundle, durationSec } = await generateProof(fresh, setProveProgress);
      recoveryLog('proof.generate.done', {
        durationSec,
        nullifier: bundle.publicInputs.nullifier,
      });
      setProof(bundle, durationSec, fresh);
      pushActivity({
        kind: 'proof',
        title: 'Eligibility confirmed',
        detail: 'Private passport ready for one settlement',
        status: 'success',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      recoveryLog('proof.generate.error', { message: msg });
      setError(msg);
    } finally {
      setProveLoading(false);
    }
  };

  const showCredentialStep =
    (currentStep === 'credential' || flags.credential || proofConsumed || recoveryHint) && Boolean(address);
  const needsNewPassport = proofConsumed || recoveryHint || currentStep === 'credential' || !credential;
  const showProofStep =
    Boolean(credential) && !proofConsumed && flags.credential && (currentStep === 'proof' || flags.proof);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <AdvancedModeToggle />
        </div>

        <ProductHero
          eyebrow="Verify"
          title="Verify eligibility in minutes"
          subtitle="Connect your wallet, receive a private passport, and unlock regulated investments without exposing personal details."
        />

        <WalletSigningNotice compact />
        <PrivacyJourney compact />

        {(proofConsumed || proofLifecycle.lifecycle === 'invalid') && (
          <ProofLifecyclePanel
            state={proofLifecycle}
            config={config}
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
          {STEP_META.map((step) => {
            const state = stepState(step.id, flags);
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

        {currentStep === 'wallet' ? (
          <Card>
            <CardHeader title="Step 1 — Connect wallet" badge={<Badge tone="brand">Stellar</Badge>} />
            <p className="text-sm text-slate-muted">
              Use Freighter or another Stellar wallet. Your wallet signs each settlement.
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

        {showCredentialStep ? (
          <div id="recovery-credential">
            <Card>
              <CardHeader
                title="Step 2 — Verify eligibility"
                badge={<Badge>{advanced ? 'Issuer attestation' : 'Private'}</Badge>}
              />
              <p className="text-sm text-slate-muted">
                {needsNewPassport && (proofConsumed || recoveryHint)
                  ? 'Your previous passport was used. Request a new one for your next settlement.'
                  : 'Choose your eligibility type. The issuer confirms you meet the policy without publishing personal data.'}
              </p>
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

        {showProofStep ? (
          <div id="recovery-proof">
            <Card>
              <CardHeader title="Step 3 — Generate private passport" badge={<Badge tone="brand">Private</Badge>} />
              <p className="text-sm text-slate-muted">
                Lumengate confirms you are allowed without revealing your identity. This runs locally in your browser.
              </p>
              {!activeProof ? (
                <>
                  <p className="mt-3 text-sm text-slate-muted">
                    {proveProgress?.message || 'Ready to confirm eligibility…'}
                  </p>
                  <Button className="mt-4" loading={proveLoading} disabled={!credential} onClick={handleProve}>
                    <Sparkles className="h-4 w-4" />
                    Confirm eligibility
                  </Button>
                </>
              ) : null}
              {activeProof ? (
                <div className="mt-6 space-y-2">
                  <Badge tone="ok">Private passport ready</Badge>
                  {advanced ? (
                    <ul className="text-xs text-slate-muted">
                      {publicInputsPanel(activeProof).map((row) => (
                        <li key={row.label}>
                          {row.label}: {row.value}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-muted">
                      You can invest or send once. Your wallet will sign the settlement.
                    </p>
                  )}
                </div>
              ) : null}
            </Card>
          </div>
        ) : null}

        {(currentStep === 'ready' || flags.ready) && activeProof ? (
          <Card>
            <CardHeader title="Step 4 — Unlock investments" badge={<Badge tone="ok">Ready</Badge>} />
            <p className="text-sm text-slate-muted">
              Your private passport is active for one compliant settlement.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link to="/app/marketplace">
                <Button>
                  Browse investments
                  <Sparkles className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/app/send">
                <Button variant="secondary">Send privately</Button>
              </Link>
            </div>
          </Card>
        ) : null}

        {advanced ? (
          <Card>
            <CardHeader title="Optional — Secure this device" badge={<Badge>Passkey</Badge>} />
            <p className="text-sm text-slate-muted">
              Save a passkey for smart-account settlement on this device.
              {` RP ID: ${passkeyEnv.rpId}`}
              {!passkeyEnv.supported ? ' — requires HTTPS' : ''}
            </p>
            {passkeyRegisteredFor(passkey, config.lumengateSmartAccountId, config.webauthnVerifierId) ? (
              <p className="mt-3 text-sm text-brand">
                <ShieldCheck className="mr-1 inline h-4 w-4" />
                Passkey registered for smart-account settlement
              </p>
            ) : (
              <Button
                className="mt-4"
                variant="secondary"
                loading={passkeyLoading}
                disabled={!passkeySupported()}
                onClick={handlePasskey}
              >
                Save passkey
              </Button>
            )}
          </Card>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-status-err" role="alert">
            <p className="font-medium">Something went wrong</p>
            <p className="mt-1">{error}</p>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
