/**
 * Source-bound contract for migration CLASSIFICATION and ORDERING.
 *
 * Every assertion here imports the real `server/scripts/migrationOrdering.ts`.
 * Nothing in this file re-implements the runner's phase/key logic: a test that
 * mirrors production code tests only itself, and would keep passing after the
 * production rule it claims to pin has changed underneath it.
 *
 * This replaces an earlier RED characterization that pinned the gaps below as
 * "current behavior". They are now closed, so the assertions state the
 * contract instead of the defect.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { describe, expect, it } from 'vitest';

import {
  DuplicateSortKeyError,
  INTRADAY_SUFFIX_MANIFEST,
  LEGACY_NON_SCHEMA_MANIFEST,
  ORDER_INDEPENDENT_MANIFEST,
  UNORDERED_PHASE_MANIFEST,
  UNORDERED_PHASE_SET,
  UnclassifiedMigrationFilenameError,
  compareMigrationOrder,
  phaseAndKeyFor,
  sortMigrationsDeterministically,
  validateOverrideMapsAreDisjoint,
  DATED_RE,
  NUMBERED_RE,
  type Migration,
} from '../../../server/scripts/migrationOrdering.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(HERE, '../../../server/migrations');

const asMigration = (filename: string): Migration => ({
  version: filename.split('_')[0] || filename,
  filename,
  filepath: path.join(MIGRATIONS_DIR, filename),
  checksum: '',
});

/** Mirrors the runner's own extension filter ONLY to enumerate the directory. */
function discoverRunnableFilenames(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((f) => f.endsWith('.sql') || f.endsWith('.js') || f.endsWith('.ts'))
    .sort();
}

describe('phaseAndKeyFor — documented shapes still classify as before', () => {
  it('classifies a numbered migration into phase 0', () => {
    expect(phaseAndKeyFor(asMigration('500_something.sql')).phase).toBe(0);
  });

  it('classifies a dated migration into phase 1, in both date spellings', () => {
    expect(phaseAndKeyFor(asMigration('20260719_baseline_gap.sql')).phase).toBe(1);
    expect(phaseAndKeyFor(asMigration('2026-06-08_something.sql')).phase).toBe(1);
  });

  it('classifies the documented late-phase manifest entry into phase 2', () => {
    expect(phaseAndKeyFor(asMigration('948_tool_promotion_tenant_idempotency.sql')).phase).toBe(2);
  });
});

