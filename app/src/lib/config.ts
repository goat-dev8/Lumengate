import { StrKey } from '@stellar/stellar-sdk';
import deployments from '../../../deployments.json';

export type DeploymentConfig = {
  network: string;
  rpcUrl: string;
  horizonUrl: string;
  networkPassphrase: string;
  issuerServiceUrl: string;
  explorerBaseUrl: string;
  issuerRegistryId: string;
  credentialRegistryId: string;
  policyVerifierId: string;
  rwaTokenId: string;
  policyId: number;
  policyId2: number;
  marketplaceSettlementAddress: string;
  rwaAdapterId: string;
  complianceSacAdminId?: string;
  usdcSacId: string;
  usdcIssuer: string;
  usdcAssetCode: string;
  eurcSacId?: string;
  eurcIssuer?: string;
  auditorRegistryId?: string;
  compliantDexId?: string;
  compliantPayrollId?: string;
  compliancePolicyId?: string;
  lumengateSmartAccountWasmHash?: string;
  webauthnVerifierId?: string;
  openZeppelinRelayerUrl?: string;
  passkeyRpId?: string;
  nativeSacId?: string;
  sessionKeyPolicyId?: string;
  governanceTimelockId?: string;
  privacyPoolId?: string;
  aspMembershipVerifierId?: string;
  auditorId: number;
};

type DeploymentsFile = {
  issuer_registry: string;
  credential_registry: string;
  policy_verifier: string;
  rwa_token: string;
  rwa_adapter: string;
  compliance_sac_admin?: string;
  auditor_registry?: string;
  compliant_dex?: string;
  compliant_payroll?: string;
  compliance_policy?: string;
  lumengate_smart_account_wasm_hash?: string;
  webauthn_verifier?: string;
  session_key_policy?: string;
  governance_timelock?: string;
  privacy_pool?: string;
  asp_membership?: string;
  eurc_sac?: string;
  native_sac?: string;
};

const CANONICAL = deployments as DeploymentsFile;

function resolveContractId(envKey: string, canonical: string): string {
  const raw = import.meta.env[envKey];
  const value = raw ? String(raw).trim() : '';
  if (StrKey.isValidContract(canonical)) {
    if (value && StrKey.isValidContract(value) && value !== canonical) {
      console.warn(
        `[Lumengate] ${envKey}="${value}" stale — using deployments.json ${canonical}.`,
      );
    }
    return canonical;
  }
  if (value && StrKey.isValidContract(value)) return value;
  throw new Error(
    `Invalid contract ID for ${envKey}. Expected ${canonical}. Check .env / app/.env.local.`,
  );
}

function resolveOptionalContractId(envKey: string, canonical?: string): string | undefined {
  if (canonical && StrKey.isValidContract(canonical)) {
    return resolveContractId(envKey, canonical);
  }
  const value = optionalViteEnv(envKey);
  if (value && StrKey.isValidContract(value)) return value;
  return undefined;
}

function requireViteEnv(name: string): string {
  const value = import.meta.env[name];
  if (!value || String(value).includes('PENDING')) {
    throw new Error(`Missing or invalid ${name}`);
  }
  return String(value).trim().replace(/\r$/, '');
}

const CANONICAL_TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';

function resolveNetworkPassphrase(): string {
  const raw = requireViteEnv('VITE_NETWORK_PASSPHRASE');
  if (raw === 'Test' || raw === 'Test SDF Network') {
    console.warn(
      '[Lumengate] VITE_NETWORK_PASSPHRASE was truncated by dotenv (; starts a comment). ' +
        'Quote it in .env.local, e.g. "Test SDF Network ; September 2015". Using canonical testnet passphrase.',
    );
    return CANONICAL_TESTNET_PASSPHRASE;
  }
  return raw;
}

