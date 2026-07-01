import { useScrollReveal } from '../../hooks/useScrollReveal';
import { cn } from '../../lib/cn';
import { ConfidentialAssetLifecycleDiagram } from './ConfidentialAssetLifecycleDiagram';

const ASSETS: { key: 'eurc' | 'usdc'; name: string }[] = [
  { key: 'eurc', name: 'Confidential EURC' },
  { key: 'usdc', name: 'Confidential USDC' },
];

export function ConfidentialAssetsSection() {
  const { ref, visible } = useScrollReveal();

  return (
    <div ref={ref} className={cn('lg-reveal space-y-10', visible && 'lg-revealed')}>
      <p className="mx-auto max-w-2xl text-center text-sm leading-relaxed text-[#64748b]">
        Both wrappers share the same <code className="font-mono text-[#012b54]">ConfidentialAssetConfig</code> client
        code and <code className="font-mono text-[#012b54]">LumengateConfidentialToken</code> /{' '}
        <code className="font-mono text-[#012b54]">LumengateConfidentialPolicy</code> contracts — selected by asset,
        not duplicated per asset.
      </p>
      {ASSETS.map((asset, i) => (
        <div
          key={asset.key}
          className="lg-card-reveal rounded-[28px] border border-[#eef0f3] bg-[#fafbfd] p-6 md:p-8"
          style={{ transitionDelay: visible ? `${i * 0.12}s` : '0s' }}
        >
          <h3 className="text-lg font-semibold text-[#012b54]">{asset.name}</h3>
          <div className="mt-4">
            <ConfidentialAssetLifecycleDiagram assetKey={asset.key} />
          </div>
        </div>
      ))}
    </div>
  );
}
