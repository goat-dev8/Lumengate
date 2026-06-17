import type { DeploymentConfig, IssuerCredentialResponse } from '../../lib/config';
import type { OnChainRoots } from '../../lib/config';
import { truncateMiddle } from '../../lib/utils';

type Props = {
  config: DeploymentConfig;
  credential: IssuerCredentialResponse | null;
  walletField: string | null;
  onChainRoots: OnChainRoots | null;
  rootsMatch: boolean;
  expiresAt: number | null;
  signatureVerified?: boolean;
};

export function CredentialProvenance({
  config,
  credential,
  walletField,
  onChainRoots,
  rootsMatch,
  expiresAt,
  signatureVerified = Boolean(credential),
}: Props) {
  return (
    <dl className="grid gap-3 text-sm md:grid-cols-2">
      <div className="rounded-xl bg-slate-50 p-3">
        <dt className="text-xs uppercase text-slate-muted">Credential source</dt>
        <dd className="mt-1 font-medium">Lumengate issuer service → Ethereum secp256k1</dd>
      </div>
      <div className="rounded-xl bg-slate-50 p-3">
        <dt className="text-xs uppercase text-slate-muted">Issuer</dt>
        <dd className="mt-1 break-all font-mono text-xs">
          {credential?.issuerEthAddress ?? 'Request credential to bind issuer'}
        </dd>
      </div>
      <div className="rounded-xl bg-slate-50 p-3">
        <dt className="text-xs uppercase text-slate-muted">Signature status</dt>
        <dd className="mt-1 font-medium">{signatureVerified ? 'Verified (circuit checks sig)' : 'Pending'}</dd>
      </div>
      <div className="rounded-xl bg-slate-50 p-3">
        <dt className="text-xs uppercase text-slate-muted">Verification method</dt>
        <dd className="mt-1">UltraHonk BN254 on Stellar PolicyVerifier</dd>
      </div>
      <div className="rounded-xl bg-slate-50 p-3">
        <dt className="text-xs uppercase text-slate-muted">Policy ID</dt>
        <dd className="mt-1">{credential?.credential.policyId ?? config.policyId}</dd>
      </div>
      <div className="rounded-xl bg-slate-50 p-3">
        <dt className="text-xs uppercase text-slate-muted">Wallet binding</dt>
        <dd className="mt-1 font-mono text-xs">{walletField ?? 'Connect wallet'}</dd>
      </div>
      <div className="rounded-xl bg-slate-50 p-3 md:col-span-2">
        <dt className="text-xs uppercase text-slate-muted">Merkle root</dt>
        <dd className="mt-1 break-all font-mono text-xs">
          {onChainRoots?.root ?? credential?.credential.root ?? '—'}
          {rootsMatch ? ' (matches CredentialRegistry)' : ''}
        </dd>
      </div>
      <div className="rounded-xl bg-slate-50 p-3 md:col-span-2">
        <dt className="text-xs uppercase text-slate-muted">Revocation root</dt>
        <dd className="mt-1 break-all font-mono text-xs">
          {onChainRoots?.revocationRoot ?? credential?.credential.revocationRoot ?? '—'}
        </dd>
      </div>
      <div className="rounded-xl bg-slate-50 p-3">
        <dt className="text-xs uppercase text-slate-muted">CredentialRegistry</dt>
        <dd className="mt-1 break-all font-mono text-xs">{truncateMiddle(config.credentialRegistryId, 8, 6)}</dd>
      </div>
      <div className="rounded-xl bg-slate-50 p-3">
        <dt className="text-xs uppercase text-slate-muted">Credential expiration</dt>
        <dd className="mt-1">
          {expiresAt ? new Date(expiresAt).toLocaleString() : credential?.expiresAt ? new Date(credential.expiresAt).toLocaleString() : '—'}
        </dd>
      </div>
      <div className="rounded-xl bg-slate-50 p-3 md:col-span-2">
        <dt className="text-xs uppercase text-slate-muted">Cross-chain issuer</dt>
        <dd className="mt-1">
          Ethereum issuer ID {credential?.issuerId ?? 2} → Stellar IssuerRegistry{' '}
          {truncateMiddle(config.issuerRegistryId, 8, 6)}
        </dd>
      </div>
    </dl>
  );
}
