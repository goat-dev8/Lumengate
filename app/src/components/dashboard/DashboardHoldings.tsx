import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SectionHeader } from '../design/Primitives';
import { OfferingIllustration } from '../fintech/OfferingIllustration';
import { Skeleton } from '../ui/States';
import type { DeploymentConfig } from '../../lib/config';
import type { ActivityEntry } from '../../lib/activity';
import type { LiveOffering } from '../../lib/offerings';
import { offeringCategoryLabel } from '../../lib/offeringDisplay';
import { readBalance, readComplianceAdminUsdcBalance } from '../../lib/contracts';
import { allocationFromActivity } from '../../lib/portfolio';

type Props = {
  config: DeploymentConfig;
  settlementOwner: string | null;
  activity: ActivityEntry[];
  offerings: LiveOffering[];
};

type HoldingRow = {
  id: string;
  label: string;
  subtitle: string;
  value: string;
  risk: string | null;
  offering?: LiveOffering;
};

export function DashboardHoldings({ config, settlementOwner, activity, offerings }: Props) {
  const [rwaBalance, setRwaBalance] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!settlementOwner) {
      setRwaBalance(null);
      setUsdcBalance(null);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([
      readBalance(config, settlementOwner).catch(() => null),
      config.complianceSacAdminId
        ? readComplianceAdminUsdcBalance(config, settlementOwner)
            .then((s) => s.formatted)
            .catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([rwa, usdc]) => {
        setRwaBalance(rwa);
        setUsdcBalance(usdc);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, [config, settlementOwner, activity]);

  const rows = useMemo((): HoldingRow[] => {
    const out: HoldingRow[] = [];
    const totalRwa = BigInt(rwaBalance ?? '0');

    const slices = allocationFromActivity(activity, totalRwa);
    for (const slice of slices) {
      const offering = offerings.find(
        (o) => o.title === slice.label || o.id === slice.label,
      );
      out.push({
        id: slice.label,
        label: slice.label,
        subtitle: offering
          ? `${offering.eligibilityPolicy} · ${offeringCategoryLabel(offering)}`
          : 'Treasury settlement',
        value: `${slice.value.toLocaleString()} ${offering?.unitLabel ?? 'units'}`,
        risk: offering?.riskLevel ?? null,
        offering,
      });
    }

    if (out.length === 0 && totalRwa > 0n) {
      out.push({
        id: 'rwa-on-chain',
        label: 'Treasury units (RWA)',
        subtitle: 'On-chain balance',
        value: `${totalRwa.toString()} units`,
        risk: null,
      });
    }

    if (usdcBalance && usdcBalance !== '0' && usdcBalance !== '0.0000000') {
      out.unshift({
        id: 'usdc',
        label: 'USDC',
        subtitle: 'Circle · SEP-41',
        value: `${usdcBalance} USDC`,
        risk: 'Low',
      });
    }

    return out;
  }, [activity, rwaBalance, usdcBalance, offerings]);

  return (
    <section id="holdings">
      <SectionHeader
        eyebrow="Portfolio"
        title="Holdings"
        description="On-chain balances and recorded settlement positions."
        action={
          <Link to="/app/marketplace" className="text-sm font-medium text-[#007dfc] hover:underline">
            View marketplace →
          </Link>
        }
      />

      <div className="mt-5 lg-surface-card divide-y divide-[var(--lg-border)] overflow-hidden">
        {loading && rows.length === 0 ? (
          <div className="space-y-0 divide-y divide-[var(--lg-border)]">
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="flex items-center gap-4 p-5">
                <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-44 max-w-full" />
                  <Skeleton className="h-3 w-64 max-w-full" />
                </div>
                <div className="hidden w-40 space-y-2 text-right sm:block">
                  <Skeleton className="ml-auto h-3 w-20" />
                  <Skeleton className="ml-auto h-4 w-28" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="p-5 text-sm text-red-600">{error}</p>
        ) : !settlementOwner ? (
          <div className="lg-empty-panel m-4 p-6">
            <p className="text-sm font-semibold text-[#012b54]">Create your passkey account</p>
            <p className="mt-1 text-sm text-[#64748b]">
              Holdings appear after your Lumengate account exists and on-chain balances can be read.
            </p>
            <Link to="/app/verify" className="mt-4 inline-flex text-sm font-semibold text-[#007dfc] hover:underline">
              Start with passkey →
            </Link>
          </div>
        ) : rows.length === 0 ? (
          <div className="lg-empty-panel m-4 p-6">
            <p className="text-sm font-semibold text-[#012b54]">No holdings yet</p>
            <p className="mt-1 text-sm text-[#64748b]">
              Fund your account with USDC, or subscribe to an eligible marketplace offering.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link to="/app/verify" className="text-sm font-semibold text-[#007dfc] hover:underline">
                Add funds →
              </Link>
              <Link to="/app/marketplace" className="text-sm font-semibold text-[#007dfc] hover:underline">
                View marketplace →
              </Link>
            </div>
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-5 sm:flex sm:items-center"
            >
              <div className="flex min-w-0 items-center gap-4">
                {row.offering ? (
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[var(--lg-muted-bg)]">
                    <OfferingIllustration offering={row.offering} className="h-14 w-14" variant="card" />
                  </div>
                ) : (
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[var(--lg-muted-bg)] text-xs font-semibold text-[#007dfc]">
                    USDC
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#012b54]">{row.label}</p>
                  <p className="truncate text-xs text-[#64748b]">{row.subtitle}</p>
                </div>
              </div>
              <div className="hidden sm:flex flex-1 items-center justify-end gap-10 text-right">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-[#64748b]">Value</p>
                  <p className="text-sm font-semibold tabular-nums text-[#012b54]">{row.value}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-[#64748b]">P&amp;L</p>
                  <p className="text-sm font-semibold tabular-nums text-[#94a3b8]">—</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-[#64748b]">Risk</p>
                  <p className="text-sm font-semibold tabular-nums text-[#012b54]">{row.risk ?? '—'}</p>
                </div>
              </div>
              <div className="sm:hidden text-right">
                <p className="text-sm font-semibold tabular-nums text-[#012b54]">{row.value}</p>
              </div>
            </div>
          ))
        )}
      </div>
      <p className="mt-3 text-[11px] text-[#94a3b8]">
        P&amp;L and APY require issuer NAV feeds — not shown until available on-chain.
      </p>
    </section>
  );
}
