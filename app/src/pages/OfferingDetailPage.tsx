import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Shield, ExternalLink } from 'lucide-react';
import { AppShell } from '../components/layout/Shell';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState, Skeleton } from '../components/ui/States';
import { PageHeader } from '../components/fintech/PageHeader';
import { UsdcCompliancePanel } from '../components/product/UsdcCompliancePanel';
import { WalletSigningNotice } from '../components/product/WalletSigningNotice';
import { AdvancedModeToggle, useAdvancedMode } from '../components/product/AdvancedModeToggle';
import { useApp } from '../context/AppContext';
import { useOffering } from '../hooks/useOfferings';
import type { LiveOffering } from '../lib/offerings';
import { policyByKey } from '../lib/policies';
import { proofMatchesCredential } from '../lib/credentialProof';
import { OfferingIllustration } from '../components/fintech/OfferingIllustration';
import { truncateMiddle } from '../lib/utils';

function OfferingDetailContent({ offering }: { offering: LiveOffering }) {
  const {
    address,
    connect,
    connecting,
    credential,
    proof,
    config,
    requestCredential,
    setPolicyKey,
    setSelectedOfferingId,
  } = useApp();
  const navigate = useNavigate();
  const advanced = useAdvancedMode();
  const activeProof = proofMatchesCredential(proof, credential) ? proof : null;
  const policy = policyByKey(offering.requiredPolicy);
  const canInvest = Boolean(address && activeProof);

  const prepare = async () => {
    if (!address) {
      await connect();
      return;
    }
    setSelectedOfferingId(offering.id);
    setPolicyKey(offering.requiredPolicy);
    await requestCredential(offering.requiredPolicy);
    navigate('/app/verify');
  };

  return (
    <AppShell>
      <PageHeader eyebrow="Investment detail" title={offering.title} subtitle={offering.description} />

      <div className="mb-6 flex justify-end">
        <AdvancedModeToggle />
      </div>

      <div className="grid gap-8 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-6">
          <OfferingIllustration offering={offering} className="h-48 rounded-2xl" variant="card" />
          <Card>
            <CardHeader title="Offering facts" badge={<Badge tone="brand">{offering.offeringStatus}</Badge>} />
            <dl className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-xs uppercase text-[#64748b]">Access</dt>
                <dd className="font-medium text-[#012b54]">Passport required</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-[#64748b]">Settlement asset</dt>
                <dd>{offering.settlementAsset.toUpperCase()}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-[#64748b]">Minimum</dt>
                <dd>
                  {offering.minimumAmount} {offering.unitLabel}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-[#64748b]">Risk</dt>
                <dd>{offering.riskLevel}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-[#64748b]">Settlement account</dt>
                <dd className="font-mono text-xs">
                  {offering.settlementAddress
                    ? truncateMiddle(offering.settlementAddress, 8, 6)
                    : 'From deployment config'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-[#64748b]">Review path</dt>
                <dd>{offering.verificationRoute}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Why passport access is required" />
            <p className="text-sm leading-relaxed text-[#475569]">{offering.whyProofRequired}</p>
            <ul className="mt-4 space-y-2">
              {offering.proofRequirements.map((req) => (
                <li key={req} className="flex items-start gap-2 text-sm text-[#012b54]">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[#007dfc]" />
                  {req}
                </li>
              ))}
            </ul>
          </Card>

          {advanced ? (
            <UsdcCompliancePanel config={config} walletAddress={address} variant="compact" />
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Eligibility" description="Private access requirements" />
            <p className="text-sm font-medium text-[#012b54]">{policy.title}</p>
            <p className="mt-1 text-sm text-[#64748b]">{offering.eligibilityPolicy}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {policy.claims.map((c) => (
                <Badge key={c} tone="ok">
                  {c}
                </Badge>
              ))}
            </div>
            <p className="mt-4 text-xs text-[#64748b]">Settlement: {offering.settlementPolicy}</p>
          </Card>

          <Card>
            <CardHeader title="Invest" />
            <div className="space-y-3">
              <WalletSigningNotice compact />
              {!address ? (
                <Button loading={connecting} className="w-full" onClick={() => connect()}>
                  Connect account
                </Button>
              ) : !credential || !activeProof ? (
                <Button className="w-full" onClick={() => prepare()}>
                  Get ready to invest
                </Button>
              ) : null}
              {canInvest ? (
                <Link to="/app/marketplace" className="block">
                  <Button className="w-full">
                    Invest
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <p className="text-xs text-[#64748b]">
                  Complete your passport for this investment before settlement.
                </p>
              )}
              <Link to="/app/compliance" className="inline-flex items-center gap-1 text-sm font-semibold text-[#007dfc]">
                View receipt
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

export function OfferingDetailRoute() {
  const { offeringId } = useParams<{ offeringId: string }>();
  const { offering, loading, error } = useOffering(offeringId);

  if (loading) {
    return (
      <AppShell>
        <Skeleton className="h-12 w-64" />
        <Skeleton className="mt-8 h-96" />
      </AppShell>
    );
  }

  if (error || !offering) {
    return (
      <AppShell>
        <EmptyState
          title="Offering not found"
          description={error || 'Issuer service has no offering with this ID.'}
          action={
            <Link to="/app/marketplace">
              <Button variant="secondary">Back to marketplace</Button>
            </Link>
          }
        />
      </AppShell>
    );
  }

  return <OfferingDetailContent offering={offering} />;
}
