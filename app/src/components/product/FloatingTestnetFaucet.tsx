import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Coins, Droplets, Sparkles, X } from 'lucide-react';
import type { DeploymentConfig, FaucetAssetStatus } from '../../lib/config';
import { fetchFaucetStatus } from '../../lib/config';
import { TestnetFaucetPanel } from './TestnetFaucetPanel';
import { cn } from '../../lib/cn';

type Props = {
  config: DeploymentConfig;
  smartAccountAddress: string;
  onClaimed?: () => void;
};

function formatCountdown(nextClaimAt: number | null): string {
  if (!nextClaimAt) return 'Available now';
  const ms = nextClaimAt - Date.now();
  if (ms <= 0) return 'Available now';
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.ceil((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `Next in ~${hours}h`;
  return `Next in ~${minutes}m`;
}

const TOKEN_ICONS = ['USDC', 'EURC', 'XLM'] as const;

export function FloatingTestnetFaucet({ config, smartAccountAddress, onClaimed }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [assets, setAssets] = useState<Record<string, FaucetAssetStatus>>({});

  const refresh = useCallback(async () => {
    const status = await fetchFaucetStatus(config.issuerServiceUrl, smartAccountAddress);
    setAssets(status.assets);
  }, [config.issuerServiceUrl, smartAccountAddress]);

  useEffect(() => {
    refresh().catch(() => undefined);
    const interval = window.setInterval(() => {
      refresh().catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  if (config.network !== 'testnet') return null;

  const usdcAvailable = assets.usdc?.available ?? true;
  const countdown = formatCountdown(assets.usdc?.nextClaimAt ?? null);
  const anyAvailable = Object.values(assets).some((a) => a?.available);

  return (
    <div
      className="pointer-events-none fixed bottom-6 right-4 z-[60] flex max-w-[calc(100vw-2rem)] flex-col items-end sm:right-6"
      aria-live="polite"
    >
      <AnimatePresence mode="wait">
        {expanded ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="pointer-events-auto w-[min(100vw-2rem,24rem)] overflow-hidden rounded-2xl border border-[#007dfc]/30 bg-white/95 shadow-[0_24px_80px_rgba(0,125,252,0.25)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-[#007dfc]/15 bg-gradient-to-r from-[#007dfc]/10 to-transparent px-4 py-3">
              <div className="flex items-center gap-2">
                <Droplets className="h-4 w-4 text-[#007dfc]" />
                <p className="text-sm font-semibold text-[#012b54]">Testnet faucet</p>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-[#64748b] transition hover:bg-[#f6f9fc] hover:text-[#012b54]"
                aria-label="Close faucet"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[min(70vh,32rem)] overflow-y-auto p-1">
              <TestnetFaucetPanel
                config={config}
                smartAccountAddress={smartAccountAddress}
                prominent
                embedded
                onClaimed={() => {
                  refresh().catch(() => undefined);
                  onClaimed?.();
                }}
              />
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="collapsed"
            type="button"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            onClick={() => setExpanded(true)}
            className={cn(
              'pointer-events-auto group relative w-[min(100vw-2rem,17rem)] overflow-hidden rounded-2xl border border-[#007dfc]/40 p-4 text-left',
              'bg-gradient-to-br from-[#007dfc] via-[#0066d4] to-[#012b54] text-white',
              'shadow-[0_0_0_1px_rgba(0,125,252,0.3),0_12px_40px_rgba(0,125,252,0.45)]',
              'transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_0_0_1px_rgba(0,125,252,0.5),0_20px_50px_rgba(0,125,252,0.55)]',
            )}
          >
            <motion.span
              className="pointer-events-none absolute inset-0 rounded-2xl bg-[#5eb0ff]/20"
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden
            />
            <motion.span
              className="pointer-events-none absolute -inset-1 rounded-3xl bg-[#007dfc]/30 blur-xl"
              animate={{ opacity: [0.4, 0.75, 0.4], scale: [1, 1.05, 1] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden
            />

            <div className="relative">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 backdrop-blur-sm">
                    <Coins className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">Testnet</p>
                    <p className="text-sm font-semibold leading-tight">Claim free test tokens</p>
                  </div>
                </div>
                <Sparkles className="h-4 w-4 shrink-0 text-[#5eb0ff]" />
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {TOKEN_ICONS.map((token) => (
                  <span
                    key={token}
                    className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  >
                    {token}
                  </span>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-medium',
                    usdcAvailable || anyAvailable
                      ? 'bg-emerald-400/20 text-emerald-100'
                      : 'bg-white/10 text-white/80',
                  )}
                >
                  {usdcAvailable || anyAvailable ? 'Ready to claim' : countdown}
                </span>
                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-white/90">
                  Expand
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:translate-y-0.5" />
                </span>
              </div>
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
