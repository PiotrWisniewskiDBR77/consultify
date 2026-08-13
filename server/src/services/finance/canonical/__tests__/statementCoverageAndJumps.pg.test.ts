/**
 * BUGFIX RC-01 / RC-05 — real-company regression, real PostgreSQL.
 *
 * Finding source: `docs/validation/finance-v3/generated/gate-d/REAL_COMPANY_PROOF_report.md`
 * sections RC-01 and RC-05. Fix report: `.../BUGFIX_RC01_RC05_report.md`.
 *
 *   RC-01 — 212 of 280 real Grupa Apator line-values (FY2022-FY2024) have no target in the
 *           31-code P0 taxonomy. The import still reported `status='CLEAN'`, residual 0, and
 *           went on to be APPROVED. Both the UNMAPPED and the taxonomy-gap EXCLUDED total are
 *           subtracted inside the residual formula, so the loss was counted and then netted
 *           away — the exact "silent success" shape this program exists to prevent.
 *
 *   RC-05 — `fsl-bs-ap` (trade payables) FY2022 = 121 894, FY2023 = 93 591, FY2024 = 722
 *           tys. PLN. A 99.2% one-year collapse passed the whole chain with no flag, and DPO
 *           18.90 was stored as a normal `PRESENT_NONZERO` value.
 *
 * THE NUMBERS ARE REAL, not fixtures: this file reads the same committed extraction evidence
 * the real-company proof used (`docs/validation/finance-v3/generated/gate-d/realcompany/
 * apator_real_source.json`) and replays the proof's PASS A construction verbatim — including
 * its `action:'EXCLUDE' / excludeReasonCode:'NO_P0_CANONICAL_TARGET'` routing for every line
 * the taxonomy cannot hold. If that evidence file ever moves, this suite fails loudly rather
 * than skipping (a skip here would restore exactly the false green it exists to catch).
 *
 * HOW TO RUN (own ephemeral cluster only — never demo/staging/prod):
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/<db> \
 *   npx vitest run --config vitest.config.ts \
 *     src/services/finance/canonical/__tests__/statementCoverageAndJumps.pg.test.ts \
 *     --no-file-parallelism
 *
 * Requires `server/migrations/20260810_finance_v3_d02_reconciliation_coverage.sql` applied.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

// --- Real Apator extraction evidence (same file the real-company proof consumed) -----------
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_JSON = path.resolve(
  HERE,
  '../../../../../../docs/validation/finance-v3/generated/gate-d/realcompany/apator_real_source.json'
);

interface SrcLine {
  canonicalId: string;
  label: string;
  value: number;
}
interface SrcStatement {
  statementType: 'BS' | 'P&L' | 'CF';
  lines: SrcLine[];
}
interface SrcDoc {
  label: string;
  statements: SrcStatement[];
}

const GROUP_DOC_BY_YEAR: Record<number, string> = {
  2022: 'Raport skonsolidowany Apator',
  2023: 'Grupa Apator Raport RS 2023',
  2024: 'Grupa Apator Raport RS 2024',
};
const YEARS = [2022, 2023, 2024] as const;
type Year = (typeof YEARS)[number];

/** The 31-code P0 overlap, transcribed from the real-company harness's RAW_MAP. */
const RAW_MAP: Record<string, { st: 'BS' | 'P&L' | 'CF'; code: string }> = {
  'fsl-pl-revenue': { st: 'P&L', code: 'REVENUE' },
  'fsl-pl-cogs': { st: 'P&L', code: 'COGS' },
  'fsl-pl-gross': { st: 'P&L', code: 'GROSS_MARGIN' },
  'fsl-pl-ebit': { st: 'P&L', code: 'EBIT' },
  'fsl-pl-ebitda': { st: 'P&L', code: 'EBITDA' },
  'fsl-pl-depreciation': { st: 'P&L', code: 'DEPRECIATION' },
  'fsl-pl-tax': { st: 'P&L', code: 'TAX_EXPENSE' },
  'fsl-pl-net': { st: 'P&L', code: 'NET_INCOME' },
  'fsl-pl-interest': { st: 'P&L', code: 'INTEREST_EXPENSE' },
  'fsl-pl-opex': { st: 'P&L', code: 'OPEX' },
  'fsl-bs-cash': { st: 'BS', code: 'CASH' },
  'fsl-bs-ar': { st: 'BS', code: 'AR' },
  'fsl-bs-inventory': { st: 'BS', code: 'INVENTORY' },
  'fsl-bs-current-assets': { st: 'BS', code: 'CURRENT_ASSETS' },
  'fsl-bs-fixed': { st: 'BS', code: 'FIXED_ASSETS' },
  'fsl-bs-total-assets': { st: 'BS', code: 'TOTAL_ASSETS' },
  'fsl-bs-ap': { st: 'BS', code: 'AP' },
  'fsl-bs-current-liabilities': { st: 'BS', code: 'CURRENT_LIABILITIES' },
  'fsl-bs-long-term-debt': { st: 'BS', code: 'LONG_TERM_DEBT' },
  'fsl-bs-total-liabilities': { st: 'BS', code: 'TOTAL_LIABILITIES' },
  'fsl-bs-equity': { st: 'BS', code: 'EQUITY' },
  'fsl-bs-total-liabilities-equity': { st: 'BS', code: 'TOTAL_LIABILITIES_EQUITY' },
  'fsl-bs-retained-earnings': { st: 'BS', code: 'RETAINED_EARNINGS' },
  'fsl-bs-wc': { st: 'BS', code: 'WORKING_CAPITAL' },
  'fsl-cf-operating': { st: 'CF', code: 'CFO' },
  'fsl-cf-investing': { st: 'CF', code: 'CFI' },
  'fsl-cf-financing': { st: 'CF', code: 'CFF' },
  'fsl-cf-capex': { st: 'CF', code: 'CAPEX' },
  'fsl-cf-fcf': { st: 'CF', code: 'FCF' },
  'fsl-cf-net-change-cash': { st: 'CF', code: 'NET_CHANGE_CASH' },
};

