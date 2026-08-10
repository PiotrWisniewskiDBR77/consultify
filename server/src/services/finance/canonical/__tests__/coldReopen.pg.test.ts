/**
 * Finance v3 — COLD REOPEN proof (FC-05.8 · FC-07.9 · FC-12.4).
 *
 * WHAT "COLD REOPEN" MEANS HERE, and why the usual read-after-write test does
 * not qualify. The program's FC-05/FC-07/FC-12 conditions
 * (`docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`)
 * require that an APPROVED artifact, once process continuity AND connection
 * continuity have been broken, reads back with bit-identical values, the same
 * frozen compute snapshot, the same semantic hash and the same freshness — and
 * without being recomputed. A read issued from the same Node process on the
 * same `pg` pool proves none of that: it can be served by a warm connection, a
 * warm module-level cache, or a transaction snapshot the writer left behind.
 *
 * So this suite makes the boundary physical, and PROVES it rather than
 * declaring it:
 *
 *   1. WRITE PHASE — a real GoldCo chain (Statement -> Analysis -> Baseline ->
 *      Prediction -> Valuation) is built and APPROVED through the actual
 *      production services, on a real migrated Postgres schema.
 *   2. HOT READ — `coldReopenReader.ts` reads the canonical payload in-process.
 *      This is the "what the writer thinks it left behind" reference.
 *   3. CONNECTION DEATH — the pool's live backend PIDs are captured, the pool
 *      is closed via `db.close()`, and an INDEPENDENT `pg.Client` (its own
 *      connection, not from the pool) then polls `pg_stat_activity` until
 *      every one of those PIDs is gone. The disappearance is asserted, not
 *      assumed. See `proveConnectionsAreGone()`.
 *   4. COLD READ — the SAME reader module is executed in a SEPARATE OS PROCESS
 *      (`npx tsx .../coldReopenReader.ts`). New process, new pool, new ES
 *      module registry, new heap: there is no shared state left to cheat with,
 *      and the child even reports its own backend PIDs so the report can show
 *      they differ from the writer's.
 *   5. COMPARE — sha256 over a canonical, key-sorted, raw-text serialisation.
 *      Numerics are compared as the exact Postgres text form, never as JS
 *      floats (see `coldReopenReader.ts` header for why).
 *
 * NEGATIVE CONTROL (`FC-NEG`). A comparison that cannot fail proves nothing.
 * One `finance_baseline_outputs.value_decimal` is deliberately corrupted after
 * approval, the cold reopen is repeated, and the comparison MUST report a
 * mismatch; the original text is then restored and the match MUST return. The
 * corruption is applied under `SET LOCAL session_replication_role = replica`
 * because the schema's own `*_parent_immutability` triggers correctly refuse
 * the write — the point of the control is to simulate corruption that slipped
 * PAST the guard, and thereby show the cold-reopen comparison is an
 * INDEPENDENT detector rather than a restatement of the trigger.
 *
 * ISOLATION / HYGIENE. One freshly generated organization id per run; every
 * row this suite creates is org-scoped. `afterAll` deletes what the schema
 * permits (`compute_job*`, and the ephemeral cluster is discarded wholesale
 * anyway). `finance_artifacts`/`finance_business_versions`/lineage/lifecycle/
 * snapshot rows are append-only by design (BEFORE DELETE triggers) and are
 * deliberately NOT deleted — the same documented convention as
 * `canonicalServices.pg.test.ts`. No global seed/taxonomy is created, so no
 * cross-file contamination is possible in either direction.
 *
 * HOW TO RUN (own throwaway cluster only — never demo/staging/prod):
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/<db> \
 *   npx vitest run --config server/vitest.config.ts \
 *     src/services/finance/canonical/__tests__/coldReopen.pg.test.ts \
 *     --no-file-parallelism
 */
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  canonicalize,
  digest,
  readBaselinePayload,
  readChainPayload,
  readComputeActivityWitness,
  readValuationPayload,
  type ChainIds,
  type ChildReaderResult,
  type ReaderMode,
  type Tx,
} from './coldReopenReader.js';

const execFileAsync = promisify(execFile);

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

const HERE = path.dirname(new URL(import.meta.url).pathname);
// __tests__ -> canonical -> finance -> services -> src -> server -> repo root
const REPO_ROOT = path.resolve(HERE, '../../../../../..');
const READER_PATH = path.join(HERE, 'coldReopenReader.ts');
const ORACLE_PATH = path.join(
  REPO_ROOT,
  'docs/validation/finance-v3/generated/gate-d/goldco/goldco_oracle.json'
);

/** Machine-readable evidence for the W10 report; written by `afterAll`. */
const evidence: Record<string, unknown> = {};
const EVIDENCE_PATH = process.env.W10_EVIDENCE_PATH ?? '';

