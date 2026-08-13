/**
 * RN-G5 — Results Next command-layer authorization, real-Postgres security
 * suite.
 *
 * Design: docs/product/results-vnext/RN_G5_AUTHZ_DESIGN.md.
 *
 * Problem this proves fixed: before this pakiet, no write command under
 * `server/src/services/resultsVnext/**` checked the caller's authorization
 * — any authenticated org member could approve someone else's KPI
 * corrective plan, or verify/dispute/correct any measurement. This suite
 * exercises the REAL public path — the actual command functions
 * (`kpiDeviationCommands.ts`/`kpiMeasurementCommands.ts`), with a REAL
 * `resolveEffectiveAccess()` resolution against REAL `organization_members`
 * rows (not a hand-rolled fake `access` object) — against a real ephemeral
 * Postgres. No `SELECT` is ever used to PERFORM the action under test, only
 * to assert the resulting row state afterward.
 *
 * Everything here needs RUN_DB_TESTS=1 + NODE_ENV=test + MOCK_DB=false + a
 * reachable DATABASE_URL (see the repo's RN-G5 task brief for the exact
 * commands) — if no DB is configured, `beforeAll` logs and every `itDB`
 * is skipped; a skipped run is NOT evidence (do not report it as "passing").
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

function buildClientConfig(): ClientConfig | null {
  const raw = process.env.DATABASE_URL;
  const url = typeof raw === 'string' && raw.trim() && !raw.includes('${{') ? raw.trim() : null;
  if (url) {
    return { connectionString: url, connectionTimeoutMillis: 5_000, statement_timeout: 30_000 };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  };
}

const DB_CONFIGURED = buildClientConfig() !== null;
const itDB = DB_CONFIGURED ? it : it.skip;

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `rn-g5-org-${tag}`;
const FOREIGN_ORG_ID = `rn-g5-foreign-org-${tag}`;

// Real, distinct actors — every one gets a real `organization_members` row
// (or none, for the cross-org case) so `resolveEffectiveAccess` resolves a
// REAL role from the database, not a fixture-supplied shortcut.
const STRANGER_ID = `rn-g5-stranger-${tag}`; // MEMBER role, no relationship to any fixture record
const OWNER_ID = `rn-g5-owner-${tag}`; // MEMBER role, but IS the record's owner_user_id
const MANAGER_ID = `rn-g5-manager-${tag}`; // MEMBER role, IS the record's manager_user_id
const ADMIN_ID = `rn-g5-admin-${tag}`; // ADMIN role — passes via '*'
const MAKER_ID = `rn-g5-maker-${tag}`; // MEMBER role, submits plans (self-approval maker)
const FOREIGN_ID = `rn-g5-foreign-${tag}`; // MEMBER role, but in FOREIGN_ORG_ID

let client: Client;
let reachable = false;

type DeviationModule = typeof import('../../../server/src/services/resultsVnext/kpi/kpiDeviationCommands.js');
type MeasurementModule = typeof import('../../../server/src/services/resultsVnext/kpi/kpiMeasurementCommands.js');
type AtomicWriteModule = typeof import('../../../server/src/services/resultsVnext/platform/atomicWrite.js');
type GuardModule = typeof import('../../../server/src/services/resultsVnext/platform/commandCapabilityGuard.js');
type AccessModule = typeof import('../../../server/src/services/effectiveAccessService.js');

let acknowledgeDeviationCase: DeviationModule['acknowledgeDeviationCase'];
let approvePlan: DeviationModule['approvePlan'];
let submitPlan: DeviationModule['submitPlan'];
let DeviationSelfApprovalDeniedError: DeviationModule['DeviationSelfApprovalDeniedError'];
let verifyMeasurement: MeasurementModule['verifyMeasurement'];
let disputeMeasurement: MeasurementModule['disputeMeasurement'];
let correctMeasurement: MeasurementModule['correctMeasurement'];
let AtomicWriteAggregateNotFoundError: AtomicWriteModule['AtomicWriteAggregateNotFoundError'];
let CommandCapabilityDeniedError: GuardModule['CommandCapabilityDeniedError'];
let resolveEffectiveAccess: AccessModule['resolveEffectiveAccess'];
let closePgPool: (() => Promise<void>) | undefined;

beforeAll(async () => {
  if (!DB_CONFIGURED) {
    // eslint-disable-next-line no-console
    console.error(
      '[skip] No Postgres configured — RN-G5 command-capability-guard security tests did NOT run. This run is not evidence.'
    );
    return;
  }

  client = new Client(buildClientConfig() as ClientConfig);
  await client.connect();
  await client.query('SELECT 1');
  await client.query('SELECT 1 FROM rvn_kpi_definitions LIMIT 0');
  await client.query('SELECT 1 FROM rvn_kpi_deviation_cases LIMIT 0');
  await client.query('SELECT 1 FROM organization_members LIMIT 0');
  reachable = true;

  const deviationModule: DeviationModule = await import(
    '../../../server/src/services/resultsVnext/kpi/kpiDeviationCommands.js'
  );
  acknowledgeDeviationCase = deviationModule.acknowledgeDeviationCase;
  approvePlan = deviationModule.approvePlan;
  submitPlan = deviationModule.submitPlan;
  DeviationSelfApprovalDeniedError = deviationModule.DeviationSelfApprovalDeniedError;

  const measurementModule: MeasurementModule = await import(
    '../../../server/src/services/resultsVnext/kpi/kpiMeasurementCommands.js'
  );
  verifyMeasurement = measurementModule.verifyMeasurement;
  disputeMeasurement = measurementModule.disputeMeasurement;
  correctMeasurement = measurementModule.correctMeasurement;

  const atomicWriteModule: AtomicWriteModule = await import(
    '../../../server/src/services/resultsVnext/platform/atomicWrite.js'
  );
  AtomicWriteAggregateNotFoundError = atomicWriteModule.AtomicWriteAggregateNotFoundError;

  const guardModule: GuardModule = await import(
    '../../../server/src/services/resultsVnext/platform/commandCapabilityGuard.js'
  );
  CommandCapabilityDeniedError = guardModule.CommandCapabilityDeniedError;

  const accessModule: AccessModule = await import('../../../server/src/services/effectiveAccessService.js');
  resolveEffectiveAccess = accessModule.resolveEffectiveAccess;

  const pgModule = await import('../../../server/src/database/PostgresDatabase.js');
  closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

  // ---------- Real org/user/organization_members fixture ----------
  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'RN-G5 Org', 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [ORG_ID]
  );
  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'RN-G5 Foreign Org', 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [FOREIGN_ORG_ID]
  );

  for (const [userId, orgId] of [
    [STRANGER_ID, ORG_ID],
    [OWNER_ID, ORG_ID],
    [MANAGER_ID, ORG_ID],
    [ADMIN_ID, ORG_ID],
    [MAKER_ID, ORG_ID],
    [FOREIGN_ID, FOREIGN_ORG_ID],
  ] as const) {
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
       VALUES ($1, $2, $3, 'x', 'CONSULTANT', 'active', 'RNG5', 'Test')
       ON CONFLICT (id) DO NOTHING`,
      [userId, orgId, `${userId}@local.test`]
    );
  }

  const membershipRows: Array<[string, string, string, string]> = [
    [`om-stranger-${tag}`, ORG_ID, STRANGER_ID, 'MEMBER'],
    [`om-owner-${tag}`, ORG_ID, OWNER_ID, 'MEMBER'],
    [`om-manager-${tag}`, ORG_ID, MANAGER_ID, 'MEMBER'],
    [`om-admin-${tag}`, ORG_ID, ADMIN_ID, 'ADMIN'],
    [`om-maker-${tag}`, ORG_ID, MAKER_ID, 'MEMBER'],
    [`om-foreign-${tag}`, FOREIGN_ORG_ID, FOREIGN_ID, 'MEMBER'],
  ];
  for (const [id, orgId, userId, role] of membershipRows) {
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE') ON CONFLICT (organization_id, user_id) DO NOTHING`,
      [id, orgId, userId, role]
    );
  }
}, 30_000);

afterAll(async () => {
  if (!reachable) return;
  // rvn_platform_outbox.event_id FKs to rvn_platform_events.event_id —
  // must delete the child rows first.
  await client.query(
    `DELETE FROM rvn_platform_outbox WHERE event_id IN (
       SELECT event_id FROM rvn_platform_events WHERE organization_id = ANY($1::text[])
     )`,
    [[ORG_ID, FOREIGN_ORG_ID]]
  );
  await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = ANY($1::text[])`, [
    [ORG_ID, FOREIGN_ORG_ID],
  ]);
  await client.query(`DELETE FROM rvn_kpi_deviation_cases WHERE organization_id = ANY($1::text[])`, [
    [ORG_ID, FOREIGN_ORG_ID],
  ]);
  await client.query(`DELETE FROM rvn_kpi_measurements WHERE organization_id = ANY($1::text[])`, [
    [ORG_ID, FOREIGN_ORG_ID],
  ]);
  // rvn_kpi_definitions.current_definition_version_id FKs to
  // rvn_kpi_definition_versions — null it out before deleting either side.
  await client.query(
    `UPDATE rvn_kpi_definitions SET current_definition_version_id = NULL WHERE organization_id = ANY($1::text[])`,
    [[ORG_ID, FOREIGN_ORG_ID]]
  );
  await client.query(`DELETE FROM rvn_kpi_definition_versions WHERE organization_id = ANY($1::text[])`, [
    [ORG_ID, FOREIGN_ORG_ID],
  ]);
  await client.query(`DELETE FROM rvn_kpi_definitions WHERE organization_id = ANY($1::text[])`, [
    [ORG_ID, FOREIGN_ORG_ID],
  ]);
  await client.query(`DELETE FROM organization_members WHERE organization_id = ANY($1::text[])`, [
    [ORG_ID, FOREIGN_ORG_ID],
  ]);
  await client.query(`DELETE FROM users WHERE organization_id = ANY($1::text[])`, [[ORG_ID, FOREIGN_ORG_ID]]);
  await client.query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [[ORG_ID, FOREIGN_ORG_ID]]);
  await client.end();
  if (closePgPool) await closePgPool();
}, 30_000);

/** Real access resolution — every scenario below goes through the SAME
 * `resolveEffectiveAccess` the HTTP routes call, against the REAL
 * `organization_members` rows seeded in `beforeAll`. Never a hand-built
 * fake access object. */
