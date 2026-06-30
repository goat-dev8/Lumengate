const test = require('node:test');
const assert = require('node:assert/strict');
const { Keypair } = require('@stellar/stellar-sdk');

test('signCommitment round-trips verifyCommitmentSignature', () => {
  const kp = Keypair.random();
  process.env.ISSUER_ED25519_SECRET = kp.secret();
  delete process.env.ISSUER_STELLAR_SECRET;

  const { signCommitment, verifyCommitmentSignature } = require('../lib/ed25519Issuer');
  const commitment = '0x' + 'ab'.repeat(32);
  const signed = signCommitment(commitment);
  assert.equal(
    verifyCommitmentSignature(commitment, signed.signatureBase64),
    true,
  );
});

test('signCommitment rejects invalid hex', () => {
  const kp = Keypair.random();
  process.env.ISSUER_ED25519_SECRET = kp.secret();
  const { signCommitment } = require('../lib/ed25519Issuer');
  assert.throws(() => signCommitment('not-hex'), /32-byte hex/);
});

test('issuerMetadata exposes ed25519 scheme', () => {
  const kp = Keypair.random();
  process.env.ISSUER_ED25519_SECRET = kp.secret();
  process.env.ISSUER_ID = '2';
  const { issuerMetadata } = require('../lib/ed25519Issuer');
  const meta = issuerMetadata();
  assert.equal(meta.signatureScheme, 'ed25519');
  assert.equal(meta.issuerId, 2);
  assert.match(meta.pubkeyBytes64, /^[0-9a-f]{128}$/);
});
