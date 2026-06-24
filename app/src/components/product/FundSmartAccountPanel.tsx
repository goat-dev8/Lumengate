import { useEffect, useState } from 'react';
import { Copy, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DeploymentConfig } from '../../lib/config';
import { readBalance, readComplianceAdminUsdcBalance } from '../../lib/contracts';
import { explorerTxUrl, truncateMiddle } from '../../lib/utils';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';

type Props = {
  config: DeploymentConfig;
  smartAccountAddress: string;
  onFundUsdc: (amount: string) => Promise<string>;
  onFunded?: () => void;
  compact?: boolean;
};

export function FundSmartAccountPanel({
  config,
  smartAccountAddress,
  onFundUsdc,
  onFunded,
  compact,
}: Props) {
  const [fundAmount, setFundAmount] = useState('10');
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [rwaBalance, setRwaBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refreshBalances = () => {
    readComplianceAdminUsdcBalance(config, smartAccountAddress)
      .then((snap) => setUsdcBalance(snap.formatted))
      .catch(() => setUsdcBalance(null));
    readBalance(config, smartAccountAddress)
      .then(setRwaBalance)
      .catch(() => setRwaBalance(null));
  };

  useEffect(() => {
    refreshBalances();
  }, [config, smartAccountAddress, txHash]);

  const funded =
    Number(usdcBalance ?? '0') > 0 || BigInt(rwaBalance ?? '0') > 0n;

  const copyAddress = async () => {
    await navigator.clipboard.writeText(smartAccountAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleFund = async () => {
    setLoading(true);
    setError(null);
    try {
      const hash = await onFundUsdc(fundAmount);
      setTxHash(hash);
      refreshBalances();
      onFunded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Fund smart account"
        badge={<Badge tone={funded ? 'ok' : 'warn'}>{funded ? 'Funded' : 'Deposit needed'}</Badge>}
      />
      {!compact ? (
        <p className="text-sm text-slate-muted">
          Settlement pulls USDC and treasury units from your personal smart account. Send USDC from your
          connected wallet in one click, or copy the deposit address.
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs text-slate-muted">USDC on smart account</p>
          <p className="text-lg font-semibold text-navy">{usdcBalance ?? '…'} USDC</p>
        </div>
        <div>
          <p className="text-xs text-slate-muted">Treasury units</p>
          <p className="text-lg font-semibold text-navy">{rwaBalance ?? '…'}</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-line bg-slate-50/80 p-3">
        <p className="text-xs text-slate-muted">Deposit address</p>
        <p className="mt-1 break-all font-mono text-xs text-slate-ink">{smartAccountAddress}</p>
        <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={copyAddress}>
          <Copy className="h-4 w-4" />
          {copied ? 'Copied' : 'Copy address'}
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block min-w-[8rem] flex-1">
          <span className="text-sm text-slate-muted">Send USDC from wallet</span>
          <input
            className="mt-2 w-full rounded-xl border border-slate-line px-4 py-3 text-sm outline-none focus:border-brand"
            value={fundAmount}
            onChange={(e) => setFundAmount(e.target.value)}
            type="number"
            min="0"
            step="0.0000001"
          />
        </label>
        <Button type="button" loading={loading} onClick={handleFund}>
          <Wallet className="h-4 w-4" />
          Fund with USDC
        </Button>
      </div>

      <p className="mt-3 text-xs text-slate-muted">
        Treasury units are minted when you{' '}
        <Link to="/app/marketplace" className="text-brand underline">
          invest on Marketplace
        </Link>
        . USDC/EURC must be on your smart account before private send.
      </p>

      {txHash ? (
        <p className="mt-3 text-sm text-brand">
          Funded —{' '}
          <a
            href={explorerTxUrl(config.explorerBaseUrl, txHash)}
            target="_blank"
            rel="noreferrer"
            className="font-mono underline"
          >
            {truncateMiddle(txHash, 10, 8)}
          </a>
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-status-err">{error}</p> : null}
    </Card>
  );
}
