import { ExternalLink, Zap, Shield, Snowflake } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { cn } from '../../lib/cn';
import { explorerTxUrl } from '../../lib/utils';

type MetricsShowcaseProps = {
  verifyTx: string;
  transferTx: string;
  freezeTx: string;
  network: string;
  explorerBaseUrl: string;
};

export function MetricsShowcase({ verifyTx, transferTx, freezeTx, network, explorerBaseUrl }: MetricsShowcaseProps) {
  const { ref, visible } = useScrollReveal();

  const metrics = [
    { icon: Zap, label: 'BN254 verify', hash: verifyTx, desc: 'PolicyVerifier on-chain' },
    { icon: Shield, label: 'Eligible transfer', hash: transferTx, desc: 'Proof-gated RWA settlement' },
    { icon: Snowflake, label: 'Freeze enforcement', hash: freezeTx, desc: 'CAP-77 compliance narrative' },
  ];

  return (
    <div ref={ref} className={cn('lg-reveal lg-metrics-grid', visible && 'lg-revealed')}>
      {metrics.map((m, i) => (
        <div
          key={m.label}
          className="lg-metric-card lg-card-reveal"
          style={{ transitionDelay: visible ? `${i * 0.1}s` : '0s' }}
        >
          <m.icon className="h-7 w-7 text-[#007dfc]" />
          <div className="mt-4 text-base font-semibold text-[#012b54]">{m.label}</div>
          <p className="mt-1 text-sm text-[#64748b]">{m.desc}</p>
          {m.hash ? (
            <a
              href={explorerTxUrl(explorerBaseUrl, m.hash)}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 font-mono text-xs text-[#007dfc] hover:underline"
            >
              {m.hash.slice(0, 16)}…
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <p className="mt-4 text-xs text-[#64748b]">Recorded after on-chain transfer</p>
          )}
        </div>
      ))}
      <div
        className="lg-metric-card lg-card-reveal md:col-span-3 flex flex-wrap items-center justify-between gap-4 bg-[#f0f6ff]"
        style={{ transitionDelay: visible ? '0.3s' : '0s' }}
      >
        <div>
          <div className="text-sm font-semibold text-[#012b54]">Live network</div>
          <div className="mt-1 text-2xl font-semibold capitalize text-[#007dfc]">{network}</div>
        </div>
        <div className="lg-verify-pulse text-base">
          <span className="lg-verify-dot" />
          Real testnet evidence — not simulated metrics
        </div>
      </div>
    </div>
  );
}