function loadYearIndex(): Record<Year, Map<string, { value: number; label: string; statementType: 'BS' | 'P&L' | 'CF' }>> {
  if (!fs.existsSync(SOURCE_JSON)) {
    throw new Error(
      `Real-company evidence missing: ${SOURCE_JSON}. This suite must never silently skip — that is the false green it exists to prevent.`
    );
  }
  const source = JSON.parse(fs.readFileSync(SOURCE_JSON, 'utf8')) as { documents: SrcDoc[] };
  const out = {} as Record<Year, Map<string, { value: number; label: string; statementType: 'BS' | 'P&L' | 'CF' }>>;
  for (const y of YEARS) {
    const doc = source.documents.find((d) => d.label === GROUP_DOC_BY_YEAR[y]);
    if (!doc) throw new Error(`source document not found: ${GROUP_DOC_BY_YEAR[y]}`);
    const m = new Map<string, { value: number; label: string; statementType: 'BS' | 'P&L' | 'CF' }>();
    for (const st of doc.statements) {
      for (const l of st.lines) {
        if (!m.has(l.canonicalId)) m.set(l.canonicalId, { value: l.value, label: l.label, statementType: st.statementType });
      }
    }
    out[y] = m;
  }
  return out;
}

const IDX = loadYearIndex();