export function loadDeploymentConfig(): DeploymentConfig {
  return {
    network: import.meta.env.VITE_STELLAR_NETWORK || import.meta.env.VITE_NETWORK || 'testnet',
    rpcUrl: requireViteEnv('VITE_STELLAR_RPC_URL'),
    horizonUrl: requireViteEnv('VITE_STELLAR_HORIZON_URL'),
    networkPassphrase: resolveNetworkPassphrase(),
    issuerServiceUrl: requireViteEnv('VITE_ISSUER_SERVICE_URL'),
    explorerBaseUrl:
      import.meta.env.VITE_EXPLORER_BASE_URL ||
      'https://stellar.expert/explorer/testnet',
    issuerRegistryId: resolveContractId('VITE_ISSUER_REGISTRY_ID', CANONICAL.issuer_registry),
    credentialRegistryId: resolveContractId('VITE_CREDENTIAL_REGISTRY_ID', CANONICAL.credential_registry),
    policyVerifierId: resolveContractId('VITE_POLICY_VERIFIER_ID', CANONICAL.policy_verifier),
    rwaTokenId: resolveContractId('VITE_RWA_TOKEN_ID', CANONICAL.rwa_token),
    policyId: Number(import.meta.env.VITE_POLICY_ID || 1),
    policyId2: Number(import.meta.env.VITE_POLICY_ID_2 || 2),
    marketplaceSettlementAddress: requireViteEnv('VITE_MARKETPLACE_SETTLEMENT_ADDRESS'),
    rwaAdapterId: resolveContractId('VITE_RWA_ADAPTER_ID', CANONICAL.rwa_adapter),
    complianceSacAdminId: resolveOptionalContractId(
      'VITE_COMPLIANCE_SAC_ADMIN_ID',
      CANONICAL.compliance_sac_admin,
    ),
    usdcSacId: optionalViteEnv('VITE_USDC_SAC_ID') || 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
    usdcIssuer:
      optionalViteEnv('VITE_USDC_ISSUER') || 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    usdcAssetCode: optionalViteEnv('VITE_USDC_ASSET_CODE') || 'USDC',
    eurcSacId:
      optionalViteEnv('VITE_EURC_SAC_ID') ||
      (CANONICAL.eurc_sac && StrKey.isValidContract(CANONICAL.eurc_sac) ? CANONICAL.eurc_sac : undefined),
    eurcIssuer: optionalViteEnv('VITE_EURC_ISSUER'),
    auditorRegistryId:
      optionalViteEnv('VITE_AUDITOR_REGISTRY_ID') ||
      (CANONICAL.auditor_registry && StrKey.isValidContract(CANONICAL.auditor_registry)
        ? CANONICAL.auditor_registry
        : undefined),
    compliantDexId: optionalViteEnv('VITE_COMPLIANT_DEX_ID') || CANONICAL.compliant_dex,
    compliantPayrollId: optionalViteEnv('VITE_COMPLIANT_PAYROLL_ID') || CANONICAL.compliant_payroll,
    compliancePolicyId: resolveOptionalContractId(
      'VITE_COMPLIANCE_POLICY_ID',
      CANONICAL.compliance_policy,
    ),
    lumengateSmartAccountWasmHash:
      optionalViteEnv('VITE_LUMENGATE_SMART_ACCOUNT_WASM_HASH') ||
      CANONICAL.lumengate_smart_account_wasm_hash,
    webauthnVerifierId: resolveOptionalContractId(
      'VITE_WEBAUTHN_VERIFIER_ID',
      CANONICAL.webauthn_verifier,
    ),
    openZeppelinRelayerUrl: optionalViteEnv('VITE_OPENZEPPELIN_RELAYER_URL'),
    passkeyRpId: optionalViteEnv('VITE_PASSKEY_RP_ID'),
    nativeSacId: resolveContractId(
      'VITE_NATIVE_SAC_ID',
      CANONICAL.native_sac ?? 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    ),
    sessionKeyPolicyId: resolveOptionalContractId(
      'VITE_SESSION_KEY_POLICY_ID',
      CANONICAL.session_key_policy,
    ),
    governanceTimelockId: resolveOptionalContractId(
      'VITE_TIMELOCK_CONTRACT_ID',
      CANONICAL.governance_timelock,
    ),
    privacyPoolId:
      optionalViteEnv('VITE_PRIVACY_POOL_ID') ||
      CANONICAL.privacy_pool ||
      'CC4ID36B3B2UCKZOTGX2NY3VUI36IXCGHBUUPNDZBYTS7UGNSPIZ5P2A',
    aspMembershipVerifierId:
      optionalViteEnv('VITE_ASP_MEMBERSHIP_ID') ||
      CANONICAL.asp_membership ||
      'CBWS5GGCL4Q627GJ4HZ2SL5D2P2NXECFXKEPPTOSXOTR4EA7GTVZZWIH',
    auditorId: Number(optionalViteEnv('VITE_AUDITOR_ID') || 1),
  };
}

