import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test, { afterEach } from 'node:test';

import {
  hashCanonicalManifest,
  verifyReleaseCandidateBundle,
} from '../../../scripts/release/verify-release-candidate-bundle.mjs';

const verifier = resolve('scripts/release/verify-release-candidate-bundle.mjs');
const roots = [];
const hash = (value) => createHash('sha256').update(value).digest('hex');
const git = (repo, args) =>
  execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

afterEach(() => {
  while (roots.length) rmSync(roots.pop(), { recursive: true, force: true });
});

function write(repo, path, body) {
  const target = resolve(repo, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, body);
}

function commit(repo, message) {
  git(repo, ['add', '.']);
  git(repo, ['commit', '-m', message]);
  return git(repo, ['rev-parse', 'HEAD']);
}

function fixture() {
  const repo = mkdtempSync(resolve(tmpdir(), 'consultify-release-verifier-'));
  roots.push(repo);
  git(repo, ['init', '-q']);
  git(repo, ['config', 'user.email', 'release-test@example.com']);
  git(repo, ['config', 'user.name', 'Release Test']);
  write(repo, 'package-lock.json', '{"lockfileVersion":3}\n');
  write(repo, 'sbom.json', '{"bomFormat":"CycloneDX","specVersion":"1.5"}\n');
  write(repo, 'server/migrations/001_base.sql', 'CREATE TABLE base(id text);\n');
  const previousSha = commit(repo, 'previous verified');
  write(repo, 'server/migrations/002_additive.sql', 'ALTER TABLE base ADD COLUMN name text;\n');
  const candidateSha = commit(repo, 'candidate');
  return { repo, previousSha, candidateSha };
}

function artifact(repo, candidateSha, path) {
  const body = execFileSync('git', ['-C', repo, 'show', `${candidateSha}:${path}`]);
  return { path, sha256: hash(body) };
}

function manifestFor({ repo, previousSha, candidateSha }) {
  const migrations = git(repo, ['ls-tree', '-r', '--name-only', candidateSha, '--', 'server/migrations'])
    .split('\n')
    .sort()
    .map((path) => artifact(repo, candidateSha, path));
  const manifest = {
    schemaVersion: 1,
    candidateSha,
    previousVerifiedSha: previousSha,
    treeSha: git(repo, ['rev-parse', `${candidateSha}^{tree}`]),
    authorization: 'NOT_AUTHORIZED',
    cleanBuild: true,
    lockfile: artifact(repo, candidateSha, 'package-lock.json'),
    sbom: { ...artifact(repo, candidateSha, 'sbom.json'), format: 'cyclonedx-json' },
    migrations,
  };
  manifest.manifestSha256 = hashCanonicalManifest(manifest);
  return manifest;
}

function rehash(manifest) {
  manifest.manifestSha256 = hashCanonicalManifest(manifest);
  return manifest;
}

test('accepts an exact immutable Git bundle while retaining NOT_AUTHORIZED', () => {
  const fx = fixture();
  const result = verifyReleaseCandidateBundle({ manifest: manifestFor(fx), repo: fx.repo });
  assert.equal(result.verified, true);
  assert.equal(result.authorization, 'NOT_AUTHORIZED');
  assert.equal(result.releaseGo, false);
  assert.deepEqual(result.errors, []);
});

