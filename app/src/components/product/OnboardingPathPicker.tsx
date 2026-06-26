import { Link } from 'react-router-dom';
import { Fingerprint, Wallet } from 'lucide-react';
import { cn } from '../../lib/cn';

export type OnboardingPath = 'passkey' | 'wallet';

const STORAGE_KEY = 'lumengate_onboarding_path';

export function getOnboardingPath(): OnboardingPath {
  if (typeof window === 'undefined') return 'passkey';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'wallet' ? 'wallet' : 'passkey';
}

export function setOnboardingPath(path: OnboardingPath): void {
  window.localStorage.setItem(STORAGE_KEY, path);
}

export function OnboardingPathPicker({ compact = false }: { compact?: boolean }) {
  const current = getOnboardingPath();

  return (
    <div
      className={cn(
        'grid gap-3',
        compact ? 'sm:grid-cols-2' : 'md:grid-cols-2',
      )}
    >
      <Link
        to="/app/verify"
        onClick={() => setOnboardingPath('passkey')}
        className={cn(
          'lg-surface-card lg-surface-card-hover flex items-start gap-4 p-5 text-left transition-colors',
          current === 'passkey' && 'ring-2 ring-[#007dfc]/30',
        )}
      >
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#007dfc]/10 text-[#007dfc]">
          <Fingerprint className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold text-[#012b54]">Continue with passkey</p>
          <p className="mt-1 text-sm text-[#64748b]">
            Create your smart account first. Connect a wallet only when you need to add funds.
          </p>
        </div>
      </Link>
      <Link
        to="/app/verify?path=wallet"
        onClick={() => setOnboardingPath('wallet')}
        className={cn(
          'lg-surface-card lg-surface-card-hover flex items-start gap-4 p-5 text-left transition-colors',
          current === 'wallet' && 'ring-2 ring-[#007dfc]/30',
        )}
      >
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--lg-muted-bg)] text-[#012b54]">
          <Wallet className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold text-[#012b54]">Connect wallet first</p>
          <p className="mt-1 text-sm text-[#64748b]">
            Classic flow — link Freighter, deploy passkey smart account, then verify eligibility.
          </p>
        </div>
      </Link>
    </div>
  );
}
