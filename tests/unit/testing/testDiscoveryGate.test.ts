/**
 * STREAM 6 (2026-08-13) — permanent regression coverage for the test
 * discovery gate (scripts/testing/test-discovery-gate.ts).
 *
 * Part 1 (synthetic): exercises both failure modes with in-memory fixtures
 * — no filesystem/git side effects, so this is safe to run on every CI
 * invocation without ever mutating the real repo tree.
 *
 * Part 2 (real repo): runs the gate against the actual live manifest +
 * actual vitest-collected sets, proving the current tree is clean. This is
 * the same check `npm run test:discovery-gate` runs standalone; keeping it
 * here too means a regression is caught by the normal unit-test run, not
 * only by someone remembering to invoke the CLI separately.
 *
 * The one-time MANUAL proof that the gate can genuinely fail against the
 * real tree (add a throwaway unclassified file, watch it get named, delete
 * it) was performed during the 2026-08-13 sprint — see
 * docs/program/METHOD_TOOLS_2026-08-13/TEST_INVENTORY.md, "Negative control"
 * section, for the transcript. That workflow is not re-run automatically
 * here (it would require staging/unstaging real files mid-test-run), but
 * this file's synthetic part exercises the identical code path.
 */
import { describe, expect, it } from 'vitest';

import {
  computeRealExecutedSet,
  discoverRealFiles,
  loadRealManifest,
  runDiscoveryGate,
  type Manifest,
} from '../../../scripts/testing/test-discovery-gate';

describe('test discovery gate — synthetic fixtures', () => {
  it('passes when every discovered file is classified and every ACTIVE file is executed', () => {
    const manifest: Manifest = {
      entries: [
        { path: 'tests/unit/a.test.ts', classification: 'ACTIVE', reason: 'x' },
        { path: 'tests/e2e/b.spec.ts', classification: 'PLAYWRIGHT', reason: 'x' },
        { path: 'tests/unit/c.test.ts', classification: 'INTENTIONALLY_EXCLUDED', reason: 'x' },
      ],
    };
    const result = runDiscoveryGate({
      discovered: ['tests/unit/a.test.ts', 'tests/e2e/b.spec.ts', 'tests/unit/c.test.ts'],
      manifest,
      executed: new Set(['tests/unit/a.test.ts']),
    });
    expect(result.ok).toBe(true);
    expect(result.unclassified).toEqual([]);
    expect(result.activeButNotExecuted).toEqual([]);
  });

  it('FAILS and names the file when a discovered file has no manifest entry (UNCLASSIFIED)', () => {
    const manifest: Manifest = {
      entries: [{ path: 'tests/unit/a.test.ts', classification: 'ACTIVE', reason: 'x' }],
    };
    const result = runDiscoveryGate({
      discovered: ['tests/unit/a.test.ts', 'tests/unit/sneaky-new-file.test.ts'],
      manifest,
      executed: new Set(['tests/unit/a.test.ts', 'tests/unit/sneaky-new-file.test.ts']),
    });
    expect(result.ok).toBe(false);
    expect(result.unclassified).toEqual(['tests/unit/sneaky-new-file.test.ts']);
  });

  it('FAILS and names the file when an ACTIVE file is not actually executed by any runner (ACTIVE_BUT_NOT_EXECUTED)', () => {
    const manifest: Manifest = {
      entries: [
        { path: 'tests/unit/a.test.ts', classification: 'ACTIVE', reason: 'x' },
        { path: 'tests/orphaned-root-file.test.ts', classification: 'ACTIVE', reason: 'wrongly claimed active' },
      ],
    };
    const result = runDiscoveryGate({
      discovered: ['tests/unit/a.test.ts', 'tests/orphaned-root-file.test.ts'],
      manifest,
      // Note: the second file is discovered + classified ACTIVE, but absent
      // from the executed set — exactly the "invisible by accident" bug
      // this gate exists to catch.
      executed: new Set(['tests/unit/a.test.ts']),
    });
    expect(result.ok).toBe(false);
    expect(result.activeButNotExecuted).toEqual(['tests/orphaned-root-file.test.ts']);
    expect(result.unclassified).toEqual([]);
  });

  it('does NOT require PLAYWRIGHT/LEGACY/INTENTIONALLY_EXCLUDED/BROKEN_ORPHAN files to be in the executed set', () => {
    const manifest: Manifest = {
      entries: [
        { path: 'tests/e2e/x.spec.ts', classification: 'PLAYWRIGHT', reason: 'x' },
        { path: 'server/tests/legacy-script.test.ts', classification: 'LEGACY', reason: 'x' },
        { path: 'tests/unit/dup.test.ts', classification: 'INTENTIONALLY_EXCLUDED', reason: 'x' },
        { path: 'tests/e2e/orphan.spec.ts', classification: 'BROKEN_ORPHAN', reason: 'x' },
      ],
    };
    const result = runDiscoveryGate({
      discovered: manifest.entries.map((e) => e.path),
      manifest,
      executed: new Set(), // nothing executed — should still pass, none are ACTIVE
    });
    expect(result.ok).toBe(true);
  });
});

describe('test discovery gate — real repository', () => {
  it(
    'the current tree is fully classified and every ACTIVE file is executed',
    () => {
      const discovered = discoverRealFiles();
      const manifest = loadRealManifest();
      const executed = computeRealExecutedSet();

      const result = runDiscoveryGate({ discovered, manifest, executed });

      if (!result.ok) {
        throw new Error(
          `Discovery gate FAILED.\n` +
            `Unclassified (${result.unclassified.length}): ${result.unclassified.join(', ')}\n` +
            `Active but not executed (${result.activeButNotExecuted.length}): ${result.activeButNotExecuted.join(', ')}\n` +
            `Run: npx tsx scripts/testing/generate-test-inventory.ts to refresh the manifest, ` +
            `or npx tsx scripts/testing/test-discovery-gate.ts for full diagnostics.`
        );
      }
      expect(result.ok).toBe(true);
    },
    60_000
  );
});
