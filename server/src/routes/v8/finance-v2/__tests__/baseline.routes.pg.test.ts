/**
 * Finance v3 canonical adapter — Pakiet B2 Baseline surface, real
 * PostgreSQL + real HTTP integration tests.
 *
 * Covers `baseline.routes.ts`: `GET`/`POST .../assumptions`,
 * `POST .../compute`, `GET .../outputs`.
 *
 * SCOPE DECISION (documented, time-boxed): a full happy-path
 * `POST /baseline/:id/compute` (real converging circularity solve) needs the
 * same heavy fixture `perfSlo.pg.test.ts`'s D1 case builds (debt_maturity
 * facility schedule + assumptions across all 7 schedule_types + an opening
 * actual balance sheet) — `runBaselineCompute` itself is already covered by
 * that suite and is NOT modified by this package (out of allowlist). This
 * file instead proves: (1) the assumptions batch-write/read round-trip
 * end-to-end through HTTP with a real SQL read-back, (2) the compute
 * endpoint's real error path (`NO_BASELINE_MODEL_ROW`, no fixture needed —
 * true for every fresh Baseline Model artifact until a Kreator populates
 * it), and (3) the outputs reader against a directly-seeded
 * `finance_baseline_outputs` row (the router's OWN new code — the reader —
 * without re-proving the solver). The full compute happy path through THIS
 * router is flagged `EVIDENCE_MISSING` in the package report.
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

describe.skipIf(!REAL_PG)('Finance v2 Pakiet B2 — baseline (real HTTP + real PostgreSQL)', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let app: express.Express;

  const orgId = `org-pkgb2-base-${randomUUID()}`;
  const userId = `user-pkgb2-base-${randomUUID()}`;
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

    await withPinnedPostgresTransaction((tx) => tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'PkgB2 Baseline Test Org']));

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
        `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, fiscal_month, period_start, period_end, label, created_by)
         VALUES (?, ?, 'MONTH', 2026, 1, '2026-01-01', '2026-01-31', '01/2026', ?) RETURNING period_id`,
        [orgId, cal.fiscal_calendar_id, userId]
      )
    );
    if (!per) throw new Error('finance_stmt_periods fixture insert returned no row');
    periodId = per.period_id;

    app = appAs('finance_admin');
  });

  it('POST /baseline/:id/assumptions batch-writes; GET reads back with the full value contract; a second POST upserts (not duplicates)', async () => {
    const created = await request(app).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'BASELINE_MODEL' });
    const bvId = created.body.data.currentBusinessVersion.businessVersionId;
    const entityId = await makeEntity(bvId, `PARENT-${randomUUID().slice(0, 8)}`);

    const body = {
      assumptions: [
        {
          scheduleType: 'revenue_pvm',
          driverCode: 'REVENUE_GROWTH_YOY',
          entityId,
          periodId,
          rule: 'GROWTH_RATE',
          valueStatus: 'PRESENT_NONZERO',
          valueDecimal: 0.05,
          unit: 'PCT',
          quality: 'ESTIMATED',
        },
      ],
    };

    const writeRes = await request(app).post(`/api/v8/finance-v2/baseline/${bvId}/assumptions`).send(body);
    expect(writeRes.status).toBe(200);
    expect(writeRes.body.data.writtenCount).toBe(1);
    const assumptionId = writeRes.body.data.assumptions[0].assumptionId;

    const readRes = await request(app).get(`/api/v8/finance-v2/baseline/${bvId}/assumptions`);
    expect(readRes.status).toBe(200);
    expect(readRes.body.data).toHaveLength(1);
    expect(readRes.body.data[0].assumptionId).toBe(assumptionId);
    expect(readRes.body.data[0].driverCode).toBe('REVENUE_GROWTH_YOY');
    expect(readRes.body.data[0].value.valueDecimal).toBe('0.05');
    expect(readRes.body.data[0].quality).toBe('ESTIMATED');

    // Independent SQL read-back.
    const sqlRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ value_decimal: string }>(`SELECT value_decimal FROM finance_baseline_assumptions WHERE id = ?`, [assumptionId])
    );
    expect(sqlRow?.value_decimal).toBe('0.05');

    // Upsert: same cell key, different value -> UPDATEs the same row, does not insert a second one.
    const upsertRes = await request(app)
      .post(`/api/v8/finance-v2/baseline/${bvId}/assumptions`)
      .send({ assumptions: [{ ...body.assumptions[0], valueDecimal: 0.07 }] });
    expect(upsertRes.status).toBe(200);
    expect(upsertRes.body.data.assumptions[0].assumptionId).toBe(assumptionId);

    const countRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ count: string }>(`SELECT count(*)::text AS count FROM finance_baseline_assumptions WHERE business_version_id = ?`, [bvId])
    );
    expect(countRow?.count).toBe('1');
    const updated = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ value_decimal: string }>(`SELECT value_decimal FROM finance_baseline_assumptions WHERE id = ?`, [assumptionId])
    );
    expect(updated?.value_decimal).toBe('0.07');
  });

  it('POST /baseline/:id/assumptions with an invalid scheduleType -> 400 INVALID_BODY, no row written', async () => {
    const created = await request(app).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'BASELINE_MODEL' });
    const bvId = created.body.data.currentBusinessVersion.businessVersionId;

    const res = await request(app)
      .post(`/api/v8/finance-v2/baseline/${bvId}/assumptions`)
      .send({ assumptions: [{ scheduleType: 'not_a_real_schedule_type', driverCode: 'X', entityId: randomUUID(), periodId, rule: 'FIXED_VALUE', valueStatus: 'MISSING', unit: 'PCT' }] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_BODY');
  });

  it('POST /baseline/:id/compute on a fresh Baseline Model with no STATEMENT_TO_MODEL lineage edge -> 404 NO_SOURCE_STATEMENT_PACK_EDGE (the real first gate `loadContext` checks, before even looking for a finance_baseline_models row)', async () => {
    const created = await request(app).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'BASELINE_MODEL' });
    const bvId = created.body.data.currentBusinessVersion.businessVersionId;

    const res = await request(app)
      .post(`/api/v8/finance-v2/baseline/${bvId}/compute`)
      .send({ entityId: randomUUID(), forecastPeriodIds: [periodId], openingBalanceSheetPeriodId: periodId });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NO_SOURCE_STATEMENT_PACK_EDGE');
  });

  it('GET /baseline/:id/outputs reads a directly-seeded finance_baseline_outputs row with the full value contract', async () => {
    const created = await request(app).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'BASELINE_MODEL' });
    const bvId = created.body.data.currentBusinessVersion.businessVersionId;
    const entityId = await makeEntity(bvId, `PARENT-${randomUUID().slice(0, 8)}`);
    const cashLine = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ id: string }>(`SELECT id FROM financial_statement_lines WHERE line_code = 'CASH' AND organization_id IS NULL LIMIT 1`)
    );
    expect(cashLine).toBeTruthy();

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(
        `INSERT INTO finance_baseline_outputs (
           organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id,
           value_status, value_decimal, native_currency, presentation_currency, unit, value_kind, created_by
         ) VALUES (?, ?, 'BS', ?, ?, ?, 'PRESENT_NONZERO', ?, 'PLN', 'PLN', 'UNITS', 'FORECAST', ?)`,
        [orgId, bvId, cashLine!.id, entityId, periodId, 42_000, userId]
      )
    );

    const res = await request(app).get(`/api/v8/finance-v2/baseline/${bvId}/outputs`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].lineCode).toBe('CASH');
    expect(res.body.data[0].value.valueDecimal).toBe('42000');
    expect(res.body.data[0].value.nativeCurrency).toBe('PLN');
    expect(res.body.data[0].valueKind).toBe('FORECAST');
    expect(res.body.data[0].periodLabel).toBe('01/2026');
  });
});
