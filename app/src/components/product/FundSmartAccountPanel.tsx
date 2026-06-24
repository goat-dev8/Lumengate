import { useEffect, useState } from 'react';
import { Copy, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DeploymentConfig } from '../../lib/config';
import {
  readBalance,
  readComplianceAdminUsdcBalance,
  readContractXlmBalance,
  formatSorobanUserError,
} from '../../lib/contracts';
import { explorerTxUrl, truncateMiddle } from '../../lib/utils';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';

type Props = {
  config: DeploymentConfig;
  smartAccountAddress: string;
  onFundUsdc: (amount: string) => Promise<string>;
  onFundXlm: (amountXlm: string) => Promise<string>;
  onFunded?: () => void;
  compact?: boolean;
};

export function FundSmartAccountPanel({
  config,
  smartAccountAddress,
  onFundUsdc,
  onFundXlm,
  onFunded,
  compact,
}: Props) {
  const [fundAmount, setFundAmount] = useState('10');
  const [xlmAmount, setXlmAmount] = useState('2');
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [xlmBalance, setXlmBalance] = useState<string | null>(null);
  const [rwaBalance, setRwaBalance] = useState<string | null>(null);
  const [loadingUsdc, setLoadingUsdc] = useState(false);
  const [loadingXlm, setLoadingXlm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refreshBalances = () => {
    readComplianceAdminUsdcBalance(config, smartAccountAddress)
      .then((snap) => setUsdcBalance(snap.formatted))
      .catch(() => setUsdcBalance(null));
    readContractXlmBalance(config, smartAccountAddress)
      .then(setXlmBalance)
      .catch(() => setXlmBalance(null));
    readBalance(config, smartAccountAddress)
      .then(setRwaBalance)
      .catch(() => setRwaBalance(null));
  };

  useEffect(() => {
    refreshBalances();
  }, [config, smartAccountAddress, txHash]);

  const funded =
    Number(usdcBalance ?? '0') > 0 ||
    BigInt(rwaBalance ?? '0') > 0n ||
    Number(xlmBalance ?? '0') > 0;

  const copyAddress = async () => {
    await navigator.clipboard.writeText(smartAccountAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleFundUsdc = async () => {
    setLoadingUsdc(true);
    setError(null);
    try {
      const hash = await onFundUsdc(fundAmount);
      setTxHash(hash);
      refreshBalances();
      onFunded?.();
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      setError(formatSorobanUserError(raw));
    } finally {
      setLoadingUsdc(false);
    }
  };

  const handleFundXlm = async () => {
    setLoadingXlm(true);
    setError(null);
    try {
      const hash = await onFundXlm(xlmAmount);
      setTxHash(hash);
      refreshBalances();
      onFunded?.();
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      setError(formatSorobanUserError(raw));
    } finally {
      setLoadingXlm(false);
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
          Settlement pulls USDC and treasury units from your personal smart account. Send USDC for assets and a
          small XLM reserve for Soroban fees, or copy the deposit address.
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs text-slate-muted">USDC on smart account</p>
          <p className="text-lg font-semibold text-navy">{usdcBalance ?? '…'} USDC</p>
        </div>
        <div>
          <p className="text-xs text-slate-muted">XLM reserve</p>
          <p className="text-lg font-semibold text-navy">{xlmBalance ?? '…'} XLM</p>
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

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm text-slate-muted">Send USDC from wallet</span>
          <input
            className="mt-2 w-full rounded-xl border border-slate-line px-4 py-3 text-sm outline-none focus:border-brand"
            value={fundAmount}
            onChange={(e) => setFundAmount(e.target.value)}
            type="number"
            min="0"
            step="0.0000001"
          />
          <Button type="button" className="mt-3 w-full" loading={loadingUsdc} onClick={handleFundUsdc}>
            <Wallet className="h-4 w-4" />
            Fund with USDC
          </Button>
        </label>
        <label className="block">
          <span className="text-sm text-slate-muted">Send XLM for fees</span>
          <input
            className="mt-2 w-full rounded-xl border border-slate-line px-4 py-3 text-sm outline-none focus:border-brand"
            value={xlmAmount}
            onChange={(e) => setXlmAmount(e.target.value)}
            type="number"
            min="0"
            step="0.0000001"
          />
          <Button
            type="button"
            className="mt-3 w-full"
            variant="secondary"
            loading={loadingXlm}
            onClick={handleFundXlm}
          >
            Fund with XLM
          </Button>
        </label>
      </div>

      <p className="mt-3 text-xs text-slate-muted">
        Treasury units are minted when you{' '}
        <Link to="/app/marketplace" className="text-brand underline">
          invest on Marketplace
        </Link>
        . Before sending, confirm eligibility for the asset type on Send.
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
