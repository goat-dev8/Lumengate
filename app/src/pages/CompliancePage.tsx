import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FileCheck2, ShieldCheck, Sparkles } from 'lucide-react';
import { AppPageLayout } from '../components/design/AppPageLayout';
import { ProofReceiptHero } from '../components/compliance/ProofReceiptHero';
import { SectionHeader, Stagger, StaggerItem } from '../components/design/Primitives';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/States';
import { JourneyRail } from '../components/product/JourneyRail';
import { UnifiedTimeline, buildUnifiedTimeline } from '../components/product/UnifiedTimeline';
import { UsdcCompliancePanel } from '../components/product/UsdcCompliancePanel';
import { buildUserJourney } from '../lib/journey';
import { proofMatchesCredential } from '../lib/credentialProof';
import { disclosurePackFilename } from '../lib/disclosure';
import { storeDisclosurePack } from '../lib/disclosureApi';
import {
  auditorPackageFilename,
  buildAuditorPackage,
  generateViewingKey,
  loadViewingKeyForReceipt,
  persistViewingKeyForReceipt,
} from '../lib/viewingKey';
import { microcopy } from '../lib/microcopy';
import { ZkExplainerSection } from '../components/education/ZkExplainerSection';
import {
  SelectiveDisclosureDiagram,
  SELECTIVE_DISCLOSURE_TERMS,
} from '../components/education/diagrams/SelectiveDisclosureDiagram';
import {
  SettlementPrivacyDiagram,
  SETTLEMENT_PRIVACY_TERMS,
} from '../components/education/diagrams/SettlementPrivacyDiagram';
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
    settlementAddress,
    smartAccount,
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
  const [generateLoading, setGenerateLoading] = useState(false);
  const [storeMessage, setStoreMessage] = useState<string | null>(null);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [generatedViewingKey, setGeneratedViewingKey] = useState<string | null>(null);
  const [viewingKeyRevealed, setViewingKeyRevealed] = useState(false);
  const activeProof = proofMatchesCredential(proof, credential) ? proof : null;
  const settlementOwner = currentSettlementOwner(config, address, settlementAddress);
  const hasAccount = Boolean(settlementOwner || smartAccount);
  const activityTransfer = activity.find(
    (e) => e.kind === 'transfer' && e.status === 'success' && e.txHash,
  );
  const settlementTx =
    proofReceipt?.transactions.transfer ?? receiptTransactions.transfer ?? activityTransfer?.txHash;
  const hasReceipt = Boolean(settlementTx || transferResult || activityTransfer);
  const timeline = buildUnifiedTimeline(activity, proofReceipt);
  const journey = buildUserJourney({
    address,
    settlementAddress,
    credential,
    proof: activeProof,
    proofMatches: Boolean(activeProof),
    receipt: proofReceipt,
    replayBlocked,
  });

  useEffect(() => {
    if (!settlementTx) return;
    const saved = loadViewingKeyForReceipt(settlementTx);
    if (saved) setGeneratedViewingKey(saved);
  }, [settlementTx]);

  useEffect(() => {
    if (!hasAccount) return;
    if (proofReceipt || settlementTx || transferResult || (credential && proof)) {
      refreshProofReceipt().catch(() => undefined);
    }
  }, [
    hasAccount,
    credential,
    proof,
    proofReceipt,
    settlementTx,
    transferResult,
    refreshProofReceipt,
  ]);

  const setTab = (next: ReceiptTab) => {
    if (next === 'receipt') {
      searchParams.delete('tab');
    } else {
      searchParams.set('tab', next);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const handleReplay = async () => {
    if (!settlementOwner) return;
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
    if (!pack || !settlementOwner) return;
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = disclosurePackFilename(settlementOwner);
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAuditorPackage = () => {
    const pack = buildDisclosure();
    if (!pack || !settlementOwner) return;
    const key = generatedViewingKey ?? generateViewingKey();
    const auditorPackage = buildAuditorPackage({
      viewingKey: key,
      auditorId: config.auditorId,
      disclosure: pack,
      network: config.network,
    });
    const blob = new Blob([JSON.stringify(auditorPackage, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = auditorPackageFilename(settlementOwner);
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateViewingKey = async () => {
    const pack = buildDisclosure();
    if (!pack) {
      setStoreError('Complete passport, proof, and settlement before generating a viewing key.');
      return;
    }
    setGenerateLoading(true);
    setStoreError(null);
    setStoreMessage(null);
    try {
      const key = generateViewingKey();
      await storeDisclosurePack(config.issuerServiceUrl, key, config.auditorId, pack);
      setGeneratedViewingKey(key);
      setViewingKeyRevealed(true);
      if (settlementTx) persistViewingKeyForReceipt(settlementTx, key);
      setStoreMessage(
        'Viewing key generated and disclosure registered. Share the key or auditor package with your regulator.',
      );
    } catch (err) {
      setStoreError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerateLoading(false);
    }
  };

  const handleCopyViewingKey = async () => {
    if (!generatedViewingKey) return;
    await navigator.clipboard.writeText(generatedViewingKey);
    setStoreMessage('Viewing key copied to clipboard.');
    setStoreError(null);
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
                  {!hasAccount ? (
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
                  generatedViewingKey={generatedViewingKey}
                  viewingKeyRevealed={viewingKeyRevealed}
                  onToggleViewingKeyReveal={() => setViewingKeyRevealed((v) => !v)}
                  onGenerateViewingKey={handleGenerateViewingKey}
                  onCopyViewingKey={handleCopyViewingKey}
                  onDownloadDisclosure={handleDownloadDisclosure}
                  onDownloadAuditorPackage={handleDownloadAuditorPackage}
                  generateLoading={generateLoading}
                  storeMessage={storeMessage}
                  storeError={storeError}
                />
              ) : (
                <Card className="overflow-hidden border-emerald-100">
                  <div className="bg-[#012b54] px-6 py-8 text-white">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Settlement receipt</p>
                    <p className="mt-3 lg-font-display text-4xl tabular-nums">{transferResult?.amount ?? 'Completed'}</p>
                    <p className="mt-1 text-sm text-white/70">Indexing on-chain receipt…</p>
                  </div>
                  <div className="grid gap-4 bg-white p-6 text-sm text-[#475569] md:grid-cols-3">
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

              {proofReceipt ? (
                <>
                  <ZkExplainerSection
                    id="receipt-settlement-privacy"
                    eyebrow="What happened"
                    title="Settlement privacy on Stellar"
                    summary="Your eligibility attributes never left the browser. Stellar recorded the compliant transfer, scoped nullifier, and public proof inputs."
                    diagram={<SettlementPrivacyDiagram />}
                    terms={SETTLEMENT_PRIVACY_TERMS}
                  />
                  <ZkExplainerSection
                    id="receipt-selective-disclosure"
                    eyebrow="Selective disclosure"
                    title="How auditors verify without seeing your identity"
                    summary="A viewing key unlocks only eligibility claims and settlement references for this receipt — not your legal name, government ID, or passkey."
                    diagram={<SelectiveDisclosureDiagram />}
                    terms={SELECTIVE_DISCLOSURE_TERMS}
                    defaultOpen={Boolean(generatedViewingKey)}
                  />
                </>
              ) : null}
            </>
          )}

          {!proofReceipt && hasReceipt ? (
            <Card className="mt-8">
              <CardHeader title="Settlement timeline" description="What happened, in plain English." />
              <UnifiedTimeline items={timeline} />
            </Card>
          ) : null}

          <div className="mt-8">
            <JourneyRail steps={journey} compact />
          </div>
        </div>
      )}
      </AppPageLayout>
    </div>
  );
}
