import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import { AppShell } from '../components/layout/Shell';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useApp } from '../context/AppContext';
import { fetchIssuerHealth } from '../lib/config';
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
  passkeyEnvSummary,
  passkeySupported,
  type StoredPasskey,
} from '../lib/passkeys';
import { friendlyIssuerError } from '../lib/advancedMode';
import { AdvancedModeToggle, useAdvancedMode } from '../components/product/AdvancedModeToggle';
import { ProofLifecyclePanel } from '../components/product/ProofLifecyclePanel';
import { ProductHero } from '../components/product/ProductHero';
import { PrivacyJourney } from '../components/product/PrivacyJourney';
import { DashboardFlowIllustration } from '../components/fintech/DashboardFlowIllustration';
import { buildPassportSnapshot } from '../lib/passport';
import { recoveryLog, verifyStepFlags } from '../lib/proofRecovery';

type VerifyStepId = 'wallet' | 'passkey' | 'credential' | 'proof' | 'passport';

const STEP_META: { id: VerifyStepId; label: string; hint: string }[] = [
  { id: 'wallet', label: 'Connect account', hint: 'Link your Stellar account' },
  { id: 'passkey', label: 'Secure device', hint: 'Seedless passkey sign-in' },
  { id: 'credential', label: 'Get passport', hint: 'Issuer attests eligibility' },
  { id: 'proof', label: 'Confirm eligibility', hint: 'Private check in your browser' },
  { id: 'passport', label: 'Ready', hint: 'Invest or send privately' },
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
    walletField,
    passportActivated,
    setPassportActivated,
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
        passkey: Boolean(passkey),
        credential: Boolean(credential),
        activeProof: Boolean(activeProof),
        passportActivated,
        lifecycle: proofLifecycle.lifecycle,
      }),
    [address, passkey, credential, activeProof, passportActivated, proofLifecycle.lifecycle],
  );

  const currentStep = useMemo(() => {
    const order = STEP_META.map((s) => s.id);
    return order.find((id) => !flags[id]) ?? 'passport';
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
      setPasskey(created);
      pushActivity({
        kind: 'credential',
        title: 'Passkey secured',
        detail: 'Device secured for seedless sign-in',
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
    recoveryLog('credential.request', { policyKey, walletField, proofConsumed, recoveryHint });
    try {
      await fetchIssuerHealth(config.issuerServiceUrl);
      recoveryLog('credential.api.health', { ok: true });
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
        title: recoveryHint || proofConsumed ? 'New passport issued' : 'Compliance passport issued',
        detail: 'Passport ready — identity stays off-chain',
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
      setError('Request a new passport first — each settlement needs a fresh private confirmation.');
      return;
    }
    setProveLoading(true);
    setError(null);
    setProveProgress(null);
    recoveryLog('proof.generate.begin', { nullifier: credential.proverInputs?.nullifier });
    try {
      const { bundle, durationSec } = await generateProof(credential, setProveProgress);
      recoveryLog('proof.generate.done', {
        durationSec,
        nullifier: bundle.publicInputs.nullifier,
      });
      setProof(bundle, durationSec);
      pushActivity({
        kind: 'proof',
        title: 'Eligibility confirmed',
        detail: 'Private confirmation ready — no identity revealed',
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

  const handleActivate = async () => {
    if (!address || !credential || !activeProof) return;
    setError(null);
    try {
      const snap = await buildPassportSnapshot({
        config,
        address,
        walletField,
        credential,
        proof: activeProof,
        policyKey,
      });
      if (snap.status !== 'valid' && snap.status !== 'proof-ready') {
        throw new Error('Passport could not activate — confirm eligibility again and retry.');
      }
      setPassportActivated(true);
      pushActivity({
        kind: 'proof',
        title: 'Passport activated',
        detail: 'You can access passport-gated assets',
        status: 'success',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
        title="Get your private compliance passport"
        subtitle="Connect once, secure this device, receive a passport, and privately confirm you are allowed to access regulated Stellar assets."
          illustration={<DashboardFlowIllustration className="w-full max-w-md" />}
        />

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

        <nav aria-label="Verification steps" className="grid gap-2 sm:grid-cols-5">
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
            <CardHeader title="Step 1 — Connect account" badge={<Badge tone="brand">Stellar</Badge>} />
            <p className="text-sm text-slate-muted">
              Today Lumengate uses Freighter or another Stellar wallet to sign settlements. Passkeys secure this
              browser session; smart-account signing is on the roadmap.
            </p>
            {address ? (
              <p className="mt-4 text-sm text-brand">
                <Wallet className="mr-1 inline h-4 w-4" />
                Account connected — continue to secure your device
              </p>
            ) : (
              <Button className="mt-4" loading={connecting} onClick={() => connect()}>
                Connect account
              </Button>
            )}
          </Card>
        ) : null}

        {currentStep === 'passkey' || flags.passkey ? (
          <Card>
            <CardHeader title="Step 2 — Secure this device" badge={<Badge>Passkey</Badge>} />
            <p className="text-sm text-slate-muted">
              Create a device passkey for a familiar sign-in experience. Your biometrics never leave this device.
              {advanced ? ` RP ID: ${passkeyEnv.rpId}` : ''}
              {!passkeyEnv.supported ? ' — requires HTTPS' : ''}
            </p>
            {passkey ? (
              <p className="mt-3 text-sm text-brand">
                <ShieldCheck className="mr-1 inline h-4 w-4" />
                Passkey active on this device
              </p>
            ) : currentStep === 'passkey' ? (
              <Button
                className="mt-4"
                loading={passkeyLoading}
                disabled={!passkeySupported()}
                onClick={handlePasskey}
              >
                Create passkey
              </Button>
            ) : null}
          </Card>
        ) : null}

        {showCredentialStep ? (
          <div id="recovery-credential">
          <Card>
            <CardHeader
              title="Step 3 — Get your compliance passport"
              badge={<Badge>{advanced ? 'Issuer attestation' : 'Off-chain'}</Badge>}
            />
            <p className="text-sm text-slate-muted">
              {needsNewPassport && (proofConsumed || recoveryHint)
                ? 'Your previous passport was used successfully. Renew it so the next settlement has a fresh private confirmation.'
                : 'The issuer attests you meet policy requirements. Your name, jurisdiction, and sanctions status stay off-chain — only a cryptographic commitment is recorded.'}
            </p>
            <label className="mt-4 block text-sm">
              <span className="text-slate-muted">{advanced ? 'Policy' : 'Eligibility type'}</span>
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
                <ShieldCheck className="mr-1 inline h-4 w-4" />
                Passport credential ready
              </p>
            ) : null}
          </Card>
          </div>
        ) : null}

        {showProofStep ? (
          <div id="recovery-proof">
          <Card>
            <CardHeader title="Step 4 — Confirm eligibility privately" badge={<Badge tone="brand">Private</Badge>} />
            <p className="text-sm text-slate-muted">
              Lumengate confirms you are allowed without revealing your identity or private attributes.
            </p>
            {!activeProof ? (
              <>
                <p className="mt-3 text-sm text-slate-muted">
                  {proveProgress?.message || 'Ready to confirm eligibility locally in your browser…'}
                </p>
                <Button className="mt-4" loading={proveLoading} disabled={!credential} onClick={handleProve}>
                  <Sparkles className="h-4 w-4" />
                  Confirm eligibility
                </Button>
              </>
            ) : null}
            {activeProof ? (
              <div className="mt-6 space-y-2">
                <Badge tone="ok">Eligibility confirmed</Badge>
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
                    Public inputs contain only policy compliance signals — no personal data.
                  </p>
                )}
              </div>
            ) : null}
          </Card>
          </div>
        ) : null}

        {(currentStep === 'passport' || flags.passport) && activeProof ? (
          <Card>
            <CardHeader title="Step 5 — Ready to use" badge={<Badge tone="ok">Ready</Badge>} />
            <p className="text-sm text-slate-muted">
              Your compliance passport is active. Access passport-gated RWA offerings and settle on Stellar with
              privacy preserved.
            </p>
            {!passportActivated ? (
              <Button className="mt-4" onClick={handleActivate}>
                Activate
              </Button>
            ) : (
              <div className="mt-4 space-y-3">
                <Badge tone="ok">Passport active</Badge>
                <div className="flex flex-wrap gap-3">
                  <Link to="/app/send">
                    <Button>
                      Send compliant assets
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link to="/app/marketplace">
                    <Button variant="secondary">Browse offerings</Button>
                  </Link>
                </div>
              </div>
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
