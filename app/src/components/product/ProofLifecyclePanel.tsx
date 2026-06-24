import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import type { ProofLifecycleState } from '../../lib/proofLifecycle';
import { recoveryPlanAfterNullifierSpent } from '../../lib/proofRecovery';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card, CardHeader } from '../ui/Card';
import { explorerTxUrl } from '../../lib/utils';
import type { DeploymentConfig } from '../../lib/config';

type Props = {
  state: ProofLifecycleState;
  config: DeploymentConfig;
  onBeginRecovery?: () => void;
  onRefreshProof?: () => void;
  compact?: boolean;
};

export function ProofLifecyclePanel({ state, config, onBeginRecovery, onRefreshProof, compact }: Props) {
  if (state.lifecycle === 'none') {
    if (state.consumedTxHash && state.reason) {
      return (
        <Card className="border-brand-200 bg-brand-50/40">
          <CardHeader title="Recovery in progress" badge={<Badge tone="brand">Next step</Badge>} />
          <p className="text-sm text-slate-muted">{state.reason}</p>
          {state.consumedTxHash ? (
            <p className="mt-2 text-sm">
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
          <p className="mt-3 text-sm font-medium text-navy">Continue below — request a new passport first.</p>
        </Card>
      );
    }
    return (
      <Card>
        <CardHeader title="Proof required" badge={<Badge>Action needed</Badge>} />
        {!compact ? (
          <p className="text-sm text-slate-muted">
            Generate a zero-knowledge proof on Verify before you can settle compliant assets.
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
        <CardHeader title="Proof ready" badge={<Badge tone="ok">Unspent</Badge>} />
        {!compact ? (
          <p className="text-sm text-slate-muted">
            Your proof authorizes one compliant settlement. After transfer, request a new passport and proof.
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
    const plan = recoveryPlanAfterNullifierSpent(state.consumedTxHash);
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader title="Proof consumed" badge={<Badge tone="warn">Replay protection</Badge>} />
        <p className="text-sm text-slate-muted">{plan.message}</p>
        <p className="mt-2 text-xs text-slate-muted">
          Protocol requirement: new passport (fresh nullifier) + new proof — not proof alone.
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
          <Button
            type="button"
            onClick={() => {
              if (onBeginRecovery) {
                onBeginRecovery();
                document.getElementById('recovery-credential')?.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            disabled={!onBeginRecovery}
          >
            <RefreshCw className="h-4 w-4" />
            Start fresh passport
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
      <CardHeader title="Proof invalid" badge={<Badge tone="err">Mismatch</Badge>} />
      <p className="flex items-start gap-2 text-sm text-slate-muted">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-err" />
        {state.reason ?? 'Proof does not match your passport.'}
      </p>
      {onBeginRecovery ? (
        <Button type="button" className="mt-4" variant="secondary" onClick={onBeginRecovery}>
          Reset and return to Verify
        </Button>
      ) : null}
    </Card>
  );
}
