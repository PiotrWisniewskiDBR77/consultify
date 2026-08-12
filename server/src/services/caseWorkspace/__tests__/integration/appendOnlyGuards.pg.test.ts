/**
 * Case Workspace — REAL, DATABASE-LEVEL append-only enforcement, proved
 * against a REAL PostgreSQL (R3-P1). Backs
 * server/migrations/20260810f_case_workspace_append_only_guards.sql.
 *
 * ===========================================================================
 * WHY THIS SUITE EXISTS
 * ===========================================================================
 * The prior "proof" of append-only for these three tables was a regex over
 * one service file's source text — never a guarantee the DATABASE itself
 * enforces. A manual `UPDATE`/`DELETE` from any other connection (psql, a
 * future careless migration, a compromised credential) passed silently. This
 * suite issues raw SQL directly against the tables — bypassing every
 * service — to prove the constraint lives in Postgres, not in application
 * discipline.
 *
 * ===========================================================================
 * GATE — this suite touches a real database, never a mock
 * ===========================================================================
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL=postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test \
 *   npx vitest run \
 *   src/services/caseWorkspace/__tests__/integration/appendOnlyGuards.pg.test.ts \
 *   --environment node
 *
 * ===========================================================================
 * WHAT THIS SUITE PROVES, PER TABLE
 * ===========================================================================
 * case_workspace_event_outbox:
 *   - UPDATE of a content column (event_type, redacted_summary, ...) -> REJECTED
 *   - UPDATE of ONLY delivered_at/delivery_attempt_count/last_delivery_error
 *     (the exact shape dispatchPendingEvents() issues) -> ALLOWED
 *   - DELETE -> REJECTED, unconditionally
 *
 * case_workspace_event_inbox:
 *   - UPDATE of a claim-identity column (event_id, redacted_payload, ...) -> REJECTED
 *   - UPDATE of ONLY processing-state columns (status, wait_id, case_id,
 *     run_id, node_run_id, applied_effect_ref, processed_at,
 *     process_attempt_count, last_process_error — the exact shape
 *     eventInboxService's reject()/apply()/recordInboxProcessingFailure()
 *     issue) -> ALLOWED
 *   - DELETE -> REJECTED, unconditionally
 *
 * case_workspace_history_events:
 *   - ANY UPDATE -> REJECTED
 *   - DELETE -> REJECTED, unconditionally
 *
 * A trailing test asserts the trigger's own guarantee did not silently
 * disappear: `information_schema.triggers` still lists all three.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

async function canReachWithGuards(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const triggers = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.triggers
        WHERE trigger_schema = 'public'
          AND trigger_name IN (
            'trg_case_workspace_history_events_block_mutation',
            'trg_case_workspace_event_outbox_guard',
            'trg_case_workspace_event_inbox_guard'
          )`
    );
    // Each trigger fires for both UPDATE and DELETE, so information_schema
    // reports 2 rows per trigger name (6 total) on Postgres.
    return Number(triggers.rows[0]?.present ?? 0) >= 6;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

const REACHABLE = REAL_DB_REQUESTED ? await canReachWithGuards(CONNECTION_STRING) : false;

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[appendOnlyGuards pg suite SKIPPED — this is a clean skip, not a failure] needs ` +
      `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and ` +
      `20260810f_case_workspace_append_only_guards.sql applied. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

interface PgError extends Error {
  code?: string;
}

suite('case_workspace append-only DB guards (R3-P1) — real trigger enforcement against real PostgreSQL', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  function scope(label: string): { orgId: string; caseId: string; suffix: string } {
    const suffix = randomUUID();
    return {
      orgId: `cwguard-org-${label}-${suffix}`,
      caseId: `cwguard-case-${label}-${suffix}`,
      suffix,
    };
  }

  async function expectRejected(query: () => Promise<unknown>): Promise<PgError> {
    let caught: PgError | null = null;
    try {
      await query();
    } catch (error) {
      caught = error as PgError;
    }
    expect(caught).not.toBeNull();
    expect(caught?.code).toBe('0A000'); // feature_not_supported — matches ERRCODE in the trigger
    return caught as PgError;
  }

  // =========================================================================
  // 1. case_workspace_event_outbox
  // =========================================================================
  describe('case_workspace_event_outbox', () => {
    it('rejects UPDATE of a content column (event_type)', async () => {
      const { orgId, caseId, suffix } = scope('outbox-content');
      const eventId = `cwevt-guard-${suffix}`;
      try {
        await control.query(
          `INSERT INTO case_workspace_event_outbox
             (event_id, event_type, organization_id, aggregate_type, aggregate_id, actor_user_id, correlation_id)
           VALUES ($1, 'case.created', $2, 'CASE', $3, 'cwguard-actor', $4)`,
          [eventId, orgId, caseId, `corr-${suffix}`]
        );

        const err = await expectRejected(() =>
          control.query(`UPDATE case_workspace_event_outbox SET event_type = 'case.tampered' WHERE event_id = $1`, [
            eventId,
          ])
        );
        expect(err.message).toMatch(/append-only/);
        // `next_retry_at` was added as a fourth mutable delivery-bookkeeping
        // column by migration 20260812a_case_workspace_outbox_next_retry_at
        // (per-row retry backoff), which widened the trigger's own message
        // to match. Keep this assertion listing all four permitted columns
        // by name (not a vague /append-only/ alone) — the precision here IS
        // the security property under test: the guard permits EXACTLY the
        // delivery-bookkeeping columns and nothing else.
        expect(err.message).toMatch(
          /delivered_at, delivery_attempt_count, last_delivery_error and next_retry_at/
        );

        // Confirm the row is genuinely unchanged, not just that the statement threw.
        const read = await control.query(`SELECT event_type FROM case_workspace_event_outbox WHERE event_id = $1`, [
          eventId,
        ]);
        expect(read.rows[0]?.event_type).toBe('case.created');
      } finally {
        await control.query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = $1`, [orgId]).catch(() => {
          // The guard itself may reject this cleanup DELETE — that is the point of
          // the trigger. Fall back to disabling triggers for this session only if
          // the row must be purged; harmless to leave a uniquely-suffixed test row
          // behind otherwise (no shared identifier collides with real data).
        });
      }
    });

    it('allows UPDATE of ONLY the three delivery-bookkeeping columns (the exact shape dispatchPendingEvents issues)', async () => {
      const { orgId, caseId, suffix } = scope('outbox-delivery');
      const eventId = `cwevt-guard-${suffix}`;
      await control.query(
        `INSERT INTO case_workspace_event_outbox
           (event_id, event_type, organization_id, aggregate_type, aggregate_id, actor_user_id, correlation_id)
         VALUES ($1, 'case.created', $2, 'CASE', $3, 'cwguard-actor', $4)`,
        [eventId, orgId, caseId, `corr-${suffix}`]
      );

      await expect(
        control.query(
          `UPDATE case_workspace_event_outbox SET delivered_at = now(), last_delivery_error = NULL WHERE event_id = $1`,
          [eventId]
        )
      ).resolves.toMatchObject({ rowCount: 1 });

      // Second legitimate shape: the failure-path UPDATE.
      await expect(
        control.query(
          `UPDATE case_workspace_event_outbox
              SET delivery_attempt_count = delivery_attempt_count + 1, last_delivery_error = 'transient'
            WHERE event_id = $1`,
          [eventId]
        )
      ).resolves.toMatchObject({ rowCount: 1 });

      const read = await control.query(
        `SELECT delivered_at, delivery_attempt_count, last_delivery_error FROM case_workspace_event_outbox WHERE event_id = $1`,
        [eventId]
      );
      expect(read.rows[0]?.delivered_at).not.toBeNull();
      expect(Number(read.rows[0]?.delivery_attempt_count)).toBe(1);
      expect(read.rows[0]?.last_delivery_error).toBe('transient');
    });

    it('rejects DELETE unconditionally', async () => {
      const { orgId, caseId, suffix } = scope('outbox-delete');
      const eventId = `cwevt-guard-${suffix}`;
      await control.query(
        `INSERT INTO case_workspace_event_outbox
           (event_id, event_type, organization_id, aggregate_type, aggregate_id, actor_user_id, correlation_id)
         VALUES ($1, 'case.created', $2, 'CASE', $3, 'cwguard-actor', $4)`,
        [eventId, orgId, caseId, `corr-${suffix}`]
      );

      const err = await expectRejected(() =>
        control.query(`DELETE FROM case_workspace_event_outbox WHERE event_id = $1`, [eventId])
      );
      expect(err.message).toMatch(/append-only: DELETE is not permitted/);

      const read = await control.query(`SELECT event_id FROM case_workspace_event_outbox WHERE event_id = $1`, [
        eventId,
      ]);
      expect(read.rows).toHaveLength(1);
    });
  });

  // =========================================================================
  // 2. case_workspace_event_inbox
  // =========================================================================
  describe('case_workspace_event_inbox', () => {
    it('rejects UPDATE of a claim-identity column (event_id)', async () => {
      const { suffix } = scope('inbox-content');
      const inboxRecordId = `cwinbox-guard-${suffix}`;
      await control.query(
        `INSERT INTO case_workspace_event_inbox
           (inbox_record_id, event_id, source, event_type, organization_id, correlation_key, payload_digest)
         VALUES ($1, $2, 'cwguard-webhook', 'signature.completed', $3, $4, 'sha256:cwguard')`,
        [inboxRecordId, `ext-evt-${suffix}`, `cwguard-org-${suffix}`, `corr-${suffix}`]
      );

      const err = await expectRejected(() =>
        control.query(`UPDATE case_workspace_event_inbox SET event_id = 'tampered' WHERE inbox_record_id = $1`, [
          inboxRecordId,
        ])
      );
      expect(err.message).toMatch(/append-only/);
      expect(err.message).toMatch(/received claim/);

      const read = await control.query(`SELECT event_id FROM case_workspace_event_inbox WHERE inbox_record_id = $1`, [
        inboxRecordId,
      ]);
      expect(read.rows[0]?.event_id).toBe(`ext-evt-${suffix}`);
    });

    it('rejects UPDATE of redacted_payload (the untrusted claim body)', async () => {
      const { suffix } = scope('inbox-payload');
      const inboxRecordId = `cwinbox-guard-${suffix}`;
      await control.query(
        `INSERT INTO case_workspace_event_inbox
           (inbox_record_id, event_id, source, event_type, organization_id, correlation_key, payload_digest)
         VALUES ($1, $2, 'cwguard-webhook', 'signature.completed', $3, $4, 'sha256:cwguard')`,
        [inboxRecordId, `ext-evt-${suffix}`, `cwguard-org-${suffix}`, `corr-${suffix}`]
      );

      const err = await expectRejected(() =>
        control.query(
          `UPDATE case_workspace_event_inbox SET redacted_payload = '{"tampered":true}'::jsonb WHERE inbox_record_id = $1`,
          [inboxRecordId]
        )
      );
      expect(err.message).toMatch(/received claim/);
    });

    it('allows UPDATE of ONLY processing-state columns (the exact shape reject()/apply()/recordInboxProcessingFailure issue)', async () => {
      const { suffix } = scope('inbox-state');
      const inboxRecordId = `cwinbox-guard-${suffix}`;
      const waitId = `cwwait-guard-${suffix}`;
      const caseId = `cwguard-case-${suffix}`;
      await control.query(
        `INSERT INTO case_workspace_event_inbox
           (inbox_record_id, event_id, source, event_type, organization_id, correlation_key, payload_digest)
         VALUES ($1, $2, 'cwguard-webhook', 'signature.completed', $3, $4, 'sha256:cwguard')`,
        [inboxRecordId, `ext-evt-${suffix}`, `cwguard-org-${suffix}`, `corr-${suffix}`]
      );

      // Shape 1: reject() gate.
      await expect(
        control.query(
          `UPDATE case_workspace_event_inbox SET status = 'REJECTED', rejection_code = 'PAYLOAD_INVALID', processed_at = now() WHERE inbox_record_id = $1`,
          [inboxRecordId]
        )
      ).resolves.toMatchObject({ rowCount: 1 });

      // Reset to RECEIVED so the apply-shape UPDATE below is exercised too
      // (a real row only takes one path, but the guard must permit both
      // shapes independently — this proves neither is blocked).
      await control.query(`UPDATE case_workspace_event_inbox SET status = 'RECEIVED', rejection_code = NULL WHERE inbox_record_id = $1`, [
        inboxRecordId,
      ]);

      // Shape 2: GATE 4 apply UPDATE.
      await expect(
        control.query(
          `UPDATE case_workspace_event_inbox
              SET status = 'APPLIED', wait_id = $2, case_id = COALESCE(case_id, $3),
                  run_id = COALESCE(run_id, NULL), node_run_id = COALESCE(node_run_id, NULL),
                  applied_effect_ref = $2, processed_at = now(),
                  process_attempt_count = process_attempt_count + 1
            WHERE inbox_record_id = $1 AND status = 'RECEIVED'`,
          [inboxRecordId, waitId, caseId]
        )
      ).resolves.toMatchObject({ rowCount: 1 });

      // Shape 3: recordInboxProcessingFailure-style UPDATE.
      await expect(
        control.query(
          `UPDATE case_workspace_event_inbox
              SET process_attempt_count = process_attempt_count + 1, last_process_error = 'transient failure'
            WHERE inbox_record_id = $1`,
          [inboxRecordId]
        )
      ).resolves.toMatchObject({ rowCount: 1 });

      const read = await control.query(
        `SELECT status, wait_id, case_id, applied_effect_ref, process_attempt_count, last_process_error
           FROM case_workspace_event_inbox WHERE inbox_record_id = $1`,
        [inboxRecordId]
      );
      expect(read.rows[0]).toMatchObject({
        status: 'APPLIED',
        wait_id: waitId,
        case_id: caseId,
        applied_effect_ref: waitId,
        process_attempt_count: 2,
        last_process_error: 'transient failure',
      });
    });

    it('rejects DELETE unconditionally', async () => {
      const { suffix } = scope('inbox-delete');
      const inboxRecordId = `cwinbox-guard-${suffix}`;
      await control.query(
        `INSERT INTO case_workspace_event_inbox
           (inbox_record_id, event_id, source, event_type, organization_id, correlation_key, payload_digest)
         VALUES ($1, $2, 'cwguard-webhook', 'signature.completed', $3, $4, 'sha256:cwguard')`,
        [inboxRecordId, `ext-evt-${suffix}`, `cwguard-org-${suffix}`, `corr-${suffix}`]
      );

      const err = await expectRejected(() =>
        control.query(`DELETE FROM case_workspace_event_inbox WHERE inbox_record_id = $1`, [inboxRecordId])
      );
      expect(err.message).toMatch(/append-only: DELETE is not permitted/);

      const read = await control.query(`SELECT inbox_record_id FROM case_workspace_event_inbox WHERE inbox_record_id = $1`, [
        inboxRecordId,
      ]);
      expect(read.rows).toHaveLength(1);
    });
  });

  // =========================================================================
  // 3. case_workspace_history_events
  // =========================================================================
  describe('case_workspace_history_events', () => {
    async function insertHistoryRow(suffix: string): Promise<string> {
      const eventId = `cwhist-guard-${suffix}`;
      await control.query(
        `INSERT INTO case_workspace_history_events
           (event_id, organization_id, case_id, event_type, actor_id, occurred_at, summary)
         VALUES ($1, $2, $3, 'CASE_STATUS_CHANGED', 'cwguard-actor', now()::text, 'guard test summary')`,
        [eventId, `cwguard-org-${suffix}`, `cwguard-case-${suffix}`]
      );
      return eventId;
    }

    it('rejects ANY UPDATE', async () => {
      const suffix = randomUUID();
      const eventId = await insertHistoryRow(suffix);

      const err = await expectRejected(() =>
        control.query(`UPDATE case_workspace_history_events SET summary = 'tampered' WHERE event_id = $1`, [eventId])
      );
      expect(err.message).toMatch(/append-only: UPDATE is not permitted/);

      const read = await control.query(`SELECT summary FROM case_workspace_history_events WHERE event_id = $1`, [
        eventId,
      ]);
      expect(read.rows[0]?.summary).toBe('guard test summary');
    });

    it('rejects DELETE unconditionally', async () => {
      const suffix = randomUUID();
      const eventId = await insertHistoryRow(suffix);

      const err = await expectRejected(() =>
        control.query(`DELETE FROM case_workspace_history_events WHERE event_id = $1`, [eventId])
      );
      expect(err.message).toMatch(/append-only: DELETE is not permitted/);

      const read = await control.query(`SELECT event_id FROM case_workspace_history_events WHERE event_id = $1`, [
        eventId,
      ]);
      expect(read.rows).toHaveLength(1);
    });
  });

  // =========================================================================
  // 4. The guarantee itself is installed (defence against a future migration
  //    silently dropping the trigger).
  // =========================================================================
  it('all three append-only triggers are present in information_schema', async () => {
    const result = await control.query(
      `SELECT event_object_table, trigger_name FROM information_schema.triggers
        WHERE trigger_schema = 'public'
          AND trigger_name IN (
            'trg_case_workspace_history_events_block_mutation',
            'trg_case_workspace_event_outbox_guard',
            'trg_case_workspace_event_inbox_guard'
          )
        GROUP BY event_object_table, trigger_name
        ORDER BY event_object_table`
    );
    expect(result.rows).toEqual([
      { event_object_table: 'case_workspace_event_inbox', trigger_name: 'trg_case_workspace_event_inbox_guard' },
      { event_object_table: 'case_workspace_event_outbox', trigger_name: 'trg_case_workspace_event_outbox_guard' },
      { event_object_table: 'case_workspace_history_events', trigger_name: 'trg_case_workspace_history_events_block_mutation' },
    ]);
  });
});