test('CLI emits stable machine JSON and deterministic exit codes', () => {
  const fx = fixture();
  const path = resolve(fx.repo, 'manifest.json');
  writeFileSync(path, `${JSON.stringify(manifestFor(fx), null, 2)}\n`);
  const first = spawnSync(process.execPath, [verifier, '--repo', fx.repo, '--manifest', path], { encoding: 'utf8' });
  const second = spawnSync(process.execPath, [verifier, '--repo', fx.repo, '--manifest', path], { encoding: 'utf8' });
  assert.equal(first.status, 0);
  assert.equal(second.status, 0);
  assert.equal(first.stdout, second.stdout);
  assert.equal(JSON.parse(first.stdout).releaseGo, false);

  const invalidPath = resolve(fx.repo, 'invalid.json');
  writeFileSync(invalidPath, '{}\n');
  const invalid = spawnSync(process.execPath, [verifier, '--repo', fx.repo, '--manifest', invalidPath], { encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.equal(JSON.parse(invalid.stdout).verified, false);
});

test('rejects manifest, tree, lockfile, SBOM and migration-ledger tampering', () => {
  const fx = fixture();
  const mutations = [
    (m) => { m.manifestSha256 = '0'.repeat(64); },
    (m) => { m.treeSha = '0'.repeat(40); return rehash(m); },
    (m) => { m.lockfile.sha256 = '0'.repeat(64); return rehash(m); },
    (m) => { m.sbom.sha256 = '0'.repeat(64); return rehash(m); },
    (m) => { m.migrations[0].sha256 = '0'.repeat(64); return rehash(m); },
    (m) => { m.migrations.reverse(); return rehash(m); },
    (m) => { m.migrations.pop(); return rehash(m); },
  ];
  for (const mutate of mutations) {
    const manifest = structuredClone(manifestFor(fx));
    mutate(manifest);
    assert.equal(verifyReleaseCandidateBundle({ manifest, repo: fx.repo }).verified, false);
  }
});

test('rejects GO claims and missing clean-build assertion', () => {
  const fx = fixture();
  const go = manifestFor(fx);
  go.authorization = 'GO';
  rehash(go);
  const dirty = manifestFor(fx);
  dirty.cleanBuild = false;
  rehash(dirty);
  assert.match(JSON.stringify(verifyReleaseCandidateBundle({ manifest: go, repo: fx.repo })), /AUTHORIZATION_MUST_REMAIN_NOT_AUTHORIZED/);
  assert.match(JSON.stringify(verifyReleaseCandidateBundle({ manifest: dirty, repo: fx.repo })), /CLEAN_BUILD_ASSERTION_REQUIRED/);
});

test('rejects a rollback SHA that is not an ancestor', () => {
  const fx = fixture();
  git(fx.repo, ['checkout', '--orphan', 'unrelated']);
  for (const path of ['package-lock.json', 'sbom.json', 'server/migrations/001_base.sql', 'server/migrations/002_additive.sql']) {
    try { rmSync(resolve(fx.repo, path), { force: true }); } catch {}
  }
  write(fx.repo, 'unrelated.txt', 'unrelated\n');
  const unrelated = commit(fx.repo, 'unrelated');
  const manifest = manifestFor(fx);
  manifest.previousVerifiedSha = unrelated;
  rehash(manifest);
  assert.match(JSON.stringify(verifyReleaseCandidateBundle({ manifest, repo: fx.repo })), /ROLLBACK_SHA_NOT_ANCESTOR/);
});

for (const scenario of ['deletion', 'modification']) {
  test(`rejects ${scenario} of a migration required by the previous verified SHA`, () => {
    const fx = fixture();
    git(fx.repo, ['checkout', '-q', fx.previousSha]);
    if (scenario === 'deletion') rmSync(resolve(fx.repo, 'server/migrations/001_base.sql'));
    else write(fx.repo, 'server/migrations/001_base.sql', 'CREATE TABLE changed(id text);\n');
    write(fx.repo, 'server/migrations/002_additive.sql', 'ALTER TABLE base ADD COLUMN name text;\n');
    const incompatibleSha = commit(fx.repo, `migration ${scenario}`);
    const incompatible = manifestFor({ ...fx, candidateSha: incompatibleSha });
    const result = verifyReleaseCandidateBundle({ manifest: incompatible, repo: fx.repo });
    assert.equal(result.verified, false);
    assert.match(JSON.stringify(result), scenario === 'deletion' ? /ROLLBACK_MIGRATION_DELETED/ : /ROLLBACK_MIGRATION_MODIFIED/);
  });
}
