import { useScrollReveal } from '../../hooks/useScrollReveal';
import { cn } from '../../lib/cn';
import { AuditorDisclosureDiagram } from './AuditorDisclosureDiagram';

const TERMS = [
  {
    label: 'Viewing key',
    detail: '256-bit read-only capability token (`lgvk_…`), SHA-256 hashed for issuer lookup — not a wallet or passkey.',
  },
  {
    label: 'Disclosure pack',
    detail: 'Eligibility claims, public inputs, nullifier, and settlement tx — no legal name or government ID.',
  },
  {
    label: 'Auditor verification',
    detail: '`verifyAuditorInput()` checks the disclosure pack, public inputs, or nullifier client-side before any claim is trusted.',
  },
];

export function SelectiveDisclosureSection() {
  const { ref, visible } = useScrollReveal();

  return (
    <div ref={ref} className={cn('lg-reveal', visible && 'lg-revealed')}>
      <AuditorDisclosureDiagram />
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {TERMS.map((term, i) => (
          <div
            key={term.label}
            className="lg-feature-card lg-card-reveal"
            style={{ transitionDelay: visible ? `${i * 0.1}s` : '0s' }}
          >
            <h3 className="text-base font-semibold text-[#012b54]">{term.label}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#64748b]">{term.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
