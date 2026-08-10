/**
 * KPI-E007 — Legacy Archive isolation contract test (design §6, "B.2").
 *
 * Proves the vNext read models (`kpiRepository.listKpis`,
 * `kpiPerspectivesRepository.listMyKpis`/`listOrganizationKpiAttention`)
 * NEVER surface a row from any of the 4 legacy/parallel KPI-definition
 * tables (`kpis`, `kpi_definitions`, `v8_kpi_definitions`,
 * `tp_kpi_definitions` — design §0.1's inventory), even when a poisoned row
 * in each of those tables shares the same `organization_id` and a
 * deliberately similar code/name to a real, visible control KPI.
 *
 * Skeleton copied from `kpiIdentityAcrossSurfaces.realdb.test.ts` verbatim
 * (`DB_CONFIGURED` skip-gate, raw `pg.Client` setup/teardown,
 * `ORG_ID`/`USER` tagging conventions) per the design's own instruction.
 *
 * -- DEVIATION FOUND ON REAL POSTGRES (not guessed, not in the design doc):
 * `kpis` (one of the 4 legacy tables in scope) is NOT a plain table on the
 * forward migration path at all — it is a read-only compatibility VIEW
 * (`server/migrations/20260719_baseline_gap.sql`:
 * `CREATE OR REPLACE VIEW public.kpis AS SELECT ik.id, i.organization_id,
 * ik.name, ... FROM initiative_kpis ik JOIN initiatives i ON
 * ik.initiative_id = i.id`), discovered only by actually running this
 * test against real Postgres (a first attempt at `INSERT INTO kpis`/
 * `DELETE FROM kpis` failed with "cannot insert/delete ... view ... not
 * automatically updatable"). See `kpiLegacyArchiveRepository.ts`'s own
 * matching DEVIATION note for the second consequence (the view has no
 * `created_at` column). Since the view is not directly writable, "poison
 * the `kpis` legacy source" below means inserting into its two underlying
 * tables (`initiative_kpis` + a matching `initiatives` row) instead of
 * `kpis` itself — the view then surfaces that row on its own, exactly as
 * the real read path (`ideaAIGeneratorService.ts` etc., design §0.1) would
 * see it.
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * directory.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
const ORG_ID = `kpi-e007-legacy-iso-org-${tag}`;
const USER = `kpi-e007-legacy-iso-user-${tag}`;
const SHARED_CODE = `KPI-LEGACY-ISO-${tag}`;

let client: Client;
let reachable = false;

// Poisoned-row identifiers — inserted directly via raw pg.Client, bypassing
// every service in this repo.
const poisonedInitiativeId = `kpi-e007-legacy-iso-poison-init-${tag}`;
const poisonedKpisId = `legacy-kpi-${tag}`; // initiative_kpis.id (text) — surfaces via the `kpis` view (see file header DEVIATION note)
const poisonedKpiDefinitionsId = `legacy-kpidef-${tag}`;
const poisonedV8Id = `legacy-v8kpi-${tag}`;
let poisonedTpBaseId = '';
let poisonedTpModelId = '';
let poisonedTpKpiId = '';

type KpiRepoModule = typeof import('../../../server/src/services/resultsVnext/kpi/kpiRepository.js');
type PerspectivesModule =
  typeof import('../../../server/src/services/resultsVnext/kpi/kpiPerspectivesRepository.js');

let listKpis: KpiRepoModule['listKpis'];
let listMyKpis: PerspectivesModule['listMyKpis'];
let listOrganizationKpiAttention: PerspectivesModule['listOrganizationKpiAttention'];

describe('KPI-E007 legacy isolation (real Postgres)', () => {
  let controlKpiId: string;
  let controlVersionId: string;
  let controlMeasurementId: string;
  let controlCaseId: string;

  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — legacyIsolation realdb tests did NOT run. This run is not evidence.'
      );
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_kpi_definitions LIMIT 0');
      await client.query('SELECT 1 FROM rvn_kpi_deviation_cases LIMIT 0');
      await client.query('SELECT 1 FROM kpi_definitions LIMIT 0');
      await client.query('SELECT 1 FROM v8_kpi_definitions LIMIT 0');
      await client.query('SELECT 1 FROM tp_kpi_definitions LIMIT 0');
      // `kpis` — a VIEW, not a table (see file header DEVIATION note); its
      // underlying tables are on the forward migration path already.
      await client.query('SELECT 1 FROM kpis LIMIT 0');
      await client.query('SELECT 1 FROM initiative_kpis LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing required schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const kpiRepo: KpiRepoModule = await import('../../../server/src/services/resultsVnext/kpi/kpiRepository.js');
    listKpis = kpiRepo.listKpis;

    const perspectives: PerspectivesModule = await import(
      '../../../server/src/services/resultsVnext/kpi/kpiPerspectivesRepository.js'
    );
    listMyKpis = perspectives.listMyKpis;
    listOrganizationKpiAttention = perspectives.listOrganizationKpiAttention;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    // ---- Cleanup: control fixture (rvn_* path) ----
    await client.query(`DELETE FROM rvn_kpi_deviation_cases WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_measurements WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `UPDATE rvn_kpi_definitions SET current_definition_version_id = NULL WHERE organization_id = $1`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_kpi_definition_versions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_definitions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [ORG_ID]);

    // ---- Cleanup: 4 poisoned legacy rows ----
    // `kpis` is a read-only VIEW (see file header DEVIATION note) — clean up
    // its underlying tables instead; `initiative_kpis` has
    // `ON DELETE CASCADE` from `initiatives`, but delete it explicitly first
    // for clarity/robustness regardless of that cascade.
    await client.query(`DELETE FROM initiative_kpis WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM initiatives WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM organizations WHERE id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM kpi_definitions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM v8_kpi_definitions WHERE organization_id = $1`, [ORG_ID]);
    // tp_kpi_definitions has no organization_id column of its own (see
    // kpiLegacyArchiveRepository.ts's DEVIATION note) — deleting the
    // tp_bases row cascades to tp_governed_models and tp_kpi_definitions
    // (ON DELETE CASCADE, server/migrations/713_governed_models.sql).
    await client.query(`DELETE FROM tp_bases WHERE organization_id = $1`, [ORG_ID]);

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
    'one real control KPI + 4 poisoned legacy rows (same org, similar code) — vNext read models see ' +
      'ONLY the control row, never the legacy rows',
    async () => {
      // ---- 1. Setup: one real, OPEN_ORG-visible KPI through the normal
      // rvn_kpi_* path (same recipe as kpiIdentityAcrossSurfaces.realdb.test.ts). ----
      const policyResult = await client.query<{ policy_id: string }>(
        `INSERT INTO rvn_platform_visibility_policies
           (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
         VALUES ($1, 'kpi', 1, 'OPEN_ORG', true, $2)
         RETURNING policy_id`,
        [ORG_ID, USER]
      );
      const policyId = policyResult.rows[0]!.policy_id;

      controlKpiId = randomUUID();
      controlVersionId = randomUUID();
      controlMeasurementId = randomUUID();
      controlCaseId = randomUUID();

      await client.query(
        `INSERT INTO rvn_kpi_definitions (kpi_id, organization_id, kpi_code, status, owner_user_id, created_by)
         VALUES ($1, $2, $3, 'active', $4, $4)`,
        [controlKpiId, ORG_ID, SHARED_CODE, USER]
      );
      await client.query(
        `INSERT INTO rvn_kpi_definition_versions
           (definition_version_id, kpi_id, organization_id, version_number, name, unit, target_geometry,
            target_min, approval_status, created_by, effective_from, measurement_frequency_days)
         VALUES ($1, $2, $3, 1, 'Legacy isolation control KPI', 'unit', 'threshold_min', 100, 'approved', $4, now(), 30)`,
        [controlVersionId, controlKpiId, ORG_ID, USER]
      );
      await client.query(
        `UPDATE rvn_kpi_definitions SET current_definition_version_id = $1 WHERE kpi_id = $2`,
        [controlVersionId, controlKpiId]
      );
      await client.query(
        `INSERT INTO rvn_platform_resource_visibility
           (resource_type, resource_id, organization_id, visibility_mode, policy_id, owner_user_id)
         VALUES ('kpi', $1, $2, 'OPEN_ORG', $3, $4)`,
        [controlKpiId, ORG_ID, policyId, USER]
      );
      await client.query(
        `INSERT INTO rvn_kpi_measurements
           (measurement_id, kpi_id, definition_version_id, organization_id, period_start, period_end,
            actual_value, performance_status, source, recorded_by)
         VALUES ($1, $2, $3, $4, now() - interval '60 days', now() - interval '35 days', 10, 'critical', 'manual', $5)`,
        [controlMeasurementId, controlKpiId, controlVersionId, ORG_ID, USER]
      );
      // plan_submitted deviation case, owner=USER — deterministically drives
      // listMyKpis' branch_manager_decision_waiting for this user (same
      // fixture role as the identity test's own case).
      await client.query(
        `INSERT INTO rvn_kpi_deviation_cases
           (case_id, organization_id, kpi_id, trigger_measurement_id, severity, status,
            owner_user_id, manager_user_id, plan_submitted_by, plan_submitted_at, created_by)
         VALUES ($1, $2, $3, $4, 'critical', 'plan_submitted', $5, NULL, $5, now(), $5)`,
        [controlCaseId, ORG_ID, controlKpiId, controlMeasurementId, USER]
      );

      // ---- 2. Poison: raw pg.Client, bypassing every service, one row per
      // legacy table, same organization_id, code/name similar to control. ----
      // `kpis` is a read-only VIEW over `initiative_kpis JOIN initiatives`
      // (see file header DEVIATION note) — poison its underlying tables
      // instead; the view surfaces the row on its own.
      // `initiatives.organization_id` has a real FK to `organizations(id)`
      // — insert a minimal row so the poisoned initiative satisfies it.
      await client.query(`INSERT INTO organizations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`, [
        ORG_ID,
      ]);
      // -- DEVIATION FOUND ON REAL POSTGRES: `initiatives.status` DEFAULTs to
      // `'step3'`, a value its OWN `initiatives_status_check` CHECK
      // constraint does not allow (verified via `\d initiatives` on real
      // Postgres — a pre-existing schema defect unrelated to KPI-E007,
      // out of scope to fix here). `status` must be supplied explicitly.
      await client.query(
        `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, 'DRAFT')`,
        [poisonedInitiativeId, ORG_ID, 'Legacy isolation poisoned initiative']
      );
      await client.query(
        `INSERT INTO initiative_kpis (id, initiative_id, organization_id, name, target_value, unit)
         VALUES ($1, $2, $3, $4, 100, 'unit')`,
        [poisonedKpisId, poisonedInitiativeId, ORG_ID, SHARED_CODE]
      );
      await client.query(
        `INSERT INTO kpi_definitions (id, organization_id, name, code, category, unit, direction)
         VALUES ($1, $2, $3, $4, 'operational', 'unit', 'higher_better')`,
        [poisonedKpiDefinitionsId, ORG_ID, 'Legacy isolation control KPI', SHARED_CODE]
      );
      await client.query(
        `INSERT INTO v8_kpi_definitions
           (kpi_id, organization_id, name, mode, metric_type, measurement_cadence, status)
         VALUES ($1, $2, $3, 'standalone', 'count', 'monthly', 'active')`,
        [poisonedV8Id, ORG_ID, SHARED_CODE]
      );
      const tpBaseResult = await client.query<{ id: string }>(
        `INSERT INTO tp_bases (workspace_id, organization_id, name) VALUES ($1, $2, $3) RETURNING id`,
        [`kpi-e007-legacy-iso-ws-${tag}`, ORG_ID, 'Legacy isolation control workspace']
      );
      poisonedTpBaseId = tpBaseResult.rows[0]!.id;
      const tpModelResult = await client.query<{ model_id: string }>(
        `INSERT INTO tp_governed_models (base_id, name) VALUES ($1, $2) RETURNING model_id`,
        [poisonedTpBaseId, 'Legacy isolation control model']
      );
      poisonedTpModelId = tpModelResult.rows[0]!.model_id;
      const tpKpiResult = await client.query<{ kpi_id: string }>(
        `INSERT INTO tp_kpi_definitions (model_id, code, label_en, formula_type)
         VALUES ($1, $2, $3, 'field_sum') RETURNING kpi_id`,
        [poisonedTpModelId, SHARED_CODE, 'Legacy isolation control KPI']
      );
      poisonedTpKpiId = tpKpiResult.rows[0]!.kpi_id;

      const poisonedIds = new Set([poisonedKpisId, poisonedKpiDefinitionsId, poisonedV8Id, poisonedTpKpiId]);

      // ---- 3. Negative assertion: none of the 3 vNext read models ever
      // surface a poisoned row, by id or by the shared code. ----
      const portfolio = await listKpis({ userId: USER, organizationId: ORG_ID });
      expect(
        portfolio.length,
        'listKpis returned more than the 1 control row — ORG_ID is a fresh unique tag for this test run, ' +
          'so any extra row is either leaked legacy data or a fixture-setup bug'
      ).toBe(1);
      for (const item of portfolio) {
        expect(poisonedIds.has(item.kpiId)).toBe(false);
        expect(item.kpiId).not.toBe(poisonedTpKpiId);
      }

      const myKpis = await listMyKpis({ userId: USER, organizationId: ORG_ID });
      for (const item of myKpis) {
        expect(poisonedIds.has(item.kpiId)).toBe(false);
      }

      const orgAttention = await listOrganizationKpiAttention({ managerId: USER, organizationId: ORG_ID });
      for (const row of orgAttention.overdueObligations) {
        expect(poisonedIds.has(row.kpiId)).toBe(false);
      }
      for (const row of orgAttention.repeatedDeviations) {
        expect(poisonedIds.has(row.kpiId)).toBe(false);
      }
      for (const row of orgAttention.missingOwnership) {
        expect(poisonedIds.has(row.kpiId)).toBe(false);
      }

      // ---- 4. Positive assertion: the control KPI MUST appear in all 3
      // read models — guards against this test passing vacuously on an
      // empty/broken result. Distinct failure messages so a red run tells a
      // future maintainer "isolation broken" vs "setup broken". ----
      const portfolioMatch = portfolio.find((k) => k.kpiId === controlKpiId);
      expect(
        portfolioMatch,
        'SETUP BROKEN (not isolation): control KPI missing from listKpis — fixture insert likely failed'
      ).toBeDefined();
      expect(typeof portfolioMatch?.kpiId).toBe('string');

      const myKpisMatch = myKpis.find((item) => item.kpiId === controlKpiId);
      expect(
        myKpisMatch,
        'SETUP BROKEN (not isolation): control KPI missing from listMyKpis — plan_submitted deviation case fixture likely failed'
      ).toBeDefined();

      const ownerLoadMatch = orgAttention.ownerLoad.find((row) => row.ownerUserId === USER);
      expect(
        ownerLoadMatch,
        'SETUP BROKEN (not isolation): USER missing from listOrganizationKpiAttention.ownerLoad — control KPI status/owner fixture likely failed'
      ).toBeDefined();
      expect(ownerLoadMatch?.activeKpiCount).toBeGreaterThanOrEqual(1);
    }
  );

  describe('Static — zero legacy-table references in kpiRepository.ts / kpiPerspectivesRepository.ts', () => {
    it('neither file references kpis / kpi_definitions / v8_kpi_definitions / tp_kpi_definitions', () => {
      const repoFile = path.resolve(
        __dirname,
        '../../../server/src/services/resultsVnext/kpi/kpiRepository.ts'
      );
      const perspectivesFile = path.resolve(
        __dirname,
        '../../../server/src/services/resultsVnext/kpi/kpiPerspectivesRepository.ts'
      );
      // Word-boundary regex: does NOT match `rvn_kpi_definitions` (preceded
      // by `_`, a word character, so `\b` fails right before `kpi_definitions`
      // there) — only matches a bare, standalone legacy table name.
      const legacyTableRef = /\b(kpis|kpi_definitions|v8_kpi_definitions|tp_kpi_definitions)\b/;

      for (const file of [repoFile, perspectivesFile]) {
        const source = readFileSync(file, 'utf8');
        const matches = source.match(new RegExp(legacyTableRef, 'g')) ?? [];
        expect(matches, `${path.basename(file)} references a legacy table by name: ${JSON.stringify(matches)}`).toEqual(
          []
        );
      }
    });
  });
});
