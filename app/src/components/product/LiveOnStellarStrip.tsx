import { ExternalLink } from 'lucide-react';
import type { DeploymentConfig } from '../../lib/config';

type Props = {
  config: DeploymentConfig;
};

const CONTRACTS = (config: DeploymentConfig) =>
  [
    { label: 'Eligibility checker', id: config.policyVerifierId },
    { label: 'Eligibility registry', id: config.credentialRegistryId },
    { label: 'Treasury asset', id: config.rwaTokenId },
    { label: 'Asset adapter', id: config.rwaAdapterId },
    { label: 'Issuer registry', id: config.issuerRegistryId },
  ] as const;

export function LiveOnStellarStrip({ config }: Props) {
  return (
    <div className="rounded-2xl border border-[#012b54]/10 bg-[#012b54] p-5 text-white shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
          Live on Stellar testnet
        </p>
        <span className="text-xs text-white/70">Private eligibility layer</span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {CONTRACTS(config).map((c) => (
          <a
            key={c.label}
            href={`${config.explorerBaseUrl}/contract/${c.id}`}
            target="_blank"
            rel="noreferrer"
            className="group rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10 transition hover:bg-white/10"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-white/60">
                {c.label}
              </span>
              <ExternalLink className="h-3 w-3 text-white/40 group-hover:text-white/80" />
            </div>
            <p className="mt-1 truncate font-mono text-[10px] text-white/90">{c.id}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
