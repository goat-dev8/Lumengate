import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, TrendingUp } from 'lucide-react';
import { AppShell } from '../components/layout/Shell';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { BrandGridBackground } from '../components/fintech/BrandGridBackground';
import { PortfolioChart } from '../components/fintech/PortfolioChart';
import { InstitutionalWidget } from '../components/fintech/InstitutionalWidget';
import { useApp } from '../context/AppContext';
import { buildPassportSnapshot } from '../lib/passport';
import { proofMatchesCredential } from '../lib/credentialProof';
import { readBalance, readComplianceAdminUsdcBalance } from '../lib/contracts';
import { allocationFromActivity } from '../lib/portfolio';
import { currentSettlementOwner } from '../lib/settlementOwner';
import { truncateMiddle } from '../lib/utils';

export function PortfolioPage() {
  const { address, connect, connecting, credential, proof, policyKey, config, activity, walletField, settlementAddress } = useApp();
  const [balance, setBalance] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [passportStatus, setPassportStatus] = useState('—');
  const [proofStatus, setProofStatus] = useState('Not generated');
  const activeProof = proofMatchesCredential(proof, credential) ? proof : null;
  const settlementOwner = currentSettlementOwner(config, address, settlementAddress);

  useEffect(() => {
    if (!settlementOwner) return;
    readBalance(config, settlementOwner)
      .then((b) => {
        setBalance(b);
        setBalanceError(null);
      })
      .catch((err) => {
        setBalance(null);
        setBalanceError(err instanceof Error ? err.message : String(err));
      });
    if (config.complianceSacAdminId) {
      readComplianceAdminUsdcBalance(config, settlementOwner)
        .then((snap) => setUsdcBalance(snap.formatted))
        .catch(() => setUsdcBalance(null));
    } else {
      setUsdcBalance(null);
    }
  }, [settlementOwner, config, activity]);

  useEffect(() => {
    if (!address) {
      setPassportStatus('Not connected');
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
      setPassportStatus(
        snap.status === 'valid' || snap.status === 'proof-ready'
          ? 'Verified'
          : snap.status === 'proof-spent'
            ? 'Renew passport'
            : snap.status === 'no-credential'
              ? 'Needs credential'
              : 'Review',
      );
      setProofStatus(activeProof ? 'Ready for settlement' : credential ? 'Confirm eligibility' : 'Awaiting passport');
    });
  }, [address, credential, activeProof, policyKey, config, walletField]);

  const settlements = useMemo(
    () => activity.filter((e) => e.kind === 'transfer' || e.kind === 'verify').slice(0, 6),
    [activity],
  );

  const bal = BigInt(balance ?? '0');
  const allocation = useMemo(
    () => allocationFromActivity(activity, bal),
    [activity, bal],
  );

  return (
    <AppShell>
      {!address ? (
        <Card>
          <CardHeader
            title="Connect to view portfolio"
            description="Your holdings and settlement history are tied to your Stellar wallet."
          />
          <Button loading={connecting} onClick={() => connect()}>
            Connect account
          </Button>
        </Card>
      ) : (
        <>
          <section className="lg-portfolio-hero">
            <BrandGridBackground className="opacity-30" />
            <div className="relative z-10">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Net RWA exposure</p>
              <div className="lg-portfolio-net mt-1">{balanceError ? '—' : balance ?? '…'} units</div>
              <div className="lg-portfolio-change">
                <TrendingUp className="h-4 w-4" />
                {bal > 0n ? 'Portfolio verified on-chain' : 'No holdings yet — invest in marketplace'}
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/app/marketplace">
                  <Button size="sm">Invest in offerings</Button>
                </Link>
                <Link to="/app/verify">
                  <Button variant="secondary" size="sm">
                    Manage passport
                  </Button>
                </Link>
              </div>
            </div>
          </section>

          <div className="lg-widget-grid !grid-cols-2 lg:!grid-cols-4">
            <InstitutionalWidget label="Passport status" value={passportStatus} sub="Compliance verified" href="/app/verify" />
            <InstitutionalWidget label="Confirmation" value={proofStatus} sub="Settlement readiness" href="/app/verify" />
            <InstitutionalWidget label="Holdings" value={balanceError ? 'RPC error' : `${balance ?? '—'} RWA`} sub="Treasury units" />
            <InstitutionalWidget
              label="USDC (settlement)"
              value={usdcBalance !== null ? `${usdcBalance} USDC` : '—'}
              sub="Compliance pool balance"
            />
            <InstitutionalWidget
              label="Settlement owner"
              value={truncateMiddle(settlementOwner ?? address, 6, 4)}
              sub={settlementAddress ? 'Smart account' : 'Wallet onboarding'}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-1">
              <CardHeader title="Asset allocation" description="Exposure by asset class" />
              {allocation.length === 0 ? (
                <p className="text-sm text-[#64748b]">
                  No on-chain RWA holdings yet. Settle via{' '}
                  <Link to="/app/marketplace" className="font-semibold text-[#007dfc] hover:underline">
                    Marketplace
                  </Link>{' '}
                  to populate allocation from live balance.
                </p>
              ) : (
                <>
                  <PortfolioChart slices={allocation} />
                  <ul className="mt-4 space-y-2">
                    {allocation.map((s) => (
                      <li key={s.label} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                          {s.label}
                        </span>
                        <span className="font-medium tabular-nums text-[#012b54]">{s.value}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>

            <Card className="xl:col-span-1">
              <CardHeader title="Performance" description="Portfolio summary" />
              <div className="space-y-4">
                <div className="rounded-xl bg-[#f6f9fc] p-4">
                  <div className="text-xs font-medium uppercase tracking-wider text-[#64748b]">Current exposure</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums text-[#012b54]">{balance ?? '—'}</div>
                  <div className="mt-1 text-xs text-[#64748b]">RWA units on Stellar testnet</div>
                </div>
                <div className="rounded-xl bg-[#f6f9fc] p-4">
                  <div className="text-xs font-medium uppercase tracking-wider text-[#64748b]">Compliance</div>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge tone={passportStatus === 'Verified' ? 'ok' : 'warn'}>{passportStatus}</Badge>
                    <span className="text-sm text-[#64748b]">{proofStatus}</span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="xl:col-span-1">
              <CardHeader
                title="Settlement history"
                badge={settlements.length ? <Badge tone="ok">{settlements.length}</Badge> : undefined}
              />
              {settlements.length === 0 ? (
                <p className="text-sm text-[#64748b]">
                  No settlements yet.{' '}
                  <Link to="/app/marketplace" className="font-semibold text-[#007dfc] hover:underline">
                    Subscribe in Marketplace
                  </Link>
                </p>
              ) : (
                <ul className="space-y-2">
                  {settlements.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#f6f9fc] p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#012b54]">{s.title}</p>
                        <p className="text-xs text-[#64748b]">{new Date(s.timestamp).toLocaleString()}</p>
                      </div>
                      {s.explorerUrl ? (
                        <a
                          href={s.explorerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 text-[#007dfc]"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </AppShell>
  );
}
