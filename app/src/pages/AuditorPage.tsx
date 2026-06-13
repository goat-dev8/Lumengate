import { useState } from 'react';
import { Search, ShieldCheck, KeyRound } from 'lucide-react';
import { AppShell } from '../components/layout/Shell';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { AuditorWorkflowDiagram } from '../components/lumengate/AuditorWorkflow';
import { useApp } from '../context/AppContext';
import { parseDisclosurePack, type DisclosurePack } from '../lib/disclosure';
import { queryDisclosures } from '../lib/disclosureApi';
import { verifyAuditorInput, type AuditorVerification } from '../lib/auditor';
import { loadIdentityVerifierAdapter } from '../lib/standards';
import { truncateMiddle } from '../lib/utils';

const RESULT_LABELS: Record<string, string> = {
  'Disclosure pack version': 'Policy passed',
  'Issuer address present': 'Issuer verified',
  'Merkle root matches chain': 'Root verified',
  'Revocation root matches chain': 'Root verified',
  'Nullifier spent on-chain': 'Nullifier valid',
  'Policy ID': 'Policy passed',
  'Wallet binding present': 'Wallet bound',
};

export function AuditorPage() {
  const { config } = useApp();
  const adapter = loadIdentityVerifierAdapter(config.rwaAdapterId);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'disclosure' | 'public-inputs' | 'nullifier'>('disclosure');
  const [policyId, setPolicyId] = useState(String(config.policyId));
  const [result, setResult] = useState<AuditorVerification | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingKey, setViewingKey] = useState('');
  const [portalTxHash, setPortalTxHash] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [portalPacks, setPortalPacks] = useState<DisclosurePack[]>([]);

  const clearInput = () => {
    setError(null);
    setResult(null);
    setInput('');
  };

  const runVerification = async () => {
    if (!input.trim()) {
      setError('Paste a disclosure pack, public inputs hex, or nullifier from a live settlement.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let verification: AuditorVerification;
      if (mode === 'disclosure') {
        const pack = parseDisclosurePack(input) as DisclosurePack;
        verification = await verifyAuditorInput(config, { kind: 'disclosure', pack });
      } else if (mode === 'public-inputs') {
        verification = await verifyAuditorInput(config, {
          kind: 'public-inputs',
          publicInputsHex: input.trim(),
        });
      } else {
        verification = await verifyAuditorInput(config, {
          kind: 'nullifier',
          nullifierHex: input.trim(),
          policyId: Number(policyId),
        });
      }
      setResult(verification);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const runPortalQuery = async () => {
    if (!viewingKey.trim()) {
      setPortalError('Enter the auditor viewing key registered on AuditorRegistry.');
      return;
    }
    setPortalLoading(true);
    setPortalError(null);
    setPortalPacks([]);
    try {
      const response = await queryDisclosures(
        config.issuerServiceUrl,
        viewingKey.trim(),
        config.auditorId,
        portalTxHash.trim() || undefined,
      );
      setPortalPacks(response.disclosures);
      if (response.count === 0) {
        setPortalError('No disclosures found for this viewing key.');
      }
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : String(err));
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Badge tone="brand">Auditor console</Badge>
          <h1 className="mt-3 text-3xl font-semibold text-navy">Independent compliance verification</h1>
          <p className="mt-2 max-w-2xl text-slate-muted">
            An auditor can verify compliance without accessing private user data — only disclosure
            packs, public inputs, and live Soroban RPC checks.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <AuditorWorkflowDiagram />
          <Card>
            <CardHeader
              title="Standards adapter"
              description="RwaAdapter → PolicyVerifier (SEP-57-style identity verifier)"
              badge={<Badge>{adapter.standard}</Badge>}
            />
            <dl className="mt-2 space-y-2 text-xs">
              <div>
                <dt className="text-slate-muted">RwaAdapter</dt>
                <dd className="font-mono break-all">{config.rwaAdapterId}</dd>
              </div>
              <div>
                <dt className="text-slate-muted">PolicyVerifier</dt>
                <dd className="font-mono break-all">{config.policyVerifierId}</dd>
              </div>
            </dl>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Viewing-key portal"
            description="POST /disclose — on-chain viewing key check + scoped disclosure lookup"
            badge={<Badge tone="brand">Live issuer service</Badge>}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm text-slate-muted">Auditor viewing key</span>
              <input
                className="mt-2 w-full rounded-xl border border-slate-line px-3 py-2 font-mono text-xs outline-none focus:border-brand"
                value={viewingKey}
                onChange={(e) => setViewingKey(e.target.value)}
                placeholder="Registered on AuditorRegistry"
              />
            </label>
            <label className="block">
              <span className="text-sm text-slate-muted">Filter by tx hash (optional)</span>
              <input
                className="mt-2 w-full rounded-xl border border-slate-line px-3 py-2 font-mono text-xs outline-none focus:border-brand"
                value={portalTxHash}
                onChange={(e) => setPortalTxHash(e.target.value)}
                placeholder="Settlement transaction hash"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button loading={portalLoading} onClick={runPortalQuery}>
              <KeyRound className="h-4 w-4" />
              Query disclosures
            </Button>
            {config.auditorRegistryId ? (
              <Badge>{`AuditorRegistry ${config.auditorRegistryId.slice(0, 8)}…`}</Badge>
            ) : null}
          </div>
          {portalError ? <p className="mt-4 text-sm text-status-err">{portalError}</p> : null}
          {portalPacks.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {portalPacks.map((pack, idx) => (
                <li key={`${pack.nullifier}-${idx}`} className="rounded-xl bg-slate-50 p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="ok">Policy {pack.policyId}</Badge>
                    {pack.txHash ? <Badge>{truncateMiddle(pack.txHash, 12, 8)}</Badge> : null}
                  </div>
                  <p className="mt-2 font-mono text-xs break-all text-slate-muted">
                    nullifier {truncateMiddle(pack.nullifier, 16, 12)}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      setMode('disclosure');
                      setInput(JSON.stringify(pack, null, 2));
                      setError(null);
                      setResult(null);
                    }}
                  >
                    Load into verifier
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Card>
          <CardHeader title="Verification input" badge={<Badge tone="brand">Live RPC</Badge>} />
          <div className="mb-4 flex flex-wrap gap-2">
            {(['disclosure', 'public-inputs', 'nullifier'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`rounded-full px-3 py-1 text-sm ${
                  mode === m ? 'bg-navy text-white' : 'bg-slate-100 text-slate-muted'
                }`}
                onClick={() => {
                  setMode(m);
                  clearInput();
                }}
              >
                {m}
              </button>
            ))}
          </div>
          {mode === 'nullifier' ? (
            <label className="mb-4 block">
              <span className="text-sm text-slate-muted">Policy ID</span>
              <input
                className="mt-2 w-32 rounded-xl border border-slate-line px-3 py-2 text-sm"
                value={policyId}
                onChange={(e) => setPolicyId(e.target.value)}
              />
            </label>
          ) : null}
          <textarea
            className="min-h-[180px] w-full rounded-xl border border-slate-line px-4 py-3 font-mono text-xs outline-none focus:border-brand"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === 'disclosure'
                ? 'Paste disclosure JSON from Proof Receipt export…'
                : mode === 'public-inputs'
                  ? 'Paste 128-byte public inputs hex from a live attestation…'
                  : 'Paste nullifier hex from on-chain verification…'
            }
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={clearInput}>
              Clear
            </Button>
            <Button loading={loading} onClick={runVerification}>
              <Search className="h-4 w-4" />
              Verify
            </Button>
          </div>
          {error ? <p className="mt-4 text-sm text-status-err">{error}</p> : null}
        </Card>

        {result ? (
          <Card>
            <CardHeader
              title="Verification result"
              badge={
                result.ok ? (
                  <Badge tone="ok">VALID — Live on-chain verification</Badge>
                ) : (
                  <Badge tone="err">Issues found</Badge>
                )
              }
            />
            {result.ok ? (
              <div className="mb-4 flex flex-wrap gap-2">
                {['Policy passed', 'Issuer verified', 'Root verified', 'Nullifier valid'].map((t) => (
                  <Badge key={t} tone="ok">
                    {t}
                  </Badge>
                ))}
              </div>
            ) : null}
            <ul className="space-y-3">
              {result.checks.map((check) => (
                <li
                  key={check.label}
                  className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm"
                >
                  <ShieldCheck
                    className={`h-5 w-5 shrink-0 ${check.pass ? 'text-brand' : 'text-status-err'}`}
                  />
                  <div>
                    <div className="font-medium text-navy">
                      {RESULT_LABELS[check.label] ?? check.label}
                    </div>
                    <div className="mt-1 break-all font-mono text-xs text-slate-muted">
                      {truncateMiddle(check.detail, 24, 16)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
