import { AppShell } from '../components/layout/Shell';
import { Card, CardHeader } from '../components/ui/Card';
import { PageHeader } from '../components/fintech/PageHeader';
import { UnifiedTimeline, buildUnifiedTimeline } from '../components/product/UnifiedTimeline';
import { UsdcCompliancePanel } from '../components/product/UsdcCompliancePanel';
import { useApp } from '../context/AppContext';
import { currentSettlementOwner } from '../lib/settlementOwner';

export function ActivityPage() {
  const { activity, config, proofReceipt, address } = useApp();
  const settlementOwner = currentSettlementOwner(config, address);
  const sessionItems = buildUnifiedTimeline(activity, proofReceipt);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Activity"
        title="Compliance & settlement timeline"
        subtitle="Credential, proof, transfer, chain events, and replay evidence — linked to Stellar Expert."
      />

      <Card className="mb-6">
        <CardHeader title="Session timeline" description="Your wallet session events from live chain activity" />
        <UnifiedTimeline
          items={sessionItems}
          emptyMessage="No session events yet — connect wallet and complete settlement in Marketplace or Transfer."
        />
      </Card>

      <UsdcCompliancePanel config={config} walletAddress={settlementOwner} variant="compact" />
    </AppShell>
  );
}
