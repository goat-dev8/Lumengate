import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ShieldCheck } from 'lucide-react';
import { AppShell } from '../components/layout/Shell';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState, Skeleton } from '../components/ui/States';
import { useApp } from '../context/AppContext';
import { fetchIssuerHealth, fetchIssuerMetadata } from '../lib/config';
import { policyList } from '../lib/policies';
import { CrossChainArchitecture } from '../components/lumengate/CrossChainArchitecture';
import { CredentialProvenance } from '../components/lumengate/CredentialProvenance';
import { CredibilityStatement } from '../components/lumengate/TrustIndicators';
import { readOnChainRoots } from '../lib/contracts';
import { truncateMiddle } from '../lib/utils';

export function CredentialPage() {
  const { address, connect, connecting, credential, requestCredential, config, pushActivity, policyKey, setPolicyKey } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issuerOk, setIssuerOk] = useState<boolean | null>(null);

  const [issuerMeta, setIssuerMeta] = useState<string | null>(null);

  const [onChainRoots, setOnChainRoots] = useState<{ root: string; revocationRoot: string } | null>(
    null,
  );

  useEffect(() => {
    readOnChainRoots(config)
      .then(setOnChainRoots)
      .catch(() => setOnChainRoots(null));
  }, [config]);

  useEffect(() => {
    fetchIssuerMetadata(config.issuerServiceUrl)
      .then((m) => setIssuerMeta(m.stellarPublicKey))
      .catch(() => setIssuerMeta(null));
  }, [config.issuerServiceUrl]);

  const handleRequest = async () => {
    if (!address) {
      await connect();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const health = await fetchIssuerHealth(config.issuerServiceUrl);
      setIssuerOk(health.ok);
      const cred = await requestCredential(policyKey);
      const onChain = await readOnChainRoots(config);
      const matches =
        onChain.root.toLowerCase() === cred.credential.root.toLowerCase() ||
        onChain.root.replace(/^0x/i, '') === cred.credential.root.replace(/^0x/i, '');
      if (!matches) {
        throw new Error('On-chain roots do not match issuer credential');
      }
      pushActivity({
        kind: 'credential',
        title: 'Credential issued',
        detail: 'Issuer attestation ready for proving',
        status: 'success',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Badge tone="brand">Step 1</Badge>
          <h1 className="mt-3 text-3xl font-semibold text-navy">Get your credential</h1>
          <p className="mt-2 max-w-2xl text-slate-muted">
            Request an eligibility credential from the issuer. Lumengate uses this to prove you meet
            policy requirements — without sharing personal information on-chain.
          </p>
        </div>

        {!address ? (
          <EmptyState
            title="Connect your wallet"
            description="Connect a Stellar wallet on testnet to receive a credential bound to your address."
            action={
              <Button loading={connecting} onClick={() => connect()}>
                Connect wallet
              </Button>
            }
          />
        ) : (
          <>
            <CredibilityStatement />
            <CrossChainArchitecture />
          <Card>
            <CardHeader
              title="Request credential"
              description="Receive a signed eligibility credential from the Lumengate testnet issuer service."
              badge={<Badge tone="brand">Eligibility issuer</Badge>}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-navy">
                  <Building2 className="h-4 w-4 text-brand" />
                  Connected wallet
                </div>
                <p className="mt-2 font-mono text-xs text-slate-ink">{truncateMiddle(address, 10, 8)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-navy">
                  <ShieldCheck className="h-4 w-4 text-brand" />
                  Network
                </div>
                <p className="mt-2 text-sm text-slate-muted">Stellar {config.network}</p>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm text-slate-muted">Selective disclosure policy</label>
              <select
                className="mt-2 w-full rounded-xl border border-slate-line px-4 py-3 text-sm outline-none focus:border-brand"
                value={policyKey}
                onChange={(e) => setPolicyKey(e.target.value as typeof policyKey)}
              >
                {policyList().map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
            {issuerMeta ? (
              <p className="mt-4 text-xs text-slate-muted">
                Cross-chain issuer (Ethereum secp256k1):{' '}
                <span className="font-mono">{truncateMiddle(issuerMeta, 10, 8)}</span>
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <Button loading={loading} onClick={handleRequest}>
                Request credential
              </Button>
              {credential ? (
                <Link to="/app/prove">
                  <Button variant="secondary">Continue to prove</Button>
                </Link>
              ) : null}
            </div>
            {error ? <p className="mt-4 text-sm text-status-err">{error}</p> : null}
          </Card>
          </>
        )}

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : null}

        {credential ? (
          <>
          <Card>
            <CardHeader title="Credential status" badge={<Badge tone="ok">Active</Badge>} />
            <CredentialProvenance
              config={config}
              credential={credential}
              walletField={credential.walletField ?? null}
              onChainRoots={onChainRoots}
              rootsMatch={
                onChainRoots
                  ? onChainRoots.root.replace(/^0x/i, '') ===
                    credential.credential.root.replace(/^0x/i, '')
                  : false
              }
              expiresAt={credential.expiresAt ?? null}
            />
            <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2 border-t border-slate-100 pt-4">
              <div>
                <dt className="text-slate-muted">Issuer</dt>
                <dd className="font-mono text-xs">{credential.issuerEthAddress}</dd>
              </div>
              <div>
                <dt className="text-slate-muted">Commitment</dt>
                <dd className="font-mono text-xs break-all">{credential.credential.commitment}</dd>
              </div>
              <div>
                <dt className="text-slate-muted">Policy ID</dt>
                <dd>{credential.credential.policyId}</dd>
              </div>
              <div>
                <dt className="text-slate-muted">Nullifier (fresh per request)</dt>
                <dd className="font-mono text-xs break-all">{credential.credential.nullifier}</dd>
              </div>
              {credential.issuedAt ? (
                <div>
                  <dt className="text-slate-muted">Issued</dt>
                  <dd>{new Date(credential.issuedAt).toLocaleString()}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-slate-muted">Label</dt>
                <dd>{credential.label}</dd>
              </div>
            </dl>
            {issuerOk !== null ? (
              <p className="mt-4 text-sm text-status-ok">Issuer service reachable</p>
            ) : null}
          </Card>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
