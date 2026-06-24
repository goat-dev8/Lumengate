import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { MarketingNavbar } from '../components/marketing/MarketingNavbar';
import { SectionBadge } from '../components/marketing/SectionBadge';
import { GridWallpaper } from '../components/marketing/GridWallpaper';
import { BorderLines } from '../components/marketing/BorderLines';
import { HeroLiveConsole } from '../components/marketing/HeroLiveConsole';
import { LandingFlowBand } from '../components/marketing/LandingFlowBand';
import { ArchitectureFlowSvg } from '../components/marketing/ArchitectureFlowSvg';
import { WorkflowJourney } from '../components/marketing/WorkflowJourney';
import { ProtocolShowcase } from '../components/marketing/ProtocolShowcase';
import { CompareShowcase } from '../components/marketing/CompareShowcase';
import { MetricsShowcase } from '../components/marketing/MetricsShowcase';
import { CtaPremium } from '../components/marketing/CtaPremium';
import { MarketingFooter } from '../components/marketing/MarketingFooter';
import { ProductStoryStrip } from '../components/marketing/ProductStoryStrip';
import { useApp } from '../context/AppContext';
import { loadDeploymentConfig } from '../lib/config';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { cn } from '../lib/cn';

const pipeline = ['Issuer', 'Credential', 'Proof', 'Verify', 'Transfer', 'Monitor'];

