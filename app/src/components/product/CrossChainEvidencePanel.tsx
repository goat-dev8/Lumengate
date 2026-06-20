import { Badge } from '../ui/Badge';
import type { IssuerCredentialResponse } from '../../lib/config';
import { truncateMiddle } from '../../lib/utils';

type Props = {
  credential: IssuerCredentialResponse | null;
  walletAddress: string | null;
  rootsMatch: boolean;
};

export function CrossChainEvidencePanel({ credential, walletAddress, rootsMatch }: Props) {
  if (!credential) {
    return (
      <div className="rounded-2xl border border-dashed border-[#cbd5e1] bg-[#fafbfc] p-5 text-sm text-[#64748b]">
        Issue a credential to view cross-chain evidence — Ethereum issuer signature bound to Stellar
        wallet field.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#e3e8ee] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
          Cross-chain evidence
        </p>
        <Badge tone={rootsMatch ? 'ok' : 'warn'}>
          {rootsMatch ? 'Roots match on-chain' : 'Roots pending'}
        </Badge>
      </div>
      <dl className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-[#f6f9fc] p-3">
          <dt className="text-[10px] font-semibold uppercase text-[#64748b]">Ethereum issuer</dt>
          <dd className="mt-1 break-all font-mono text-xs text-[#012b54]">
            {credential.issuerEthAddress}
          </dd>
        </div>
        <div className="rounded-xl bg-[#f6f9fc] p-3">
          <dt className="text-[10px] font-semibold uppercase text-[#64748b]">Stellar wallet binding</dt>
          <dd className="mt-1 font-mono text-xs text-[#012b54]">
            {walletAddress ? truncateMiddle(walletAddress, 8, 6) : 'Not connected'}
          </dd>
          <dd className="mt-1 text-xs text-[#64748b]">
            Wallet field {credential.walletField ?? credential.credential.commitment.slice(0, 8)}… in
            circuit public inputs
          </dd>
        </div>
        <div className="rounded-xl bg-[#f6f9fc] p-3">
          <dt className="text-[10px] font-semibold uppercase text-[#64748b]">Merkle root</dt>
          <dd className="mt-1 break-all font-mono text-[10px] text-[#012b54]">
            {credential.credential.root}
          </dd>
        </div>
        <div className="rounded-xl bg-[#f6f9fc] p-3">
          <dt className="text-[10px] font-semibold uppercase text-[#64748b]">Revocation root</dt>
          <dd className="mt-1 break-all font-mono text-[10px] text-[#012b54]">
            {credential.credential.revocationRoot}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-[#64748b]">
        Trust chain: Ethereum signed → Merkle verified → revocation checked → wallet bound → ZK
        eligible. No PII crosses to Stellar ledger.
      </p>
    </div>
  );
}
