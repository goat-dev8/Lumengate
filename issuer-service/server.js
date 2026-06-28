const express = require('express');
const { readFileSync, existsSync } = require('fs');
const { join } = require('path');
const { buildProverInputs } = require('./lib/proverInputs');
const { readOnChainRoots } = require('./lib/onChainRoots');
const { policyByKey, policyList } = require('./lib/policies');
const { listOfferings, offeringById } = require('./lib/offerings');
const { computeNullifier: computePofNullifier } = require('../scripts/generate_pof_prover_toml.js');
const {
  viewingKeyHash,
  verifyViewingKeyOnChain,
  appendDisclosure,
  queryDisclosures,
  authorizeDisclosureQuery,
} = require('./lib/disclose');
const { getIssuerById } = require('./lib/issuerRegistry');
const { revokeCredential } = require('./lib/revoke');
const { appendNoteCommitment, syncNoteRootOnChain } = require('./lib/noteMerkle');
const { issuerMetadata, signCommitment, verifyCommitmentSignature } = require('./lib/ed25519Issuer');
const { registerPasskeySigner } = require('./lib/smartAccount');
const { listFaucetStatus, claimTestnetFunds } = require('./lib/faucet');
const { isRelayerEnabled, relayerStatus, submitViaChannels } = require('./lib/relayer');
const { allowRelayerRequest } = require('./lib/relayerRateLimit');
const {
  buildCredentialMaterial,
  normalizeHex32,
  syncCredentialRootOnChain,
} = require('./lib/credentialCommitment');

const app = express();
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || process.env.ISSUER_SERVICE_PORT || 3001);
const CREDENTIAL_PATH =
  process.env.CREDENTIAL_FIXTURE_PATH ||
  join(__dirname, 'fixtures', 'credential.json');

function loadEnvFile() {
  const envPath = join(__dirname, '..', '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    if (!process.env[key]) {
      process.env[key] = t
        .slice(i + 1)
        .trim()
        .replace(/^"(.*)"$/, '$1')
        .replace(/^'(.*)'$/, '$1');
    }
  }
}

loadEnvFile();

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseAllowedOrigins() {
  const raw =
    process.env.CORS_ORIGIN ||
    process.env.ALLOWED_ORIGIN ||
    'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

let issuer;
try {
  issuer = issuerMetadata();
} catch (err) {
  console.error('Failed to initialize Ed25519 issuer:', err.message);
  process.exit(1);
}

const allowedOrigins = parseAllowedOrigins();

/** smart-account-kit RelayerClient sends X-Client-Name + X-Client-Version on /relayer/submit. */
const CORS_ALLOW_HEADERS = 'Content-Type, X-Client-Name, X-Client-Version, x-client-name, x-client-version';

app.use(express.json());
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const originAllowed =
    !origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin);
  if (originAllowed) {
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (allowedOrigins.length === 0) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    const requestedHeaders = req.headers['access-control-request-headers'];
    res.setHeader(
      'Access-Control-Allow-Headers',
      typeof requestedHeaders === 'string' && requestedHeaders.trim()
        ? requestedHeaders
        : CORS_ALLOW_HEADERS,
    );
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(originAllowed ? 204 : 403);
  }
  next();
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'lumengate-issuer',
    issuer: issuer.stellarPublicKey,
    issuerId: issuer.issuerId,
    signatureScheme: issuer.signatureScheme,
    network: process.env.STELLAR_NETWORK_NAME || 'testnet',
    relayer: relayerStatus(),
  });
});

app.get('/relayer/status', (_req, res) => {
  res.json(relayerStatus());
});

app.post('/relayer/submit', express.json({ limit: '512kb' }), async (req, res) => {
  if (!isRelayerEnabled()) {
    return res.status(503).json({
      success: false,
      error: 'Relayer is disabled',
      errorCode: 'RELAYER_DISABLED',
    });
  }
  if (!allowRelayerRequest(req)) {
    return res.status(429).json({
      success: false,
      error: 'Too many relayer requests. Try again shortly.',
      errorCode: 'RATE_LIMITED',
    });
  }
  try {
    const result = await submitViaChannels(req.body ?? {});
    return res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code =
      err?.errorDetails?.code ||
      err?.data?.code ||
      err?.code ||
      'RELAYER_ERROR';
    return res.status(503).json({
      success: false,
      error: message,
      errorCode: code,
    });
  }
});

app.get('/faucet/status', (req, res) => {
  const smartAccountAddress = String(req.query.smartAccountAddress || '');
  if (!smartAccountAddress.startsWith('C')) {
    return res.status(400).json({ error: 'smartAccountAddress query param required' });
  }
  if (process.env.STELLAR_NETWORK_NAME === 'mainnet') {
    return res.status(403).json({ error: 'Testnet faucet only' });
  }
  return res.json({ smartAccountAddress, assets: listFaucetStatus(smartAccountAddress) });
});

