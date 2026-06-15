import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { WalletKeysIcon } from './WalletKeysIcon';

type Props = {
  loading?: boolean;
  onClick: () => void;
  variant?: 'sidebar' | 'topbar' | 'navbar';
  className?: string;
  fullWidth?: boolean;
};

export function ConnectWalletButton({
  loading,
  onClick,
  variant = 'topbar',
  className,
  fullWidth,
}: Props) {
  return (
    <motion.button
      type="button"
      disabled={loading}
      onClick={onClick}
      className={cn(
        'fin-connect-wallet',
        `fin-connect-wallet-${variant}`,
        fullWidth && 'w-full',
        loading && 'fin-connect-wallet-loading',
        className,
      )}
      whileHover={loading ? undefined : { y: -2, scale: 1.01 }}
      whileTap={loading ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      aria-label={loading ? 'Connecting Stellar wallet' : 'Connect Stellar wallet'}
    >
      <span className="fin-connect-wallet-glow" aria-hidden />
      <span className="fin-connect-wallet-icon-wrap" aria-hidden>
        <span className="fin-connect-wallet-icon-ring fin-connect-wallet-icon-ring-freighter" />
        <span className="fin-connect-wallet-icon fin-connect-wallet-icon-freighter">
          {loading ? (
            <span className="fin-connect-wallet-spinner" />
          ) : (
            <WalletKeysIcon className="fin-connect-wallet-freighter h-5 w-5" />
          )}
        </span>
      </span>
      <span className="fin-connect-wallet-text">
        <span className="fin-connect-wallet-label">
          {loading ? 'Connecting…' : 'Connect Wallet'}
        </span>
        {!loading && variant === 'sidebar' ? (
          <span className="fin-connect-wallet-sublabel">Stellar Wallets Kit</span>
        ) : null}
      </span>
      <span className="fin-connect-wallet-shine" aria-hidden />
    </motion.button>
  );
}
