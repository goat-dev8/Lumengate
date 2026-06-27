import { RefreshCw } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import type { PassportScopeRow, PassportScopeUiStatus } from '../../lib/passportScopeStatus';
import { microcopy } from '../../lib/microcopy';
import { cn } from '../../lib/cn';

function toneForStatus(status: PassportScopeUiStatus): 'ok' | 'warn' | 'brand' | 'neutral' {
  if (status === 'ready') return 'ok';
  if (status === 'renewal_required' || status === 'used') return 'warn';
  if (status === 'none') return 'neutral';
  return 'brand';
}

type Props = {
  rows: PassportScopeRow[] | null;
  loading?: boolean;
  onRefresh?: () => void;
  onRenew?: () => void;
  onRequestNew?: () => void;
  showActions?: boolean;
  compact?: boolean;
};

export function PassportScopePanel({
  rows,
  loading,
  onRefresh,
  onRenew,
  onRequestNew,
  showActions = true,
  compact = false,
}: Props) {
  return (
    <Card>
      <CardHeader
        title={microcopy.passport.scopeTitle}
        description={microcopy.passport.scopeSubtitle}
        badge={
          loading ? (
            <Badge>Checking…</Badge>
          ) : rows?.some((r) => r.status === 'renewal_required') ? (
            <Badge tone="warn">Scope renewal needed</Badge>
          ) : rows?.every((r) => r.status === 'ready') ? (
            <Badge tone="ok">Scopes ready</Badge>
          ) : (
            <Badge tone="brand">Per-asset</Badge>
          )
        }
      />

      <div className={cn('grid gap-3', compact ? 'sm:grid-cols-1' : 'sm:grid-cols-3')}>
        {(rows ?? []).map((row) => (
          <div
            key={row.asset}
            className={cn(
              'rounded-xl border p-4',
              row.status === 'ready'
                ? 'border-emerald-100 bg-emerald-50/40'
                : row.status === 'renewal_required' || row.status === 'used'
                  ? 'border-amber-200 bg-amber-50/50'
                  : 'border-[var(--lg-border)] bg-[var(--lg-muted-bg)]/40',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[#012b54]">{row.label}</p>
              <Badge tone={toneForStatus(row.status)}>{row.badge}</Badge>
            </div>
            {!compact ? <p className="mt-2 text-xs leading-relaxed text-[#64748b]">{row.detail}</p> : null}
          </div>
        ))}
        {!rows?.length && !loading ? (
          <p className="text-sm text-[#64748b] sm:col-span-3">{microcopy.passport.scopeEmpty}</p>
        ) : null}
      </div>

      {showActions ? (
        <div className="mt-4 flex flex-wrap gap-3">
          {onRenew ? (
            <Button type="button" onClick={onRenew}>
              <RefreshCw className="h-4 w-4" />
              {microcopy.passport.requestNew}
            </Button>
          ) : null}
          {onRequestNew ? (
            <Button type="button" variant="secondary" onClick={onRequestNew}>
              {microcopy.passport.request}
            </Button>
          ) : null}
          {onRefresh ? (
            <Button type="button" variant="secondary" onClick={onRefresh} loading={loading}>
              Refresh status
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
