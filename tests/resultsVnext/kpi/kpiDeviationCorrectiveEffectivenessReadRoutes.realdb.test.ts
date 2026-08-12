/**
 * RN-G6-SRV / B3 — the two new `kpiDeviation.routes.ts` read endpoints,
 * against a REAL Postgres:
 *   GET .../:caseId/corrective-actions        -> listCorrectiveActions
 *   GET .../:caseId/effectiveness-verifications -> listEffectivenessVerifications
 *
 * Both repository functions already existed, fully visibility-scoped
 * (`kpiDeviationRepository.ts`'s own header: resourceType 'kpi', inherited
 * via the case's own kpi_id) — the routes were simply never wired to them
 * (kpiDeviation.routes.ts's own former header note said so explicitly).
 * This file is the same style of proof
 * `kpiVisibilityJoinRegression.realdb.test.ts` already established for
 * `listDeviationCases`/`getDeviationCase`: call the EXACT function the new
 * route now calls, against a real Postgres, with a PRIVATE KPI in the mix
 * so the visibility filter is forced to do real work — not a mock, and not
 * only the pure-logic/HTTP-mapping layer.
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * program — if no database is configured, every scenario below is a
 * silent no-op and this file reports green; that is NOT evidence the
 * behavior works. If a database IS configured but unreachable, `beforeAll`
 * throws so this run is never silently green.
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

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `kpi-b3-reads-it-org-${tag}`;
const USER_A = `kpi-b3-reads-it-owner-${tag}`; // owns the PRIVATE KPI
const USER_B = `kpi-b3-reads-it-outsider-${tag}`; // no ownership, no RBAC override

let client: Client;
let reachable = false;

type DeviationRepositoryModule = typeof import('../../../server/src/services/resultsVnext/kpi/kpiDeviationRepository.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let listCorrectiveActions: DeviationRepositoryModule['listCorrectiveActions'];
let listEffectivenessVerifications: DeviationRepositoryModule['listEffectivenessVerifications'];
let closePgPool: (() => Promise<void>) | undefined;

let policyId: string;

async function insertVisibilityPolicy(domain: string, mode: string, createdBy: string): Promise<string> {
  const result = await client.query<{ policy_id: string }>(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, $2, 1, $3, true, $4)
     RETURNING policy_id`,
    [ORG_ID, domain, mode, createdBy]
  );
  return result.rows[0]!.policy_id;
}

async function insertFixtureKpi(kpiId: string, versionId: string, ownerUserId: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_kpi_definitions (kpi_id, organization_id, kpi_code, status, owner_user_id, created_by)
     VALUES ($1, $2, $3, 'active', $4, $4)`,
    [kpiId, ORG_ID, `KPI-${kpiId.slice(0, 8)}`, ownerUserId]
  );
  await client.query(
    `INSERT INTO rvn_kpi_definition_versions
       (definition_version_id, kpi_id, organization_id, version_number, name, unit, target_geometry,
        target_min, approval_status, created_by, effective_from)
     VALUES ($1, $2, $3, 1, 'IT fixture KPI', 'unit', 'threshold_min', 100, 'approved', $4, now())`,
    [versionId, kpiId, ORG_ID, ownerUserId]
  );
  await client.query(`UPDATE rvn_kpi_definitions SET current_definition_version_id = $1 WHERE kpi_id = $2`, [
    versionId,
    kpiId,
  ]);
}

async function insertKpiVisibility(kpiId: string, mode: 'OPEN_ORG' | 'PRIVATE', ownerUserId: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_resource_visibility
       (resource_type, resource_id, organization_id, visibility_mode, policy_id, owner_user_id)
     VALUES ('kpi', $1, $2, $3, $4, $5)`,
    [kpiId, ORG_ID, mode, policyId, ownerUserId]
  );
}

async function insertMeasurement(measurementId: string, kpiId: string, versionId: string, recordedBy: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_kpi_measurements
       (measurement_id, kpi_id, definition_version_id, organization_id, period_start, period_end,
        actual_value, performance_status, source, recorded_by)
     VALUES ($1, $2, $3, $4, '2026-03-01T00:00:00.000Z', '2026-03-31T00:00:00.000Z', 42, 'critical', 'manual', $5)`,
    [measurementId, kpiId, versionId, ORG_ID, recordedBy]
  );
}

async function insertDeviationCase(caseId: string, kpiId: string, measurementId: string, ownerUserId: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_kpi_deviation_cases
       (case_id, organization_id, kpi_id, trigger_measurement_id, severity, status, owner_user_id, created_by)
     VALUES ($1, $2, $3, $4, 'critical', 'open', $5, $5)`,
    [caseId, ORG_ID, kpiId, measurementId, ownerUserId]
  );
}

async function insertCorrectiveAction(actionId: string, caseId: string, ownerUserId: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_kpi_corrective_actions
       (action_id, deviation_case_id, organization_id, title, owner_user_id, status, created_by)
     VALUES ($1, $2, $3, 'IT fixture corrective action', $4, 'planned', $4)`,
    [actionId, caseId, ORG_ID, ownerUserId]
  );
}

async function insertEffectivenessVerification(verificationId: string, caseId: string, createdBy: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_kpi_effectiveness_verifications
       (verification_id, deviation_case_id, organization_id, verification_window_start, verification_window_end,
        status, created_by)
     VALUES ($1, $2, $3, '2026-04-01T00:00:00.000Z', '2026-04-30T00:00:00.000Z', 'pending', $4)`,
    [verificationId, caseId, ORG_ID, createdBy]
  );
}

describe('RN-G6-SRV / B3 — listCorrectiveActions/listEffectivenessVerifications (real Postgres, visibility-scoped)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — RN-G6-SRV B3 kpiDeviation read-route tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1 FROM rvn_kpi_corrective_actions LIMIT 0');
      await client.query('SELECT 1 FROM rvn_kpi_effectiveness_verifications LIMIT 0');
      await client.query(
        `CREATE TABLE IF NOT EXISTS team_members (
           team_id TEXT NOT NULL,
           user_id TEXT NOT NULL,
           role TEXT DEFAULT 'member',
           PRIMARY KEY (team_id, user_id)
         )`
      );
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the KPI-E003 schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const deviationRepository: DeviationRepositoryModule = await import(
      '../../../server/src/services/resultsVnext/kpi/kpiDeviationRepository.js'
    );
    listCorrectiveActions = deviationRepository.listCorrectiveActions;
    listEffectivenessVerifications = deviationRepository.listEffectivenessVerifications;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    policyId = await insertVisibilityPolicy('kpi', 'PRIVATE', USER_A);
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(`DELETE FROM rvn_kpi_effectiveness_verification_measurements
                          WHERE verification_id IN (
                            SELECT verification_id FROM rvn_kpi_effectiveness_verifications
                             WHERE organization_id = $1)`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_effectiveness_verifications WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_corrective_actions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_deviation_cases WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_measurements WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`UPDATE rvn_kpi_definitions SET current_definition_version_id = NULL WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_definition_versions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_definitions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [ORG_ID]);
    await client.end();
    if (closePgPool) await closePgPool();
  }, 30_000);

  const itDB = (name: string, fn: () => Promise<void>, timeoutMs = 30_000) =>
    it(
      name,
      async () => {
        if (!reachable) return;
        await fn();
      },
      timeoutMs
    );

  itDB(
    'listCorrectiveActions: visible to the PRIVATE KPI\'s owner, invisible (empty, not an error) to an outsider — D06, never a 404-vs-empty leak',
    async () => {
      const kpiId = randomUUID();
      const versionId = randomUUID();
      const measurementId = randomUUID();
      const caseId = randomUUID();
      const actionId = randomUUID();
      await insertFixtureKpi(kpiId, versionId, USER_A);
      await insertKpiVisibility(kpiId, 'PRIVATE', USER_A);
      await insertMeasurement(measurementId, kpiId, versionId, USER_A);
      await insertDeviationCase(caseId, kpiId, measurementId, USER_A);
      await insertCorrectiveAction(actionId, caseId, USER_A);

      const ownerList = await listCorrectiveActions({ userId: USER_A, organizationId: ORG_ID, deviationCaseId: caseId });
      expect(ownerList.map((a) => a.actionId)).toContain(actionId);
      expect(ownerList[0]?.title).toBe('IT fixture corrective action');

      const outsiderList = await listCorrectiveActions({ userId: USER_B, organizationId: ORG_ID, deviationCaseId: caseId });
      expect(outsiderList.map((a) => a.actionId)).not.toContain(actionId);
      expect(outsiderList).toEqual([]);
    }
  );

  itDB(
    'listEffectivenessVerifications: same PRIVATE-KPI-inherited visibility, owner sees it, outsider gets an empty list',
    async () => {
      const kpiId = randomUUID();
      const versionId = randomUUID();
      const measurementId = randomUUID();
      const caseId = randomUUID();
      const verificationId = randomUUID();
      await insertFixtureKpi(kpiId, versionId, USER_A);
      await insertKpiVisibility(kpiId, 'PRIVATE', USER_A);
      await insertMeasurement(measurementId, kpiId, versionId, USER_A);
      await insertDeviationCase(caseId, kpiId, measurementId, USER_A);
      await insertEffectivenessVerification(verificationId, caseId, USER_A);

      const ownerList = await listEffectivenessVerifications({ userId: USER_A, organizationId: ORG_ID, deviationCaseId: caseId });
      expect(ownerList.map((v) => v.verificationId)).toContain(verificationId);

      const outsiderList = await listEffectivenessVerifications({ userId: USER_B, organizationId: ORG_ID, deviationCaseId: caseId });
      expect(outsiderList).toEqual([]);
    }
  );

  itDB(
    'listCorrectiveActions status filter narrows results without weakening visibility',
    async () => {
      const kpiId = randomUUID();
      const versionId = randomUUID();
      const measurementId = randomUUID();
      const caseId = randomUUID();
      const plannedId = randomUUID();
      const completedId = randomUUID();
      await insertFixtureKpi(kpiId, versionId, USER_A);
      await insertKpiVisibility(kpiId, 'PRIVATE', USER_A);
      await insertMeasurement(measurementId, kpiId, versionId, USER_A);
      await insertDeviationCase(caseId, kpiId, measurementId, USER_A);
      await insertCorrectiveAction(plannedId, caseId, USER_A);
      await insertCorrectiveAction(completedId, caseId, USER_A);
      await client.query(`UPDATE rvn_kpi_corrective_actions SET status = 'completed' WHERE action_id = $1`, [completedId]);

      const plannedOnly = await listCorrectiveActions({
        userId: USER_A,
        organizationId: ORG_ID,
        deviationCaseId: caseId,
        status: 'planned',
      });
      expect(plannedOnly.map((a) => a.actionId)).toEqual([plannedId]);
    }
  );
});
