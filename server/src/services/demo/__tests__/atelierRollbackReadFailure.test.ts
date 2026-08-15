/**
 * MAT-006B — A RECONCILIATION READ THAT DID NOT HAPPEN IS NOT A VERDICT.
 *
 * ★ THE FALSE GREEN THIS FILE EXISTS TO PREVENT
 * ---------------------------------------------
 * After an ambiguous COMMIT the executor re-reads the three decks on a fresh
 * connection. When THAT read also fails, there is a tempting shortcut: treat it
 * as the pre-state ("the rollback probably worked"). That shortcut produces
 * `{ok: true, restored: true}` — a claim that every one of 24 columns matches
 * the backup — out of a read nobody performed. It is the single most damaging
 * output this module can produce, and it survived the entire suite.
 *
 * ★ WHY THE BOUNDARY IS MOCKED HERE AND NOT IN THE REAL-POSTGRESQL SUITE
 * ----------------------------------------------------------------------
 * Everything the SERVER decides is measured against a real PostgreSQL 16 in
 * `atelierPresentationDeckSeedPostgres.test.ts`, including the case where the
 * in-doubt transaction still holds the tenant advisory lock. But "the fresh
 * connection could not be made at all" is not a server behaviour — it is what
 * this code does with a failure it has already been handed, and against a live
 * container it cannot be produced deterministically:
 *
 *   - `getDatabaseConfig()` MEMOISES (measured 2026-08-01: it caches in a
 *     module-private variable and exports no reset), so re-pointing
 *     `DATABASE_URL` mid-suite does not move the connection;
 *   - the superuser the container runs as bypasses `CONNECT` privilege,
 *     connection limits and RLS, so the read cannot be refused from SQL;
 *   - dropping the table out from under the reconciliation races the executor's
 *     own read-back, which needs the same table one statement earlier.
 *
 * So the two functions at the seam are stubbed, and NOTHING else is: the code
 * under test is the real `reconcileAtelierDeckRollback` and the real
 * `rollbackAtelierDecksOnPinnedClient`, including the mapping from
 * reconciliation verdict to `RollbackOutcome`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const seam = vi.hoisted(() => ({
  /** What `withFreshPgConnection` answers this test. */
  freshOutcome: null as unknown,
  /** What `withPinnedPgTransaction` answers this test. */
  pinnedOutcome: null as unknown,
  freshCalls: 0,
}));

vi.mock('../../../utils/pinnedPgTransaction.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    withFreshPgConnection: async () => {
      seam.freshCalls += 1;
      return seam.freshOutcome;
    },
    withPinnedPgTransaction: async () => seam.pinnedOutcome,
  };
});

import {
  ATELIER_DECK_SLUGS,
  type AtelierDeckBackup,
  atelierDeckId,
  type AtelierDeckPostState,
  reconcileAtelierDeckRollback,
  rollbackAtelierDecksOnPinnedClient,
} from '../atelierPresentationDeckSeed.js';

const ORG = 'atelier';

/**
 * A backup that passes every pre-BEGIN refusal, so the test reaches the branch
 * it is about. All three decks were absent before the run; no row is needed,
 * because a read that failed never compares one.
 */
function backupOfAbsentDecks(): AtelierDeckBackup {
  return {
    organizationId: ORG,
    complete: true,
    entries: ATELIER_DECK_SLUGS.map((slug) => ({
      deckId: atelierDeckId(ORG, slug),
      state: 'verified_absent' as const,
      row: null,
      error: null,
    })),
  };
}

function postStateOfAbsentDecks(): AtelierDeckPostState[] {
  return ATELIER_DECK_SLUGS.map((slug) => ({
    deckId: atelierDeckId(ORG, slug),
    state: 'absent' as const,
    organizationId: null,
    version: null,
    updatedAt: null,
    contentFingerprint: null,
    slideCount: null,
    status: null,
  }));
}

beforeEach(() => {
  // `pinnedPgUnavailableReason()` is the REAL one and reads these directly.
  process.env.DB_TYPE = 'postgres';
  process.env.DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:5432/unused';
  seam.freshOutcome = null;
  seam.pinnedOutcome = null;
  seam.freshCalls = 0;
});

