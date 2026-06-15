/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STELLAR_NETWORK: string;
  readonly VITE_NETWORK: string;
  readonly VITE_STELLAR_RPC_URL: string;
  readonly VITE_STELLAR_HORIZON_URL: string;
  readonly VITE_NETWORK_PASSPHRASE: string;
  readonly VITE_ISSUER_SERVICE_URL: string;
  readonly VITE_EXPLORER_BASE_URL: string;
  readonly VITE_ISSUER_REGISTRY_ID: string;
  readonly VITE_CREDENTIAL_REGISTRY_ID: string;
  readonly VITE_POLICY_VERIFIER_ID: string;
  readonly VITE_RWA_TOKEN_ID: string;
  readonly VITE_RWA_ADAPTER_ID: string;
  readonly VITE_POLICY_ID: string;
  readonly VITE_POLICY_ID_2: string;
  readonly VITE_MARKETPLACE_SETTLEMENT_ADDRESS: string;
  readonly VITE_USDC_ASSET_CODE: string;
  readonly VITE_USDC_ISSUER: string;
  readonly VITE_USDC_SAC_ID: string;
  readonly VITE_EURC_NOTE: string;
  readonly VITE_WC_PROJECT_ID?: string;
  readonly VITE_REFERENCE_VERIFY_TX: string;
  readonly VITE_REFERENCE_TRANSFER_TX: string;
  readonly VITE_REFERENCE_FREEZE_TX: string;
  readonly VITE_REFERENCE_MARKETPLACE_TX?: string;
  /** @deprecated use VITE_REFERENCE_* */
  readonly VITE_DEMO_VERIFY_TX: string;
  /** @deprecated use VITE_REFERENCE_* */
  readonly VITE_DEMO_TRANSFER_TX: string;
  /** @deprecated use VITE_REFERENCE_* */
  readonly VITE_DEMO_FREEZE_TX: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
