import { useState } from 'react';
import { ChevronDown, ChevronUp, Wallet, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DeploymentConfig } from '../../lib/config';
import { TestnetFaucetPanel } from './TestnetFaucetPanel';
import { FundSmartAccountPanel } from './FundSmartAccountPanel';
import { microcopy } from '../../lib/microcopy';
import { cn } from '../../lib/cn';

type Props = {
  config: DeploymentConfig;
  smartAccountAddress: string;
  hasFundingWallet: boolean;
  onConnectWallet?: () => void;
  connectingWallet?: boolean;
  onFundUsdc: (amount: string) => Promise<string>;
  onFundEurc?: (amount: string) => Promise<string>;
  onFundXlm: (amount: string) => Promise<string>;
  onFunded?: () => void;
  /** Inline trigger instead of floating */
  variant?: 'drawer' | 'inline';
  className?: string;
};

export function FundsDrawer({
  config,
  smartAccountAddress,
  hasFundingWallet,
  onConnectWallet,
  connectingWallet,
  onFundUsdc,
  onFundEurc,
  onFundXlm,
  onFunded,
  variant = 'drawer',
  className,
}: Props) {
  const [open, setOpen] = useState(variant === 'inline');
  const [showWalletFund, setShowWalletFund] = useState(false);

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-[var(--lg-border)] bg-white px-4 py-2 text-sm font-medium text-[#012b54] transition hover:bg-[var(--lg-muted-bg)] lg-focus-ring',
        className,
      )}
    >
      <Wallet className="h-4 w-4 text-[#007dfc]" />
      {microcopy.send.addFunds}
      {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
    </button>
  );

  const panel = (
    <div className="space-y-4">
      <TestnetFaucetPanel
        config={config}
        smartAccountAddress={smartAccountAddress}
        onClaimed={onFunded}
      />
      {hasFundingWallet ? (
        <div>
          <button
            type="button"
            className="text-sm font-medium text-[#007dfc] hover:underline"
            onClick={() => setShowWalletFund((v) => !v)}
          >
            {showWalletFund ? 'Hide wallet transfer' : 'Transfer from connected wallet'}
          </button>
          {showWalletFund ? (
            <div className="mt-3">
              <FundSmartAccountPanel
                config={config}
                smartAccountAddress={smartAccountAddress}
                onFundUsdc={onFundUsdc}
                onFundEurc={onFundEurc}
                onFundXlm={onFundXlm}
                onFunded={onFunded}
                compact
              />
            </div>
          ) : null}
        </div>
      ) : onConnectWallet ? (
        <div className="rounded-xl border border-[var(--lg-border)] bg-[#f6f9fc] p-4 text-sm text-[#64748b]">
          <p>Connect a wallet in Settings when you need to transfer funds manually.</p>
          <button
            type="button"
            disabled={connectingWallet}
            onClick={onConnectWallet}
            className="mt-3 text-sm font-semibold text-[#007dfc] hover:underline disabled:opacity-50"
          >
            {connectingWallet ? 'Connecting…' : 'Connect wallet in Settings →'}
          </button>
        </div>
      ) : null}
    </div>
  );

  if (variant === 'inline') {
    return (
      <div className={className}>
        {trigger}
        <AnimatePresence>
          {open ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 overflow-hidden"
            >
              {panel}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <>
      {trigger}
      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-[#012b54]/30 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border border-[var(--lg-border)] bg-white p-6 shadow-2xl md:inset-x-auto md:left-1/2 md:w-full md:max-w-lg md:-translate-x-1/2"
              role="dialog"
              aria-modal="true"
              aria-labelledby="funds-drawer-title"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 id="funds-drawer-title" className="text-lg font-semibold text-[#012b54]">
                  {microcopy.send.addFunds}
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="lg-focus-ring rounded-lg p-2 text-[#64748b] hover:bg-[var(--lg-muted-bg)]"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {panel}
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