describe('MAT-006B — a reconciliation read that failed is `unreadable`, never a state', () => {
  const READ_FAILURES: Array<[string, unknown]> = [
    [
      'the fresh connection could not be built at all',
      { available: false, reason: 'fresh connect failed: ECONNREFUSED 127.0.0.1:5432' },
    ],
    [
      'the fresh connection was made and the SELECT failed',
      { available: true, ok: false, error: 'canceling statement due to statement timeout' },
    ],
  ];

  for (const [label, outcome] of READ_FAILURES) {
    it(`★ MUTATION GUARD — ${label}: verdict is 'unreadable', and every deck is 'unreadable'`, () => {
      seam.freshOutcome = outcome;

      return reconcileAtelierDeckRollback({
        organizationId: ORG,
        backup: backupOfAbsentDecks(),
        expectedPostState: postStateOfAbsentDecks(),
      }).then((reconciliation) => {
        // The three that matter, spelled out rather than implied: it is not the
        // pre-state (which would license `restored: true`), not the post-state
        // (which would license "the restore did not take effect"), and it
        // carries no rows to pretend it read.
        expect(reconciliation.verdict).not.toBe('pre-state');
        expect(reconciliation.verdict).not.toBe('post-state');
        expect(reconciliation.verdict).toBe('unreadable');
        expect(reconciliation.rows).toEqual([]);
        expect(reconciliation.observed.map((o) => o.matches)).toEqual([
          'unreadable',
          'unreadable',
          'unreadable',
        ]);
        expect(seam.freshCalls).toBe(1);
      });
    });
  }

  it('★ MUTATION GUARD — an ambiguous COMMIT plus an unreadable re-read is NEVER `{ok: true, restored: true}`', async () => {
    seam.pinnedOutcome = {
      available: true,
      state: 'indeterminate',
      error: 'COMMIT outcome UNKNOWN — the statement was sent and no answer came back',
    };
    seam.freshOutcome = {
      available: false,
      reason: 'fresh connect failed: ECONNREFUSED 127.0.0.1:5432',
    };

    const outcome = await rollbackAtelierDecksOnPinnedClient({
      organizationId: ORG,
      backup: backupOfAbsentDecks(),
      expectedPostState: postStateOfAbsentDecks(),
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.restored).toBe(false);
    expect(outcome.ok === false && outcome.stage).toBe('indeterminate');
    if (outcome.ok === false && outcome.stage === 'indeterminate') {
      expect(outcome.verdict).toBe('unreadable');
      expect(outcome.needsOperator).toBe(true);
      expect(outcome.observed.map((o) => o.matches)).toEqual([
        'unreadable',
        'unreadable',
        'unreadable',
      ]);
      expect(outcome.reason).toMatch(/could NOT be established/i);
      // ★ THE WORDING BAN. A determinate stage would license this sentence; an
      // unreadable reconciliation licenses nothing at all.
      expect(outcome.reason).not.toMatch(/rolled (its own )?transaction back|nothing was changed/i);
    }
  });

  it('an ambiguous COMMIT whose re-read DOES show the pre-state is still the one `restored: true`', async () => {
    // The negative above is only meaningful if the positive still works: an
    // `unreadable` that swallowed the success case would pass every assertion
    // in this file and break the executor.
    seam.pinnedOutcome = {
      available: true,
      state: 'indeterminate',
      error: 'COMMIT outcome UNKNOWN — the statement was sent and no answer came back',
    };
    // All three decks were absent before the run and are absent now: the
    // pre-state, read successfully, with the lock acquired.
    seam.freshOutcome = { available: true, ok: true, value: { settled: true, rows: [] } };

    const outcome = await rollbackAtelierDecksOnPinnedClient({
      organizationId: ORG,
      backup: backupOfAbsentDecks(),
      expectedPostState: postStateOfAbsentDecks(),
    });

    expect(outcome.ok).toBe(true);
    expect(outcome.restored).toBe(true);
  });

  it('an in-doubt transaction that still holds the lock is `unreadable`, not a verdict', async () => {
    // The same guarantee the real-PostgreSQL suite measures against a live
    // lock holder, pinned here at the seam so the MAPPING is covered even when
    // Docker is unavailable and that suite skips.
    seam.freshOutcome = { available: true, ok: true, value: { settled: false, rows: [] } };

    const reconciliation = await reconcileAtelierDeckRollback({
      organizationId: ORG,
      backup: backupOfAbsentDecks(),
      expectedPostState: postStateOfAbsentDecks(),
    });

    expect(reconciliation.verdict).toBe('unreadable');
    expect(reconciliation.detail).toMatch(/advisory lock/i);
  });
});
