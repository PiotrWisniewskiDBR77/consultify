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
 * ISOLATION — every test owns its own case_id (and, for value-measurement
 * tests, its own organization/project/case_core row)
 * ===========================================================================
 * `case_workspace_history_events.case_id` deliberately carries NO FK (see the
 * migration's header) — it exists purely to let this table log events about
 * ANY source, so the history-event tests below (1 and 2) use a plain,
 * uniquely-namespaced `randomUUID()`-suffixed string as case_id and never
 * create a real case_core row for them.
 *
 * `case_workspace_value_measurements.case_id` DOES carry a real FK into
 * `case_core(case_id)` (permitted per this packet's own task scope, unlike
 * the generic history log's FK-less case_id) — so the value-measurement
 * tests (3 and 4) bundle `seedOrgAndProject()` + `caseCoreService.createCase`
 * into `seedOrgProjectCase()`, exactly like casePlanVersionService.pg.test.ts
 * does for `case_plan_versions`. Every test seeds its own fixture inside the
 * test body (never a shared beforeEach) and tears it down itself in a
 * `finally`, so no test can observe, reset, or race another test's rows.
 *
 * All assertions read the actual `case_workspace_history_events`/
 * `case_workspace_value_measurements` rows back out of Postgres through a
 * dedicated, out-of-band `pg.Pool` (`control`) — never the service
 * function's return value alone — because the return value only proves what
 * the service THINKS it wrote, not what actually landed.
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

    return historyOk && valueOk;
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

  /**
   * A plain, uniquely-namespaced case_id string with NO backing case_core
   * row — legal for case_workspace_history_events because that table's
   * case_id deliberately carries no FK (see the migration's header).
   */
  function freshCaseId(label: string): string {
    return `case-hist-${label}-${randomUUID()}`;
  }

  /**
   * A fresh organization + project + real case_core row, exactly like
   * casePlanVersionService.pg.test.ts's seedOrgProjectCase() — required
   * because case_workspace_value_measurements.case_id DOES FK into
   * case_core(case_id).
   */
  async function seedOrgProjectCase(
    label: string
  ): Promise<{ orgId: string; projectId: string; caseId: string }> {
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
    const created = await caseCoreService.createCase({
      projectId,
      organizationId: orgId,
      contractedClosureType: 'DELIVERY_COMPLETED',
      createdByActorId: `actor-hist-${label}`,
    });
    return { orgId, projectId, caseId: created.caseId };
  }

  /** Teardown for the FK-less history-event-only tests (1 and 2). */
  async function teardownHistoryOnly(caseIds: string[]): Promise<void> {
    for (const caseId of caseIds) {
      await control
        .query(`DELETE FROM case_workspace_history_events WHERE case_id = $1`, [caseId])
        .catch(() => undefined);
    }
  }

  /**
   * Teardown for the value-measurement tests (3 and 4): measurements first
   * (FK into case_core, no ON DELETE CASCADE, so case_core cannot be deleted
   * while they exist), then the history events recordValueMeasurement()
   * appended (FK-less, so they never cascade off case_core), then case_core
   * itself, then projects/organizations.
   */
  async function teardownValueMeasurement(
    orgIds: string[],
    projectIds: string[],
    caseIds: string[]
  ): Promise<void> {
    for (const caseId of caseIds) {
      await control
        .query(`DELETE FROM case_workspace_value_measurements WHERE case_id = $1`, [caseId])
        .catch(() => undefined);
      await control
        .query(`DELETE FROM case_workspace_history_events WHERE case_id = $1`, [caseId])
        .catch(() => undefined);
    }
    for (const projectId of projectIds) {
      await control
        .query(`DELETE FROM case_core WHERE project_id = $1`, [projectId])
        .catch(() => undefined);
      await control.query(`DELETE FROM projects WHERE id = $1`, [projectId]).catch(() => undefined);
    }
    for (const orgId of orgIds) {
      await control.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => undefined);
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
    const caseId = freshCaseId('seq');
    try {
      const first = await caseHistoryService.appendCaseHistoryEvent({
        organizationId: 'org-seq',
        caseId,
        eventType: 'CASE_STATUS_CHANGED',
        actorId: 'actor-seq',
        occurredAt: new Date().toISOString(),
        summary: 'first event',
      });
      const second = await caseHistoryService.appendCaseHistoryEvent({
        organizationId: 'org-seq',
        caseId,
        eventType: 'GOVERNANCE_TIER_CHANGED',
        actorId: 'actor-seq',
        occurredAt: new Date().toISOString(),
        summary: 'second event',
      });
      const third = await caseHistoryService.appendCaseHistoryEvent({
        organizationId: 'org-seq',
        caseId,
        eventType: 'CLOSURE_RECORDED',
        actorId: 'actor-seq',
        occurredAt: new Date().toISOString(),
        summary: 'third event',
      });

      // Strictly increasing, in call order, from the returned values.
      expect(first.globalSeq).toBeLessThan(second.globalSeq);
      expect(second.globalSeq).toBeLessThan(third.globalSeq);

      // Read back through the service's own list method, in DB order.
      const listed = await caseHistoryService.listCaseHistoryEventsForCase(caseId);
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
      await teardownHistoryOnly([caseId]);
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 2. dedupe_key idempotency.
  // -------------------------------------------------------------------------
  it('appendCaseHistoryEvent called twice with the SAME dedupe_key is a no-op returning the original row; a different dedupe_key creates a second, distinct row', async () => {
    const caseId = freshCaseId('dedupe');
    const dedupeKeyA = `dedupe-a-${randomUUID()}`;
    const dedupeKeyB = `dedupe-b-${randomUUID()}`;
    try {
      const firstCall = await caseHistoryService.appendCaseHistoryEvent({
        organizationId: 'org-dedupe',
        caseId,
        eventType: 'CASE_STATUS_CHANGED',
        actorId: 'actor-dedupe',
        occurredAt: new Date().toISOString(),
        summary: 'dedupe test event A',
        dedupeKey: dedupeKeyA,
      });

      // Same dedupe_key, otherwise-identical call: must return the ORIGINAL
      // row unchanged (per the service's own documented idempotent-replay
      // contract), not throw and not create a second row.
      const secondCall = await caseHistoryService.appendCaseHistoryEvent({
        organizationId: 'org-dedupe',
        caseId,
        eventType: 'CASE_STATUS_CHANGED',
        actorId: 'actor-dedupe',
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
        organizationId: 'org-dedupe',
        caseId,
        eventType: 'CASE_STATUS_CHANGED',
        actorId: 'actor-dedupe',
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
      await teardownHistoryOnly([caseId]);
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 3. recordValueMeasurement — measurement row + linked history event,
  //    atomically; repeat calls append, never update.
  // -------------------------------------------------------------------------
  it('recordValueMeasurement creates a measurement row AND a linked history event in one call; calling it again for the same metric_key creates a SECOND measurement row, not an update', async () => {
    const { orgId, projectId, caseId } = await seedOrgProjectCase('record');
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
        measuredByActorId: 'actor-record-1',
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
        measuredByActorId: 'actor-record-2',
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
      await teardownValueMeasurement([orgId], [projectId], [caseId]);
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // 4. listValueMeasurementsForMetric — chronological series; 'sustained' is
  //    derivable from a later CONFIRMED row without touching the earlier one.
  // -------------------------------------------------------------------------
  it('listValueMeasurementsForMetric returns the series for one case+metric_key in chronological order, and computeMetricValueOutcomeState reads SUSTAINED from a later CONFIRMED row without needing to touch the earlier rows', async () => {
    const { orgId, projectId, caseId } = await seedOrgProjectCase('series');
    try {
      const partial = await caseHistoryService.recordValueMeasurement({
        caseId,
        metricKey: 'adoption-rate',
        metricName: 'Adoption rate',
        measurementStatus: 'PARTIAL',
        measurementDate: '2026-01-01',
        confidence: 'LOW',
        attribution: 'Early partial evidence from pilot cohort',
        measuredByActorId: 'actor-series-1',
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
        measuredByActorId: 'actor-series-2',
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
        measuredByActorId: 'actor-series-3',
      });

      const series = await caseHistoryService.listValueMeasurementsForMetric(caseId, 'adoption-rate');

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
      await teardownValueMeasurement([orgId], [projectId], [caseId]);
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