async function realAccessFor(userId: string, organizationId: string) {
  return resolveEffectiveAccess({ userId, organizationId });
}

async function insertKpiAndCase(params: {
  kpiId: string;
  versionId: string;
  measurementId: string;
  caseId: string;
  ownerUserId: string;
  managerUserId: string | null;
  caseStatus: string;
  planSubmittedBy?: string | null;
  caseCreatedBy?: string;
}): Promise<void> {
  const {
    kpiId,
    versionId,
    measurementId,
    caseId,
    ownerUserId,
    managerUserId,
    caseStatus,
    planSubmittedBy = null,
    caseCreatedBy = ownerUserId,
  } = params;
  await client.query(
    `INSERT INTO rvn_kpi_definitions (kpi_id, organization_id, kpi_code, status, owner_user_id, created_by)
     VALUES ($1, $2, $3, 'active', $4, $4)`,
    [kpiId, ORG_ID, `KPI-${kpiId.slice(-8)}`, ownerUserId]
  );
  await client.query(
    `INSERT INTO rvn_kpi_definition_versions
       (definition_version_id, kpi_id, organization_id, version_number, name, unit, target_geometry,
        target_min, approval_status, created_by, effective_from)
     VALUES ($1, $2, $3, 1, 'RN-G5 fixture KPI', 'unit', 'threshold_min', 100, 'approved', $4, now())`,
    [versionId, kpiId, ORG_ID, ownerUserId]
  );
  await client.query(`UPDATE rvn_kpi_definitions SET current_definition_version_id = $1 WHERE kpi_id = $2`, [
    versionId,
    kpiId,
  ]);
  await client.query(
    `INSERT INTO rvn_kpi_measurements
       (measurement_id, kpi_id, definition_version_id, organization_id, period_start, period_end,
        actual_value, performance_status, source, recorded_by)
     VALUES ($1, $2, $3, $4, '2026-03-01T00:00:00.000Z', '2026-03-31T00:00:00.000Z', 10, 'critical', 'manual', $5)`,
    [measurementId, kpiId, versionId, ORG_ID, ownerUserId]
  );
  await client.query(
    `INSERT INTO rvn_kpi_deviation_cases
       (case_id, organization_id, kpi_id, trigger_measurement_id, severity, status,
        owner_user_id, manager_user_id, created_by, plan_submitted_by)
     VALUES ($1, $2, $3, $4, 'critical', $5, $6, $7, $8, $9)`,
    [caseId, ORG_ID, kpiId, measurementId, caseStatus, ownerUserId, managerUserId, caseCreatedBy, planSubmittedBy]
  );
}

