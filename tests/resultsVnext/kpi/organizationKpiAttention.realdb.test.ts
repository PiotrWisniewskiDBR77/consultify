/**
 * KPI-E005 — `listOrganizationKpiAttention` REAL-Postgres coverage: chain-
 * scoping non-leak (design §D, per-package brief: "manager widzi tylko
 * podwładnych, PRIVATE KPI podwładnego pozostaje niewidoczny mimo bycia w
 * chain").
 *
 * Per EXECUTION_LEDGER.md §24's lesson, `kpiPerspectivesRepository.ts` is a
 * NEW repository file — it needs a DIRECT realDB test exercising its own
 * `INNER JOIN rvn_visible_resources` / `rvn_platform_management_chain_closure`
 * joins, not only a mocked unit test. This file is that direct test.
 *
 * SKIP POLICY (same convention as every other `*.realdb.test.ts` in this
 * directory): if no database is configured, every scenario below is a
 * silent no-op and this file reports green — that is expected in
 * environments without Postgres and is NOT evidence the behavior works. If a
 * database IS configured but unreachable, `beforeAll` throws.
 *
 * HOW TO RUN FOR REAL: point DATABASE_URL (or DB_HOST/...) at a Postgres 16
 * that already has server/migrations/20260809_rvn_platform_*.sql,
 * 20260810_rvn_kpi_core.sql, 20260811_rvn_kpi_deviation_loop.sql,
 * 20260811_rvn_platform_obligations.sql, 20260812_rvn_kpi_scorecards.sql,
 * 20260813_rvn_kpi_measurement_cadence.sql applied.
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
const ORG_ID = `kpi-e005-org-attn-org-${tag}`;
const MANAGER = `kpi-e005-org-attn-manager-${tag}`;
const SUBORDINATE = `kpi-e005-org-attn-subordinate-${tag}`; // reports to MANAGER
const OUTSIDER = `kpi-e005-org-attn-outsider-${tag}`; // NOT in MANAGER's chain

let client: Client;
let reachable = false;

type RepositoryModule =
  typeof import('../../../server/src/services/resultsVnext/kpi/kpiPerspectivesRepository.js');
let listOrganizationKpiAttention: RepositoryModule['listOrganizationKpiAttention'];

let sharedKpiPolicyId: string;

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
  policyId: string,
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

async function insertChainEdge(ancestor: string, descendant: string, depth: number): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_management_chain_closure (organization_id, ancestor_user_id, descendant_user_id, depth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING`,
    [ORG_ID, ancestor, descendant, depth]
  );
}

describe('KPI-E005 listOrganizationKpiAttention — chain-scoping non-leak (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — organizationKpiAttention realdb tests did NOT run. This run is not evidence.'
      );
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_platform_management_chain_closure LIMIT 0');
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
        'A database is configured but is not reachable (or missing the KPI-E005 schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const repository: RepositoryModule = await import(
      '../../../server/src/services/resultsVnext/kpi/kpiPerspectivesRepository.js'
    );
    listOrganizationKpiAttention = repository.listOrganizationKpiAttention;

    sharedKpiPolicyId = await insertVisibilityPolicy('kpi', 'OPEN_ORG', MANAGER);

    // MANAGER -> SUBORDINATE (direct report). OUTSIDER is never in MANAGER's
    // chain (no closure row).
    await insertChainEdge(MANAGER, MANAGER, 0);
    await insertChainEdge(SUBORDINATE, SUBORDINATE, 0);
    await insertChainEdge(MANAGER, SUBORDINATE, 1);
    await insertChainEdge(OUTSIDER, OUTSIDER, 0);
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(`DELETE FROM rvn_kpi_deviation_cases WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_measurements WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `UPDATE rvn_kpi_definitions SET current_definition_version_id = NULL WHERE organization_id = $1`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_kpi_definition_versions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_definitions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_management_chain_closure WHERE organization_id = $1`, [
      ORG_ID,
    ]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [ORG_ID]);
    await client.end();
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
    "a manager sees only subordinates' KPIs (chain-scoped), and a subordinate's PRIVATE KPI stays " +
      'invisible even though its owner IS in the chain (T3 non-leak wins over completeness — decision #2)',
    async () => {
      // KPI-VISIBLE: OPEN_ORG, owner = SUBORDINATE (in MANAGER's chain) —
      // MUST appear.
      const kpiVisible = randomUUID();
      await insertFixtureKpi(kpiVisible, randomUUID(), SUBORDINATE);
      await insertKpiVisibility(kpiVisible, sharedKpiPolicyId, 'OPEN_ORG', SUBORDINATE);

      // KPI-PRIVATE: PRIVATE, owner = SUBORDINATE (in MANAGER's chain, but
      // MANAGER is not the owner and has no RBAC override) — MUST NOT
      // appear, even though SUBORDINATE is chain-reachable.
      const kpiPrivate = randomUUID();
      await insertFixtureKpi(kpiPrivate, randomUUID(), SUBORDINATE);
      await insertKpiVisibility(kpiPrivate, sharedKpiPolicyId, 'PRIVATE', SUBORDINATE);

      // KPI-OUTSIDER: OPEN_ORG, owner = OUTSIDER (NOT in MANAGER's chain) —
      // MUST NOT appear (chain gate, independent of visibility).
      const kpiOutsider = randomUUID();
      await insertFixtureKpi(kpiOutsider, randomUUID(), OUTSIDER);
      await insertKpiVisibility(kpiOutsider, sharedKpiPolicyId, 'OPEN_ORG', OUTSIDER);

      const attention = await listOrganizationKpiAttention({
        managerId: MANAGER,
        organizationId: ORG_ID,
      });

      const ownerLoadForSubordinate = attention.ownerLoad.find((o) => o.ownerUserId === SUBORDINATE);
      // Exactly 1 (kpiVisible only) — if kpiPrivate leaked through the chain
      // gate, this would be 2.
      expect(ownerLoadForSubordinate?.activeKpiCount).toBe(1);

      const ownerLoadForOutsider = attention.ownerLoad.find((o) => o.ownerUserId === OUTSIDER);
      expect(ownerLoadForOutsider).toBeUndefined();

      const totalActiveKpis = attention.processCoverage.reduce((sum, row) => sum + row.activeKpis, 0);
      expect(totalActiveKpis).toBe(1);
    }
  );
});