describe.skipIf(!REAL_PG)('Finance v3 cold reopen — FC-05.8 / FC-07.9 / FC-12.4', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let db: any;
  let artifactVersionService: typeof import('../artifactVersionService.js');
  let statementMappingService: typeof import('../statementMappingService.js');
  let statementReconciliationService: typeof import('../statementReconciliationService.js');
  let lineageService: typeof import('../lineageService.js');
  let kpiComputeService: typeof import('../kpiComputeService.js');
  let baselineComputeService: typeof import('../baselineComputeService.js');
  let predictionComputeService: typeof import('../predictionComputeService.js');
  let predictionPreflightService: typeof import('../predictionPreflightService.js');
  let valuationComputeService: typeof import('../valuationComputeService.js');
  let valuationSensitivityService: typeof import('../valuationSensitivityService.js');
  let valuationBridgeService: typeof import('../valuationBridgeService.js');
  let PgClient: typeof import('pg').Client;

  const orgId = `org-w10-coldreopen-${randomUUID()}`;
  const preparerId = `user-preparer-w10-${randomUUID()}`;
  const reviewerId = `user-reviewer-w10-${randomUUID()}`;
  const approverId = `user-approver-w10-${randomUUID()}`;

  const ids: Partial<ChainIds> = {};
  let entityId = '';
  let engineManifestId = '';
  let dcfEnterpriseValue = 0;
  let monthPeriods2026: string[] = [];
  let periodFY2027 = '';
  let periodFY2028 = '';
  /** The single row the negative control corrupts, plus its exact original text. */
  let negativeControlRow: { id: string; original: string } | null = null;

  // -------------------------------------------------------------------------
  // Cold-boundary machinery
  // -------------------------------------------------------------------------

  /**
   * Force the pool to hand out several distinct physical backends at once and
   * record their PIDs. Concurrency (not a loop) is what makes the pool open
   * more than one connection — a serial loop would keep reusing backend #1 and
   * the later "these PIDs are gone" assertion would be near-vacuous.
   */
  async function capturePoolBackendPids(): Promise<number[]> {
    const pids = await Promise.all(
      Array.from({ length: 6 }, () =>
        withPinnedPostgresTransaction(async (tx) => {
          const row = await tx.queryOne<{ pid: string }>(`SELECT pg_backend_pid()::text AS pid`);
          // Hold the client briefly so the six calls genuinely overlap.
          await new Promise((r) => setTimeout(r, 40));
          return Number(row!.pid);
        })
      )
    );
    return [...new Set(pids)].sort((a, b) => a - b);
  }

  /**
   * The coldness PROOF. Uses a connection this codebase's pool does not own —
   * a raw `pg.Client` — so the observation cannot be served by the very pool
   * whose death it is meant to witness.
   */
  async function proveConnectionsAreGone(pids: number[]): Promise<{
    beforeClose: number[];
    afterClose: number[];
    waitedMs: number;
    witnessPid: number;
  }> {
    const witness = new PgClient({ connectionString: CONNECTION_STRING, application_name: 'w10-cold-witness' });
    await witness.connect();
    try {
      const witnessPidRow = await witness.query<{ pid: string }>('SELECT pg_backend_pid()::text AS pid');
      const witnessPid = Number(witnessPidRow.rows[0].pid);

      const alive = async (): Promise<number[]> => {
        const res = await witness.query<{ pid: string }>(
          'SELECT pid::text AS pid FROM pg_stat_activity WHERE pid = ANY($1::int[]) ORDER BY pid',
          [pids]
        );
        return res.rows.map((r) => Number(r.pid));
      };

      const beforeClose = await alive();
      const t0 = Date.now();
      await db.close();

      let afterClose = await alive();
      // `pg` sends a Terminate and the backend exits asynchronously; poll
      // rather than assert on the first sample, but cap it so a genuine
      // connection leak fails the test instead of hanging it.
      while (afterClose.length > 0 && Date.now() - t0 < 15_000) {
        await new Promise((r) => setTimeout(r, 100));
        afterClose = await alive();
      }
      return { beforeClose, afterClose, waitedMs: Date.now() - t0, witnessPid };
    } finally {
      await witness.end();
    }
  }

  /** Run the reader in a genuinely separate OS process. */
  async function coldRead(mode: ReaderMode): Promise<ChildReaderResult & { wallMs: number }> {
    const outPath = path.join(
      process.env.TMPDIR ?? '/tmp',
      `w10-cold-${mode}-${randomUUID()}.json`
    );
    const t0 = Date.now();
    const { stdout } = await execFileAsync(
      'npx',
      ['tsx', READER_PATH, `--mode=${mode}`, `--org=${orgId}`, `--ids=${JSON.stringify(ids)}`, `--out=${outPath}`],
      {
        cwd: REPO_ROOT,
        maxBuffer: 64 * 1024 * 1024,
        env: {
          ...process.env,
          DB_TYPE: 'postgres',
          NODE_ENV: 'test',
          RUN_DB_TESTS: '1',
          MOCK_DB: 'false',
          DATABASE_URL: CONNECTION_STRING,
        },
      }
    );
    const wallMs = Date.now() - t0;
    const m = /__COLD_REOPEN_RESULT_AT__([\s\S]*?)__END__/.exec(stdout);
    if (!m) throw new Error(`child reader produced no result marker. stdout was:\n${stdout.slice(-4000)}`);
    const parsed = JSON.parse(fs.readFileSync(m[1], 'utf8')) as ChildReaderResult;
    fs.rmSync(m[1], { force: true });
    return { ...parsed, wallMs };
  }

  /** Hot (same-process) read of the same payload, for the reference digest. */
  async function hotRead(mode: ReaderMode) {
    return withPinnedPostgresTransaction(async (tx) => {
      if (mode === 'baseline') return readBaselinePayload(tx as Tx, orgId, ids.baseline!);
      if (mode === 'valuation') return readValuationPayload(tx as Tx, orgId, ids.valuation!);
      return readChainPayload(tx as Tx, orgId, ids as ChainIds, lineageService.getAncestors as any);
    });
  }

  /**
   * A full cold cycle: capture PIDs -> prove they die -> read from a new
   * process. Returns everything the report needs.
   */
  async function coldCycle(mode: ReaderMode) {
    const writerPids = await capturePoolBackendPids();
    const proof = await proveConnectionsAreGone(writerPids);
    const child = await coldRead(mode);
    return { writerPids, proof, child };
  }

  /** First reported difference between two canonical payloads, for evidence. */
  function firstDifference(a: string, b: string): string {
    if (a === b) return '(identical)';
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    const from = Math.max(0, i - 80);
    return `at offset ${i}\n  expected: ...${a.slice(from, i + 80)}\n  actual:   ...${b.slice(from, i + 80)}`;
  }

  // -------------------------------------------------------------------------
  // Fixture — the real GoldCo chain, built through production services
  // -------------------------------------------------------------------------

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    db = (await import('../../../../database/PostgresDatabase.js')).default;
    artifactVersionService = await import('../artifactVersionService.js');
    statementMappingService = await import('../statementMappingService.js');
    statementReconciliationService = await import('../statementReconciliationService.js');
    lineageService = await import('../lineageService.js');
    kpiComputeService = await import('../kpiComputeService.js');
    baselineComputeService = await import('../baselineComputeService.js');
    predictionComputeService = await import('../predictionComputeService.js');
    predictionPreflightService = await import('../predictionPreflightService.js');
    valuationComputeService = await import('../valuationComputeService.js');
    valuationSensitivityService = await import('../valuationSensitivityService.js');
    valuationBridgeService = await import('../valuationBridgeService.js');
    ({ Client: PgClient } = await import('pg'));

    const oracle = JSON.parse(fs.readFileSync(ORACLE_PATH, 'utf8'));

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'GoldCo (W10 cold reopen)'])
    );
    const manifest = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ engine_manifest_id: string }>(
        `SELECT engine_manifest_id FROM finance_engine_manifests WHERE engine_name = 'LEGACY_UNKNOWN' LIMIT 1`
      )
    );
    if (!manifest) throw new Error('finance_engine_manifests LEGACY_UNKNOWN sentinel missing — migration b01 not applied?');
    engineManifestId = manifest.engine_manifest_id;

    // --- calendar + periods -------------------------------------------------
    const calendar = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ fiscal_calendar_id: string }>(
        `INSERT INTO finance_stmt_calendars (organization_id, calendar_type, fiscal_year_end_month, effective_from, created_by)
         VALUES (?, 'STANDARD', 12, '2020-01-01', ?) RETURNING fiscal_calendar_id`,
        [orgId, preparerId]
      )
    );
    const calendarId = calendar!.fiscal_calendar_id;
    const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const makeMonth = async (fy: number, m: number, prev: string | null) => {
      const row = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ period_id: string }>(
          `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, fiscal_month, period_start, period_end, label, previous_period_id, created_by)
           VALUES (?, ?, 'MONTH', ?, ?, ?, ?, ?, ?, ?) RETURNING period_id`,
          [
            orgId, calendarId, fy, m,
            `${fy}-${String(m).padStart(2, '0')}-01`,
            `${fy}-${String(m).padStart(2, '0')}-${String(monthDays[m - 1]).padStart(2, '0')}`,
            `${fy}-M${String(m).padStart(2, '0')}`, prev, preparerId,
          ]
        )
      );
      return row!.period_id;
    };
    const monthPeriods2025: string[] = [];
    let prev: string | null = null;
    for (let m = 1; m <= 12; m++) { prev = await makeMonth(2025, m, prev); monthPeriods2025.push(prev); }
    monthPeriods2026 = [];
    for (let m = 1; m <= 12; m++) { prev = await makeMonth(2026, m, prev); monthPeriods2026.push(prev); }
    const openingBsPeriodId = monthPeriods2025[11];

    // --- PHASE 1: Statement Pack (FY2025 monthly P&L + December closing BS/CF)
    const PL_MAP: Record<string, string> = {
      revenue: 'REVENUE', cogs: 'COGS', grossMargin: 'GROSS_MARGIN', opex: 'OPEX', ebitda: 'EBITDA',
      depreciation: 'DEPRECIATION', ebit: 'EBIT', interest: 'INTEREST_EXPENSE', taxExpense: 'TAX_EXPENSE', netIncome: 'NET_INCOME',
    };
    const BS_MAP: Record<string, string> = {
      cash: 'CASH', ar: 'AR', inventory: 'INVENTORY', currentAssets: 'CURRENT_ASSETS', fixedAssets: 'FIXED_ASSETS',
      totalAssets: 'TOTAL_ASSETS', ap: 'AP', currentLiabilities: 'CURRENT_LIABILITIES', longTermDebt: 'LONG_TERM_DEBT',
      totalLiabilities: 'TOTAL_LIABILITIES', totalEquity: 'EQUITY', totalLiabilitiesEquity: 'TOTAL_LIABILITIES_EQUITY',
    };

    const pack = await artifactVersionService.createArtifact({
      organizationId: orgId, artifactType: 'STATEMENT_PACK', createdBy: preparerId,
    });
    ids.statement = pack.businessVersion.business_version_id;
    const entityRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ id: string }>(
        `INSERT INTO finance_stmt_entities (organization_id, business_version_id, entity_code, legal_name, role, consolidation_method, functional_currency, created_by)
         VALUES (?, ?, 'PARENT', 'GoldCo Manufacturing S.A.', 'GROUP_PARENT', 'NOT_CONSOLIDATED', 'PLN', ?) RETURNING id`,
        [orgId, ids.statement, preparerId]
      )
    );
    entityId = entityRow!.id;

    const rawLines: any[] = [];
    const rules: any[] = [];
    for (const m of oracle.parent.FY2025_monthly) {
      const periodId = monthPeriods2025[m.month - 1];
      for (const [field, code] of Object.entries(PL_MAP)) {
        const label = `PARENT:M${m.month}:${field}`;
        rawLines.push({ lineItem: label, periodId, entityCode: 'PARENT', currency: 'PLN', value: m[field], sourceRef: { month: m.month, field } });
        rules.push({ sourceLabel: label, statementType: 'P&L', lineCode: code });
      }
      rawLines.push({ lineItem: `PARENT:M${m.month}:cash`, periodId, entityCode: 'PARENT', currency: 'PLN', value: m.cash, sourceRef: { month: m.month, field: 'cash' } });
      rules.push({ sourceLabel: `PARENT:M${m.month}:cash`, statementType: 'BS', lineCode: 'CASH' });
      rawLines.push({ lineItem: `PARENT:M${m.month}:netChangeCash`, periodId, entityCode: 'PARENT', currency: 'PLN', value: m.netChangeCash, sourceRef: { month: m.month, field: 'netChangeCash' } });
      rules.push({ sourceLabel: `PARENT:M${m.month}:netChangeCash`, statementType: 'CF', lineCode: 'NET_CHANGE_CASH' });
    }
    for (const [field, code] of Object.entries(BS_MAP)) {
      if (field === 'cash') continue;
      const label = `PARENT:DEC2025:${field}`;
      rawLines.push({ lineItem: label, periodId: openingBsPeriodId, entityCode: 'PARENT', currency: 'PLN', value: oracle.parent.FY2025.bs[field], sourceRef: { field } });
      rules.push({ sourceLabel: label, statementType: 'BS', lineCode: code });
    }
    for (const [label, code, value, st] of [
      ['PARENT:DEC2025:retainedEarnings', 'RETAINED_EARNINGS', oracle.parent.FY2025.closingRE, 'BS'],
      ['PARENT:DEC2025:dividendsDeclared', 'DIVIDENDS_DECLARED', oracle.parent.FY2025.dividendsDeclared, 'BS'],
      ['PARENT:DEC2025:cfo', 'CFO', oracle.parent.FY2025.cfo, 'CF'],
      ['PARENT:DEC2025:cfi', 'CFI', oracle.parent.FY2025.cfi, 'CF'],
      ['PARENT:DEC2025:cff', 'CFF', oracle.parent.FY2025.cff, 'CF'],
    ] as const) {
      rawLines.push({ lineItem: label, periodId: openingBsPeriodId, entityCode: 'PARENT', currency: 'PLN', value, sourceRef: {} });
      rules.push({ sourceLabel: label, statementType: st, lineCode: code });
    }

    const mapped = await statementMappingService.mapStatementLines({
      organizationId: orgId, businessVersionId: ids.statement!, unit: 'UNITS', presentationCurrency: 'PLN',
      createdBy: preparerId, rawLines, rules,
    });
    const recon = await statementReconciliationService.runReconciliation({
      organizationId: orgId, artifactId: pack.artifact.artifact_id, businessVersionId: ids.statement!,
      sourceSystem: 'w10:cold_reopen', mappingResults: mapped, createdBy: preparerId,
      attemptReadinessTransition: true, actorId: preparerId, role: 'preparer',
      expectedVersion: pack.businessVersion.version,
    });
    if (!recon.readiness.transitionResult?.ok) {
      throw new Error(`Statement pack readiness failed: ${JSON.stringify(recon.readiness.checks.filter((c: any) => !c.passed))}`);
    }
    await approveChain(ids.statement!, recon.readiness.businessVersion.version, /* alreadyReady */ true);

    // --- PHASE 2: Analysis --------------------------------------------------
    const analysis = await artifactVersionService.createArtifact({
      organizationId: orgId, artifactType: 'HISTORICAL_ANALYSIS', createdBy: preparerId,
    });
    ids.analysis = analysis.businessVersion.business_version_id;
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(
        // `chk_finance_analysis_def_entity_scope` requires entity_code to be
        // present exactly when entity_scope_mode = 'SINGLE_ENTITY'.
        `INSERT INTO finance_analysis_definitions (organization_id, business_version_id, purpose, analysis_type, entity_scope_mode, entity_code, presentation_currency, unit, created_by)
         VALUES (?, ?, 'BOARD_REPORTING', 'STANDARD', 'SINGLE_ENTITY', 'PARENT', 'PLN', 'UNITS', ?)`,
        [orgId, ids.analysis, preparerId]
      )
    );
    const e1 = await lineageService.insertEdge({
      organizationId: orgId, sourceVersionId: ids.statement!, sourceArtifactType: 'STATEMENT_PACK',
      targetVersionId: ids.analysis!, targetArtifactType: 'HISTORICAL_ANALYSIS',
      edgeType: 'STATEMENT_TO_ANALYSIS', transformationKind: 'MANUAL_LINK', authorId: preparerId,
    });
    if (!e1.ok) throw new Error(`STATEMENT_TO_ANALYSIS edge failed: ${JSON.stringify(e1)}`);

    const catalog = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ id: string }>(`SELECT id FROM finance_analysis_kpi_catalog WHERE status = 'ACTIVE' ORDER BY kpi_code`)
    );
    for (const row of catalog) {
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(
          `INSERT INTO finance_analysis_kpi_values (organization_id, business_version_id, kpi_catalog_id, entity_id, period_id)
           VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
          [orgId, ids.analysis, row.id, entityId, openingBsPeriodId]
        )
      );
    }
    const kpis = await kpiComputeService.computeAnalysisKpis({
      organizationId: orgId, businessVersionId: ids.analysis!, requestedByUserId: preparerId,
    });
    if (!kpis.ok) throw new Error(`computeAnalysisKpis failed: ${JSON.stringify(kpis)}`);
    await approveChain(ids.analysis!, analysis.businessVersion.version);

    // --- PHASE 3: Baseline Model -------------------------------------------
    const baseline = await artifactVersionService.createArtifact({
      organizationId: orgId, artifactType: 'BASELINE_MODEL', createdBy: preparerId,
    });
    ids.baseline = baseline.businessVersion.business_version_id;
    for (const edge of [
      { source: ids.statement!, sourceType: 'STATEMENT_PACK' as const, edgeType: 'STATEMENT_TO_MODEL' as const, kind: 'COMPUTE' as const, hash: undefined },
      { source: ids.analysis!, sourceType: 'HISTORICAL_ANALYSIS' as const, edgeType: 'ANALYSIS_TO_MODEL' as const, kind: 'MANUAL_LINK' as const, hash: 'sha256:w10-analysis-to-model' },
    ]) {
      const res = await lineageService.insertEdge({
        organizationId: orgId, sourceVersionId: edge.source, sourceArtifactType: edge.sourceType,
        targetVersionId: ids.baseline!, targetArtifactType: 'BASELINE_MODEL', edgeType: edge.edgeType,
        transformationKind: edge.kind, authorId: preparerId, assumptionSnapshotHash: edge.hash,
      });
      if (!res.ok) throw new Error(`${edge.edgeType} edge failed: ${JSON.stringify(res)}`);
    }
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(
        `INSERT INTO finance_baseline_models (
           organization_id, business_version_id, horizon_months, horizon_rationale, horizon_rationale_note,
           circularity_max_iterations, circularity_tolerance_currency, interest_income_on_cash_modeled,
           mandatory_contractual_cash_sweep_modeled, created_by
         ) VALUES (?, ?, 12, 'DEBT_MATURITY', 'FY2026 monthly horizon matches the GoldCo facility amortization cadence (same convention as WP-D06).', 50, 1, false, true, ?)`,
        [orgId, ids.baseline, preparerId]
      )
    );

    const fy = oracle.parent.FY2025;
    const makeAssumption = (scheduleType: string, driverCode: string, value: number, unit: string) =>
      withPinnedPostgresTransaction((tx) =>
        tx.queryRun(
          `INSERT INTO finance_baseline_assumptions (
             organization_id, business_version_id, schedule_type, driver_code, entity_id, period_id, rule,
             value_status, value_decimal, unit, quality, created_by
           ) VALUES (?, ?, ?, ?, ?, ?, 'HISTORICAL_AVERAGE', 'PRESENT_NONZERO', ?, ?, 'ESTIMATED', ?)`,
          [orgId, ids.baseline, scheduleType, driverCode, entityId, monthPeriods2026[0], value, unit, preparerId]
        )
      );
    await makeAssumption('revenue_pvm', 'REVENUE_GROWTH_YOY', 0.05, 'PCT');
    await makeAssumption('cogs_opex', 'COGS_PCT_OF_REVENUE', fy.pl.cogs / fy.pl.revenue, 'PCT');
    await makeAssumption('cogs_opex', 'OPEX_PCT_OF_REVENUE', fy.pl.opex / fy.pl.revenue, 'PCT');
    await makeAssumption('wc_dso_dio_dpo', 'DSO_DAYS', (fy.bs.ar / fy.pl.revenue) * 365, 'DAYS');
    await makeAssumption('wc_dso_dio_dpo', 'DIO_DAYS', (fy.bs.inventory / fy.pl.cogs) * 365, 'DAYS');
    await makeAssumption('wc_dso_dio_dpo', 'DPO_DAYS', (fy.bs.ap / fy.pl.cogs) * 365, 'DAYS');
    await makeAssumption('capex_depreciation', 'CAPEX_PCT_OF_REVENUE', 9_000_000 / fy.pl.revenue, 'PCT');
    await makeAssumption('capex_depreciation', 'USEFUL_LIFE_MONTHS', (12 * fy.bs.fixedAssets) / 7_000_000, 'MONTHS');
    await makeAssumption('tax_nol', 'STATUTORY_TAX_RATE_PCT', 0.19, 'PCT');
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(
        `INSERT INTO finance_baseline_schedules (
           organization_id, business_version_id, schedule_type, entity_id, schedule_item_code,
           effective_from_period_id, payload, created_by
         ) VALUES (?, ?, 'debt_maturity', ?, 'FACILITY-1', ?, ?, ?)`,
        [
          orgId, ids.baseline, entityId, monthPeriods2026[0],
          JSON.stringify({
            principal_opening: 40_500_000, contractual_rate: 0.048,
            amortization_schedule: Array.from({ length: 12 }, () => 675_000),
            mandatory_sweep_pct: 0.1, mandatory_sweep_threshold: 0,
          }),
          preparerId,
        ]
      )
    );

    const baselineRun = await baselineComputeService.runBaselineCompute({
      organizationId: orgId, businessVersionId: ids.baseline!, requestedByUserId: preparerId,
      engineManifestId, entityId, forecastPeriodIds: monthPeriods2026,
      openingBalanceSheetPeriodId: openingBsPeriodId,
    });
    if (!baselineRun.ok) throw new Error(`runBaselineCompute failed: ${JSON.stringify(baselineRun)}`);

    /**
     * FY2027/FY2028 simple continuation (+3%/yr off the FY2026 roll-up) — the
     * same convention WP-D10's own known-answer test uses, so the DCF below has
     * a three-year projection. These rows MUST be written BEFORE the Baseline
     * is approved: `finance_baseline_outputs_enforce_parent_immutability()`
     * correctly refuses any INSERT once the parent business version is
     * APPROVED (verified live — the first draft of this fixture wrote them
     * after approval and was rejected by that trigger).
     */
    const lineRows = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ id: string; line_code: string }>(
        `SELECT id, line_code FROM financial_statement_lines WHERE line_code = ANY(?) AND organization_id IS NULL`,
        [['EBIT', 'DEPRECIATION', 'CAPEX', 'WORKING_CAPITAL', 'REVENUE', 'NET_INCOME']]
      )
    );
    const lineIdByCode = new Map(lineRows.map((r) => [r.line_code, r.id]));
    const annualSum = async (code: string) => {
      const rows = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ value_decimal: string }>(
          `SELECT value_decimal FROM finance_baseline_outputs WHERE business_version_id = ? AND canonical_line_id = ? AND entity_id = ? AND period_id = ANY(?)`,
          [ids.baseline, lineIdByCode.get(code), entityId, monthPeriods2026]
        )
      );
      return rows.reduce((s, r) => s + Number(r.value_decimal), 0);
    };
    const closing = async (code: string) => {
      const row = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ value_decimal: string }>(
          `SELECT value_decimal FROM finance_baseline_outputs WHERE business_version_id = ? AND canonical_line_id = ? AND entity_id = ? AND period_id = ?`,
          [ids.baseline, lineIdByCode.get(code), entityId, monthPeriods2026[11]]
        )
      );
      return Number(row!.value_decimal);
    };
    const fy2026 = {
      EBIT: await annualSum('EBIT'), DEPRECIATION: await annualSum('DEPRECIATION'),
      CAPEX: await annualSum('CAPEX'), REVENUE: await annualSum('REVENUE'),
      NET_INCOME: await annualSum('NET_INCOME'), WORKING_CAPITAL: await closing('WORKING_CAPITAL'),
    };
    const makeFy = async (fiscalYear: number, start: string, end: string, previousPeriodId: string | null) => {
      const row = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ period_id: string }>(
          `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, period_start, period_end, label, previous_period_id, created_by)
           VALUES (?, ?, 'FY', ?, ?, ?, ?, ?, ?) RETURNING period_id`,
          [orgId, calendarId, fiscalYear, start, end, `FY${fiscalYear}`, previousPeriodId, preparerId]
        )
      );
      return row!.period_id;
    };
    periodFY2027 = await makeFy(2027, '2027-01-01', '2027-12-31', null);
    periodFY2028 = await makeFy(2028, '2028-01-01', '2028-12-31', periodFY2027);
    const grow = (base: typeof fy2026, g: number) => ({
      EBIT: base.EBIT * (1 + g), DEPRECIATION: base.DEPRECIATION * (1 + g), CAPEX: base.CAPEX * (1 + g),
      REVENUE: base.REVENUE * (1 + g), NET_INCOME: base.NET_INCOME * (1 + g), WORKING_CAPITAL: base.WORKING_CAPITAL * (1 + g),
    });
    const writeContinuation = async (periodId: string, values: typeof fy2026) => {
      for (const [code, value] of Object.entries(values)) {
        const statementType =
          code === 'REVENUE' || code === 'EBIT' || code === 'DEPRECIATION' || code === 'NET_INCOME'
            ? 'P&L' : code === 'CAPEX' ? 'CF' : 'BS';
        await withPinnedPostgresTransaction((tx) =>
          tx.queryRun(
            `INSERT INTO finance_baseline_outputs (
               id, organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id,
               consolidation_scope, value_status, value_decimal, native_currency, presentation_currency, unit,
               multiplier, value_kind, created_by
             ) VALUES (?, ?, ?, ?, ?, ?, ?, 'CONSOLIDATED', 'PRESENT_NONZERO', ?, 'PLN', 'PLN', 'UNITS', 1, 'FORECAST', ?)
             ON CONFLICT (business_version_id, entity_id, canonical_line_id, period_id, consolidation_scope)
             DO UPDATE SET value_decimal = EXCLUDED.value_decimal`,
            [randomUUID(), orgId, ids.baseline, statementType, lineIdByCode.get(code), entityId, periodId, value, preparerId]
          )
        );
      }
    };
    const fy2027 = grow(fy2026, 0.03);
    await writeContinuation(periodFY2027, fy2027);
    await writeContinuation(periodFY2028, grow(fy2027, 0.03));

    await approveChain(ids.baseline!, baseline.businessVersion.version);

    // --- PHASE 4: Prediction (Base scenario) --------------------------------
    const prediction = await artifactVersionService.createArtifact({
      organizationId: orgId, artifactType: 'PREDICTION_SCENARIO', createdBy: preparerId,
    });
    ids.prediction = prediction.businessVersion.business_version_id;
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(
        `INSERT INTO finance_prediction_scenarios (organization_id, business_version_id, name, scenario_mode, created_by)
         VALUES (?, ?, 'Base (= Baseline passthrough)', 'STANDARD_BASE', ?)`,
        [orgId, ids.prediction, preparerId]
      )
    );
    const e4 = await lineageService.insertEdge({
      organizationId: orgId, sourceVersionId: ids.baseline!, sourceArtifactType: 'BASELINE_MODEL',
      targetVersionId: ids.prediction!, targetArtifactType: 'PREDICTION_SCENARIO',
      edgeType: 'MODEL_TO_SCENARIO', transformationKind: 'MANUAL_LINK', authorId: preparerId,
      assumptionSnapshotHash: 'sha256:w10-model-to-scenario-base',
    });
    if (!e4.ok) throw new Error(`MODEL_TO_SCENARIO edge failed: ${JSON.stringify(e4)}`);
    await predictionPreflightService.runPreflight({
      organizationId: orgId, businessVersionId: ids.prediction!, runBy: preparerId,
      entityId, openingBalanceSheetPeriodId: openingBsPeriodId,
    });
    const predictionRun = await predictionComputeService.runPredictionCompute({
      organizationId: orgId, businessVersionId: ids.prediction!, requestedByUserId: preparerId,
      engineManifestId, entityId, forecastPeriodIds: monthPeriods2026,
      openingBalanceSheetPeriodId: openingBsPeriodId,
    });
    if (!predictionRun.ok) throw new Error(`runPredictionCompute failed: ${JSON.stringify(predictionRun)}`);
    await approveChain(ids.prediction!, prediction.businessVersion.version);

    // --- PHASE 5: Valuation (DCF + 5x5 sensitivity + bridge + Advisor) ------
    const valCase = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ case_id: string }>(
        `INSERT INTO finance_valuation_cases (organization_id, name, description, created_by)
         VALUES (?, 'GoldCo — W10 cold reopen valuation', 'Cold reopen proof case.', ?) RETURNING case_id`,
        [orgId, preparerId]
      )
    );
    const valuation = await artifactVersionService.createArtifact({
      organizationId: orgId, artifactType: 'VALUATION_CASE', createdBy: preparerId,
    });
    ids.valuation = valuation.businessVersion.business_version_id;
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(
        `INSERT INTO finance_valuation_variants (organization_id, business_version_id, case_id, name, description, created_by)
         VALUES (?, ?, ?, 'Baseline case', 'FCFF DCF sourced from the approved Baseline Model.', ?)`,
        [orgId, ids.valuation, valCase!.case_id, preparerId]
      )
    );
    const e5 = await lineageService.insertEdge({
      organizationId: orgId, sourceVersionId: ids.baseline!, sourceArtifactType: 'BASELINE_MODEL',
      targetVersionId: ids.valuation!, targetArtifactType: 'VALUATION_CASE',
      edgeType: 'MODEL_TO_VALUATION', transformationKind: 'MANUAL_LINK', authorId: preparerId,
      assumptionSnapshotHash: 'sha256:w10-model-to-valuation-baseline',
    });
    if (!e5.ok) throw new Error(`MODEL_TO_VALUATION edge failed: ${JSON.stringify(e5)}`);
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(
        `INSERT INTO finance_valuation_wacc_inputs (
           organization_id, business_version_id, risk_free_rate_pct, equity_risk_premium_pct, beta_unlevered,
           target_capital_structure_debt_pct, target_capital_structure_equity_pct,
           current_capital_structure_debt_pct, current_capital_structure_equity_pct,
           cost_of_debt_pretax_pct, cash_tax_rate_pct, currency, nominal_or_real, pre_or_post_tax, created_by
         ) VALUES (?, ?, 4.0, 5.5, 0.9, 30, 70, 30, 70, 6.0, 19, 'PLN', 'NOMINAL', 'POST_TAX', ?)`,
        [orgId, ids.valuation, preparerId]
      )
    );

    const dcf = await valuationComputeService.runDcfFcffValuation({
      organizationId: orgId, valuationBusinessVersionId: ids.valuation!, entityId,
      requestedByUserId: preparerId, engineManifestId,
      projectionYears: [
        { fiscalYear: 2026, periodIds: monthPeriods2026 },
        { fiscalYear: 2027, periodIds: [periodFY2027] },
        { fiscalYear: 2028, periodIds: [periodFY2028] },
      ],
      openingWorkingCapital: fy.bs.ar + fy.bs.inventory - fy.bs.ap,
      terminal: { gPct: 2.5 },
    });
    if (!dcf.ok) throw new Error(`runDcfFcffValuation failed: ${JSON.stringify(dcf)}`);
    dcfEnterpriseValue = dcf.enterpriseValue;

    const dcfMethod = await valuationComputeService.findOrCreateMethod({
      organizationId: orgId, businessVersionId: ids.valuation!, methodType: 'DCF_FCFF', createdBy: preparerId,
    });
    await valuationComputeService.setMethodBasket({ methodId: dcfMethod.id, isInRecommendationBasket: true, weightPct: 100 });

    const baseWacc = dcf.wacc.waccPct;
    const grid = valuationSensitivityService.buildWaccByTerminalGGrid({
      axes: {
        wacc: [baseWacc - 2, baseWacc - 1, baseWacc, baseWacc + 1, baseWacc + 2],
        terminalG: [0.5, 1.5, 2.5, 3.5, 4.5],
      },
      years: dcf.fcffYears.map((y: any) => ({ fiscalYear: y.fiscalYear, fcff: y.fcff! })),
      fcffTerminalYear: dcf.fcffYears[dcf.fcffYears.length - 1].fcff!,
      baseWaccPct: baseWacc, baseGPct: 2.5,
    });
    if (!grid.ok) throw new Error(`sensitivity grid failed: ${JSON.stringify(grid)}`);
    await valuationSensitivityService.writeSensitivityGrid({
      organizationId: orgId, methodId: dcfMethod.id, gridLabel: 'WACC x Terminal g (base case)',
      rowAxisVariable: 'terminal_g_pct', columnAxisVariable: 'wacc_pct', cells: grid.cells, createdBy: preparerId,
    });

    const asOfDate = '2025-12-31';
    const bridgeComponents = [
      { sequenceOrder: 1, componentKind: 'DEBT' as const, sign: 'SUBTRACT_FROM_EV' as const, amountDecimal: 40_500_000, asOfDate, rationale: 'FY2025 closing LONG_TERM_DEBT' },
      { sequenceOrder: 2, componentKind: 'CASH' as const, sign: 'ADD_TO_EV' as const, amountDecimal: 11_000_000, asOfDate, rationale: 'FY2025 closing CASH' },
    ];
    const eq = valuationBridgeService.computeEquityValue(dcf.enterpriseValue, bridgeComponents as any);
    const bridge = await valuationBridgeService.writeBridge({
      organizationId: orgId, businessVersionId: ids.valuation!, asOfDate,
      enterpriseValueDecimal: dcf.enterpriseValue,
      equityValueDecimal: eq.ok ? eq.equityValueDecimal : 0,
      components: bridgeComponents, createdBy: preparerId,
    });
    if (!bridge.ok) throw new Error(`writeBridge failed: ${JSON.stringify(bridge)}`);

    // Advisor findings must be written PRE-approval and frozen BY approval
    // (WP-D09b + the IF-19 fix); `createComputeSnapshot()` is the production
    // path that makes that sequencing possible.
    const preSnap = await artifactVersionService.createComputeSnapshot({
      organizationId: orgId, businessVersionId: ids.valuation!, actorId: preparerId,
    });
    if (!preSnap.ok) throw new Error(`createComputeSnapshot failed: ${JSON.stringify(preSnap)}`);
    for (const o of [
      { kind: 'FACT', title: 'WACC and Enterprise Value', narrative: `Baseline WACC ${baseWacc.toFixed(2)}%, EV PLN ${dcf.enterpriseValue.toFixed(0)}.`, driver: 'DCF_FCFF', impact: dcf.enterpriseValue, confidence: 'HIGH' },
      { kind: 'RISK', title: 'FY2026 funding gap', narrative: 'Negative December 2026 cash position driven by the mandatory debt-sweep clause.', driver: 'CASH', impact: null, confidence: 'HIGH' },
    ] as const) {
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(
          `INSERT INTO finance_valuation_advisor_outputs (
             organization_id, business_version_id, compute_snapshot_id, output_kind, title, narrative,
             evidence_ref, driver_ref, impact_decimal, confidence,
             ai_provider, ai_model, ai_prompt_version, ai_no_training_commitment, ai_evidence_digest, created_by
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL_PROGRAMMATIC', 'coldReopen.pg.test.ts', 'v1', true, ?, ?)`,
          [
            orgId, ids.valuation, preSnap.computeSnapshotId, o.kind, o.title, o.narrative,
            JSON.stringify({ source: 'coldReopen.pg.test.ts', method: 'DCF_FCFF' }),
            o.driver, o.impact, o.confidence, `sha256:w10-advisor-${o.kind.toLowerCase()}`, preparerId,
          ]
        )
      );
    }
    await approveChain(ids.valuation!, valuation.businessVersion.version);
  }, 300_000);

  /**
   * submit -> review -> approve, with `freshness = CURRENT` forced right before
   * the approve gate (the same shortcut `goldco_full_dag.ts` uses: there is no
   * background freshness recomputer in the test environment). Always uses three
   * DISTINCT users so the HIGH_RISK maker-checker rule (approver != preparer AND
   * approver != reviewer) is satisfied for every artifact type.
   */
  async function approveChain(businessVersionId: string, startVersion: number, alreadyReady = false): Promise<void> {
    let version = startVersion;
    if (!alreadyReady) {
      const submitted = await artifactVersionService.transition({
        organizationId: orgId, businessVersionId, action: 'submit_for_review',
        actorId: preparerId, role: 'preparer', expectedVersion: version,
      });
      if (!submitted.ok) throw new Error(`submit_for_review failed for ${businessVersionId}: ${JSON.stringify(submitted)}`);
      version = submitted.businessVersion.version;
    }
    const started = await artifactVersionService.transition({
      organizationId: orgId, businessVersionId, action: 'start_review',
      actorId: reviewerId, role: 'reviewer', expectedVersion: version,
    });
    if (!started.ok) throw new Error(`start_review failed for ${businessVersionId}: ${JSON.stringify(started)}`);
    version = started.businessVersion.version;
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?`, [businessVersionId])
    );
    const approved = await artifactVersionService.approveVersion({
      organizationId: orgId, businessVersionId, actorId: approverId, role: 'approver',
      expectedVersion: version, editorUserIds: [preparerId], reviewStartedBy: reviewerId,
    });
    if (!approved.ok) throw new Error(`approveVersion failed for ${businessVersionId}: ${JSON.stringify(approved)}`);
  }

  afterAll(async () => {
    if (!REAL_PG) return;
    try {
      await withPinnedPostgresTransaction(async (tx) => {
        await tx.queryRun(`DELETE FROM compute_job_outputs WHERE organization_id = ?`, [orgId]);
        await tx.queryRun(
          `DELETE FROM compute_job_runs WHERE job_id IN (SELECT id FROM compute_jobs WHERE organization_id = ?)`,
          [orgId]
        );
        await tx.queryRun(`DELETE FROM compute_jobs WHERE organization_id = ?`, [orgId]);
      });
    } catch {
      /* best effort — the ephemeral cluster is discarded by the runner anyway */
    }
    if (EVIDENCE_PATH) {
      fs.writeFileSync(EVIDENCE_PATH, JSON.stringify({ orgId, ids, evidence }, null, 2));
    }
  }, 60_000);

  // ==========================================================================
  // Scenario 1 — FC-05.8 Baseline Model
  // ==========================================================================

  it('FC-05.8 — an APPROVED Baseline Model cold-reopens bit-identically (values, snapshot, semantic hash, freshness), with no recompute', async () => {
    const bv = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<any>(`SELECT status, freshness, compute_snapshot_id, content_semantic_hash FROM finance_business_versions WHERE business_version_id = ?`, [ids.baseline])
    );
    expect(bv.status).toBe('APPROVED');
    expect(bv.compute_snapshot_id).toBeTruthy();

    const hotStart = Date.now();
    const hot = await hotRead('baseline');
    const hotMs = Date.now() - hotStart;
    const hotWitness = await withPinnedPostgresTransaction((tx) => readComputeActivityWitness(tx as Tx, orgId));
    // Sanity: the fixture really did compute a full monthly grid, so the
    // comparison below is not comparing two empty payloads.
    expect((hot as any).outputCount).toBeGreaterThan(100);

    const { writerPids, proof, child } = await coldCycle('baseline');

    expect(proof.beforeClose.length).toBeGreaterThan(1);
    expect(proof.afterClose).toEqual([]);
    expect(child.backendPids.every((p) => !writerPids.includes(p))).toBe(true);

    expect(firstDifference(canonicalize(hot), child.canonical)).toBe('(identical)');
    expect(child.digest).toBe(digest(hot));
    expect(child.witnessDigest).toBe(digest(hotWitness));

    evidence.fc05_8 = {
      hotMs, hotDigest: digest(hot), coldDigest: child.digest,
      coldReadMs: child.readMs, coldProcessMs: child.processMs, coldWallMs: child.wallMs,
      writerPids, coldBackendPids: child.backendPids, witnessPid: proof.witnessPid,
      pidsAliveBeforeClose: proof.beforeClose, pidsAliveAfterClose: proof.afterClose,
      poolDrainMs: proof.waitedMs, childPid: child.pid,
      outputCount: (hot as any).outputCount, witness: hotWitness,
      snapshotId: bv.compute_snapshot_id, semanticHash: bv.content_semantic_hash, freshness: bv.freshness,
    };
  }, 180_000);

  // ==========================================================================
  // Scenario 2 — FC-07.9 Valuation
  // ==========================================================================

  it('FC-07.9 — an APPROVED Valuation variant cold-reopens with identical EV, all 25 sensitivity cells, bridge, method weights and a still-frozen Advisor output', async () => {
    const hotStart = Date.now();
    const hot: any = await hotRead('valuation');
    const hotMs = Date.now() - hotStart;
    const hotWitness = await withPinnedPostgresTransaction((tx) => readComputeActivityWitness(tx as Tx, orgId));

    expect(hot.businessVersion.status).toBe('APPROVED');
    expect(hot.sensitivityCellCount).toBe(25);
    expect(hot.methods.some((m: any) => m.method_type === 'DCF_FCFF' && m.is_in_recommendation_basket === true)).toBe(true);
    expect(hot.advisorOutputs.length).toBeGreaterThan(0);
    expect(hot.advisorOutputs.every((a: any) => a.is_frozen === true)).toBe(true);

    const { writerPids, proof, child } = await coldCycle('valuation');
    expect(proof.beforeClose.length).toBeGreaterThan(1);
    expect(proof.afterClose).toEqual([]);
    expect(child.backendPids.every((p) => !writerPids.includes(p))).toBe(true);

    expect(firstDifference(canonicalize(hot), child.canonical)).toBe('(identical)');
    expect(child.digest).toBe(digest(hot));
    expect(child.witnessDigest).toBe(digest(hotWitness));

    // Named FC-07.9 facts, asserted on the COLD payload specifically, so the
    // report can quote them rather than only quoting a hash.
    const cold = JSON.parse(child.canonical);
    expect(cold.sensitivityCells).toHaveLength(25);
    expect(cold.advisorOutputs.every((a: any) => a.is_frozen === true && a.is_stale === false)).toBe(true);
    expect(cold.bridge.enterprise_value_decimal).toBe(hot.bridge.enterprise_value_decimal);

    evidence.fc07_9 = {
      hotMs, hotDigest: digest(hot), coldDigest: child.digest,
      coldReadMs: child.readMs, coldProcessMs: child.processMs, coldWallMs: child.wallMs,
      writerPids, coldBackendPids: child.backendPids,
      pidsAliveBeforeClose: proof.beforeClose, pidsAliveAfterClose: proof.afterClose,
      poolDrainMs: proof.waitedMs,
      enterpriseValueComputed: dcfEnterpriseValue,
      enterpriseValuePersisted: cold.bridge.enterprise_value_decimal,
      equityValuePersisted: cold.bridge.equity_value_decimal,
      waccComputedPct: cold.waccInputs?.wacc_computed_pct,
      sensitivityCells: cold.sensitivityCells.length,
      methodWeights: cold.methods.map((m: any) => ({ method_type: m.method_type, weight_pct: m.weight_pct, basket: m.is_in_recommendation_basket })),
      advisorFrozen: cold.advisorOutputs.map((a: any) => ({ kind: a.output_kind, is_frozen: a.is_frozen, is_stale: a.is_stale })),
      witness: hotWitness,
    };
  }, 180_000);

  // ==========================================================================
  // Scenario 3 — FC-12.4 whole chain
  // ==========================================================================

  it('FC-12.4 — the whole approved chain (Statement -> Analysis -> Baseline -> Prediction -> Valuation) cold-reopens intact, lineage still navigable backwards, nothing spuriously stale', async () => {
    const hotStart = Date.now();
    const hot: any = await hotRead('chain');
    const hotMs = Date.now() - hotStart;
    const hotWitness = await withPinnedPostgresTransaction((tx) => readComputeActivityWitness(tx as Tx, orgId));

    for (const stage of ['statement', 'analysis', 'baseline', 'prediction', 'valuation'] as const) {
      expect(hot[stage].businessVersion.status).toBe('APPROVED');
    }
    // Each stage must actually carry values, otherwise the digest comparison
    // below could be satisfied by five identically empty payloads. The
    // Prediction stage is checked on `effectiveOutputCount`, not
    // `outputCount`: `scenario_mode = 'STANDARD_BASE'` is forbidden by a d07
    // trigger from owning its own output rows and resolves through the
    // MODEL_TO_SCENARIO edge instead.
    expect(hot.statement.lineCount).toBeGreaterThan(0);
    expect(hot.analysis.kpiCount).toBeGreaterThan(0);
    expect(hot.baseline.outputCount).toBeGreaterThan(0);
    expect(hot.prediction.outputCount).toBe(0);
    expect(hot.prediction.effectiveOutputCount).toBeGreaterThan(0);
    expect(hot.valuation.sensitivityCellCount).toBe(25);

    const { writerPids, proof, child } = await coldCycle('chain');
    expect(proof.beforeClose.length).toBeGreaterThan(1);
    expect(proof.afterClose).toEqual([]);
    expect(child.backendPids.every((p) => !writerPids.includes(p))).toBe(true);

    expect(firstDifference(canonicalize(hot), child.canonical)).toBe('(identical)');
    expect(child.digest).toBe(digest(hot));
    expect(child.witnessDigest).toBe(digest(hotWitness));

    const cold = JSON.parse(child.canonical);

    // Lineage navigable BACKWARDS from the Valuation, after the cold reopen,
    // through the shipping `lineageService.getAncestors` traversal.
    const sources = new Set(cold.lineageAncestors.map((e: any) => e.source_version_id));
    expect(sources.has(ids.baseline)).toBe(true);
    expect(sources.has(ids.analysis)).toBe(true);
    expect(sources.has(ids.statement)).toBe(true);
    const edgeTypes = cold.lineageAncestors.map((e: any) => e.edge_type).sort();
    expect(edgeTypes).toContain('MODEL_TO_VALUATION');
    expect(edgeTypes).toContain('STATEMENT_TO_MODEL');
    expect(edgeTypes).toContain('ANALYSIS_TO_MODEL');
    expect(edgeTypes).toContain('STATEMENT_TO_ANALYSIS');

    // Nothing marked stale WITHOUT a reason: a STALE row must carry both a
    // `freshness_reason` and a `stale_since`. A reasonless STALE is the
    // "oznaczony jako nieaktualny bez powodu" failure FC-12.4 forbids.
    const reasonlessStale = cold.freshness.filter(
      (f: any) => f.freshness !== 'CURRENT' && (!f.freshness_reason || !f.stale_since)
    );
    expect(reasonlessStale).toEqual([]);

    evidence.fc12_4 = {
      hotMs, hotDigest: digest(hot), coldDigest: child.digest,
      coldReadMs: child.readMs, coldProcessMs: child.processMs, coldWallMs: child.wallMs,
      writerPids, coldBackendPids: child.backendPids,
      pidsAliveBeforeClose: proof.beforeClose, pidsAliveAfterClose: proof.afterClose,
      poolDrainMs: proof.waitedMs,
      lineageEdgeCount: cold.lineageEdgeCount,
      lineageEdges: cold.lineageAncestors.map((e: any) => `${e.source_artifact_type} -[${e.edge_type}]-> ${e.target_artifact_type}`),
      freshness: cold.freshness,
      stageRowCounts: {
        statementLines: cold.statement.lineCount,
        analysisKpis: cold.analysis.kpiCount,
        baselineOutputs: cold.baseline.outputCount,
        predictionOwnOutputs: cold.prediction.outputCount,
        predictionEffectiveOutputs: cold.prediction.effectiveOutputCount,
        sensitivityCells: cold.valuation.sensitivityCellCount,
      },
      witness: hotWitness,
    };
  }, 240_000);

  // ==========================================================================
  // Negative control — the comparison must be able to FAIL
  // ==========================================================================

  it('FC-NEG — a single corrupted value after approval IS detected by the cold reopen, and the match returns after restore', async () => {
    const before = await coldRead('baseline');

    const row = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ id: string; value_decimal: string }>(
        `SELECT o.id, o.value_decimal::text AS value_decimal
           FROM finance_baseline_outputs o
           JOIN financial_statement_lines fsl ON fsl.id = o.canonical_line_id
          WHERE o.organization_id = ? AND o.business_version_id = ? AND fsl.line_code = 'REVENUE'
          ORDER BY o.period_id LIMIT 1`,
        [orgId, ids.baseline]
      )
    );
    expect(row).toBeTruthy();
    negativeControlRow = { id: row!.id, original: row!.value_decimal };

    /**
     * `SET LOCAL session_replication_role = replica` suppresses the schema's
     * own `trg_finance_baseline_outputs_parent_immutability` (which correctly
     * rejects post-approval writes). Bypassing it is the WHOLE POINT: the
     * control has to simulate corruption the guard did NOT catch, otherwise it
     * would only re-test the trigger. `SET LOCAL` reverts at COMMIT, so the
     * pooled connection is handed back clean.
     */
    const mutateWithTriggersOff = async (id: string, valueSql: string, params: unknown[]) =>
      withPinnedPostgresTransaction(async (tx) => {
        await tx.queryRun(`SET LOCAL session_replication_role = replica`);
        return tx.queryRun(`UPDATE finance_baseline_outputs SET value_decimal = ${valueSql} WHERE id = ?`, [...params, id]);
      });

    const corrupted = await mutateWithTriggersOff(negativeControlRow.id, `value_decimal + 0.01`, []);
    expect(corrupted.changes).toBe(1);

    const during = await coldRead('baseline');
    expect(during.digest).not.toBe(before.digest);
    const diff = firstDifference(before.canonical, during.canonical);
    expect(diff).not.toBe('(identical)');

    const restored = await mutateWithTriggersOff(negativeControlRow.id, `?::numeric`, [negativeControlRow.original]);
    expect(restored.changes).toBe(1);

    const after = await coldRead('baseline');
    expect(after.digest).toBe(before.digest);
    expect(firstDifference(before.canonical, after.canonical)).toBe('(identical)');

    evidence.fcNeg = {
      corruptedRowId: negativeControlRow.id,
      originalValue: negativeControlRow.original,
      digestBefore: before.digest,
      digestWhileCorrupted: during.digest,
      digestAfterRestore: after.digest,
      detected: during.digest !== before.digest,
      restored: after.digest === before.digest,
      firstDifference: diff,
    };
  }, 240_000);
});
