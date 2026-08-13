/**
 * W2 FC-11 — PERFORMANCE MEASUREMENT + DECLARED REGRESSION CEILINGS.
 *
 * Originally (W9, part D) this file only MEASURED: it asserted nothing but a
 * generous 30s sanity ceiling, because no numeric threshold existed to
 * measure against. W2 (this revision) adds DECLARED REGRESSION CEILINGS —
 * see `perfSloThresholds.ts` — derived from two independent own n=20 runs
 * plus the two W9 runs cited below. These ceilings are a CI drift-detection
 * gate, NOT the production SLO gate FC-11 asks for: that remains
 * EVIDENCE_MISSING (see the three EVIDENCE_MISSING assertions at the bottom
 * of this file, and
 * `docs/validation/finance-v3/generated/gate-d/W2_FC11_SLO_report.md` for the
 * full reasoning — in short, this machine's run-to-run p50 varied by up to
 * ~9.3x with zero code changes, so no number measured here can honestly be
 * called a production budget).
 *
 * Original W9 framing, still true for the production-SLO half of the gate:
 * FC-11 in
 * `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`
 * §18 requires "declared SLO p50/p95/p99" and NO such number is declared
 * anywhere in the program documents or the schema. That gap is reported as
 * EVIDENCE_MISSING; the numbers produced here are a CI regression baseline,
 * not a production SLO.
 *
 * WHAT IS MEASURED (three compute paths named in the Fala 9 brief):
 *   D1  full Baseline compute — monthly, GoldCo's own 12-month FY2026 horizon,
 *       real circularity solver, 31 canonical lines per period (372 output rows)
 *   D2  Analysis KPI compute — the full 18-KPI P0 catalog
 *   D3  Valuation compute — DCF/FCFF over 3 projection years, plus the 5x5
 *       WACC x terminal-g sensitivity grid (25 cells)
 *
 * METHOD (stated so the numbers are reproducible, not folklore):
 *   - Own throwaway PostgreSQL 15 cluster, freshly migrated, nothing else on it.
 *   - One warm-up iteration per path, discarded (first call pays connection-pool
 *     ramp-up and Node JIT warm-up; including it would report the cold path as
 *     if it were steady state).
 *   - N measured iterations per path, each against a FRESH business version.
 *     A repeat against the SAME version is not a valid second sample: enqueue
 *     is idempotent on (org, job_type, idempotency_key) and the output tables
 *     are UNIQUE per cell, so iteration 2 would measure a different code path.
 *   - Only the compute call itself is timed (`performance.now()` around the
 *     service call). Fixture construction is outside the timer.
 *   - p50/p95 by nearest-rank on the sorted sample; min/max/spread reported so
 *     a reader can see the dispersion rather than trusting a single number.
 *
 * The measured numbers are printed to stdout AND asserted only against
 * generous sanity ceilings (a regression from ~1s to ~60s must fail the
 * build; a 20% drift must not, because there is no declared budget to hold it
 * to). Machine: whatever CI/laptop runs it — absolute values are only
 * comparable within one run.
 *
 * HOW TO RUN (own throwaway ephemeral cluster only — NEVER shared/demo/staging/prod):
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/<db> \
 *   npx vitest run --config vitest.config.ts \
 *     src/services/finance/canonical/__tests__/perfSlo.pg.test.ts \
 *     --no-file-parallelism
 *   (run from `server/`)
 */
import { randomUUID } from 'node:crypto';
import { appendFileSync } from 'node:fs';

import { beforeAll, describe, expect, it } from 'vitest';

import { PERF_REGRESSION_THRESHOLDS } from './perfSloThresholds.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';

/**
 * NEGATIVE-CONTROL HOOK ONLY — must be 0 (unset) on every real run. Set only
 * by the W2 FC-11 report's negative-control procedure to prove the
 * regression ceilings actually trip red on a slowdown, and to measure how
 * little slowdown it takes to trip them. Injected INSIDE the timed window of
 * the named path so it measures the gate, not the compute service (this file
 * does not touch computeJobService.ts or the four compute services — those
 * belong to other in-flight work).
 */
const INJECT_DELAY_MS = Number(process.env.W2_PERF_NEGATIVE_CONTROL_INJECT_MS ?? 0);
const INJECT_PATH = process.env.W2_PERF_NEGATIVE_CONTROL_PATH ?? '';
async function maybeInjectDelay(pathName: string): Promise<void> {
  if (INJECT_DELAY_MS > 0 && INJECT_PATH === pathName) {
    await new Promise((resolve) => setTimeout(resolve, INJECT_DELAY_MS));
  }
}
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

/** Measured iterations per path (plus one discarded warm-up). */
const REPS = Number(process.env.W9_PERF_REPS ?? 12);

