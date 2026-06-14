import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Sparkles } from 'lucide-react';
import { AppShell } from '../components/layout/Shell';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/States';
import { useApp } from '../context/AppContext';
import { fetchIssuerHealth } from '../lib/config';
import { policyList } from '../lib/policies';
import { readOnChainRoots } from '../lib/contracts';
import {
  generateProof,
  publicInputsPanel,
  type ProveProgress,
} from '../lib/prover';
import { proofMatchesCredential } from '../lib/credentialProof';

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
  } = useApp();
  const [step, setStep] = useState<'credential' | 'proof'>(credential ? 'proof' : 'credential');
  const [credLoading, setCredLoading] = useState(false);
  const [proveLoading, setProveLoading] = useState(false);
  const [proveProgress, setProveProgress] = useState<ProveProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeProof = proofMatchesCredential(proof, credential) ? proof : null;

  const handleCredential = async () => {
    if (!address) {
      await connect();
      return;
    }
    setCredLoading(true);
    setError(null);
    try {
      await fetchIssuerHealth(config.issuerServiceUrl);
      const cred = await requestCredential(policyKey);
      const onChain = await readOnChainRoots(config);
      const matches =
        onChain.root.toLowerCase() === cred.credential.root.toLowerCase() ||
        onChain.root.replace(/^0x/i, '') === cred.credential.root.replace(/^0x/i, '');
      if (!matches) throw new Error('On-chain roots do not match issuer credential');
      pushActivity({
        kind: 'credential',
        title: 'Verification credential issued',
        detail: 'Ready to confirm eligibility',
        status: 'success',
      });
      setStep('proof');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCredLoading(false);
    }
  };

  const handleProve = async () => {
    if (!credential) return;
    setProveLoading(true);
    setError(null);
    setProveProgress(null);
    try {
      const { bundle, durationSec } = await generateProof(credential, setProveProgress);
      setProof(bundle, durationSec);
      pushActivity({
        kind: 'proof',
        title: 'Eligibility confirmed',
        detail: 'You can send regulated assets',
        status: 'success',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProveLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Badge tone="brand">Verify</Badge>
          <h1 className="mt-3 text-3xl font-semibold text-navy">Confirm your eligibility</h1>
          <p className="mt-2 max-w-2xl text-slate-muted">
            Verified once, reuse everywhere. No personal data is shared on-chain.
          </p>
        </div>

        <div className="flex gap-2">
          {(['credential', 'proof'] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={`rounded-full px-4 py-2 text-sm ${
                step === s ? 'bg-navy text-white' : 'bg-slate-100 text-slate-muted'
              }`}
              onClick={() => setStep(s)}
            >
              {s === 'credential' ? '1. Get credential' : '2. Confirm eligibility'}
            </button>
          ))}
        </div>

        {step === 'credential' ? (
          <Card>
            <CardHeader title="Request credential" badge={<Badge>Issuer attestation</Badge>} />
            {!address ? (
              <EmptyState title="Connect your account" description="Create or connect to begin verification." />
            ) : null}
            <label className="mt-4 block text-sm">
              <span className="text-slate-muted">Policy</span>
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
            <Button className="mt-4" loading={credLoading || connecting} onClick={handleCredential}>
              Request credential
            </Button>
            {credential ? (
              <p className="mt-4 text-sm text-brand">
                <ShieldCheck className="mr-1 inline h-4 w-4" />
                Credential ready — continue to step 2
              </p>
            ) : null}
          </Card>
        ) : (
          <Card>
            <CardHeader title="Confirm eligibility" badge={<Badge tone="brand">~seconds</Badge>} />
            {!credential ? (
              <EmptyState
                title="Credential required"
                description="Complete step 1 before confirming eligibility."
                action={
                  <Button variant="secondary" onClick={() => setStep('credential')}>
                    Back to step 1
                  </Button>
                }
              />
            ) : (
              <>
                <p className="text-sm text-slate-muted">
                  {proveProgress?.message || 'Confirming you meet the policy…'}
                </p>
                <Button className="mt-4" loading={proveLoading} onClick={handleProve}>
                  <Sparkles className="h-4 w-4" />
                  Confirm eligibility
                </Button>
                {activeProof ? (
                  <div className="mt-6 space-y-2">
                    <Badge tone="ok">Verified ✓</Badge>
                    <ul className="text-xs text-slate-muted">
                      {publicInputsPanel(activeProof).map((row) => (
                        <li key={row.label}>
                          {row.label}: {row.value}
                        </li>
                      ))}
                    </ul>
                    <Link to="/app/send" className="text-sm text-brand underline">
                      Continue to Send →
                    </Link>
                  </div>
                ) : null}
              </>
            )}
          </Card>
        )}

        {error ? <p className="text-sm text-status-err">{error}</p> : null}
      </div>
    </AppShell>
  );
}
