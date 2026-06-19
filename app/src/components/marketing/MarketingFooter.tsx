import { Link } from 'react-router-dom';

const productLinks = [
  { href: '#architecture', label: 'Architecture' },
  { href: '#workflow', label: 'Workflow' },
  { href: '#metrics', label: 'Metrics' },
  { href: '#get-started', label: 'Get started' },
];

const appLinks = [
  { to: '/app/credential', label: 'Credential' },
  { to: '/app/prove', label: 'Prove' },
  { to: '/app/transfer', label: 'Transfer' },
  { to: '/app/compliance', label: 'Compliance' },
];

export function MarketingFooter() {
  return (
    <footer className="lg-footer lg-footer-premium">
      <div className="lg-container">
        <div className="lg-footer-grid">
          <div>
            <div className="flex items-center gap-2">
              <img src="/stellar-mark.svg" alt="" className="h-9 w-9" />
              <span className="text-lg font-semibold text-[#012b54]">Lumengate</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#64748b]">
              Privacy-preserving RWA compliance on Stellar testnet — ZK proofs verified on-chain via Protocol 25.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#012b54]">Product</h3>
            <ul className="mt-3 space-y-2">
              {productLinks.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="text-sm text-[#64748b] hover:text-[#007dfc]">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#012b54]">Application</h3>
            <ul className="mt-3 space-y-2">
              {appLinks.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-sm text-[#64748b] hover:text-[#007dfc]">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="lg-footer-bottom">
          <p className="text-sm text-[#64748b]">© {new Date().getFullYear()} Lumengate · Stellar testnet only</p>
          <p className="text-xs text-[#94a3b8]">Contract IDs and URLs loaded from VITE_* environment</p>
        </div>
      </div>
    </footer>
  );
}