app.post('/faucet/claim', express.json(), async (req, res) => {
  const smartAccountAddress = String(req.body?.smartAccountAddress || '');
  const asset = String(req.body?.asset || '').toLowerCase();
  if (!smartAccountAddress.startsWith('C')) {
    return res.status(400).json({ error: 'smartAccountAddress required' });
  }
  if (process.env.STELLAR_NETWORK_NAME === 'mainnet') {
    return res.status(403).json({ error: 'Testnet faucet only' });
  }
  try {
    const result = await claimTestnetFunds(smartAccountAddress, asset, process.env);
    return res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes('24 hours') ? 429 : 503;
    return res.status(status).json({ error: msg });
  }
});

app.get('/roots', async (req, res) => {
  try {
    const walletField = req.query.walletField ? String(req.query.walletField) : '';
    const policyKey = String(req.query.policyKey || 'general-eligibility');
    const shouldSync = req.query.sync === '1' || req.query.sync === 'true';
    if (shouldSync && walletField) {
      const material = buildCredentialMaterial(walletField, process.env, policyKey);
      let chainRoots = await readOnChainRoots(process.env);
      if (normalizeHex32(chainRoots.root) !== normalizeHex32(material.root)) {
        await syncCredentialRootOnChain(material.root, process.env);
        chainRoots = await readOnChainRoots(process.env);
      }
    }
    const roots = await readOnChainRoots(process.env);
    return res.json(roots);
  } catch (err) {
    return res.status(503).json({
      error: 'On-chain roots unavailable',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get('/issuer', (_req, res) => {
  res.json({
    stellarPublicKey: issuer.stellarPublicKey,
    issuerId: issuer.issuerId,
    network: process.env.STELLAR_NETWORK_NAME || 'testnet',
    chain: 'stellar',
    role: 'eligibility-issuer',
    signatureScheme: 'ed25519',
    pubkeyBytes64: issuer.pubkeyBytes64,
  });
});

app.get('/issuer/:id', (req, res) => {
  try {
    const issuer = getIssuerById(req.params.id);
    return res.json(issuer);
  } catch (err) {
    return res.status(503).json({
      error: 'Issuer lookup failed',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

function requireRevokeAuth(req, res) {
  const key = process.env.REVOKE_API_KEY;
  if (!key) {
    res.status(503).json({ error: 'REVOKE_API_KEY not configured on issuer service' });
    return false;
  }
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.body?.apiKey;
  if (token !== key) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

app.post('/revoke', express.json(), async (req, res) => {
  if (!requireRevokeAuth(req, res)) return;
  const commitment = req.body?.commitment || req.body?.credentialCommitment;
  if (!commitment) {
    return res.status(400).json({ error: 'commitment is required' });
  }
  try {
    const result = await revokeCredential({
      commitment,
      reason: req.body?.reason,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    return res.status(503).json({
      error: 'Revocation failed',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get('/policies', (_req, res) => {
  res.json({ policies: policyList() });
});

app.get('/offerings', (_req, res) => {
  try {
    return res.json({ offerings: listOfferings(process.env) });
  } catch (err) {
    return res.status(503).json({
      error: 'Offerings unavailable',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get('/offerings/:id', (req, res) => {
  try {
    const offering = offeringById(String(req.params.id), process.env);
    if (!offering) {
      return res.status(404).json({ error: 'Offering not found' });
    }
    return res.json({ offering });
  } catch (err) {
    return res.status(503).json({
      error: 'Offering unavailable',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post('/registry/sync-root', express.json(), async (req, res) => {
  const walletField = String(req.body?.walletField || '0');
  const policyKey = String(req.body?.policyKey || 'general-eligibility');
  try {
    const material = buildCredentialMaterial(walletField, process.env, policyKey);
    let chainRoots = await readOnChainRoots(process.env);
    let synced = false;
    if (normalizeHex32(chainRoots.root) !== normalizeHex32(material.root)) {
      await syncCredentialRootOnChain(material.root, process.env);
      chainRoots = await readOnChainRoots(process.env);
      synced = true;
    }
    return res.json({
      root: chainRoots.root,
      expectedRoot: material.root,
      synced,
    });
  } catch (err) {
    return res.status(503).json({
      error: 'Cannot sync eligibility registry root',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post('/credential', express.json(), async (req, res) => {
  if (!existsSync(CREDENTIAL_PATH)) {
    return res.status(503).json({
      error: 'Credential fixture missing',
      path: CREDENTIAL_PATH,
    });
  }
  const walletField = String(req.body?.walletField || '0');
  const policyKey = String(req.body?.policyKey || 'general-eligibility');
  const policy = policyByKey(policyKey);

  let chainRoots;
  try {
    chainRoots = await readOnChainRoots(process.env);
  } catch (err) {
    return res.status(503).json({
      error: 'Cannot read on-chain Merkle roots',
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  const material = buildCredentialMaterial(walletField, process.env, policyKey);
  if (normalizeHex32(chainRoots.root) !== normalizeHex32(material.root)) {
    try {
      await syncCredentialRootOnChain(material.root, process.env);
      chainRoots = await readOnChainRoots(process.env);
    } catch (err) {
      return res.status(503).json({
        error: 'Cannot sync credential root for dynamic credential',
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  let built;
  try {
    built = buildProverInputs(walletField, process.env, chainRoots, policyKey);
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to build prover inputs',
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  let noteMeta = null;
  try {
    noteMeta = appendNoteCommitment(built.noteSecret, built.noteBlinding);
    await syncNoteRootOnChain(noteMeta.noteRoot, process.env);
  } catch (err) {
    console.warn('Note root sync skipped:', err instanceof Error ? err.message : String(err));
  }

  const cred = JSON.parse(readFileSync(CREDENTIAL_PATH, 'utf8'));
  const issuerSig = signCommitment(built.commitment);
  if (!verifyCommitmentSignature(built.commitment, issuerSig.signatureBase64)) {
    return res.status(500).json({ error: 'Issuer Ed25519 self-check failed' });
  }
  const issuedAt = Date.now();
  res.json({
    label: policy.title,
    issuerType: 'eligibility',
    policyKey,
    issuedAt,
    expiresAt: issuedAt + 365 * 24 * 60 * 60 * 1000,
    credential: {
      ...cred,
      commitment: built.commitment,
      root: chainRoots.root,
      revocationRoot: chainRoots.revocationRoot,
      nullifier: built.nullifier,
      policyId: policy.policyId,
      assetId: Number(built.proverInputs.asset_id),
      actionId: Number(built.proverInputs.action_id),
      noteSecret: built.noteSecret,
      noteBlinding: built.noteBlinding,
    },
    proverInputs: built.proverInputs,
    issuerStellarPublicKey: issuer.stellarPublicKey,
    issuerId: issuer.issuerId,
    signatureScheme: 'ed25519',
    issuerSignatureBase64: issuerSig.signatureBase64,
    commitment: built.commitment,
    walletField,
    noteCommitment: noteMeta?.commitment || null,
    noteRoot: noteMeta?.noteRoot || chainRoots.noteRoot || null,
  });
});

app.post('/smart-account/passkeys', express.json(), async (req, res) => {
  const smartAccountId = String(req.body?.smartAccountId || '');
  const verifierId =
    String(req.body?.verifierId || process.env.WEBAUTHN_VERIFIER_ID || process.env.VITE_WEBAUTHN_VERIFIER_ID || '');
  const keyDataHex = String(req.body?.keyDataHex || '');
  try {
    const result = await registerPasskeySigner({ smartAccountId, verifierId, keyDataHex });
    return res.json({ ok: true, ...result });
  } catch (err) {
    return res.status(503).json({
      error: 'Passkey registration failed',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post('/pof/nullifier', express.json(), (req, res) => {
  const noteSecret = String(req.body?.noteSecret || req.body?.secret || '');
  const policyId = String(req.body?.policyId || '2');
  if (!noteSecret) {
    return res.status(400).json({ error: 'noteSecret is required' });
  }
  try {
    const nullifier = computePofNullifier(noteSecret, policyId);
    return res.json({
      nullifier: BigInt(nullifier).toString(10),
      nullifierHex: nullifier,
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to compute PoF nullifier',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post('/disclose/store', express.json(), (req, res) => {
  const viewingKey = String(req.body?.viewingKey || '');
  const auditorId = Number(req.body?.auditorId || 1);
  const pack = req.body?.pack;
  if (!viewingKey || !pack || typeof pack !== 'object') {
    return res.status(400).json({ error: 'viewingKey and pack are required' });
  }
  try {
    const stored = appendDisclosure({
      auditorId,
      viewingKeyHash: viewingKeyHash(viewingKey),
      ...pack,
    });
    return res.json({ ok: true, stored });
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to store disclosure',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post('/disclose', express.json(), async (req, res) => {
  const viewingKey = String(req.body?.viewingKey || '');
  const auditorId = Number(req.body?.auditorId || 1);
  const txHash = req.body?.txHash ? String(req.body.txHash) : undefined;
  if (!viewingKey) {
    return res.status(400).json({ error: 'viewingKey is required' });
  }
  try {
    const auth = await authorizeDisclosureQuery({ viewingKey, auditorId, env: process.env });
    if (!auth.authorized) {
      return res.status(403).json({
        error: 'Invalid viewing key for auditor',
        detail: auth.error || 'No matching disclosure or AuditorRegistry registration',
      });
    }
    const disclosures = queryDisclosures({ viewingKey, auditorId, txHash });
    return res.json({
      auditorId,
      txHash: txHash || null,
      count: disclosures.length,
      disclosures,
      authMethod: auth.method,
    });
  } catch (err) {
    return res.status(503).json({
      error: 'Disclosure lookup failed',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`Lumengate issuer service listening on ${HOST}:${PORT}`);
});
