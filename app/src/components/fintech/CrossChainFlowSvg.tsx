import { BrandFlowDiagram } from './BrandFlowDiagram';

/** @deprecated Use BrandFlowDiagram */
export function CrossChainFlowSvg(props: {
  compact?: boolean;
  animated?: boolean;
}) {
  return (
    <BrandFlowDiagram
      variant={props.compact ? 'compact' : 'standard'}
      animated={props.animated}
    />
  );
}
