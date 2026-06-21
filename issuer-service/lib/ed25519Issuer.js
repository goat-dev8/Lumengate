const { Keypair } = require('@stellar/stellar-sdk');

function loadIssuerKeypair(env = process.env) {
  const secret = env.ISSUER_ED25519_SECRET || env.ISSUER_STELLAR_SECRET;
  if (!secret) {
    throw new Error('ISSUER_ED25519_SECRET or ISSUER_STELLAR_SECRET required');
  }
  return Keypair.fromSecret(secret);
}

function issuerMetadata(env = process.env) {
  const kp = loadIssuerKeypair(env);
  const raw = kp.rawPublicKey();
  const pubkeyHex = Buffer.from(raw).toString('hex');
  const bytes64 = pubkeyHex.padEnd(128, '0');
  return {
    stellarPublicKey: kp.publicKey(),
    issuerId: Number(env.ISSUER_ID || env.ISSUER_ETH_ID || 2),
    signatureScheme: 'ed25519',
    pubkeyHex,
    pubkeyBytes64: bytes64,
    chain: 'stellar',
  };
}

/** Sign credential commitment (32-byte hex) with Stellar Ed25519. */
function signCommitment(commitmentHex, env = process.env) {
  const kp = loadIssuerKeypair(env);
  const hex = String(commitmentHex).replace(/^0x/i, '');
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error('commitment must be 32-byte hex');
  }
  const message = Buffer.from(hex, 'hex');
  const signature = kp.sign(message);
  return {
    ...issuerMetadata(env),
    commitment: `0x${hex.toLowerCase()}`,
    signatureBase64: signature.toString('base64'),
    signatureHex: signature.toString('hex'),
  };
}

function verifyCommitmentSignature(commitmentHex, signatureBase64, env = process.env) {
  const kp = loadIssuerKeypair(env);
  const hex = String(commitmentHex).replace(/^0x/i, '');
  const message = Buffer.from(hex, 'hex');
  const sig = Buffer.from(signatureBase64, 'base64');
  return kp.verify(message, sig);
}

module.exports = {
  loadIssuerKeypair,
  issuerMetadata,
  signCommitment,
  verifyCommitmentSignature,
};
