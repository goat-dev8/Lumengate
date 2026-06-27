import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Fingerprint, ShieldCheck, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { microcopy } from '../lib/microcopy';
import { setOnboardingPath } from '../components/product/OnboardingPathPicker';
import { PrivacySplitCard } from '../components/design/PrivacySplitCard';
import { loadPasskeySession } from '../lib/passkeySession';
import { useState } from 'react';

export function WelcomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const intent = searchParams.get('intent');
  const { signInWithPasskey, smartAccountCreating, createSmartAccount, config } = useApp();
  const [signingIn, setSigningIn] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasStoredSession = Boolean(loadPasskeySession()?.smartAccountAddress);

  const handleCreate = async () => {
    setError(null);
    setCreating(true);
    setOnboardingPath('passkey');
    try {
      await createSmartAccount();
      navigate('/app/verify?path=passkey');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const handleSignIn = async () => {
    setError(null);
    if (!hasStoredSession) {
      setError(microcopy.welcome.noAccount);
      return;
    }
    setSigningIn(true);
    try {
      await signInWithPasskey();
      navigate('/app/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSigningIn(false);
    }
  };

  const loading = signingIn || creating || smartAccountCreating;

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--lg-background)]">
      <header className="flex h-16 items-center justify-between border-b border-[var(--lg-border)] px-6">
        <Link to="/" className="text-sm font-semibold text-[#012b54]">
          ← Lumengate
        </Link>
        <span className="rounded-full bg-[#007dfc]/10 px-3 py-1 text-xs font-medium text-[#007dfc]">
          Stellar · {config.network}
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mb-8 flex justify-center">
            <div className="grid h-20 w-20 place-items-center rounded-2xl bg-[#007dfc] shadow-[0_8px_24px_rgba(0,125,252,0.35)]">
              <img src="/stellar-mark.svg" alt="" className="h-10 w-10" />
            </div>
          </div>

          <h1 className="text-center lg-font-display text-3xl tracking-tight text-[#012b54] md:text-4xl">
            {intent === 'return' ? microcopy.welcome.signIn : microcopy.welcome.title}
          </h1>
          <p className="mt-3 text-center text-base text-[#64748b]">{microcopy.welcome.subtitle}</p>

          <ul className="mt-8 space-y-3 text-sm text-[#334155]">
            {[
              { icon: Fingerprint, text: 'Sign in with passkey — no seed phrase' },
              { icon: ShieldCheck, text: 'Private Financial Passport for eligibility' },
              { icon: Sparkles, text: 'Institutional receipts on every settlement' },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 rounded-xl border border-[var(--lg-border)] bg-white px-4 py-3">
                <Icon className="h-5 w-5 shrink-0 text-[#007dfc]" />
                {text}
              </li>
            ))}
          </ul>

          <div className="mt-8 space-y-3">
            {intent !== 'return' ? (
              <button
                type="button"
                disabled={loading}
                onClick={handleCreate}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#007dfc] to-[#0056b3] py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,125,252,0.35)] transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                <Fingerprint className="h-4 w-4" />
                {creating || smartAccountCreating ? microcopy.account.creating : microcopy.welcome.createAccount}
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              disabled={loading}
              onClick={handleSignIn}
              className="w-full rounded-full border border-[var(--lg-border)] bg-white py-3.5 text-sm font-semibold text-[#012b54] transition hover:bg-[var(--lg-muted-bg)] disabled:opacity-60"
            >
              {signingIn ? 'Signing in…' : microcopy.welcome.signIn}
            </button>
            <p className="text-center text-xs text-[#64748b]">{microcopy.welcome.signInHint}</p>
          </div>

          {error ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-10">
            <PrivacySplitCard compact />
          </div>
        </motion.div>
      </main>
    </div>
  );
}
