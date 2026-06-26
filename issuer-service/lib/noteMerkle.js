const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const { join } = require('path');
const {
  computeNoteCommitment: poseidonNoteCommitment,
  computeNoteRootFromLeaves,
} = require('./poseidonFields');
const { syncNoteRootOnChain: syncNoteRootViaSdk } = require('./sorobanAdmin');

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

async function syncNoteRootOnChain(noteRootHex, env = process.env) {
  return syncNoteRootViaSdk(noteRootHex, env);
}

module.exports = {
  appendNoteCommitment,
  computeNoteCommitment,
  computeNoteRoot,
  getNoteRootState,
  syncNoteRootOnChain,
};

