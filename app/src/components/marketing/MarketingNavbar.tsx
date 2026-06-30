import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getBrandHomeHref } from '../../lib/brandNav';

const links = [
  { href: '#architecture', label: 'Architecture' },
  { href: '#workflow', label: 'Workflow' },
  { href: '#protocols', label: 'Protocols' },
  { href: '#compare', label: 'Compare' },
  { href: '#metrics', label: 'Metrics' },
];

export function MarketingNavbar() {
  const { settlementAddress } = useApp();
  const brandHref = getBrandHomeHref(settlementAddress);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors ${
        scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm' : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-[86px] max-w-[1300px] items-center justify-between px-4 md:px-6">
        <Link to={brandHref} className="flex items-center gap-3">
          <img src="/stellar-mark.svg" alt="" className="h-9 w-9" />
          <span className="text-lg font-semibold tracking-tight text-[#012b54]">Lumengate</span>
        </Link>
        <nav className="hidden items-center gap-8 lg:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-[#31485f] hover:text-[#007dfc]">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <Link to="/app/welcome?intent=new" className="lg-btn-nav">
            Start now
          </Link>
          <Link to="/app/welcome?intent=return" className="text-sm font-medium text-[#31485f] hover:text-[#007dfc]">
            Sign in
          </Link>
        </div>
        <button type="button" className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X /> : <Menu />}
        </button>
      </div>
      <div className="lg-nav-border">
        <div className="lg-nav-dot" />
      </div>
      {open ? (
        <div className="border-t border-[#eef0f3] bg-white px-4 py-4 lg:hidden">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="block py-2 text-sm font-medium text-[#012b54]" onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <Link to="/app/welcome?intent=new" className="lg-btn-nav mt-3 inline-flex" onClick={() => setOpen(false)}>
            Start now
          </Link>
          <Link
            to="/app/welcome?intent=return"
            className="mt-2 block py-2 text-sm font-medium text-[#007dfc]"
            onClick={() => setOpen(false)}
          >
            Sign in
          </Link>
        </div>
      ) : null}
    </header>
  );
}
