import { KeyRound, Fingerprint, Clock } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { cn } from '../../lib/cn';
import { SmartAccountSessionDiagram } from './SmartAccountSessionDiagram';

const FACTS = [
  {
    icon: Fingerprint,
    title: 'Passkey, not a seed phrase',
    detail: 'WebAuthn secp256r1 credentials are device-bound and phishing-resistant.',
  },
  {
    icon: KeyRound,
    title: 'A smart account enforces the rules',
    detail: '`LumengateSmartAccount.__check_auth` requires passkey signer, compliance policy, and a session-bound proof together.',
  },
  {
    icon: Clock,
    title: '7-day session, revocable locally',
    detail: 'A delegated Ed25519 signer reuses eligibility across shield, merge, send, and marketplace settlement.',
  },
];

export function IdentityWithoutExposureSection() {
  const { ref, visible } = useScrollReveal();

  return (
    <div ref={ref} className={cn('lg-reveal', visible && 'lg-revealed')}>
      <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div className="space-y-5">
          {FACTS.map((fact, i) => (
            <div
              key={fact.title}
              className="lg-feature-card lg-card-reveal flex gap-4"
              style={{ transitionDelay: visible ? `${i * 0.1}s` : '0s' }}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0f6ff]">
                <fact.icon className="h-5 w-5 text-[#007dfc]" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#012b54]">{fact.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-[#64748b]">{fact.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <SmartAccountSessionDiagram />
      </div>
    </div>
  );
}
