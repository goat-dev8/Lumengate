import test from 'node:test';
import assert from 'node:assert/strict';
import { ASSET_SCOPES, proofScopeMatches, scopedNullifierDecimal, scopeKey } from '../src/lib/assetScope.ts';

test('ASSET_SCOPES maps USDC to asset id 2', () => {
  assert.equal(ASSET_SCOPES.usdc.assetId, '2');
  assert.equal(ASSET_SCOPES.usdc.actionId, '1');
});

test('proofScopeMatches requires asset and action ids', () => {
  const scope = ASSET_SCOPES.eurc;
  assert.equal(
    proofScopeMatches({ publicInputs: { assetId: '3', actionId: '1' } }, scope),
    true,
  );
  assert.equal(
    proofScopeMatches({ publicInputs: { assetId: '2', actionId: '1' } }, scope),
    false,
  );
});

test('scopedNullifierDecimal is deterministic', () => {
  const a = scopedNullifierDecimal('12345', '1', '2', '1');
  const b = scopedNullifierDecimal('12345', '1', '2', '1');
  assert.equal(a, b);
  assert.match(a, /^\d+$/);
});

test('scopeKey encodes asset and action', () => {
  assert.equal(scopeKey(ASSET_SCOPES.rwa), 'rwa:settlement');
});
