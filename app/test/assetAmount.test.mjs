import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatStellarAmount,
  hasSufficientBalance,
  parseStellarAmount,
} from '../src/lib/assetAmount.ts';

test('parseStellarAmount converts decimals to stroops', () => {
  assert.equal(parseStellarAmount('1.5'), 15_000_000n);
  assert.equal(parseStellarAmount('0'), 0n);
});

test('parseStellarAmount rejects invalid input', () => {
  assert.throws(() => parseStellarAmount(''), /valid amount/);
  assert.throws(() => parseStellarAmount('1.12345678'), /decimal places/);
});

test('formatStellarAmount trims trailing zeros', () => {
  assert.equal(formatStellarAmount(15_000_000n), '1.5');
  assert.equal(formatStellarAmount(10_000_000n), '1');
});

test('hasSufficientBalance requires positive amount', () => {
  assert.equal(hasSufficientBalance(100n, 50n), true);
  assert.equal(hasSufficientBalance(10n, 0n), false);
  assert.equal(hasSufficientBalance(5n, 10n), false);
});
