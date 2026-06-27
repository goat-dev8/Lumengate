import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { cn } from '../../lib/cn';

export function CtaPremium() {
  const { ref, visible } = useScrollReveal();

  return (
    <div ref={ref} className={cn('lg-reveal', visible && 'lg-revealed')}>
      <div className="lg-cta-premium">
        <div className="lg-cta-orbs" aria-hidden="true">
          <div className="lg-cta-orb lg-cta-orb-1" />
          <div className="lg-cta-orb lg-cta-orb-2" />
        </div>
        <div className="lg-cta-pattern relative z-10" />
        <div className="relative z-10">
          <h2 className="text-3xl font-semibold md:text-5xl tracking-tight">
            Ready to prove eligibility?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-white/85 leading-relaxed">
            Create a secure account with passkey, receive a Private Financial Passport, and settle
            with institutional receipts — identity stays off the public ledger.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link to="/app/welcome?intent=new" className="lg-btn-white">
              Start now
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/app/welcome?intent=return"
              className="lg-btn-primary border border-white/20 bg-white/10 shadow-none hover:bg-white/20 hover:text-white"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
