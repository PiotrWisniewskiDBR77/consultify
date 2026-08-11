/**
 * Finance v3 canonical adapter — Pakiet B2 Statements surface, real
 * PostgreSQL + real HTTP integration tests.
 *
 * Covers `statements.routes.ts`: `POST .../map`, `POST .../reconcile`,
 * `GET .../lines`, `GET .../reconciliation-runs`,
 * `GET .../reconciliation-runs/:id`. Fixture pattern (calendar/period/entity)
 * copied from `services/finance/canonical/__tests__/statementServices.pg.test.ts`'s
 * own `makeEntity`/period setup — same taxonomy/entity/period dimension rows,
 * exercised THROUGH HTTP this time instead of calling the service directly.
 *
 * Same env-var contract as this repo's other `.pg.test.ts` suites.
 */
import { randomUUID } from 'node:crypto';

import express from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

describe.skipIf(!REAL_PG)('Finance v2 Pakiet B2 — statements (real HTTP + real PostgreSQL)', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let app: express.Express;

  const orgId = `org-pkgb2-stmt-${randomUUID()}`;
  const userId = `user-pkgb2-stmt-${randomUUID()}`;
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
    a.use((err: any, _req: any, res: any, _next: any) => res.status(500).json({ error: String(err?.message || err) }));
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

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    financeV2Router = (await import('../index.js')).default;

    await withPinnedPostgresTransaction((tx) => tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'PkgB2 Statements Test Org']));

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

  it('POST /statements/:id/map -> maps a balanced set of lines; GET /statements/:id/lines reads them back with the full value contract', async () => {
    const created = await request(app).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'STATEMENT_PACK' });
    const bvId = created.body.data.currentBusinessVersion.businessVersionId;
    const entityId = await makeEntity(bvId, `PARENT-${randomUUID().slice(0, 8)}`);
    const entityCode = (
      await withPinnedPostgresTransaction((tx) => tx.queryOne<{ entity_code: string }>(`SELECT entity_code FROM finance_stmt_entities WHERE id = ?`, [entityId]))
    )?.entity_code;

    const mapRes = await request(app)
      .post(`/api/v8/finance-v2/statements/${bvId}/map`)
      .send({
        unit: 'UNITS',
        presentationCurrency: 'PLN',
        rawLines: [
          { lineItem: 'Total assets', periodId, entityCode, currency: 'PLN', value: 1_000_000, sourceRef: { page: 3 } },
          { lineItem: 'Total liabilities and equity', periodId, entityCode, currency: 'PLN', value: 1_000_000, sourceRef: { page: 3 } },
        ],
        rules: [
          { sourceLabel: 'Total assets', statementType: 'BS', lineCode: 'TOTAL_ASSETS' },
          { sourceLabel: 'Total liabilities and equity', statementType: 'BS', lineCode: 'TOTAL_LIABILITIES_EQUITY' },
        ],
      });
    expect(mapRes.status).toBe(201);
    expect(mapRes.body.data.mappedCount).toBe(2);
    expect(mapRes.body.data.results).toHaveLength(2);
    expect(mapRes.body.meta).toEqual({ version: 'v2', contract: 'finance_v3_canonical_v1' });

    const linesRes = await request(app).get(`/api/v8/finance-v2/statements/${bvId}/lines`);
    expect(linesRes.status).toBe(200);
    expect(linesRes.body.data).toHaveLength(2);
    const totalAssetsLine = linesRes.body.data.find((l: any) => l.lineCode === 'TOTAL_ASSETS');
    expect(totalAssetsLine).toBeTruthy();
    // Full value contract present in every line: period/entity/currency/scale/source/status.
    expect(totalAssetsLine.entityCode).toBe(entityCode);
    expect(totalAssetsLine.periodLabel).toBe('FY2025');
    expect(totalAssetsLine.value.status).toBe('PRESENT_NONZERO');
    expect(totalAssetsLine.value.valueDecimal).toBe('1000000');
    expect(totalAssetsLine.value.nativeCurrency).toBe('PLN');
    expect(totalAssetsLine.value.presentationCurrency).toBe('PLN');
    expect(totalAssetsLine.value.unit).toBe('UNITS');
    expect(totalAssetsLine.value.sourceRef).toEqual({ page: 3 });

    // Independent SQL read-back — never trust only the HTTP body.
    const sqlRows = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ id: string }>(`SELECT id FROM finance_stmt_lines WHERE business_version_id = ?`, [bvId])
    );
    expect(sqlRows.length).toBe(2);

    // --- Reconcile ---
    const reconcileRes = await request(app)
      .post(`/api/v8/finance-v2/statements/${bvId}/reconcile`)
      .send({ sourceSystem: 'test:pkgb2', mappingResults: mapRes.body.data.results });
    expect(reconcileRes.status).toBe(201);
    expect(reconcileRes.body.data.status).toBe('CLEAN');
    expect(reconcileRes.body.data.totals.residual).toBe(0);
    const reconciliationRunId = reconcileRes.body.data.reconciliationRunId;

    const runsRes = await request(app).get(`/api/v8/finance-v2/statements/${bvId}/reconciliation-runs`);
    expect(runsRes.status).toBe(200);
    expect(runsRes.body.data).toHaveLength(1);
    expect(runsRes.body.data[0].reconciliationRunId).toBe(reconciliationRunId);

    const runDetailRes = await request(app).get(`/api/v8/finance-v2/statements/reconciliation-runs/${reconciliationRunId}`);
    expect(runDetailRes.status).toBe(200);
    expect(runDetailRes.body.data.rows).toHaveLength(2);

    // SQL read-back for the run itself.
    const runRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ status: string }>(`SELECT status FROM finance_reconciliation_runs WHERE id = ?`, [reconciliationRunId])
    );
    expect(runRow?.status).toBe('CLEAN');
  });

  it('POST /statements/:id/map with a bad body -> 400 INVALID_BODY, no row written', async () => {
    const created = await request(app).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'STATEMENT_PACK' });
    const bvId = created.body.data.currentBusinessVersion.businessVersionId;

    const res = await request(app).post(`/api/v8/finance-v2/statements/${bvId}/map`).send({ unit: 'UNITS' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_BODY');

    const rows = await withPinnedPostgresTransaction((tx) => tx.queryAll(`SELECT id FROM finance_stmt_lines WHERE business_version_id = ?`, [bvId]));
    expect(rows.length).toBe(0);
  });

  it('GET /statements/:id/lines for a nonexistent business version -> 404 NOT_FOUND (montage proof: distinct from a truly unmounted path)', async () => {
    const res = await request(app).get(`/api/v8/finance-v2/statements/${randomUUID()}/lines`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');

    const notMounted = await request(app).get(`/api/v8/finance-v2/statements/this-path-does-not-exist-anywhere`);
    // `/statements/:businessVersionId/lines` requires the `/lines` suffix — a bare
    // `/statements/:x` has no matching route in this router at all.
    expect(notMounted.status).toBe(404);
    expect(notMounted.body).not.toHaveProperty('code');
  });
});
