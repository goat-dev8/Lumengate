#!/usr/bin/env node
const { weierstrass } = require('@noble/curves/abstract/weierstrass');
const { Field } = require('@noble/curves/abstract/modular');

const FR_MODULUS = 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;
const FP_MODULUS = 0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47n;
const H_X = 0x054aa86a73cb8a34525e5bbed6e43ba1198e860f5f3950268f71df4591bde402n;
const H_Y = 0x209dcfbf2cfb57f9f6046f44d71ac6caf87254afc7407c04eb621a6287cac126n;
const G_X = 0x083e7911d835097629f0067531fc15cafd79a89beecb39903f69572c636f4a5an;
const G_Y = 0x1a7f5efaad7f315c25a918f30cc8d7333fccab7ad7c90f14de81bcc528f9935dn;

const Fr = Field(FR_MODULUS);
const Grumpkin = weierstrass({
  a: 0n,
  b: Fr.create(-17n),
  Fp: Fr,
  n: FP_MODULUS,
  h: 1n,
  Gx: G_X,
  Gy: G_Y,
});
const H = Grumpkin.fromAffine({ x: H_X, y: H_Y });

function toBytes32BE(n) {
  const out = Buffer.alloc(32);
  let v = n;
  for (let i = 31; i >= 0; i -= 1) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

const skHex = process.argv[2];
if (!skHex || skHex.length !== 64) {
  console.error('usage: ct_auditor_point.cjs <32-byte-sk-hex>');
  process.exit(1);
}
let sk = BigInt(`0x${skHex}`) % FP_MODULUS;
if (sk === 0n) sk = 1n;
const point = H.multiply(sk);
const { x, y } = point.toAffine();
console.log(Buffer.concat([toBytes32BE(x), toBytes32BE(y)]).toString('hex'));
