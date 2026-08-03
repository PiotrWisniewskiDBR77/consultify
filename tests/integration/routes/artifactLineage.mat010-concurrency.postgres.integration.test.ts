/** @vitest-environment node */

/**
 * MAT-010 — genuine CONCURRENCY coverage for the durable lineage write path,
 * against a REAL Postgres.
 *
 * ── WHY THIS FILE EXISTS (Codex review requirement) ───────────────────────
 * Codex required a test that proves TWO PARALLEL RETRIES of the same
 * operation receipt produce EXACTLY ONE event — i.e. that
 * `recordLineageEventTracked` (and the `recordLineageEvent` core it wraps,
 * see its doc comment in `server/src/services/lineage/artifactLineageService.ts`)
 * is safe under genuinely concurrent retries, not merely sequential ones.
 *
 * The existing MAT-010 suites already prove sequential retry idempotency (one
 * call, then another, awaited in order) and ALSO already prove 16 concurrent
 * FIRST events converge on one receipt
 * (`artifactLineage.mat010.postgres.integration.test.ts`, "16 simultaneous
 * first-events" test). What was still missing: two-plus concurrent retries of
 * the SAME already-existing event (same derived idempotency key), fired with
 * both promises created BEFORE either is awaited, so they race for real on
 * Postgres rather than being serialized by the test's own `await`s.
 *
 * This suite is SERVICE-LEVEL by design (per Codex's own framing of the ask):
 * the concurrency property under test lives entirely inside
 * `recordLineageEvent`'s `SELECT ... FOR UPDATE` row lock plus its
 * pre-insert idempotency-key dedup check, both inside one Postgres
 * transaction (`withPgTransaction`). It calls `recordLineageEventTracked` /
 * `recordLineageEvent` / `deriveStableIdempotencyKey` directly, and does NOT
 * boot an Express app or hit any HTTP route.
 *
 * EVERY assertion that matters is made against REAL DB STATE read back
 * through a separate `pg.Pool`, never against the shape of a resolved
 * promise alone — this repo's institutional lesson is that in-process-only
 * assertions are blind to "the second caller coincidentally didn't write"
 * vs. "the second caller genuinely deduped against the first".
 *
 * REQUIRES `NODE_ENV=test RUN_DB_TESTS=1` with `DATABASE_URL` pointed at a
 * real, migrated Postgres. `NODE_ENV=test` WITHOUT `RUN_DB_TESTS=1` silently
 * swaps in a mock DB (see `server/src/database/Database.ts`) and this entire
 * suite would pass against nothing. Run:
 *
 *   DATABASE_URL=postgresql://consultinity:consultinity@localhost:28972/consultinity \
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 \
 *   npx vitest run --retry=0 \
 *     tests/integration/routes/artifactLineage.mat010-concurrency.postgres.integration.test.ts
 *
 * `--retry=0` is deliberate (institutional memory: `retry: 1` hides fixture
 * collisions and makes race tests lie — a real concurrency test must be
 * stable on repeated runs, not merely pass once by luck).
 */
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { RecordLineageEventParams } from '../../../server/src/services/lineage/artifactLineageService.js';

const SUFFIX = uuidv4().slice(0, 8);
const ORG_A = `org-mat010-concurrency-${SUFFIX}`;
const USER_A = `user-mat010-concurrency-${SUFFIX}`;

