import { BrandFlowDiagram } from '../fintech/BrandFlowDiagram';

export function LandingFlowBand() {
  return (
    <div className="lg-flow-band">
      <div className="lg-container">
        <div className="lg-flow-band-inner">
          <div className="lg-flow-band-copy">
            <p className="lg-flow-band-eyebrow">End-to-end compliance</p>
            <h2 className="lg-flow-band-title">
              From issuer signature to{' '}
              <span className="font-serif italic text-[#007dfc]">RWA settlement</span>
            </h2>
            <p className="lg-flow-band-desc">
              Ethereum credentials, zero-knowledge proofs, and Stellar verification — one private
              compliance path.
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
