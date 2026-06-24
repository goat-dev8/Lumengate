import { BrandFlowDiagram } from '../fintech/BrandFlowDiagram';

export function LandingFlowBand() {
  return (
    <div className="lg-flow-band">
      <div className="lg-container">
        <div className="lg-flow-band-inner">
          <div className="lg-flow-band-copy">
            <p className="lg-flow-band-eyebrow">End-to-end private access</p>
            <h2 className="lg-flow-band-title">
              From passport to{' '}
              <span className="font-serif italic text-[#007dfc]">asset settlement</span>
            </h2>
            <p className="lg-flow-band-desc">
              Verify eligibility once, settle with your Stellar wallet, and keep an auditor-ready receipt.
            </p>
          </div>
          <div className="lg-flow-band-diagram">
            <BrandFlowDiagram variant="wide" animated />
          </div>
        </div>
      </div>
    </div>
  );
}
