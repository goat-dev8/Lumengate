import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Shield, Cpu, Lock } from 'lucide-react';
import { AppShell } from '../components/layout/Shell';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/States';
import { useApp } from '../context/AppContext';
import {
  generateProof,
  publicInputsPanel,
  verifyPublicInputsMatchRoots,
  type ProveProgress,
} from '../lib/prover';
import { proofMatchesCredential } from '../lib/credentialProof';
import { readOnChainRoots, readNullifierSpent, nullifierHexFromBundle } from '../lib/contracts';
import { formatDuration } from '../lib/utils';

const STACK = [
  { label: 'Browser generated', icon: Cpu },
  { label: 'Noir circuit', icon: Lock },
  { label: 'UltraHonk prover', icon: Sparkles },
  { label: 'BN254 curve', icon: Shield },
  { label: 'Verified on Stellar', icon: Shield },
  { label: 'No personal data shared', icon: Lock },
];

const VISIBILITY = [
  {
    title: 'Stays private (never on-chain)',
    items: ['Name', 'Date of birth', 'Documents', 'Full balance', 'Raw jurisdiction code'],
  },
  {
    title: 'Goes on-chain (public inputs)',
    items: ['Merkle root', 'Revocation root', 'Policy ID', 'Nullifier', 'Wallet field binding'],
  },
  {
    title: 'Verifier sees',
    items: ['UltraHonk proof bytes', 'Public inputs', 'Policy ID match', 'Nullifier not spent'],
  },
  {
    title: 'Issuer sees',
    items: ['Wallet field (for credential)', 'Signed commitment', 'Fresh nullifier per request'],
  },
  {
    title: 'Marketplace sees',
    items: ['Proof validity at settlement', 'Policy match for offering', 'Spent nullifier check'],
  },
];

export function ProvePage() {
  const { credential, proof, proofDurationSec, setProof, config, pushActivity } = useApp();
  const [progress, setProgress] = useState<ProveProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedRoots, setVerifiedRoots] = useState<boolean | null>(null);
  const [nullifierSpent, setNullifierSpent] = useState<boolean | null>(null);

  const activeProof = proofMatchesCredential(proof, credential) ? proof : null;

  useEffect(() => {
    if (!activeProof) {
      setNullifierSpent(null);
      setVerifiedRoots(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const roots = await readOnChainRoots(config);
        if (!cancelled) setVerifiedRoots(verifyPublicInputsMatchRoots(activeProof, roots));
        const spent = await readNullifierSpent(
          config,
          nullifierHexFromBundle(activeProof),
          Number(activeProof.publicInputs.policyId),
        );
        if (!cancelled) setNullifierSpent(spent);
      } catch {
        if (!cancelled) {
          setVerifiedRoots(null);
          setNullifierSpent(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProof, config]);

  const handleProve = async () => {
    if (!credential) return;
    setLoading(true);
    setError(null);
    try {
      const { bundle, durationSec } = await generateProof(credential, setProgress);
      setProof(bundle, durationSec);
      const roots = await readOnChainRoots(config);
      setVerifiedRoots(verifyPublicInputsMatchRoots(bundle, roots));
      const nullifierHex = nullifierHexFromBundle(bundle);
      const spent = await readNullifierSpent(
        config,
        nullifierHex,
        Number(bundle.publicInputs.policyId),
      );
      setNullifierSpent(spent);
      pushActivity({
        kind: 'proof',
        title: 'Proof generated',
        detail: `Generated in ${formatDuration(durationSec)}`,
        status: 'success',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setProgress({ stage: 'error', message: String(err), percent: 0 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Badge tone="brand">Step 2</Badge>
          <h1 className="mt-3 text-3xl font-semibold text-navy">Generate your proof</h1>
          <p className="mt-2 max-w-2xl text-slate-muted">
            Noir + UltraHonk in your browser. Private attributes never leave your device — only the
            proof and public inputs reach Stellar.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {STACK.map(({ label, icon: Icon }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-white px-3 py-1.5 text-xs font-semibold text-navy shadow-sm"
            >
              <Icon className="h-3.5 w-3.5 text-brand" />
              {label}
            </span>
          ))}
        </div>

        {!credential ? (
          <EmptyState
            title="Credential required"
            description="Request a credential first, then return here to generate your zero-knowledge proof."
            action={
              <Link to="/app/credential">
                <Button>Get credential</Button>
              </Link>
            }
          />
        ) : (
          <>
            <Card>
              <CardHeader
                title="Browser prover"
                description="Noir witness → UltraHonk proof → BN254 verification on Stellar Protocol 25."
                badge={
                  activeProof && proofDurationSec ? (
                    <Badge tone="ok">✓ Proof generated in {formatDuration(proofDurationSec)}</Badge>
                  ) : (
                    <Badge>Ready</Badge>
                  )
                }
              />
              <Button loading={loading} onClick={handleProve}>
                <Sparkles className="h-4 w-4" />
                Generate proof
              </Button>
              {progress ? (
                <div className="mt-6">
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-slate-muted">{progress.message}</span>
                    <span className="font-medium text-navy">{progress.percent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand transition-all duration-300"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>
              ) : null}
              {error ? <p className="mt-4 text-sm text-status-err">{error}</p> : null}
            </Card>

            <Card>
              <CardHeader
                title="Privacy vs on-chain visibility"
                description="What each party sees — educate judges in 20 seconds"
                badge={<Badge tone="brand">Chain visibility</Badge>}
              />
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {VISIBILITY.map((block) => (
                  <div key={block.title} className="rounded-xl bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase text-slate-muted">{block.title}</div>
                    <ul className="mt-2 space-y-1 text-sm text-slate-ink">
                      {block.items.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>

            {activeProof ? (
              <Card>
                <CardHeader
                  title="What the chain sees"
                  description="Public inputs only — no name, no DOB, no document."
                  badge={<Badge tone="brand">Zero PII</Badge>}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  {publicInputsPanel(activeProof).map((row) => (
                    <div key={row.label} className="rounded-xl bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-wide text-slate-muted">{row.label}</div>
                      <div className="mt-1 break-all font-mono text-xs text-slate-ink">{row.value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {verifiedRoots ? <Badge tone="ok">Roots match on-chain</Badge> : null}
                  {nullifierSpent === false ? <Badge tone="ok">Nullifier available</Badge> : null}
                  {nullifierSpent ? <Badge tone="err">Nullifier already spent</Badge> : null}
                </div>
                {nullifierSpent ? (
                  <p className="mt-4 text-sm text-status-err">
                    This proof&apos;s nullifier was already recorded on-chain. Request a new credential,
                    then generate a fresh proof — replay protection prevents double-spend attacks.
                  </p>
                ) : null}
                <Link
                  to={nullifierSpent ? '/app/credential' : '/app/transfer'}
                  className="mt-6 inline-block"
                >
                  <Button variant="secondary">
                    {nullifierSpent ? 'Request new credential' : 'Continue to transfer'}
                  </Button>
                </Link>
              </Card>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
