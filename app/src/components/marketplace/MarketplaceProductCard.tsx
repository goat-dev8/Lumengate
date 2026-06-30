import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Pill } from '../design/Primitives';
import type { LiveOffering } from '../../lib/offerings';
import { offeringCategoryLabel, offeringDesignImage } from '../../lib/offeringDisplay';

type Props = {
  offering: LiveOffering;
  selected?: boolean;
  onSubscribe?: () => void;
  subscribeLoading?: boolean;
  subscribeDisabled?: boolean;
  subscribeLabel?: string;
  children?: React.ReactNode;
};

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">{label}</p>
      <p
        className={`mt-0.5 text-sm font-semibold tabular-nums ${
          highlight ? 'text-[#007dfc]' : 'text-[#012b54]'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function MarketplaceProductCard({
  offering,
  selected,
  onSubscribe,
  subscribeLoading,
  subscribeDisabled,
  subscribeLabel = 'Subscribe',
  children,
}: Props) {
  const asset =
    offering.settlementAsset === 'usdc'
      ? 'USDC'
      : offering.settlementAsset === 'eurc'
        ? 'Private EURC'
      : offering.settlementRoute === 'dex'
        ? 'DEX'
        : offering.settlementRoute === 'payroll'
          ? 'XLM'
          : 'RWA';

  return (
    <motion.article
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={`group lg-surface-card overflow-hidden ${selected ? 'ring-2 ring-[#007dfc]' : ''}`}
    >
      <div className="relative h-44 overflow-hidden lg-gradient-passport">
        <img
          src={offeringDesignImage(offering)}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3.5">
          <Pill tone="brand" className="border-white/20 bg-white/85 backdrop-blur">
            {offeringCategoryLabel(offering)}
          </Pill>
          <span className="rounded-full bg-black/30 px-2.5 py-1 text-[11px] text-white backdrop-blur">
            {asset}
          </span>
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to={`/app/marketplace/${offering.id}`}>
              <h3 className="truncate text-base font-semibold tracking-tight text-[#012b54] transition group-hover:text-[#007dfc]">
                {offering.title}
              </h3>
            </Link>
            <p className="truncate text-xs text-[#64748b]">{offering.eligibilityPolicy}</p>
          </div>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-[#64748b] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>

        <p className="mt-3 line-clamp-2 text-sm text-[#64748b]">{offering.description}</p>
        {offering.settlementAsset === 'eurc' ? (
          <p className="mt-3 rounded-xl border border-[#007dfc]/15 bg-[#f6f9fc] px-3 py-2 text-xs leading-relaxed text-[#335b7e]">
            Private settlement available: EURC is shielded into the confidential wrapper before investment settlement.
          </p>
        ) : null}

        <div className="mt-5 grid grid-cols-4 gap-3 border-t border-[var(--lg-border)] pt-4">
          <Metric label="Min" value={offering.minimumAmount} highlight />
          <Metric label="Unit" value={offering.unitLabel} />
          <Metric label="Risk" value={offering.riskLevel} />
          <Metric label="Status" value={offering.offeringStatus} />
        </div>

        {children}

        {onSubscribe ? (
          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {offering.claims.slice(0, 2).map((c) => (
                <span
                  key={c}
                  className="rounded-md bg-[var(--lg-muted-bg)] px-2 py-0.5 text-[10.5px] font-medium text-[#64748b]"
                >
                  {c}
                </span>
              ))}
            </div>
            <button
              type="button"
              disabled={subscribeDisabled || subscribeLoading}
              onClick={onSubscribe}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#007dfc] to-[#0056b3] px-3.5 py-1.5 text-xs font-medium text-white shadow-sm hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {subscribeLabel}
              <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
        ) : null}
      </div>
    </motion.article>
  );
}
