import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import type { ProofLifecycleState } from '../../lib/proofLifecycle';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card, CardHeader } from '../ui/Card';
import { explorerTxUrl } from '../../lib/utils';
import type { DeploymentConfig } from '../../lib/config';

type Props = {
  state: ProofLifecycleState;
  config: DeploymentConfig;
  onRefreshProof?: () => void;
  compact?: boolean;
};

export function ProofLifecyclePanel({ state, config, onRefreshProof, compact }: Props) {
  if (state.lifecycle === 'none') {
    return (
      <Card>
        <CardHeader title="Proof required" badge={<Badge>Action needed</Badge>} />
        <p className="text-sm text-slate-muted">
          Generate a zero-knowledge proof on Verify before you can settle compliant assets.
        </p>
        <Link to="/app/verify" className="mt-4 inline-block">
          <Button>Go to Verify</Button>
        </Link>
      </Card>
    );
  }

  if (state.lifecycle === 'ready') {
    return (
      <Card>
        <CardHeader title="Proof ready" badge={<Badge tone="ok">Unspent</Badge>} />
        {!compact ? (
          <p className="text-sm text-slate-muted">
            Your proof authorizes one compliant settlement. After transfer, you will need a fresh passport.
          </p>
        ) : null}
        <p className="mt-2 flex items-center gap-2 text-sm text-brand">
          <CheckCircle2 className="h-4 w-4" />
          Ready for settlement
        </p>
      </Card>
    );
  }

  if (state.lifecycle === 'consumed') {
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader title="Proof consumed" badge={<Badge tone="warn">Replay protection</Badge>} />
        <p className="text-sm text-slate-muted">
          {state.reason ?? 'Proof consumed by previous settlement.'} Each settlement requires a new passport and
          proof.
        </p>
        {state.consumedTxHash ? (
          <p className="mt-3 text-sm">
            Settlement tx:{' '}
            <a
              href={explorerTxUrl(config.explorerBaseUrl, state.consumedTxHash)}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-brand underline"
            >
              {state.consumedTxHash.slice(0, 12)}…
            </a>
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/app/verify">
            <Button>
              <RefreshCw className="h-4 w-4" />
              Generate fresh proof
            </Button>
          </Link>
          {onRefreshProof ? (
            <Button variant="secondary" onClick={onRefreshProof}>
              Check status
            </Button>
          ) : null}
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-red-200 bg-red-50/50">
      <CardHeader title="Proof invalid" badge={<Badge tone="err">Mismatch</Badge>} />
      <p className="flex items-start gap-2 text-sm text-slate-muted">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-err" />
        {state.reason ?? 'Proof does not match your passport.'}
      </p>
      <Link to="/app/verify" className="mt-4 inline-block">
        <Button variant="secondary">Return to Verify</Button>
      </Link>
    </Card>
  );
}
