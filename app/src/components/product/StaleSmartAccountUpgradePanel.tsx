import { KeyRound } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';

type Props = {
  legacyAddress?: string | null;
  loading?: boolean;
  onReplace: () => Promise<unknown>;
};

export function StaleSmartAccountUpgradePanel({ legacyAddress, loading, onReplace }: Props) {
  return (
    <Card className="border-status-err/30 bg-red-50/40">
      <CardHeader title="Upgrade smart account" badge={<Badge tone="warn">Required</Badge>} />
      <p className="text-sm text-slate-muted">
        Your current passkey smart account was deployed with an older compliance policy that cannot
        authorize private sends. Create a new passkey smart account — settlement stays passkey-only,
        with no Freighter popup on Send.
      </p>
      {legacyAddress ? (
        <p className="mt-3 break-all font-mono text-xs text-slate-muted">
          Legacy account: {legacyAddress}
        </p>
      ) : null}
      <p className="mt-3 text-xs text-slate-muted">
        Funds on the legacy address stay there. After creating the new account, fund the new deposit
        address, confirm eligibility for this asset, then send.
      </p>
      <Button className="mt-4" loading={loading} onClick={() => onReplace()}>
        <KeyRound className="h-4 w-4" />
        Create new passkey smart account
      </Button>
    </Card>
  );
}
