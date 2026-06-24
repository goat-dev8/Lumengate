import { Wallet } from 'lucide-react';

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
        <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-[#007dfc]" />
        Settlements are signed before submission
      </p>
      <p className={`${compact ? 'mt-1' : 'mt-2'} text-sm text-[#475569]`}>
        Your connected Stellar wallet authorizes and funds the settlement transaction.
      </p>
    </div>
  );
}
