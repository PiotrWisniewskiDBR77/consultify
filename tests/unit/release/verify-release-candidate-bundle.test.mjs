import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test, { afterEach } from 'node:test';
import { generateReleaseCandidateBundle } from '../../../scripts/release/generate-release-candidate-bundle.mjs';
import { verifyReleaseCandidateBundle } from '../../../scripts/release/verify-release-candidate-bundle.mjs';
const roots = [],
  hash = (v) => createHash('sha256').update(v).digest('hex'),
  git = (r, a) => execFileSync('git', ['-C', r, ...a], { encoding: 'utf8' }).trim();
afterEach(() => {
  while (roots.length) rmSync(roots.pop(), { recursive: true, force: true });
});
const write = (r, p, b) => {
  const t = resolve(r, p);
  mkdirSync(dirname(t), { recursive: true });
  writeFileSync(t, b);
};
const commit = (r, m) => {
  git(r, ['add', '.']);
  git(r, ['commit', '-m', m]);
  return git(r, ['rev-parse', 'HEAD']);
};
function fx(sql = 'ALTER TABLE base ADD COLUMN name text;\n') {
  const repo = mkdtempSync(resolve(tmpdir(), 'rel-v-')),
    out = mkdtempSync(resolve(tmpdir(), 'rel-b-'));
  roots.push(repo, out);
  git(repo, ['init', '-q']);
  git(repo, ['config', 'user.email', 'x@y']);
  git(repo, ['config', 'user.name', 'x']);
  write(
    repo,
    'package-lock.json',
    JSON.stringify({
      lockfileVersion: 3,
      packages: { 'node_modules/a': { name: 'a', version: '1.0.0' } },
    }) + '\n'
  );
  write(repo, 'server/migrations/001.sql', 'CREATE TABLE base(id text);\n');
  const previousVerifiedSha = commit(repo, 'previous');
  write(repo, 'server/migrations/002.sql', sql);
  const candidateSha = commit(repo, 'candidate');
  git(repo, ['branch', 'release-candidate', candidateSha]);
  const receipts = {};
  for (const name of ['backendBuild', 'frontendBuild', 'reporter82', 'typecheck']) {
    const p = resolve(out, `${name}.json`);
    writeFileSync(
      p,
      JSON.stringify({
        candidateSha,
        exitCode: 0,
        denominator: name === 'reporter82' ? 82 : undefined,
        missingEvidence: 0,
        invalidEvidence: 0,
      })
    );
    receipts[name] = p;
  }
  const manifest = generateReleaseCandidateBundle({
    repo,
    candidateSha,
    previousVerifiedSha,
    candidateRef: 'refs/heads/release-candidate',
    receiptFiles: receipts,
    outputDir: out,
  });
  return { repo, out, manifest, candidateSha, previousVerifiedSha, receipts };
}
test('valid bundle is technical ready but never GO', () => {
  const x = fx(),
    r = verifyReleaseCandidateBundle({ manifest: x.manifest, repo: x.repo, bundleDir: x.out });
  assert.equal(r.verified, true);
  assert.equal(r.technicalStatus, 'TECHNICAL_BUNDLE_READY');
  assert.equal(r.authorization, 'NOT_AUTHORIZED');
  assert.equal(r.releaseGo, false);
});
test('CLI output and exit code are deterministic', () => {
  const x = fx(),
    mp = resolve(x.out, 'release-candidate-manifest.json'),
    script = resolve('scripts/release/verify-release-candidate-bundle.mjs');
  const a = spawnSync(process.execPath, [script, '--repo', x.repo, '--manifest', mp], {
      encoding: 'utf8',
    }),
    b = spawnSync(process.execPath, [script, '--repo', x.repo, '--manifest', mp], {
      encoding: 'utf8',
    });
  assert.equal(a.status, 0);
  assert.equal(b.status, 0);
  assert.equal(a.stdout, b.stdout);
  assert.equal(JSON.parse(a.stdout).releaseGo, false);
});
test('fails closed for tamper, stale receipt, ref mismatch, dirty tree and GO', () => {
  for (const mode of ['tamper', 'stale', 'ref', 'dirty', 'go']) {
    const x = fx(),
      m = structuredClone(x.manifest);
    if (mode === 'tamper') writeFileSync(resolve(x.out, 'sbom.cdx.json'), '{}');
    if (mode === 'stale') {
      const e = m.receipts[0],
        b = JSON.parse(readFileSync(resolve(x.out, e.path)));
      b.candidateSha = '0'.repeat(40);
      writeFileSync(resolve(x.out, e.path), JSON.stringify(b));
      e.sha256 = hash(readFileSync(resolve(x.out, e.path)));
    }
    if (mode === 'ref') git(x.repo, ['branch', '-f', 'release-candidate', x.previousVerifiedSha]);
    if (mode === 'dirty') write(x.repo, 'dirty.txt', 'x');
    if (mode === 'go') m.authorization = 'GO';
    const r = verifyReleaseCandidateBundle({ manifest: m, repo: x.repo, bundleDir: x.out });
    assert.equal(r.verified, false, mode);
    assert.equal(r.releaseGo, false);
  }
});
test('rejects nonancestor and historical migration mutation/deletion', () => {
  for (const mode of ['nonancestor', 'mutation', 'deletion']) {
    const x = fx(),
      m = structuredClone(x.manifest);
    if (mode === 'nonancestor') {
      git(x.repo, ['checkout', '--orphan', 'other']);
      write(x.repo, 'other', 'x');
      const s = commit(x.repo, 'other');
      m.previousVerifiedSha = s;
    } else {
      git(x.repo, ['checkout', '-q', x.candidateSha]);
      if (mode === 'mutation') write(x.repo, 'server/migrations/001.sql', 'changed');
      else rmSync(resolve(x.repo, 'server/migrations/001.sql'));
      const s = commit(x.repo, mode);
      git(x.repo, ['branch', '-f', 'release-candidate', s]);
      m.candidateSha = s;
      m.treeSha = git(x.repo, ['rev-parse', `${s}^{tree}`]);
    }
    const r = verifyReleaseCandidateBundle({ manifest: m, repo: x.repo, bundleDir: x.out });
    assert.equal(r.verified, false, mode);
  }
});
test('rejects destructive SQL in every new migration class', () => {
  for (const sql of [
    'DROP TABLE base;',
    'TRUNCATE base;',
    'ALTER TABLE base DROP COLUMN id;',
    'ALTER TABLE base RENAME TO other;',
    'CREATE OR REPLACE VIEW v AS SELECT 1;',
  ]) {
    const x = fx(sql),
      r = verifyReleaseCandidateBundle({ manifest: x.manifest, repo: x.repo, bundleDir: x.out });
    assert.equal(r.verified, false, sql);
    assert.match(JSON.stringify(r.errors), /DESTRUCTIVE_/);
  }
});
