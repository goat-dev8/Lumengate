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
import { AdvancedModeToggle, useAdvancedMode } from '../components/product/AdvancedModeToggle';

const RESULT_LABELS: Record<string, string> = {
  'Disclosure pack version': 'Eligibility record valid',
  'Issuer address present': 'Issuer verified',
  'Merkle root matches chain': 'Eligibility record verified',
  'Revocation root matches chain': 'Restriction record verified',
  'Settlement recorded on-chain': 'Settlement was used once',
  'Passport available for settlement': 'Passport is still unused',
  'Policy ID': 'Eligibility rule present',
  'Wallet binding present': 'Account linked',
  'Nullifier lookup': 'Settlement reference lookup',
};

export function AuditorPage() {
  const { config } = useApp();
  const advanced = useAdvancedMode();
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
      setError('Paste an audit record from a live settlement.');
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
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="brand">Audit</Badge>
            <h1 className="mt-3 text-3xl font-semibold text-navy">Verify settlement without seeing identity</h1>
            <p className="mt-2 max-w-2xl text-slate-muted">
              Enter a viewing key or receipt reference. Lumengate returns only the compliance facts needed for review.
            </p>
          </div>
          <AdvancedModeToggle />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { title: 'Auditor sees', items: ['Eligibility passed', 'One-time settlement used', 'Settlement reference'] },
            { title: 'Auditor never sees', items: ['Legal name', 'Date of birth', 'Sanctions details'] },
            { title: 'Privacy guarantee', items: ['Private confirmation verified', 'Selective disclosure only', 'No identity link'] },
          ].map((col) => (
            <Card key={col.title}>
              <CardHeader title={col.title} />
              <ul className="space-y-2 text-sm text-slate-muted">
                {col.items.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-brand" />
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <AuditorWorkflowDiagram />
          {advanced ? (
            <Card>
              <CardHeader
                title="Standards adapter"
                description="Asset settlement adapter linked to the eligibility checker"
                badge={<Badge>{adapter.standard}</Badge>}
              />
              <dl className="mt-2 space-y-2 text-xs">
                <div>
                  <dt className="text-slate-muted">Asset adapter</dt>
                  <dd className="font-mono break-all">{config.rwaAdapterId}</dd>
                </div>
                <div>
                  <dt className="text-slate-muted">Eligibility checker</dt>
                  <dd className="font-mono break-all">{config.policyVerifierId}</dd>
                </div>
              </dl>
            </Card>
          ) : (
            <Card>
              <CardHeader title="How verification works" badge={<Badge tone="brand">Privacy-first</Badge>} />
              <p className="text-sm text-slate-muted">
                Paste an audit record from a settlement receipt. Lumengate checks Stellar and confirms compliance
                without exposing private attributes.
              </p>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader
            title="Auditor access"
            description="Use a viewing key to retrieve scoped settlement disclosures."
            badge={<Badge tone="brand">Live</Badge>}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm text-slate-muted">Viewing key</span>
              <input
                className="mt-2 w-full rounded-xl border border-slate-line px-3 py-2 font-mono text-xs outline-none focus:border-brand"
                value={viewingKey}
                onChange={(e) => setViewingKey(e.target.value)}
                aria-label="Viewing key"
              />
            </label>
            <label className="block">
              <span className="text-sm text-slate-muted">Settlement reference (optional)</span>
              <input
                className="mt-2 w-full rounded-xl border border-slate-line px-3 py-2 font-mono text-xs outline-none focus:border-brand"
                value={portalTxHash}
                onChange={(e) => setPortalTxHash(e.target.value)}
                aria-label="Settlement reference"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button loading={portalLoading} onClick={runPortalQuery}>
              <KeyRound className="h-4 w-4" />
              Find records
            </Button>
            {config.auditorRegistryId ? (
              <Badge>{`Auditor access ${config.auditorRegistryId.slice(0, 8)}…`}</Badge>
            ) : null}
          </div>
          {portalError ? <p className="mt-4 text-sm text-status-err">{portalError}</p> : null}
          {portalPacks.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {portalPacks.map((pack, idx) => (
                <li key={`${pack.nullifier}-${idx}`} className="rounded-xl bg-slate-50 p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="ok">Eligibility {pack.policyId}</Badge>
                    {pack.txHash ? <Badge>{truncateMiddle(pack.txHash, 12, 8)}</Badge> : null}
                  </div>
                  <p className="mt-2 font-mono text-xs break-all text-slate-muted">
                    private reference {truncateMiddle(pack.nullifier, 16, 12)}
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
            <CardHeader title="Manual verification" badge={<Badge tone="brand">{advanced ? 'Advanced' : 'Receipt JSON'}</Badge>} />
          <div className="mb-4 flex flex-wrap gap-2">
            {(advanced ? (['disclosure', 'public-inputs', 'nullifier'] as const) : (['disclosure'] as const)).map((m) => (
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
                {m === 'disclosure' ? 'audit record' : m === 'public-inputs' ? 'settlement data' : 'settlement reference'}
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
            aria-label={
              mode === 'disclosure'
                ? 'Audit record JSON from Receipt export'
                : mode === 'public-inputs'
                  ? 'Internal settlement data from a live record'
                  : 'Private settlement reference from on-chain verification'
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
                  <Badge tone="ok">VALID — checked live</Badge>
                ) : (
                  <Badge tone="err">Issues found</Badge>
                )
              }
            />
            {result.ok ? (
              <div className="mb-4 flex flex-wrap gap-2">
                {['Eligibility passed', 'Issuer verified', 'Records synced', 'Settlement recorded'].map((t) => (
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
