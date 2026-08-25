import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import { findMissingCitedPaths } from '../verify-acceptance-packages.mjs';

const root = resolve(import.meta.dirname, '../../..');

// FALA 1 hygiene fix (2026-08-25, tools-uwagi-komplet.md §6.7): the verifier
// previously checked ONLY document structure (headers, gate rows, the MASTER
// row) — never whether a path a register cites actually exists. This let a
// false "file not found" claim stand: CHAT_TO_TOOLS_BACKLOG_BELOW_9 asserted
// `SWOT-003-finalny-model-pracy-dynamic-swot.md` (1020 lines) "is not present
// in this worktree", when the file exists at exactly the path the Tools
// register cited (commit 4a36e8a745) — and zeroed 21 owner recommendations
// on that false premise. A mechanical existence check on the cited path
// catches this in one line, no re-audit needed.

test('a repo-root-relative citation to a file that exists is not flagged', () => {
  const text = 'Wired at `docs/SOURCE_OF_TRUTH.md` — see the map.';
  const offenders = findMissingCitedPaths(text, { rootDir: root, baseDir: root });
  assert.deepEqual(offenders, []);
});

test('a repo-root-relative citation to a file that does NOT exist is flagged', () => {
  const text = 'Claimed present at `docs/this-file-does-not-exist-fala1-fixture.md`.';
  const offenders = findMissingCitedPaths(text, { rootDir: root, baseDir: root });
  assert.deepEqual(offenders, [
    {
      citation: 'docs/this-file-does-not-exist-fala1-fixture.md',
      resolvedPath: join(root, 'docs/this-file-does-not-exist-fala1-fixture.md'),
    },
  ]);
});

test('a `:line` citation suffix is stripped before checking existence', () => {
  const text = 'See `docs/SOURCE_OF_TRUTH.md:1` for the entry point.';
  const offenders = findMissingCitedPaths(text, { rootDir: root, baseDir: root });
  assert.deepEqual(offenders, []);
});

test('a `:line-line` (hyphen) and `:line–line` (en-dash) range suffix is stripped', () => {
  const text = [
    'Block A: `docs/SOURCE_OF_TRUTH.md:1-5`.',
    'Block B: `docs/SOURCE_OF_TRUTH.md:1–5`.',
  ].join('\n');
  const offenders = findMissingCitedPaths(text, { rootDir: root, baseDir: root });
  assert.deepEqual(offenders, []);
});

test('a comma-separated multi-line citation suffix is stripped (real shape from 07_MY_WORK_AGENT)', () => {
  const text = 'Seeded by `docs/SOURCE_OF_TRUTH.md:195,219,223,227`.';
  const offenders = findMissingCitedPaths(text, { rootDir: root, baseDir: root });
  assert.deepEqual(offenders, []);
});

test('a comma-separated suffix pointing at a genuinely missing file is still flagged (with the raw citation text)', () => {
  const text = 'Seeded by `docs/this-file-does-not-exist-fala1-fixture.md:1,2,3`.';
  const offenders = findMissingCitedPaths(text, { rootDir: root, baseDir: root });
  assert.deepEqual(offenders, [
    {
      citation: 'docs/this-file-does-not-exist-fala1-fixture.md:1,2,3',
      resolvedPath: join(root, 'docs/this-file-does-not-exist-fala1-fixture.md'),
    },
  ]);
});

test('a `../`-relative citation is resolved against baseDir, not rootDir', () => {
  const tmpBase = mkdtempSync(join(tmpdir(), 'wave3-cited-paths-'));
  try {
    const modulesDir = join(tmpBase, 'modules', 'FIXTURE');
    mkdirSync(modulesDir, { recursive: true });
    const siblingFile = join(tmpBase, 'sibling.md');
    writeFileSync(siblingFile, '# sibling fixture\n');

    const text = 'Cross-ref: `../../sibling.md`.';
    const offenders = findMissingCitedPaths(text, { rootDir: root, baseDir: modulesDir });
    assert.deepEqual(offenders, []);
  } finally {
    rmSync(tmpBase, { recursive: true, force: true });
  }
});