interface Stats {
  n: number;
  minMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  spreadPct: number;
  samplesMs: number[];
}

function stats(samples: number[]): Stats {
  const sorted = [...samples].sort((a, b) => a - b);
  const nearestRank = (p: number) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
  const p50 = nearestRank(50);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  return {
    n: sorted.length,
    minMs: round(min),
    p50Ms: round(p50),
    p95Ms: round(nearestRank(95)),
    maxMs: round(max),
    spreadPct: round(((max - min) / p50) * 100),
    samplesMs: sorted.map(round),
  };
}
const round = (v: number) => Math.round(v * 100) / 100;

/**
 * This file's OUTPUT is the deliverable — a number that only exists inside an
 * assertion cannot be read by a human. `process.stdout.write` rather than
 * `console.log` because the server logger this suite transitively imports
 * takes over `console`, and the measurements must survive that. Set
 * `W9_PERF_OUT=/path/results.json` to also get a machine-readable record.
 */
function report(label: string, s: Stats): void {
  process.stdout.write(
    `\n[W9-D MEASURED] ${label}\n` +
      `    n=${s.n}  p50=${s.p50Ms} ms  p95=${s.p95Ms} ms  min=${s.minMs} ms  max=${s.maxMs} ms  spread=${s.spreadPct}% of p50\n` +
      `    samples(ms, sorted)=[${s.samplesMs.join(', ')}]\n`
  );
  const outPath = process.env.W9_PERF_OUT;
  if (outPath) appendFileSync(outPath, `${JSON.stringify({ label, ...s })}\n`, 'utf8');
}

// GoldCo Manufacturing S.A., PARENT, FY2025 actuals — the same figures the
// GOLDCO_FULL_DAG_END_TO_END_REPORT fixture uses, so this measurement is of a
// realistic model, not a toy one.
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
// Opening balance sheet must tie out: A = L + E.
const OPENING_ASSETS = GOLDCO.cash + GOLDCO.ar + GOLDCO.inventory + GOLDCO.fixedAssets; // 158,000,000
const OPENING_LIABILITIES = GOLDCO.ap + GOLDCO.longTermDebt; //                              58,000,000
const OPENING_EQUITY = OPENING_ASSETS - OPENING_LIABILITIES; //                             100,000,000
const OPENING_RETAINED_EARNINGS = 40_000_000;

