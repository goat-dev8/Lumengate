import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { AppShell } from '../components/layout/Shell';
import { Button } from '../components/ui/Button';
import { BrandGridBackground } from '../components/fintech/BrandGridBackground';
import { DashboardFlowIllustration } from '../components/fintech/DashboardFlowIllustration';
import { InstitutionalWidget } from '../components/fintech/InstitutionalWidget';
import { OfferingIllustration } from '../components/fintech/OfferingIllustration';
import { useApp } from '../context/AppContext';
import { useOfferings } from '../hooks/useOfferings';
import { buildPassportSnapshot } from '../lib/passport';
import { readBalance } from '../lib/contracts';
import { ProofLifecyclePanel } from '../components/product/ProofLifecyclePanel';
import { LiveOnStellarStrip } from '../components/product/LiveOnStellarStrip';
import { AssetPolicyMatrix } from '../components/product/AssetPolicyMatrix';
import { UsdcCompliancePanel } from '../components/product/UsdcCompliancePanel';
import { AdvancedModeToggle, useAdvancedMode } from '../components/product/AdvancedModeToggle';
import { ProductProgress } from '../components/product/ProductProgress';
import { buildProductSteps, getProductReadiness } from '../lib/productState';
import { loadStoredPasskey } from '../lib/passkeys';

