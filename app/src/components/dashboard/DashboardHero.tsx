import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Pill } from '../design/Primitives';
import type { ActivityEntry } from '../../lib/activity';
import type { PassportPhase } from '../../lib/passportLifecycle';
import { phaseLabel } from '../../lib/passportLifecycle';
import type { PolicyKey } from '../../lib/policies';
import { policyByKey } from '../../lib/policies';

type Props = {
  phase: PassportPhase;
  readyToInvest: boolean;
  policyKey: PolicyKey;
  hasCredential: boolean;
  portfolioMain: string;
  portfolioSub?: string;
  settledTotalLabel: string | null;
  readinessHref: string;
  readinessCta: string;
  activity: ActivityEntry[];
};

function buildMonthlyActivityCounts(activity: ActivityEntry[], months = 8) {
  const now = new Date();
  const buckets: { label: string; count: number }[] = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleString('en-US', { month: 'short' });
    const count = activity.filter((entry) => {
      const ad = new Date(entry.timestamp);
      return ad.getMonth() === d.getMonth() && ad.getFullYear() === d.getFullYear();
    }).length;
    buckets.push({ label, count });
  }
  return buckets;
}

function ActivityTimeline({ activity }: { activity: ActivityEntry[] }) {
  const buckets = buildMonthlyActivityCounts(activity);
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((sum, b) => sum + b.count, 0);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
      <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Recent activity</p>
      <div className="mt-4 flex h-[140px] items-end gap-2">
        {buckets.map((bucket) => {
          const height = bucket.count === 0 ? 4 : Math.max(12, Math.round((bucket.count / max) * 120));
          return (
            <div key={bucket.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-[#5eb0ff]/20 to-[#5eb0ff]/80 transition-all"
                style={{ height }}
                title={`${bucket.count} event${bucket.count === 1 ? '' : 's'}`}
              />
              <span className="text-[10px] text-white/55">{bucket.label}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex justify-between text-[11px] text-white/70">
        <span>
          Session events <span className="text-white">{total}</span>
        </span>
        <span>
          Live timeline <span className="text-white">Stellar testnet</span>
        </span>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-white/50">
        Activity appears here after passport, proof, or settlement steps. Counts are from your session
        timeline — not simulated portfolio performance.
      </p>
    </div>
  );
}

export function DashboardHero({
  phase,
  readyToInvest,
  policyKey,
  hasCredential,
  portfolioMain,
  portfolioSub,
  settledTotalLabel,
  readinessHref,
  readinessCta,
  activity,
}: Props) {
  const badge = readyToInvest
    ? `Verified · ${policyByKey(policyKey).claims.slice(0, 2).join(' · ')}`
    : phase === 'passport-issued'
      ? 'Passport issued · Confirm eligibility'
      : phase === 'proof-spent' || phase === 'expired'
        ? 'Renew access'
        : hasCredential
          ? `Passport · ${policyByKey(policyKey).claims.slice(0, 2).join(' · ')}`
          : phaseLabel(phase);

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-3xl lg-gradient-passport p-8 text-white lg-shadow-lift md:p-10"
    >
      <div className="pointer-events-none absolute inset-0 lg-grid-bg opacity-10" />
      <div className="pointer-events-none absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full bg-[#5eb0ff]/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-20 h-[360px] w-[360px] rounded-full bg-white/10 blur-3xl" />

      <div className="relative grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-end">
        <div>
          <Pill tone="brand" className="border-white/20 bg-white/10 text-white">
            <Sparkles className="h-3 w-3" />
            <span className="uppercase tracking-[0.08em]">{badge}</span>
          </Pill>
          <p className="mt-5 text-sm uppercase tracking-[0.18em] text-white/60">Portfolio value</p>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-3">
            <h2 className="lg-font-display text-5xl leading-none tracking-tight text-white md:text-6xl lg:text-7xl">
              {portfolioMain}
            </h2>
            {settledTotalLabel ? (
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-200">
                {settledTotalLabel}
              </span>
            ) : null}
          </div>
          {portfolioSub ? <p className="mt-1 text-sm text-white/60">{portfolioSub}</p> : null}
          <p className="mt-3 max-w-md text-sm text-white/70">
            You privately prove eligibility, invest in regulated assets, and receive auditor-grade receipts on
            Stellar.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            {readyToInvest ? (
              <>
                <Link
                  to="/app/marketplace"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-[#012b54] transition hover:bg-white/95"
                >
                  Explore investments
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/app/send"
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Send funds
                </Link>
              </>
            ) : (
              <Link
                to={readinessHref}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-[#012b54] transition hover:bg-white/95"
              >
                {readinessCta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>

        <ActivityTimeline activity={activity} />
      </div>
    </motion.section>
  );
}
