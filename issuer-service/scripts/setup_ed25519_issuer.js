#!/usr/bin/env node
/** Generate Stellar Ed25519 issuer keypair for Lumengate Phase 0 migration. */
const { Keypair } = require('@stellar/stellar-sdk');

const kp = Keypair.random();
const pubkeyHex = Buffer.from(kp.rawPublicKey()).toString('hex');
const bytes64 = pubkeyHex.padEnd(128, '0');

console.log(JSON.stringify({
  ISSUER_ED25519_SECRET: kp.secret(),
  ISSUER_STELLAR_PUBLIC_KEY: kp.publicKey(),
  ISSUER_ED25519_PUBKEY_HEX: pubkeyHex,
  ISSUER_ED25519_PUBKEY_BYTES64: bytes64,
  ISSUER_ID: '2',
}, null, 2));
