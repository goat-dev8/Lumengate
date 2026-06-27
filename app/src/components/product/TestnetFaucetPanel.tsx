import { useCallback, useEffect, useState } from 'react';
import { Droplets } from 'lucide-react';
import type { DeploymentConfig, FaucetAssetStatus } from '../../lib/config';
import { claimTestnetFaucet, fetchFaucetStatus } from '../../lib/config';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card, CardHeader } from '../ui/Card';
import { explorerTxUrl } from '../../lib/utils';

type AssetKey = 'usdc' | 'eurc' | 'xlm' | 'treasury';

const ASSET_ORDER: AssetKey[] = ['usdc', 'eurc', 'xlm', 'treasury'];

type Props = {
  config: DeploymentConfig;
  smartAccountAddress: string;
  onClaimed?: () => void;
  /** Onboarding — highlight USDC claim and expand panel */
  prominent?: boolean;
  /** Render without outer Card — for floating drawer */
  embedded?: boolean;
};

function formatCountdown(nextClaimAt: number | null): string {
  if (!nextClaimAt) return 'Available now';
  const ms = nextClaimAt - Date.now();
  if (ms <= 0) return 'Available now';
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  return `Next claim in ~${hours}h`;
}

export function TestnetFaucetPanel({ config, smartAccountAddress, onClaimed, prominent = false, embedded = false }: Props) {
  const [assets, setAssets] = useState<Record<string, FaucetAssetStatus>>({});
  const [loadingAsset, setLoadingAsset] = useState<AssetKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const status = await fetchFaucetStatus(config.issuerServiceUrl, smartAccountAddress);
    setAssets(status.assets);
  }, [config.issuerServiceUrl, smartAccountAddress]);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  const handleClaim = async (asset: AssetKey) => {
    setLoadingAsset(asset);
    setError(null);
    setLastTx(null);
    try {
      const result = await claimTestnetFaucet(config.issuerServiceUrl, smartAccountAddress, asset);
      setLastTx(result.txHash);
      await refresh();
      onClaimed?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingAsset(null);
    }
  };

  if (config.network !== 'testnet') return null;

  const inner = (
    <>
      {!embedded ? (
        <CardHeader
          title={prominent ? 'Claim free testnet funds' : 'Testnet faucet'}
          badge={<Badge tone="brand">{prominent ? 'Recommended next step' : 'Once per 24h'}</Badge>}
        />
      ) : null}
      {!embedded ? (
        <p className="text-sm text-slate-muted">
          {prominent
            ? 'Start with demo USDC on your new smart account — real on-chain testnet tokens, no wallet required.'
            : 'Real on-chain testnet funds from the Lumengate treasury admin — one claim per asset every 24 hours.'}{' '}
          {!prominent ? (
            <>
              EURC is Lumengate testnet SAC (issuer {config.eurcIssuer?.slice(0, 8)}…), not Circle mainnet EURC.
              Treasury units here are for trying Send; marketplace investments still mint production-position units.
            </>
          ) : null}
        </p>
      ) : (
        <p className="px-4 pt-3 text-sm text-slate-muted">
          Real on-chain testnet funds — one claim per asset every 24 hours.
        </p>
      )}
      {prominent ? (
        <div className={`flex flex-wrap gap-3 ${embedded ? 'px-4' : ''} mt-4`}>
          <Button
            loading={loadingAsset === 'usdc'}
            disabled={!assets.usdc?.available || loadingAsset !== null}
            onClick={() => handleClaim('usdc')}
          >
            <Droplets className="h-4 w-4" />
            Claim demo USDC
          </Button>
          <p className="self-center text-xs text-slate-muted">
            {assets.usdc ? formatCountdown(assets.usdc.nextClaimAt) : 'Checking availability…'}
          </p>
        </div>
      ) : null}
      <div className={`mt-4 grid gap-2 sm:grid-cols-2 ${prominent ? 'border-t border-[var(--lg-border)] pt-4' : ''} ${embedded ? 'px-4 pb-4' : ''}`}>
        {(prominent ? ASSET_ORDER.filter((a) => a !== 'usdc') : ASSET_ORDER).map((asset) => {
          const row = assets[asset];
          const disabled = !row?.available || loadingAsset !== null;
          return (
            <div
              key={asset}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--lg-border)] bg-white px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-semibold uppercase text-navy">{asset}</p>
                <p className="text-xs text-slate-muted">{row?.label ?? '…'}</p>
                <p className="text-[11px] text-slate-muted">{formatCountdown(row?.nextClaimAt ?? null)}</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={disabled}
                loading={loadingAsset === asset}
                onClick={() => handleClaim(asset)}
              >
                <Droplets className="h-3.5 w-3.5" />
                Claim
              </Button>
            </div>
          );
        })}
      </div>
      {lastTx ? (
        <a
          href={explorerTxUrl(config.explorerBaseUrl, lastTx)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block text-xs font-medium text-brand hover:underline"
        >
          View last claim on Stellar Expert
        </a>
      ) : null}
      {error ? <p className={`mt-3 text-sm text-red-600 ${embedded ? 'px-4 pb-2' : ''}`}>{error}</p> : null}
    </>
  );

  if (embedded) {
    return <div id={prominent ? 'onboarding-faucet' : undefined}>{inner}</div>;
  }

  return (
    <div id={prominent ? 'onboarding-faucet' : undefined}>
      <Card
        className={prominent ? 'border-[#007dfc]/40 bg-gradient-to-br from-[#007dfc]/10 to-white ring-1 ring-[#007dfc]/20' : 'border-brand-200/60 bg-brand-50/30'}
      >
        {inner}
      </Card>
    </div>
  );
}
