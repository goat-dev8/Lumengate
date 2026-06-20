import { Badge } from '../ui/Badge';
import { POLICIES, type PolicyKey } from '../../lib/policies';

const MATRIX_KEYS: PolicyKey[] = [
  'general-eligibility',
  'accredited-investor',
  'sanctions-clear',
  'us-jurisdiction',
  'proof-of-funds',
];

export function AssetPolicyMatrix() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#e3e8ee] bg-white shadow-sm">
      <div className="border-b border-[#eef0f3] px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
          Asset policy matrix
        </p>
        <p className="mt-1 text-sm text-[#475569]">
          One external compliance layer gates RWA settlement and USDC SAC (when ComplianceSacAdmin is deployed).
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#eef0f3] bg-[#f6f9fc] text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">
              <th className="px-5 py-3">Policy</th>
              <th className="px-5 py-3">Claims proven</th>
              <th className="px-5 py-3">policy_id</th>
              <th className="px-5 py-3">Live gate</th>
            </tr>
          </thead>
          <tbody>
            {MATRIX_KEYS.map((key) => {
              const p = POLICIES[key];
              const gate =
                p.policyId === 2 ? 'PoF verify tx' : 'RwaToken.transfer';
              return (
                <tr key={key} className="border-b border-[#eef0f3] last:border-0">
                  <td className="px-5 py-3 font-medium text-[#012b54]">{p.title}</td>
                  <td className="px-5 py-3 text-[#475569]">{p.claims.join(' · ')}</td>
                  <td className="px-5 py-3">
                    <Badge tone="brand">{p.policyId}</Badge>
                  </td>
                  <td className="px-5 py-3 text-[#475569]">{gate}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
