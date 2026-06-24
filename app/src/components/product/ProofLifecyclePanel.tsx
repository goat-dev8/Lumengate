import type { ProofLifecycleState } from '../../lib/proofLifecycle';
import { recoveryPlanAfterNullifierSpent } from '../../lib/proofRecovery';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card, CardHeader } from '../ui/Card';
import { explorerTxUrl } from '../../lib/utils';
import type { DeploymentConfig } from '../../lib/config';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

type Props = {
  state: ProofLifecycleState;
  config: DeploymentConfig;
  onBeginRecovery?: () => void;
  onRefreshProof?: () => void;
  compact?: boolean;
};

export function ProofLifecyclePanel({ state, config, onBeginRecovery, onRefreshProof, compact }: Props) {
  if (state.lifecycle === 'none') {
    return (
      <Card>
        <CardHeader title="Private confirmation required" badge={<Badge>Action needed</Badge>} />
        {!compact ? (
          <p className="text-sm text-slate-muted">
            Confirm eligibility on Passport before you can settle regulated assets.
          </p>
        ) : null}
        {onBeginRecovery ? (
          <Button className="mt-4" onClick={onBeginRecovery}>
            Go to Verify
          </Button>
        ) : null}
      </Card>
    );
  }

  if (state.lifecycle === 'ready') {
    return (
      <Card>
        <CardHeader title="Ready for one settlement" badge={<Badge tone="ok">Ready</Badge>} />
        {!compact ? (
          <p className="text-sm text-slate-muted">
            Your private confirmation is ready. After a settlement, renew your passport before sending again.
          </p>
        ) : null}
        <p className="mt-2 flex items-center gap-2 text-sm text-brand">
          <CheckCircle2 className="h-4 w-4" />
          You can invest or send now
        </p>
      </Card>
    );
  }

  if (state.lifecycle === 'consumed') {
    const plan = recoveryPlanAfterNullifierSpent(state.consumedTxHash);
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader title="Passport used" badge={<Badge tone="warn">Renewal needed</Badge>} />
        <p className="text-sm text-slate-muted">{plan.message}</p>
        <p className="mt-2 text-xs text-slate-muted">Renewing creates a fresh private confirmation for your next settlement.</p>
        {state.consumedTxHash ? (
          <p className="mt-3 text-sm">
            Previous settlement:{' '}
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
          <Button
            type="button"
            onClick={() => {
              onBeginRecovery?.();
              document.getElementById('recovery-credential')?.scrollIntoView({ behavior: 'smooth' });
            }}
            disabled={!onBeginRecovery}
          >
            <RefreshCw className="h-4 w-4" />
            Renew passport
          </Button>
          {onRefreshProof ? (
            <Button type="button" variant="secondary" onClick={onRefreshProof}>
              Check status
            </Button>
          ) : null}
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-red-200 bg-red-50/50">
      <CardHeader title="Confirmation needs renewal" badge={<Badge tone="err">Action needed</Badge>} />
      <p className="flex items-start gap-2 text-sm text-slate-muted">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-err" />
        {state.reason ?? 'Your private confirmation no longer matches this passport.'}
      </p>
      {onBeginRecovery ? (
        <Button type="button" className="mt-4" variant="secondary" onClick={onBeginRecovery}>
          Renew passport
        </Button>
      ) : null}
    </Card>
  );
}
