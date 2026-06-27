import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, FileCheck2, Share2, Shield, ShieldCheck, Sparkles } from 'lucide-react';
import { AppPageLayout } from '../components/design/AppPageLayout';
import { ProofReceiptHero } from '../components/compliance/ProofReceiptHero';
import { SectionHeader, Stagger, StaggerItem } from '../components/design/Primitives';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/States';
import { JourneyRail } from '../components/product/JourneyRail';
import { UnifiedTimeline, buildUnifiedTimeline } from '../components/product/UnifiedTimeline';
import { UsdcCompliancePanel } from '../components/product/UsdcCompliancePanel';
import { buildUserJourney } from '../lib/journey';
import { proofMatchesCredential } from '../lib/credentialProof';
import { disclosurePackFilename } from '../lib/disclosure';
import { storeDisclosurePack } from '../lib/disclosureApi';
import { microcopy } from '../lib/microcopy';
import { useApp } from '../context/AppContext';
import { currentSettlementOwner } from '../lib/settlementOwner';
import { cn } from '../lib/cn';

type ReceiptTab = 'receipt' | 'activity';

function TabBar({ tab, onTab }: { tab: ReceiptTab; onTab: (t: ReceiptTab) => void }) {
  const items: { id: ReceiptTab; label: string }[] = [
    { id: 'receipt', label: 'Receipt' },
    { id: 'activity', label: 'Activity' },
  ];
  return (
    <div className="flex gap-1 rounded-xl border border-[var(--lg-border)] bg-[var(--lg-muted-bg)] p-1" role="tablist">
      {items.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          onClick={() => onTab(id)}
          className={cn(
            'flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition',
            tab === id ? 'bg-white text-[#012b54] shadow-sm' : 'text-[#64748b] hover:text-[#012b54]',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ActivityTabContent() {
  const { activity, config, proofReceipt, address, settlementAddress } = useApp();
  const settlementOwner = currentSettlementOwner(config, address, settlementAddress);
  const sessionItems = buildUnifiedTimeline(activity, proofReceipt);
  const successfulTransfers = activity.filter((e) => e.kind === 'transfer' && e.status === 'success').length;
  const proofEvents = activity.filter((e) => e.kind === 'proof' && e.status === 'success').length;
  const credentialEvents = activity.filter((e) => e.kind === 'credential' && e.status === 'success').length;

  return (
    <>
      <SectionHeader
        eyebrow="Ledger"
        title="Compliance & settlement timeline"
        description="Credential, proof, transfer, and chain events linked to live Stellar references."
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
    </>
  );
}

export function CompliancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: ReceiptTab = tabParam === 'activity' ? 'activity' : 'receipt';

  const {
    proofReceipt,
    receiptLoading,
    refreshProofReceipt,
    verifyDuplicateBlock,
    address,
    proof,
    credential,
    activity,
    replayBlocked,
    config,
    transferResult,
    receiptTransactions,
    buildDisclosure,
  } = useApp();
  const [replayLoading, setReplayLoading] = useState(false);
  const [storeLoading, setStoreLoading] = useState(false);
  const [storeMessage, setStoreMessage] = useState<string | null>(null);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [viewingKey, setViewingKey] = useState('');
  const activeProof = proofMatchesCredential(proof, credential) ? proof : null;
  const settlementTx = proofReceipt?.transactions.transfer ?? receiptTransactions.transfer;
  const hasReceipt = Boolean(settlementTx || transferResult);
  const timeline = buildUnifiedTimeline(activity, proofReceipt);
  const journey = buildUserJourney({
    address,
    credential,
    proof: activeProof,
    proofMatches: Boolean(activeProof),
    receipt: proofReceipt,
    replayBlocked,
  });

  useEffect(() => {
    if (address && (proofReceipt || settlementTx || (credential && proof))) {
      refreshProofReceipt().catch(() => undefined);
    }
  }, [address, credential, proof, proofReceipt, settlementTx, refreshProofReceipt]);

  const setTab = (next: ReceiptTab) => {
    if (next === 'receipt') {
      searchParams.delete('tab');
    } else {
      searchParams.set('tab', next);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const handleReplay = async () => {
    if (!address) return;
    setReplayLoading(true);
    try {
      const recipient = config.marketplaceSettlementAddress;
      const amount =
        transferResult?.amount ||
        activity.find((e) => e.kind === 'transfer' && e.detail)?.detail.match(/^(\d+)/)?.[1] ||
        '1';
      await verifyDuplicateBlock(recipient, amount);
      await refreshProofReceipt();
    } finally {
      setReplayLoading(false);
    }
  };

  const handleDownloadDisclosure = () => {
    const pack = buildDisclosure();
    if (!pack || !address) return;
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = disclosurePackFilename(address);
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleStoreDisclosure = async () => {
    if (!viewingKey.trim()) {
      setStoreError('Enter the auditor viewing key registered on AuditorRegistry.');
      return;
    }
    const pack = buildDisclosure();
    if (!pack) {
      setStoreError('Complete passport, proof, and settlement before storing a disclosure pack.');
      return;
    }
    setStoreLoading(true);
    setStoreError(null);
    setStoreMessage(null);
    try {
      await storeDisclosurePack(config.issuerServiceUrl, viewingKey.trim(), config.auditorId, pack);
      setStoreMessage('Disclosure stored — auditor can query with viewing key on /app/auditor.');
    } catch (err) {
      setStoreError(err instanceof Error ? err.message : String(err));
    } finally {
      setStoreLoading(false);
    }
  };

  return (
    <div className="compliance-print-root">
      <AppPageLayout
        title="Receipts"
        subtitle={microcopy.receipt.subtitle}
        width="6xl"
      >
      <TabBar tab={tab} onTab={setTab} />

      {tab === 'activity' ? (
        <div className="mt-8" role="tabpanel">
          <ActivityTabContent />
        </div>
      ) : (
        <div className="mt-8" role="tabpanel">
          {!hasReceipt ? (
            <EmptyState
              title="No receipt yet"
              description={microcopy.receipt.empty}
              action={
                <div className="flex flex-wrap justify-center gap-3">
                  {!address ? (
                    <Link to="/app/welcome">
                      <Button>Create account</Button>
                    </Link>
                  ) : !credential ? (
                    <Link to="/app/verify">
                      <Button>Get passport</Button>
                    </Link>
                  ) : !proof ? (
                    <Link to="/app/verify">
                      <Button>Confirm eligibility</Button>
                    </Link>
                  ) : (
                    <Link to="/app/marketplace">
                      <Button>Invest now</Button>
                    </Link>
                  )}
                </div>
              }
            />
          ) : (
            <>
              {proofReceipt ? (
                <ProofReceiptHero
                  receipt={proofReceipt}
                  loading={receiptLoading}
                  onRefresh={() => refreshProofReceipt()}
                  onVerifyDuplicate={proofReceipt.nullifierSpent ? handleReplay : undefined}
                  replayLoading={replayLoading}
                />
              ) : (
                <Card className="border-emerald-100 bg-emerald-50/40">
                  <CardHeader title="Settlement complete" badge={<Badge tone="ok">Compliant</Badge>} />
                  <div className="grid gap-4 text-sm text-[#475569] md:grid-cols-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider">Amount</p>
                      <p className="mt-1 text-lg font-semibold text-navy">{transferResult?.amount ?? 'Completed'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider">Recipient</p>
                      <p className="mt-1 font-mono text-xs text-navy">{transferResult?.to ?? 'Recorded on Stellar'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider">Reference</p>
                      <p className="mt-1 font-mono text-xs text-navy">{settlementTx ?? 'Pending index'}</p>
                    </div>
                  </div>
                </Card>
              )}

              <Card className="mt-8">
                <CardHeader
                  title="Selective disclosure"
                  description="Share only what an auditor needs: policy satisfied, settlement reference, and timestamp."
                  badge={<Badge tone="brand">Auditor ready</Badge>}
                />
                <label className="mb-4 block">
                  <span className="text-sm text-[#64748b]">Auditor access key</span>
                  <input
                    type="password"
                    className="mt-2 w-full max-w-md rounded-xl border border-[#e3e8ee] px-3 py-2 font-mono text-xs outline-none focus:border-[#007dfc]"
                    value={viewingKey}
                    onChange={(e) => setViewingKey(e.target.value)}
                    aria-label="Auditor access key"
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={handleDownloadDisclosure}>
                    <Download className="h-4 w-4" />
                    {microcopy.receipt.download}
                  </Button>
                  <Button loading={storeLoading} onClick={handleStoreDisclosure}>
                    <Share2 className="h-4 w-4" />
                    Share with auditor
                  </Button>
                  <Link to="/app/auditor">
                    <Button variant="secondary">
                      <Shield className="h-4 w-4" />
                      Open auditor portal
                    </Button>
                  </Link>
                </div>
                {storeMessage ? <p className="mt-4 text-sm text-status-ok">{storeMessage}</p> : null}
                {storeError ? <p className="mt-4 text-sm text-status-err">{storeError}</p> : null}
              </Card>
            </>
          )}

          <Card className="mt-8">
            <CardHeader title="Settlement timeline" description="What happened, in plain English." />
            <UnifiedTimeline items={timeline} />
          </Card>

          <div className="mt-8">
            <JourneyRail steps={journey} compact />
          </div>
        </div>
      )}
      </AppPageLayout>
    </div>
  );
}
