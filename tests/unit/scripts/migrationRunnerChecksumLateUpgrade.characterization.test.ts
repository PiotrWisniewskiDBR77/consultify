/**
 * Source-bound contract for the runner's LEDGER TRUST and CHECKSUM rules.
 *
 * The characterization this replaces could not import `migrate.postgres.ts`
 * (its `main()` ran at module scope and opened a real pool), so it hand-copied
 * `calculateChecksum`, `getApplied` and the pending filter into the test and
 * asserted against the copy. That copy could only ever test itself: once the
 * runner gained real drift detection, the mirrored assertions would have gone
 * on passing while proving nothing about the shipped code.
 *
 * The runner now exports its trust surface and only runs `main()` when it is
 * the process entrypoint, so every assertion below binds to the real symbols.
 */
import crypto from 'crypto';

import { describe, expect, it } from 'vitest';

import {
  BENIGN_ALREADY_APPLIED_PG_CODES,
  CHECKSUM_HEX_RE,
  DuplicateMigrationIdentityError,
  HistoricalMutationError,
  KNOWN_EXCLUDED_MIGRATIONS_SUBDIRS,
  KNOWN_LEDGER_STATUSES,
  MalformedLedgerEntryError,
  SKIPPED_CHECKSUM_RE,
  assertLedgerRowIsTrusted,
  assertNoDuplicateMigrationIdentity,
  isBenignAlreadyAppliedError,
  UnsupportedMigrationDatabaseCallError,
  createTransactionalMigrationDatabase,
  declaresEmptyParameterList,
  isDirectCliInvocation,
  runPreflightChecks,
  type AppliedMigrationRow,
  type Migration,
} from '../../../server/scripts/migrate.postgres.js';

import {
  APPROVED_SQL_CHAIN_VARIANTS,
  SCHEMA_ATTESTED_FILENAME,
  SCHEMA_ATTESTED_PAIR,
} from '../../../server/src/services/releaseGate/sqlChainChecksumPolicy.js';

const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

const migration = (filename: string, checksum: string): Migration => ({
  version: filename.split('_')[0] || filename,
  filename,
  filepath: `/nonexistent/${filename}`,
  checksum,
});

const row = (
  filename: string,
  status: string,
  checksum: string | null
): AppliedMigrationRow => ({ filename, status, checksum });

describe('importing the runner does not run it', () => {
  it('exposes its trust surface without opening a database connection', () => {
    // If `main()` still ran at module scope, this module would never have
    // loaded: it would have thrown `DATABASE_URL is required` and exited.
    expect(typeof runPreflightChecks).toBe('function');
    expect(isDirectCliInvocation()).toBe(false);
  });
});

describe('a checksum is TRUSTED only in the shape this runner writes', () => {
  it('accepts a well-formed success row', () => {
    expect(() => assertLedgerRowIsTrusted(row('a.sql', 'success', sha('a')))).not.toThrow();
  });

  it('accepts the skipped:<sha256> form written under --safe', () => {
    expect(() =>
      assertLedgerRowIsTrusted(row('a.sql', 'skipped', `skipped:${sha('a')}`))
    ).not.toThrow();
  });

  it.each([
    ['a NULL checksum', null],
    ['an empty checksum', ''],
    ['a non-hex checksum', 'not-a-checksum'],
    ['uppercase hex', sha('a').toUpperCase()],
    ['a truncated 16-char digest', sha('a').slice(0, 16)],
    ['a skipped:-prefixed value on a success row', `skipped:${sha('a')}`],
  ])('rejects %s on a success row', (_label, checksum) => {
    expect(() => assertLedgerRowIsTrusted(row('a.sql', 'success', checksum))).toThrow(
      MalformedLedgerEntryError
    );
  });

  it('rejects a status this runner never writes (out-of-band row)', () => {
    expect(() => assertLedgerRowIsTrusted(row('a.sql', 'applied', sha('a')))).toThrow(
      MalformedLedgerEntryError
    );
  });

  it('rejects a skipped row whose checksum is a bare digest rather than skipped:<sha>', () => {
    expect(() => assertLedgerRowIsTrusted(row('a.sql', 'skipped', sha('a')))).toThrow(
      MalformedLedgerEntryError
    );
  });

  it('publishes the exact shapes it enforces', () => {
    expect(CHECKSUM_HEX_RE.test(sha('x'))).toBe(true);
    expect(CHECKSUM_HEX_RE.test(sha('x').toUpperCase())).toBe(false);
    expect(SKIPPED_CHECKSUM_RE.test(`skipped:${sha('x')}`)).toBe(true);
    expect([...KNOWN_LEDGER_STATUSES].sort()).toEqual(['failed', 'skipped', 'success']);
  });
});

