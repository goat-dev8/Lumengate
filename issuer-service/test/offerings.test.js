const test = require('node:test');
const assert = require('node:assert/strict');
const { listOfferings, offeringById } = require('../lib/offerings');

test('listOfferings returns at least six marketplace rows', () => {
  const rows = listOfferings({ ISSUER_ID: '2' });
  assert.ok(rows.length >= 6);
  assert.ok(rows.every((row) => row.policyId > 0));
});

test('offeringById resolves treasury-fund', () => {
  const row = offeringById('treasury-fund', { ISSUER_ID: '2' });
  assert.equal(row.id, 'treasury-fund');
  assert.equal(row.settlementRoute, 'rwa');
});

test('offeringById returns null for unknown id', () => {
  assert.equal(offeringById('missing-offering'), null);
});

test('sac settlement route maps verification to ComplianceSacAdmin', () => {
  const sacOffering = listOfferings({ ISSUER_ID: '2' }).find((o) => o.settlementRoute === 'sac');
  assert.ok(sacOffering);
  assert.match(sacOffering.verificationRoute, /ComplianceSacAdmin/);
});
