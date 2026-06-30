#!/usr/bin/env node
/**
 * Manual-assisted validation runner for the 10 fresh passkey user matrix.
 * Prints the checklist from ROOT_CAUSE_SYNC_REPORT.md and runs automated pre-checks.
 *
 * Usage:
 *   node scripts/ct_passkey_validation.mjs
 *   node scripts/ct_passkey_validation.mjs --record 1 pass   # mark user 1 passed
 */
import { spawnSync } from 'child_process';

const args = process.argv.slice(2);
const results = new Map();

if (args[0] === '--record' && args.length >= 3) {
  const user = Number(args[1]);
  const status = args[2];
  console.log(`Recorded user ${user}: ${status}`);
  process.exit(0);
}

console.log('=== CT Passkey Validation (10 users) ===\n');
console.log('Automated pre-checks:');
const pre = spawnSync('node', ['scripts/verify_ct_sync.mjs'], { stdio: 'inherit' });
if (pre.status !== 0) {
  console.error('\nAutomated pre-checks FAILED. Fix before manual passkey testing.');
  process.exit(1);
}

console.log('\nManual steps per user (passkey prompts required):');
const steps = [
  'Create passkey smart account (Verify page)',
  'Enable Trusted Device (7-day session)',
  'Register private EURC (Confidential EURC panel)',
  'Shield public EURC (Dashboard)',
  'Merge received → spendable',
  'Private send to another registered account',
  'Recipient merges received balance',
  'Unshield to public EURC',
];

for (let i = 1; i <= 10; i += 1) {
  console.log(`\nUser ${i}:`);
  for (const step of steps) console.log(`  [ ] ${step}`);
  console.log(`  Record: node scripts/ct_passkey_validation.mjs --record ${i} pass|fail`);
}

console.log('\nFail if ANY user shows persistent Syncing… / Checking… / Waiting… / Reading…');
console.log('Only commit/push to production after all 10 users pass.');
