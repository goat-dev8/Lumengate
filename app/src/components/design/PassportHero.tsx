import { motion } from 'framer-motion';
import { Check, Eye, EyeOff, Fingerprint, ShieldCheck } from 'lucide-react';
import { Pill } from './Primitives';
import type { IssuerCredentialResponse } from '../../lib/config';
import { phaseLabel, type PassportPhase } from '../../lib/passportLifecycle';
import { policyByKey, type PolicyKey } from '../../lib/policies';
import { credentialExpiryMs } from '../../lib/passport';
import { issuerDisplayLabel } from '../../lib/issuer';

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

function formatRelativeTime(ts?: number): string {
  if (!ts) return '—';
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function formatExpiry(credential: IssuerCredentialResponse | null): string {
  if (!credential) return '—';
  const ms = credential.expiresAt ?? credentialExpiryMs(credential);
  const days = Math.ceil((ms - Date.now()) / 86_400_000);
  if (days < 0) return 'Expired';
  if (days === 0) return 'Today';
  return `In ${days} day${days === 1 ? '' : 's'}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
      <p className="text-[10.5px] uppercase tracking-[0.14em] text-white/55">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

export function PassportHero({
  phase,
  credential,
  policyKey,
  settlementAddress,
}: {
  phase: PassportPhase;
  credential: IssuerCredentialResponse | null;
  policyKey: PolicyKey;
  settlementAddress: string | null;
}) {
  const policy = policyByKey(policyKey);
  const active = phase === 'proof-generated';
  const issuer = credential ? issuerDisplayLabel(credential) : '—';

  return (
    <>
      <motion.section
        initial={{ y: 14 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-3xl lg-gradient-passport p-8 lg-shadow-lift md:p-10"
        style={{
          backgroundImage: 'linear-gradient(140deg, #012b54 0%, #0d253d 50%, #1a4a8a 100%)',
        }}
      >
        <div className="pointer-events-none absolute inset-0 lg-grid-bg opacity-10" />
        <div className="relative grid items-center gap-10 md:grid-cols-[1.2fr_1fr]">
          <div>
            <Pill tone="brand" className="border-white/20 bg-white/10 text-white">
              <ShieldCheck className="h-3 w-3" />
              {active ? 'Credential active' : phaseLabel(phase)}
            </Pill>
            <h2 className="mt-5 lg-font-display text-5xl leading-tight tracking-tight text-white md:text-6xl">
              Your eligibility,
              <br />
              <span className="italic text-[#5eb0ff]">selectively disclosed.</span>
            </h2>
            <p className="mt-4 max-w-md text-sm text-white/70">
              The passport is a privacy-preserving credential. The issuer confirms policy — you generate a
              zero-knowledge proof locally, and only what the offering requires reaches the chain.
            </p>
            <div className="mt-7 grid max-w-md grid-cols-2 gap-3">
              <Stat label="Issuer" value={issuer} />
              <Stat label="Issued" value={formatRelativeTime(credential?.issuedAt)} />
              <Stat label="Policy" value={policy.title} />
              <Stat label="Expiry" value={formatExpiry(credential)} />
            </div>
            <p className="mt-3 max-w-md font-mono text-[11px] text-white/50">
              Smart account: {settlementAddress ? `${settlementAddress.slice(0, 10)}…${settlementAddress.slice(-6)}` : 'Not created'}
            </p>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <motion.div
              initial={{ rotate: -6, y: 20, opacity: 0 }}
              animate={{ rotate: -4, y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="rounded-2xl bg-white/5 p-3 backdrop-blur-md ring-1 ring-white/10"
            >
              <img
                src="/design/product-passport.jpg"
                alt="Passport credential"
                className="w-full rounded-xl"
                loading="lazy"
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="absolute -bottom-4 -left-4 rounded-2xl border border-white/15 bg-[#012b54]/80 px-4 py-3 text-xs backdrop-blur"
            >
              <div className="flex items-center gap-2 text-white">
                <Fingerprint className="h-4 w-4" />
                <span className="font-medium">Passkey · WebAuthn</span>
              </div>
              <p className="mt-1 text-white/60">Signs every settlement locally</p>
            </motion.div>
          </div>
        </div>
      </motion.section>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="lg-surface-card p-6">
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
        </div>
        <div className="lg-surface-card p-6">
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
        </div>
      </div>
    </>
  );
}