describe.skipIf(!REAL_PG)('W9-D — compute performance baseline (real PostgreSQL)', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let av: typeof import('../artifactVersionService.js');
  let baselineSvc: typeof import('../baselineComputeService.js');
  let kpiSvc: typeof import('../kpiComputeService.js');
  let valuationSvc: typeof import('../valuationComputeService.js');
  let sensSvc: typeof import('../valuationSensitivityService.js');

  const orgId = `org-w9d-${randomUUID()}`;
  const userId = `user-w9d-${randomUUID()}`;

  let stmtBvId: string;
  let entityId: string;
  let engineManifestId: string;
  /** Dec-2025 period whose closing balance sheet seeds forecast period 0. */
  let openingPeriodId: string;
  /** FY2026, 12 MONTH periods, chronological. */
  let forecastPeriodIds: string[];
  /** FY2027 / FY2028 single YEAR periods, for the valuation's projection years 2 and 3. */
  let annualPeriodIds: string[];
  let lineIdByCode: Map<string, string>;

  const t = <T>(fn: (tx: any) => Promise<T>): Promise<T> => withPinnedPostgresTransaction(fn as never) as Promise<T>;

  async function insertPeriod(
    calendarId: string,
    opts: { type: 'MONTH' | 'FY'; fiscalYear: number; fiscalMonth: number | null; start: string; end: string; label: string }
  ): Promise<string> {
    const periodId = `per-${randomUUID()}`;
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_stmt_periods (period_id, organization_id, fiscal_calendar_id, period_type, fiscal_year,
           fiscal_month, period_start, period_end, label, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [periodId, orgId, calendarId, opts.type, opts.fiscalYear, opts.fiscalMonth, opts.start, opts.end, opts.label, userId]
      )
    );
    return periodId;
  }

  async function insertStmtLine(lineCode: string, periodId: string, value: number, statementType: 'P&L' | 'BS' | 'CF'): Promise<void> {
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_stmt_lines (id, organization_id, business_version_id, statement_type, canonical_line_id,
           entity_id, period_id, value_status, value_decimal, native_currency, presentation_currency, unit,
           accounting_policy, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'PRESENT_NONZERO', ?, 'PLN', 'PLN', 'UNITS', 'IFRS', ?)`,
        [randomUUID(), orgId, stmtBvId, statementType, lineIdByCode.get(lineCode), entityId, periodId, value, userId]
      )
    );
  }

  /** A fresh BASELINE_MODEL business version, fully configured, ready to compute. Not timed. */
  async function makeBaselineVersion(): Promise<string> {
    const artifact = await av.createArtifact({ organizationId: orgId, artifactType: 'BASELINE_MODEL', createdBy: userId });
    const bvId = artifact.businessVersion.business_version_id;

    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_lineage_edges (id, organization_id, source_version_id, source_artifact_type, target_version_id,
           target_artifact_type, edge_type, transformation_kind, author_id)
         VALUES (?, ?, ?, 'STATEMENT_PACK', ?, 'BASELINE_MODEL', 'STATEMENT_TO_MODEL', 'COMPUTE', ?)`,
        [randomUUID(), orgId, stmtBvId, bvId, userId]
      )
    );
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_baseline_models (id, organization_id, business_version_id, horizon_months, horizon_rationale,
           horizon_rationale_note, circularity_max_iterations, circularity_tolerance_currency,
           interest_income_on_cash_modeled, mandatory_contractual_cash_sweep_modeled, created_by)
         VALUES (?, ?, ?, 12, 'DEBT_MATURITY', ?, 50, 1, false, true, ?)`,
        [randomUUID(), orgId, bvId, 'GoldCo FY2026 explicit monthly horizon (matches the facility amortization cadence)', userId]
      )
    );

    const assumption = (scheduleType: string, driverCode: string, value: number, unit: string) =>
      t((tx) =>
        tx.queryRun(
          `INSERT INTO finance_baseline_assumptions (id, organization_id, business_version_id, schedule_type, driver_code,
             entity_id, period_id, rule, value_status, value_decimal, unit, quality, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'HISTORICAL_AVERAGE', 'PRESENT_NONZERO', ?, ?, 'ESTIMATED', ?)`,
          [randomUUID(), orgId, bvId, scheduleType, driverCode, entityId, forecastPeriodIds[0], value, unit, userId]
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

    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_baseline_schedules (id, organization_id, business_version_id, schedule_type, entity_id,
           schedule_item_code, effective_from_period_id, payload, created_by)
         VALUES (?, ?, ?, 'debt_maturity', ?, 'FACILITY-1', ?, ?, ?)`,
        [
          randomUUID(),
          orgId,
          bvId,
          entityId,
          forecastPeriodIds[0],
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
    return bvId;
  }

  /**
   * A fresh HISTORICAL_ANALYSIS business version sourced from the statement
   * pack, pre-seeded with one MISSING `finance_analysis_kpi_values` row per
   * ACTIVE catalog KPI. That seeding is what defines the work: `evaluateAllRows`
   * iterates the EXISTING value rows, so "compute the 18 KPIs" literally means
   * "evaluate these 18 rows". Not timed.
   */
  async function makeAnalysisVersion(): Promise<{ bvId: string; seededRows: number }> {
    const artifact = await av.createArtifact({ organizationId: orgId, artifactType: 'HISTORICAL_ANALYSIS', createdBy: userId });
    const bvId = artifact.businessVersion.business_version_id;
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_lineage_edges (id, organization_id, source_version_id, source_artifact_type, target_version_id,
           target_artifact_type, edge_type, transformation_kind, author_id)
         VALUES (?, ?, ?, 'STATEMENT_PACK', ?, 'HISTORICAL_ANALYSIS', 'STATEMENT_TO_ANALYSIS', 'COMPUTE', ?)`,
        [randomUUID(), orgId, stmtBvId, bvId, userId]
      )
    );
    const catalog = await t((tx) =>
      tx.queryAll<{ id: string }>(`SELECT id FROM finance_analysis_kpi_catalog WHERE status = 'ACTIVE' ORDER BY kpi_code`)
    );
    for (const kpiRow of catalog) {
      await t((tx) =>
        tx.queryRun(
          `INSERT INTO finance_analysis_kpi_values (id, organization_id, business_version_id, kpi_catalog_id, entity_id,
             period_id, value_status) VALUES (?, ?, ?, ?, ?, ?, 'MISSING')`,
          [randomUUID(), orgId, bvId, kpiRow.id, entityId, openingPeriodId]
        )
      );
    }
    return { bvId, seededRows: catalog.length };
  }

  /** A fresh VALUATION_CASE version sourced from `baselineBvId`, with complete WACC inputs. Not timed. */
  async function makeValuationVersion(baselineBvId: string): Promise<string> {
    const artifact = await av.createArtifact({ organizationId: orgId, artifactType: 'VALUATION_CASE', createdBy: userId });
    const bvId = artifact.businessVersion.business_version_id;
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_lineage_edges (id, organization_id, source_version_id, source_artifact_type, target_version_id,
           target_artifact_type, edge_type, transformation_kind, assumption_snapshot_hash, author_id)
         VALUES (?, ?, ?, 'BASELINE_MODEL', ?, 'VALUATION_CASE', 'MODEL_TO_VALUATION', 'COMPUTE', ?, ?)`,
        [randomUUID(), orgId, baselineBvId, bvId, `snapshot-${randomUUID()}`, userId]
      )
    );
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_valuation_wacc_inputs (id, organization_id, business_version_id, risk_free_rate_pct,
           equity_risk_premium_pct, beta_unlevered, target_capital_structure_debt_pct, target_capital_structure_equity_pct,
           cost_of_debt_pretax_pct, credit_spread_pct, cash_tax_rate_pct, currency, nominal_or_real, pre_or_post_tax, created_by)
         VALUES (?, ?, ?, 5.5, 5.0, 0.9, 30, 70, 6.0, 1.5, 19, 'PLN', 'NOMINAL', 'POST_TAX', ?)`,
        [randomUUID(), orgId, bvId, userId]
      )
    );
    return bvId;
  }

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    av = await import('../artifactVersionService.js');
    baselineSvc = await import('../baselineComputeService.js');
    kpiSvc = await import('../kpiComputeService.js');
    valuationSvc = await import('../valuationComputeService.js');
    sensSvc = await import('../valuationSensitivityService.js');

    await t((tx) => tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'W9 Perf Org (GoldCo-scale)']));

    const lineRows = await t((tx) =>
      tx.queryAll<{ id: string; line_code: string }>(`SELECT id, line_code FROM financial_statement_lines`)
    );
    lineIdByCode = new Map(lineRows.map((r) => [r.line_code, r.id]));

    // --- statement pack: FY2025 monthly actuals + Dec-2025 opening balance sheet
    const stmt = await av.createArtifact({ organizationId: orgId, artifactType: 'STATEMENT_PACK', createdBy: userId });
    stmtBvId = stmt.businessVersion.business_version_id;
    engineManifestId = stmt.businessVersion.engine_manifest_id;

    const calendarId = `cal-${randomUUID()}`;
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_stmt_calendars (fiscal_calendar_id, organization_id, calendar_type, fiscal_year_end_month,
           fiscal_year_end_reference, effective_from, created_by) VALUES (?, ?, 'STANDARD', 12, 'LAST_DAY_OF_MONTH', ?, ?)`,
        [calendarId, orgId, '2024-01-01', userId]
      )
    );

    entityId = `ent-${randomUUID()}`;
    await t((tx) =>
      tx.queryRun(
        `INSERT INTO finance_stmt_entities (id, organization_id, business_version_id, entity_code, legal_name, role,
           consolidation_method, ownership_pct, functional_currency, created_by)
         VALUES (?, ?, ?, 'PARENT', 'GoldCo Manufacturing S.A.', 'GROUP_PARENT', 'FULL', 100, 'PLN', ?)`,
        [entityId, orgId, stmtBvId, userId]
      )
    );

    const monthEnd = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    const monthlyRevenue = GOLDCO.revenue / 12;

    // FY2025 actual months — the PRIOR_YEAR_SAME_PERIOD revenue history the engine needs.
    const fy2025Months: string[] = [];
    for (let m = 1; m <= 12; m++) {
      const pid = await insertPeriod(calendarId, {
        type: 'MONTH',
        fiscalYear: 2025,
        fiscalMonth: m,
        start: `2025-${String(m).padStart(2, '0')}-01`,
        end: monthEnd(2025, m),
        label: `${m}/2025`,
      });
      fy2025Months.push(pid);
      await insertStmtLine('REVENUE', pid, monthlyRevenue, 'P&L');
    }
    openingPeriodId = fy2025Months[11];

    // Opening balance sheet on Dec-2025 — must tie out, or the engine's own
    // balance check aborts every run.
    await insertStmtLine('CASH', openingPeriodId, GOLDCO.cash, 'BS');
    await insertStmtLine('AR', openingPeriodId, GOLDCO.ar, 'BS');
    await insertStmtLine('INVENTORY', openingPeriodId, GOLDCO.inventory, 'BS');
    await insertStmtLine('FIXED_ASSETS', openingPeriodId, GOLDCO.fixedAssets, 'BS');
    await insertStmtLine('AP', openingPeriodId, GOLDCO.ap, 'BS');
    await insertStmtLine('LONG_TERM_DEBT', openingPeriodId, GOLDCO.longTermDebt, 'BS');
    await insertStmtLine('EQUITY', openingPeriodId, OPENING_EQUITY, 'BS');
    await insertStmtLine('RETAINED_EARNINGS', openingPeriodId, OPENING_RETAINED_EARNINGS, 'BS');
    expect(OPENING_ASSETS).toBe(OPENING_LIABILITIES + OPENING_EQUITY); // fixture self-check

    // Extra P&L actuals so the 18-KPI catalog has something real to chew on.
    await insertStmtLine('COGS', openingPeriodId, GOLDCO.cogs / 12, 'P&L');
    await insertStmtLine('OPEX', openingPeriodId, GOLDCO.opex / 12, 'P&L');

    // FY2026 forecast months.
    forecastPeriodIds = [];
    for (let m = 1; m <= 12; m++) {
      forecastPeriodIds.push(
        await insertPeriod(calendarId, {
          type: 'MONTH',
          fiscalYear: 2026,
          fiscalMonth: m,
          start: `2026-${String(m).padStart(2, '0')}-01`,
          end: monthEnd(2026, m),
          label: `${m}/2026`,
        })
      );
    }

    // FY2027/FY2028 annual periods — projection years 2 and 3 for the valuation.
    annualPeriodIds = [
      await insertPeriod(calendarId, { type: 'FY', fiscalYear: 2027, fiscalMonth: null, start: '2027-01-01', end: '2027-12-31', label: 'FY2027' }),
      await insertPeriod(calendarId, { type: 'FY', fiscalYear: 2028, fiscalMonth: null, start: '2028-01-01', end: '2028-12-31', label: 'FY2028' }),
    ];
  }, 300_000);

  // =========================================================================
  // D1 — full Baseline compute (monthly, GoldCo 12-month horizon)
  // =========================================================================
  it(
    'D1 — Baseline compute (monthly, 12-month GoldCo horizon, real circularity solver)',
    async () => {
      const samples: number[] = [];
      let lastPeriodsComputed = 0;
      let lastRowsWritten = 0;

      for (let i = 0; i < REPS + 1; i++) {
        const bvId = await makeBaselineVersion();

        const started = performance.now();
        await maybeInjectDelay('D1');
        const result = await baselineSvc.runBaselineCompute({
          organizationId: orgId,
          businessVersionId: bvId,
          requestedByUserId: userId,
          engineManifestId,
          entityId,
          forecastPeriodIds,
          openingBalanceSheetPeriodId: openingPeriodId,
        });
        const elapsed = performance.now() - started;

        if (!result.ok) throw new Error(`runBaselineCompute failed: ${result.code} — ${result.message}`);
        expect(result.periodsComputed).toBe(12);
        lastPeriodsComputed = result.periodsComputed;

        // Physical proof this iteration really did the work (30 canonical lines x 12 periods).
        const written = await t((tx) =>
          tx.queryOne<{ n: string }>(`SELECT count(*)::text AS n FROM finance_baseline_outputs WHERE business_version_id = ?`, [bvId])
        );
        lastRowsWritten = Number(written!.n);
        expect(lastRowsWritten).toBe(372); // 31 canonical lines x 12 periods

        if (i > 0) samples.push(elapsed); // i === 0 is the discarded warm-up
      }

      const s = stats(samples);
      report(`D1 Baseline compute — 12 monthly periods, ${lastRowsWritten} output rows/run, ${lastPeriodsComputed} periods`, s);

      // Declared CI regression ceiling (NOT a production SLO — see
      // perfSloThresholds.ts and the W2 FC-11 report for derivation).
      const T = PERF_REGRESSION_THRESHOLDS.D1_BASELINE;
      expect(
        s.p95Ms,
        `D1 Baseline p95=${s.p95Ms}ms exceeds regression ceiling ${T.ceilingMs}ms ` +
          `(= ${T.observedMaxP95Ms}ms observed-max-p95 × ${T.multiplier}). Basis: ${T.basis}.`
      ).toBeLessThan(T.ceilingMs);
    },
    600_000
  );

  // =========================================================================
  // D2 — Analysis KPI compute (18-KPI P0 catalog)
  // =========================================================================
  it(
    'D2 — Analysis KPI compute (full 18-indicator P0 catalog)',
    async () => {
      const catalogSize = await t((tx) =>
        tx.queryOne<{ n: string }>(`SELECT count(*)::text AS n FROM finance_analysis_kpi_catalog WHERE status = 'ACTIVE'`)
      );
      expect(Number(catalogSize!.n)).toBe(18); // the brief's "18 wskaźników", verified not assumed

      const samples: number[] = [];
      let lastComputed = 0;

      for (let i = 0; i < REPS + 1; i++) {
        const { bvId, seededRows } = await makeAnalysisVersion();
        expect(seededRows).toBe(18); // physical pre-state: 18 rows waiting to be evaluated

        const started = performance.now();
        await maybeInjectDelay('D2');
        const result = await kpiSvc.computeAnalysisKpis({
          organizationId: orgId,
          businessVersionId: bvId,
          requestedByUserId: userId,
          engineManifestId,
        });
        const elapsed = performance.now() - started;

        if (!result.ok) throw new Error(`computeAnalysisKpis failed: ${result.code} — ${result.message}`);
        lastComputed = result.results.length;
        expect(lastComputed).toBe(18); // every seeded KPI row was evaluated

        if (i > 0) samples.push(elapsed);
      }

      const s = stats(samples);
      report(`D2 Analysis KPI compute — ${lastComputed} of 18 catalog KPIs evaluated per run`, s);

      const T = PERF_REGRESSION_THRESHOLDS.D2_KPI;
      expect(
        s.p95Ms,
        `D2 KPI compute p95=${s.p95Ms}ms exceeds regression ceiling ${T.ceilingMs}ms ` +
          `(= ${T.observedMaxP95Ms}ms observed-max-p95 × ${T.multiplier}). Basis: ${T.basis}.`
      ).toBeLessThan(T.ceilingMs);
    },
    600_000
  );

  // =========================================================================
  // D3 — Valuation compute + 5x5 sensitivity grid
  // =========================================================================
  it(
    'D3 — Valuation DCF/FCFF compute plus a 5x5 sensitivity grid (25 cells)',
    async () => {
      // One shared Baseline supplies the projection-year cash flows. FY2027/FY2028
      // are the same "simple continuation" convention the GoldCo full-DAG fixture uses.
      const baselineBvId = await makeBaselineVersion();
      const baselineRun = await baselineSvc.runBaselineCompute({
        organizationId: orgId,
        businessVersionId: baselineBvId,
        requestedByUserId: userId,
        engineManifestId,
        entityId,
        forecastPeriodIds,
        openingBalanceSheetPeriodId: openingPeriodId,
      });
      if (!baselineRun.ok) throw new Error(`valuation fixture baseline failed: ${baselineRun.code}`);

      const annualSum = async (lineCode: string) => {
        const rows = await t((tx) =>
          tx.queryAll<{ value_decimal: string }>(
            `SELECT value_decimal FROM finance_baseline_outputs
              WHERE business_version_id = ? AND canonical_line_id = ? AND entity_id = ? AND period_id = ANY(?)`,
            [baselineBvId, lineIdByCode.get(lineCode), entityId, forecastPeriodIds]
          )
        );
        return rows.reduce((sum, r) => sum + Number(r.value_decimal), 0);
      };
      const closingFy2026 = async (lineCode: string) => {
        const row = await t((tx) =>
          tx.queryOne<{ value_decimal: string }>(
            `SELECT value_decimal FROM finance_baseline_outputs
              WHERE business_version_id = ? AND canonical_line_id = ? AND entity_id = ? AND period_id = ?`,
            [baselineBvId, lineIdByCode.get(lineCode), entityId, forecastPeriodIds[11]]
          )
        );
        return Number(row!.value_decimal);
      };

      const fy2026 = {
        EBIT: await annualSum('EBIT'),
        DEPRECIATION: await annualSum('DEPRECIATION'),
        CAPEX: await annualSum('CAPEX'),
        WORKING_CAPITAL: await closingFy2026('WORKING_CAPITAL'),
      };

      let previous = fy2026;
      for (const [index, periodId] of annualPeriodIds.entries()) {
        const grown = {
          EBIT: previous.EBIT * 1.03,
          DEPRECIATION: previous.DEPRECIATION * 1.03,
          CAPEX: previous.CAPEX * 1.03,
          WORKING_CAPITAL: previous.WORKING_CAPITAL * 1.03,
        };
        for (const [code, value] of Object.entries(grown)) {
          const statementType = code === 'CAPEX' ? 'CF' : code === 'WORKING_CAPITAL' ? 'BS' : 'P&L';
          await t((tx) =>
            tx.queryRun(
              `INSERT INTO finance_baseline_outputs (id, organization_id, business_version_id, statement_type,
                 canonical_line_id, entity_id, period_id, consolidation_scope, value_status, value_decimal,
                 native_currency, presentation_currency, unit, multiplier, value_kind, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'CONSOLIDATED', 'PRESENT_NONZERO', ?, 'PLN', 'PLN', 'UNITS', 1, 'FORECAST', ?)`,
              [randomUUID(), orgId, baselineBvId, statementType, lineIdByCode.get(code), entityId, periodId, value, userId]
            )
          );
        }
        previous = grown;
        void index;
      }

      const projectionYears = [
        { fiscalYear: 2026, periodIds: forecastPeriodIds },
        { fiscalYear: 2027, periodIds: [annualPeriodIds[0]] },
        { fiscalYear: 2028, periodIds: [annualPeriodIds[1]] },
      ];

      const dcfSamples: number[] = [];
      const gridSamples: number[] = [];
      let lastEv = 0;

      for (let i = 0; i < REPS + 1; i++) {
        const valuationBvId = await makeValuationVersion(baselineBvId);

        const dcfStarted = performance.now();
        await maybeInjectDelay('D3A');
        const dcf = await valuationSvc.runDcfFcffValuation({
          organizationId: orgId,
          valuationBusinessVersionId: valuationBvId,
          entityId,
          requestedByUserId: userId,
          engineManifestId,
          projectionYears,
          openingWorkingCapital: GOLDCO.ar + GOLDCO.inventory - GOLDCO.ap,
          terminal: { gPct: 2 },
        });
        const dcfElapsed = performance.now() - dcfStarted;
        if (!dcf.ok) throw new Error(`runDcfFcffValuation failed: ${dcf.code} — ${dcf.message}`);
        lastEv = dcf.enterpriseValue;

        // 5x5 WACC x terminal-g grid, built and persisted (25 cells).
        const baseWaccPct = dcf.wacc.waccPct;
        const baseGPct = 2;
        const grid = sensSvc.buildWaccByTerminalGGrid({
          axes: {
            wacc: [baseWaccPct - 1, baseWaccPct - 0.5, baseWaccPct, baseWaccPct + 0.5, baseWaccPct + 1],
            terminalG: [baseGPct - 1, baseGPct - 0.5, baseGPct, baseGPct + 0.5, baseGPct + 1],
          },
          years: dcf.fcffYears.map((y) => ({ fiscalYear: y.fiscalYear, fcff: y.fcff! })),
          fcffTerminalYear: dcf.fcffYears[dcf.fcffYears.length - 1].fcff!,
          baseWaccPct,
          baseGPct,
        });
        if (!grid.ok) throw new Error(`buildWaccByTerminalGGrid failed: ${grid.code}`);
        expect(grid.cells).toHaveLength(25);

        const gridStarted = performance.now();
        await maybeInjectDelay('D3B');
        const written = await sensSvc.writeSensitivityGrid({
          organizationId: orgId,
          methodId: dcf.methodId,
          gridLabel: 'W9D_WACC_X_TERMINAL_G',
          rowAxisVariable: 'WACC',
          columnAxisVariable: 'TERMINAL_G',
          cells: grid.cells,
          createdBy: userId,
        });
        const gridElapsed = performance.now() - gridStarted;

        const persisted = await t((tx) =>
          tx.queryOne<{ n: string }>(`SELECT count(*)::text AS n FROM finance_valuation_sensitivity_cells WHERE grid_id = ?`, [
            written.gridId,
          ])
        );
        expect(Number(persisted!.n)).toBe(25); // physical proof, not the return value

        if (i > 0) {
          dcfSamples.push(dcfElapsed);
          gridSamples.push(gridElapsed);
        }
      }

      const dcfStats = stats(dcfSamples);
      const gridStats = stats(gridSamples);
      const combined = stats(dcfSamples.map((v, idx) => v + gridSamples[idx]));

      report(`D3a Valuation DCF/FCFF compute — 3 projection years, EV=${Math.round(lastEv)}`, dcfStats);
      report('D3b Sensitivity grid persist — 5x5 = 25 cells', gridStats);
      report('D3  Valuation compute WITH the 5x5 sensitivity grid (D3a + D3b)', combined);

      // Individual sub-path ceilings, so a regression localized to just the
      // DCF solve or just the grid persist is not diluted by summing them.
      const dcfT = PERF_REGRESSION_THRESHOLDS.D3A_VALUATION_DCF;
      expect(
        dcfStats.p95Ms,
        `D3a Valuation DCF p95=${dcfStats.p95Ms}ms exceeds regression ceiling ${dcfT.ceilingMs}ms ` +
          `(= ${dcfT.observedMaxP95Ms}ms observed-max-p95 × ${dcfT.multiplier}). Basis: ${dcfT.basis}.`
      ).toBeLessThan(dcfT.ceilingMs);

      const gridT = PERF_REGRESSION_THRESHOLDS.D3B_SENSITIVITY_GRID;
      expect(
        gridStats.p95Ms,
        `D3b Sensitivity grid p95=${gridStats.p95Ms}ms exceeds regression ceiling ${gridT.ceilingMs}ms ` +
          `(= ${gridT.observedMaxP95Ms}ms observed-max-p95 × ${gridT.multiplier}). Basis: ${gridT.basis}.`
      ).toBeLessThan(gridT.ceilingMs);

      const combinedT = PERF_REGRESSION_THRESHOLDS.D3_VALUATION_WITH_GRID;
      expect(
        combined.p95Ms,
        `D3 Valuation+grid p95=${combined.p95Ms}ms exceeds regression ceiling ${combinedT.ceilingMs}ms ` +
          `(= ${combinedT.observedMaxP95Ms}ms observed-max-p95 × ${combinedT.multiplier}). Basis: ${combinedT.basis}.`
      ).toBeLessThan(combinedT.ceilingMs);
    },
    900_000
  );

  // =========================================================================
  // W2 FC-11 — inverted: three sub-claims that used to pin "nothing is
  // declared" now split into "regression ceilings ARE declared (in code)"
  // vs. "a PRODUCTION SLO is still NOT declared (in the schema)". See
  // docs/validation/finance-v3/generated/gate-d/W2_FC11_SLO_report.md §8 for
  // the full before/after narrative and the schema decision's rationale.
  // =========================================================================
  it('W2 (inverted #1-3): CI regression ceilings ARE now declared in code, paired with the schema facts they replace', () => {
    // #1 BEFORE (W9): no threshold table OR config existed anywhere in the
    //     codebase for any compute path — the only gate was a blanket 30s
    //     sanity ceiling, unable to tell a 20% regression from a healthy run.
    //   AFTER (W2): `perfSloThresholds.ts` declares five path-specific
    //     regression ceilings, each with a numeric basis (observed p95 ×
    //     multiplier) and a documented derivation. This is the literal
    //     inversion of the old "no threshold table/config" pin.
    const paths = Object.values(PERF_REGRESSION_THRESHOLDS);
    expect(paths).toHaveLength(5);

    // #2 BEFORE (W9): `expect(latencyColumns).toEqual([])` — no numeric
    //     shape (ms, p50, p95, p99) existed to hold a threshold anywhere.
    //   AFTER (W2): every declared threshold has a concrete positive
    //     millisecond ceiling — the numeric shape now exists, in code.
    for (const p of paths) {
      expect(p.ceilingMs).toBeGreaterThan(0);
      expect(p.observedMaxP95Ms).toBeGreaterThan(0);
    }

    // #3 BEFORE (W9): the only ceiling anywhere was a flat, un-derived 30s
    //     sanity check identical for every path (couldn't catch a real
    //     regression short of ~100x).
    //   AFTER (W2): every declared ceiling is materially tighter than that
    //     flat 30s — each is path-specific and derived from measurement, not
    //     a round number picked for convenience.
    for (const p of paths) {
      expect(p.ceilingMs).toBeLessThan(30_000);
    }
  });

  it('EVIDENCE_MISSING: a PRODUCTION compute SLO is still not declared in the schema', async () => {
    // FC-11 requires "declared SLO p50/p95/p99" as a PRODUCTION budget. The
    // only numeric performance target in the whole handoff document is a UI
    // one (grid rendering: ">=45 FPS, input p95<100 ms", §"10k x 120 logical
    // cells"), which is not a compute SLO.
    //
    // These three assertions are UNCHANGED in value from the W9 version —
    // deliberately. The W2 SCHEMA DECISION (see report §8) is NOT to extend
    // `observability_slos` or add a new latency-SLO table: there is no
    // honestly-measured production number to put in it (this machine's own
    // back-to-back n=20 runs disagreed by up to ~9.3x on p50 — see report
    // §5-6), and an empty-but-present schema row would be exactly the kind
    // of "table exists, zero real adoption" artifact this program has
    // repeatedly flagged elsewhere as a false signal of completeness. The CI
    // regression ceilings this file now enforces (test above) deliberately
    // live in code, not here: a CI gate is a build-time concept, and does
    // not need a database round-trip to fail a build.
    const sloTables = await t((tx) =>
      tx.queryAll<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'public' AND (table_name LIKE '%slo%' OR table_name LIKE '%latency_budget%')`
      )
    );
    expect(sloTables.map((r) => r.table_name)).toEqual(['observability_slos']);

    const latencyColumns = await t((tx) =>
      tx.queryAll<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
          WHERE table_name = 'observability_slos'
            AND (column_name LIKE '%latency%' OR column_name LIKE '%p50%' OR column_name LIKE '%p95%'
                 OR column_name LIKE '%p99%' OR column_name LIKE '%_ms%')`
      )
    );
    expect(latencyColumns).toEqual([]);

    const declaredRows = await t((tx) =>
      tx.queryOne<{ n: string }>(`SELECT count(*)::text AS n FROM observability_slos`)
    );
    expect(Number(declaredRows!.n)).toBe(0);
  });
});