async function loadCase(caseId: string) {
  const result = await client.query<{
    status: string;
    row_version: number;
    plan_approved_by: string | null;
    organization_id: string;
  }>(`SELECT status, row_version, plan_approved_by, organization_id FROM rvn_kpi_deviation_cases WHERE case_id = $1`, [
    caseId,
  ]);
  return result.rows[0];
}

async function loadMeasurement(measurementId: string) {
  const result = await client.query<{ data_quality_status: string; organization_id: string }>(
    `SELECT data_quality_status, organization_id FROM rvn_kpi_measurements WHERE measurement_id = $1`,
    [measurementId]
  );
  return result.rows[0];
}

describe('RN-G5 — command-capability guard, real Postgres', () => {
  describe('approvePlan (results.kpi.deviation.approve_plan)', () => {
    itDB('an unrelated org member gets 403 and the case is NOT mutated', async () => {
      const caseId = randomUUID();
      await insertKpiAndCase({
        kpiId: randomUUID(),
        versionId: randomUUID(),
        measurementId: randomUUID(),
        caseId,
        ownerUserId: OWNER_ID,
        managerUserId: MANAGER_ID,
        caseStatus: 'plan_submitted',
        planSubmittedBy: MAKER_ID,
        caseCreatedBy: MAKER_ID,
      });
      const before = await loadCase(caseId);

      const access = await realAccessFor(STRANGER_ID, ORG_ID);
      await expect(
        approvePlan({
          caseId,
          organizationId: ORG_ID,
          expectedVersion: 1,
          approverId: STRANGER_ID,
          actorEffectiveRole: 'member',
          idempotencyKey: `deny-${randomUUID()}`,
          access,
        })
      ).rejects.toBeInstanceOf(CommandCapabilityDeniedError);

      const after = await loadCase(caseId);
      expect(after.status).toBe(before.status);
      expect(after.row_version).toBe(before.row_version);
      expect(after.plan_approved_by).toBeNull();
    });

    itDB('the denial message is generic — no case id, owner id, or capability-holder identity leaked', async () => {
      const caseId = randomUUID();
      await insertKpiAndCase({
        kpiId: randomUUID(),
        versionId: randomUUID(),
        measurementId: randomUUID(),
        caseId,
        ownerUserId: OWNER_ID,
        managerUserId: MANAGER_ID,
        caseStatus: 'plan_submitted',
        planSubmittedBy: MAKER_ID,
        caseCreatedBy: MAKER_ID,
      });
      const access = await realAccessFor(STRANGER_ID, ORG_ID);
      try {
        await approvePlan({
          caseId,
          organizationId: ORG_ID,
          expectedVersion: 1,
          approverId: STRANGER_ID,
          actorEffectiveRole: 'member',
          idempotencyKey: `deny-msg-${randomUUID()}`,
          access,
        });
        throw new Error('expected approvePlan to reject');
      } catch (err) {
        expect(err).toBeInstanceOf(CommandCapabilityDeniedError);
        const denied = err as InstanceType<typeof CommandCapabilityDeniedError>;
        expect(denied.message).toBe('You are not authorized to perform this action.');
        const serialized = JSON.stringify(denied.details);
        expect(serialized).not.toContain(caseId);
        expect(serialized).not.toContain(OWNER_ID);
        expect(serialized).not.toContain(MANAGER_ID);
      }
    });

    itDB('the case OWNER (no explicit capability grant) is ALLOWed by ownership', async () => {
      const caseId = randomUUID();
      await insertKpiAndCase({
        kpiId: randomUUID(),
        versionId: randomUUID(),
        measurementId: randomUUID(),
        caseId,
        ownerUserId: OWNER_ID,
        managerUserId: MANAGER_ID,
        caseStatus: 'plan_submitted',
        planSubmittedBy: MAKER_ID, // NOT the owner — so self-approval does not also fire
        caseCreatedBy: MAKER_ID,
      });
      const access = await realAccessFor(OWNER_ID, ORG_ID);
      const outcome = await approvePlan({
        caseId,
        organizationId: ORG_ID,
        expectedVersion: 1,
        approverId: OWNER_ID,
        actorEffectiveRole: 'member',
        idempotencyKey: `owner-allow-${randomUUID()}`,
        access,
      });
      expect(outcome.outcome).toBe('applied');
      const after = await loadCase(caseId);
      expect(after.status).toBe('approved');
      expect(after.plan_approved_by).toBe(OWNER_ID);
    });

    itDB('the case MANAGER (no explicit capability grant) is ALLOWed by ownership', async () => {
      const caseId = randomUUID();
      await insertKpiAndCase({
        kpiId: randomUUID(),
        versionId: randomUUID(),
        measurementId: randomUUID(),
        caseId,
        ownerUserId: OWNER_ID,
        managerUserId: MANAGER_ID,
        caseStatus: 'plan_submitted',
        planSubmittedBy: MAKER_ID,
        caseCreatedBy: MAKER_ID,
      });
      const access = await realAccessFor(MANAGER_ID, ORG_ID);
      const outcome = await approvePlan({
        caseId,
        organizationId: ORG_ID,
        expectedVersion: 1,
        approverId: MANAGER_ID,
        actorEffectiveRole: 'member',
        idempotencyKey: `manager-allow-${randomUUID()}`,
        access,
      });
      expect(outcome.outcome).toBe('applied');
    });

    itDB('an ADMIN (org-wide "*") is ALLOWed even with no relationship to the case', async () => {
      const caseId = randomUUID();
      await insertKpiAndCase({
        kpiId: randomUUID(),
        versionId: randomUUID(),
        measurementId: randomUUID(),
        caseId,
        ownerUserId: OWNER_ID,
        managerUserId: MANAGER_ID,
        caseStatus: 'plan_submitted',
        planSubmittedBy: MAKER_ID,
        caseCreatedBy: MAKER_ID,
      });
      const access = await realAccessFor(ADMIN_ID, ORG_ID);
      expect(access.capabilities).toContain('*');
      const outcome = await approvePlan({
        caseId,
        organizationId: ORG_ID,
        expectedVersion: 1,
        approverId: ADMIN_ID,
        actorEffectiveRole: 'admin',
        idempotencyKey: `admin-allow-${randomUUID()}`,
        access,
      });
      expect(outcome.outcome).toBe('applied');
    });

    itDB(
      'maker-checker STAYS on top of the RBAC gate: the case OWNER who also submitted the plan is still denied (self-approval), not just capability-denied',
      async () => {
        const caseId = randomUUID();
        // OWNER_ID is both owner_user_id (RBAC would ALLOW) AND
        // plan_submitted_by (maker-checker must still DENY).
        await insertKpiAndCase({
          kpiId: randomUUID(),
          versionId: randomUUID(),
          measurementId: randomUUID(),
          caseId,
          ownerUserId: OWNER_ID,
          managerUserId: MANAGER_ID,
          caseStatus: 'plan_submitted',
          planSubmittedBy: OWNER_ID,
          caseCreatedBy: OWNER_ID,
        });
        const before = await loadCase(caseId);
        const access = await realAccessFor(OWNER_ID, ORG_ID);
        await expect(
          approvePlan({
            caseId,
            organizationId: ORG_ID,
            expectedVersion: 1,
            approverId: OWNER_ID,
            actorEffectiveRole: 'member',
            idempotencyKey: `self-approve-${randomUUID()}`,
            access,
          })
        ).rejects.toBeInstanceOf(DeviationSelfApprovalDeniedError);
        const after = await loadCase(caseId);
        expect(after.status).toBe(before.status);
        expect(after.row_version).toBe(before.row_version);
      }
    );

    itDB(
      'a cross-org actor gets AggregateNotFound, not a capability error, and no row from the OTHER org leaks',
      async () => {
        const caseId = randomUUID();
        await insertKpiAndCase({
          kpiId: randomUUID(),
          versionId: randomUUID(),
          measurementId: randomUUID(),
          caseId,
          ownerUserId: OWNER_ID,
          managerUserId: MANAGER_ID,
          caseStatus: 'plan_submitted',
          planSubmittedBy: MAKER_ID,
          caseCreatedBy: MAKER_ID,
        });
        // FOREIGN_ID resolves access in ITS OWN org, and the command call
        // itself is scoped to FOREIGN_ORG_ID (the caller's real tenant) —
        // exactly what a real route would do (organizationId always comes
        // from the authenticated actor's own session, never the URL).
        const access = await realAccessFor(FOREIGN_ID, FOREIGN_ORG_ID);
        await expect(
          approvePlan({
            caseId,
            organizationId: FOREIGN_ORG_ID,
            expectedVersion: 1,
            approverId: FOREIGN_ID,
            actorEffectiveRole: 'member',
            idempotencyKey: `cross-org-${randomUUID()}`,
            access,
          })
        ).rejects.toBeInstanceOf(AtomicWriteAggregateNotFoundError);

        // The record is completely unaffected and still belongs to ORG_ID.
        const after = await loadCase(caseId);
        expect(after.organization_id).toBe(ORG_ID);
        expect(after.status).toBe('plan_submitted');
      }
    );
  });

  describe('acknowledgeDeviationCase / submitPlan (results.kpi.deviation.acknowledge / .submit_plan)', () => {
    itDB('an unrelated org member is denied on acknowledgeDeviationCase', async () => {
      const caseId = randomUUID();
      await insertKpiAndCase({
        kpiId: randomUUID(),
        versionId: randomUUID(),
        measurementId: randomUUID(),
        caseId,
        ownerUserId: OWNER_ID,
        managerUserId: null,
        caseStatus: 'open',
      });
      const access = await realAccessFor(STRANGER_ID, ORG_ID);
      await expect(
        acknowledgeDeviationCase({
          caseId,
          organizationId: ORG_ID,
          expectedVersion: 1,
          actorUserId: STRANGER_ID,
          actorEffectiveRole: 'member',
          idempotencyKey: `ack-deny-${randomUUID()}`,
          access,
        })
      ).rejects.toBeInstanceOf(CommandCapabilityDeniedError);
      const after = await loadCase(caseId);
      expect(after.status).toBe('open');
    });

    itDB('the owner is allowed on acknowledgeDeviationCase', async () => {
      const caseId = randomUUID();
      await insertKpiAndCase({
        kpiId: randomUUID(),
        versionId: randomUUID(),
        measurementId: randomUUID(),
        caseId,
        ownerUserId: OWNER_ID,
        managerUserId: null,
        caseStatus: 'open',
      });
      const access = await realAccessFor(OWNER_ID, ORG_ID);
      const outcome = await acknowledgeDeviationCase({
        caseId,
        organizationId: ORG_ID,
        expectedVersion: 1,
        actorUserId: OWNER_ID,
        actorEffectiveRole: 'member',
        idempotencyKey: `ack-allow-${randomUUID()}`,
        access,
      });
      expect(outcome.outcome).toBe('applied');
      const after = await loadCase(caseId);
      expect(after.status).toBe('analysis_required');
    });
  });

  describe('verifyMeasurement / disputeMeasurement / correctMeasurement (results.kpi.measurement.*)', () => {
    async function insertOwnedMeasurement(measurementId: string, kpiId: string, versionId: string) {
      await client.query(
        `INSERT INTO rvn_kpi_definitions (kpi_id, organization_id, kpi_code, status, owner_user_id, created_by)
         VALUES ($1, $2, $3, 'active', $4, $4)`,
        [kpiId, ORG_ID, `KPI-${kpiId.slice(-8)}`, OWNER_ID]
      );
      await client.query(
        `INSERT INTO rvn_kpi_definition_versions
           (definition_version_id, kpi_id, organization_id, version_number, name, unit, target_geometry,
            target_min, approval_status, created_by, effective_from)
         VALUES ($1, $2, $3, 1, 'RN-G5 measurement fixture KPI', 'unit', 'threshold_min', 100, 'approved', $4, now())`,
        [versionId, kpiId, ORG_ID, OWNER_ID]
      );
      await client.query(`UPDATE rvn_kpi_definitions SET current_definition_version_id = $1 WHERE kpi_id = $2`, [
        versionId,
        kpiId,
      ]);
      await client.query(
        `INSERT INTO rvn_kpi_measurements
           (measurement_id, kpi_id, definition_version_id, organization_id, period_start, period_end,
            actual_value, performance_status, data_quality_status, source, recorded_by)
         VALUES ($1, $2, $3, $4, '2026-04-01T00:00:00.000Z', '2026-04-30T00:00:00.000Z', 42, 'on_target', 'unverified', 'manual', $5)`,
        [measurementId, kpiId, versionId, ORG_ID, OWNER_ID]
      );
    }

    itDB('verifyMeasurement: an unrelated org member is denied and the measurement stays unverified', async () => {
      const measurementId = randomUUID();
      await insertOwnedMeasurement(measurementId, randomUUID(), randomUUID());
      const before = await loadMeasurement(measurementId);
      const access = await realAccessFor(STRANGER_ID, ORG_ID);
      await expect(
        verifyMeasurement({
          measurementId,
          organizationId: ORG_ID,
          verifiedBy: STRANGER_ID,
          actorEffectiveRole: 'member',
          idempotencyKey: `verify-deny-${randomUUID()}`,
          access,
        })
      ).rejects.toBeInstanceOf(CommandCapabilityDeniedError);
      const after = await loadMeasurement(measurementId);
      expect(after.data_quality_status).toBe(before.data_quality_status);
    });

    itDB('verifyMeasurement: the KPI owner is allowed', async () => {
      const measurementId = randomUUID();
      await insertOwnedMeasurement(measurementId, randomUUID(), randomUUID());
      const access = await realAccessFor(OWNER_ID, ORG_ID);
      const outcome = await verifyMeasurement({
        measurementId,
        organizationId: ORG_ID,
        verifiedBy: OWNER_ID,
        actorEffectiveRole: 'member',
        idempotencyKey: `verify-allow-${randomUUID()}`,
        access,
      });
      expect(outcome.outcome).toBe('applied');
      expect(outcome.result.superseding.dataQualityStatus).toBe('verified');
    });

    itDB('disputeMeasurement: an unrelated org member is denied', async () => {
      const measurementId = randomUUID();
      await insertOwnedMeasurement(measurementId, randomUUID(), randomUUID());
      const access = await realAccessFor(STRANGER_ID, ORG_ID);
      await expect(
        disputeMeasurement({
          measurementId,
          organizationId: ORG_ID,
          disputedBy: STRANGER_ID,
          disputeReason: 'RN-G5 probe',
          actorEffectiveRole: 'member',
          idempotencyKey: `dispute-deny-${randomUUID()}`,
          access,
        })
      ).rejects.toBeInstanceOf(CommandCapabilityDeniedError);
    });

    itDB('correctMeasurement: an unrelated org member is denied', async () => {
      const measurementId = randomUUID();
      await insertOwnedMeasurement(measurementId, randomUUID(), randomUUID());
      const access = await realAccessFor(STRANGER_ID, ORG_ID);
      await expect(
        correctMeasurement({
          measurementId,
          organizationId: ORG_ID,
          actualValue: 99,
          performanceStatus: 'on_target',
          correctionReason: 'RN-G5 probe',
          recordedBy: STRANGER_ID,
          actorEffectiveRole: 'member',
          idempotencyKey: `correct-deny-${randomUUID()}`,
          access,
        })
      ).rejects.toBeInstanceOf(CommandCapabilityDeniedError);
    });

    itDB('correctMeasurement: the KPI owner is allowed', async () => {
      const measurementId = randomUUID();
      await insertOwnedMeasurement(measurementId, randomUUID(), randomUUID());
      const access = await realAccessFor(OWNER_ID, ORG_ID);
      const outcome = await correctMeasurement({
        measurementId,
        organizationId: ORG_ID,
        actualValue: 99,
        performanceStatus: 'on_target',
        correctionReason: 'RN-G5 probe',
        recordedBy: OWNER_ID,
        actorEffectiveRole: 'member',
        idempotencyKey: `correct-allow-${randomUUID()}`,
        access,
      });
      expect(outcome.outcome).toBe('applied');
    });
  });
});
