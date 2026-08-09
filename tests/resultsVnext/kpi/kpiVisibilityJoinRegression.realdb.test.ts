/**
 * KPI-E001/E002/E003 — regression guard for the TEXT/UUID visibility-join
 * bug (found by KPI-E004, fixed here in `kpiRepository.ts`/
 * `kpiDeviationRepository.ts`, against a REAL Postgres).
 *
 * Context: `rvn_platform_resource_visibility.resource_id` is TEXT, but
 * `rvn_kpi_definitions.kpi_id`/`rvn_kpi_deviation_cases.kpi_id` are UUID.
 * `kpiScorecardRepository.ts` (KPI-E004) discovered on a real Postgres 16
 * that `vr.resource_id = <uuid column>` fails to even PARSE — Postgres
 * 42883 "operator does not exist: text = uuid", no implicit cast — and
 * fixed its own joins with an explicit `::text` cast. The EXACT SAME bug
 * existed, unfixed, in `kpiRepository.ts` (`listKpis`/`getKpi`/
 * `listMeasurements`, KPI-E001/E002) and `kpiDeviationRepository.ts`
 * (`getDeviationCase`/`listDeviationCases`/`listCorrectiveActions`/
 * `listEffectivenessVerifications`, KPI-E003) — every one of those
 * functions would have thrown 42883 the instant a caller with at least one
 * *visible* row reached the join, i.e. every real-world call.
 *
 * WHY THIS FILE EXISTS: `kpi.routes.test.ts`/`kpiDeviation.routes.test.ts`
 * mock `kpiRepository.js`/`kpiDeviationRepository.js` at the module level
 * (`vi.mock(...)` replacing `getKpi`/`listKpis`/`listMeasurements`/
 * `getDeviationCase`/`listDeviationCases` with `vi.fn()`s) — so the HTTP
 * contract tests, even the ones run against a real ephemeral Postgres
 * (EXECUTION_LEDGER.md §21, "121/121 zielono"), NEVER actually executed
 * this SQL. No other test file in this repo imports `kpiRepository.ts` or
 * `kpiDeviationRepository.ts` at all (verified by grep before writing this
 * file). This file is the first real caller of either module's list/get
 * functions against a live Postgres connection with real
 * `rvn_platform_resource_visibility` rows — which is exactly what it takes
 * to force the buggy join to actually run instead of silently going
 * untested. If the `::text` cast ever regresses, this file fails with the
 * real 42883 Postgres error, not a mock returning whatever it was told to.
 *
 * SKIP POLICY (same convention as
 * tests/resultsVnext/kpi/deviationCaseIdempotency.realdb.test.ts /
 * scorecardPublishNonLeak.realdb.test.ts): if no database is configured (no
 * DATABASE_URL/DB_HOST), every scenario below is a silent no-op and this
 * file reports green — that is expected in environments without a Postgres
 * available and is NOT evidence the behavior works. If a database IS
 * configured but unreachable, `beforeAll` throws so this run is never
 * silently green.
 *
 * HOW TO RUN FOR REAL: point DATABASE_URL (or DB_HOST/DB_PORT/DB_NAME/
 * DB_USER/DB_PASSWORD) at a Postgres 16 that already has the full
 * `rvn_platform_*`/`rvn_kpi_*` schema applied (server/migrations/
 * 20260809_rvn_platform_*.sql, 20260810_rvn_kpi_core.sql,
 * 20260811_rvn_kpi_deviation_loop.sql, 20260811_rvn_platform_obligations.sql)
 * before importing this file — env vars are read once, at
 * `server/src/config/DatabaseConfig.ts`'s module-load time.
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
const ORG_ID = `kpi-vis-join-it-org-${tag}`;
const USER_A = `kpi-vis-join-it-owner-${tag}`; // owns the PRIVATE KPI
const USER_B = `kpi-vis-join-it-outsider-${tag}`; // no ownership, no RBAC override

let client: Client;
let reachable = false;

type RepositoryModule = typeof import('../../../server/src/services/resultsVnext/kpi/kpiRepository.js');
type DeviationRepositoryModule = typeof import('../../../server/src/services/resultsVnext/kpi/kpiDeviationRepository.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let listKpis: RepositoryModule['listKpis'];
let getKpi: RepositoryModule['getKpi'];
let listDeviationCases: DeviationRepositoryModule['listDeviationCases'];
let getDeviationCase: DeviationRepositoryModule['getDeviationCase'];
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

async function insertKpiVisibility(
  kpiId: string,
  mode: 'OPEN_ORG' | 'PRIVATE',
  ownerUserId: string
): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_resource_visibility
       (resource_type, resource_id, organization_id, visibility_mode, policy_id, owner_user_id)
     VALUES ('kpi', $1, $2, $3, $4, $5)`,
    [kpiId, ORG_ID, mode, policyId, ownerUserId]
  );
}

async function insertMeasurement(
  measurementId: string,
  kpiId: string,
  versionId: string,
  recordedBy: string
): Promise<void> {
  await client.query(
    `INSERT INTO rvn_kpi_measurements
       (measurement_id, kpi_id, definition_version_id, organization_id, period_start, period_end,
        actual_value, performance_status, source, recorded_by)
     VALUES ($1, $2, $3, $4, '2026-03-01T00:00:00.000Z', '2026-03-31T00:00:00.000Z', 42, 'on_target', 'manual', $5)`,
    [measurementId, kpiId, versionId, ORG_ID, recordedBy]
  );
}

async function insertDeviationCase(
  caseId: string,
  kpiId: string,
  measurementId: string,
  ownerUserId: string
): Promise<void> {
  await client.query(
    `INSERT INTO rvn_kpi_deviation_cases
       (case_id, organization_id, kpi_id, trigger_measurement_id, severity, status, owner_user_id, created_by)
     VALUES ($1, $2, $3, $4, 'critical', 'open', $5, $5)`,
    [caseId, ORG_ID, kpiId, measurementId, ownerUserId]
  );
}

describe('KPI visibility-join regression — TEXT/UUID cast forces real join execution (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — KPI visibility-join regression tests did NOT run. This run is not evidence.'
      );
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_kpi_definitions LIMIT 0');
      await client.query('SELECT 1 FROM rvn_kpi_deviation_cases LIMIT 0');
      // buildVisibilityScopedCte's SCOPE branch (visibilityScopedQuery.ts)
      // unconditionally references `team_members` in its fixed UNION
      // template regardless of which visibility_mode this file's fixtures
      // actually use — the query fails to PARSE without the table
      // existing. Same minimal, FK-free stand-in
      // scorecardPublishNonLeak.realdb.test.ts already uses.
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
        'A database is configured but is not reachable (or missing the KPI schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const repository: RepositoryModule = await import(
      '../../../server/src/services/resultsVnext/kpi/kpiRepository.js'
    );
    listKpis = repository.listKpis;
    getKpi = repository.getKpi;

    const deviationRepository: DeviationRepositoryModule = await import(
      '../../../server/src/services/resultsVnext/kpi/kpiDeviationRepository.js'
    );
    listDeviationCases = deviationRepository.listDeviationCases;
    getDeviationCase = deviationRepository.getDeviationCase;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    // USER_A is the literal owner_user_id on the PRIVATE fixture KPI, which
    // is sufficient on its own for buildVisibilityScopedCte's PRIVATE
    // branch ("owner only") to grant USER_A visibility. USER_B never
    // appears as an owner/grantee/team-member anywhere, and
    // effectiveAccessService.ts defaults an unregistered user to plain
    // 'USER' (no wildcard/kpi.view RBAC override) — same reasoning
    // scorecardPublishNonLeak.realdb.test.ts documents for its own USER_B.
    policyId = await insertVisibilityPolicy('kpi', 'PRIVATE', USER_A);
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(`DELETE FROM rvn_kpi_deviation_cases WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_measurements WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_outbox WHERE event_id IN (
                          SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `UPDATE rvn_kpi_definitions SET current_definition_version_id = NULL WHERE organization_id = $1`,
      [ORG_ID]
    );
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
    'listKpis/getKpi: a PRIVATE KPI is visible to its owner and invisible to a non-owner — proves the ' +
      '`vr.resource_id = kd.kpi_id::text` join executes against real rows instead of throwing 42883 ' +
      '(text = uuid) or silently matching nothing',
    async () => {
      const kpiId = randomUUID();
      const versionId = randomUUID();
      await insertFixtureKpi(kpiId, versionId, USER_A);
      await insertKpiVisibility(kpiId, 'PRIVATE', USER_A);

      // Owner: listKpis includes it, getKpi returns it.
      const ownerList = await listKpis({ userId: USER_A, organizationId: ORG_ID });
      expect(ownerList.map((k) => k.kpiId)).toContain(kpiId);

      const ownerGet = await getKpi({ userId: USER_A, organizationId: ORG_ID, kpiId });
      expect(ownerGet).not.toBeNull();
      expect(ownerGet?.kpiId).toBe(kpiId);

      // Non-owner: listKpis excludes it, getKpi returns null — NOT a thrown
      // 42883 (which would fail the whole call, not just this KPI) and NOT
      // a false-positive leak.
      const outsiderList = await listKpis({ userId: USER_B, organizationId: ORG_ID });
      expect(outsiderList.map((k) => k.kpiId)).not.toContain(kpiId);

      const outsiderGet = await getKpi({ userId: USER_B, organizationId: ORG_ID, kpiId });
      expect(outsiderGet).toBeNull();
    }
  );

  itDB(
    'listDeviationCases/getDeviationCase: a case on a PRIVATE KPI inherits that KPI\'s visibility via ' +
      '`dc.kpi_id::text` — visible to the KPI owner, invisible to a non-owner',
    async () => {
      const kpiId = randomUUID();
      const versionId = randomUUID();
      const measurementId = randomUUID();
      const caseId = randomUUID();
      await insertFixtureKpi(kpiId, versionId, USER_A);
      await insertKpiVisibility(kpiId, 'PRIVATE', USER_A);
      await insertMeasurement(measurementId, kpiId, versionId, USER_A);
      await insertDeviationCase(caseId, kpiId, measurementId, USER_A);

      const ownerList = await listDeviationCases({ userId: USER_A, organizationId: ORG_ID, kpiId });
      expect(ownerList.map((c) => c.caseId)).toContain(caseId);

      const ownerGet = await getDeviationCase({ userId: USER_A, organizationId: ORG_ID, caseId });
      expect(ownerGet).not.toBeNull();
      expect(ownerGet?.caseId).toBe(caseId);

      const outsiderList = await listDeviationCases({ userId: USER_B, organizationId: ORG_ID, kpiId });
      expect(outsiderList.map((c) => c.caseId)).not.toContain(caseId);

      const outsiderGet = await getDeviationCase({ userId: USER_B, organizationId: ORG_ID, caseId });
      expect(outsiderGet).toBeNull();
    }
  );
});
