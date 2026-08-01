/**
 * FIN-005 P1-B — the PROCESS-DEATH WINDOW, closed and proved on a real
 * PostgreSQL.
 *
 * ===========================================================================
 * THE WINDOW
 * ===========================================================================
 * The pinned transaction already survives a process death BETWEEN two promotion
 * UPDATEs: the server aborts an uncommitted transaction when the connection
 * drops, and there is no half-promoted state to repair. It does NOT survive a
 * process death INSIDE the COMMIT round-trip. Nothing runs there — no
 * reconciliation, no hold, no result object, no log line. The transaction may
 * have committed.
 *
 * The next run then finds a fully promoted fixture, phase 0 sees 5/5 (not a
 * mixed residue), nothing is healed, the guarded UPDATEs are no-ops, and the
 * seed reports `complete`. That answer is correct if the COMMIT landed and a
 * fabrication if it did not — and NOTHING IN THE SYSTEM KNOWS WHICH. The
 * `commit-indeterminate` machinery cannot help: it only exists once the COMMIT
 * has returned an error to a live process.
 *
 * ===========================================================================
 * WHAT CLOSES IT
 * ===========================================================================
 * A `PROMOTION_IN_PROGRESS` marker, written durably BEFORE `BEGIN`, carrying the
 * run id, the tenant, the exact five row ids, the pre-state digest, the intended
 * post-state digest, the target's identity and a timestamp. After a CONFIRMED
 * outcome it is updated with that outcome, durably, and only then removed.
 *
 * So a marker still reading `PROMOTION_IN_PROGRESS` is, by construction, a
 * process that died between `BEGIN` and the confirmed result — and the next run
 * treats it EXACTLY like `NEEDS_OPERATOR`: it refuses, it issues no statement,
 * and it cannot clear the marker.
 *
 * ===========================================================================
 * HOW THIS FILE PROVES IT
 * ===========================================================================
 * Ordering is not taken on trust. `fs.renameSync` (the durable write's final
 * step) and `pg.Client.prototype.query` (every statement, including `BEGIN`)
 * push into ONE interleaved log, so "the marker was on disk before BEGIN" is an
 * index comparison over observed events rather than a claim about the source.
 * The marker's BYTES are captured at the instant of the rename, so what is
 * asserted is what a crash would have left behind — not what the file looks
 * like after the run tidied up.
 *
 * ===========================================================================
 * HOW TO RUN — SEQUENTIALLY. THIS IS NOT OPTIONAL.
 * ===========================================================================
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/fin005_pri \
 *   npx vitest run --retry=0 --fileParallelism=false \
 *     server/src/services/demo/__tests__/atelierFinanceDeathWindow.pg.test.ts
 *
 * This file installs NO schema objects. Its only fault is an extra row in ONE
 * tenant's `financial_statement_values`, which the production verdict refuses —
 * so a batched run cannot interfere with the two suites that DO install triggers
 * on `financial_statements`. An earlier draft used a trigger on
 * `financial_statement_packs` and did interfere: batched, it made
 * `atelierFinanceLateWrite.pg.test.ts` fail on a foreign-key violation that had
 * nothing to do with either file's subject.
 *
 * ===========================================================================
 * HOW THIS WAS PROVED RED
 * ===========================================================================
 * Each revert was actually applied and the suite actually run — these are
 * observed failures, not predictions:
 *
 *   - REMOVE the `writeAtelierFinancePromotionMarker(marker)` call before
 *     `runPinnedPromotionTransaction` (the pre-BEGIN write). 3 of the 4 tests
 *     fail: the ordering test sees the marker's first rename at index 104 with
 *     `BEGIN` at 72 (i.e. the only marker write left is the terminal one, and it
 *     happens after the transaction), and both lifecycle tests observe a single
 *     `['COMMITTED']` / `['ROLLED_BACK']` write where two are required.
 *   - REMOVE the marker branch from `describeBlockingOperatorRecord`, leaving
 *     only the hold. `a leftover PROMOTION_IN_PROGRESS marker BLOCKS the next
 *     run` reports `complete` — the run sails straight through the evidence.
 *   - REMOVE the runId/state ownership check from `removeOwnPromotionMarker`.
 *     This one is caught by the UNIT file rather than here (a blocked run
 *     returns before phase 2, so it never reaches the removal at all):
 *     `atelierFinanceDurableHold.test.ts` fails its three ownership tests,
 *     including `refuses to remove a marker belonging to ANOTHER run`.
 */

import fs from 'node:fs';
import path from 'node:path';