function optionalViteEnv(name: string): string | undefined {
  const value = import.meta.env[name];
  if (!value) return undefined;
  const trimmed = String(value).trim().replace(/\r$/, '');
  return trimmed || undefined;
}

export type IssuerCredentialResponse = {
  label: string;
  issuerType?: string;
  policyKey?: string;
  issuedAt?: number;
  expiresAt?: number;
  issuerStellarPublicKey?: string;
  issuerEthAddress?: string;
  issuerId: number;
  signatureScheme?: string;
  issuerSignatureBase64?: string;
  commitment?: string;
  walletField?: string;
  credential: {
    commitment: string;
    nullifier: string;
    root: string;
    revocationRoot: string;
    policyId: number;
    issuerId: number;
    pubkeyBytes64: string;
    stellarPublicKey?: string;
    signatureScheme?: string;
    issuerSignatureBase64?: string;
  };
  proverInputs?: Record<string, string | boolean | string[] | number[]>;
};

async function issuerFetch<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, init);
  } catch {
    throw new Error(
      `Cannot reach issuer service at ${baseUrl}. Start it with: cd issuer-service && npm start`,
    );
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function fetchIssuerHealth(baseUrl: string) {
  return issuerFetch<{ ok: boolean; issuer: string; service: string }>(baseUrl, '/health');
}

export async function fetchIssuerRoots(baseUrl: string) {
  return issuerFetch<{ root: string; revocationRoot: string; noteRoot?: string }>(baseUrl, '/roots');
}

export async function fetchIssuerCredential(
  baseUrl: string,
  walletField: string,
  policyKey = 'general-eligibility',
) {
  return issuerFetch<IssuerCredentialResponse>(baseUrl, '/credential', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletField, policyKey }),
  });
}

export async function registerSmartAccountPasskey(
  baseUrl: string,
  params: {
    smartAccountId: string;
    verifierId: string;
    keyDataHex: string;
  },
) {
  return issuerFetch<{
    ok: boolean;
    txHash: string;
    smartAccountId: string;
    verifierId: string;
  }>(baseUrl, '/smart-account/passkeys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

export async function fetchIssuerMetadata(baseUrl: string) {
  return issuerFetch<{
    stellarPublicKey: string;
    issuerId: number;
    network: string;
    chain: string;
    role: string;
    signatureScheme: string;
    pubkeyBytes64?: string;
  }>(baseUrl, '/issuer');
}

export type OnChainRoots = {
  root: string;
  revocationRoot: string;
  noteRoot?: string;
};

export function parseRootsTuple(raw: unknown): OnChainRoots {
  if (Array.isArray(raw) && raw.length >= 2) {
    return {
      root: normalizeHex(String(raw[0])),
      revocationRoot: normalizeHex(String(raw[1])),
    };
  }
  throw new Error('Unexpected roots response shape');
}

function normalizeHex(v: string): string {
  const h = v.replace(/^0x/i, '');
  return `0x${h.padStart(64, '0')}`;
}