export function DashboardPage() {
  const { address, connect, connecting, credential, proof, policyKey, config, activity, walletField, proofReceipt, proofLifecycle, beginProofRecovery } =
    useApp();
  const navigate = useNavigate();
  const { offerings } = useOfferings();
  const [balance, setBalance] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [passportStatus, setPassportStatus] = useState('Connect wallet');
  const [readyToInvest, setReadyToInvest] = useState(false);
  const [passkeyReady] = useState(() => Boolean(loadStoredPasskey()));
  const activeProof = proofLifecycle.lifecycle === 'ready' ? proof : null;
  const proofSpent = proofLifecycle.lifecycle === 'consumed';

  useEffect(() => {
    if (!address) {
      setBalance(null);
      return;
    }
    readBalance(config, address)
      .then((b) => {
        setBalance(b);
        setBalanceError(null);
      })
      .catch((err) => {
        setBalance(null);
        setBalanceError(err instanceof Error ? err.message : String(err));
      });
  }, [address, config]);

  useEffect(() => {
    if (!address) {
      setPassportStatus('Connect wallet');
      setReadyToInvest(false);
      return;
    }
    buildPassportSnapshot({
      config,
      address,
      walletField,
      credential,
      proof: activeProof,
      policyKey,
    }).then((snap) => {
      const active = snap.status === 'valid' || snap.status === 'proof-ready';
      setPassportStatus(
        proofSpent
          ? 'Renew passport'
          : active
            ? 'Active'
            : snap.status === 'proof-spent'
              ? 'Renew passport'
              : snap.status === 'no-credential'
                ? 'Issue passport'
                : 'Review',
      );
      setReadyToInvest(active && Boolean(activeProof) && !proofSpent);
    });
  }, [address, credential, activeProof, policyKey, config, walletField, proofSpent]);

  const lastSettlement = useMemo(() => {
    const tx = activity.find((e) => e.kind === 'transfer');
    return tx ? tx.title.replace(/^Settlement: /, '') : null;
  }, [activity]);

  const feed = useMemo(
    () =>
      activity.slice(0, 5).map((e) => ({
        title: e.title,
        time: new Date(e.timestamp).toLocaleString(),
        url: e.explorerUrl,
      })),
    [activity],
  );

  const readiness = getProductReadiness({
    address,
    credential,
    proof: activeProof,
    lifecycle: proofLifecycle.lifecycle,
  });

  const advanced = useAdvancedMode();

  const productSteps = buildProductSteps({
    address,
    passkeyReady,
    credential,
    proof: activeProof,
    lifecycle: proofLifecycle.lifecycle,
    hasSettlement: Boolean(proofReceipt?.transactions.transfer || activity.some((e) => e.kind === 'transfer')),
  });

  return (
    <AppShell>
      <LiveOnStellarStrip config={config} />
      <div className="mt-4 flex justify-end">
        <AdvancedModeToggle />
      </div>
      <div className="mt-2">
        <ProductProgress steps={productSteps} />
      </div>
      {proofSpent ? (
        <div className="mt-4">
          <ProofLifecyclePanel
            state={proofLifecycle}
            config={config}
            onBeginRecovery={() => {
              beginProofRecovery();
              navigate('/app/verify#recovery-credential');
            }}
          />
        </div>
      ) : null}
      <section className="lg-dash-hero">
        <BrandGridBackground />
        <div className="lg-dash-hero-inner">
          <div>
            <span className="fin-pill">Institutional RWA platform</span>
            <h1 className="lg-dash-headline mt-4">{readiness.title}</h1>
            <p className="lg-dash-subhead">
              {readiness.description}
            </p>
            <div className="lg-outcome-strip">
              <span className="lg-outcome-pill">
                <span className={`lg-outcome-dot ${passportStatus === 'Active' ? '' : 'lg-outcome-dot-warn'}`} />
                Passport {passportStatus.toLowerCase()}
              </span>
              <span className="lg-outcome-pill">
                <span className="lg-outcome-dot" />
                {offerings.length} offerings available
              </span>
              <span className="lg-outcome-pill">
                <span className={`lg-outcome-dot ${readyToInvest ? '' : 'lg-outcome-dot-muted'}`} />
                {readyToInvest ? 'Ready to invest' : 'Next step waiting'}
              </span>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              {!address ? (
                <Button loading={connecting} onClick={() => connect()}>
                  Connect Wallet
                </Button>
              ) : (
                <Link to={readiness.href}>
                  <Button>
                    {readiness.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
              <Link to="/app/marketplace">
                <Button variant="secondary">Browse offerings</Button>
              </Link>
            </div>
          </div>
          <DashboardFlowIllustration className="w-full animate-fade-up" />
        </div>
      </section>

      <div className="lg-widget-grid">
        <InstitutionalWidget
          label="Active passport"
          value={passportStatus}
          sub={credential ? 'Cross-chain credential' : 'Not issued'}
          tone={passportStatus === 'Active' ? 'success' : 'default'}
          href="/app/passport"
          icon={
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
              <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
        />
        <InstitutionalWidget
          label="Available investments"
          value={String(offerings.length)}
          sub="Passport-gated offerings"
          tone="accent"
          href="/app/marketplace"
          icon={
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
              <rect x="3" y="6" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          }
        />
        <InstitutionalWidget
          label="Assets owned"
          value={balanceError ? 'Error' : balance !== null ? balance : '—'}
          sub={balanceError || (balance !== null ? 'RWA units' : 'Connect wallet')}
          href="/app/portfolio"
          icon={
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
              <path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
        />
        <InstitutionalWidget
          label="Last settlement"
          value={lastSettlement ?? 'None yet'}
          sub={lastSettlement ? 'On-chain transfer' : 'Complete in marketplace'}
          href="/app/activity"
        />
        <InstitutionalWidget
          label="Compliance health"
          value={readyToInvest ? 'Verified' : passportStatus}
          sub="Passport + proof status"
          tone={readyToInvest ? 'success' : 'default'}
          href="/app/compliance"
          icon={
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
              <path d="M12 2l8 4v6c0 5-3.5 8-8 10-8-5-8-10V6l8-4z" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          }
        />
      </div>

      {(advanced && (config.compliantDexId || config.compliantPayrollId || config.auditorRegistryId)) ? (
        <div className="mt-8 rounded-2xl border border-[#e3e8ee] bg-white p-6 shadow-sm">
          <p className="lg-section-eyebrow">V3 infrastructure</p>
          <h2 className="lg-section-title text-xl">Two dApps, one registry</h2>
          <p className="mt-2 max-w-2xl text-sm text-[#64748b]">
            CompliantDEX and CompliantPayroll share IssuerRegistry + RwaAdapter. AuditorRegistry scopes selective disclosure via viewing keys.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {config.compliantDexId ? (
              <Link to="/app/marketplace" className="rounded-xl border border-[#eef0f3] p-4 hover:border-[#007dfc]">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">CompliantDEX</div>
                <div className="mt-1 font-mono text-[11px] break-all text-[#012b54]">{config.compliantDexId}</div>
                <div className="mt-2 text-xs text-[#007dfc]">swap_compliant offering →</div>
              </Link>
            ) : null}
            {config.compliantPayrollId ? (
              <Link to="/app/marketplace" className="rounded-xl border border-[#eef0f3] p-4 hover:border-[#007dfc]">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">CompliantPayroll</div>
                <div className="mt-1 font-mono text-[11px] break-all text-[#012b54]">{config.compliantPayrollId}</div>
                <div className="mt-2 text-xs text-[#007dfc]">pay_compliant offering →</div>
              </Link>
            ) : null}
            {config.auditorRegistryId ? (
              <Link to="/app/auditor" className="rounded-xl border border-[#eef0f3] p-4 hover:border-[#007dfc]">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">AuditorRegistry</div>
                <div className="mt-1 font-mono text-[11px] break-all text-[#012b54]">{config.auditorRegistryId}</div>
                <div className="mt-2 text-xs text-[#007dfc]">Viewing-key portal →</div>
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <div className="lg-section-head flex items-end justify-between">
            <div>
              <p className="lg-section-eyebrow">Marketplace</p>
              <h2 className="lg-section-title">Eligible offerings</h2>
            </div>
            <Link to="/app/marketplace" className="text-sm font-medium text-[#007dfc] hover:text-[#012b54]">
              View all →
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {offerings.map((offering) => (
              <Link key={offering.id} to={`/app/marketplace/${offering.id}`} className="lg-offering-card group block">
                <OfferingIllustration offering={offering} className="h-32" />
                <div className="lg-offering-body">
                  <h3 className="font-semibold text-[#012b54] transition group-hover:text-[#007dfc]">
                    {offering.title}
                  </h3>
                  <div className="lg-offering-stats">
                    <div className="lg-offering-stat">
                      <div className="lg-offering-stat-label">Access</div>
                      <div className="lg-offering-stat-value">Passport</div>
                    </div>
                    <div className="lg-offering-stat">
                      <div className="lg-offering-stat-label">Risk</div>
                      <div className="lg-offering-stat-value">{offering.riskLevel}</div>
                    </div>
                    <div className="lg-offering-stat">
                      <div className="lg-offering-stat-label">Min</div>
                      <div className="lg-offering-stat-value">{offering.minimumAmount}</div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="xl:col-span-2">
          <div className="lg-section-head">
            <p className="lg-section-eyebrow">Activity</p>
            <h2 className="lg-section-title">Recent settlements</h2>
          </div>
          <div className="overflow-hidden rounded-xl border border-hairline bg-white shadow-card">
            <ul className="divide-y divide-hairline">
              {feed.length === 0 ? (
                <li className="fin-activity-row">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink-mute">No settlements yet — complete marketplace flow.</p>
                  </div>
                </li>
              ) : (
                feed.map((item, i) => (
                  <li key={`${item.title}-${i}`} className="fin-activity-row">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#007dfc]/10">
                      <svg viewBox="0 0 16 16" className="h-4 w-4 text-[#007dfc]" fill="none">
                        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                      <p className="text-xs text-ink-mute">{item.time}</p>
                    </div>
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#007dfc]"
                      >
                        View
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-2">
        <AssetPolicyMatrix />
        <UsdcCompliancePanel config={config} walletAddress={address} />
      </div>
    </AppShell>
  );
}
