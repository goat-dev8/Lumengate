import { Badge } from '../ui/Badge';
import { truncateMiddle } from '../../lib/utils';

type Props = {
  issuer: string;
  status: { text: string; tone: 'ok' | 'warn' | 'err' | 'neutral' };
  policy: string;
  expiration: string;
  wallet: string | null;
  claims: string[];
  hasCredential?: boolean;
};

const TRUST_ITEMS = [
  'Ethereum signed',
  'Merkle verified',
  'Revocation checked',
  'Wallet bound',
  'ZK eligible',
];

export function PassportHeroCard({ issuer, status, policy, expiration, wallet, claims, hasCredential }: Props) {
  return (
    <div className="lg-passport-wrap">
      <div className="lg-passport-card">
        <div className="lg-passport-shine" aria-hidden />
        <div className="lg-passport-top">
          <div className="lg-passport-chip" aria-hidden />
          <Badge tone={status.tone}>{status.text}</Badge>
        </div>
        <p className="lg-passport-brand">Lumengate</p>
        <h2 className="lg-passport-title">Compliance Passport</h2>
        <div className="lg-passport-meta">
          <div>
            <span className="lg-passport-meta-label">Issuer</span>
            <span className="lg-passport-meta-value">{issuer}</span>
          </div>
          <div>
            <span className="lg-passport-meta-label">Policy</span>
            <span className="lg-passport-meta-value">{policy}</span>
          </div>
          <div>
            <span className="lg-passport-meta-label">Expires</span>
            <span className="lg-passport-meta-value">{expiration}</span>
          </div>
          <div>
            <span className="lg-passport-meta-label">Wallet</span>
            <span className="lg-passport-meta-value font-mono">
              {wallet ? truncateMiddle(wallet, 8, 6) : 'Not bound'}
            </span>
          </div>
        </div>
        {claims.length > 0 ? (
          <div className="lg-passport-claims">
            <span className="lg-passport-meta-label">Verified attributes</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {claims.map((c) => (
                <span key={c} className="lg-verified-chip">
                  <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden>
                    <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  {c}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="lg-trust-panel">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">Trust chain</p>
        <ul className="mt-3 space-y-2">
          {TRUST_ITEMS.map((label) => (
            <li key={label} className={`lg-trust-row ${!hasCredential ? 'opacity-40' : ''}`}>
              <span className="lg-trust-check">✓</span>
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
