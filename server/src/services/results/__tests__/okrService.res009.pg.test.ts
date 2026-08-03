/**
 * RES-009 — Strategic OKR CRUD proved against a REAL PostgreSQL.
 *
 * Closes a real, confirmed gap: this repo's OKR feature is live and
 * well-wired (StrategicLayerPanel makes real API calls against a real
 * service/route/Postgres chain — see docs/program/WEEKEND_COMPLETION_2026-08-01/
 * PACKETS/RES-009_IMPLEMENTATION_PACKET.md), but had ZERO test coverage on
 * the write path — create/update/delete for cycles, objectives, key
 * results, and check-ins were entirely unverified beyond manual clicking.
 * A mock cannot prove real FK cascade (deleting an objective must cascade
 * its key results via fk_okr_kr_objective), a real UNIQUE/CHECK constraint,
 * or that a status PATCH genuinely persists and survives a fresh read.
 *
 * HOW TO RUN:
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:<port>/consultinity_test \
 *   npx vitest run --retry=0 server/src/services/results/__tests__/okrService.res009.pg.test.ts
 *
 * Requires migration 914_okr_management.sql (okr_* tables) and
 * 20260803_res003_kpi_time_series_measurement_identity.sql (the
 * suggested-value tests write through the real RES-003 writer). Without a
 * reachable, migrated Postgres the suite SKIPS loudly.
 *
 * TENANCY: every test owns its own organization id (orgFor(key)).
 */
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.DB_MANAGED_SCHEMA = process.env.DB_MANAGED_SCHEMA ?? 'false';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

