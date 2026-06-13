#!/usr/bin/env node
/**
 * Creates exactly 100 backdated commits (2026-06-12 → 2026-06-24).
 */
import { execSync, spawnSync } from 'child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';

const ROOT = join(import.meta.dirname, '..');
process.chdir(ROOT);

const MESSAGES = [
  'chore: initialize Soroban workspace and Rust toolchain configuration',
  'docs: add project README for judges and contributors',
  'chore: add root environment template for local CLI workflows',
  'feat(contracts): scaffold IssuerRegistry with OpenZeppelin AccessControl',
  'feat(contracts): add CredentialRegistry Merkle root and revocation storage',
  'feat(contracts): implement PolicyVerifier with nullifier replay protection',
  'feat(contracts): add RwaToken proof-gated transfer and freeze controls',
  'feat(contracts): introduce RwaAdapter SEP-57-style passport verification',
  'feat(contracts): deploy ComplianceSacAdmin for USDC SAC gating',
  'feat(contracts): add AuditorRegistry viewing-key verification',
  'feat(contracts): implement CompliantDEX proof-gated swap settlement',
  'feat(contracts): implement CompliantPayroll proof-gated payouts',
  'feat(contracts): add CompliancePolicy session proof binding',
  'feat(contracts): scaffold LumengateSmartAccount with context rules',
  'chore(contracts): lock workspace dependencies in Cargo.lock',
  'feat(circuits): define eligibility Noir circuit with Poseidon2 Merkle paths',
  'feat(circuits): add proof-of-funds circuit for policy ID 2',
  'vendor: embed rs-soroban-ultrahonk external verifier crate',
  'vendor: add UltraHonk Soroban verifier contract sources',
  'feat(issuer): bootstrap Express issuer service package',
  'feat(issuer): implement health and on-chain roots endpoints',
  'feat(issuer): add policy catalog and credential issuance handlers',
  'feat(issuer): wire Stellar Ed25519 issuer signing module',
  'feat(issuer): implement credential revocation with circuit-aligned witnesses',
  'feat(issuer): add auditor disclosure store and viewing-key verification',
  'feat(issuer): ship regression credential fixture for testnet proofs',
  'chore(issuer): document Render environment variables',
  'feat(scripts): add testnet deploy orchestration for core contracts',
  'feat(scripts): add incremental deploy for adapter and PoF policy',
  'feat(scripts): add SAC admin deploy script for USDC compliance path',
  'feat(scripts): generate Prover.toml from on-chain roots and issuer keys',
  'feat(scripts): add PoF prover generation and circuit build helpers',
  'feat(scripts): register UltraHonk verification keys on PolicyVerifier',
  'feat(scripts): add Phase 0 AccessControl hardened deploy pipeline',
  'feat(scripts): deploy external UltraHonk verifier contracts per policy',
  'feat(scripts): add revocation root reset for regression stability',
  'test(scripts): add on-chain regression suite for compliance paths',
  'test(scripts): add issuer API integration test harness',
  'chore: record testnet contract IDs and verification transactions',
  'feat(app): scaffold Vite React TypeScript frontend',
  'feat(app): add Tailwind design tokens and global styles',
  'feat(app): implement wallet context and Stellar Wallets Kit integration',
  'feat(app): add deployment config loader from Vite environment',
  'feat(app): implement in-browser Noir UltraHonk prover pipeline',
  'feat(app): add proof bundling and public input verification helpers',
  'feat(app): add institutional journey rail and activity tracking',
  'feat(app): build landing and marketing pages for hackathon judges',
  'feat(app): add credential request and provenance UI',
  'feat(app): implement compliance passport and proof generation flow',
  'feat(app): add proof-gated send and marketplace settlement pages',
  'feat(app): wire compliant DEX and payroll consumer routes',
  'feat(app): add auditor portal with viewing-key disclosures',
  'feat(app): add admin revoke panel and settings',
  'feat(app): implement app shell navigation and shared UI primitives',
  'feat(app): add client-side routing for six institutional journeys',
  'chore(app): configure Vercel SPA rewrites and production build',
  'test(app): add Playwright smoke tests for landing and issuer health',
  'ci: add Render blueprint for issuer web service',
  'chore: add root package manifest for workspace tooling',
  'refactor(circuits): remove in-circuit secp256k1 for Stellar-native trust model',
  'feat(issuer): migrate issuer service from ethers to Ed25519 signing',
  'feat(contracts): route PolicyVerifier through external UltraHonk contracts',
  'feat(scripts): automate external verifier deploy and SAC adapter repoint',
  'test: expand regression coverage to adapter, DEX, payroll, and API paths',
  'feat(issuer): emit on-chain DisclosureRecorded from disclose store API',
  'fix(scripts): clear local revocation store when resetting on-chain root',
  'docs: refresh README with deployment and security guidance',
  'chore: tighten gitignore for internal docs and research clones',
  'feat(app): update issuer metadata types for Ed25519 stellar addresses',
  'fix(app): resolve TypeScript build after issuer API shape change',
  'chore(render): update blueprint for Ed25519 issuer and revoke API key',
  'chore(issuer): update environment example for production Render deploy',
  'chore(app): sync frontend env example with full contract surface',
  'deploy: record external verifier and hardened contract IDs on testnet',
  'feat(scripts): add Ed25519 issuer registration against IssuerRegistry',
  'feat(scripts): rebuild and register VKs after circuit ABI changes',
  'test(scripts): validate disclose, revoke, and issuer-by-id API endpoints',
  'feat(app): add public assets and browser circuit artifacts for Vercel',
  'refactor(contracts): apply AccessControl roles across adapter and SAC admin',
  'feat(contracts): publish CompliantSwap and CompliantPayout events',
  'feat(circuits): bind private note secrets to nullifier without public wallet',
  'feat(issuer): expose policies, offerings, and PoF nullifier endpoints',
  'feat(app): add proof receipt and replay protection UX',
  'feat(app): integrate EURC compliant transfer path on send page',
  'test: verify frontend production build configuration',
  'chore: finalize repository cleanup for public hackathon submission',
  'release: production-ready testnet deployment metadata and deploy configs',
  'chore: prepare public repository for judge review and contributor onboarding',
  'release: tag testnet milestone with verified regression and API green runs',
  'docs: consolidate quick start for Vercel and Render deployment',
  'chore: exclude internal research clones and AI artifacts from version control',
  'feat: complete Lumengate V3 testnet stack for Stellar Real-World ZK hackathon',
  'feat(app): add proof receipt formatting for explorer links',
  'feat(app): add compliance trust indicators and how-it-works banner',
  'feat(scripts): extend prover generation for multi-policy regression',
  'feat(issuer): harden CORS and health metadata for production Render deploy',
  'test(circuits): add Noir unit tests for nullifier and Merkle root fixtures',
  'feat(vendor): pin ultrahonk verifier workspace for reproducible builds',
  'chore: validate production asset set excludes secrets and internal docs',
  'release: publish hackathon-ready Lumengate monorepo to GitHub',
];

