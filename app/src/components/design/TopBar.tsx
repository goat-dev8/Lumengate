import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Command, Search } from 'lucide-react';
import { StatusDot } from './Primitives';

export type PasskeyTopBarStatus = 'ready' | 'setup' | 'needed' | 'loading';

export function TopBar({
  title,
  subtitle,
  actions,
  passkeyStatus = 'needed',
  onSearch,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  passkeyStatus?: PasskeyTopBarStatus;
  onSearch?: (query: string) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const runSearch = useCallback(
    (raw: string) => {
      const q = raw.trim();
      if (!q) return;
      if (onSearch) {
        onSearch(q);
        return;
      }
      if (/^[a-f0-9]{64}$/i.test(q)) {
        navigate(`/app/compliance?tx=${q}`);
        return;
      }
      if (/^G[A-Z0-9]{55}$/.test(q)) {
        navigate(`/app/send?to=${encodeURIComponent(q)}`);
        return;
      }
      navigate(`/app/marketplace?q=${encodeURIComponent(q)}`);
    },
    [navigate, onSearch],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        document.getElementById('lg-global-search')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const passkeyLabel =
    passkeyStatus === 'ready'
      ? 'Passkey ready'
      : passkeyStatus === 'setup'
        ? 'Passkey set up'
        : passkeyStatus === 'loading'
          ? 'Checking passkey…'
          : 'Passkey needed';

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--lg-border)] bg-[var(--lg-background)]/90 backdrop-blur-md supports-[backdrop-filter]:bg-[var(--lg-background)]/75">
      <div className="flex h-16 items-center gap-4 px-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold tracking-tight text-[#012b54] md:text-base">{title}</h1>
          {subtitle ? <p className="truncate text-xs text-[#64748b]">{subtitle}</p> : null}
        </div>

        <form
          className="hidden md:flex w-[min(320px,28vw)] items-center gap-2 rounded-full border border-[var(--lg-border)] bg-white px-3 py-1.5 text-sm text-[#64748b] shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(query);
          }}
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden />
          <input
            id="lg-global-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search receipts, products, addresses…"
            className="min-w-0 flex-1 bg-transparent text-sm text-[#012b54] outline-none placeholder:text-[#94a3b8]"
            aria-label="Search receipts, products, and addresses"
          />
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--lg-border)] px-1.5 py-0.5 text-[10.5px] text-[#64748b]">
            <Command className="h-3 w-3" aria-hidden />
            K
          </span>
        </form>

        {actions}

        <button
          type="button"
          className="inline-grid h-9 w-9 place-items-center rounded-full border border-[var(--lg-border)] bg-white hover:bg-[var(--lg-muted-bg)]"
          aria-label="Notifications"
          onClick={() => navigate('/app/home#activity')}
        >
          <Bell className="h-4 w-4 text-[#012b54]" />
        </button>

        <div
          className={`hidden md:flex items-center gap-2 rounded-full border px-3 py-1.5 ${
            passkeyStatus === 'ready'
              ? 'border-emerald-200 bg-emerald-50/80'
              : 'border-[var(--lg-border)] bg-white'
          }`}
        >
          <StatusDot
            tone={
              passkeyStatus === 'ready'
                ? 'success'
                : passkeyStatus === 'needed'
                  ? 'neutral'
                  : 'warning'
            }
          />
          <span className="text-xs font-medium text-[#012b54]">{passkeyLabel}</span>
        </div>
      </div>
    </header>
  );
}