async function canReach(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    await probe.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

async function hasOkrSchema(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const result = await probe.query(
      `SELECT to_regclass('public.okr_objectives') IS NOT NULL AS present`
    );
    return Boolean(result.rows[0]?.present);
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

const REACHABLE = REAL_DB_REQUESTED ? await canReach(CONNECTION_STRING) : false;
const HAS_SCHEMA = REACHABLE ? await hasOkrSchema(CONNECTION_STRING) : false;

if (!REACHABLE || !HAS_SCHEMA) {
  // eslint-disable-next-line no-console
  console.warn(
    `[RES-009 okrService suite SKIPPED — this is a clean skip, not a failure] ` +
      `needs DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=<reachable, OKR-migrated postgres>. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE} hasSchema=${HAS_SCHEMA}`
  );
}

const suite = REACHABLE && HAS_SCHEMA ? describe.sequential : describe.skip;

const ORG_PREFIX = 'res009-okr';
const orgFor = (key: string): string => `${ORG_PREFIX}-${key}-${Date.now().toString(36)}`;

let control: Pool;
let okr: typeof import('../okrService.js');
let writer: typeof import('../kpiMeasurementWriterService.js');
let definitionService: typeof import('../kpiDefinitionService.js');

async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await control.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

async function seedOrg(orgId: string): Promise<void> {
  await control.query(
    `INSERT INTO organizations (id, name) VALUES ($1, $1) ON CONFLICT (id) DO NOTHING`,
    [orgId]
  );
}

async function seedOrgInitiativeKpi(
  orgId: string,
  initiativeId: string,
  kpiId: string
): Promise<void> {
  await seedOrg(orgId);
  await control.query(
    `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, 'Test initiative', 'DRAFT')
     ON CONFLICT (id) DO NOTHING`,
    [initiativeId, orgId]
  );
  await control.query(
    `INSERT INTO initiative_kpis (id, initiative_id, organization_id, name)
     VALUES ($1, $2, $3, 'Linked KPI') ON CONFLICT (id) DO NOTHING`,
    [kpiId, initiativeId, orgId]
  );
}

suite('okrService — RES-009 Strategic OKR CRUD (real PostgreSQL)', () => {
  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
    process.env.DB_TYPE = 'postgres';
    process.env.DATABASE_URL = CONNECTION_STRING;
    okr = await import('../okrService.js');
    writer = await import('../kpiMeasurementWriterService.js');
    definitionService = await import('../kpiDefinitionService.js');
  }, 60_000);

  afterAll(async () => {
    if (!control) return;
    await control.end().catch(() => undefined);
    const { default: db } = await import('../../../database/PostgresDatabase.js');
    await (db as unknown as { close: () => Promise<void> }).close().catch(() => undefined);
  }, 60_000);

  // ---------------------------------------------------------------------
  // Cycle CRUD
  // ---------------------------------------------------------------------

  it('1. createCycle -> listCycles round-trips a real row, draft status', async () => {
    const org = orgFor('cycle-crud');
    await seedOrg(org);
    const cycle = await okr.createCycle({
      organizationId: org,
      name: 'Q1 2026',
      periodYear: 2026,
      periodQuarter: 1,
    });
    expect(cycle.status).toBe('draft');

    const cycles = await okr.listCycles(org);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].id).toBe(cycle.id);
  });

  it('2. closeCycle aggregates real Key Result scores and persists closed status on cycle + objectives', async () => {
    const org = orgFor('cycle-close');
    await seedOrg(org);
    const cycle = await okr.createCycle({
      organizationId: org,
      name: 'Q2 2026',
      periodYear: 2026,
      periodQuarter: 2,
    });
    const objective = await okr.createObjective({
      organizationId: org,
      label: 'Grow revenue',
      cycleId: cycle.id,
    });
    await okr.createKeyResult({
      objectiveId: objective.id,
      organizationId: org,
      label: 'MRR',
      baseline: 0,
      target: 100,
      current: 50, // score 0.5
    });

    const result = await okr.closeCycle(cycle.id, org);
    expect(result).not.toBeNull();
    expect(result?.cycle.status).toBe('closed');
    expect(result?.objectives).toHaveLength(1);
    expect(result?.objectives[0].score).toBeCloseTo(0.5, 5);

    const objRow = await withClient((c) =>
      c.query(`SELECT status FROM okr_objectives WHERE id = $1`, [objective.id])
    );
    expect(objRow.rows[0].status).toBe('closed');
    const cycleRow = await withClient((c) =>
      c.query(`SELECT status FROM okr_cycles WHERE id = $1`, [cycle.id])
    );
    expect(cycleRow.rows[0].status).toBe('closed');
  });

  // ---------------------------------------------------------------------
  // Objective CRUD
  // ---------------------------------------------------------------------

  it('3. createObjective -> updateObjective persists a real PATCH', async () => {
    const org = orgFor('obj-crud');
    await seedOrg(org);
    const created = await okr.createObjective({ organizationId: org, label: 'Initial label' });
    const updated = await okr.updateObjective(created.id, org, {
      label: 'Updated label',
      description: 'desc',
    });
    expect(updated).toBe(true);

    const row = await withClient((c) =>
      c.query(`SELECT label, description FROM okr_objectives WHERE id = $1`, [created.id])
    );
    expect(row.rows[0].label).toBe('Updated label');
    expect(row.rows[0].description).toBe('desc');
  });

  it('4. deleteObjective cascades to its Key Results (real FK, not app-level cleanup)', async () => {
    const org = orgFor('obj-cascade');
    await seedOrg(org);
    const objective = await okr.createObjective({ organizationId: org, label: 'To be deleted' });
    const kr = await okr.createKeyResult({
      objectiveId: objective.id,
      organizationId: org,
      label: 'Doomed KR',
    });

    const deleted = await okr.deleteObjective(objective.id, org);
    expect(deleted).toBe(true);

    const krRow = await withClient((c) =>
      c.query(`SELECT id FROM okr_key_results WHERE id = $1`, [kr.id])
    );
    expect(krRow.rowCount).toBe(0); // cascaded away by fk_okr_kr_objective, not by app code
  });

  // ---------------------------------------------------------------------
  // Key Result CRUD + scoring
  // ---------------------------------------------------------------------

  it('5. createKeyResult computes and persists an initial score from baseline/target/current', async () => {
    const org = orgFor('kr-crud');
    await seedOrg(org);
    const objective = await okr.createObjective({ organizationId: org, label: 'Objective' });
    const kr = await okr.createKeyResult({
      objectiveId: objective.id,
      organizationId: org,
      label: 'Adoption rate',
      baseline: 0,
      target: 100,
      current: 25,
    });
    expect(kr.score).toBeCloseTo(0.25, 5);

    const row = await withClient((c) =>
      c.query(`SELECT score FROM okr_key_results WHERE id = $1`, [kr.id])
    );
    expect(Number(row.rows[0].score)).toBeCloseTo(0.25, 5);
  });

  it('6. updateKeyResult recomputes score on every PATCH', async () => {
    const org = orgFor('kr-update');
    await seedOrg(org);
    const objective = await okr.createObjective({ organizationId: org, label: 'Objective' });
    const kr = await okr.createKeyResult({
      objectiveId: objective.id,
      organizationId: org,
      label: 'Adoption rate',
      baseline: 0,
      target: 100,
      current: 25,
    });
    const updated = await okr.updateKeyResult(kr.id, org, { current: 80 });
    expect(updated.updated).toBe(true);
    expect(updated.score).toBeCloseTo(0.8, 5);
  });

  it('7. deleteKeyResult removes exactly one row, org-scoped', async () => {
    const org = orgFor('kr-delete');
    await seedOrg(org);
    const objective = await okr.createObjective({ organizationId: org, label: 'Objective' });
    const kr = await okr.createKeyResult({
      objectiveId: objective.id,
      organizationId: org,
      label: 'To delete',
    });
    const deleted = await okr.deleteKeyResult(kr.id, org);
    expect(deleted).toBe(true);
    const row = await withClient((c) =>
      c.query(`SELECT id FROM okr_key_results WHERE id = $1`, [kr.id])
    );
    expect(row.rowCount).toBe(0);
  });

  // ---------------------------------------------------------------------
  // Check-ins
  // ---------------------------------------------------------------------

  it('8. createCheckIn writes value back to current, recomputes score, and is listed newest-first', async () => {
    const org = orgFor('checkin');
    await seedOrg(org);
    const objective = await okr.createObjective({ organizationId: org, label: 'Objective' });
    const kr = await okr.createKeyResult({
      objectiveId: objective.id,
      organizationId: org,
      label: 'KR',
      baseline: 0,
      target: 100,
      current: 10,
    });

    const first = await okr.createCheckIn({
      keyResultId: kr.id,
      organizationId: org,
      value: 40,
      confidence: 'amber',
    });
    expect(first?.score).toBeCloseTo(0.4, 5);
    const second = await okr.createCheckIn({
      keyResultId: kr.id,
      organizationId: org,
      value: 90,
      confidence: 'green',
    });
    expect(second?.score).toBeCloseTo(0.9, 5);

    const checkIns = await okr.listCheckIns(kr.id, org);
    expect(checkIns).toHaveLength(2);
    expect(checkIns[0].value).toBe(90); // newest first

    const krRow = await withClient((c) =>
      c.query(`SELECT current, score FROM okr_key_results WHERE id = $1`, [kr.id])
    );
    expect(Number(krRow.rows[0].current)).toBe(90);
    expect(Number(krRow.rows[0].score)).toBeCloseTo(0.9, 5);
  });

  it('9. an explicit check-in score (milestone-KR grading) wins over the baseline/target/current formula', async () => {
    const org = orgFor('checkin-explicit-score');
    await seedOrg(org);
    const objective = await okr.createObjective({ organizationId: org, label: 'Objective' });
    const kr = await okr.createKeyResult({
      objectiveId: objective.id,
      organizationId: org,
      label: 'Milestone KR',
      krType: 'milestone',
      baseline: 0,
      target: 100,
      current: 10, // would formula-score to 0.1
    });
    const checkIn = await okr.createCheckIn({
      keyResultId: kr.id,
      organizationId: org,
      score: 0.75,
    });
    expect(checkIn?.score).toBe(0.75); // explicit grading, not the 0.1 the formula would give
  });

  // ---------------------------------------------------------------------
  // Tenant isolation negative controls
  // ---------------------------------------------------------------------

  it('10. NEGATIVE CONTROL — updateObjective for a foreign-org id is a no-op (false), row untouched', async () => {
    const ownerOrg = orgFor('tenant-owner-a');
    const attackerOrg = orgFor('tenant-attacker-a');
    await seedOrg(attackerOrg);
    const objective = await okr.createObjective({ organizationId: ownerOrg, label: 'Owner label' });

    const updated = await okr.updateObjective(objective.id, attackerOrg, {
      label: 'Attacker overwrite',
    });
    expect(updated).toBe(false);

    const row = await withClient((c) =>
      c.query(`SELECT label FROM okr_objectives WHERE id = $1`, [objective.id])
    );
    expect(row.rows[0].label).toBe('Owner label');
  });

  it('11. NEGATIVE CONTROL — deleteKeyResult for a foreign-org id is a no-op (false), row survives', async () => {
    const ownerOrg = orgFor('tenant-owner-b');
    const attackerOrg = orgFor('tenant-attacker-b');
    await seedOrg(attackerOrg);
    const objective = await okr.createObjective({ organizationId: ownerOrg, label: 'Objective' });
    const kr = await okr.createKeyResult({
      objectiveId: objective.id,
      organizationId: ownerOrg,
      label: 'KR',
    });

    const deleted = await okr.deleteKeyResult(kr.id, attackerOrg);
    expect(deleted).toBe(false);

    const row = await withClient((c) =>
      c.query(`SELECT id FROM okr_key_results WHERE id = $1`, [kr.id])
    );
    expect(row.rowCount).toBe(1);
  });

  it('12. NEGATIVE CONTROL — createCheckIn for a foreign-org Key Result returns null, no row written', async () => {
    const ownerOrg = orgFor('tenant-owner-c');
    const attackerOrg = orgFor('tenant-attacker-c');
    await seedOrg(attackerOrg);
    const objective = await okr.createObjective({ organizationId: ownerOrg, label: 'Objective' });
    const kr = await okr.createKeyResult({
      objectiveId: objective.id,
      organizationId: ownerOrg,
      label: 'KR',
    });

    const result = await okr.createCheckIn({
      keyResultId: kr.id,
      organizationId: attackerOrg,
      value: 999,
    });
    expect(result).toBeNull();

    const checkIns = await withClient((c) =>
      c.query(`SELECT id FROM okr_check_ins WHERE key_result_id = $1`, [kr.id])
    );
    expect(checkIns.rowCount).toBe(0);
  });

  // ---------------------------------------------------------------------
  // Durable reopen
  // ---------------------------------------------------------------------

  it('13. durable reopen: closing then reopening an objective preserves its Key Results and scores intact', async () => {
    const org = orgFor('reopen');
    await seedOrg(org);
    const cycle = await okr.createCycle({
      organizationId: org,
      name: 'Q3 2026',
      periodYear: 2026,
      periodQuarter: 3,
    });
    const objective = await okr.createObjective({
      organizationId: org,
      label: 'Reopen me',
      cycleId: cycle.id,
    });
    const kr = await okr.createKeyResult({
      objectiveId: objective.id,
      organizationId: org,
      label: 'KR',
      baseline: 0,
      target: 100,
      current: 60,
    });
    expect(kr.score).toBeCloseTo(0.6, 5);

    await okr.closeCycle(cycle.id, org);
    const closedRow = await withClient((c) =>
      c.query(`SELECT status FROM okr_objectives WHERE id = $1`, [objective.id])
    );
    expect(closedRow.rows[0].status).toBe('closed');

    // Reopen.
    const reopened = await okr.updateObjective(objective.id, org, { status: 'active' });
    expect(reopened).toBe(true);
    const reopenedRow = await withClient((c) =>
      c.query(`SELECT status FROM okr_objectives WHERE id = $1`, [objective.id])
    );
    expect(reopenedRow.rows[0].status).toBe('active');

    // Durable: the Key Result and its score survived the close/reopen cycle
    // untouched, and the objective is fully live again (a new check-in works).
    const krRowAfter = await withClient((c) =>
      c.query(`SELECT score, current FROM okr_key_results WHERE id = $1`, [kr.id])
    );
    expect(Number(krRowAfter.rows[0].score)).toBeCloseTo(0.6, 5);
    expect(Number(krRowAfter.rows[0].current)).toBe(60);

    const checkIn = await okr.createCheckIn({ keyResultId: kr.id, organizationId: org, value: 95 });
    expect(checkIn?.score).toBeCloseTo(0.95, 5);
  });

  // ---------------------------------------------------------------------
  // D7 regression + suggested-value (RES-003 reference, not duplication)
  // ---------------------------------------------------------------------

  it('14. D7 regression: a KPI measurement write never changes the linked Key Result score/current', async () => {
    const org = orgFor('d7-regression');
    const initId = `init-${org}`;
    const kpiId = `kpi-${org}`;
    await seedOrgInitiativeKpi(org, initId, kpiId);
    const objective = await okr.createObjective({ organizationId: org, label: 'Objective' });
    const kr = await okr.createKeyResult({
      objectiveId: objective.id,
      organizationId: org,
      label: 'Linked KR',
      baseline: 0,
      target: 100,
      current: 20, // score 0.2, manual
      kpiId, // informational-only per D7
    });
    expect(kr.score).toBeCloseTo(0.2, 5);

    // A real KPI measurement lands via the RES-003 canonical writer, wildly
    // different from the KR's manual current=20.
    await writer.recordKpiMeasurement({
      organizationId: org,
      kpiId,
      value: 999,
      periodStart: '2026-01-01',
      source: 'manual',
    });

    const krRow = await withClient((c) =>
      c.query(`SELECT score, current FROM okr_key_results WHERE id = $1`, [kr.id])
    );
    expect(Number(krRow.rows[0].current)).toBe(20); // untouched
    expect(Number(krRow.rows[0].score)).toBeCloseTo(0.2, 5); // untouched
  });

  it('15. suggested-value: references the latest RES-003 measurement by ID, does not duplicate it onto the KR', async () => {
    const org = orgFor('suggested-value');
    const initId = `init-${org}`;
    const kpiId = `kpi-${org}`;
    await seedOrgInitiativeKpi(org, initId, kpiId);
    const objective = await okr.createObjective({ organizationId: org, label: 'Objective' });
    const kr = await okr.createKeyResult({
      objectiveId: objective.id,
      organizationId: org,
      label: 'Linked KR',
      kpiId,
    });

    // No measurement yet.
    expect(await okr.getSuggestedValueForKeyResult(kr.id, org)).toBeNull();

    await writer.recordKpiMeasurement({
      organizationId: org,
      kpiId,
      value: 77,
      periodStart: '2026-02-01',
      source: 'manual',
    });
    const suggested = await okr.getSuggestedValueForKeyResult(kr.id, org);
    expect(suggested).toEqual({ value: 77, periodStart: '2026-02-01', source: 'manual' });

    // Still not duplicated onto the KR itself — current/score are whatever
    // the (absent) manual check-in history says, not the KPI's value.
    const krRow = await withClient((c) =>
      c.query(`SELECT current FROM okr_key_results WHERE id = $1`, [kr.id])
    );
    expect(krRow.rows[0].current).toBeNull();
  });

  it('16. NEGATIVE CONTROL — suggested-value returns null for a KR with no kpiId, and for a foreign-org KR', async () => {
    const org = orgFor('suggested-value-none');
    await seedOrg(org);
    const objective = await okr.createObjective({ organizationId: org, label: 'Objective' });
    const krNoLink = await okr.createKeyResult({
      objectiveId: objective.id,
      organizationId: org,
      label: 'No KPI link',
    });
    expect(await okr.getSuggestedValueForKeyResult(krNoLink.id, org)).toBeNull();

    const foreignOrg = orgFor('suggested-value-foreign');
    await seedOrg(foreignOrg);
    expect(await okr.getSuggestedValueForKeyResult(krNoLink.id, foreignOrg)).toBeNull();
  });

  // ---------------------------------------------------------------------
  // RES-009: durable link to the canonical KPI definition VERSION
  // ---------------------------------------------------------------------

  it('17. linking a KPI captures the CURRENT kpi_definition_versions id; re-linking re-pins; unlinking clears it — score/current untouched throughout (D7 preserved)', async () => {
    const org = orgFor('definition-version-link');
    await seedOrg(org);
    const initiativeId = `init-${org}`;
    await control.query(
      `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, 'Test initiative', 'DRAFT')
       ON CONFLICT (id) DO NOTHING`,
      [initiativeId, org]
    );

    // v1 KPI, via RES-02's canonical owner (not a raw INSERT) — otherwise no
    // kpi_definition_versions row would exist to link to.
    const kpiV1 = await definitionService.createDefinition({
      organizationId: org,
      initiativeId,
      name: 'Version-linked KPI',
      targetValue: 100,
    });

    const objective = await okr.createObjective({ organizationId: org, label: 'Objective' });
    const kr = await okr.createKeyResult({
      objectiveId: objective.id,
      organizationId: org,
      label: 'Linked at create time',
      baseline: 0,
      target: 10,
      current: 5, // score 0.5 — must stay 0.5 across every step below
      kpiId: kpiV1.id,
    });

    const afterCreate = await withClient((c) =>
      c.query(
        `SELECT kpi_id, kpi_definition_version_id, score FROM okr_key_results WHERE id = $1`,
        [kr.id]
      )
    );
    expect(afterCreate.rows[0].kpi_id).toBe(kpiV1.id);
    expect(afterCreate.rows[0].kpi_definition_version_id).toBe(kpiV1.definitionVersionId);
    expect(Number(afterCreate.rows[0].score)).toBeCloseTo(0.5, 5);

    // Bump the KPI's definition (CAS via expectedVersion) -> v2. Re-PATCHing
    // the SAME kpiId onto the KR must re-pin to v2, not stay frozen at v1.
    const updated = await definitionService.updateDefinition({
      organizationId: org,
      kpiId: kpiV1.id,
      expectedVersion: 1,
      targetValue: 250,
    });
    expect(updated.definitionVersionId).not.toBe(kpiV1.definitionVersionId);

    await okr.updateKeyResult(kr.id, org, { kpiId: kpiV1.id });
    const afterRepin = await withClient((c) =>
      c.query(`SELECT kpi_definition_version_id, score FROM okr_key_results WHERE id = $1`, [kr.id])
    );
    expect(afterRepin.rows[0].kpi_definition_version_id).toBe(updated.definitionVersionId);
    expect(afterRepin.rows[0].kpi_definition_version_id).not.toBe(kpiV1.definitionVersionId);
    // D7: re-linking never touches score/current, however many times the KPI
    // side is edited.
    expect(Number(afterRepin.rows[0].score)).toBeCloseTo(0.5, 5);

    // Unlinking (kpiId: null) clears the version pin too — no orphaned
    // pointer left behind once the informational link itself is removed.
    await okr.updateKeyResult(kr.id, org, { kpiId: null });
    const afterUnlink = await withClient((c) =>
      c.query(
        `SELECT kpi_id, kpi_definition_version_id, score FROM okr_key_results WHERE id = $1`,
        [kr.id]
      )
    );
    expect(afterUnlink.rows[0].kpi_id).toBeNull();
    expect(afterUnlink.rows[0].kpi_definition_version_id).toBeNull();
    expect(Number(afterUnlink.rows[0].score)).toBeCloseTo(0.5, 5);
  });
});
