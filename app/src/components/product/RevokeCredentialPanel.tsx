import { useState } from 'react';
import { Card, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

const REVOKE_KEY_STORAGE = 'lumengate.revokeApiKey';

type Props = {
  issuerUrl: string;
};

export function RevokeCredentialPanel({ issuerUrl }: Props) {
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem(REVOKE_KEY_STORAGE) || '');
  const [commitment, setCommitment] = useState('');
  const [reason, setReason] = useState('operator-revoked');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveKey = () => {
    sessionStorage.setItem(REVOKE_KEY_STORAGE, apiKey.trim());
    setResult('API key saved for this browser session only.');
    setError(null);
  };

  const revoke = async () => {
    if (!apiKey.trim()) {
      setError('Enter the operator REVOKE_API_KEY (never commit this to git).');
      return;
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(commitment.trim())) {
      setError('Commitment must be 32-byte hex (0x + 64 hex chars).');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await fetch(`${issuerUrl.replace(/\/$/, '')}/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({ commitment: commitment.trim().toLowerCase(), reason }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        throw new Error(data.error || resp.statusText);
      }
      setResult(
        data.alreadyRevoked
          ? `Already revoked (${data.count} total revocations).`
          : `Revoked on-chain. Root: ${data.revocationRoot?.slice(0, 18)}…`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Revoke credential"
        badge={<Badge tone="warn">Operator</Badge>}
        description="Immediately invalidate a credential commitment. Updates the on-chain revocation root via issuer service."
      />
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="text-slate-muted">Revoke API key (session only)</span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-line px-3 py-2 font-mono text-xs"
            placeholder="Bearer token from REVOKE_API_KEY"
          />
        </label>
        <Button variant="secondary" type="button" onClick={saveKey}>
          Save key for session
        </Button>
        <label className="block text-sm">
          <span className="text-slate-muted">Credential commitment</span>
          <input
            value={commitment}
            onChange={(e) => setCommitment(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-line px-3 py-2 font-mono text-xs"
            placeholder="0x…"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-muted">Reason</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-line px-3 py-2 text-sm"
          />
        </label>
        <Button type="button" disabled={loading} onClick={revoke}>
          {loading ? 'Revoking…' : 'Revoke on-chain'}
        </Button>
        {result && <p className="text-sm text-status-ok">{result}</p>}
        {error && <p className="text-sm text-status-err">{error}</p>}
      </div>
    </Card>
  );
}
