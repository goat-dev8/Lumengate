#!/usr/bin/env node
/** Write Prover.toml from issuer /credential proverInputs JSON. */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const inputPath = process.argv[2] || '/tmp/cred.json';
const cred = JSON.parse(readFileSync(inputPath, 'utf8'));
const pi = cred.proverInputs;
const wf = cred.walletField;

const arr = (v) => (Array.isArray(v) ? v : []);
const toml = `# From issuer /credential walletField=${wf}
accredited = ${pi.accredited}
sanctions_clear = ${pi.sanctions_clear}
jurisdiction_code = "${pi.jurisdiction_code}"
dob_timestamp = "${pi.dob_timestamp}"
issuer_id = "${pi.issuer_id}"
salt = "${pi.salt}"
secret = "${pi.secret}"
note_secret = "${pi.note_secret ?? pi.secret}"
note_blinding = "${pi.note_blinding ?? '555555'}"
current_time = "${pi.current_time}"
min_jurisdiction = "${pi.min_jurisdiction}"
max_jurisdiction = "${pi.max_jurisdiction}"
policy_id = "${pi.policy_id}"
wallet = "${pi.wallet}"
root = "${pi.root}"
revocation_root = "${pi.revocation_root}"
nullifier = "${pi.nullifier}"
path_siblings = [${arr(pi.path_siblings).map((v) => `"${v}"`).join(', ')}]
path_bits = [${arr(pi.path_bits).map((v) => `"${v}"`).join(', ')}]
rev_path_siblings = [${arr(pi.rev_path_siblings).map((v) => `"${v}"`).join(', ')}]
rev_path_bits = [${arr(pi.rev_path_bits).map((v) => `"${v}"`).join(', ')}]
pubkey_x = [${arr(pi.pubkey_x).join(', ')}]
pubkey_y = [${arr(pi.pubkey_y).join(', ')}]
signature = [${arr(pi.signature).join(', ')}]
commitment_hash_bytes = [${arr(pi.commitment_hash_bytes).join(', ')}]
`;

const out = join(ROOT, 'circuits', 'lumengate', 'Prover.toml');
writeFileSync(out, toml);
console.log('Wrote', out);
