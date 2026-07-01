const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const { join } = require('path');
const { adminSacTransfer, adminMintTreasury } = require('./sorobanAdmin');
const { sacTransferForFaucet } = require('./sacLiquidity');

const DATA_DIR = join(__dirname, '..', 'data');
const CLAIMS_PATH = join(DATA_DIR, 'faucet_claims.json');
const CLAIM_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// SAC amounts use 7-decimal stroops; RWA treasury token uses whole integer units.
const LIMITS = {
  usdc: { amount: '100000000', label: '10 USDC' },
  eurc: { amount: '100000000', label: '10 EURC' },
  xlm: { amount: '5000000000', label: '500 XLM' },
  treasury: { amount: '10', label: '10 treasury units' },
};

function loadClaims() {
  if (!existsSync(CLAIMS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CLAIMS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveClaims(rows) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(CLAIMS_PATH, JSON.stringify(rows, null, 2));
}

function claimKey(smartAccountAddress, asset) {
  return `${String(smartAccountAddress).toLowerCase()}:${asset}`;
}

function getClaimStatus(smartAccountAddress, asset) {
  const rows = loadClaims();
  const last = rows[claimKey(smartAccountAddress, asset)];
  if (!last) {
    return { available: true, nextClaimAt: null, lastClaimAt: null };
  }
  const elapsed = Date.now() - last;
  if (elapsed >= CLAIM_COOLDOWN_MS) {
    return { available: true, nextClaimAt: null, lastClaimAt: last };
  }
  return {
    available: false,
    nextClaimAt: last + CLAIM_COOLDOWN_MS,
    lastClaimAt: last,
  };
}

function listFaucetStatus(smartAccountAddress) {
  return Object.keys(LIMITS).reduce((acc, asset) => {
    acc[asset] = {
      ...LIMITS[asset],
      ...getClaimStatus(smartAccountAddress, asset),
    };
    return acc;
  }, {});
}

async function claimTestnetFunds(smartAccountAddress, asset, env = process.env) {
  const normalized = String(smartAccountAddress || '').trim();
  if (!normalized.startsWith('C')) {
    throw new Error('Smart account address required');
  }
  const spec = LIMITS[asset];
  if (!spec) throw new Error('Unsupported faucet asset');

  const status = getClaimStatus(normalized, asset);
  if (!status.available) {
    throw new Error('Claim available once every 24 hours per asset');
  }

  let txHash;
  if (asset === 'usdc') {
    const sacId = env.VITE_USDC_SAC_ID || env.USDC_SAC_ID;
    if (!sacId) throw new Error('USDC SAC not configured');
    txHash = await sacTransferForFaucet(sacId, normalized, spec.amount, 'USDC', env);
  } else if (asset === 'eurc') {
    const sacId = env.VITE_EURC_SAC_ID || env.EURC_SAC_ID;
    if (!sacId) throw new Error('EURC SAC not configured');
    txHash = await sacTransferForFaucet(sacId, normalized, spec.amount, 'EURC', env);
  } else if (asset === 'xlm') {
    const sacId = env.VITE_NATIVE_SAC_ID || env.NATIVE_SAC_ID;
    if (!sacId) throw new Error('Native XLM SAC not configured');
    txHash = await adminSacTransfer(sacId, normalized, spec.amount, env);
  } else if (asset === 'treasury') {
    const tokenId = env.RWA_TOKEN_ID || env.VITE_RWA_TOKEN_ID;
    if (!tokenId) throw new Error('RWA token not configured');
    txHash = await adminMintTreasury(tokenId, normalized, spec.amount, env);
  }

  const rows = loadClaims();
  rows[claimKey(normalized, asset)] = Date.now();
  saveClaims(rows);

  return {
    asset,
    amount: spec.label,
    txHash,
    smartAccountAddress: normalized,
    nextClaimAt: Date.now() + CLAIM_COOLDOWN_MS,
  };
}

module.exports = {
  CLAIM_COOLDOWN_MS,
  LIMITS,
  claimTestnetFunds,
  getClaimStatus,
  listFaucetStatus,
};
