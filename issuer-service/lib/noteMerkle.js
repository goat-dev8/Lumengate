const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const { join } = require('path');
const { execFileSync } = require('child_process');
const {
  computeNoteCommitment: poseidonNoteCommitment,
  computeNoteRootFromLeaves,
} = require('./poseidonFields');

const DATA_DIR = join(__dirname, '..', 'data');
const NOTES_PATH = join(DATA_DIR, 'note_commitments.json');

function loadNotes() {
  if (!existsSync(NOTES_PATH)) return [];
  try {
    return JSON.parse(readFileSync(NOTES_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function saveNotes(rows) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(NOTES_PATH, JSON.stringify(rows, null, 2));
}

function computeNoteCommitment(noteSecret, noteBlinding) {
  return poseidonNoteCommitment(noteSecret, noteBlinding);
}

function computeNoteRoot(commitments) {
  return computeNoteRootFromLeaves(commitments);
}

function appendNoteCommitment(noteSecret, noteBlinding) {
  const commitment = computeNoteCommitment(noteSecret, noteBlinding);
  const rows = loadNotes();
  if (!rows.includes(commitment)) rows.push(commitment);
  saveNotes(rows);
  const noteRoot = computeNoteRoot(rows);
  return { commitment, noteRoot, count: rows.length };
}

function getNoteRootState() {
  const rows = loadNotes();
  return { commitments: rows, noteRoot: computeNoteRoot(rows) };
}

function syncNoteRootOnChain(noteRootHex, env = process.env) {
  const registryId = env.CREDENTIAL_REGISTRY_ID || env.VITE_CREDENTIAL_REGISTRY_ID;
  const secret = env.CONTRACT_ADMIN_SECRET_KEY;
  if (!registryId || !secret) return null;
  execFileSync('stellar', ['network', 'use', 'testnet'], { env: process.env });
  execFileSync('stellar', ['keys', 'add', 'admin', '--secret-key', '--overwrite'], {
    input: secret,
    env: process.env,
  });
  const admin = env.CONTRACT_ADMIN_PUBLIC_KEY;
  const root = String(noteRootHex).replace(/^0x/i, '').padStart(64, '0');
  execFileSync(
    'stellar',
    [
      'contract',
      'invoke',
      '--id',
      registryId,
      '--source-account',
      'admin',
      '--network',
      'testnet',
      '--send',
      'yes',
      '--',
      'set_note_root',
      '--caller',
      admin,
      '--note_root',
      root,
    ],
    { encoding: 'utf8', env: process.env },
  );
  return root;
}

module.exports = {
  appendNoteCommitment,
  computeNoteCommitment,
  computeNoteRoot,
  getNoteRootState,
  syncNoteRootOnChain,
};
