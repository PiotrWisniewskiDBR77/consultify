import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import {
  cyclonedxFromLockfile,
  generateReleaseCandidateBundle,
} from '../../../scripts/release/generate-release-candidate-bundle.mjs';
const git = (r, a) => execFileSync('git', ['-C', r, ...a], { encoding: 'utf8' }).trim(),
  write = (r, p, b) => {
    const t = resolve(r, p);
    mkdirSync(dirname(t), { recursive: true });
    writeFileSync(t, b);
  },
  commit = (r, m) => {
    git(r, ['add', '.']);
    git(r, ['commit', '-m', m]);
    return git(r, ['rev-parse', 'HEAD']);
  };
function setup() {
  const repo = mkdtempSync(resolve(tmpdir(), 'rel-g-')),
    out = mkdtempSync(resolve(tmpdir(), 'rel-o-'));
  git(repo, ['init', '-q']);
  git(repo, ['config', 'user.email', 'x@y']);
  git(repo, ['config', 'user.name', 'x']);
  write(
    repo,
    'package-lock.json',
    JSON.stringify({
      lockfileVersion: 3,
      packages: {
        'node_modules/z': { name: 'z', version: '2' },
        'node_modules/a': { name: 'a', version: '1' },
      },
    }) + '\n'
  );
  write(repo, 'server/migrations/001.sql', 'CREATE TABLE a(id text);');
  const previous = commit(repo, 'p');
  write(repo, 'server/migrations/002.sql', 'ALTER TABLE a ADD COLUMN b text;');
  const candidate = commit(repo, 'c');
  const treeSha = git(repo, ['rev-parse', `${candidate}^{tree}`]);
  git(repo, ['branch', 'candidate', candidate]);
  const receipts = {};
  for (const n of ['backendBuild', 'frontendBuild', 'reporter82', 'typecheck']) {
    const p = resolve(out, `${n}.json`);
    writeFileSync(
      p,
      JSON.stringify({
        gateId: n,
        command: `npm run ${n}`,
        candidateSha: candidate,
        treeSha,
        exitCode: 0,
        denominator: n === 'reporter82' ? 82 : { tests: 1 },
        missingEvidence: 0,
        invalidEvidence: 0,
        startedAt: '2026-08-17T10:00:00.000Z',
        finishedAt: '2026-08-17T10:01:00.000Z',
        logDigest: '1'.repeat(64),
        artifactDigest: '2'.repeat(64),
        provenanceType: 'local-process',
      })
    );
    receipts[n] = p;
  }
  return {
    repo,
    out,
    previous,
    candidate,
    receipts,
    cleanup: () => {
      rmSync(repo, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    },
  };
}
test('CycloneDX covers canonical-like unnamed, scoped, nested and workspace entries deterministically', () => {
  const b = Buffer.from(
    JSON.stringify({
      packages: {
        'node_modules/z': { version: '2' },
        'node_modules/@scope/a': { version: '1' },
        'node_modules/z/node_modules/a': { version: '1' },
        'apps/web': { name: '@consultify/web', version: '3' },
      },
    })
  );
  const one = cyclonedxFromLockfile(b, 'a'.repeat(40)),
    two = cyclonedxFromLockfile(b, 'a'.repeat(40));
  assert.equal(one, two);
  const parsed = JSON.parse(one);
  assert.equal(parsed.components.length, 4);
  assert.equal(new Set(parsed.components.map((x) => x['bom-ref'])).size, 4);
  assert.equal(new Set(parsed.components.map((x) => x.purl)).size, 4);
  assert.deepEqual(
    new Set(parsed.components.map((x) => x.name)),
    new Set(['z', '@scope/a', 'a', '@consultify/web'])
  );
  assert.equal(
    parsed.metadata.properties.find((x) => x.name === 'consultify:componentCount').value,
    '4'
  );
});
test('CycloneDX denominator equals every versioned non-root entry in the canonical lockfile', () => {
  const lockBytes = readFileSync(resolve('package-lock.json'));
  const lock = JSON.parse(lockBytes);
  const expected = Object.entries(lock.packages ?? {}).filter(
    ([path, pkg]) => path && pkg?.version
  ).length;
  const first = cyclonedxFromLockfile(lockBytes, 'b'.repeat(40));
  const second = cyclonedxFromLockfile(lockBytes, 'b'.repeat(40));
  assert.equal(first, second);
  const parsed = JSON.parse(first);
  assert.equal(parsed.components.length, expected);
  assert.equal(new Set(parsed.components.map((component) => component['bom-ref'])).size, expected);
  assert.equal(new Set(parsed.components.map((component) => component.purl)).size, expected);
  assert.equal(
    Number(
      parsed.metadata.properties.find((item) => item.name === 'consultify:componentCount').value
    ),
    expected
  );
});
test('generator emits deterministic NOT_AUTHORIZED manifest and receipts', () => {
  const x = setup();
  try {
    const a = generateReleaseCandidateBundle({
      repo: x.repo,
      candidateSha: x.candidate,
      previousVerifiedSha: x.previous,
      candidateRef: 'refs/heads/candidate',
      receiptFiles: x.receipts,
      outputDir: x.out,
    });
    const first = readFileSync(resolve(x.out, 'release-candidate-manifest.json'), 'utf8');
    const b = generateReleaseCandidateBundle({
      repo: x.repo,
      candidateSha: x.candidate,
      previousVerifiedSha: x.previous,
      candidateRef: 'refs/heads/candidate',
      receiptFiles: x.receipts,
      outputDir: x.out,
    });
    assert.equal(first, readFileSync(resolve(x.out, 'release-candidate-manifest.json'), 'utf8'));
    assert.equal(a.manifestSha256, b.manifestSha256);
    assert.equal(a.authorization, 'NOT_AUTHORIZED');
    assert.equal(a.technicalStatus, 'UNATTESTED_LOCAL_RECEIPTS');
  } finally {
    x.cleanup();
  }
});
test('generator rejects missing, stale and failed receipts plus dirty/ref mismatch', () => {
  for (const mode of ['missing', 'stale', 'failed', 'dirty', 'ref']) {
    const x = setup();
    try {
      if (mode === 'missing') delete x.receipts.typecheck;
      if (mode === 'stale' || mode === 'failed')
        writeFileSync(
          x.receipts.typecheck,
          JSON.stringify({
            gateId: 'typecheck',
            command: 'npm run type-check',
            candidateSha: mode === 'stale' ? '0'.repeat(40) : x.candidate,
            treeSha: git(x.repo, ['rev-parse', `${x.candidate}^{tree}`]),
            exitCode: mode === 'failed' ? 1 : 0,
            denominator: { files: 1 },
            startedAt: '2026-08-17T10:00:00.000Z',
            finishedAt: '2026-08-17T10:01:00.000Z',
            logDigest: '1'.repeat(64),
            artifactDigest: '2'.repeat(64),
            provenanceType: 'local-process',
          })
        );
      if (mode === 'dirty') write(x.repo, 'dirty', 'x');
      if (mode === 'ref') git(x.repo, ['branch', '-f', 'candidate', x.previous]);
      assert.throws(() =>
        generateReleaseCandidateBundle({
          repo: x.repo,
          candidateSha: x.candidate,
          previousVerifiedSha: x.previous,
          candidateRef: 'refs/heads/candidate',
          receiptFiles: x.receipts,
          outputDir: x.out,
        })
      );
    } finally {
      x.cleanup();
    }
  }
});