describe.skipIf(!REAL_PG)('BUGFIX RC-01 / RC-05 — real Apator data, real PostgreSQL', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let artifactVersionService: typeof import('../artifactVersionService.js');
  let statementMappingService: typeof import('../statementMappingService.js');
  let statementReconciliationService: typeof import('../statementReconciliationService.js');

  const orgId = `org-rc0105-${randomUUID()}`;
  const preparerId = `user-preparer-${randomUUID()}`;
  const periodByYear: Record<number, string> = {};

  async function makePack(entityCode: string) {
    const a = await artifactVersionService.createArtifact({
      organizationId: orgId,
      artifactType: 'STATEMENT_PACK',
      createdBy: preparerId,
    });
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(
        `INSERT INTO finance_stmt_entities (organization_id, business_version_id, entity_code, legal_name, role,
           consolidation_method, ownership_pct, functional_currency, created_by)
         VALUES (?, ?, ?, ?, 'GROUP_PARENT', 'FULL', 100, 'PLN', ?)`,
        [orgId, a.businessVersion.business_version_id, entityCode, 'Apator SA (grupa kapitalowa)', preparerId]
      )
    );
    return a;
  }

  /**
   * PASS A of the real-company proof, verbatim: every extracted line-value for FY2022-FY2024,
   * with the ones the P0 taxonomy cannot hold routed exactly the way the proof routed them.
   *
   * `excludeMode='harness'` reproduces the proof (EXCLUDE + NO_P0_CANONICAL_TARGET).
   * `excludeMode='omit'` drops the rule entirely, so the same rows arrive as UNMAPPED — the
   * other shape the same taxonomy gap takes in the wild.
   */
  function buildPassA(entityCode: string, excludeMode: 'harness' | 'omit') {
    const rawLines: any[] = [];
    const rules: any[] = [];
    let withTarget = 0;
    let withoutTarget = 0;
    const distinctWithoutTarget = new Set<string>();

    for (const y of YEARS) {
      for (const [cid, info] of IDX[y]) {
        const label = `${y}:${cid}`;
        const target = RAW_MAP[cid];
        if (target) {
          withTarget++;
          rawLines.push({
            lineItem: label,
            periodId: periodByYear[y],
            entityCode,
            currency: 'PLN',
            value: info.value,
            sourceRef: { extractorCanonicalId: cid, extractorLabel: info.label },
          });
          rules.push({ sourceLabel: label, statementType: target.st, lineCode: target.code });
        } else {
          withoutTarget++;
          distinctWithoutTarget.add(cid);
          rawLines.push({
            lineItem: label,
            periodId: periodByYear[y],
            entityCode,
            currency: 'PLN',
            value: info.value,
            sourceRef: { extractorCanonicalId: cid, extractorLabel: info.label },
          });
          if (excludeMode === 'harness') {
            rules.push({
              sourceLabel: label,
              statementType: info.statementType,
              lineCode: 'REVENUE',
              action: 'EXCLUDE',
              excludeReasonCode: 'NO_P0_CANONICAL_TARGET',
            });
          }
        }
      }
    }
    return { rawLines, rules, withTarget, withoutTarget, distinctWithoutTarget };
  }

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    artifactVersionService = await import('../artifactVersionService.js');
    statementMappingService = await import('../statementMappingService.js');
    statementReconciliationService = await import('../statementReconciliationService.js');

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'Grupa Apator SA (RC-01/RC-05 regression)'])
    );
    const cal = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ fiscal_calendar_id: string }>(
        `INSERT INTO finance_stmt_calendars (organization_id, calendar_type, fiscal_year_end_month, effective_from, created_by)
         VALUES (?, 'STANDARD', 12, '2018-01-01', ?) RETURNING fiscal_calendar_id`,
        [orgId, preparerId]
      )
    );
    let prev: string | null = null;
    for (const y of YEARS) {
      const row = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ period_id: string }>(
          `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year,
             period_start, period_end, label, previous_period_id, created_by)
           VALUES (?, ?, 'FY', ?, ?, ?, ?, ?, ?) RETURNING period_id`,
          [orgId, cal!.fiscal_calendar_id, y, `${y}-01-01`, `${y}-12-31`, `FY${y}`, prev, preparerId]
        )
      );
      periodByYear[y] = row!.period_id;
      prev = row!.period_id;
    }
  });

  // =========================================================================
  // RC-01
  // =========================================================================
  describe('RC-01 — a Statement Pack that lost most of the source statement can never report CLEAN', () => {
    it('the real Apator PASS A shape (212 of 280 line-values with no P0 target, routed as EXCLUDE/NO_P0_CANONICAL_TARGET) is PROVISIONAL with a countable coverage exception — not CLEAN', async () => {
      const pack = await makePack('GROUP-A');
      const bvId = pack.businessVersion.business_version_id;
      const built = buildPassA('GROUP-A', 'harness');

      // Anchor on the published finding before asserting anything about behaviour: if the
      // evidence file no longer produces 280/212, the numbers below stop meaning what the
      // report says they mean.
      expect(built.rawLines.length).toBe(280);
      expect(built.withoutTarget).toBe(212);
      expect(built.withTarget).toBe(68);
      expect(built.distinctWithoutTarget.size).toBe(89);

      const mapped = await statementMappingService.mapStatementLines({
        organizationId: orgId,
        businessVersionId: bvId,
        unit: 'THOUSANDS',
        presentationCurrency: 'PLN',
        createdBy: preparerId,
        rawLines: built.rawLines,
        rules: built.rules,
      });
      expect(mapped).toHaveLength(280);
      expect(mapped.filter((r) => r.bucket === 'EXCLUDED')).toHaveLength(212);

      const result = await statementReconciliationService.runReconciliation({
        organizationId: orgId,
        artifactId: pack.artifact.artifact_id,
        businessVersionId: bvId,
        sourceSystem: 'apator:real_pdf_extraction',
        mappingResults: mapped,
        createdBy: preparerId,
      });

      // The residual really is 0 — that part of the old behaviour was never wrong, and the fix
      // does not fake a discrepancy that does not exist.
      expect(result.totals.residual).toBe(0);

      // ...but the run must not call that CLEAN. This single assertion is the whole bug.
      expect(result.run.status).not.toBe('CLEAN');
      expect(result.run.status).toBe('WITHIN_TOLERANCE');

      // DEC-FIN-009 verdict, persisted on the run row and readable straight from the DB.
      expect(result.resultQuality).toBe('PROVISIONAL');
      expect(result.run.result_quality).toBe('PROVISIONAL');

      // Countable coverage: how many rows mapped, how many were left, what share of the
      // absolute source VALUE the mapped rows carry.
      const cov = result.totals.coverage;
      expect(cov.totalRowCount).toBe(280);
      expect(cov.coverageLossRowCount).toBe(212);
      expect(cov.mappedRowCount).toBe(68);
      expect(cov.sourceRowCoveragePct).toBeCloseTo(68 / 280, 10);
      expect(cov.absCoveredTotal + cov.absCoverageLossTotal).toBeCloseTo(cov.absSourceTotal, 6);
      expect(cov.sourceValueCoveragePct).not.toBeNull();
      expect(cov.sourceValueCoveragePct!).toBeGreaterThan(0);
      expect(cov.sourceValueCoveragePct!).toBeLessThan(1);
      expect(cov.coverageLossSharePct).toBeGreaterThan(statementReconciliationService.PROVISIONAL_MATERIALITY_THRESHOLD_PCT);

      // A real exception in the append-only ledger, with the coverage numbers as evidence.
      expect(result.coverageException).not.toBeNull();
      expect(result.coverageException?.reason_code).toBe('RECONCILIATION_SOURCE_COVERAGE_INCOMPLETE');
      expect(result.coverageException?.severity).toBe('CRITICAL_DATA');

      const dbRun = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ status: string; result_quality: string | null; source_value_coverage_pct: string | null; coverage_exception_id: string | null }>(
          `SELECT status, result_quality, source_value_coverage_pct, coverage_exception_id
             FROM finance_reconciliation_runs WHERE id = ?`,
          [result.run.id]
        )
      );
      expect(dbRun?.status).not.toBe('CLEAN');
      expect(dbRun?.result_quality).toBe('PROVISIONAL');
      expect(Number(dbRun?.source_value_coverage_pct)).toBeCloseTo(cov.sourceValueCoveragePct!, 8);
      expect(dbRun?.coverage_exception_id).toBe(result.coverageException?.id);

      const dbException = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ severity: string; state: string; evidence: any }>(
          `SELECT severity, state, evidence FROM finance_exceptions_current WHERE exception_group_id = ?`,
          [result.coverageException!.id]
        )
      );
      expect(dbException?.severity).toBe('CRITICAL_DATA');
      expect(dbException?.state).toBe('OPEN');
      const evidence = typeof dbException?.evidence === 'string' ? JSON.parse(dbException.evidence) : dbException?.evidence;
      expect(evidence.coverage.coverageLossRowCount).toBe(212);
      expect(evidence.coverage.mappedRowCount).toBe(68);

      // The Statement Pack itself now carries the verdict, not just the run.
      const bvRow = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ result_quality: string | null }>(
          `SELECT result_quality FROM finance_business_versions WHERE business_version_id = ?`,
          [bvId]
        )
      );
      expect(bvRow?.result_quality).toBe('PROVISIONAL');
    });

    it('the same 212 rows arriving as UNMAPPED (no rule at all) are caught identically — the gap is coverage, not the bucket name', async () => {
      const pack = await makePack('GROUP-B');
      const bvId = pack.businessVersion.business_version_id;
      const built = buildPassA('GROUP-B', 'omit');

      const mapped = await statementMappingService.mapStatementLines({
        organizationId: orgId,
        businessVersionId: bvId,
        unit: 'THOUSANDS',
        presentationCurrency: 'PLN',
        createdBy: preparerId,
        rawLines: built.rawLines,
        rules: built.rules,
      });
      expect(mapped.filter((r) => r.bucket === 'UNMAPPED')).toHaveLength(212);

      const result = await statementReconciliationService.runReconciliation({
        organizationId: orgId,
        artifactId: pack.artifact.artifact_id,
        businessVersionId: bvId,
        sourceSystem: 'apator:real_pdf_extraction',
        mappingResults: mapped,
        createdBy: preparerId,
      });

      expect(result.totals.residual).toBe(0);
      expect(result.run.status).not.toBe('CLEAN');
      expect(result.resultQuality).toBe('PROVISIONAL');
      expect(result.totals.coverage.coverageLossRowCount).toBe(212);
      expect(result.coverageException?.reason_code).toBe('RECONCILIATION_SOURCE_COVERAGE_INCOMPLETE');
    });

    it('does not over-fire: a fully mapped pack plus a genuine analyst exclusion is still CLEAN', async () => {
      const pack = await makePack('CLEANPACK');
      const bvId = pack.businessVersion.business_version_id;

      const rules = [
        { sourceLabel: 'Total assets', statementType: 'BS' as const, lineCode: 'TOTAL_ASSETS' },
        { sourceLabel: 'Total liabilities and equity', statementType: 'BS' as const, lineCode: 'TOTAL_LIABILITIES_EQUITY' },
        {
          sourceLabel: 'One-time non-recurring gain',
          statementType: 'P&L' as const,
          lineCode: 'REVENUE',
          action: 'EXCLUDE' as const,
          excludeReasonCode: 'NON_RECURRING',
        },
      ];
      const rawLines = [
        { lineItem: 'Total assets', periodId: periodByYear[2024], entityCode: 'CLEANPACK', currency: 'PLN', value: 1_000_000, sourceRef: {} },
        { lineItem: 'Total liabilities and equity', periodId: periodByYear[2024], entityCode: 'CLEANPACK', currency: 'PLN', value: 1_000_000, sourceRef: {} },
        { lineItem: 'One-time non-recurring gain', periodId: periodByYear[2024], entityCode: 'CLEANPACK', currency: 'PLN', value: 75_000, sourceRef: {} },
      ];

      const mapped = await statementMappingService.mapStatementLines({
        organizationId: orgId,
        businessVersionId: bvId,
        unit: 'UNITS',
        presentationCurrency: 'PLN',
        createdBy: preparerId,
        rawLines,
        rules,
      });
      const result = await statementReconciliationService.runReconciliation({
        organizationId: orgId,
        artifactId: pack.artifact.artifact_id,
        businessVersionId: bvId,
        sourceSystem: 'mock:parsed_upload',
        mappingResults: mapped,
        createdBy: preparerId,
      });

      expect(result.run.status).toBe('CLEAN');
      expect(result.resultQuality).toBe('CLEAN');
      expect(result.coverageException).toBeNull();
      expect(result.totals.coverage.coverageLossRowCount).toBe(0);
    });
  });

  // =========================================================================
  // RC-05
  // =========================================================================
  describe('RC-05 — an implausible year-over-year move on a material balance-sheet line is flagged', () => {
    it('Apator trade payables 93 591 -> 722 tys. PLN (-99.2%) raises a WARNING exception and never blocks the import', async () => {
      const pack = await makePack('JUMP');
      const bvId = pack.businessVersion.business_version_id;

      // Real numbers, straight out of the extraction evidence — asserted before use.
      const ap2023 = IDX[2023].get('fsl-bs-ap')!.value;
      const ap2024 = IDX[2024].get('fsl-bs-ap')!.value;
      expect(ap2023).toBe(93_591);
      expect(ap2024).toBe(722);

      const ta2023 = IDX[2023].get('fsl-bs-total-assets')!.value;
      const ta2024 = IDX[2024].get('fsl-bs-total-assets')!.value;
      const tle2023 = IDX[2023].get('fsl-bs-total-liabilities-equity')!.value;
      const tle2024 = IDX[2024].get('fsl-bs-total-liabilities-equity')!.value;

      const rules = [
        { sourceLabel: 'AP 2023', statementType: 'BS' as const, lineCode: 'AP' },
        { sourceLabel: 'AP 2024', statementType: 'BS' as const, lineCode: 'AP' },
        { sourceLabel: 'TA 2023', statementType: 'BS' as const, lineCode: 'TOTAL_ASSETS' },
        { sourceLabel: 'TA 2024', statementType: 'BS' as const, lineCode: 'TOTAL_ASSETS' },
        { sourceLabel: 'TLE 2023', statementType: 'BS' as const, lineCode: 'TOTAL_LIABILITIES_EQUITY' },
        { sourceLabel: 'TLE 2024', statementType: 'BS' as const, lineCode: 'TOTAL_LIABILITIES_EQUITY' },
      ];
      const rawLines = [
        { lineItem: 'AP 2023', periodId: periodByYear[2023], entityCode: 'JUMP', currency: 'PLN', value: ap2023, sourceRef: { canonicalId: 'fsl-bs-ap' } },
        { lineItem: 'AP 2024', periodId: periodByYear[2024], entityCode: 'JUMP', currency: 'PLN', value: ap2024, sourceRef: { canonicalId: 'fsl-bs-ap' } },
        { lineItem: 'TA 2023', periodId: periodByYear[2023], entityCode: 'JUMP', currency: 'PLN', value: ta2023, sourceRef: {} },
        { lineItem: 'TA 2024', periodId: periodByYear[2024], entityCode: 'JUMP', currency: 'PLN', value: ta2024, sourceRef: {} },
        { lineItem: 'TLE 2023', periodId: periodByYear[2023], entityCode: 'JUMP', currency: 'PLN', value: tle2023, sourceRef: {} },
        { lineItem: 'TLE 2024', periodId: periodByYear[2024], entityCode: 'JUMP', currency: 'PLN', value: tle2024, sourceRef: {} },
      ];

      const mapped = await statementMappingService.mapStatementLines({
        organizationId: orgId,
        businessVersionId: bvId,
        unit: 'THOUSANDS',
        presentationCurrency: 'PLN',
        createdBy: preparerId,
        rawLines,
        rules,
      });
      expect(mapped.every((r) => r.bucket === 'MAPPED')).toBe(true);

      const result = await statementReconciliationService.runReconciliation({
        organizationId: orgId,
        artifactId: pack.artifact.artifact_id,
        businessVersionId: bvId,
        sourceSystem: 'apator:real_pdf_extraction',
        mappingResults: mapped,
        createdBy: preparerId,
      });

      const apJump = result.periodJumps.find((j) => j.lineCode === 'AP');
      expect(apJump).toBeDefined();
      expect(apJump!.priorValue).toBe(93_591);
      expect(apJump!.currentValue).toBe(722);
      expect(apJump!.direction).toBe('COLLAPSE');
      expect(apJump!.absChangePct).toBeCloseTo((93_591 - 722) / 93_591, 6);
      expect(apJump!.absChangePct).toBeGreaterThan(0.99);
      expect(apJump!.priorPeriodLabel).toBe('FY2023');
      expect(apJump!.currentPeriodLabel).toBe('FY2024');
      expect(apJump!.description).toContain('93591');
      expect(apJump!.description).toContain('722');

      // Total assets moved a normal amount year over year: the control must stay silent there.
      expect(result.periodJumps.some((j) => j.lineCode === 'TOTAL_ASSETS')).toBe(false);

      // A real WARNING row in the append-only ledger.
      const apException = result.periodJumpExceptions.find((e) => {
        const ref = typeof e.source_ref === 'string' ? JSON.parse(e.source_ref) : (e.source_ref as any);
        return ref?.lineCode === 'AP';
      });
      expect(apException).toBeDefined();
      expect(apException!.severity).toBe('WARNING');
      expect(apException!.reason_code).toBe('PERIOD_OVER_PERIOD_JUMP');
      expect(Number(apException!.expected)).toBe(93_591);
      expect(Number(apException!.observed)).toBe(722);

      const dbRow = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ severity: string; state: string; reason_code: string }>(
          `SELECT severity, state, reason_code FROM finance_exceptions_current WHERE exception_group_id = ?`,
          [apException!.id]
        )
      );
      expect(dbRow?.severity).toBe('WARNING');
      expect(dbRow?.reason_code).toBe('PERIOD_OVER_PERIOD_JUMP');
      expect(dbRow?.state).toBe('OPEN');

      // DEC-FIN-009: MARK, do not block. The pack is flagged CONDITIONAL and the readiness gate
      // is untouched by the warning (no SECURITY severity, status still within tolerance).
      expect(result.resultQuality).toBe('CONDITIONAL');
      expect(result.run.status).not.toBe('EXCEEDS_MATERIALITY');

      const readiness = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ check_name: string; passed: boolean }>(`SELECT * FROM finance_stmt_readiness_check(?)`, [bvId])
      );
      const byName = new Map(readiness.map((c) => [c.check_name, c.passed]));
      expect(byName.get('RECONCILIATION_RESIDUAL_WITHIN_TOLERANCE')).toBe(true);
      expect(byName.get('NO_BLOCKING_EXCEPTIONS')).toBe(true);
    });

    it('is idempotent — re-running reconciliation on the same version does not duplicate the WARNING', async () => {
      const pack = await makePack('JUMP2');
      const bvId = pack.businessVersion.business_version_id;
      const rules = [
        { sourceLabel: 'AP 2023', statementType: 'BS' as const, lineCode: 'AP' },
        { sourceLabel: 'AP 2024', statementType: 'BS' as const, lineCode: 'AP' },
        { sourceLabel: 'TA 2023', statementType: 'BS' as const, lineCode: 'TOTAL_ASSETS' },
        { sourceLabel: 'TA 2024', statementType: 'BS' as const, lineCode: 'TOTAL_ASSETS' },
        { sourceLabel: 'TLE 2023', statementType: 'BS' as const, lineCode: 'TOTAL_LIABILITIES_EQUITY' },
        { sourceLabel: 'TLE 2024', statementType: 'BS' as const, lineCode: 'TOTAL_LIABILITIES_EQUITY' },
      ];
      const rawLines = [
        { lineItem: 'AP 2023', periodId: periodByYear[2023], entityCode: 'JUMP2', currency: 'PLN', value: 93_591, sourceRef: {} },
        { lineItem: 'AP 2024', periodId: periodByYear[2024], entityCode: 'JUMP2', currency: 'PLN', value: 722, sourceRef: {} },
        { lineItem: 'TA 2023', periodId: periodByYear[2023], entityCode: 'JUMP2', currency: 'PLN', value: IDX[2023].get('fsl-bs-total-assets')!.value, sourceRef: {} },
        { lineItem: 'TA 2024', periodId: periodByYear[2024], entityCode: 'JUMP2', currency: 'PLN', value: IDX[2024].get('fsl-bs-total-assets')!.value, sourceRef: {} },
        { lineItem: 'TLE 2023', periodId: periodByYear[2023], entityCode: 'JUMP2', currency: 'PLN', value: IDX[2023].get('fsl-bs-total-liabilities-equity')!.value, sourceRef: {} },
        { lineItem: 'TLE 2024', periodId: periodByYear[2024], entityCode: 'JUMP2', currency: 'PLN', value: IDX[2024].get('fsl-bs-total-liabilities-equity')!.value, sourceRef: {} },
      ];
      const mapped = await statementMappingService.mapStatementLines({
        organizationId: orgId,
        businessVersionId: bvId,
        unit: 'THOUSANDS',
        presentationCurrency: 'PLN',
        createdBy: preparerId,
        rawLines,
        rules,
      });

      const common = {
        organizationId: orgId,
        artifactId: pack.artifact.artifact_id,
        businessVersionId: bvId,
        sourceSystem: 'apator:real_pdf_extraction',
        mappingResults: mapped,
        createdBy: preparerId,
      };
      const first = await statementReconciliationService.runReconciliation(common);
      const second = await statementReconciliationService.runReconciliation(common);

      expect(first.periodJumpExceptions.length).toBeGreaterThan(0);
      expect(second.periodJumps.length).toBe(first.periodJumps.length);
      expect(second.periodJumpExceptions).toHaveLength(0); // deduplicated, not re-raised

      const count = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ n: string }>(
          `SELECT count(*) AS n FROM finance_exceptions
            WHERE business_version_id = ? AND reason_code = 'PERIOD_OVER_PERIOD_JUMP'`,
          [bvId]
        )
      );
      expect(Number(count?.n)).toBe(first.periodJumpExceptions.length);
    });
  });
});
