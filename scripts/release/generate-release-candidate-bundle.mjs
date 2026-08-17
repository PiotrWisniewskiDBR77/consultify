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
    if (!path || !pkg?.version) continue;
    const nodeModulesMarker = 'node_modules/';
    const markerIndex = path.lastIndexOf(nodeModulesMarker);
    const name =
      pkg.name ||
      (markerIndex >= 0
        ? path.slice(markerIndex + nodeModulesMarker.length)
        : path.replace(/^\.\//, '').split('/').filter(Boolean).at(-1));
    if (!name) continue;
    const installPath = encodeURIComponent(path);
    // Package URL's npm convention models a scope as namespace/name. The
    // leading @ is escaped, while the namespace separator remains a slash.
    const purlName = name.startsWith('@')
      ? `${encodeURIComponent(name.slice(0, name.indexOf('/')))}/${encodeURIComponent(name.slice(name.indexOf('/') + 1))}`
      : encodeURIComponent(name);
    components.push({
      type: 'library',
      name,
      version: String(pkg.version),
      'bom-ref': `pkg:npm/${purlName}@${encodeURIComponent(String(pkg.version))}?install_path=${installPath}`,
      purl: `pkg:npm/${purlName}@${encodeURIComponent(String(pkg.version))}?install_path=${installPath}`,
      properties: [{ name: 'consultify:lockfilePath', value: path }],
    });
  }
  components.sort((a, b) => a['bom-ref'].localeCompare(b['bom-ref']));
  return `${JSON.stringify(
    stable({
      bomFormat: 'CycloneDX',
      specVersion: '1.5',
      version: 1,
      metadata: {
        properties: [
          { name: 'consultify:candidateSha', value: candidateSha },
          { name: 'consultify:lockfileSha256', value: hash(lockBytes) },
          { name: 'consultify:componentCount', value: String(components.length) },
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
    const treeSha = text(repo, ['rev-parse', `${candidateSha}^{tree}`]);
    if (
      parsed.gateId !== name ||
      parsed.candidateSha !== candidateSha ||
      parsed.treeSha !== treeSha ||
      parsed.exitCode !== 0 ||
      parsed.provenanceType !== 'local-process'
    )
      throw Error(`STALE_OR_FAILED_RECEIPT:${name}`);
    const path = `receipts/${name}-${basename(receiptFiles[name])}`;
    writeFileSync(resolve(outputDir, path), bytes);
    return {
      name,
      gateId: parsed.gateId,
      provenanceType: parsed.provenanceType,
      path,
      sha256: hash(bytes),
    };
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
    technicalStatus: 'UNATTESTED_LOCAL_RECEIPTS',
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
      `${JSON.stringify({ technicalStatus: 'UNATTESTED_LOCAL_RECEIPTS', authorization: 'NOT_AUTHORIZED', candidateSha: m.candidateSha, manifestSha256: m.manifestSha256, releaseGo: false })}\n`
    );
  } catch (e) {
    process.stdout.write(
      `${JSON.stringify({ technicalStatus: 'NOT_VERIFIED', authorization: 'NOT_AUTHORIZED', releaseGo: false, error: e instanceof Error ? e.message : String(e) })}\n`
    );
    process.exitCode = 1;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