describe('preflight fails BEFORE any mutation', () => {
  it('detects a migration whose bytes changed after it was applied', () => {
    const applied = new Map<string, AppliedMigrationRow>([
      ['500_x.sql', row('500_x.sql', 'success', sha('ORIGINAL'))],
    ]);
    expect(() => runPreflightChecks([migration('500_x.sql', sha('EDITED'))], applied)).toThrow(
      HistoricalMutationError
    );
  });

  it('reports both digests so the drift is diagnosable', () => {
    const applied = new Map<string, AppliedMigrationRow>([
      ['500_x.sql', row('500_x.sql', 'success', sha('ORIGINAL'))],
    ]);
    let caught: unknown;
    try {
      runPreflightChecks([migration('500_x.sql', sha('EDITED'))], applied);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(HistoricalMutationError);
    expect((caught as HistoricalMutationError).storedChecksum).toBe(sha('ORIGINAL'));
    expect((caught as HistoricalMutationError).currentChecksum).toBe(sha('EDITED'));
  });

  it('accepts an unchanged already-applied migration', () => {
    const applied = new Map<string, AppliedMigrationRow>([
      ['500_x.sql', row('500_x.sql', 'success', sha('SAME'))],
    ]);
    expect(() => runPreflightChecks([migration('500_x.sql', sha('SAME'))], applied)).not.toThrow();
  });

  it('rejects an out-of-band success row rather than skipping the migration on its word', () => {
    const applied = new Map<string, AppliedMigrationRow>([
      ['500_x.sql', row('500_x.sql', 'success', null)],
    ]);
    expect(() => runPreflightChecks([migration('500_x.sql', sha('SAME'))], applied)).toThrow(
      MalformedLedgerEntryError
    );
  });

  it('does not police ledger rows for migrations outside this run (--dir/--only stay usable)', () => {
    const applied = new Map<string, AppliedMigrationRow>([
      ['999_unrelated.sql', row('999_unrelated.sql', 'bogus-status', null)],
    ]);
    expect(() => runPreflightChecks([migration('500_x.sql', sha('SAME'))], applied)).not.toThrow();
  });

  it('rejects duplicate migration identity', () => {
    expect(() =>
      assertNoDuplicateMigrationIdentity([
        migration('500_x.sql', sha('a')),
        migration('500_x.sql', sha('b')),
      ])
    ).toThrow(DuplicateMigrationIdentityError);
  });

  it('a first-time migration with no ledger row passes preflight (late apply is not blocked)', () => {
    // A newly introduced file whose name sorts EARLIER than already-applied
    // ones has no ledger row, so preflight must not object to it.
    const applied = new Map<string, AppliedMigrationRow>([
      ['900_already.sql', row('900_already.sql', 'success', sha('done'))],
    ]);
    expect(() =>
      runPreflightChecks(
        [migration('100_new_but_earlier.sql', sha('new')), migration('900_already.sql', sha('done'))],
        applied
      )
    ).not.toThrow();
  });
});

describe('drift detection defers to the release gate\'s own checksum policy', () => {
  // `release-migration-gate.ts` is the Railway preDeployCommand and spawns this
  // runner directly against demo/prod. Those environments carry 32 documented
  // (stored, current) checksum pairs that a forensic pass deliberately
  // approved. A bare `stored !== current` check here would refuse to migrate
  // them — blocking deploys for drift the governing gate already accepts.
  const [approvedFilename, approvedPair] = Object.entries(APPROVED_SQL_CHAIN_VARIANTS)[0]!;

  it('accepts an APPROVED historical variant instead of calling it mutation', () => {
    const applied = new Map<string, AppliedMigrationRow>([
      [approvedFilename, row(approvedFilename, 'success', approvedPair.stored)],
    ]);
    expect(() =>
      runPreflightChecks([migration(approvedFilename, approvedPair.current)], applied)
    ).not.toThrow();
  });

  it('accepts the schema-attested legacy pair', () => {
    const applied = new Map<string, AppliedMigrationRow>([
      [
        SCHEMA_ATTESTED_FILENAME,
        row(SCHEMA_ATTESTED_FILENAME, 'success', SCHEMA_ATTESTED_PAIR.stored),
      ],
    ]);
    expect(() =>
      runPreflightChecks(
        [migration(SCHEMA_ATTESTED_FILENAME, SCHEMA_ATTESTED_PAIR.current)],
        applied
      )
    ).not.toThrow();
  });

  it('still refuses drift that is NOT in the approved set', () => {
    const applied = new Map<string, AppliedMigrationRow>([
      [approvedFilename, row(approvedFilename, 'success', sha('some other bytes entirely'))],
    ]);
    expect(() =>
      runPreflightChecks([migration(approvedFilename, approvedPair.current)], applied)
    ).toThrow(HistoricalMutationError);
  });

  it('refuses an approved STORED checksum paired with the wrong CURRENT bytes', () => {
    // Both halves of the approved pair must match; a half-match is drift.
    const applied = new Map<string, AppliedMigrationRow>([
      [approvedFilename, row(approvedFilename, 'success', approvedPair.stored)],
    ]);
    expect(() =>
      runPreflightChecks([migration(approvedFilename, sha('tree has moved on'))], applied)
    ).toThrow(HistoricalMutationError);
  });
});

describe('--safe tolerates already-applied errors ONLY, and fails closed otherwise', () => {
  it('treats duplicate-object SQLSTATEs as benign', () => {
    for (const code of BENIGN_ALREADY_APPLIED_PG_CODES) {
      expect(isBenignAlreadyAppliedError({ code })).toBe(true);
    }
  });

  it.each([
    ['undefined_table', '42P01'],
    ['syntax_error', '42601'],
    ['undefined_column', '42703'],
  ])('treats %s as a genuine failure', (_label, code) => {
    expect(isBenignAlreadyAppliedError({ code })).toBe(false);
  });

  it('treats an error carrying no SQLSTATE as genuine, not benign', () => {
    expect(isBenignAlreadyAppliedError(new Error('boom'))).toBe(false);
    expect(isBenignAlreadyAppliedError(undefined)).toBe(false);
    expect(isBenignAlreadyAppliedError({ code: 42 })).toBe(false);
  });
});

describe('the migration database handed to up() cannot escape the transaction', () => {
  // A fake client is enough: the point is WHICH object the adapter talks to,
  // and what it does with calls it does not implement.
  const fakeClient = { query: async () => ({ rows: [], rowCount: 0 }) };
  const db: any = createTransactionalMigrationDatabase(fakeClient as never, 'x.sql');

  it('routes implemented calls at the pinned client', async () => {
    await expect(db.run('SELECT 1')).resolves.toEqual({ changes: 0 });
  });

  it('refuses close() — the client belongs to the runner, mid-transaction', () => {
    expect(() => db.close()).toThrow(UnsupportedMigrationDatabaseCallError);
  });

  it.each([['serialize'], ['parallelize'], ['prepare'], ['each']])(
    'refuses unimplemented sqlite-style %s() with the named error, not a bare TypeError',
    (method) => {
      expect(typeof db[method]).toBe('function');
      expect(() => db[method]()).toThrow(UnsupportedMigrationDatabaseCallError);
    }
  );
});

describe('the up() arity guard rejects only a genuinely empty parameter list', () => {
  it('flags an up() declaring no parameters', () => {
    expect(declaresEmptyParameterList(async function up() {})).toBe(true);
  });

  it.each([
    ['a normal parameter', async function up(_db: unknown) {}],
    ['a default parameter', async function up(_db: unknown = null) {}],
    ['a rest parameter', async function up(..._args: unknown[]) {}],
  ])('does not flag %s (fn.length alone would be 0 for the last two)', (_label, fn) => {
    expect(declaresEmptyParameterList(fn as never)).toBe(false);
  });
});

describe('migration discovery is closed over the directory', () => {
  it('names the excluded subdirectories explicitly rather than dropping them by accident', () => {
    expect([...KNOWN_EXCLUDED_MIGRATIONS_SUBDIRS].sort()).toEqual([
      'never-ran',
      'ops',
      'rollback',
    ]);
  });
});
