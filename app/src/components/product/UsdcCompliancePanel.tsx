import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Badge } from '../ui/Badge';
import type { DeploymentConfig } from '../../lib/config';
import { fetchUsdcBalanceSnapshot, type UsdcBalanceSnapshot } from '../../lib/horizon';
import { truncateMiddle } from '../../lib/utils';

type Props = {
  config: DeploymentConfig;
  walletAddress: string | null;
  variant?: 'full' | 'compact';
};

export function UsdcCompliancePanel({ config, walletAddress, variant = 'full' }: Props) {
  const [snap, setSnap] = useState<UsdcBalanceSnapshot | null>(null);

  useEffect(() => {
    fetchUsdcBalanceSnapshot(config, walletAddress).then(setSnap).catch(() => undefined);
  }, [config, walletAddress]);

  if (!snap) return null;

  const sacUrl = `${config.explorerBaseUrl}/contract/${snap.sacId}`;

  return (
    <div className="rounded-2xl border border-[#007dfc]/15 bg-gradient-to-br from-[#f0f6ff] to-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
            Universal asset passport
          </p>
          <h3 className="mt-1 text-lg font-semibold text-[#012b54]">USDC on Stellar</h3>
          <p className="mt-1 max-w-xl text-sm text-[#475569]">{snap.note}</p>
        </div>
        <Badge tone={snap.complianceAdminConfigured ? 'ok' : 'warn'}>
          {snap.complianceAdminConfigured ? 'SAC admin configured' : 'SAC admin pending deploy'}
        </Badge>
      </div>

      <dl className={`mt-4 grid gap-3 ${variant === 'full' ? 'md:grid-cols-2' : ''}`}>
        <div className="rounded-xl bg-white/80 p-3 ring-1 ring-[#e3e8ee]">
          <dt className="text-[10px] font-semibold uppercase text-[#64748b]">{snap.assetCode} issuer</dt>
          <dd className="mt-1 break-all font-mono text-xs text-[#012b54]">{snap.issuer}</dd>
        </div>
        <div className="rounded-xl bg-white/80 p-3 ring-1 ring-[#e3e8ee]">
          <dt className="text-[10px] font-semibold uppercase text-[#64748b]">USDC SAC (SEP-41)</dt>
          <dd className="mt-1 break-all font-mono text-xs text-[#012b54]">{snap.sacId}</dd>
          <a
            href={sacUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#007dfc] hover:underline"
          >
            Stellar Expert <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        {walletAddress ? (
          <div className="rounded-xl bg-white/80 p-3 ring-1 ring-[#e3e8ee] md:col-span-2">
            <dt className="text-[10px] font-semibold uppercase text-[#64748b]">Balances for {truncateMiddle(walletAddress, 6, 4)}</dt>
            <dd className="mt-2 space-y-1 text-sm font-medium text-[#012b54]">
              <div>
                SAC (RPC): {snap.sacBalance !== null ? `${snap.sacBalance} ${snap.assetCode}` : '—'}
              </div>
              <div>
                Classic trustline:{' '}
                {snap.trustlineExists
                  ? `${snap.classicBalance} ${snap.assetCode}`
                  : `No trustline — add issuer ${truncateMiddle(snap.issuer, 6, 4)} in wallet`}
              </div>
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
