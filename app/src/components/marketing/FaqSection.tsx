import { ChevronDown } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { cn } from '../../lib/cn';

const FAQS = [
  {
    q: 'What network does Lumengate run on today?',
    a: 'Stellar Soroban testnet only. The Hero badge on this page ("Live on Stellar testnet") reflects the current deployment — there is no mainnet deployment.',
  },
  {
    q: 'Does Lumengate custody my keys?',
    a: 'No. Authorization is a WebAuthn passkey bound to a LumengateSmartAccount. Lumengate never holds a private key that can move your funds.',
  },
  {
    q: 'How long does a session last?',
    a: 'Up to 7 days. A delegated Ed25519 signer is installed after your passkey confirms eligibility, so you are not prompted for Face ID or a PIN on every shield, merge, send, or marketplace settlement. Sessions can be revoked locally at any time and expire at ledger TTL.',
  },
  {
    q: 'What stays private, and what is on the public ledger?',
    a: 'Raw eligibility inputs (accreditation, sanctions status, jurisdiction, age) never reach the chain — only a Merkle root, policy ID, asset ID, action ID, and a scoped nullifier do. Public USDC/EURC settlement amounts and counterparties are visible on-chain by design. Confidential EURC and USDC amounts are hidden behind Pedersen commitments and only revealed through an explicit viewing key.',
  },
  {
    q: 'Who can see a confidential transfer amount?',
    a: 'Only the sender and receiver by default. An auditor can decrypt one specific transfer only if given a viewing key scoped to that receipt — there is no blanket visibility into confidential balances.',
  },
  {
    q: 'Can the same passport be reused across assets?',
    a: 'Yes. One issuer-signed credential and proof covers every asset scope (RWA, USDC, EURC) that shares the required policy, so eligibility is proven once and reused, not re-verified per transaction.',
  },
];

export function FaqSection() {
  const { ref, visible } = useScrollReveal();

  return (
    <div ref={ref} className={cn('lg-reveal mx-auto max-w-3xl', visible && 'lg-revealed')}>
      <div className="divide-y divide-[#eef0f3] rounded-2xl border border-[#eef0f3] bg-white">
        {FAQS.map((item, i) => (
          <details key={item.q} className="lg-faq-item group" open={i === 0}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-[#012b54]">
              {item.q}
              <ChevronDown className="h-4 w-4 shrink-0 text-[#64748b] transition-transform group-open:rotate-180" />
            </summary>
            <p className="px-5 pb-4 text-sm leading-relaxed text-[#64748b]">{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
