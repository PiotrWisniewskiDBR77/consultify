/**
 * Case Workspace — Case History & Value Measurement service, proved against
 * a REAL PostgreSQL (CW-P07, EPIC E11 "History, closure, value and
 * Monitoring"). Exercises
 * server/src/services/caseWorkspace/caseHistoryService.ts against the schema
 * in server/migrations/20260809_case_workspace_history_value.sql.
 *
 * ===========================================================================
 * GATE — this suite touches a real database, never a mock
 * ===========================================================================
 * Same convention as caseCoreService.pg.test.ts (CW-P01) and
 * casePlanVersionService.pg.test.ts (CW-P02): `NODE_ENV=test` ALONE is a
 * trap — `Database.ts`'s `getDatabase()`/`createDatabase()` hand back an
 * in-memory MOCK whenever `RUN_DB_TESTS !== '1'` (or `MOCK_DB` isn't
 * explicitly `'false'`), and every write silently becomes a no-op. This file
 * follows the `*.pg.test.ts` convention: gate on
 * `RUN_DB_TESTS === '1' && MOCK_DB === 'false'`, probe reachability AND that
 * the migrated schema is actually present before deciding, and SKIP LOUDLY
 * (never silently pass) when either is missing.
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/<db> \
 *   npx vitest run server/src/services/caseWorkspace/__tests__/caseHistoryService.pg.test.ts
 *
 * ===========================================================================
 * ISOLATION — every test owns its own organization/project/case_core row
 * ===========================================================================
 * `case_workspace_history_events.case_id` itself carries NO FK (see the
 * migration's header) — the table can log an event about ANY source. But per
 * the CW-P12 auth retrofit below, appendCaseHistoryEvent() now ALSO calls
 * requireCaseAccess(input.actorId, input.caseId), which DOES require
 * input.caseId to resolve to a real case_core row (a documented behavior
 * change — see the "AUTHORIZATION" section below and
 * caseHistoryService.ts's own open_questions #4). So every test in this file
 * — history-event-only tests included — now seeds a real
 * organization/project/case_core row via `seedOrgProjectCase()`, exactly like
 * casePlanVersionService.pg.test.ts does. Every test seeds its own fixture
 * inside the test body (never a shared beforeEach) and tears it down itself
 * in a `finally`, so no test can observe, reset, or race another test's
 * rows.
 *
 * All assertions read the actual `case_workspace_history_events`/
 * `case_workspace_value_measurements` rows back out of Postgres through a
 * dedicated, out-of-band `pg.Pool` (`control`) — never the service
 * function's return value alone — because the return value only proves what
 * the service THINKS it wrote, not what actually landed.
 *
 * ===========================================================================
 * AUTHORIZATION (CW-P12 retrofit) — every actor is a real, membered user;
 * appendCaseHistoryEvent's caseId must now resolve to a real Case
 * ===========================================================================
 * caseHistoryService.ts now gates appendCaseHistoryEvent/recordValueMeasurement
 * (create class) and getCaseHistoryEvent/listCaseHistoryEventsForCase/
 * getValueMeasurement/listValueMeasurementsForCase/
 * listValueMeasurementsForMetric (read/list class) through
 * caseWorkspaceAuthContext.ts's requireCaseAccess. Every actor id used below
 * is a real `users` row with a matching ACTIVE `organization_members` row
 * for the Case's org, seeded here via direct INSERTs on the out-of-band pool
 * (seedUser/seedMember) — a test-fixture-only direct insert. This is a
 * documented behavior change versus the pre-retrofit design's "case_id has
 * no FK, never SELECTs case_core here" intent for the generic log (see the
 * service's own open_questions #4): a history event can no longer be logged
 * against a caseId that does not map to a live case_core row.
 *
 * ===========================================================================
 * STRUCTURAL append-only check (test 5) runs UNCONDITIONALLY, not gated
 * ===========================================================================
 * "There is no UPDATE/DELETE SQL against either table anywhere in
 * caseHistoryService.ts" is a static fact about the source file, not a
 * behavior of a live database — it is asserted in its own top-level
 * `describe` block, outside the `REACHABLE`-gated suite, so it still runs
 * (and still protects the append-only invariant) even in environments with
 * no Postgres available.
 */

import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as caseCoreService from '../caseCoreService.js';
import * as caseHistoryService from '../caseHistoryService.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

/** Reachability AND schema presence are decided once, before the suite is declared. */
const REACHABLE = REAL_DB_REQUESTED ? await canReachWithSchema(CONNECTION_STRING) : false;

async function canReachWithSchema(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const historyResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_history_events'
          AND column_name IN ('event_id', 'case_id', 'event_type', 'dedupe_key', 'global_seq')`
    );
    const historyOk = Number(historyResult.rows[0]?.present ?? 0) === 5;

    const valueResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_value_measurements'
          AND column_name IN ('measurement_id', 'case_id', 'metric_key', 'measurement_status', 'dedupe_key')`
    );
    const valueOk = Number(valueResult.rows[0]?.present ?? 0) === 5;

    const orgMembersResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'organization_members'
          AND column_name IN ('organization_id', 'user_id', 'role', 'status')`
    );
    const orgMembersOk = Number(orgMembersResult.rows[0]?.present ?? 0) === 4;

    // appendCaseHistoryEvent/recordValueMeasurement now publish a domain event
    // on the SAME transaction as the write (EVENT_TAXONOMY.md §2), so a missing
    // outbox table would fail every mutation. Probed here so that is a LOUD
    // SKIP rather than a mysterious red suite.
    const outboxResult = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_event_outbox'
          AND column_name IN ('event_id', 'event_type', 'organization_id', 'project_id',
                               'aggregate_type', 'aggregate_id', 'aggregate_version', 'case_id',
                               'actor_user_id', 'correlation_id', 'redacted_summary', 'payload_ref')`
    );
    const outboxOk = Number(outboxResult.rows[0]?.present ?? 0) === 12;

    return historyOk && valueOk && orgMembersOk && outboxOk;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[caseHistoryService pg suite SKIPPED — this is a clean skip, not a failure] needs ` +
      `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the ` +
      `20260809_case_workspace_history_value.sql migration applied (on top of ` +
      `20260809_case_workspace_case_core.sql). requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

