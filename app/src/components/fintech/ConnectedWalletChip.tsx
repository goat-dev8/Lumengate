import { motion } from 'framer-motion';
import { LogOut } from 'lucide-react';
import { cn, truncateMiddle } from '../../lib/utils';
import { WalletKeysIcon } from './WalletKeysIcon';

type Props = {
  address: string;
  walletName?: string | null;
  onDisconnect: () => void;
  variant?: 'sidebar' | 'topbar' | 'navbar';
  className?: string;
};

export function ConnectedWalletChip({
  address,
  walletName,
  onDisconnect,
  variant = 'topbar',
  className,
}: Props) {
  const short = truncateMiddle(address, variant === 'sidebar' ? 8 : 6, variant === 'sidebar' ? 6 : 4);
  const label = walletName ?? 'Stellar wallet';

  if (variant === 'sidebar') {
    return (
      <motion.div
        className={cn('fin-wallet-chip fin-wallet-chip-sidebar', className)}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        <span className="fin-wallet-live" aria-hidden />
        <WalletKeysIcon className="fin-wallet-chip-sidebar-logo h-5 w-5" />
        <span className="fin-wallet-chip-sidebar-meta min-w-0 flex-1">
          <span className="block truncate text-[10px] font-semibold uppercase text-white/50">{label}</span>
          <span className="fin-wallet-chip-sidebar-addr block font-mono">{short}</span>
        </span>
        <button
          type="button"
          className="fin-wallet-chip-disconnect fin-wallet-chip-sidebar-disconnect"
          onClick={onDisconnect}
          aria-label="Disconnect wallet"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={cn('fin-wallet-chip', `fin-wallet-chip-${variant}`, className)}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      <span className="fin-wallet-live" aria-hidden />
      <span className="fin-wallet-chip-icon fin-wallet-chip-icon-freighter">
        <WalletKeysIcon className="h-4 w-4" />
      </span>
      <span className="fin-wallet-chip-meta">
        <span className="fin-wallet-chip-brand">{label}</span>
        <span className="fin-wallet-chip-addr font-mono">{short}</span>
      </span>
      <button
        type="button"
        className="fin-wallet-chip-disconnect"
        onClick={onDisconnect}
        aria-label="Disconnect wallet"
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}
