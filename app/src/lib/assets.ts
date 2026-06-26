/** Official Stellar testnet USDC — from env with documented defaults. */
export const DEFAULT_USDC_ISSUER =
  'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
export const DEFAULT_USDC_SAC =
  'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';

export type ComplianceAssetTargets = {
  usdcCode: string;
  usdcIssuer: string;
  usdcSac: string;
  eurcNote: string;
};

export function loadComplianceAssetTargets(): ComplianceAssetTargets {
  return {
    usdcCode: import.meta.env.VITE_USDC_ASSET_CODE || 'USDC',
    usdcIssuer: import.meta.env.VITE_USDC_ISSUER || DEFAULT_USDC_ISSUER,
    usdcSac: import.meta.env.VITE_USDC_SAC_ID || DEFAULT_USDC_SAC,
    eurcNote:
      import.meta.env.VITE_EURC_NOTE ||
      'Testnet EURC is a Lumengate-issued SAC token for compliant settlement demos — not Circle mainnet EURC.',
  };
}
