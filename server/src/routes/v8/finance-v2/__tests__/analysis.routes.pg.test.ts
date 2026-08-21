/**
 * Finance v3 canonical adapter — Pakiet B2 Analysis surface, real
 * PostgreSQL + real HTTP integration tests.
 *
 * Covers `analysis.routes.ts`: `GET /analysis/kpi-catalog`,
 * `POST /analysis/:id/compute`, `GET /analysis/:id/kpi-values`. Fixture
 * pattern (Statement Pack line seeding, `STATEMENT_TO_ANALYSIS` lineage
 * edge, pre-created `finance_analysis_kpi_values` selection row) copied from
 * `services/finance/canonical/__tests__/kpiComputeService.pg.test.ts`'s own
 * `writeLine`/edge/selection-row setup — exercised THROUGH HTTP.
 */
import { randomUUID } from 'node:crypto';

import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

describe.skipIf(!REAL_PG)('Finance v2 Pakiet B2 — analysis (real HTTP + real PostgreSQL)', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let lineageService: typeof import('../../../../services/finance/canonical/lineageService.js');
  let app: express.Express;

  const orgId = `org-pkgb2-anlys-${randomUUID()}`;
  const userId = `user-pkgb2-anlys-${randomUUID()}`;
  let periodId = '';

  function appAs(role: string) {
    const a = express();
    a.use(express.json());
    a.use((req: any, _res, next) => {
      req.user = { id: userId, organizationId: orgId, role };
      req.v8Context = { organizationId: orgId, userId, userRole: role };
      next();
    });
    a.use('/api/v8/finance-v2', financeV2Router);
    a.use((err: any, _req: any, res: any, _next: any) =>
      res.status(500).json({ error: String(err?.message || err) })
    );
    return a;
  }
  let financeV2Router: express.Router;

  async function makeEntity(businessVersionId: string, entityCode: string) {
    const row = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ id: string }>(
        `INSERT INTO finance_stmt_entities (
           organization_id, business_version_id, entity_code, legal_name, role,
           consolidation_method, ownership_pct, functional_currency, created_by
         ) VALUES (?, ?, ?, ?, 'GROUP_PARENT', 'NOT_CONSOLIDATED', NULL, 'PLN', ?)
         RETURNING id`,
        [orgId, businessVersionId, entityCode, `${entityCode} legal name`, userId]
      )
    );
    if (!row) throw new Error('finance_stmt_entities fixture insert returned no row');
    return row.id;
  }

  async function writeLine(
    businessVersionId: string,
    entityId: string,
    lineCode: string,
    statementType: 'P&L' | 'BS' | 'CF',
    value: number
  ) {
    const line = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ id: string }>(
        `SELECT id FROM financial_statement_lines WHERE line_code = ? AND organization_id IS NULL LIMIT 1`,
        [lineCode]
      )
    );
    if (!line)
      throw new Error(`financial_statement_lines seed row not found for line_code=${lineCode}`);
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(
        `INSERT INTO finance_stmt_lines (
           organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id,
           accumulation_basis, consolidation_scope, value_status, value_decimal, native_currency,
           presentation_currency, unit, sign_convention, accounting_policy, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, 'FULL_YEAR', 'CONSOLIDATED', 'PRESENT_NONZERO', ?, 'PLN', 'PLN', 'UNITS', 'NATURAL', 'IFRS', ?)`,
        [orgId, businessVersionId, statementType, line.id, entityId, periodId, value, userId]
      )
    );
  }

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    lineageService = await import('../../../../services/finance/canonical/lineageService.js');
    financeV2Router = (await import('../index.js')).default;

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [
        orgId,
        'PkgB2 Analysis Test Org',
      ])
    );
    await withPinnedPostgresTransaction(async (tx) => {
      await tx.queryRun(
        `INSERT INTO users (id, email, password, first_name, last_name, role, organization_id)
         VALUES (?, ?, 'test', 'Analysis', 'Admin', 'ADMIN', ?)`,
        [userId, `${userId}@test.invalid`, orgId]
      );
      await tx.queryRun(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES (?, ?, ?, 'ADMIN', 'ACTIVE')`,
        [`membership-${userId}`, orgId, userId]
      );
    });

    const cal = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ fiscal_calendar_id: string }>(
        `INSERT INTO finance_stmt_calendars (organization_id, calendar_type, fiscal_year_end_month, effective_from, created_by)
         VALUES (?, 'STANDARD', 12, '2020-01-01', ?) RETURNING fiscal_calendar_id`,
        [orgId, userId]
      )
    );
    if (!cal) throw new Error('finance_stmt_calendars fixture insert returned no row');

    const per = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ period_id: string }>(
        `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, period_start, period_end, label, created_by)
         VALUES (?, ?, 'FY', 2025, '2025-01-01', '2025-12-31', 'FY2025', ?) RETURNING period_id`,
        [orgId, cal.fiscal_calendar_id, userId]
      )
    );
    if (!per) throw new Error('finance_stmt_periods fixture insert returned no row');
    periodId = per.period_id;

    app = appAs('finance_admin');
  });

  afterAll(async () => {
    if (!withPinnedPostgresTransaction) return;
    await withPinnedPostgresTransaction(async (tx) => {
      await tx.queryRun(
        `DELETE FROM organization_members WHERE organization_id = ? AND user_id = ?`,
        [orgId, userId]
      );
      await tx.queryRun(`DELETE FROM users WHERE id = ? AND organization_id = ?`, [userId, orgId]);
    });
  });

  it('GET /analysis/kpi-catalog returns the globally-seeded three-layer catalog, ACTIVE-only by default', async () => {
    const res = await request(app).get('/api/v8/finance-v2/analysis/kpi-catalog');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((r: any) => r.status === 'ACTIVE')).toBe(true);
    // Universal tier must be present (WP-D03 P0 catalog ships UNIVERSAL rows).
    expect(res.body.data.some((r: any) => r.tier === 'UNIVERSAL')).toBe(true);
    const currentRatio = res.body.data.find((r: any) => r.kpiCode === 'CURRENT_RATIO');
    expect(currentRatio).toBeTruthy();
    expect(currentRatio.unitType).toBeTruthy();
  });

  it("GET /analysis/kpi-catalog?tier=ORG_CUSTOM never leaks another org's custom KPI (org-scoped filter proven empty for a fresh org)", async () => {
    const res = await request(app).get('/api/v8/finance-v2/analysis/kpi-catalog?tier=ORG_CUSTOM');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('POST /analysis/:id/compute computes CURRENT_RATIO end-to-end; GET /analysis/:id/kpi-values reads it back with the full value contract', async () => {
    const av = await import('../../../../services/finance/canonical/artifactVersionService.js');
    const pack = await av.createArtifact({
      organizationId: orgId,
      artifactType: 'STATEMENT_PACK',
      createdBy: userId,
    });
    const packBvId = pack.businessVersion.business_version_id;
    const entityId = await makeEntity(packBvId, `PARENT-${randomUUID().slice(0, 8)}`);

    // CURRENT_RATIO = CURRENT_ASSETS / CURRENT_LIABILITIES (WP-D03 P0 catalog formula).
    await writeLine(packBvId, entityId, 'CURRENT_ASSETS', 'BS', 500_000);
    await writeLine(packBvId, entityId, 'CURRENT_LIABILITIES', 'BS', 250_000);

    const analysisCreated = await request(app)
      .post('/api/v8/finance-v2/artifacts')
      .send({ artifactType: 'HISTORICAL_ANALYSIS' });
    const analysisBvId = analysisCreated.body.data.currentBusinessVersion.businessVersionId;
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(
        `INSERT INTO finance_analysis_definitions (organization_id, business_version_id, purpose, analysis_type, entity_scope_mode, presentation_currency, unit, created_by)
         VALUES (?, ?, 'INTERNAL_REVIEW', 'STANDARD', 'GROUP_CONSOLIDATED', 'PLN', 'UNITS', ?)`,
        [orgId, analysisBvId, userId]
      )
    );

    const edge = await lineageService.insertEdge({
      organizationId: orgId,
      sourceVersionId: packBvId,
      sourceArtifactType: 'STATEMENT_PACK',
      targetVersionId: analysisBvId,
      targetArtifactType: 'HISTORICAL_ANALYSIS',
      edgeType: 'STATEMENT_TO_ANALYSIS',
      transformationKind: 'MANUAL_LINK',
      authorId: userId,
    });
    expect(edge.ok).toBe(true);

    const catalogRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ id: string }>(
        `SELECT id FROM finance_analysis_kpi_catalog WHERE kpi_code = 'CURRENT_RATIO' AND status = 'ACTIVE' LIMIT 1`
      )
    );
    expect(catalogRow).toBeTruthy();
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(
        `INSERT INTO finance_analysis_kpi_values (organization_id, business_version_id, kpi_catalog_id, entity_id, period_id)
         VALUES (?, ?, ?, ?, ?)`,
        [orgId, analysisBvId, catalogRow!.id, entityId, periodId]
      )
    );

    const computeRes = await request(app)
      .post(`/api/v8/finance-v2/analysis/${analysisBvId}/compute`)
      .send({});
    expect(computeRes.status).toBe(200);
    expect(computeRes.body.data.resultsCount).toBe(1);
    expect(computeRes.body.data.results[0].status).toBe('PRESENT_NONZERO');
    expect(computeRes.body.data.results[0].value).toBe(2); // 500,000 / 250,000

    const valuesRes = await request(app).get(
      `/api/v8/finance-v2/analysis/${analysisBvId}/kpi-values`
    );
    expect(valuesRes.status).toBe(200);
    expect(valuesRes.body.data).toHaveLength(1);
    const row = valuesRes.body.data[0];
    expect(row.kpiCode).toBe('CURRENT_RATIO');
    expect(row.tier).toBe('UNIVERSAL');
    expect(row.value.status).toBe('PRESENT_NONZERO');
    expect(row.value.valueDecimal).toBe('2');

    // Independent SQL read-back.
    const sqlRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ value_decimal: string }>(
        `SELECT value_decimal FROM finance_analysis_kpi_values WHERE business_version_id = ? AND kpi_catalog_id = ?`,
        [analysisBvId, catalogRow!.id]
      )
    );
    expect(sqlRow?.value_decimal).toBe('2');
  });

  it('POST /analysis/:id/compute with no STATEMENT_TO_ANALYSIS edge -> 404 NO_SOURCE_STATEMENT_PACK_EDGE', async () => {
    const created = await request(app)
      .post('/api/v8/finance-v2/artifacts')
      .send({ artifactType: 'HISTORICAL_ANALYSIS' });
    const bvId = created.body.data.currentBusinessVersion.businessVersionId;

    const res = await request(app).post(`/api/v8/finance-v2/analysis/${bvId}/compute`).send({});
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NO_SOURCE_STATEMENT_PACK_EDGE');
  });
});
