import { ShieldCheck } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { cn } from '../../lib/cn';

const CONTROLS = [
  { title: 'Nullifier anti-replay', detail: '`PolicyVerifier.verify` spends scoped nullifiers on every settlement.' },
  { title: 'Session binding', detail: '`CompliancePolicy` reads `SessionStore.get_proof` for all smart-account auth except `set_proof`.' },
  { title: 'Passkey user verification', detail: 'Required for WebAuthn via OpenZeppelin stellar-accounts 0.7.2.' },
  { title: 'Canonical AuthPayload encoding', detail: 'ScVal map order verified by `scripts/verify_passkey_auth_encoding.sh`.' },
  { title: 'Relayer rate limiting', detail: '30 requests per minute per IP.' },
  { title: 'Protected revoke API', detail: 'Credential revocation requires `REVOKE_API_KEY`.' },
];

const THREATS = [
  { threat: 'Issuer key compromise', mitigation: 'On-chain roots + ZK verify; revoke API', residual: 'Bad credentials remain valid until revoked' },
  { threat: 'Session key theft', mitigation: '7-day ledger TTL; local revoke', residual: 'Default context scope' },
  { threat: 'Nullifier replay', mitigation: '`verify_passport` spends scoped nullifiers', residual: 'User must renew passport after spend' },
  { threat: 'CT sync gaps', mitigation: 'Hybrid issuer indexer + `rebuildFromEvents`', residual: 'RPC ~7-day event window' },
  { threat: 'Passkey phishing', mitigation: 'WebAuthn UV + RP ID binding', residual: 'User must verify domain' },
];

export function SecuritySection() {
  const { ref, visible } = useScrollReveal();

  return (
    <div ref={ref} className={cn('lg-reveal space-y-10', visible && 'lg-revealed')}>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {CONTROLS.map((c, i) => (
          <div
            key={c.title}
            className="lg-feature-card lg-card-reveal flex gap-3"
            style={{ transitionDelay: visible ? `${i * 0.07}s` : '0s' }}
          >
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#007dfc]" />
            <div>
              <h3 className="text-sm font-semibold text-[#012b54]">{c.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-[#64748b]">{c.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#eef0f3]">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[#eef0f3] bg-[#fafbfd]">
              <th className="px-4 py-3 font-semibold text-[#012b54]">Threat</th>
              <th className="px-4 py-3 font-semibold text-[#012b54]">Mitigation</th>
              <th className="px-4 py-3 font-semibold text-[#012b54]">Residual risk</th>
            </tr>
          </thead>
          <tbody>
            {THREATS.map((row) => (
              <tr key={row.threat} className="border-b border-[#eef0f3] last:border-0">
                <td className="px-4 py-3 text-[#012b54]">{row.threat}</td>
                <td className="px-4 py-3 text-[#31485f]">{row.mitigation}</td>
                <td className="px-4 py-3 text-[#64748b]">{row.residual}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-center text-xs text-[#94a3b8]">
        Testnet only. Session uses the Default context rule (broader than a per-contract CallContract rule); local
        session revoke does not remove the on-chain rule until ledger expiry.
      </p>
    </div>
  );
}