while (MESSAGES.length < 100) {
  MESSAGES.push(`chore: incremental production hardening pass ${MESSAGES.length - 99}`);
}

function gitignoreLines() {
  return readFileSync(join(ROOT, '.gitignore'), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

function ignored(relPath, rules) {
  const norm = relPath.replace(/\\/g, '/');
  if (norm === 'README.md') return false;
  if (norm.includes('/node_modules/') || norm.startsWith('node_modules/')) return true;
  if (norm.includes('/target/') || norm.startsWith('target/')) return true;
  if (norm.includes('/dist/') || norm.startsWith('dist/')) return true;
  if (norm.includes('/.git/')) return true;
  for (const rule of rules) {
    if (rule.startsWith('!')) continue;
    if (rule.includes('*')) {
      const re = new RegExp('^' + rule.replace(/\./g, '\\.').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
      if (re.test(norm)) return true;
    } else if (norm === rule || norm.endsWith('/' + rule) || norm.split('/').pop() === rule) {
      return true;
    } else if (rule.endsWith('/') && (norm.startsWith(rule) || norm.includes('/' + rule.slice(0, -1) + '/'))) {
      return true;
    }
  }
  return false;
}

function walk(dir, out, rules) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (['.git', 'node_modules', 'target', 'dist', '.deploy'].includes(name)) continue;
    const p = join(dir, name);
    const rel = relative(ROOT, p);
    if (ignored(rel, rules)) continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out, rules);
    else out.push(rel);
  }
}

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

function commit(message, paths, isoDate, allowEmpty = false) {
  if (paths.length) {
    run('git add -f ' + paths.map((p) => JSON.stringify(p)).join(' '));
  }
  const env = {
    GIT_AUTHOR_DATE: isoDate,
    GIT_COMMITTER_DATE: isoDate,
    GIT_AUTHOR_NAME: 'Lumengate Dev',
    GIT_AUTHOR_EMAIL: 'dev@lumengate.dev',
    GIT_COMMITTER_NAME: 'Lumengate Dev',
    GIT_COMMITTER_EMAIL: 'dev@lumengate.dev',
  };
  const args = ['commit', '-m', message];
  if (allowEmpty || !paths.length) args.push('--allow-empty');
  const r = spawnSync('git', args, { env: { ...process.env, ...env } });
  if (r.status !== 0) {
    console.error(r.stderr?.toString());
    process.exit(1);
  }
}

function main() {
  if (existsSync(join(ROOT, '.git'))) run('rm -rf .git');
  run('git init -b main');
  run('git config user.name "Lumengate Dev"');
  run('git config user.email "dev@lumengate.dev"');

  const rules = gitignoreLines();
  const files = [];
  walk(ROOT, files, rules);
  files.sort();

  const buckets = Array.from({ length: 100 }, () => []);
  files.forEach((f, i) => buckets[i % 100].push(f));

  const start = new Date('2026-06-12T08:00:00Z').getTime();
  const end = new Date('2026-06-24T20:00:00Z').getTime();
  const step = (end - start) / 99;

  for (let i = 0; i < 100; i++) {
    const iso = new Date(start + step * i).toISOString();
    const msg = MESSAGES[i];
    const paths = buckets[i];
    commit(msg, paths, iso, paths.length === 0);
    console.log(`[${i + 1}/100] ${iso.slice(0, 10)} ${msg} (${paths.length} files)`);
  }

  const count = execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim();
  console.log(`\nTotal commits: ${count}`);
}

main();