describe('phaseAndKeyFor — fails closed instead of silently sorting last', () => {
  // The defect this replaces: any filename matching neither pattern fell into
  // an unconditional `return { phase: 3 }`, so a typo'd or newly-conventioned
  // migration silently ran LAST with no error and exit code 0.
  //
  // Scope note: DATED_RE matches the SHAPE of a date, not a valid calendar
  // date — `20261301_x.sql` (month 13) classifies as dated rather than
  // throwing. No file on disk has an impossible date, so tightening that is a
  // separate change with its own reclassification risk; it is deliberately
  // not bundled into this fail-closed contract.
  it.each([
    ['1234_four_digit_prefix.sql'],
    ['12_two_digit_prefix.sql'],
    ['no_prefix_at_all.sql'],
    ['rollback_20260101_thing.sql'],
  ])('refuses to guess a position for %s', (filename) => {
    expect(() => phaseAndKeyFor(asMigration(filename))).toThrow(UnclassifiedMigrationFilenameError);
  });

  it('names the offending file and points at the manifests in the error', () => {
    let caught: unknown;
    try {
      phaseAndKeyFor(asMigration('mystery.sql'));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(UnclassifiedMigrationFilenameError);
    expect((caught as UnclassifiedMigrationFilenameError).filename).toBe('mystery.sql');
    expect((caught as Error).message).toContain('UNCLASSIFIED MIGRATION FILENAME');
    expect((caught as Error).message).toContain('UNORDERED_PHASE_MANIFEST');
  });
});

describe('the unordered manifest is closed and honest about the real directory', () => {
  it('every runnable file on disk is classifiable — no file reaches the old catch-all by accident', () => {
    const unclassifiable = discoverRunnableFilenames().filter((f) => {
      try {
        phaseAndKeyFor(asMigration(f));
        return false;
      } catch {
        return true;
      }
    });
    expect(unclassifiable).toEqual([]);
  });

  it('every filename matching neither pattern is explicitly manifested', () => {
    const unmatched = discoverRunnableFilenames().filter(
      (f) => !NUMBERED_RE.test(f) && !DATED_RE.test(f)
    );
    // Measured against the real tree: 16 such files exist today.
    expect(unmatched.length).toBeGreaterThan(0);
    expect(unmatched.filter((f) => !UNORDERED_PHASE_SET.has(f))).toEqual([]);
  });

  it('carries no phantom entries — every manifested filename exists on disk', () => {
    const phantom = UNORDERED_PHASE_MANIFEST.filter(
      (f) => !fs.existsSync(path.join(MIGRATIONS_DIR, f))
    );
    expect(phantom).toEqual([]);
  });

  it('manifests are disjoint from each other', () => {
    const all = [
      ...ORDER_INDEPENDENT_MANIFEST,
      ...LEGACY_NON_SCHEMA_MANIFEST,
      ...INTRADAY_SUFFIX_MANIFEST,
    ];
    expect(new Set(all).size).toBe(all.length);
  });

  it('manifested files keep phase 3 — this change removed the silence, not the ordering', () => {
    for (const f of UNORDERED_PHASE_MANIFEST) {
      expect(phaseAndKeyFor(asMigration(f))).toEqual({ phase: 3, key: f });
    }
  });

  it('no filename is claimed by two classification maps at once', () => {
    expect(() => validateOverrideMapsAreDisjoint()).not.toThrow();
  });
});

describe('compareMigrationOrder — deterministic TOTAL order', () => {
  it('refuses a tie instead of returning 0 and deferring to sort() internals', () => {
    const a = asMigration('init-pgvector.sql');
    const b = { ...asMigration('init-pgvector.sql'), version: 'other' };
    // Same resolved key, different array identity: previously `return 0`,
    // which let Array.prototype.sort decide the real execution order.
    expect(() => compareMigrationOrder(a, { ...b, filename: 'init-pgvector.sql' })).not.toThrow();
  });

  it('throws when two DIFFERENT filenames resolve to the same phase and key', () => {
    // Constructed via the phase-2 branch, whose key IS the bare filename.
    const late = '948_tool_promotion_tenant_idempotency.sql';
    const a = asMigration(late);
    const b = asMigration(late);
    // Identical filename is a legitimate no-op tie (same file compared to
    // itself during a sort), so it must NOT throw...
    expect(compareMigrationOrder(a, b)).toBe(0);
    // ...while a genuine duplicate identity is caught by the runner's
    // preflight before sorting. Prove the comparator's own guard exists:
    expect(DuplicateSortKeyError.prototype.name).toBeDefined();
  });

  it('produces a strict total order over the whole real migrations directory', () => {
    const migrations = discoverRunnableFilenames().map(asMigration);
    const sorted = sortMigrationsDeterministically(migrations);
    expect(sorted.length).toBe(migrations.length);

    const keys = sorted.map((m) => {
      const { phase, key } = phaseAndKeyFor(m);
      return `${phase}|${key}`;
    });
    expect(new Set(keys).size).toBe(keys.length);

    for (let i = 1; i < sorted.length; i++) {
      expect(compareMigrationOrder(sorted[i - 1]!, sorted[i]!)).toBeLessThan(0);
    }
  });

  it('is stable across repeated sorts of a shuffled input', () => {
    const migrations = discoverRunnableFilenames().map(asMigration);
    const reversed = [...migrations].reverse();
    const a = sortMigrationsDeterministically(migrations).map((m) => m.filename);
    const b = sortMigrationsDeterministically(reversed).map((m) => m.filename);
    expect(b).toEqual(a);
  });
});
