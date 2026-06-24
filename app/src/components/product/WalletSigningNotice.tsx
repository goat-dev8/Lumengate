import { KeyRound } from 'lucide-react';

type Props = {
  compact?: boolean;
};

export function WalletSigningNotice({ compact }: Props) {
  return (
    <div
      className={`rounded-xl border border-[#dbeafe] bg-[#eff6ff] ${
        compact ? 'px-4 py-3 text-sm' : 'px-5 py-4'
      } text-[#1e3a5f]`}
    >
      <p className="flex items-start gap-2 font-medium">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[#007dfc]" />
        Smart account authorization
      </p>
      <p className={`${compact ? 'mt-1' : 'mt-2'} text-sm text-[#475569]`}>
        Your passkey authorizes settlement from your personal smart account. Wallets are used for onboarding or fee-payer fallback.
      </p>
    </div>
  );
}
