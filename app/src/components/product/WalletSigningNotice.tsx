import { Wallet } from 'lucide-react';

type Props = {
  compact?: boolean;
};

/** Honest copy: Freighter signs settlements; passkey is optional device security only. */
export function WalletSigningNotice({ compact }: Props) {
  return (
    <div
      className={`rounded-xl border border-[#dbeafe] bg-[#eff6ff] ${
        compact ? 'px-4 py-3 text-sm' : 'px-5 py-4'
      } text-[#1e3a5f]`}
    >
      <p className="flex items-start gap-2 font-medium">
        <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-[#007dfc]" />
        Settlements are signed with your Stellar wallet
      </p>
      <p className={`${compact ? 'mt-1' : 'mt-2'} text-sm text-[#475569]`}>
        Freighter (or your connected wallet) approves each transfer. Optional passkeys only secure this browser —
        they do not replace wallet signing yet.
      </p>
    </div>
  );
}
