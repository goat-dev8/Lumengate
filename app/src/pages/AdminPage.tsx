import { useEffect, useState } from 'react';
import { AppShell } from '../components/layout/Shell';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useApp } from '../context/AppContext';
import { readOnChainRoots } from '../lib/contracts';
import { readSmartAccountContextRules } from '../lib/smartAccount';
import { truncateMiddle } from '../lib/utils';
import { RevokeCredentialPanel } from '../components/product/RevokeCredentialPanel';
import { AdvancedModeToggle, useAdvancedMode } from '../components/product/AdvancedModeToggle';

type AdminStatus = {
  roots: { root: string; revocationRoot: string; noteRoot?: string } | null;
  rootsError: string | null;
  smartRules: number | null;
  smartRulesError: string | null;
};

export function AdminPage() {
  const { config } = useApp();
  const advanced = useAdvancedMode();
  const [status, setStatus] = useState<AdminStatus>({
    roots: null,
    rootsError: null,
    smartRules: null,
    smartRulesError: null,
  });

  useEffect(() => {
    readOnChainRoots(config)
      .then((roots) => setStatus((s) => ({ ...s, roots, rootsError: null })))
      .catch((err) =>
        setStatus((s) => ({
          ...s,
          roots: null,
          rootsError: err instanceof Error ? err.message : String(err),
        })),
      );
    readSmartAccountContextRules(config)
      .then((smartRules) => setStatus((s) => ({ ...s, smartRules, smartRulesError: null })))
      .catch((err) =>
        setStatus((s) => ({
          ...s,
          smartRules: null,
          smartRulesError: err instanceof Error ? err.message : String(err),
        })),
      );
  }, [config]);

  const contracts = [
    ['Eligibility checker', config.policyVerifierId],
    ['Passport registry', config.credentialRegistryId],
    ['Issuer registry', config.issuerRegistryId],
    ['Asset adapter', config.rwaAdapterId],
    ['USDC settlement account', config.complianceSacAdminId],
    ['Auditor registry', config.auditorRegistryId],
    ['Eligible swap router', config.compliantDexId],
    ['Payroll settlement', config.compliantPayrollId],
    ['Compliance rules', config.compliancePolicyId],
    ['Passkey settlement account', config.lumengateSmartAccountId],
  ].filter(([, id]) => Boolean(id));

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="brand">Operators</Badge>
            <h1 className="mt-3 text-3xl font-semibold text-navy">Manage trusted operators</h1>
            <p className="mt-2 max-w-2xl text-slate-muted">
              Delegate controlled access for compliance teams. Set limits, review status, and revoke access without
              exposing customer identity data.
            </p>
          </div>
          <AdvancedModeToggle />
        </div>

        {!advanced ? (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader
                title="Operator access"
                badge={<Badge tone={status.smartRules && status.smartRules > 0 ? 'ok' : 'warn'}>
                  {status.smartRules && status.smartRules > 0 ? 'Live' : 'Check setup'}
                </Badge>}
              />
              <p className="text-sm text-slate-muted">
                {status.smartRules && status.smartRules > 0
                  ? `Account contract has ${status.smartRules} active context rule${status.smartRules === 1 ? '' : 's'}.`
                  : status.smartRulesError || 'Account contract rules are not available from RPC yet.'}
              </p>
            </Card>
            <Card>
              <CardHeader title="Eligibility status" badge={<Badge tone="ok">Live</Badge>} />
              <p className="text-sm text-slate-muted">
                Eligibility and revocation roots are monitored in the background.
              </p>
            </Card>
            <Card>
              <CardHeader title="Restrict passport" badge={<Badge tone="warn">Admin only</Badge>} />
              <p className="text-sm text-slate-muted">
                Passport restriction is available in developer mode with the issuer service revoke key.
              </p>
            </Card>
          </div>
        ) : (
          <>
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
                  {status.roots.noteRoot ? (
                    <div>
                      <dt className="text-slate-muted">Note commitment root</dt>
                      <dd className="break-all">{status.roots.noteRoot}</dd>
                    </div>
                  ) : null}
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
                Eligibility plans: investor access {config.policyId}, balance confirmation {config.policyId2}. Account contract
                context rules: {status.smartRules ?? 'unavailable'}.
              </p>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
