import { useEffect, useState } from 'react';
import { AppShell } from '../components/layout/Shell';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useApp } from '../context/AppContext';
import { readOnChainRoots } from '../lib/contracts';
import { truncateMiddle } from '../lib/utils';
import { RevokeCredentialPanel } from '../components/product/RevokeCredentialPanel';

type AdminStatus = {
  roots: { root: string; revocationRoot: string } | null;
  rootsError: string | null;
};

export function AdminPage() {
  const { config } = useApp();
  const [status, setStatus] = useState<AdminStatus>({ roots: null, rootsError: null });

  useEffect(() => {
    readOnChainRoots(config)
      .then((roots) => setStatus({ roots, rootsError: null }))
      .catch((err) =>
        setStatus({
          roots: null,
          rootsError: err instanceof Error ? err.message : String(err),
        }),
      );
  }, [config]);

  const contracts = [
    ['PolicyVerifier', config.policyVerifierId],
    ['CredentialRegistry', config.credentialRegistryId],
    ['IssuerRegistry', config.issuerRegistryId],
    ['RwaAdapter', config.rwaAdapterId],
    ['ComplianceSacAdmin', config.complianceSacAdminId],
    ['AuditorRegistry', config.auditorRegistryId],
    ['CompliantDEX', config.compliantDexId],
    ['CompliantPayroll', config.compliantPayrollId],
    ['CompliancePolicy', config.compliancePolicyId],
    ['LumengateSmartAccount', config.lumengateSmartAccountId],
  ].filter(([, id]) => Boolean(id));

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Badge tone="brand">Operators</Badge>
          <h1 className="mt-3 text-3xl font-semibold text-navy">Policy & contract status</h1>
          <p className="mt-2 max-w-2xl text-slate-muted">
            Live deployment IDs, on-chain Merkle roots, and operator tooling for regulated settlement.
          </p>
        </div>

        <Card>
          <CardHeader title="On-chain policy roots" badge={<Badge>Live RPC</Badge>} />
          {status.roots ? (
            <dl className="space-y-2 text-xs font-mono">
              <div>
                <dt className="text-slate-muted">Merkle root</dt>
                <dd className="break-all">{status.roots.root}</dd>
              </div>
              <div>
                <dt className="text-slate-muted">Revocation root</dt>
                <dd className="break-all">{status.roots.revocationRoot}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-status-err">{status.rootsError || 'Loading…'}</p>
          )}
        </Card>

        <RevokeCredentialPanel issuerUrl={config.issuerServiceUrl} />

        <Card>
          <CardHeader title="Deployed contracts" badge={<Badge>{config.network}</Badge>} />
          <dl className="space-y-3 text-xs">
            {contracts.map(([label, id]) => (
              <div key={label}>
                <dt className="text-slate-muted">{label}</dt>
                <dd className="font-mono break-all">{truncateMiddle(String(id), 12, 8)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-slate-muted">
            Policy IDs: eligibility {config.policyId}, proof-of-funds {config.policyId2}. Session keys
            and spend limits are enforced via LumengateSmartAccount + CompliancePolicy when deployed.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
