import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ConnectWalletButton } from '../fintech/ConnectWalletButton';
import { ConnectedWalletChip } from '../fintech/ConnectedWalletChip';
import { FreighterInstallHint } from '../fintech/FreighterInstallHint';
import { NAV_ICONS } from '../fintech/NavIcons';

const nav = [
  { to: '/app/home', label: 'Home', icon: 'dashboard' as const },
  { to: '/app/verify', label: 'Verify', icon: 'passport' as const },
  { to: '/app/send', label: 'Send', icon: 'marketplace' as const },
  { to: '/app/auditor', label: 'Auditor', icon: 'compliance' as const },
  { to: '/app/admin', label: 'Admin', icon: 'settings' as const },
];

function SidebarBrand() {
  return (
    <Link to="/" className="fin-sidebar-brand group">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#007dfc] shadow-[0_4px_14px_rgba(0,125,252,0.35)] transition-transform group-hover:scale-105">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" aria-hidden>
          <path d="M12 2L4 7v10l8 5 8-5V7l-8-5z" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 8v8M8 10l4 2 4-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <div>
        <span className="block text-[15px] font-semibold tracking-tight text-white">Lumengate X</span>
        <span className="block text-[11px] text-white/45">Compliance layer for Stellar</span>
      </div>
    </Link>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="fin-sidebar-nav">
      {nav.map((item) => {
        const Icon = NAV_ICONS[item.icon];
        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `fin-sidebar-link ${isActive ? 'fin-sidebar-link-active' : ''}`
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

function SidebarFooter({
  address,
  walletName,
  disconnect,
  connect,
  connecting,
}: {
  address: string | null;
  walletName?: string | null;
  disconnect: () => void;
  connect: () => void;
  connecting: boolean;
}) {
  return (
    <div className="fin-sidebar-footer">
      {address ? (
        <ConnectedWalletChip
          address={address}
          walletName={walletName}
          onDisconnect={disconnect}
          variant="sidebar"
          className="hidden w-full lg:flex"
        />
      ) : (
        <div className="hidden w-full lg:block">
          <ConnectWalletButton
            variant="sidebar"
            fullWidth
            loading={connecting}
            onClick={() => connect()}
          />
          <FreighterInstallHint variant="sidebar" className="mt-2" />
        </div>
      )}
    </div>
  );
}

function SidebarPanel({
  address,
  walletName,
  disconnect,
  connect,
  connecting,
  onNavigate,
}: {
  address: string | null;
  walletName?: string | null;
  disconnect: () => void;
  connect: () => void;
  connecting: boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      <SidebarBrand />
      <SidebarNav onNavigate={onNavigate} />
      <SidebarFooter
        address={address}
        walletName={walletName}
        disconnect={disconnect}
        connect={connect}
        connecting={connecting}
      />
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { address, connect, connecting, disconnect, walletModuleName } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="fin-shell">
      <aside className="fin-sidebar-fixed hidden lg:flex">
        <SidebarPanel
          address={address}
          walletName={walletModuleName}
          disconnect={disconnect}
          connect={() => connect()}
          connecting={connecting}
        />
      </aside>

      <div className="fin-main-wrap">
        <header className="fin-topbar">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-ink-mute hover:bg-canvas-soft lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-medium text-ink-mute lg:hidden">Lumengate X</span>
          </div>
          <div className="flex items-center gap-3">
            {address ? (
              <ConnectedWalletChip
                address={address}
                walletName={walletModuleName}
                onDisconnect={disconnect}
                variant="topbar"
              />
            ) : (
              <ConnectWalletButton
                variant="topbar"
                loading={connecting}
                onClick={() => connect()}
              />
            )}
          </div>
        </header>

        <AnimatePresence>
          {mobileOpen ? (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-ink/50 lg:hidden"
                onClick={() => setMobileOpen(false)}
              />
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                className="fin-sidebar-fixed lg:hidden"
              >
                <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
                  <span className="font-semibold text-white">Menu</span>
                  <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                    <X className="h-5 w-5 text-white/60" />
                  </button>
                </div>
                <SidebarPanel
                  address={address}
                  walletName={walletModuleName}
                  disconnect={disconnect}
                  connect={() => connect()}
                  connecting={connecting}
                  onNavigate={() => setMobileOpen(false)}
                />
              </motion.aside>
            </>
          ) : null}
        </AnimatePresence>

        <main className="flex-1">
          <div className="fin-page">{children}</div>
        </main>
      </div>
    </div>
  );
}