interface CaseWorkspaceHistoryEventDbRow {
  event_id: string;
  organization_id: string;
  project_id: string | null;
  case_id: string;
  event_type: string;
  actor_id: string;
  occurred_at: string;
  recorded_at: string;
  summary: string;
  payload: string;
  source_table: string | null;
  source_id: string | null;
  correlation_id: string | null;
  dedupe_key: string | null;
  global_seq: string;
}

interface CaseWorkspaceValueMeasurementDbRow {
  measurement_id: string;
  organization_id: string;
  project_id: string | null;
  case_id: string;
  metric_key: string;
  metric_name: string;
  actual_value: string | null;
  measurement_status: string;
  measurement_date: string;
  evidence_ref: string | null;
  dedupe_key: string | null;
  created_at: string;
}

/** One `case_workspace_event_outbox` row, as stored (snake_case, straight from Postgres). */
interface EventOutboxDbRow {
  event_id: string;
  event_type: string;
  organization_id: string;
  project_id: string | null;
  aggregate_type: string;
  aggregate_id: string;
  aggregate_version: number | null;
  case_id: string | null;
  run_id: string | null;
  actor_user_id: string;
  correlation_id: string;
  causation_id: string | null;
  occurred_at: string;
  redacted_summary: Record<string, unknown>;
  payload_ref: string | null;
}