test('a `../`-relative citation to a missing sibling is flagged', () => {
  const text = 'Cross-ref: `../../missing-sibling-fala1-fixture.md`.';
  const offenders = findMissingCitedPaths(text, {
    rootDir: root,
    baseDir: join(root, 'docs/program/waves/WAVE_03_ACCEPTANCE/modules/03_TOOLS'),
  });
  assert.equal(offenders.length, 1);
  assert.equal(offenders[0].citation, '../../missing-sibling-fala1-fixture.md');
});

test('a directory citation (trailing slash) is checked with the same rule as a file', () => {
  const existingDirText = 'See `docs/program/waves/WAVE_03_ACCEPTANCE/modules/`.';
  assert.deepEqual(
    findMissingCitedPaths(existingDirText, { rootDir: root, baseDir: root }),
    []
  );

  const missingDirText = 'See `docs/this-directory-does-not-exist-fala1-fixture/`.';
  const offenders = findMissingCitedPaths(missingDirText, { rootDir: root, baseDir: root });
  assert.equal(offenders.length, 1);
});

test('a bare filename with no directory component is NOT flagged (ambiguous, out of scope)', () => {
  const text = 'Fix at `SWOTBuildPhase.tsx:516`.';
  const offenders = findMissingCitedPaths(text, { rootDir: root, baseDir: root });
  assert.deepEqual(offenders, []);
});

test('a non-path backtick token (finding ID, ratio) is not flagged', () => {
  const text = 'See `TLS-XPR-005` — coverage `138/143`.';
  const offenders = findMissingCitedPaths(text, { rootDir: root, baseDir: root });
  assert.deepEqual(offenders, []);
});

test('an explicit "cited path not found" annotation is not flagged, even though it wraps a repo-root-style path (FALA 1 hygiene fix, 02_INTERVIEW)', () => {
  // 02_INTERVIEW/MODULE_ACCEPTANCE.md documents that no Interview-specific
  // table descriptor exists yet under docs/ui-standards/03-modules/table-descriptors/
  // — genuinely future work, not a stale citation (confirmed against the
  // preserved branch 7c3b559ca8 too: the directory never existed). Per the
  // FALA 1 remediation playbook, an unresolvable citation with no real target
  // anywhere is rewritten as this explicit annotation instead of being
  // silently dropped or invented. The annotation itself must never trip
  // findMissingCitedPaths again, even though the old path text still appears
  // inside it — the bracket prefix keeps it from matching CITED_PATH_PATTERN.
  const text =
    'No Interview-specific descriptor exists yet under ' +
    '`[CYTOWANY PLIK NIEODNALEZIONY — docs/ui-standards/03-modules/table-descriptors/ — do wyjaśnienia przy odbiorze modułu]`; ' +
    'creating the six object-specific mappings is part of the required closure artifact.';
  const offenders = findMissingCitedPaths(text, { rootDir: root, baseDir: root });
  assert.deepEqual(offenders, []);
});

test('the same citation appearing twice is only reported once', () => {
  const text = [
    'First: `docs/this-file-does-not-exist-fala1-fixture.md`.',
    'Again: `docs/this-file-does-not-exist-fala1-fixture.md`.',
  ].join('\n');
  const offenders = findMissingCitedPaths(text, { rootDir: root, baseDir: root });
  assert.equal(offenders.length, 1);
});

test('the real 03_TOOLS register carries zero missing cited paths', async () => {
  const { readFileSync } = await import('node:fs');
  const packagePath = resolve(
    root,
    'docs/program/waves/WAVE_03_ACCEPTANCE/modules/03_TOOLS/MODULE_ACCEPTANCE.md'
  );
  const text = readFileSync(packagePath, 'utf8');
  const offenders = findMissingCitedPaths(text, { rootDir: root, baseDir: resolve(packagePath, '..') });
  assert.deepEqual(
    offenders,
    [],
    'MODULE_ACCEPTANCE.md for Tools must only cite paths that actually exist'
  );
});