import pg, { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.DB_MANAGED_SCHEMA = process.env.DB_MANAGED_SCHEMA ?? 'false';
});

import * as DbPromise from '../../../utils/DbPromise.js';
import {
  acknowledgeAtelierFinanceCommitIndeterminate,
  type AtelierCanonicalIds,
  atelierFinancePromotionMarkerPath,
  getAtelierFinanceCanonicalIds,
  readAtelierFinancePromotionMarker,
  upsertAtelierFinanceGoldenFlow,
} from '../atelierFinanceSeed.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

const REACHABLE = REAL_DB_REQUESTED ? await hasReadinessColumns(CONNECTION_STRING) : false;

async function hasReadinessColumns(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const result = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'financial_statements'
          AND column_name IN ('readiness_status', 'readiness_score')`
    );
    return Number(result.rows[0]?.present ?? 0) === 2;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[FIN-005 death-window suite SKIPPED — this is a clean skip, not a failure] needs ` +
      `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=<migrated postgres>. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const ORG_PREFIX = 'fin005-death-window';
const ORG_KEYS = ['clean', 'rollback', 'left-behind', 'ordering'] as const;
type OrgKey = (typeof ORG_KEYS)[number];
const orgFor = (key: OrgKey): string => `${ORG_PREFIX}-${key}`;
const idsFor = (key: OrgKey): AtelierCanonicalIds => getAtelierFinanceCanonicalIds(orgFor(key));

const suite = REACHABLE ? describe.sequential : describe.skip;

/** One interleaved log of filesystem and SQL events, in the order they happened. */
interface Observed {
  kind: 'rename' | 'sql';
  detail: string;
  /** For a marker rename: the bytes as they were at that instant. */
  bytes?: string;
}

suite('FIN-005 P1-B — the process-death window', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 4 });
    for (const key of ORG_KEYS) {
      await control.query(
        `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
        [orgFor(key), `FIN-005 death-window fixture (${key})`]
      );
    }
  }, 120_000);

  afterAll(async () => {
    if (!control) return;
    for (const key of ORG_KEYS) {
      await deleteFixture(idsFor(key)).catch(() => undefined);
      await control
        .query(`DELETE FROM organizations WHERE id = $1`, [orgFor(key)])
        .catch(() => undefined);
      clearMarker(orgFor(key));
    }
    await control.end().catch(() => undefined);
    const { default: db } = await import('../../../database/PostgresDatabase.js');
    await (db as unknown as { close: () => Promise<void> }).close().catch(() => undefined);
  }, 120_000);

  // -------------------------------------------------------------------------
  // #5 / #6 — the marker is DURABLE BEFORE `BEGIN`, and carries the payload.
  // -------------------------------------------------------------------------
  it('writes the marker durably BEFORE BEGIN, with the run id, the five rows, both digests and the target', async () => {
    const ids = idsFor('ordering');
    await deleteFixture(ids);
    clearMarker(orgFor('ordering'));

    const markerFile = atelierFinancePromotionMarkerPath(orgFor('ordering'));
    const observed: Observed[] = [];
    const { restore } = observe(observed, markerFile);

    let result: Awaited<ReturnType<typeof upsertAtelierFinanceGoldenFlow>>;
    try {
      result = await upsertAtelierFinanceGoldenFlow({
        organizationId: orgFor('ordering'),
        runId: 'run-ordering-1',
      });
    } finally {
      restore();
    }
    expect(result.status, result.reason ?? '').toBe('complete');

    const firstMarkerWrite = observed.findIndex((event) => event.kind === 'rename');
    const firstBegin = observed.findIndex(
      (event) => event.kind === 'sql' && event.detail.trim().toUpperCase().startsWith('BEGIN')
    );
    expect(firstMarkerWrite, 'no marker was ever written').toBeGreaterThanOrEqual(0);
    expect(firstBegin, 'the pinned transaction never began').toBeGreaterThanOrEqual(0);
    expect(
      firstMarkerWrite,
      'the PROMOTION_IN_PROGRESS marker must be on disk before BEGIN'
    ).toBeLessThan(firstBegin);

    // What a crash at that instant would have left behind — read from the
    // bytes captured at the rename, not from the tidied-up end state.
    const atRename = JSON.parse(observed[firstMarkerWrite].bytes as string);
    expect(atRename.state).toBe('PROMOTION_IN_PROGRESS');
    expect(atRename.runId).toBe('run-ordering-1');
    expect(atRename.organizationId).toBe(orgFor('ordering'));
    expect(new Set(atRename.rowIds)).toEqual(
      new Set([ids.packId, ...ids.statementIds, ids.analysisId])
    );
    expect(atRename.preStateDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(atRename.intendedPostStateDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(atRename.target.database).toBeTruthy();
    expect(atRename.target.databaseOid).toMatch(/^\d+$/);
    expect(atRename.target.backendPid).toMatch(/^\d+$/);
    expect(Date.parse(atRename.startedAt)).not.toBeNaN();
    expect(atRename.finishedAt).toBeUndefined();
  }, 240_000);

  // -------------------------------------------------------------------------
  // #7 — the outcome is recorded, and only THEN is the marker removed.
  // -------------------------------------------------------------------------
  it('a COMMITTED run records the outcome and then removes its own marker', async () => {
    const ids = idsFor('clean');
    await deleteFixture(ids);
    clearMarker(orgFor('clean'));

    const markerFile = atelierFinancePromotionMarkerPath(orgFor('clean'));
    const observed: Observed[] = [];
    const { restore } = observe(observed, markerFile);
    let result: Awaited<ReturnType<typeof upsertAtelierFinanceGoldenFlow>>;
    try {
      result = await upsertAtelierFinanceGoldenFlow({
        organizationId: orgFor('clean'),
        runId: 'run-clean-1',
      });
    } finally {
      restore();
    }

    expect(result.status, result.reason ?? '').toBe('complete');
    const markerWrites = observed
      .filter((event) => event.kind === 'rename')
      .map((event) => JSON.parse(event.bytes as string).state);
    // TWO writes, in this order. One write would mean either no pre-BEGIN
    // record or no confirmed outcome; the reverse order would mean a crash
    // after COMMIT could leave PROMOTION_IN_PROGRESS behind forever.
    expect(markerWrites).toEqual(['PROMOTION_IN_PROGRESS', 'COMMITTED']);
    expect(readAtelierFinancePromotionMarker(orgFor('clean'))).toBeNull();
  }, 240_000);

  it('a ROLLED BACK run records that outcome too, and does not leave a marker behind', async () => {
    const ids = idsFor('rollback');
    await deleteFixture(ids);
    clearMarker(orgFor('rollback'));
    // Seed once so the fixture exists, then arm the fault for the promotion.
    const first = await upsertAtelierFinanceGoldenFlow({ organizationId: orgFor('rollback') });
    expect(first.status, first.reason ?? '').toBe('complete');
    await demoteFixture(ids);

    // THE FAULT, WITHOUT DDL. An extra value row under a canonical statement
    // makes `verifyStatementReadBack` count more values than the canonical
    // contract declares, so the production verdict refuses INSIDE the pinned
    // transaction and it ROLLS BACK. It survives phase 1 because phase 1 upserts
    // the canonical ids and never deletes anything.
    await control.query(
      `INSERT INTO financial_statement_values (id, statement_id, canonical_line_id, value)
       SELECT $1, $2, canonical_line_id, 1 FROM financial_statement_values
        WHERE statement_id = $2 LIMIT 1
       ON CONFLICT (id) DO NOTHING`,
      [`${ids.statementIds[0]}--death-window-extra`, ids.statementIds[0]]
    );

    const markerFile = atelierFinancePromotionMarkerPath(orgFor('rollback'));
    const observed: Observed[] = [];
    const { restore } = observe(observed, markerFile);
    let result: Awaited<ReturnType<typeof upsertAtelierFinanceGoldenFlow>>;
    try {
      result = await upsertAtelierFinanceGoldenFlow({
        organizationId: orgFor('rollback'),
        runId: 'run-rollback-1',
      });
    } finally {
      restore();
    }

    expect(result.status).toBe('incomplete');
    expect(result.reason).toMatch(/rolled back/i);
    const markerWrites = observed
      .filter((event) => event.kind === 'rename')
      .map((event) => JSON.parse(event.bytes as string).state);
    expect(markerWrites).toEqual(['PROMOTION_IN_PROGRESS', 'ROLLED_BACK']);
    expect(readAtelierFinancePromotionMarker(orgFor('rollback'))).toBeNull();
    // Postgres rolled it back, and the re-read agrees.
    expect(result.promotion?.rowsStillClaimingReady ?? []).toEqual([]);

    await control.query(`DELETE FROM financial_statement_values WHERE id = $1`, [
      `${ids.statementIds[0]}--death-window-extra`,
    ]);
  }, 240_000);

  // -------------------------------------------------------------------------
  // #9 / #10 — THE DEATH WINDOW ITSELF.
  //
  // A marker left in PROMOTION_IN_PROGRESS is what a process death looks like
  // from the outside. The next run must refuse, must issue nothing, and must not
  // be able to tidy the evidence away.
  // -------------------------------------------------------------------------
  it('a leftover PROMOTION_IN_PROGRESS marker BLOCKS the next run, which issues ZERO statements and clears nothing', async () => {
    const ids = idsFor('left-behind');
    await deleteFixture(ids);
    clearMarker(orgFor('left-behind'));

    // A completed run, so the fixture is READY and a "healthy" next run would
    // sail straight through — which is exactly the silent failure being
    // prevented.
    const first = await upsertAtelierFinanceGoldenFlow({
      organizationId: orgFor('left-behind'),
      runId: 'run-that-died',
    });
    expect(first.status, first.reason ?? '').toBe('complete');
    const fixtureBefore = await snapshotFixture(ids);

    // Now leave behind exactly what a process killed inside the COMMIT
    // round-trip leaves behind.
    const markerFile = atelierFinancePromotionMarkerPath(orgFor('left-behind'));
    fs.mkdirSync(path.dirname(markerFile), { recursive: true });
    fs.writeFileSync(
      markerFile,
      `${JSON.stringify(
        {
          state: 'PROMOTION_IN_PROGRESS',
          runId: 'run-that-died',
          organizationId: orgFor('left-behind'),
          rowIds: [ids.packId, ...ids.statementIds, ids.analysisId],
          preStateDigest: 'a'.repeat(64),
          intendedPostStateDigest: 'b'.repeat(64),
          target: {
            database: 'fin005_pri',
            databaseOid: '16384',
            serverAddr: '127.0.0.1',
            serverPort: '5432',
            backendPid: '4242',
            systemIdentifier: '7000000000000000000',
          },
          startedAt: '2026-08-01T00:00:00.000Z',
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    const markerBytesBefore = fs.readFileSync(markerFile, 'utf8');

    // Count EVERY statement the seed could issue. The gate sits above the
    // decisive read session, so not even a connection should be borrowed.
    const runSpy = vi.spyOn(DbPromise, 'run');
    const allSpy = vi.spyOn(DbPromise, 'all');
    const getSpy = vi.spyOn(DbPromise, 'get');
    const querySpy = vi.spyOn(pg.Client.prototype, 'query');
    let blocked: Awaited<ReturnType<typeof upsertAtelierFinanceGoldenFlow>>;
    try {
      blocked = await upsertAtelierFinanceGoldenFlow({
        organizationId: orgFor('left-behind'),
        runId: 'a-completely-different-run',
      });
    } finally {
      runSpy.mockRestore();
      allSpy.mockRestore();
      getSpy.mockRestore();
      querySpy.mockRestore();
    }

    // 1. It refuses, in the same words as a NEEDS_OPERATOR hold.
    expect(blocked.status).toBe('incomplete');
    expect(blocked.reason).toMatch(/NEEDS_OPERATOR — refusing to run/);
    expect(blocked.reason).toMatch(/PROMOTION_IN_PROGRESS promotion marker stands/);
    expect(blocked.reason).toMatch(/never recorded an outcome/i);
    expect(blocked.reason).toMatch(/MAY HAVE COMMITTED/);
    expect(blocked.reason).toMatch(/run-that-died/);
    expect(blocked.reason).toMatch(/This run will NOT clear it/);

    // 2. ZERO statements. Not a write, not a read, not a connection.
    expect(runSpy).not.toHaveBeenCalled();
    expect(allSpy).not.toHaveBeenCalled();
    expect(getSpy).not.toHaveBeenCalled();
    expect(querySpy).not.toHaveBeenCalled();

    // 3. The marker is untouched — byte for byte.
    expect(fs.readFileSync(markerFile, 'utf8')).toBe(markerBytesBefore);
    expect(readAtelierFinancePromotionMarker(orgFor('left-behind'))?.state).toBe(
      'PROMOTION_IN_PROGRESS'
    );

    // 4. And so is the fixture. The blocked run healed nothing and rewrote
    //    nothing, so the residue a human has to investigate is intact.
    expect(await snapshotFixture(ids)).toEqual(fixtureBefore);

    // 5. A SECOND blocked run behaves identically — the marker does not decay.
    const again = await upsertAtelierFinanceGoldenFlow({ organizationId: orgFor('left-behind') });
    expect(again.status).toBe('incomplete');
    expect(fs.readFileSync(markerFile, 'utf8')).toBe(markerBytesBefore);

    // 6. Only an EXPLICIT, ATTRIBUTED acknowledgement lifts it.
    const ack = acknowledgeAtelierFinanceCommitIndeterminate(orgFor('left-behind'), {
      operator: 'fin005-suite',
      decision: 'commit-landed',
      note: 'read all five rows on the primary; the promotion is present and coherent',
    });
    expect(ack.cleared).toBe(true);
    const audit = JSON.parse(fs.readFileSync(ack.auditPath as string, 'utf8'));
    expect(audit.operator).toBe('fin005-suite');
    expect(audit.clearedMarker.runId).toBe('run-that-died');

    const recovered = await upsertAtelierFinanceGoldenFlow({
      organizationId: orgFor('left-behind'),
    });
    expect(recovered.status, recovered.reason ?? '').toBe('complete');
  }, 300_000);

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Interleave filesystem and SQL events into one ordered log.
   *
   * `renameSync` is the last step of every durable write in
   * `atelierFinanceOperatorHold.ts`, so it is the instant the record becomes
   * visible. The temp file is read BEFORE the rename is performed, which is why
   * the captured bytes are the ones a crash would have left.
   */
  function observe(log: Observed[], markerFile: string): { restore: () => void } {
    const realRename = fs.renameSync;
    const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementation(((
      from: fs.PathLike,
      to: fs.PathLike
    ) => {
      if (String(to) === markerFile) {
        let bytes = '';
        try {
          bytes = fs.readFileSync(from as string, 'utf8');
        } catch {
          bytes = '';
        }
        log.push({ kind: 'rename', detail: String(to), bytes });
      }
      return realRename(from, to);
    }) as typeof fs.renameSync);

    const realQuery = pg.Client.prototype.query;
    const querySpy = vi.spyOn(pg.Client.prototype, 'query').mockImplementation(function (
      this: pg.Client,
      ...args: unknown[]
    ) {
      const first = args[0];
      const sql =
        typeof first === 'string' ? first : String((first as { text?: string })?.text ?? '');
      log.push({ kind: 'sql', detail: sql });
      return (realQuery as unknown as (...a: unknown[]) => unknown).apply(this, args);
    } as never);

    return {
      restore: () => {
        renameSpy.mockRestore();
        querySpy.mockRestore();
      },
    };
  }

  function clearMarker(organizationId: string): void {
    fs.rmSync(atelierFinancePromotionMarkerPath(organizationId), { force: true });
  }

  async function deleteFixture(ids: AtelierCanonicalIds): Promise<void> {
    await control.query(
      `DELETE FROM financial_statement_values WHERE statement_id = ANY($1::text[])`,
      [ids.statementIds]
    );
    await control.query(`DELETE FROM financial_analyses WHERE id = $1`, [ids.analysisId]);
    await control.query(
      `DELETE FROM financial_statement_ingest_runs WHERE statement_id = ANY($1::text[])`,
      [ids.statementIds]
    );
    await control.query(`DELETE FROM financial_statements WHERE id = ANY($1::text[])`, [
      ids.statementIds,
    ]);
    await control.query(`DELETE FROM financial_statement_packs WHERE id = $1`, [ids.packId]);
  }

  async function demoteFixture(ids: AtelierCanonicalIds): Promise<void> {
    await control.query(
      `UPDATE financial_statements SET status = 'imported', validation_status = 'pending',
          readiness_status = 'pending', readiness_score = 0 WHERE id = ANY($1::text[])`,
      [ids.statementIds]
    );
    await control.query(`UPDATE financial_analyses SET status = 'DRAFT' WHERE id = $1`, [
      ids.analysisId,
    ]);
    await control.query(
      `UPDATE financial_statement_packs SET pack_status = 'draft', pack_readiness_status = 'pending',
          pack_readiness_score = 0 WHERE id = $1`,
      [ids.packId]
    );
  }

  async function snapshotFixture(ids: AtelierCanonicalIds): Promise<unknown> {
    const packs = await control.query(`SELECT * FROM financial_statement_packs WHERE id = $1`, [
      ids.packId,
    ]);
    const statements = await control.query(
      `SELECT * FROM financial_statements WHERE id = ANY($1::text[]) ORDER BY id`,
      [ids.statementIds]
    );
    const analyses = await control.query(`SELECT * FROM financial_analyses WHERE id = $1`, [
      ids.analysisId,
    ]);
    return JSON.parse(
      JSON.stringify({ packs: packs.rows, statements: statements.rows, analyses: analyses.rows })
    );
  }
});
