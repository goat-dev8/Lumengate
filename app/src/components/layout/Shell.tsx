import { useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  X,
  Home,
  ShieldCheck,
  Store,
  Send,
  FileText,
  Search,
  Settings2,
  ListChecks,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ConnectWalletButton } from '../fintech/ConnectWalletButton';
import { ConnectedWalletChip } from '../fintech/ConnectedWalletChip';
import { FreighterInstallHint } from '../fintech/FreighterInstallHint';
import { StatusDot } from '../design/Primitives';
import { cn } from '../../lib/cn';
import { fetchLatestLedger } from '../../lib/horizonLedger';

const navGroups = [
  {
    group: 'Workspace',
    items: [
      { to: '/app/home', label: 'Home', icon: Home, end: true },
      { to: '/app/verify', label: 'Passport', icon: ShieldCheck },
      { to: '/app/marketplace', label: 'Marketplace', icon: Store },
      { to: '/app/activity', label: 'Activity', icon: ListChecks },
    ],
  },
  {
    group: 'Treasury',
    items: [
      { to: '/app/send', label: 'Send', icon: Send },
      { to: '/app/compliance', label: 'Receipts', icon: FileText },
    ],
  },
  {
    group: 'Compliance',
    items: [
      { to: '/app/auditor', label: 'Audit', icon: Search },
      { to: '/app/admin', label: 'Operators', icon: Settings2 },
      { to: '/app/settings', label: 'Settings', icon: SlidersHorizontal },
    ],
  },
];

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function SidebarBrand() {
  return (
    <Link to="/app/home" className="flex items-center gap-3 px-5 py-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#007dfc] shadow-[0_4px_14px_rgba(0,125,252,0.35)]">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" aria-hidden>
          <path d="M12 2L4 7v10l8 5 8-5V7l-8-5z" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 8v8M8 10l4 2 4-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <div>
        <span className="block text-[15px] font-semibold tracking-tight text-[#012b54]">Lumengate</span>
        <span className="block text-[11px] text-[#64748b]">Private access for Stellar</span>
      </div>
    </Link>
  );
}

function AccountChip({
  settlementAddress,
  walletAddress,
}: {
  settlementAddress: string | null;
  walletAddress: string | null;
}) {
  const display = settlementAddress ?? walletAddress;
  if (!display) {
    return <p className="text-xs text-[#64748b]">Create a passkey account to begin</p>;
  }
  return (
    <div className="rounded-xl border border-[var(--lg-sidebar-border)] bg-white/60 p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">Smart account</p>
          <p className="mt-0.5 truncate text-sm font-medium text-[#012b54]">
            {settlementAddress ? 'Lumengate account' : 'Funding wallet'}
          </p>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#64748b]" aria-hidden />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="rounded-md bg-[var(--lg-muted-bg)] px-1.5 py-0.5 font-mono text-[10px] text-[#64748b]">
          {truncateAddress(display)}
        </span>
        <span className="inline-flex items-center gap-1.5 text-emerald-600">
          <StatusDot />
          {settlementAddress ? 'Live' : 'Connected'}
        </span>
      </div>
    </div>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 overflow-y-auto px-2.5 pb-4">
      {navGroups.map((group) => (
        <div key={group.group} className="mb-4">
          <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
            {group.group}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn('lg-sidebar-link-v2', isActive && 'lg-sidebar-link-v2-active')
                    }
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function NetworkFooter() {
  const { config } = useApp();
  const [ledger, setLedger] = useState<number | null>(null);

  useEffect(() => {
    fetchLatestLedger(config).then(setLedger).catch(() => setLedger(null));
    const id = window.setInterval(() => {
      fetchLatestLedger(config).then(setLedger).catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(id);
  }, [config]);

  return (
    <div className="rounded-xl lg-gradient-passport p-3 text-white shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">Network</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Stellar · Testnet</span>
        <StatusDot />
      </div>
      <p className="mt-1.5 text-[11px] text-white/70">
        {ledger ? `Ledger #${ledger.toLocaleString()}` : 'Fetching ledger…'}
      </p>
    </div>
  );
}

function SidebarPanel({
  settlementAddress,
  address,
  walletName,
  disconnect,
  connect,
  connecting,
  onNavigate,
}: {
  settlementAddress: string | null;
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
      <div className="mx-3 mb-3">
        <AccountChip settlementAddress={settlementAddress} walletAddress={address} />
      </div>
      <SidebarNav onNavigate={onNavigate} />
      <div className="mt-auto space-y-2 border-t border-[var(--lg-sidebar-border)] p-3">
        {address ? (
          <ConnectedWalletChip
            address={address}
            walletName={walletName}
            onDisconnect={disconnect}
            variant="sidebar"
            className="w-full"
          />
        ) : (
          <>
            <ConnectWalletButton variant="sidebar" fullWidth loading={connecting} onClick={() => connect()} />
            <FreighterInstallHint variant="sidebar" />
          </>
        )}
        <NetworkFooter />
      </div>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { address, connect, connecting, disconnect, walletModuleName, settlementAddress } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-dvh bg-[var(--lg-background)]">
      <aside className="lg-sidebar-v2 hidden md:flex">
        <SidebarPanel
          settlementAddress={settlementAddress}
          address={address}
          walletName={walletModuleName}
          disconnect={disconnect}
          connect={() => connect()}
          connecting={connecting}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--lg-border)] bg-[var(--lg-background)]/90 px-4 backdrop-blur-md md:hidden">
          <button
            type="button"
            className="rounded-lg p-2 text-[#64748b] hover:bg-[var(--lg-muted-bg)]"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-[#012b54]">Lumengate</span>
          {address ? (
            <ConnectedWalletChip
              address={address}
              walletName={walletModuleName}
              onDisconnect={disconnect}
              variant="topbar"
            />
          ) : (
            <ConnectWalletButton variant="topbar" loading={connecting} onClick={() => connect()} />
          )}
        </header>

        <AnimatePresence>
          {mobileOpen ? (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-[#012b54]/40 md:hidden"
                onClick={() => setMobileOpen(false)}
              />
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                className="lg-sidebar-v2-drawer md:hidden"
              >
                <div className="flex h-14 items-center justify-between border-b border-[var(--lg-sidebar-border)] px-4">
                  <span className="font-semibold text-[#012b54]">Menu</span>
                  <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                    <X className="h-5 w-5 text-[#64748b]" />
                  </button>
                </div>
                <SidebarPanel
                  settlementAddress={settlementAddress}
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

        {children}
      </div>
    </div>
  );
}
