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
import { TheProblemSection } from '../components/marketing/TheProblemSection';
import { IdentityWithoutExposureSection } from '../components/marketing/IdentityWithoutExposureSection';
import { TokenizedAssetsSection } from '../components/marketing/TokenizedAssetsSection';
import { PublicSettlementSection } from '../components/marketing/PublicSettlementSection';
import { ConfidentialAssetsSection } from '../components/marketing/ConfidentialAssetsSection';
import { SelectiveDisclosureSection } from '../components/marketing/SelectiveDisclosureSection';
import { ReceiptsSection } from '../components/marketing/ReceiptsSection';
import { SecuritySection } from '../components/marketing/SecuritySection';
import { TechnicalMetricsSection } from '../components/marketing/TechnicalMetricsSection';
import { FaqSection } from '../components/marketing/FaqSection';
import { loadDeploymentConfig } from '../lib/config';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { cn } from '../lib/cn';
import { setOnboardingPath } from '../components/product/OnboardingPathPicker';

const pipeline = ['Passkey', 'Passport', 'Eligibility', 'Invest', 'Receipt'];

export function LandingPage() {
  const config = loadDeploymentConfig();
  const verifyTx = import.meta.env.VITE_REFERENCE_VERIFY_TX || '';
  const transferTx = import.meta.env.VITE_REFERENCE_TRANSFER_TX || '';
  const freezeTx = import.meta.env.VITE_REFERENCE_FREEZE_TX || '';
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
              Private access to regulated assets.
              <br />
              <span className="lg-hero-mark lg-text-frame">Built for real settlement.</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-[#31485f] lg-fade-up lg-fade-up-d2">
              Lumengate helps eligible investors access tokenized assets on Stellar while keeping personal details
              off the public ledger. Every settlement is passkey-approved and receipt-ready.
            </p>
            <div className="flex flex-wrap justify-center gap-3 lg:justify-start lg-fade-up lg-fade-up-d3">
              <Link
                to="/app/welcome?intent=new"
                className="lg-btn-primary"
                onClick={() => setOnboardingPath('passkey')}
              >
                Start now
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/app/welcome?intent=return" className="lg-btn-white">
                Sign in
              </Link>
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

      {/* THE PROBLEM */}
      <section id="problem" className="lg-section lg-section-tight">
        <div className="lg-container">
          <div className="lg-section-top">
            <SectionBadge suffix="01" label="The problem" />
            <h2 className="lg-section-heading">
              Regulated settlement forces a <span className="font-serif italic text-[#007dfc]">bad trade-off</span>
            </h2>
            <p className="lg-section-desc">
              Proving eligibility usually means putting identity attributes on-chain permanently, linking who you are
              to every transaction you ever make.
            </p>
          </div>
          <TheProblemSection />
        </div>
      </section>

      {/* ARCHITECTURE */}
      <section id="architecture" className="lg-section lg-section-tight lg-grid-section">
        <GridWallpaper />
        <div className="lg-container relative z-10">
          <div className="lg-section-top">
            <SectionBadge suffix="02" label="Architecture" />
            <h2 className="lg-section-heading">
              How Lumengate <span className="font-serif italic text-[#007dfc]">solves it</span>
            </h2>
            <p className="lg-section-desc">
              From passport issuance to a passkey-approved investment and receipt.
            </p>
          </div>
          <ArchitectureFlowSvg />
        </div>
      </section>

      {/* IDENTITY WITHOUT EXPOSURE */}
      <section id="identity" className="lg-section lg-section-tight">
        <div className="lg-container">
          <div className="lg-section-top">
            <SectionBadge suffix="03" label="Identity" />
            <h2 className="lg-section-heading">
              Identity <span className="font-serif italic text-[#007dfc]">without exposure</span>
            </h2>
            <p className="lg-section-desc">
              A passkey authorizes a smart account, which enforces compliance on every operation and installs a
              session so you are not re-prompted for each step.
            </p>
          </div>
          <IdentityWithoutExposureSection />
        </div>
      </section>

      {/* WORKFLOW */}
      <section id="workflow" className="lg-section lg-section-tight">
        <div className="lg-container">
          <div className="lg-section-top">
            <SectionBadge suffix="04" label="Workflow" />
            <h2 className="lg-section-heading">Four steps to private investing</h2>
            <p className="lg-section-desc">Connect, verify, invest, and keep an audit-ready receipt.</p>
          </div>
          <WorkflowJourney />
        </div>
      </section>

      {/* CROSS-CHAIN */}
      <section id="trust" className="lg-section lg-grid-section">
        <GridWallpaper />
        <div className="lg-container relative z-10">
          <div ref={cross.ref} className={cn('lg-reveal lg-dark-section', cross.visible && 'lg-revealed')}>
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
              <div>
                <SectionBadge suffix="05" label="Trust model" dark />
                <h2 className="mt-4 text-3xl font-semibold md:text-4xl">
                  Passkey-approved.{' '}
                  <span className="font-serif italic text-[#c9f31d]">Receipt-ready.</span>
                </h2>
                <p className="mt-4 text-white/80 leading-relaxed">
                  Your passkey smart account approves each settlement. Lumengate confirms eligibility before the transfer and
                  creates a record an auditor can verify without seeing your private identity details.
                </p>
              </div>
              <div className="grid gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                  <div className="text-xs uppercase tracking-wide text-white/60">Before settlement</div>
                  <div className="mt-2 text-sm">Passport issued privately</div>
                </div>
                <div className="flex justify-center text-[#c9f31d]">↓ eligibility check ↓</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                  <div className="text-xs uppercase tracking-wide text-white/60">On Stellar</div>
                  <div className="mt-2 text-sm">Settlement completes only when allowed</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TOKENIZED ASSETS */}
      <section id="assets" className="lg-section lg-section-tight">
        <div className="lg-container">
          <div className="lg-section-top">
            <SectionBadge suffix="06" label="Tokenized assets" />
            <h2 className="lg-section-heading">
              Gated by <span className="font-serif italic text-[#007dfc]">eligibility</span>, not paperwork
            </h2>
            <p className="lg-section-desc">
              The marketplace checks smart account, credential, policy match, session status, and minimum balance
              before it ever builds a transaction.
            </p>
          </div>
          <TokenizedAssetsSection />
        </div>
      </section>

      {/* PUBLIC SETTLEMENT */}
      <section id="public-settlement" className="lg-section lg-section-tight lg-grid-section">
        <GridWallpaper />
        <div className="lg-container relative z-10">
          <div className="lg-section-top">
            <SectionBadge suffix="07" label="Public settlement" />
            <h2 className="lg-section-heading">
              Public settlement, <span className="font-serif italic text-[#007dfc]">still compliance-gated</span>
            </h2>
            <p className="lg-section-desc">
              Not every settlement needs to be confidential. USDC and EURC treasury flows settle transparently, with
              the same on-chain eligibility check enforced first.
            </p>
          </div>
          <PublicSettlementSection />
        </div>
      </section>

      {/* CONFIDENTIAL ASSETS */}
      <section id="confidential-assets" className="lg-section lg-section-tight">
        <div className="lg-container">
          <div className="lg-section-top">
            <SectionBadge suffix="08" label="Confidential assets" />
            <h2 className="lg-section-heading">
              Shielded balances, <span className="font-serif italic text-[#007dfc]">receipt-ready</span>
            </h2>
            <p className="lg-section-desc">
              Stellar Confidential Tokens wrap SAC EURC and SAC USDC in Pedersen commitments — amounts hidden,
              counterparties still public addresses.
            </p>
          </div>
          <ConfidentialAssetsSection />
        </div>
      </section>

      {/* COMPARE */}
      <section id="compare" className="lg-section">
        <div className="lg-container">
          <div className="lg-section-top">
            <SectionBadge suffix="09" label="Comparison" />
            <h2 className="lg-section-heading">Private access vs traditional onboarding</h2>
          </div>
          <CompareShowcase />
        </div>
      </section>

      {/* SELECTIVE DISCLOSURE */}
      <section id="disclosure" className="lg-section lg-section-tight lg-grid-section">
        <GridWallpaper />
        <div className="lg-container relative z-10">
          <div className="lg-section-top">
            <SectionBadge suffix="10" label="Selective disclosure" />
            <h2 className="lg-section-heading">
              Auditable, <span className="font-serif italic text-[#007dfc]">not transparent by default</span>
            </h2>
            <p className="lg-section-desc">
              A viewing key scoped to one receipt lets an auditor confirm a regulated fact without seeing a wallet's
              full history or a user's private eligibility inputs.
            </p>
          </div>
          <SelectiveDisclosureSection />
        </div>
      </section>

      {/* RECEIPTS */}
      <section id="receipts" className="lg-section lg-section-tight">
        <div className="lg-container">
          <div className="lg-section-top">
            <SectionBadge suffix="11" label="Receipts" />
            <h2 className="lg-section-heading">Every settlement produces a receipt</h2>
            <p className="lg-section-desc">
              A compliance team has something concrete to review the moment a transfer completes — not something
              reconstructed later from raw ledger data.
            </p>
          </div>
          <ReceiptsSection />
        </div>
      </section>

      {/* SECURITY */}
      <section id="security" className="lg-section lg-section-tight lg-grid-section">
        <GridWallpaper />
        <div className="lg-container relative z-10">
          <div className="lg-section-top">
            <SectionBadge suffix="12" label="Security" />
            <h2 className="lg-section-heading">Compliance is a contract invariant</h2>
            <p className="lg-section-desc">
              Not a UI checkbox that a client could skip — every control below is enforced on-chain.
            </p>
          </div>
          <SecuritySection />
        </div>
      </section>

      {/* METRICS */}
      <section id="metrics" className="lg-section lg-grid-section">
        <GridWallpaper />
        <div className="lg-container relative z-10">
          <div className="lg-section-top">
            <SectionBadge suffix="13" label="Live records" />
            <h2 className="lg-section-heading">Real Stellar settlement references</h2>
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

      {/* TECHNICAL METRICS */}
      <section id="technical-metrics" className="lg-section lg-section-tight">
        <div className="lg-container">
          <div className="lg-section-top">
            <SectionBadge suffix="14" label="Verified counts" />
            <h2 className="lg-section-heading">Built, tested, and counted — not estimated</h2>
          </div>
          <TechnicalMetricsSection />
        </div>
      </section>

      {/* PROTOCOLS */}
      <section id="protocols" className="lg-section lg-section-tight">
        <div className="lg-container">
          <div className="lg-section-top">
            <SectionBadge suffix="15" label="Stellar native" />
            <h2 className="lg-section-heading">
              Built for <span className="font-serif italic">regulated assets</span>
            </h2>
          </div>
          <ProtocolShowcase />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="lg-section lg-section-tight">
        <div className="lg-container">
          <div className="lg-section-top">
            <SectionBadge suffix="16" label="FAQ" />
            <h2 className="lg-section-heading">Frequently asked questions</h2>
          </div>
          <FaqSection />
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
