import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useCountUp } from '../../hooks/useCountUp';
import { useApp } from '../../context/AppContext';
import { fetchChainSnapshot, type ChainSnapshot } from '../../lib/chainSnapshot';
import { explorerTxUrl } from '../../lib/utils';

function truncateHex(hex: string, head = 10, tail = 6): string {
  if (hex.length <= head + tail + 3) return hex;
  return `${hex.slice(0, head)}…${hex.slice(-tail)}`;
}

export function HeroLiveConsole() {
  const { config, address } = useApp();
  const [snapshot, setSnapshot] = useState<ChainSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchChainSnapshot(address)
      .then((data) => {
        if (!cancelled) setSnapshot(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  const policyId = useCountUp(snapshot?.policyId ?? 0, 1200, 0, false);
  const sessionEvents = useCountUp(snapshot?.sessionEvents ?? 0, 1400, 0, false);
  const referenceCount = useCountUp(snapshot?.referenceTxs.length ?? 0, 1000, 0, false);
  const balanceNum = snapshot?.balance ? Number(snapshot.balance) : 0;
  const balanceDisplay = useCountUp(Number.isFinite(balanceNum) ? balanceNum : 0, 1600, 0, false);

  const pipeline = [
    { label: 'Issuer service', ok: snapshot?.issuerOk },
    { label: 'Merkle roots', ok: Boolean(snapshot?.roots) },
    { label: 'Wallet linked', ok: Boolean(address) },
    {
      label: snapshot?.frozen ? 'Account frozen' : 'Transfer eligible',
      ok: address ? snapshot?.frozen === false : null,
    },
  ];

  return (
    <div className="lg-dashboard-section">
      <div className="lg-dashboard-section-head">
        <p className="lg-flow-band-eyebrow">Live on testnet</p>
        <h2 className="lg-dashboard-section-title">Compliance console</h2>
        <p className="lg-dashboard-section-desc">
          Real policy IDs, balances, and reference transactions — no mock data.
        </p>
      </div>
      <div className="lg-dashboard-panel">
        <div className="lg-dashboard-chrome">
          <div className="flex items-center gap-2">
            <span className="lg-dashboard-dot lg-dashboard-dot-red" />
            <span className="lg-dashboard-dot lg-dashboard-dot-yellow" />
            <span className="lg-dashboard-dot lg-dashboard-dot-green" />
          </div>
          <span className="lg-dashboard-live">
            <span className="lg-dashboard-live-dot" />
            {snapshot?.network || config.network} · Soroban
          </span>
        </div>

        <div className="lg-dashboard-body">
          <div className="lg-dashboard-stats lg-dashboard-stats-4">
          <div className="lg-dashboard-stat">
            <div className="text-xs text-[#64748b]">Policy ID</div>
            <div className="mt-1 text-2xl font-semibold text-[#012b54]">{loading ? '…' : policyId}</div>
            <div className="mt-1 text-[11px] text-[#64748b]">From VITE_POLICY_ID</div>
          </div>
          <div className="lg-dashboard-stat">
            <div className="text-xs text-[#64748b]">RWA balance</div>
            <div className="mt-1 text-2xl font-semibold text-[#012b54]">
              {loading ? '…' : address ? balanceDisplay.toLocaleString() : '—'}
            </div>
            <div className="mt-1 text-[11px] text-[#64748b]">
              {address ? 'RwaToken.balance (chain)' : 'Connect wallet'}
            </div>
          </div>
          <div className="lg-dashboard-stat">
            <div className="text-xs text-[#64748b]">Session events</div>
            <div className="mt-1 text-2xl font-semibold text-[#012b54]">{loading ? '…' : sessionEvents}</div>
            <div className="mt-1 text-[11px] text-[#64748b]">Your wallet session</div>
          </div>
          <div className="lg-dashboard-stat lg-dashboard-stat-accent">
            <div className="text-xs text-white/80">Reference txs</div>
            <div className="mt-1 text-2xl font-semibold text-white">{loading ? '…' : referenceCount}</div>
            <div className="mt-1 text-[11px] text-white/70">On-chain + session</div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl bg-[#f8f9fb] p-4">
            <div className="flex items-center justify-between text-xs font-medium text-[#64748b]">
              <span>Compliance pipeline</span>
              <span className={snapshot?.issuerOk ? 'text-[#15803d]' : 'text-[#64748b]'}>
                {loading
                  ? 'Syncing…'
                  : snapshot?.issuerOk
                    ? `Issuer online · ${snapshot.issuerLabel}`
                    : 'Issuer offline'}
              </span>
            </div>
            <div className="lg-pipeline-bar">
              <div
                className="lg-pipeline-progress"
                style={{
                  width: `${Math.round((pipeline.filter((p) => p.ok).length / pipeline.length) * 100)}%`,
                }}
              />
            </div>
            <div className="mt-3 space-y-2">
              {pipeline.map((row) => (
                <div key={row.label} className="flex items-center gap-2 text-xs text-[#31485f]">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      row.ok === true ? 'bg-[#22c55e]' : row.ok === false ? 'bg-[#ef4444]' : 'bg-[#94a3b8]'
                    }`}
                  />
                  {row.label}
                </div>
              ))}
            </div>
            {snapshot?.roots ? (
              <div className="mt-3 rounded-lg border border-[#eef0f3] bg-white p-2 font-mono text-[10px] text-[#64748b]">
                root {truncateHex(snapshot.roots.root)}
                <br />
                rev {truncateHex(snapshot.roots.revocationRoot)}
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-[#eef0f3] bg-white p-4">
            <div className="text-xs font-medium text-[#64748b]">Reference testnet transactions</div>
            <ul className="mt-3 space-y-2">
              {snapshot?.referenceTxs.length ? (
                snapshot.referenceTxs.map((tx) => (
                  <li key={tx.hash} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-[#31485f]">{tx.label}</span>
                    <a
                      href={explorerTxUrl(config.explorerBaseUrl, tx.hash)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[#007dfc] hover:underline"
                    >
                      {tx.hash.slice(0, 10)}…
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                ))
              ) : (
                <li className="text-xs text-[#64748b]">Complete a transfer to record live txs</li>
              )}
            </ul>
            {!loading && snapshot?.issuerHint && !snapshot.issuerOk ? (
              <p className="mt-3 rounded-lg bg-[#f8f9fb] p-2 text-[11px] text-[#64748b]">
                {snapshot.issuerHint}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
