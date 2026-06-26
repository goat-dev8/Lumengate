#!/usr/bin/env node
/**
 * Download BN254 CRS slice used by lumengate UltraHonk (browser prover cache seed).
 * Files are served from /crs/* and copied into bb.js IndexedDB before proving.
 */
import { mkdirSync, writeFileSync, statSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'app/public/crs');
// bb.js CachedNetCrs uses numPoints * 64 bytes; 65537 covers lumengate circuit SRS with headroom.
const NUM_POINTS = 65537;
const G1_END = NUM_POINTS * 64 - 1;

async function download(url, rangeEnd) {
  const headers = rangeEnd != null ? { Range: `bytes=0-${rangeEnd}` } : undefined;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`CRS fetch failed ${url}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const g1Path = join(OUT_DIR, 'g1.dat');
  const g2Path = join(OUT_DIR, 'g2.dat');

  if (!existsSync(g1Path) || statSync(g1Path).size < NUM_POINTS * 64) {
    process.stdout.write(`Downloading g1.dat (0-${G1_END})… `);
    const g1 = await download('https://crs.aztec.network/g1.dat', G1_END);
    writeFileSync(g1Path, g1);
    console.log(`${g1.length} bytes`);
  } else {
    console.log('g1.dat already present');
  }

  if (!existsSync(g2Path) || statSync(g2Path).size < 128) {
    process.stdout.write('Downloading g2.dat… ');
    const g2 = await download('https://crs.aztec.network/g2.dat');
    writeFileSync(g2Path, g2);
    console.log(`${g2.length} bytes`);
  } else {
    console.log('g2.dat already present');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