describe('MAT-010 — genuine concurrent retries of the same lineage event (real Postgres)', () => {
  let pool: Pool;
  let lineageService: typeof import('../../../server/src/services/lineage/artifactLineageService.js');

  beforeAll(async () => {
    if (process.env.NODE_ENV !== 'test' || process.env.RUN_DB_TESTS !== '1') {
      throw new Error(
        'This suite requires NODE_ENV=test RUN_DB_TESTS=1 with DATABASE_URL pointed at a real, migrated Postgres.'
      );
    }
    lineageService = await import(
      '../../../server/src/services/lineage/artifactLineageService.js'
    );
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  afterAll(async () => {
    // Hygiene (CLAUDE.md): probes clean up after themselves, zero test records.
    // No `generated_workbooks` rows are ever inserted by this suite (there is
    // no FK from `artifact_lineage_receipts` to the owner tables — see the
    // migration's "FRESH-DB GUARD" comment — so establishing a receipt via a
    // bare `recordLineageEvent({ eventType: 'created' })` call, exactly as
    // Codex's brief suggests as the simpler option, needs nothing else
    // cleaned up).
    await pool.query(`DELETE FROM artifact_lineage_pending_events WHERE organization_id = $1`, [
      ORG_A,
    ]);
    await pool.query(`DELETE FROM artifact_lineage_events WHERE organization_id = $1`, [ORG_A]);
    await pool.query(`DELETE FROM artifact_lineage_receipts WHERE organization_id = $1`, [ORG_A]);
    await pool.end();
  });

  // ── DB read-back helpers (real state, never in-process promise shapes) ──
  async function dbReceipt(sourceRecordId: string) {
    const r = await pool.query(
      `SELECT * FROM artifact_lineage_receipts
        WHERE organization_id = $1 AND source_record_id = $2`,
      [ORG_A, sourceRecordId]
    );
    expect(r.rows).toHaveLength(1);
    return r.rows[0];
  }

  async function dbEvents(receiptId: string) {
    const r = await pool.query(
      `SELECT * FROM artifact_lineage_events WHERE receipt_id = $1 ORDER BY sequence_no ASC`,
      [receiptId]
    );
    return r.rows;
  }

  /** Establishes a receipt via the real `created` write — the simpler of the
   *  two options Codex's brief offered, and enough to attach subsequent
   *  events to something real. */
  async function seedReceipt(sourceRecordId: string, titleSnapshot: string) {
    const created = await lineageService.recordLineageEvent({
      organizationId: ORG_A,
      artifactKind: 'workbook',
      sourceRecordId,
      eventType: 'created',
      actorUserId: USER_A,
      titleSnapshot,
    });
    expect(created.receiptCreated).toBe(true);
    return created.receiptId;
  }

  // =====================================================================
  // 1) Two genuinely concurrent retries, SAME idempotency key -> ONE event.
  // =====================================================================
  it('two genuinely concurrent retries of the same operation receipt (same idempotencyKey) produce EXACTLY ONE event, and both callers agree on its eventId', async () => {
    const sourceRecordId = `wb-conc2-${uuidv4()}`;
    const receiptId = await seedReceipt(sourceRecordId, 'MAT-010 Concurrency Probe (2-way)');

    const occurredAt = new Date().toISOString();
    const key = `mat010-concurrency-2way-${uuidv4()}`;
    // The literal same params object, per Codex's brief — both concurrent
    // callers race with an IDENTICAL RecordLineageEventParams.
    const params: RecordLineageEventParams = {
      organizationId: ORG_A,
      artifactKind: 'workbook',
      sourceRecordId,
      eventType: 'version',
      actorUserId: USER_A,
      detail: { note: 'concurrent retry probe (2-way)' },
      idempotencyKey: key,
      occurredAt,
    };

    // Both promises are CREATED before either is awaited — genuine
    // concurrency, not two sequential `await`s that merely look concurrent.
    const call1 = lineageService.recordLineageEventTracked(params);
    const call2 = lineageService.recordLineageEventTracked(params);
    const [r1, r2] = await Promise.all([call1, call2]);

    // Neither call is allowed to report the "nothing survived" outcome for a
    // plain retry with no fault injection in play.
    expect(r1.durable).toBe(true);
    expect(r2.durable).toBe(true);

    const receipt = await dbReceipt(sourceRecordId);
    expect(receipt.receipt_id).toBe(receiptId);
    const events = await dbEvents(receiptId);
    const versionEvents = events.filter((e) => e.event_type === 'version');

    // THE assertion this test exists for: not two rows, one.
    expect(versionEvents).toHaveLength(1);
    expect(versionEvents[0].idempotency_key).toBe(key);

    // Both calls' returned eventId (when the direct write itself is the one
    // that resolved — the normal case with no fault injection) must equal
    // each other AND the DB row's event_id. This is what proves the SECOND
    // caller genuinely deduped against the first rather than coincidentally
    // not writing: if `SELECT ... FOR UPDATE` did not serialize the two
    // transactions, both could observe "no existing key yet" and each would
    // insert its own row, producing two DIFFERENT event ids.
    const returnedIds = [r1.event?.eventId, r2.event?.eventId].filter(
      (id): id is string => id != null
    );
    expect(returnedIds.length).toBe(2);
    expect(returnedIds[0]).toBe(returnedIds[1]);
    expect(returnedIds[0]).toBe(versionEvents[0].event_id);

    // One of the two calls actually inserted; the other found it already
    // there. `deduped` distinguishes them, but both must be internally
    // consistent about which single event now exists.
    const dedupedFlags = [r1.event?.deduped, r2.event?.deduped];
    expect(dedupedFlags.filter((d) => d === true).length).toBe(1);
    expect(dedupedFlags.filter((d) => d === false).length).toBe(1);
  });

  // =====================================================================
  // 2) Higher concurrency: 16 concurrent retries, SAME key -> still ONE
  //    event and ONE event_count increment (not one per call).
  // =====================================================================
  it('16 concurrent retries of the same operation receipt (same idempotencyKey) produce EXACTLY ONE event and exactly ONE event_count increment', async () => {
    const sourceRecordId = `wb-conc16-${uuidv4()}`;
    const receiptId = await seedReceipt(sourceRecordId, 'MAT-010 Concurrency Probe (16-way)');

    const countBefore = Number((await dbReceipt(sourceRecordId)).event_count);
    expect(countBefore).toBe(1); // just the `created` event so far

    const occurredAt = new Date().toISOString();
    const key = `mat010-concurrency-16way-${uuidv4()}`;
    const params: RecordLineageEventParams = {
      organizationId: ORG_A,
      artifactKind: 'workbook',
      sourceRecordId,
      eventType: 'export',
      actorUserId: USER_A,
      detail: { format: 'xlsx', note: 'concurrent retry probe (16-way)' },
      idempotencyKey: key,
      occurredAt,
    };

    // 16 calls, matching this codebase's existing "16 simultaneous" retry
    // convention (see the sibling suite's first-events test) — all 16
    // promises created in one synchronous `Array.from` pass, so none of them
    // is awaited before the others start.
    const results = await Promise.all(
      Array.from({ length: 16 }, () => lineageService.recordLineageEventTracked(params))
    );

    expect(results.every((r) => r.durable)).toBe(true);

    const receiptAfter = await dbReceipt(sourceRecordId);
    const events = await dbEvents(receiptId);
    const exportEvents = events.filter((e) => e.event_type === 'export');

    expect(exportEvents).toHaveLength(1);
    expect(exportEvents[0].idempotency_key).toBe(key);

    // All 16 callers that resolved via the direct write agree on the SAME
    // eventId — genuine convergence, not 16 independent successes.
    const returnedIds = results.map((r) => r.event?.eventId).filter((id): id is string => id != null);
    expect(returnedIds.length).toBe(16);
    expect(new Set(returnedIds).size).toBe(1);
    expect([...new Set(returnedIds)][0]).toBe(exportEvents[0].event_id);

    // Exactly one insert happened -> exactly one increment, never 16.
    expect(Number(receiptAfter.event_count)).toBe(countBefore + 1);
    expect(Number(receiptAfter.event_count)).toBe(events.length);

    // Exactly one of the 16 callers actually inserted the row.
    const insertedCount = results.filter((r) => r.event?.deduped === false).length;
    const dedupedCount = results.filter((r) => r.event?.deduped === true).length;
    expect(insertedCount).toBe(1);
    expect(dedupedCount).toBe(15);
  }, 20000);

  // =====================================================================
  // 3) NEGATIVE CONTRAST — proves 1) and 2) are not vacuous. Two concurrent
  //    calls with the SAME sourceRecordId/eventType but a DIFFERENT
  //    occurredAt derive DIFFERENT keys and must both be recorded.
  // =====================================================================
  it('NEGATIVE CONTRAST — two concurrent calls for the same artifact/eventType but a DIFFERENT occurredAt are genuinely distinct occurrences: BOTH get recorded, not deduped', async () => {
    const sourceRecordId = `wb-distinct-${uuidv4()}`;
    const receiptId = await seedReceipt(sourceRecordId, 'MAT-010 Distinct Occurrence Probe');

    const detail = { format: 'pdf', note: 'distinct occurrence probe' };
    const occurredAt1 = '2026-08-01T10:00:00.000Z';
    const occurredAt2 = '2026-08-01T11:00:00.000Z';

    // No explicit idempotencyKey on either — `recordLineageEventTracked`
    // derives one via `deriveStableIdempotencyKey`, whose hash material
    // includes `occurredAt`. Different `occurredAt` -> different derived key
    // -> NOT deduped. This is the exact mechanism the two tests above rely on
    // to dedupe identical retries; this test proves it also correctly tells
    // genuinely distinct occurrences apart.
    const params1: RecordLineageEventParams = {
      organizationId: ORG_A,
      artifactKind: 'workbook',
      sourceRecordId,
      eventType: 'export',
      actorUserId: USER_A,
      detail,
      occurredAt: occurredAt1,
    };
    const params2: RecordLineageEventParams = { ...params1, occurredAt: occurredAt2 };

    // Sanity on the mechanism itself, independent of the DB round trip: the
    // two derived keys really are different.
    const derived1 = lineageService.deriveStableIdempotencyKey({
      artifactKind: 'workbook',
      sourceRecordId,
      eventType: 'export',
      detail,
      occurredAt: occurredAt1,
    });
    const derived2 = lineageService.deriveStableIdempotencyKey({
      artifactKind: 'workbook',
      sourceRecordId,
      eventType: 'export',
      detail,
      occurredAt: occurredAt2,
    });
    expect(derived1).not.toBe(derived2);

    const [r1, r2] = await Promise.all([
      lineageService.recordLineageEventTracked(params1),
      lineageService.recordLineageEventTracked(params2),
    ]);

    expect(r1.durable).toBe(true);
    expect(r2.durable).toBe(true);
    expect(r1.event?.deduped).toBe(false);
    expect(r2.event?.deduped).toBe(false);

    const receipt = await dbReceipt(sourceRecordId);
    const events = await dbEvents(receiptId);
    const exportEvents = events.filter((e) => e.event_type === 'export');

    // THE contrast: exactly TWO rows, not one.
    expect(exportEvents).toHaveLength(2);

    const eventId1 = r1.event?.eventId;
    const eventId2 = r2.event?.eventId;
    expect(eventId1).toBeTruthy();
    expect(eventId2).toBeTruthy();
    expect(eventId1).not.toBe(eventId2);
    expect(new Set(exportEvents.map((e) => e.event_id))).toEqual(new Set([eventId1, eventId2]));

    // Sequence numbers stay dense across `created` + the two exports; the row
    // lock still serialized allocation even though neither call deduped.
    expect(Number(receipt.event_count)).toBe(events.length);
    expect(events.map((e) => Number(e.sequence_no)).sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });
});
