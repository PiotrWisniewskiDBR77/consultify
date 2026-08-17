#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashCanonicalManifest } from './verify-release-candidate-bundle.mjs';

const REQUIRED = ['backendBuild', 'frontendBuild', 'reporter82', 'typecheck'];
const hash = (v) => createHash('sha256').update(v).digest('hex');
const git = (r, a, e = 'utf8') =>
  execFileSync('git', ['-C', r, ...a], { encoding: e, stdio: ['ignore', 'pipe', 'pipe'] });
const text = (r, a) => git(r, a).trim(),
  file = (r, s, p) => git(r, ['show', `${s}:${p}`], null);
const artifact = (r, s, p) => ({ path: p, sha256: hash(file(r, s, p)) });
const stable = (v) =>
  Array.isArray(v)
    ? v.map(stable)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, stable(v[k])])
        )
      : v;

export function cyclonedxFromLockfile(lockBytes, candidateSha) {
  const lock = JSON.parse(lockBytes.toString()),
    components = [];
  for (const [path, pkg] of Object.entries(lock.packages ?? {})) {
    if (!path || !pkg?.name || !pkg?.version) continue;
    components.push({
      type: 'library',
      name: pkg.name,
      version: String(pkg.version),
      purl: `pkg:npm/${encodeURIComponent(pkg.name)}@${pkg.version}`,
    });
  }
  components.sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`));
  return `${JSON.stringify(
    stable({
      bomFormat: 'CycloneDX',
      specVersion: '1.5',
      version: 1,
      metadata: {
        properties: [
          { name: 'consultify:candidateSha', value: candidateSha },
          { name: 'consultify:lockfileSha256', value: hash(lockBytes) },
        ],
      },
      components,
    }),
    null,
    2
  )}\n`;
}

export function generateReleaseCandidateBundle({
  repo,
  candidateSha,
  previousVerifiedSha,
  candidateRef,
  receiptFiles,
  outputDir,
}) {
  if (text(repo, ['rev-parse', '--verify', candidateRef]) !== candidateSha)
    throw Error('CANDIDATE_REF_MISMATCH');
  if (text(repo, ['status', '--porcelain=v1', '--untracked-files=all']))
    throw Error('WORKTREE_DIRTY');
  git(repo, ['merge-base', '--is-ancestor', previousVerifiedSha, candidateSha]);
  const receiptNames = Object.keys(receiptFiles).sort();
  for (const name of REQUIRED)
    if (!receiptNames.includes(name)) throw Error(`REQUIRED_RECEIPT_MISSING:${name}`);
  mkdirSync(resolve(outputDir, 'receipts'), { recursive: true });
  const lockBytes = file(repo, candidateSha, 'package-lock.json'),
    sbom = cyclonedxFromLockfile(lockBytes, candidateSha);
  writeFileSync(resolve(outputDir, 'sbom.cdx.json'), sbom);
  const receipts = receiptNames.map((name) => {
    const bytes = readFileSync(receiptFiles[name]);
    const parsed = JSON.parse(bytes);
    if (parsed.candidateSha !== candidateSha || parsed.exitCode !== 0)
      throw Error(`STALE_OR_FAILED_RECEIPT:${name}`);
    const path = `receipts/${name}-${basename(receiptFiles[name])}`;
    writeFileSync(resolve(outputDir, path), bytes);
    return { name, path, sha256: hash(bytes) };
  });
  const paths = text(repo, [
    'ls-tree',
    '-r',
    '--name-only',
    candidateSha,
    '--',
    'server/migrations',
  ])
    .split('\n')
    .filter(Boolean)
    .sort();
  const manifest = {
    schemaVersion: 2,
    candidateSha,
    previousVerifiedSha,
    candidateRef,
    treeSha: text(repo, ['rev-parse', `${candidateSha}^{tree}`]),
    authorization: 'NOT_AUTHORIZED',
    technicalStatus: 'TECHNICAL_BUNDLE_READY',
    lockfile: artifact(repo, candidateSha, 'package-lock.json'),
    sbom: {
      path: 'sbom.cdx.json',
      sha256: hash(sbom),
      format: 'cyclonedx-json',
      sourceLockfileSha256: hash(lockBytes),
    },
    migrations: paths.map((p) => artifact(repo, candidateSha, p)),
    receipts,
  };
  manifest.manifestSha256 = hashCanonicalManifest(manifest);
  writeFileSync(
    resolve(outputDir, 'release-candidate-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  return manifest;
}
function parse(a) {
  const v = { repo: process.cwd(), receipts: {} };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--repo') v.repo = a[++i];
    else if (a[i] === '--candidate') v.candidateSha = a[++i];
    else if (a[i] === '--previous') v.previousVerifiedSha = a[++i];
    else if (a[i] === '--candidate-ref') v.candidateRef = a[++i];
    else if (a[i] === '--output') v.outputDir = a[++i];
    else if (a[i] === '--receipt') {
      const [n, p] = a[++i].split('=', 2);
      v.receipts[n] = p;
    } else throw Error(`Unknown argument: ${a[i]}`);
  }
  for (const k of ['candidateSha', 'previousVerifiedSha', 'candidateRef', 'outputDir'])
    if (!v[k]) throw Error(`missing ${k}`);
  return v;
}
async function main() {
  try {
    const a = parse(process.argv.slice(2));
    const m = generateReleaseCandidateBundle({
      repo: resolve(a.repo),
      candidateSha: a.candidateSha,
      previousVerifiedSha: a.previousVerifiedSha,
      candidateRef: a.candidateRef,
      receiptFiles: a.receipts,
      outputDir: resolve(a.outputDir),
    });
    process.stdout.write(
      `${JSON.stringify({ technicalStatus: 'TECHNICAL_BUNDLE_READY', authorization: 'NOT_AUTHORIZED', candidateSha: m.candidateSha, manifestSha256: m.manifestSha256, releaseGo: false })}\n`
    );
  } catch (e) {
    process.stdout.write(
      `${JSON.stringify({ technicalStatus: 'NOT_VERIFIED', authorization: 'NOT_AUTHORIZED', releaseGo: false, error: e instanceof Error ? e.message : String(e) })}\n`
    );
    process.exitCode = 1;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
