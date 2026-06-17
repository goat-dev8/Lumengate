import { useId } from 'react';

export function WalletKeysIcon({ className = 'h-5 w-5' }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  const grad = `wk-keys-${id}`;

  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden>
      <defs>
        <linearGradient id={grad} x1="2" y1="6" x2="30" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="45%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <circle cx="9" cy="13" r="5" stroke={`url(#${grad})`} strokeWidth="2.2" />
      <path
        d="M14 13h9.5v2.2h-2.2v4.2h-2.2v-4.2H14v-2.2z"
        stroke={`url(#${grad})`}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="23" cy="19" r="5" stroke={`url(#${grad})`} strokeWidth="2.2" />
      <path
        d="M18 19H8.5v-2.2h2.2v-4.2h2.2v4.2H18v2.2z"
        stroke={`url(#${grad})`}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
