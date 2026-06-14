import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Shield } from 'lucide-react';
import { AppShell } from '../components/layout/Shell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState, Skeleton } from '../components/ui/States';
import { BrandFlowDiagram } from '../components/fintech/BrandFlowDiagram';
import { PassportHeroCard } from '../components/fintech/PassportHeroCard';
import { useApp } from '../context/AppContext';
import { fetchIssuerMetadata } from '../lib/config';
import { buildPassportSnapshot, type PassportSnapshot } from '../lib/passport';
import { JourneyRail } from '../components/product/JourneyRail';
import { CrossChainEvidencePanel } from '../components/product/CrossChainEvidencePanel';
import { buildUserJourney } from '../lib/journey';
import { proofMatchesCredential } from '../lib/credentialProof';
import { nullifierHexFromBundle, readNullifierSpent } from '../lib/contracts';
import { policyByKey } from '../lib/policies';

function statusLabel(status: PassportSnapshot['status'], hasAddress: boolean, hasCredential: boolean) {
  if (hasAddress && status === 'no-wallet') {
    return hasCredential
      ? { text: 'Verified', tone: 'ok' as const }
      : { text: 'Not issued', tone: 'neutral' as const };
  }
  switch (status) {
    case 'valid':
    case 'proof-ready':
      return { text: 'Verified', tone: 'ok' as const };
    case 'proof-spent':
      return { text: 'Proof spent', tone: 'warn' as const };
    case 'expired':
    case 'roots-mismatch':
      return { text: 'Action required', tone: 'err' as const };
    case 'no-credential':
      return { text: 'Not issued', tone: 'neutral' as const };
    default:
      return { text: 'Connect wallet', tone: 'neutral' as const };
  }
}

export function PassportPage() {
  const {
    address,
    walletField,
    connect,
    connecting,
    credential,
    proof,
    policyKey,
    config,
    requestCredential,
    pushActivity,
    proofReceipt,
    replayBlocked,
  } = useApp();
  const [snapshot, setSnapshot] = useState<PassportSnapshot | null>(null);
  const [issuerLabel, setIssuerLabel] = useState('Stellar issuer');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeProof = proofMatchesCredential(proof, credential) ? proof : null;

  useEffect(() => {
    fetchIssuerMetadata(config.issuerServiceUrl)
      .then((meta) => {
        const short = meta.stellarPublicKey.slice(0, 4) + '…' + meta.stellarPublicKey.slice(-4);
        setIssuerLabel(`${meta.signatureScheme} issuer ${short} (ID ${meta.issuerId})`);
      })
      .catch(() => setIssuerLabel('Issuer metadata unavailable'));
  }, [config.issuerServiceUrl]);

  useEffect(() => {
    if (!address || !walletField) {
      setSnapshot(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setRefreshing(true);
      setError(null);
      try {
        let nullifierSpent = false;
        if (activeProof) {
          try {
            const pid = Number(activeProof.publicInputs.policyId);
            nullifierSpent = await readNullifierSpent(
              config,
              nullifierHexFromBundle(activeProof),
              pid,
            );
          } catch (err) {
            if (!cancelled) {
              setError(err instanceof Error ? err.message : String(err));
            }
          }
        }
        const snap = await buildPassportSnapshot({
          config,
          address,
          walletField,
          credential,
          proof: activeProof,
          policyKey,
          nullifierSpent,
        });
        if (!cancelled) setSnapshot(snap);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, walletField, credential, activeProof, policyKey, config]);

  const handleIssue = async () => {
    if (!address) {
      await connect();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await requestCredential(policyKey);
      pushActivity({
        kind: 'credential',
        title: 'Credential issued',
        detail: policyByKey(policyKey).title,
        status: 'success',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const status = snapshot
    ? statusLabel(snapshot.status, Boolean(address), Boolean(credential))
    : { text: 'Not issued', tone: 'neutral' as const };

  const journey = buildUserJourney({
    address,
    credential,
    proof: activeProof,
    proofMatches: Boolean(activeProof),
    receipt: proofReceipt,
    replayBlocked,
  });

  return (
    <AppShell>
      <div className="lg-section-head">
        <p className="lg-section-eyebrow">Digital compliance passport</p>
        <h1 className="lg-section-title text-2xl lg:text-3xl">
          {credential ? 'Your passport is active' : 'Issue your compliance passport'}
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[#475569]">
          Cross-chain credentials from an Ethereum issuer — verified on Stellar, used privately for RWA access.
        </p>
      </div>

      {!address ? (
        <EmptyState
          title="Connect your wallet"
          description="Your passport is bound to your Stellar wallet and persists across sessions."
          action={
            <Button loading={connecting} onClick={() => connect()}>
              Connect Wallet
            </Button>
          }
        />
      ) : refreshing && !snapshot ? (
        <Skeleton className="h-80 w-full rounded-2xl" />
      ) : (
        <div className="space-y-8">
          <PassportHeroCard
            issuer={issuerLabel}
            status={status}
            policy={policyByKey(policyKey).title}
            expiration={
              snapshot?.expiresAt
                ? new Date(snapshot.expiresAt).toLocaleDateString()
                : credential
                  ? '—'
                  : 'Not set'
            }
            wallet={address}
            claims={snapshot?.claims ?? []}
            hasCredential={Boolean(credential)}
          />

          {snapshot?.status === 'proof-spent' ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Your proof was used for settlement. Generate a new proof before your next investment.
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button loading={loading} onClick={handleIssue}>
              <Shield className="h-4 w-4" />
              {credential ? 'Refresh credential' : 'Issue credential'}
            </Button>
            {credential ? (
              <Link to="/app/prove">
                <Button variant="secondary">
                  <BadgeCheck className="h-4 w-4" />
                  {activeProof ? 'View proof' : 'Generate proof'}
                </Button>
              </Link>
            ) : null}
            <Link to="/app/marketplace">
              <Button variant="secondary">Invest with passport</Button>
            </Link>
          </div>
          {error ? <p className="text-sm text-status-err">{error}</p> : null}

          <CrossChainEvidencePanel
            credential={credential}
            walletAddress={address}
            rootsMatch={snapshot?.rootsMatch ?? false}
          />

          <JourneyRail steps={journey} compact />

          <Card className="overflow-hidden p-0">
            <div className="border-b border-slate-line px-6 py-4 lg:px-8">
              <h3 className="text-sm font-semibold text-[#012b54]">How your passport works</h3>
              <p className="mt-1 text-sm text-[#64748b]">
                Technical flow — Ethereum issuer to private Stellar settlement.
              </p>
            </div>
            <div className="fin-flow-panel m-6 lg:m-8">
              <BrandFlowDiagram variant="wide" animated />
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
