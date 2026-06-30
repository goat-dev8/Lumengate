import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Droplets, ExternalLink } from 'lucide-react';
import type { DeploymentConfig, FaucetAssetStatus } from '../../lib/config';
import { claimTestnetFaucet, fetchFaucetStatus } from '../../lib/config';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card, CardHeader } from '../ui/Card';
import { explorerTxUrl } from '../../lib/utils';
import { cn } from '../../lib/cn';

type AssetKey = 'usdc' | 'eurc' | 'xlm' | 'treasury';

const ASSET_META: Record<
  AssetKey,
  { label: string; subtitle: string; accent: string }
> = {
  usdc: {
    label: 'USDC',
    subtitle: 'SEP-41 stablecoin for Send & Marketplace',
    accent: 'from-[#007dfc]/15 to-[#007dfc]/5 border-[#007dfc]/20',
  },
  eurc: {
    label: 'EURC',
    subtitle: 'Euro stablecoin on Lumengate testnet',
    accent: 'from-indigo-500/10 to-indigo-500/5 border-indigo-200/60',
  },
  xlm: {
    label: 'XLM',
    subtitle: 'Network reserve for transaction fees',
    accent: 'from-slate-500/10 to-slate-500/5 border-slate-200/60',
  },
  treasury: {
    label: 'Treasury units',
    subtitle: 'Position tokens for Send flow testing',
    accent: 'from-emerald-500/10 to-emerald-500/5 border-emerald-200/60',
  },
};

const ASSET_ORDER: AssetKey[] = ['usdc', 'eurc', 'xlm', 'treasury'];

type Props = {
  config: DeploymentConfig;
  smartAccountAddress: string;
  onClaimed?: () => void;
  prominent?: boolean;
  embedded?: boolean;
};

function formatCountdown(nextClaimAt: number | null): string {
  if (!nextClaimAt) return 'Available now';
  const ms = nextClaimAt - Date.now();
  if (ms <= 0) return 'Available now';
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.ceil((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `Available in ~${hours}h`;
  return `Available in ~${minutes}m`;
}

export function TestnetFaucetPanel({
  config,
  smartAccountAddress,
  onClaimed,
  prominent = false,
  embedded = false,
}: Props) {
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
      setAssets((prev) => ({
        ...prev,
        [asset]: {
          amount: prev[asset]?.amount ?? '',
          label: prev[asset]?.label ?? ASSET_META[asset].label,
          available: false,
          nextClaimAt: result.nextClaimAt,
          lastClaimAt: Date.now(),
        },
      }));
      try {
        await refresh();
      } catch {
        // Claim succeeded; status refresh can fail transiently on cold Render — do not show as claim error.
      }
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
          title="Stellar testnet faucet"
          badge={<Badge tone="brand">Once per 24 hours</Badge>}
        />
      ) : null}

      <p className={cn('text-sm leading-relaxed text-[#64748b]', embedded ? 'px-4 pt-3' : '')}>
        Request on-chain testnet funds to your smart account. One claim per asset every 24 hours — issued directly
        from the Lumengate treasury on Stellar testnet.
      </p>

      <div className={cn('mt-5 grid gap-3', embedded ? 'px-4' : '', prominent ? 'sm:grid-cols-2' : 'sm:grid-cols-2')}>
        {ASSET_ORDER.map((asset, index) => {
          const row = assets[asset];
          const meta = ASSET_META[asset];
          const disabled = !row?.available || loadingAsset !== null;
          const available = row?.available ?? false;
          const countdown = formatCountdown(row?.nextClaimAt ?? null);

          return (
            <motion.div
              key={asset}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
              className={cn(
                'flex flex-col justify-between gap-4 rounded-xl border bg-gradient-to-br p-4',
                meta.accent,
                !available && 'opacity-75',
              )}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-[#012b54]">{meta.label}</p>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      available ? 'bg-emerald-500/15 text-emerald-700' : 'bg-slate-500/10 text-slate-600',
                    )}
                  >
                    {available ? 'Ready' : 'Cooldown'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#64748b]">{meta.subtitle}</p>
                <p className="mt-2 text-sm font-medium tabular-nums text-[#012b54]">
                  {row?.label ?? 'Checking…'}
                </p>
                <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#64748b]">
                  <Clock className="h-3 w-3" />
                  {countdown}
                </p>
              </div>
              <Button
                size="sm"
                variant={asset === 'usdc' && prominent ? 'primary' : 'secondary'}
                disabled={disabled}
                loading={loadingAsset === asset}
                onClick={() => handleClaim(asset)}
                className="w-full"
              >
                <Droplets className="h-3.5 w-3.5" />
                Claim {meta.label}
              </Button>
            </motion.div>
          );
        })}
      </div>

      {lastTx ? (
        <a
          href={explorerTxUrl(config.explorerBaseUrl, lastTx)}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-[#007dfc] hover:underline',
            embedded ? 'px-4' : '',
          )}
        >
          View last transfer on Stellar Expert
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
      {error ? (
        <p className={cn('mt-3 text-sm text-red-600', embedded ? 'px-4 pb-2' : '')}>{error}</p>
      ) : null}
    </>
  );

  if (embedded) {
    return <div id={prominent ? 'onboarding-faucet' : undefined}>{inner}</div>;
  }

  return (
    <div id={prominent ? 'onboarding-faucet' : undefined}>
      <Card className="border-[#007dfc]/20 bg-gradient-to-br from-white to-[#f6f9fc]">
        {inner}
      </Card>
    </div>
  );
}
