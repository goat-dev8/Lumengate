import { Check, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { Stagger, StaggerItem } from './Primitives';

const PRIVATE_ITEMS = [
  'Legal name & address',
  'Date of birth',
  'Government ID number',
  'Source-of-funds documents',
  'Email & phone number',
];

const AUDITOR_ITEMS = [
  'Eligibility category',
  'Region attestation',
  'Sanctions-clear status',
  'Settlement amounts & timestamps',
  'Linked smart account address',
];

export function PassportPrivacySection() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6 border-t border-[var(--lg-border)] pt-12"
      aria-labelledby="passport-privacy-heading"
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">Learn more</p>
        <h2 id="passport-privacy-heading" className="mt-2 lg-font-display text-2xl tracking-tight text-[#012b54] md:text-3xl">
          Privacy &amp; disclosure
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-[#64748b]">
          Lumengate keeps personal data off-chain. Only what regulators need can be shared with an auditor viewing key.
        </p>
      </div>

      <Stagger className="grid gap-6 lg:grid-cols-2">
        <StaggerItem className="lg-surface-card p-6 transition-shadow hover:shadow-md">
          <div className="flex items-center gap-2">
            <EyeOff className="h-4 w-4 text-[#007dfc]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#007dfc]">Stays private</p>
          </div>
          <h3 className="mt-2 text-xl font-semibold text-[#012b54]">What never reaches the ledger</h3>
          <ul className="mt-4 space-y-3 text-sm">
            {PRIVATE_ITEMS.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-[#475569]">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--lg-muted-bg)]">
                  <Check className="h-3 w-3" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </StaggerItem>
        <StaggerItem className="lg-surface-card p-6 transition-shadow hover:shadow-md">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-emerald-600" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-600">Auditor can verify</p>
          </div>
          <h3 className="mt-2 text-xl font-semibold text-[#012b54]">What a viewing key unlocks</h3>
          <ul className="mt-4 space-y-3 text-sm">
            {AUDITOR_ITEMS.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-[#475569]">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                  <Check className="h-3 w-3" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </StaggerItem>
      </Stagger>
    </motion.section>
  );
}
