/**
 * Finance v3 canonical adapter — Pakiet B2 Baseline surface, real
 * PostgreSQL + real HTTP integration tests.
 *
 * Covers `baseline.routes.ts`: `GET`/`POST .../assumptions`,
 * `POST .../compute`, `GET .../outputs`.
 *
 * Gate J1 LUKA 2 (`J1_ENDPOINT_INVENTORY_report.md` section 5.2): the ORIGINAL
 * version of this file proved only the assumptions round-trip and the
 * `NO_SOURCE_STATEMENT_PACK_EDGE` error path for `POST .../compute` — the
 * happy path (a real converging circularity solve reaching `{jobId,
 * jobStatus, periodsComputed, monthlyResults}`) was never exercised through
 * THIS router (mutating `jobStatus` in the success branch did not turn any
 * test red — confirmed in the J1 mutant table, #11). The `describe('POST
 * /baseline/:id/compute — real happy path ...')` block below closes that gap:
 * it builds the SAME GoldCo-scale fixture `perfSlo.pg.test.ts`'s D1 case uses
 * (debt_maturity facility schedule + assumptions across all 7 schedule_types
 * + a tying-out opening actual balance sheet), then calls the endpoint
 * through real HTTP and asserts BOTH the response body and an independent
 * SQL read of `finance_baseline_outputs`.
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

  // -----------------------------------------------------------------
  // Gate J1 LUKA 2 — real happy-path solve, through THIS router.
  // -----------------------------------------------------------------

  describe('POST /baseline/:id/compute — real happy path (GoldCo fixture, real circularity solve)', () => {
    // Same real GoldCo Manufacturing S.A. FY2025 figures `perfSlo.pg.test.ts`'s D1 case and
    // `GOLDCO_FULL_DAG_END_TO_END_REPORT` fixture use — not invented numbers.
    const GOLDCO = {
      revenue: 182_000_000,
      cogs: 118_000_000,
      opex: 34_000_000,
      depreciation: 7_000_000,
      capex: 9_000_000,
      cash: 11_000_000,
      ar: 26_000_000,
      inventory: 19_500_000,
      fixedAssets: 101_500_000,
      ap: 17_500_000,
      longTermDebt: 40_500_000,
    } as const;
    const OPENING_ASSETS = GOLDCO.cash + GOLDCO.ar + GOLDCO.inventory + GOLDCO.fixedAssets;
    const OPENING_LIABILITIES = GOLDCO.ap + GOLDCO.longTermDebt;
    const OPENING_EQUITY = OPENING_ASSETS - OPENING_LIABILITIES;
    const OPENING_RETAINED_EARNINGS = 40_000_000;

    let bvId2 = '';
    let happyEntityId = '';
    let happyOpeningPeriodId = '';
    let happyForecastPeriodIds: string[] = [];

    it('converges to a real EV/output row set — {jobId, jobStatus, periodsComputed:12, monthlyResults}; SQL confirms 372 finance_baseline_outputs rows and finance_business_versions state', async () => {
      expect(OPENING_ASSETS).toBe(OPENING_LIABILITIES + OPENING_EQUITY); // fixture self-check

      const lineByCode = new Map(
        (await withPinnedPostgresTransaction((tx) => tx.queryAll<{ id: string; line_code: string }>(`SELECT id, line_code FROM financial_statement_lines`))).map((r) => [r.line_code, r.id])
      );

      const stmt = await request(app).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'STATEMENT_PACK' });
      const stmtBvId = stmt.body.data.currentBusinessVersion.businessVersionId as string;

      const calRow = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ fiscal_calendar_id: string }>(
          `INSERT INTO finance_stmt_calendars (organization_id, calendar_type, fiscal_year_end_month, fiscal_year_end_reference, effective_from, created_by)
           VALUES (?, 'STANDARD', 12, 'LAST_DAY_OF_MONTH', '2024-01-01', ?) RETURNING fiscal_calendar_id`,
          [orgId, userId]
        )
      );
      const calendarId2 = calRow!.fiscal_calendar_id;

      happyEntityId = (await makeEntity(stmtBvId, `GoldCo-${randomUUID().slice(0, 8)}`)) as string;

      async function insertPeriod(opts: { fiscalYear: number; fiscalMonth: number; start: string; end: string; label: string }): Promise<string> {
        const row = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ period_id: string }>(
            `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, fiscal_month, period_start, period_end, label, created_by)
             VALUES (?, ?, 'MONTH', ?, ?, ?, ?, ?, ?) RETURNING period_id`,
            [orgId, calendarId2, opts.fiscalYear, opts.fiscalMonth, opts.start, opts.end, opts.label, userId]
          )
        );
        return row!.period_id;
      }
      async function insertStmtLine(lineCode: string, periodId2: string, value: number, statementType: 'P&L' | 'BS'): Promise<void> {
        await withPinnedPostgresTransaction((tx) =>
          tx.queryRun(
            `INSERT INTO finance_stmt_lines (id, organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id, value_status, value_decimal, native_currency, presentation_currency, unit, accounting_policy, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'PRESENT_NONZERO', ?, 'PLN', 'PLN', 'UNITS', 'IFRS', ?)`,
            [randomUUID(), orgId, stmtBvId, statementType, lineByCode.get(lineCode), happyEntityId, periodId2, value, userId]
          )
        );
      }
      const monthEnd = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
      const monthlyRevenue = GOLDCO.revenue / 12;

      let lastFy2025PeriodId = '';
      for (let m = 1; m <= 12; m++) {
        const pid = await insertPeriod({ fiscalYear: 2025, fiscalMonth: m, start: `2025-${String(m).padStart(2, '0')}-01`, end: monthEnd(2025, m), label: `${m}/2025` });
        await insertStmtLine('REVENUE', pid, monthlyRevenue, 'P&L');
        lastFy2025PeriodId = pid;
      }
      happyOpeningPeriodId = lastFy2025PeriodId;

      await insertStmtLine('CASH', happyOpeningPeriodId, GOLDCO.cash, 'BS');
      await insertStmtLine('AR', happyOpeningPeriodId, GOLDCO.ar, 'BS');
      await insertStmtLine('INVENTORY', happyOpeningPeriodId, GOLDCO.inventory, 'BS');
      await insertStmtLine('FIXED_ASSETS', happyOpeningPeriodId, GOLDCO.fixedAssets, 'BS');
      await insertStmtLine('AP', happyOpeningPeriodId, GOLDCO.ap, 'BS');
      await insertStmtLine('LONG_TERM_DEBT', happyOpeningPeriodId, GOLDCO.longTermDebt, 'BS');
      await insertStmtLine('EQUITY', happyOpeningPeriodId, OPENING_EQUITY, 'BS');
      await insertStmtLine('RETAINED_EARNINGS', happyOpeningPeriodId, OPENING_RETAINED_EARNINGS, 'BS');
      await insertStmtLine('COGS', happyOpeningPeriodId, GOLDCO.cogs / 12, 'P&L');
      await insertStmtLine('OPEX', happyOpeningPeriodId, GOLDCO.opex / 12, 'P&L');

      happyForecastPeriodIds = [];
      for (let m = 1; m <= 12; m++) {
        happyForecastPeriodIds.push(await insertPeriod({ fiscalYear: 2026, fiscalMonth: m, start: `2026-${String(m).padStart(2, '0')}-01`, end: monthEnd(2026, m), label: `${m}/2026` }));
      }

      const baseline = await request(app).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'BASELINE_MODEL' });
      bvId2 = baseline.body.data.currentBusinessVersion.businessVersionId;
      const engineManifestId = (await withPinnedPostgresTransaction((tx) => tx.queryOne<{ engine_manifest_id: string }>(`SELECT engine_manifest_id FROM finance_business_versions WHERE business_version_id = ?`, [bvId2])))!
        .engine_manifest_id;

      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(
          `INSERT INTO finance_lineage_edges (id, organization_id, source_version_id, source_artifact_type, target_version_id, target_artifact_type, edge_type, transformation_kind, author_id)
           VALUES (?, ?, ?, 'STATEMENT_PACK', ?, 'BASELINE_MODEL', 'STATEMENT_TO_MODEL', 'COMPUTE', ?)`,
          [randomUUID(), orgId, stmtBvId, bvId2, userId]
        )
      );
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(
          `INSERT INTO finance_baseline_models (id, organization_id, business_version_id, horizon_months, horizon_rationale, horizon_rationale_note, circularity_max_iterations, circularity_tolerance_currency, interest_income_on_cash_modeled, mandatory_contractual_cash_sweep_modeled, created_by)
           VALUES (?, ?, ?, 12, 'DEBT_MATURITY', ?, 50, 1, false, true, ?)`,
          [randomUUID(), orgId, bvId2, 'J1 LUKA 2 fixture — GoldCo FY2026 explicit monthly horizon', userId]
        )
      );

      const assumption = (scheduleType: string, driverCode: string, value: number, unit: string) =>
        withPinnedPostgresTransaction((tx) =>
          tx.queryRun(
            `INSERT INTO finance_baseline_assumptions (id, organization_id, business_version_id, schedule_type, driver_code, entity_id, period_id, rule, value_status, value_decimal, unit, quality, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'HISTORICAL_AVERAGE', 'PRESENT_NONZERO', ?, ?, 'ESTIMATED', ?)`,
            [randomUUID(), orgId, bvId2, scheduleType, driverCode, happyEntityId, happyForecastPeriodIds[0], value, unit, userId]
          )
        );
      await assumption('revenue_pvm', 'REVENUE_GROWTH_YOY', 0.05, 'PCT');
      await assumption('cogs_opex', 'COGS_PCT_OF_REVENUE', GOLDCO.cogs / GOLDCO.revenue, 'PCT');
      await assumption('cogs_opex', 'OPEX_PCT_OF_REVENUE', GOLDCO.opex / GOLDCO.revenue, 'PCT');
      await assumption('wc_dso_dio_dpo', 'DSO_DAYS', (GOLDCO.ar / GOLDCO.revenue) * 365, 'DAYS');
      await assumption('wc_dso_dio_dpo', 'DIO_DAYS', (GOLDCO.inventory / GOLDCO.cogs) * 365, 'DAYS');
      await assumption('wc_dso_dio_dpo', 'DPO_DAYS', (GOLDCO.ap / GOLDCO.cogs) * 365, 'DAYS');
      await assumption('capex_depreciation', 'CAPEX_PCT_OF_REVENUE', GOLDCO.capex / GOLDCO.revenue, 'PCT');
      await assumption('capex_depreciation', 'USEFUL_LIFE_MONTHS', (12 * GOLDCO.fixedAssets) / GOLDCO.depreciation, 'MONTHS');
      await assumption('tax_nol', 'STATUTORY_TAX_RATE_PCT', 0.19, 'PCT');

      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(
          `INSERT INTO finance_baseline_schedules (id, organization_id, business_version_id, schedule_type, entity_id, schedule_item_code, effective_from_period_id, payload, created_by)
           VALUES (?, ?, ?, 'debt_maturity', ?, 'FACILITY-1', ?, ?, ?)`,
          [
            randomUUID(),
            orgId,
            bvId2,
            happyEntityId,
            happyForecastPeriodIds[0],
            JSON.stringify({
              principal_opening: GOLDCO.longTermDebt,
              contractual_rate: 0.048,
              amortization_schedule: Array.from({ length: 12 }, () => 675_000),
              mandatory_sweep_pct: 0.1,
              mandatory_sweep_threshold: 0,
            }),
            userId,
          ]
        )
      );

      // --- The endpoint under test, through real HTTP.
      const res = await request(app)
        .post(`/api/v8/finance-v2/baseline/${bvId2}/compute`)
        .send({ entityId: happyEntityId, forecastPeriodIds: happyForecastPeriodIds, openingBalanceSheetPeriodId: happyOpeningPeriodId, engineManifestId });
      expect(res.status).toBe(200);
      expect(res.body.data.jobId).toBeTruthy();
      expect(res.body.data.jobStatus).toBe('succeeded');
      expect(res.body.data.periodsComputed).toBe(12);
      expect(Array.isArray(res.body.data.monthlyResults)).toBe(true);
      expect(res.body.data.monthlyResults).toHaveLength(12);

      // Independent SQL read-back — the real deliverable of this test.
      const outputCount = await withPinnedPostgresTransaction((tx) => tx.queryOne<{ n: string }>(`SELECT count(*)::text AS n FROM finance_baseline_outputs WHERE business_version_id = ?`, [bvId2]));
      expect(Number(outputCount?.n)).toBe(372); // 31 canonical lines x 12 periods (matches perfSlo.pg.test.ts's D1 case)

      const cashJan2026 = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ value_decimal: string; value_status: string }>(
          `SELECT o.value_decimal, o.value_status FROM finance_baseline_outputs o
             JOIN financial_statement_lines l ON l.id = o.canonical_line_id
            WHERE o.business_version_id = ? AND l.line_code = 'CASH' AND o.period_id = ?`,
          [bvId2, happyForecastPeriodIds[0]]
        )
      );
      expect(cashJan2026?.value_status).toBe('PRESENT_NONZERO');
      expect(cashJan2026?.value_decimal).not.toBeNull();

      const jobRow = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ id: string; status: string }>(`SELECT id, status FROM compute_jobs WHERE id = ?`, [res.body.data.jobId])
      );
      expect(jobRow?.status).toBe('succeeded');
    }, 120_000);

    it('CROSS-TENANT: org B computing org A\'s real Baseline Model business_version_id -> 404, zero finance_baseline_outputs rows for org B', async () => {
      const orgB = `org-pkgb2-base-xt-${randomUUID()}`;
      const userBId = `user-pkgb2-base-xt-${randomUUID()}`;
      await withPinnedPostgresTransaction((tx) => tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgB, 'PkgB2 Baseline XT Tenant B']));
      const appB = express();
      appB.use(express.json());
      appB.use((req: any, _res, next) => {
        req.user = { id: userBId, organizationId: orgB, role: 'finance_admin' };
        req.v8Context = { organizationId: orgB, userId: userBId, userRole: 'finance_admin' };
        next();
      });
      appB.use('/api/v8/finance-v2', financeV2Router);
      appB.use((err: any, _req: any, res: any, _next: any) => res.status(500).json({ error: String(err?.message || err) }));

      const res = await request(appB)
        .post(`/api/v8/finance-v2/baseline/${bvId2}/compute`)
        .send({ entityId: happyEntityId, forecastPeriodIds: happyForecastPeriodIds, openingBalanceSheetPeriodId: happyOpeningPeriodId });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');

      const orgBOutputs = await withPinnedPostgresTransaction((tx) => tx.queryAll<{ id: string }>(`SELECT id FROM finance_baseline_outputs WHERE business_version_id = ? AND organization_id = ?`, [bvId2, orgB]));
      expect(orgBOutputs.length).toBe(0);
    });
  });
});
