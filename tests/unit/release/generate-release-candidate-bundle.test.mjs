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
  git(repo, ['branch', 'candidate', candidate]);
  const receipts = {};
  for (const n of ['backendBuild', 'frontendBuild', 'reporter82', 'typecheck']) {
    const p = resolve(out, `${n}.json`);
    writeFileSync(
      p,
      JSON.stringify({
        candidateSha: candidate,
        exitCode: 0,
        denominator: n === 'reporter82' ? 82 : undefined,
        missingEvidence: 0,
        invalidEvidence: 0,
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
test('CycloneDX is deterministic and sorted', () => {
  const b = Buffer.from(
    JSON.stringify({
      packages: {
        'node_modules/z': { name: 'z', version: '2' },
        'node_modules/a': { name: 'a', version: '1' },
      },
    })
  );
  const one = cyclonedxFromLockfile(b, 'a'.repeat(40)),
    two = cyclonedxFromLockfile(b, 'a'.repeat(40));
  assert.equal(one, two);
  assert.deepEqual(
    JSON.parse(one).components.map((x) => x.name),
    ['a', 'z']
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
            candidateSha: mode === 'stale' ? '0'.repeat(40) : x.candidate,
            exitCode: mode === 'failed' ? 1 : 0,
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
