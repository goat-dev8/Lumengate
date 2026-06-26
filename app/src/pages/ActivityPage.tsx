import { FileCheck2, ShieldCheck, Sparkles } from 'lucide-react';
import { AppShell } from '../components/layout/Shell';
import { AppPageLayout } from '../components/design/AppPageLayout';
import { SectionHeader, Stagger, StaggerItem } from '../components/design/Primitives';
import { Card, CardHeader } from '../components/ui/Card';
import { UnifiedTimeline, buildUnifiedTimeline } from '../components/product/UnifiedTimeline';
import { UsdcCompliancePanel } from '../components/product/UsdcCompliancePanel';
import { useApp } from '../context/AppContext';
import { currentSettlementOwner } from '../lib/settlementOwner';

export function ActivityPage() {
  const { activity, config, proofReceipt, address, settlementAddress } = useApp();
  const settlementOwner = currentSettlementOwner(config, address, settlementAddress);
  const sessionItems = buildUnifiedTimeline(activity, proofReceipt);
  const successfulTransfers = activity.filter((e) => e.kind === 'transfer' && e.status === 'success').length;
  const proofEvents = activity.filter((e) => e.kind === 'proof' && e.status === 'success').length;
  const credentialEvents = activity.filter((e) => e.kind === 'credential' && e.status === 'success').length;

  return (
    <AppShell>
      <AppPageLayout
        title="Activity"
        subtitle="Compliance and settlement timeline from the current session."
      >
        <SectionHeader
          eyebrow="Ledger"
          title="Compliance & settlement timeline"
          description="Credential, proof, transfer, chain events, and replay evidence linked to live Stellar references."
        />

        <Stagger className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { label: 'Settlements', value: successfulTransfers, icon: FileCheck2 },
            { label: 'Proofs', value: proofEvents, icon: ShieldCheck },
            { label: 'Credentials', value: credentialEvents, icon: Sparkles },
          ].map(({ label, value, icon: Icon }) => (
            <StaggerItem key={label} className="lg-surface-card p-5">
              <Icon className="h-5 w-5 text-[#007dfc]" />
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">{label}</p>
              <p className="mt-1 lg-font-display text-4xl tracking-tight text-[#012b54]">{value}</p>
            </StaggerItem>
          ))}
        </Stagger>

        <Card className="mt-8">
          <CardHeader title="Session timeline" description="Your session events from live chain activity." />
          <UnifiedTimeline
            items={sessionItems}
            emptyMessage="No session events yet — create a passport and complete settlement in Marketplace or Send."
          />
        </Card>

        <div className="mt-8">
          <UsdcCompliancePanel config={config} walletAddress={settlementOwner} variant="compact" />
        </div>
      </AppPageLayout>
    </AppShell>
  );
}