export function LandingPage() {
  const { connect, connecting } = useApp();
  const config = loadDeploymentConfig();
  const verifyTx =
    import.meta.env.VITE_REFERENCE_VERIFY_TX || import.meta.env.VITE_DEMO_VERIFY_TX || '';
  const transferTx =
    import.meta.env.VITE_REFERENCE_TRANSFER_TX || import.meta.env.VITE_DEMO_TRANSFER_TX || '';
  const freezeTx =
    import.meta.env.VITE_REFERENCE_FREEZE_TX || import.meta.env.VITE_DEMO_FREEZE_TX || '';
  const cross = useScrollReveal();

  return (
    <div className="min-h-screen bg-white">
      <MarketingNavbar />

      {/* HERO */}
      <section id="home" className="lg-hero-v2">
        <div className="lg-hero-banner lg-hero-banner-full">
          <img
            src="/banner-bg.png"
            alt=""
            width={1440}
            height={550}
            className="lg-banner-bg-image"
          />
          <div className="lg-hero-banner-inner">
            <div className="lg-hero-content lg-hero-content-hero">
            <div className="lg-fade-up inline-flex items-center gap-2 rounded-full border border-[#eef0f3] bg-white/90 py-1.5 pl-2 pr-4 backdrop-blur-sm">
              <img src="/stellar-mark.svg" alt="" className="h-7 w-7 rounded-full" />
              <span className="text-sm font-medium text-[#012b54]">Live on Stellar testnet</span>
            </div>
            <h1 className="lg-hero-headline lg-fade-up lg-fade-up-d1">
              Prove you&apos;re eligible.
              <br />
              <span className="lg-hero-mark lg-text-frame">Never reveal who you are.</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-[#31485f] lg-fade-up lg-fade-up-d2">
              Lumengate is the privacy-preserving compliance layer for tokenized real-world assets on Stellar —
              zero-knowledge proofs verified on-chain, enforced at every transfer.
            </p>
            <div className="flex flex-wrap justify-center gap-3 lg:justify-start lg-fade-up lg-fade-up-d3">
              <Link to="/app/dashboard" className="lg-btn-primary">
                Start compliance flow
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button type="button" className="lg-btn-white" onClick={() => connect()} disabled={connecting}>
                {connecting ? 'Connecting…' : 'Connect wallet'}
              </button>
            </div>
            <div className="lg-hero-pipeline lg-fade-up lg-fade-up-d4">
              {pipeline.map((step, i) => (
                <span key={step} className="inline-flex items-center gap-1">
                  <span
                    className={
                      i === 2 || i === 3
                        ? 'lg-hero-pipeline-step lg-hero-pipeline-engine'
                        : 'lg-hero-pipeline-step'
                    }
                  >
                    {step}
                  </span>
                  {i < pipeline.length - 1 ? <span className="text-[#007dfc]">→</span> : null}
                </span>
              ))}
            </div>
            </div>
          </div>
          <BorderLines />
        </div>
      </section>

      <section className="lg-landing-showcase" aria-label="Product overview">
        <LandingFlowBand />
        <div className="lg-dashboard-wrap lg-fade-up">
          <HeroLiveConsole />
        </div>
      </section>

      <ProductStoryStrip />

      {/* ARCHITECTURE */}
      <section id="architecture" className="lg-section lg-section-tight lg-grid-section">
        <GridWallpaper />
        <div className="lg-container relative z-10">
          <div className="lg-section-top">
            <SectionBadge suffix="01" label="Architecture" />
            <h2 className="lg-section-heading">
              Zero-knowledge compliance, <span className="font-serif italic text-[#007dfc]">end to end</span>
            </h2>
            <p className="lg-section-desc">
              Hover the flow — from issuer signature to gated RWA transfer on Stellar.
            </p>
          </div>
          <ArchitectureFlowSvg />
        </div>
      </section>

      {/* WORKFLOW */}
      <section id="workflow" className="lg-section lg-section-tight">
        <div className="lg-container">
          <div className="lg-section-top">
            <SectionBadge suffix="02" label="Workflow" />
            <h2 className="lg-section-heading">Four steps to compliant settlement</h2>
            <p className="lg-section-desc">No paragraphs required — follow the journey.</p>
          </div>
          <WorkflowJourney />
        </div>
      </section>

      {/* CROSS-CHAIN */}
      <section className="lg-section lg-grid-section">
        <GridWallpaper />
        <div className="lg-container relative z-10">
          <div ref={cross.ref} className={cn('lg-reveal lg-dark-section', cross.visible && 'lg-revealed')}>
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
              <div>
                <SectionBadge suffix="03" label="Trust model" dark />
                <h2 className="mt-4 text-3xl font-semibold md:text-4xl">
                  Signed on Stellar.{' '}
                  <span className="font-serif italic text-[#c9f31d]">Enforced on-chain.</span>
                </h2>
                <p className="mt-4 text-white/80 leading-relaxed">
                  Issuer credentials use Ed25519 signatures from the Lumengate issuer service — Stellar-native
                  trust, verified off-chain at issuance and bound into ZK proofs without identity leakage.
                </p>
              </div>
              <div className="grid gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                  <div className="text-xs uppercase tracking-wide text-white/60">Off-chain</div>
                  <div className="mt-2 font-mono text-sm">issuer.sign(commitment)</div>
                </div>
                <div className="flex justify-center text-[#c9f31d]">↓ ZK proof ↓</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                  <div className="text-xs uppercase tracking-wide text-white/60">On-chain (Stellar)</div>
                  <div className="mt-2 font-mono text-sm">PolicyVerifier.verify(proof)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMPARE */}
      <section id="compare" className="lg-section">
        <div className="lg-container">
          <div className="lg-section-top">
            <SectionBadge suffix="04" label="Comparison" />
            <h2 className="lg-section-heading">Privacy vs traditional KYC</h2>
          </div>
          <CompareShowcase />
        </div>
      </section>

      {/* METRICS */}
      <section id="metrics" className="lg-section lg-grid-section">
        <GridWallpaper />
        <div className="lg-container relative z-10">
          <div className="lg-section-top">
            <SectionBadge suffix="05" label="Live metrics" />
            <h2 className="lg-section-heading">Real Stellar testnet evidence</h2>
          </div>
          <MetricsShowcase
            verifyTx={verifyTx}
            transferTx={transferTx}
            freezeTx={freezeTx}
            network={config.network}
            explorerBaseUrl={config.explorerBaseUrl}
          />
        </div>
      </section>

      {/* PROTOCOLS */}
      <section id="protocols" className="lg-section lg-section-tight">
        <div className="lg-container">
          <div className="lg-section-top">
            <SectionBadge suffix="06" label="Stellar native" />
            <h2 className="lg-section-heading">
              Built on Protocol 25 &amp; <span className="font-serif italic">Protocol 26</span>
            </h2>
          </div>
          <ProtocolShowcase />
        </div>
      </section>

      {/* CTA */}
      <section id="get-started" className="lg-section lg-grid-section">
        <GridWallpaper />
        <div className="lg-container relative z-10">
          <CtaPremium />
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
