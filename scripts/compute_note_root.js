#!/usr/bin/env node
/** Poseidon2 Merkle root over note commitments (8-level zero-padded tree). */
const { execSync } = require('child_process');
const { join } = require('path');

const commitments = process.argv.slice(2);
if (!commitments.length) {
  console.log('0x0000000000000000000000000000000000000000000000000000000000000000');
  process.exit(0);
}

const padded = [...commitments];
while (padded.length < 8) padded.push('0x0');

const script = `
const { readFileSync, writeFileSync } = require('fs');
const path = require('path');
const main = path.join('${join(__dirname, '..', 'circuits', 'lumengate', 'src', 'main.nr')}');
let src = readFileSync(main, 'utf8');
const leaves = ${JSON.stringify(padded.slice(0, 8))};
src = src.replace(/global TEST_NOTE_LEAVES: \\[Field; 8\\] = \\[[^\\]]+\\];/, \`global TEST_NOTE_LEAVES: [Field; 8] = [\${leaves.join(', ')}];\`);
writeFileSync(main, src);
`;

require('fs').writeFileSync('/tmp/patch_notes.js', script);
execSync('node /tmp/patch_notes.js');

const out = execSync('nargo test note_root_from_leaves --show-output', {
  cwd: join(__dirname, '..', 'circuits', 'lumengate'),
  env: { ...process.env, PATH: `${process.env.HOME}/.nargo/bin:${process.env.PATH || ''}` },
  encoding: 'utf8',
});
const m = out.match(/note_root=(0x[0-9a-f]+)/i);
if (!m) {
  console.error(out);
  process.exit(1);
}
console.log(m[1]);
