import { useEffect, useState } from 'react';
import { ShieldCheck, Terminal } from 'lucide-react';
import { AppShell } from '../components/layout/Shell';
import { AppPageLayout } from '../components/design/AppPageLayout';
import { Pill, SectionHeader, Stagger, StaggerItem, StatusDot } from '../components/design/Primitives';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useApp } from '../context/AppContext';
import { readOnChainRoots } from '../lib/contracts';
import { truncateMiddle } from '../lib/utils';
import { RevokeCredentialPanel } from '../components/product/RevokeCredentialPanel';
import { AdvancedModeToggle, useAdvancedMode } from '../components/product/AdvancedModeToggle';

type AdminStatus = {
  roots: { root: string; revocationRoot: string; noteRoot?: string } | null;
  rootsError: string | null;
};

export function AdminPage() {
  const { config } = useApp();
  const advanced = useAdvancedMode();
  const [status, setStatus] = useState<AdminStatus>({
    roots: null,
    rootsError: null,
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
    ['Session store', config.sessionStoreId],
  ].filter(([, id]) => Boolean(id));

  const metrics = [
    {
      label: 'Deployed contracts',
      value: String(contracts.length),
      detail: config.network,
    },
    {
      label: 'Credential roots',
      value: status.roots ? 'Live' : '—',
      detail: status.rootsError ? 'RPC error' : status.roots ? 'Reachable' : 'Loading',
    },
    {
      label: 'Eligibility policies',
      value: '2',
      detail: `IDs ${config.policyId} · ${config.policyId2}`,
    },
    {
      label: 'Session store',
      value: config.sessionStoreId ? 'Active' : '—',
      detail: config.sessionStoreId ? truncateMiddle(config.sessionStoreId, 8, 6) : 'Not configured',
    },
  ];

  return (
    <AppShell>
      <AppPageLayout
        title="Operators"
        subtitle="Issuer console · policies · deployments"
        actions={<AdvancedModeToggle />}
      >
        <SectionHeader
          eyebrow="Console"
          title="Operations overview"
          description="Issue credentials, manage policies, and monitor deployed contracts on testnet."
          action={
            advanced ? (
              <Pill tone="brand">
                <Terminal className="h-3 w-3" /> Developer mode
              </Pill>
            ) : null
          }
        />

        <Stagger className="mt-6 grid gap-4 md:grid-cols-4">
          {metrics.map((m) => (
            <StaggerItem key={m.label} className="lg-surface-card p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">{m.label}</p>
              <p className="mt-2 lg-font-display text-3xl tracking-tight tabular-nums text-[#012b54] md:text-4xl">
                {m.value}
              </p>
              <p className="mt-1 text-xs text-[#64748b]">{m.detail}</p>
            </StaggerItem>
          ))}
        </Stagger>

        {!advanced ? (
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader
                title="Operator access"
                badge={
                  <Badge tone={status.roots ? 'ok' : 'warn'}>{status.roots ? 'Live' : 'Check setup'}</Badge>
                }
              />
              <p className="text-sm text-slate-muted">
                {status.roots
                  ? 'Credential roots are reachable through live RPC.'
                  : status.rootsError || 'Credential roots are not available from RPC yet.'}
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
          <div className="mt-10 space-y-6">
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

            <div className="lg-surface-card divide-y divide-[var(--lg-border)]">
              <div className="p-5">
                <SectionHeader title="Deployed contracts" description={`Network: ${config.network}`} />
              </div>
              {contracts.map(([label, id]) => (
                <div key={label} className="flex items-center gap-4 p-5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#007dfc] to-[#012b54] text-white">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#012b54]">{label}</p>
                    <p className="truncate font-mono text-xs text-[#64748b]">{String(id)}</p>
                  </div>
                  <Pill tone="success">
                    <StatusDot /> Live
                  </Pill>
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-muted">
              Eligibility plans: investor access {config.policyId}, balance confirmation {config.policyId2}.
            </p>
          </div>
        )}
      </AppPageLayout>
    </AppShell>
  );
}