suite('caseHistoryService — Case History & Value Measurements against a real PostgreSQL (CW-P07, E11)', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  // -------------------------------------------------------------------------
  // Fixture helpers — every test calls these itself, never a shared hook.
  // -------------------------------------------------------------------------

  /** A fresh users row, unattached to organization_members unless seedMember() is also called for it. */
  async function seedUser(orgId: string, label: string): Promise<string> {
    const userId = `case-hist-user-${label}-${randomUUID()}`;
    await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
      userId,
      orgId,
      `${userId}@example.test`,
    ]);
    return userId;
  }

  /** An organization_members row for an existing user, at the given role/status. */
  async function seedMember(
    orgId: string,
    userId: string,
    role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'CONSULTANT',
    status: 'ACTIVE' | 'REVOKED' | 'SUSPENDED' = 'ACTIVE'
  ): Promise<void> {
    await control.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, $4, $5)`,
      [`case-hist-member-${randomUUID()}`, orgId, userId, role, status]
    );
  }

  /** Convenience: seed a user AND an ACTIVE membership at MEMBER role in one call. */
  async function seedMemberedUser(orgId: string, label: string): Promise<string> {
    const userId = await seedUser(orgId, label);
    await seedMember(orgId, userId, 'MEMBER');
    return userId;
  }

  /**
   * A fresh organization + project + real case_core row, plus a real
   * membered actor to create the Case with — exactly like
   * casePlanVersionService.pg.test.ts's seedOrgProjectCase(). Required for
   * EVERY test in this file now (not just the value-measurement ones): the
   * CW-P12 retrofit's requireCaseAccess call inside appendCaseHistoryEvent
   * means even the FK-less history-event log now needs a real Case + a real
   * membered actor to write against.
   */
  async function seedOrgProjectCase(
    label: string
  ): Promise<{ orgId: string; projectId: string; caseId: string; actorId: string }> {
    const suffix = randomUUID();
    const orgId = `case-hist-org-${label}-${suffix}`;
    const projectId = `case-hist-project-${label}-${suffix}`;
    await control.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [orgId, `Case History test org (${label})`]
    );
    await control.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
      [projectId, orgId, `Case History test project (${label})`]
    );
    const actorId = await seedMemberedUser(orgId, label);
    const created = await caseCoreService.createCase({
      projectId,
      organizationId: orgId,
      contractedClosureType: 'DELIVERY_COMPLETED',
      createdByActorId: actorId,
    });
    return { orgId, projectId, caseId: created.caseId, actorId };
  }

  /**
   * Teardown: value-measurement rows first (FK into case_core, no ON DELETE
   * CASCADE, so case_core cannot be deleted while they exist), then the
   * history events (FK-less, so they never cascade off case_core), then
   * users, then case_core itself, then projects/organizations.
   */
  async function teardown(params: {
    orgIds: string[];
    projectIds: string[];
    caseIds: string[];
    userIds?: string[];
  }): Promise<void> {
    for (const caseId of params.caseIds) {
      await control
        .query(`DELETE FROM case_workspace_value_measurements WHERE case_id = $1`, [caseId])
        .catch(() => undefined);
      await control
        .query(`DELETE FROM case_workspace_history_events WHERE case_id = $1`, [caseId])
        .catch(() => undefined);
    }
    for (const projectId of params.projectIds) {
      await control
        .query(`DELETE FROM case_core WHERE project_id = $1`, [projectId])
        .catch(() => undefined);
      await control.query(`DELETE FROM projects WHERE id = $1`, [projectId]).catch(() => undefined);
    }
    for (const userId of params.userIds ?? []) {
      await control.query(`DELETE FROM users WHERE id = $1`, [userId]).catch(() => undefined);
    }
    if (params.orgIds.length > 0) {
      // The outbox has no FK to organizations (append-only log of ids), so it
      // never cascades — each test removes exactly its own rows.
      await control
        .query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = ANY($1)`, [
          params.orgIds,
        ])
        .catch(() => undefined);
    }
    for (const orgId of params.orgIds) {
      await control.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => undefined);
    }
  }

  /**
   * Reads the outbox OUT OF BAND (dedicated `control` pool), never through the
   * service's own return value — the return value only proves what the service
   * THINKS it published.
   */
  async function readOutboxRowsForCase(caseId: string): Promise<EventOutboxDbRow[]> {
    const result = await control.query<EventOutboxDbRow>(
      `SELECT * FROM case_workspace_event_outbox WHERE case_id = $1 ORDER BY created_at ASC`,
      [caseId]
    );
    return result.rows;
  }

  async function readOutboxRowsForAggregate(aggregateId: string): Promise<EventOutboxDbRow[]> {
    const result = await control.query<EventOutboxDbRow>(
      `SELECT * FROM case_workspace_event_outbox WHERE aggregate_id = $1 ORDER BY created_at ASC`,
      [aggregateId]
    );
    return result.rows;
  }

  /**
   * Forces a failure AFTER the command's mutation AND after its publishEvent,
   * by installing a DEFERRABLE INITIALLY DEFERRED constraint trigger that
   * raises at COMMIT time for exactly one row. That is what makes the rollback
   * test a real atomicity proof rather than a "the insert itself blew up"
   * tautology: both writes have already happened on the transaction's client
   * when the poison fires, so a surviving outbox row would mean the outbox is
   * NOT sharing the command's transaction.
   */
  async function withCommitTimePoison<T>(
    params: { table: string; matchColumn: string; matchValue: string; event: 'INSERT' | 'UPDATE' },
    fn: () => Promise<T>
  ): Promise<T> {
    const token = randomUUID().replace(/-/g, '');
    const fnName = `cw_test_poison_fn_${token}`;
    const trgName = `cw_test_poison_trg_${token}`;
    const literal = params.matchValue.replace(/'/g, "''");
    await control.query(
      `CREATE FUNCTION ${fnName}() RETURNS trigger LANGUAGE plpgsql AS $poison$
         BEGIN RAISE EXCEPTION 'forced_commit_time_failure_for_atomicity_test'; END
       $poison$`
    );
    await control.query(
      `CREATE CONSTRAINT TRIGGER ${trgName}
         AFTER ${params.event} ON ${params.table}
         DEFERRABLE INITIALLY DEFERRED
         FOR EACH ROW WHEN (NEW.${params.matchColumn} = '${literal}')
         EXECUTE FUNCTION ${fnName}()`
    );
    try {
      return await fn();
    } finally {
      await control
        .query(`DROP TRIGGER IF EXISTS ${trgName} ON ${params.table}`)
        .catch(() => undefined);
      await control.query(`DROP FUNCTION IF EXISTS ${fnName}()`).catch(() => undefined);
    }
  }

  async function readHistoryEventRowsForCase(caseId: string): Promise<CaseWorkspaceHistoryEventDbRow[]> {
    const result = await control.query<CaseWorkspaceHistoryEventDbRow>(
      `SELECT * FROM case_workspace_history_events WHERE case_id = $1 ORDER BY global_seq ASC`,
      [caseId]
    );
    return result.rows;
  }

  async function readHistoryEventRowsForDedupeKey(
    dedupeKey: string
  ): Promise<CaseWorkspaceHistoryEventDbRow[]> {
    const result = await control.query<CaseWorkspaceHistoryEventDbRow>(
      `SELECT * FROM case_workspace_history_events WHERE dedupe_key = $1`,
      [dedupeKey]
    );
    return result.rows;
  }

  async function readValueMeasurementRowsForCase(
    caseId: string
  ): Promise<CaseWorkspaceValueMeasurementDbRow[]> {
    const result = await control.query<CaseWorkspaceValueMeasurementDbRow>(
      `SELECT * FROM case_workspace_value_measurements WHERE case_id = $1 ORDER BY created_at ASC`,
      [caseId]
    );
    return result.rows;
  }

  // -------------------------------------------------------------------------
  // 1. Monotonic global_seq — three sequential appends, read back in order.
  // -------------------------------------------------------------------------
  it('appendCaseHistoryEvent assigns strictly-increasing global_seq for three sequential events on the same case_id, read back in order via listCaseHistoryEventsForCase', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('seq');
    try {
      const first = await caseHistoryService.appendCaseHistoryEvent({
        organizationId: orgId,
        caseId,
        eventType: 'CASE_STATUS_CHANGED',
        actorId,
        occurredAt: new Date().toISOString(),
        summary: 'first event',
      });
      const second = await caseHistoryService.appendCaseHistoryEvent({
        organizationId: orgId,
        caseId,
        eventType: 'GOVERNANCE_TIER_CHANGED',
        actorId,
        occurredAt: new Date().toISOString(),
        summary: 'second event',
      });
      const third = await caseHistoryService.appendCaseHistoryEvent({
        organizationId: orgId,
        caseId,
        eventType: 'CLOSURE_RECORDED',
        actorId,
        occurredAt: new Date().toISOString(),
        summary: 'third event',
      });

      // Strictly increasing, in call order, from the returned values.
      expect(first.globalSeq).toBeLessThan(second.globalSeq);
      expect(second.globalSeq).toBeLessThan(third.globalSeq);

      // Read back through the service's own list method, in DB order.
      const listed = await caseHistoryService.listCaseHistoryEventsForCase(caseId, undefined, undefined, actorId);
      expect(listed.map((e) => e.eventId)).toEqual([first.eventId, second.eventId, third.eventId]);
      expect(listed.map((e) => e.globalSeq)).toEqual([first.globalSeq, second.globalSeq, third.globalSeq]);
      expect(listed[0].globalSeq).toBeLessThan(listed[1].globalSeq);
      expect(listed[1].globalSeq).toBeLessThan(listed[2].globalSeq);

      // And independently through the out-of-band control pool — never
      // trust the service's return value alone.
      const rows = await readHistoryEventRowsForCase(caseId);
      expect(rows.map((r) => r.event_id)).toEqual([first.eventId, second.eventId, third.eventId]);
      const seqs = rows.map((r) => Number(r.global_seq));
      expect(seqs[0]).toBeLessThan(seqs[1]);
      expect(seqs[1]).toBeLessThan(seqs[2]);
    } finally {
      await teardown({ orgIds: [orgId], projectIds: [projectId], caseIds: [caseId], userIds: [actorId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 2. dedupe_key idempotency.
  // -------------------------------------------------------------------------
  it('appendCaseHistoryEvent called twice with the SAME dedupe_key is a no-op returning the original row; a different dedupe_key creates a second, distinct row', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('dedupe');
    const dedupeKeyA = `dedupe-a-${randomUUID()}`;
    const dedupeKeyB = `dedupe-b-${randomUUID()}`;
    try {
      const firstCall = await caseHistoryService.appendCaseHistoryEvent({
        organizationId: orgId,
        caseId,
        eventType: 'CASE_STATUS_CHANGED',
        actorId,
        occurredAt: new Date().toISOString(),
        summary: 'dedupe test event A',
        dedupeKey: dedupeKeyA,
      });

      // Same dedupe_key, otherwise-identical call: must return the ORIGINAL
      // row unchanged (per the service's own documented idempotent-replay
      // contract), not throw and not create a second row.
      const secondCall = await caseHistoryService.appendCaseHistoryEvent({
        organizationId: orgId,
        caseId,
        eventType: 'CASE_STATUS_CHANGED',
        actorId,
        occurredAt: new Date().toISOString(),
        summary: 'dedupe test event A',
        dedupeKey: dedupeKeyA,
      });

      expect(secondCall.eventId).toBe(firstCall.eventId);
      expect(secondCall.globalSeq).toBe(firstCall.globalSeq);
      expect(secondCall.recordedAt).toBe(firstCall.recordedAt);

      const rowsForKeyA = await readHistoryEventRowsForDedupeKey(dedupeKeyA);
      expect(rowsForKeyA).toHaveLength(1);
      expect(rowsForKeyA[0].event_id).toBe(firstCall.eventId);

      // A DIFFERENT dedupe_key, same case_id and otherwise-identical fields:
      // must create a second, distinct row.
      const thirdCall = await caseHistoryService.appendCaseHistoryEvent({
        organizationId: orgId,
        caseId,
        eventType: 'CASE_STATUS_CHANGED',
        actorId,
        occurredAt: new Date().toISOString(),
        summary: 'dedupe test event A',
        dedupeKey: dedupeKeyB,
      });

      expect(thirdCall.eventId).not.toBe(firstCall.eventId);

      const rowsForKeyB = await readHistoryEventRowsForDedupeKey(dedupeKeyB);
      expect(rowsForKeyB).toHaveLength(1);
      expect(rowsForKeyB[0].event_id).toBe(thirdCall.eventId);

      // The case now carries exactly two rows total: one per distinct
      // dedupe_key (the repeated dedupeKeyA call did not add a third).
      const allRowsForCase = await readHistoryEventRowsForCase(caseId);
      expect(allRowsForCase).toHaveLength(2);
      expect(allRowsForCase.map((r) => r.event_id).sort()).toEqual(
        [firstCall.eventId, thirdCall.eventId].sort()
      );
    } finally {
      await teardown({ orgIds: [orgId], projectIds: [projectId], caseIds: [caseId], userIds: [actorId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 3. recordValueMeasurement — measurement row + linked history event,
  //    atomically; repeat calls append, never update.
  // -------------------------------------------------------------------------
  it('recordValueMeasurement creates a measurement row AND a linked history event in one call; calling it again for the same metric_key creates a SECOND measurement row, not an update', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('record');
    try {
      const firstMeasurement = await caseHistoryService.recordValueMeasurement({
        caseId,
        metricKey: 'cost-savings-pct',
        metricName: 'Cost savings percentage',
        actualValue: 12.5,
        targetValue: 15,
        baselineValue: 0,
        measurementStatus: 'CONFIRMED',
        measurementDate: '2026-01-15',
        confidence: 'HIGH',
        attribution: 'Directly attributable to the procurement renegotiation workstream',
        evidenceRef: 'evidence-doc-1',
        measuredByActorId: actorId,
      });

      // -- Both the measurement row and its linked history event genuinely
      //    landed in the DB (not just in the return value).
      const measurementRows = await readValueMeasurementRowsForCase(caseId);
      expect(measurementRows).toHaveLength(1);
      expect(measurementRows[0].measurement_id).toBe(firstMeasurement.measurementId);
      expect(measurementRows[0].metric_key).toBe('cost-savings-pct');
      expect(Number(measurementRows[0].actual_value)).toBe(12.5);
      expect(measurementRows[0].measurement_status).toBe('CONFIRMED');

      const historyRowsAfterFirst = await readHistoryEventRowsForCase(caseId);
      expect(historyRowsAfterFirst).toHaveLength(1);
      expect(historyRowsAfterFirst[0].event_type).toBe('VALUE_MEASUREMENT_RECORDED');
      expect(historyRowsAfterFirst[0].source_table).toBe('case_workspace_value_measurements');
      expect(historyRowsAfterFirst[0].source_id).toBe(firstMeasurement.measurementId);
      const firstPayload = JSON.parse(historyRowsAfterFirst[0].payload);
      expect(firstPayload.measurementId).toBe(firstMeasurement.measurementId);
      expect(firstPayload.metricKey).toBe('cost-savings-pct');
      expect(firstPayload.measurementStatus).toBe('CONFIRMED');

      // -- Calling it again for the SAME metric_key on the SAME case creates
      //    a SECOND measurement row (never an UPDATE of the first).
      const secondMeasurement = await caseHistoryService.recordValueMeasurement({
        caseId,
        metricKey: 'cost-savings-pct',
        metricName: 'Cost savings percentage',
        actualValue: 18,
        targetValue: 15,
        baselineValue: 0,
        measurementStatus: 'CONFIRMED',
        measurementDate: '2026-02-15',
        confidence: 'HIGH',
        attribution: 'Second measurement window, procurement workstream sustained',
        evidenceRef: 'evidence-doc-2',
        measuredByActorId: actorId,
      });

      expect(secondMeasurement.measurementId).not.toBe(firstMeasurement.measurementId);

      const measurementRowsAfterSecond = await readValueMeasurementRowsForCase(caseId);
      expect(measurementRowsAfterSecond).toHaveLength(2);
      const measurementIds = measurementRowsAfterSecond.map((r) => r.measurement_id);
      expect(new Set(measurementIds).size).toBe(2);
      expect(measurementIds).toContain(firstMeasurement.measurementId);
      expect(measurementIds).toContain(secondMeasurement.measurementId);

      // The FIRST row's original field values are untouched by the second call.
      const firstRowAfterSecondCall = measurementRowsAfterSecond.find(
        (r) => r.measurement_id === firstMeasurement.measurementId
      );
      expect(Number(firstRowAfterSecondCall?.actual_value)).toBe(12.5);
      expect(firstRowAfterSecondCall?.measurement_date).toBe('2026-01-15');

      const secondRow = measurementRowsAfterSecond.find(
        (r) => r.measurement_id === secondMeasurement.measurementId
      );
      expect(Number(secondRow?.actual_value)).toBe(18);
      expect(secondRow?.measurement_date).toBe('2026-02-15');

      // The second call also appended its OWN linked history event — a
      // second VALUE_MEASUREMENT_RECORDED row, distinct from the first.
      const historyRowsAfterSecond = await readHistoryEventRowsForCase(caseId);
      expect(historyRowsAfterSecond).toHaveLength(2);
      const secondHistoryRow = historyRowsAfterSecond.find(
        (r) => r.source_id === secondMeasurement.measurementId
      );
      expect(secondHistoryRow?.event_type).toBe('VALUE_MEASUREMENT_RECORDED');
      const secondPayload = JSON.parse(secondHistoryRow?.payload ?? '{}');
      expect(secondPayload.measurementId).toBe(secondMeasurement.measurementId);
    } finally {
      await teardown({ orgIds: [orgId], projectIds: [projectId], caseIds: [caseId], userIds: [actorId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 4. listValueMeasurementsForMetric — chronological series; 'sustained' is
  //    derivable from a later CONFIRMED row without touching the earlier one.
  // -------------------------------------------------------------------------
  it('listValueMeasurementsForMetric returns the series for one case+metric_key in chronological order, and computeMetricValueOutcomeState reads SUSTAINED from a later CONFIRMED row without needing to touch the earlier rows', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('series');
    try {
      const partial = await caseHistoryService.recordValueMeasurement({
        caseId,
        metricKey: 'adoption-rate',
        metricName: 'Adoption rate',
        measurementStatus: 'PARTIAL',
        measurementDate: '2026-01-01',
        confidence: 'LOW',
        attribution: 'Early partial evidence from pilot cohort',
        measuredByActorId: actorId,
      });
      const firstConfirmed = await caseHistoryService.recordValueMeasurement({
        caseId,
        metricKey: 'adoption-rate',
        metricName: 'Adoption rate',
        actualValue: 62,
        measurementStatus: 'CONFIRMED',
        measurementDate: '2026-02-01',
        confidence: 'MEDIUM',
        attribution: 'Full rollout measurement, first confirmed window',
        evidenceRef: 'evidence-adoption-1',
        measuredByActorId: actorId,
      });
      const secondConfirmed = await caseHistoryService.recordValueMeasurement({
        caseId,
        metricKey: 'adoption-rate',
        metricName: 'Adoption rate',
        actualValue: 71,
        measurementStatus: 'CONFIRMED',
        measurementDate: '2026-03-01',
        confidence: 'HIGH',
        attribution: 'Second consecutive confirmed window, benefit sustained',
        evidenceRef: 'evidence-adoption-2',
        measuredByActorId: actorId,
      });

      const series = await caseHistoryService.listValueMeasurementsForMetric(caseId, 'adoption-rate', actorId);

      // Chronological order (measurement_date ASC), oldest first.
      expect(series.map((m) => m.measurementId)).toEqual([
        partial.measurementId,
        firstConfirmed.measurementId,
        secondConfirmed.measurementId,
      ]);
      expect(series.map((m) => m.measurementDate)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);

      // The earlier PARTIAL row alone would only read PARTIAL_EVIDENCE...
      const outcomeAfterPartialOnly = caseHistoryService.computeMetricValueOutcomeState([series[0]]);
      expect(outcomeAfterPartialOnly).toBe('PARTIAL_EVIDENCE');

      // ...one CONFIRMED row reads BENEFIT_ACHIEVED (not yet SUSTAINED)...
      const outcomeAfterOneConfirmed = caseHistoryService.computeMetricValueOutcomeState([
        series[0],
        series[1],
      ]);
      expect(outcomeAfterOneConfirmed).toBe('BENEFIT_ACHIEVED');

      // ...and the FULL series (with the later, second CONFIRMED row) reads
      // SUSTAINED — derived purely by appending a new row, never by editing
      // series[0] or series[1].
      const outcomeAfterFullSeries = caseHistoryService.computeMetricValueOutcomeState(series);
      expect(outcomeAfterFullSeries).toBe('SUSTAINED');

      // The earlier rows are, independently, still exactly what they were
      // recorded as — proving the "SUSTAINED" read came from the new row
      // landing, not from any rewrite of history.
      expect(series[0].measurementStatus).toBe('PARTIAL');
      expect(series[1].measurementStatus).toBe('CONFIRMED');
      expect(series[1].actualValue).toBe(62);
    } finally {
      await teardown({ orgIds: [orgId], projectIds: [projectId], caseIds: [caseId], userIds: [actorId] });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 6. AUTHORIZATION (CW-P12) — appendCaseHistoryEvent (create class): an
  //    actor with no membership in the Case's org is rejected, creating no
  //    row; the same applies to a caseId that does not resolve to any real
  //    case_core row at all (open_questions #4's documented consequence).
  // -------------------------------------------------------------------------
  it('appendCaseHistoryEvent rejects an actor with no organization_members row for the Case\'s org, and rejects a caseId with no backing case_core row at all', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('auth-create');
    const noMembershipActor = await seedUser(orgId, 'auth-create-outsider');
    try {
      await expect(
        caseHistoryService.appendCaseHistoryEvent({
          organizationId: orgId,
          caseId,
          eventType: 'CASE_STATUS_CHANGED',
          actorId: noMembershipActor,
          occurredAt: new Date().toISOString(),
          summary: 'should not land',
        })
      ).rejects.toMatchObject({ code: 'case_access_denied' });

      await expect(
        caseHistoryService.appendCaseHistoryEvent({
          organizationId: orgId,
          caseId: `case-${randomUUID()}`,
          eventType: 'CASE_STATUS_CHANGED',
          actorId,
          occurredAt: new Date().toISOString(),
          summary: 'should not land either',
        })
      ).rejects.toMatchObject({ code: 'case_access_denied' });

      const rows = await readHistoryEventRowsForCase(caseId);
      expect(rows).toHaveLength(0);
    } finally {
      await teardown({
        orgIds: [orgId],
        projectIds: [projectId],
        caseIds: [caseId],
        userIds: [actorId, noMembershipActor],
      });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 7. AUTHORIZATION (CW-P12) — getCaseHistoryEvent/getValueMeasurement
  //    (read class, SEC-009 hardening): a nonexistent id and a real id the
  //    actor cannot access both return null.
  // -------------------------------------------------------------------------
  it('getCaseHistoryEvent and getValueMeasurement both return null for an actor with no membership, identical to a nonexistent id', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('auth-read-null');
    const noMembershipActor = await seedUser(orgId, 'auth-read-null-outsider');
    try {
      const event = await caseHistoryService.appendCaseHistoryEvent({
        organizationId: orgId,
        caseId,
        eventType: 'CASE_STATUS_CHANGED',
        actorId,
        occurredAt: new Date().toISOString(),
        summary: 'read-null test event',
      });
      const measurement = await caseHistoryService.recordValueMeasurement({
        caseId,
        metricKey: 'auth-read-null-metric',
        metricName: 'Auth read-null metric',
        measurementStatus: 'UNMEASURED',
        measurementDate: '2026-01-01',
        confidence: 'LOW',
        attribution: 'auth read-null test',
        measuredByActorId: actorId,
      });

      const eventMissing = await caseHistoryService.getCaseHistoryEvent(
        `cwhist-${randomUUID()}`,
        noMembershipActor
      );
      const eventDenied = await caseHistoryService.getCaseHistoryEvent(event.eventId, noMembershipActor);
      expect(eventMissing).toBeNull();
      expect(eventDenied).toBeNull();

      const measurementMissing = await caseHistoryService.getValueMeasurement(
        `cwvm-${randomUUID()}`,
        noMembershipActor
      );
      const measurementDenied = await caseHistoryService.getValueMeasurement(
        measurement.measurementId,
        noMembershipActor
      );
      expect(measurementMissing).toBeNull();
      expect(measurementDenied).toBeNull();

      const eventAllowed = await caseHistoryService.getCaseHistoryEvent(event.eventId, actorId);
      expect(eventAllowed?.eventId).toBe(event.eventId);
    } finally {
      await teardown({
        orgIds: [orgId],
        projectIds: [projectId],
        caseIds: [caseId],
        userIds: [actorId, noMembershipActor],
      });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 5. DOMAIN EVENT (EVENT_TAXONOMY.md §2, caseHistoryService row 1) —
  //    appendCaseHistoryEvent emits the caller's own event_type VERBATIM (the
  //    history catalog is NOT this taxonomy's namespace), exactly once, on the
  //    CASE aggregate, referencing the history row instead of copying it.
  // -------------------------------------------------------------------------
  it('appendCaseHistoryEvent writes exactly one outbox row carrying the caller event_type verbatim, and a dedupe_key replay adds no second row', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('outbox-history');
    try {
      const dedupeKey = `history-outbox-${randomUUID()}`;
      const appended = await caseHistoryService.appendCaseHistoryEvent({
        organizationId: orgId,
        projectId,
        caseId,
        eventType: 'GOVERNANCE_TIER_CHANGED',
        actorId,
        occurredAt: new Date().toISOString(),
        summary: 'free text that must never be copied into the event',
        payload: { secretish: 'also never copied' },
        sourceTable: 'case_core',
        sourceId: caseId,
        dedupeKey,
      });

      const emitted = (await readOutboxRowsForCase(caseId)).filter(
        (row) => row.event_type === 'GOVERNANCE_TIER_CHANGED'
      );
      expect(emitted).toHaveLength(1);
      const event = emitted[0];
      expect(event.aggregate_type).toBe('CASE');
      expect(event.aggregate_id).toBe(caseId);
      // §3: this command writes case_workspace_history_events, not case_core —
      // there is no post-mutation case_core.version to take, so null, never a
      // re-read.
      expect(event.aggregate_version).toBeNull();
      expect(event.organization_id).toBe(orgId);
      expect(event.project_id).toBe(projectId);
      expect(event.case_id).toBe(caseId);
      expect(event.actor_user_id).toBe(actorId);
      expect(String(event.correlation_id ?? '').trim().length).toBeGreaterThan(0);

      // Facts and ids only; the free-text summary/payload are REFERENCED.
      expect(event.redacted_summary).toMatchObject({
        historyEventId: appended.eventId,
        sourceTable: 'case_core',
        sourceId: caseId,
      });
      expect(event.payload_ref).toBe(`case_workspace_history_events:${appended.eventId}`);
      const summaryText = JSON.stringify(event.redacted_summary);
      expect(summaryText).not.toContain('free text that must never be copied');
      expect(summaryText).not.toContain('also never copied');

      // Same dedupe_key -> the service returns the ORIGINAL history row and the
      // deterministic event id collapses under ON CONFLICT DO NOTHING: still
      // exactly one outbox row, not two.
      const replayed = await caseHistoryService.appendCaseHistoryEvent({
        organizationId: orgId,
        projectId,
        caseId,
        eventType: 'GOVERNANCE_TIER_CHANGED',
        actorId,
        occurredAt: new Date().toISOString(),
        summary: 'replay attempt',
        sourceTable: 'case_core',
        sourceId: caseId,
        dedupeKey,
      });
      expect(replayed.eventId).toBe(appended.eventId);
      expect(
        (await readOutboxRowsForCase(caseId)).filter(
          (row) => row.event_type === 'GOVERNANCE_TIER_CHANGED'
        )
      ).toHaveLength(1);
    } finally {
      await teardown({
        orgIds: [orgId],
        projectIds: [projectId],
        caseIds: [caseId],
        userIds: [actorId],
      });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 6. DOMAIN EVENT + §5.6 NO DOUBLE-EMISSION — recordValueMeasurement writes
  //    a measurement row AND a linked history row in one transaction, but must
  //    produce EXACTLY ONE outbox row (`outcome.measurement_recorded`): the
  //    internal insertHistoryEvent() helper deliberately does not emit.
  // -------------------------------------------------------------------------
  it('recordValueMeasurement writes exactly one outcome.measurement_recorded outbox row and NO second row for the history entry it appends internally (§5.6)', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('outbox-measurement');
    try {
      const measurement = await caseHistoryService.recordValueMeasurement({
        caseId,
        metricKey: 'cost-savings-pct',
        metricName: 'Cost savings percentage',
        actualValue: 12.5,
        targetValue: 15,
        baselineValue: 0,
        measurementStatus: 'CONFIRMED',
        measurementDate: '2026-01-15',
        confidence: 'HIGH',
        attribution: 'Directly attributable to the procurement renegotiation workstream',
        evidenceRef: 'evidence-doc-1',
        measuredByActorId: actorId,
      });

      // The internal history row really landed — so the absence of its event
      // below proves deliberate silence, not a missing write.
      const historyRows = await readHistoryEventRowsForCase(caseId);
      expect(historyRows).toHaveLength(1);
      expect(historyRows[0].event_type).toBe('VALUE_MEASUREMENT_RECORDED');

      const measurementEvents = await readOutboxRowsForAggregate(measurement.measurementId);
      expect(measurementEvents).toHaveLength(1);
      const event = measurementEvents[0];
      expect(event.event_type).toBe('outcome.measurement_recorded');
      expect(event.aggregate_type).toBe('VALUE_MEASUREMENT');
      expect(event.aggregate_id).toBe(measurement.measurementId);
      // §3: case_workspace_value_measurements has no version column.
      expect(event.aggregate_version).toBeNull();
      expect(event.organization_id).toBe(orgId);
      expect(event.project_id).toBe(projectId);
      expect(event.case_id).toBe(caseId);
      expect(event.actor_user_id).toBe(actorId);
      expect(String(event.correlation_id ?? '').trim().length).toBeGreaterThan(0);
      expect(event.payload_ref).toBe(
        `case_workspace_value_measurements:${measurement.measurementId}`
      );
      expect(event.redacted_summary).toMatchObject({
        metricKey: 'cost-savings-pct',
        measurementStatus: 'CONFIRMED',
        confidence: 'HIGH',
        actualValue: 12.5,
        targetValue: 15,
      });

      // §5.6: NO `VALUE_MEASUREMENT_RECORDED` outbox row anywhere for this Case
      // — the emission lives only in the PUBLIC appendCaseHistoryEvent entry
      // point, never in the internal helper this command reuses.
      const historyTypedEvents = (await readOutboxRowsForCase(caseId)).filter(
        (row) => row.event_type === 'VALUE_MEASUREMENT_RECORDED'
      );
      expect(historyTypedEvents).toHaveLength(0);
    } finally {
      await teardown({
        orgIds: [orgId],
        projectIds: [projectId],
        caseIds: [caseId],
        userIds: [actorId],
      });
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 7. ROLLBACK / ATOMICITY — a failure forced AFTER the measurement INSERT,
  //    after the linked history INSERT and after publishEvent (deferred
  //    constraint trigger firing at COMMIT) leaves ZERO rows in all three
  //    tables. If publishEvent ever opened its own connection, the event would
  //    survive here.
  // -------------------------------------------------------------------------
  it('a failure forced at COMMIT time after recordValueMeasurement leaves zero measurement rows, zero history rows AND zero outbox rows', async () => {
    const { orgId, projectId, caseId, actorId } = await seedOrgProjectCase('outbox-rollback');
    try {
      await withCommitTimePoison(
        {
          table: 'case_workspace_value_measurements',
          matchColumn: 'case_id',
          matchValue: caseId,
          event: 'INSERT',
        },
        async () => {
          await expect(
            caseHistoryService.recordValueMeasurement({
              caseId,
              metricKey: 'rollback-metric',
              metricName: 'Rollback metric',
              actualValue: 1,
              measurementStatus: 'CONFIRMED',
              measurementDate: '2026-03-01',
              confidence: 'MEDIUM',
              attribution: 'poisoned transaction',
              evidenceRef: 'evidence-rollback',
              measuredByActorId: actorId,
            })
          ).rejects.toThrow(/forced_commit_time_failure_for_atomicity_test/);
        }
      );

      expect(await readValueMeasurementRowsForCase(caseId)).toHaveLength(0);
      expect(await readHistoryEventRowsForCase(caseId)).toHaveLength(0);
      expect(
        (await readOutboxRowsForCase(caseId)).filter(
          (row) => row.event_type === 'outcome.measurement_recorded'
        )
      ).toHaveLength(0);

      // The same command succeeds once the poison is gone — the rollback left
      // no partial state behind.
      const measurement = await caseHistoryService.recordValueMeasurement({
        caseId,
        metricKey: 'rollback-metric',
        metricName: 'Rollback metric',
        actualValue: 1,
        measurementStatus: 'CONFIRMED',
        measurementDate: '2026-03-01',
        confidence: 'MEDIUM',
        attribution: 'clean retry after rollback',
        evidenceRef: 'evidence-rollback',
        measuredByActorId: actorId,
      });
      expect(await readOutboxRowsForAggregate(measurement.measurementId)).toHaveLength(1);
    } finally {
      await teardown({
        orgIds: [orgId],
        projectIds: [projectId],
        caseIds: [caseId],
        userIds: [actorId],
      });
    }
  }, 30_000);
});

// ---------------------------------------------------------------------------
// 5. Structural append-only check — runs UNCONDITIONALLY (no DB needed).
// ---------------------------------------------------------------------------
describe('caseHistoryService — structural append-only guarantee (static source check)', () => {
  const serviceSourcePath = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'caseHistoryService.ts'
  );
  const serviceSource = readFileSync(serviceSourcePath, 'utf8');

  it('contains no UPDATE statement against case_workspace_history_events anywhere in the file', () => {
    expect(serviceSource).not.toMatch(/UPDATE\s+case_workspace_history_events/i);
  });

  it('contains no DELETE statement against case_workspace_history_events anywhere in the file', () => {
    expect(serviceSource).not.toMatch(/DELETE\s+FROM\s+case_workspace_history_events/i);
  });

  it('contains no UPDATE statement against case_workspace_value_measurements anywhere in the file', () => {
    expect(serviceSource).not.toMatch(/UPDATE\s+case_workspace_value_measurements/i);
  });

  it('contains no DELETE statement against case_workspace_value_measurements anywhere in the file', () => {
    expect(serviceSource).not.toMatch(/DELETE\s+FROM\s+case_workspace_value_measurements/i);
  });

  it('every INSERT against both tables uses ON CONFLICT ... DO NOTHING (never DO UPDATE), reinforcing that no write path silently becomes an update', () => {
    // Guards against a future edit swapping DO NOTHING for DO UPDATE, which
    // would turn the dedupe-key retry-safety mechanism into a covert update
    // path for either table.
    expect(serviceSource).not.toMatch(
      /INSERT INTO case_workspace_history_events[\s\S]*?ON CONFLICT[\s\S]*?DO UPDATE/i
    );
    expect(serviceSource).not.toMatch(
      /INSERT INTO case_workspace_value_measurements[\s\S]*?ON CONFLICT[\s\S]*?DO UPDATE/i
    );
  });
});
