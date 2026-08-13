#!/usr/bin/env tsx
/**
 * REAL-COMPANY PROOF — Grupa Apator SA, FY2022/FY2023/FY2024, through the Finance v3
 * Gate D canonical chain: Statements (map -> reconcile -> readiness -> approve) -> Analysis (18 P0 KPIs).
 *
 * Program: docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md section 13
 * ("Po GoldCo: CD Projekt, Apator, Tesco i Tesla jako real-data proof. Apator musi zachowac poprawna
 * skale okolo PLN 466 mln, nie 466 tys.").
 *
 * WHAT IS REAL HERE: every financial number below is read verbatim from
 * `apator_real_source.json`, which is a distilled copy of the committed extraction evidence
 * `docs/validation/finance-v3/generated/STATEMENT_IMPORT_SAMPLE_AUDIT_2026-03-15.json` — the output of
 * a real PDF extraction run over Apator's own published annual reports (PLN, scaling = THOUSANDS).
 * NOTHING in this script invents a financial figure. Analyst-derived lines in PASS B are computed
 * ONLY by explicit accounting identities from those real numbers, and every one carries its formula
 * in `sourceRef.derivation`.
 *
 * This is a TEST of existing code. No service/migration is modified. Bugs found are reported, not fixed.
 *
 * DB ISOLATION: own ephemeral PostgreSQL cluster only. Never demo/dev/prod.
 *
 * Run:
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/finance_v3_realcompany \
 *   npx tsx docs/validation/finance-v3/generated/gate-d/realcompany/apator_real_pipeline.ts
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
if (!(process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && CONNECTION_STRING.startsWith('postgres'))) {
  throw new Error('apator_real_pipeline.ts requires RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgresql://... against an ephemeral cluster.');
}
if (/28711|52824|57900|28933|:5432\//.test(CONNECTION_STRING)) {
  throw new Error('Refusing to run against a known shared/demo/prod port.');
}
process.env.DB_TYPE = 'postgres';

const HERE = path.dirname(new URL(import.meta.url).pathname);

// ---------------------------------------------------------------------------
// Real source data
// ---------------------------------------------------------------------------
interface SrcLine { canonicalId: string; label: string; value: number }
interface SrcStatement { statementType: 'BS' | 'P&L' | 'CF'; period: string; comparisonPeriod: string | null; readinessStatus: string; readinessScore: number; warnings: string[]; lines: SrcLine[] }
interface SrcDoc { label: string; filePath: string; currency: string; scaling: string; documentClass: string; extractionStrategy: string; statements: SrcStatement[] }

const source = JSON.parse(fs.readFileSync(path.join(HERE, 'apator_real_source.json'), 'utf8')) as { provenance: unknown; documents: SrcDoc[] };

/** The three GROUP-consolidated Apator documents, one per fiscal year. */
const GROUP_DOC_BY_YEAR: Record<number, string> = {
  2022: 'Raport skonsolidowany Apator',
  2023: 'Grupa Apator Raport RS 2023',
  2024: 'Grupa Apator Raport RS 2024',
};
const YEARS = [2022, 2023, 2024] as const;
type Year = (typeof YEARS)[number];

function docFor(label: string): SrcDoc {
  const d = source.documents.find((x) => x.label === label);
  if (!d) throw new Error(`source document not found: ${label}`);
  return d;
}
/** canonicalId -> { value, label, statementType } for one fiscal year of the GROUP. */
function yearIndex(year: Year): Map<string, { value: number; label: string; statementType: 'BS' | 'P&L' | 'CF' }> {
  const d = docFor(GROUP_DOC_BY_YEAR[year]);
  const m = new Map<string, { value: number; label: string; statementType: 'BS' | 'P&L' | 'CF' }>();
  for (const st of d.statements) {
    for (const l of st.lines) {
      if (!m.has(l.canonicalId)) m.set(l.canonicalId, { value: l.value, label: l.label, statementType: st.statementType });
    }
  }
  return m;
}
const IDX: Record<Year, ReturnType<typeof yearIndex>> = { 2022: yearIndex(2022), 2023: yearIndex(2023), 2024: yearIndex(2024) };
const val = (y: Year, id: string): number | null => (IDX[y].has(id) ? IDX[y].get(id)!.value : null);

// ---------------------------------------------------------------------------
// Extractor canonical id -> Finance v3 P0 canonical (statement_type, line_code)
// The P0 taxonomy (`financial_statement_lines`, is_system) has 31 codes; the real extractor emits a
// 251-entry registry (server/src/services/financeCanonicalRegistry.ts). Only these overlap 1:1.
// ---------------------------------------------------------------------------
const RAW_MAP: Record<string, { st: 'BS' | 'P&L' | 'CF'; code: string; note?: string }> = {
  'fsl-pl-revenue': { st: 'P&L', code: 'REVENUE' },
  'fsl-pl-cogs': { st: 'P&L', code: 'COGS' },
  'fsl-pl-gross': { st: 'P&L', code: 'GROSS_MARGIN' },
  'fsl-pl-ebit': { st: 'P&L', code: 'EBIT' },
  'fsl-pl-ebitda': { st: 'P&L', code: 'EBITDA' },
  'fsl-pl-depreciation': { st: 'P&L', code: 'DEPRECIATION' },
  'fsl-pl-tax': { st: 'P&L', code: 'TAX_EXPENSE' },
  'fsl-pl-net': { st: 'P&L', code: 'NET_INCOME' },
  'fsl-pl-interest': { st: 'P&L', code: 'INTEREST_EXPENSE', note: 'extractor maps "Wynik na dzialalnosci finansowej" (NET finance result) onto INTEREST_EXPENSE' },
  'fsl-pl-opex': { st: 'P&L', code: 'OPEX', note: 'extractor maps "Zysk ze sprzedazy" (profit on sales) onto OPEX' },
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

async function main() {
  const started = Date.now();
  const logLines: string[] = [];
  const findings: Array<{ id: string; severity: string; title: string; detail: string }> = [];
  const record = (m: string) => { console.log(m); logLines.push(m); };
  const flag = (id: string, severity: string, title: string, detail: string) => {
    findings.push({ id, severity, title, detail });
    record(`  [FINDING ${id} ${severity}] ${title} :: ${detail}`);
  };

  const { withPinnedPostgresTransaction } = await import('../../../../../../server/src/database/PostgresDatabase.js');
  const artifactVersionService = await import('../../../../../../server/src/services/finance/canonical/artifactVersionService.js');
  const statementMappingService = await import('../../../../../../server/src/services/finance/canonical/statementMappingService.js');
  const statementReconciliationService = await import('../../../../../../server/src/services/finance/canonical/statementReconciliationService.js');
  const lineageService = await import('../../../../../../server/src/services/finance/canonical/lineageService.js');
  const kpiComputeService = await import('../../../../../../server/src/services/finance/canonical/kpiComputeService.js');
  const { toFullUnitValue } = await import('../../../../../../server/src/services/finance/canonical/valuationFcffService.js');

  type Tx = { queryAll: Function; queryOne: Function; queryRun: Function };

  const orgId = `org-apator-real-${randomUUID()}`;
  const preparerId = 'user-preparer-apator';
  const reviewerId = 'user-reviewer-apator';
  const approverId = 'user-approver-apator';

  await withPinnedPostgresTransaction((tx: Tx) => tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'Grupa Apator SA (real-data proof)']));

  const calendar = await withPinnedPostgresTransaction((tx: Tx) =>
    tx.queryOne(
      `INSERT INTO finance_stmt_calendars (organization_id, calendar_type, fiscal_year_end_month, effective_from, created_by)
       VALUES (?, 'STANDARD', 12, '2018-01-01', ?) RETURNING fiscal_calendar_id`,
      [orgId, preparerId]
    )
  );
  const calendarId = calendar.fiscal_calendar_id;

  const periodByYear: Record<number, string> = {};
  {
    let prev: string | null = null;
    for (const y of YEARS) {
      const row = await withPinnedPostgresTransaction((tx: Tx) =>
        tx.queryOne(
          `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, period_start, period_end, label, previous_period_id, created_by)
           VALUES (?, ?, 'FY', ?, ?, ?, ?, ?, ?) RETURNING period_id`,
          [orgId, calendarId, y, `${y}-01-01`, `${y}-12-31`, `FY${y}`, prev, preparerId]
        )
      );
      periodByYear[y] = row.period_id;
      prev = row.period_id;
    }
  }
  record(`[setup] org=${orgId} periods FY2022/23/24 chained via previous_period_id`);

  // =======================================================================
  // Shared helpers
  // =======================================================================
  interface RawRow { lineItem: string; periodId: string; entityCode: string; currency: string; value: number | null; sourceRef: Record<string, unknown> }
  interface Rule { sourceLabel: string; statementType: 'BS' | 'P&L' | 'CF'; lineCode: string; action?: 'MAP' | 'EXCLUDE'; excludeReasonCode?: string }

  async function makePack(entityCode: string) {
    const a = await artifactVersionService.createArtifact({ organizationId: orgId, artifactType: 'STATEMENT_PACK', createdBy: preparerId });
    await withPinnedPostgresTransaction((tx: Tx) =>
      tx.queryOne(
        `INSERT INTO finance_stmt_entities (organization_id, business_version_id, entity_code, legal_name, role, consolidation_method, ownership_pct, functional_currency, created_by)
         VALUES (?, ?, ?, ?, 'GROUP_PARENT', 'FULL', 100, 'PLN', ?) RETURNING id`,
        [orgId, a.businessVersion.business_version_id, entityCode, 'Apator SA (grupa kapitalowa)', preparerId]
      )
    );
    return a;
  }

  async function mapReconcileApprove(pack: any, rawLines: RawRow[], rules: Rule[], label: string, unit: 'UNITS' | 'THOUSANDS') {
    const bvId = pack.businessVersion.business_version_id;
    let mapped: any[];
    try {
      mapped = await statementMappingService.mapStatementLines({
        organizationId: orgId, businessVersionId: bvId, unit, presentationCurrency: 'PLN',
        createdBy: preparerId, rawLines, rules,
      });
    } catch (err) {
      record(`  [${label}] mapStatementLines THREW: ${(err as Error).message}`);
      return { ok: false as const, error: (err as Error).message, bvId };
    }
    const buckets: Record<string, number> = {};
    for (const m of mapped) buckets[m.bucket] = (buckets[m.bucket] ?? 0) + 1;
    record(`  [${label}] buckets=${JSON.stringify(buckets)}`);
    const recon = await statementReconciliationService.runReconciliation({
      organizationId: orgId, artifactId: pack.artifact.artifact_id, businessVersionId: bvId,
      sourceSystem: 'apator:real_pdf_extraction', mappingResults: mapped, createdBy: preparerId,
      attemptReadinessTransition: true, actorId: preparerId, role: 'preparer', expectedVersion: pack.businessVersion.version,
    });
    record(`  [${label}] reconciliation status=${recon.run.status} residual=${recon.run.residual} ready=${recon.readiness.ready}`);
    const failedChecks = recon.readiness.checks.filter((c: any) => !c.passed);
    if (failedChecks.length) record(`  [${label}] failed readiness checks: ${JSON.stringify(failedChecks)}`);
    if (!recon.readiness.transitionResult?.ok) {
      return { ok: false as const, error: `readiness/transition failed: ${JSON.stringify(recon.readiness.transitionResult)}`, bvId, buckets, checks: recon.readiness.checks, recon };
    }
    await withPinnedPostgresTransaction((tx: Tx) => tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?`, [bvId]));
    const startedReview = await artifactVersionService.transition({
      organizationId: orgId, businessVersionId: bvId, action: 'start_review', actorId: reviewerId, role: 'reviewer',
      expectedVersion: recon.readiness.businessVersion.version,
    });
    if (!startedReview.ok) return { ok: false as const, error: `start_review: ${JSON.stringify(startedReview)}`, bvId, buckets };
    const approved = await artifactVersionService.approveVersion({
      organizationId: orgId, businessVersionId: bvId, actorId: approverId, role: 'approver',
      expectedVersion: startedReview.businessVersion.version, editorUserIds: [preparerId], reviewStartedBy: reviewerId,
    });
    record(`  [${label}] approve ok=${approved.ok}`);
    return { ok: approved.ok as boolean, bvId, buckets, approved, checks: recon.readiness.checks };
  }

  async function runAnalysis(sourceBvId: string, label: string, unit: string, kpiYears: Year[]) {
    const analysis = await artifactVersionService.createArtifact({ organizationId: orgId, artifactType: 'HISTORICAL_ANALYSIS', createdBy: preparerId });
    const abv = analysis.businessVersion.business_version_id;
    await withPinnedPostgresTransaction((tx: Tx) =>
      tx.queryRun(
        `INSERT INTO finance_analysis_definitions (organization_id, business_version_id, purpose, analysis_type, entity_scope_mode, presentation_currency, unit, created_by)
         VALUES (?, ?, 'BOARD_REPORTING', 'STANDARD', 'GROUP_CONSOLIDATED', 'PLN', ?, ?)`,
        [orgId, abv, unit, preparerId]
      )
    );
    const edge = await lineageService.insertEdge({
      organizationId: orgId, sourceVersionId: sourceBvId, sourceArtifactType: 'STATEMENT_PACK',
      targetVersionId: abv, targetArtifactType: 'HISTORICAL_ANALYSIS', edgeType: 'STATEMENT_TO_ANALYSIS',
      transformationKind: 'MANUAL_LINK', authorId: preparerId,
    });
    if (!edge.ok) throw new Error(`lineage edge failed: ${JSON.stringify(edge)}`);
    const catalog = await withPinnedPostgresTransaction((tx: Tx) =>
      tx.queryAll<{ id: string; kpi_code: string }>(`SELECT id, kpi_code FROM finance_analysis_kpi_catalog WHERE status = 'ACTIVE' ORDER BY kpi_code`)
    );
    const entityRow = await withPinnedPostgresTransaction((tx: Tx) =>
      tx.queryOne<{ id: string }>(`SELECT id FROM finance_stmt_entities WHERE business_version_id = ? LIMIT 1`, [sourceBvId])
    );
    for (const y of kpiYears) {
      for (const c of catalog) {
        await withPinnedPostgresTransaction((tx: Tx) =>
          tx.queryRun(
            `INSERT INTO finance_analysis_kpi_values (organization_id, business_version_id, kpi_catalog_id, entity_id, period_id)
             VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
            [orgId, abv, c.id, entityRow.id, periodByYear[y]]
          )
        );
      }
    }
    const computed = await kpiComputeService.computeAnalysisKpis({ organizationId: orgId, businessVersionId: abv, requestedByUserId: preparerId });
    if (!computed.ok) throw new Error(`computeAnalysisKpis failed: ${JSON.stringify(computed)}`);
    // Attach period label to each result for readability.
    const periodLabelById = new Map(Object.entries(periodByYear).map(([y, pid]) => [pid as string, `FY${y}`]));
    const rows = await withPinnedPostgresTransaction((tx: Tx) =>
      tx.queryAll<{ kpi_code: string; period_id: string; value_status: string; value_decimal: string | null; quality_flag: string | null }>(
        `SELECT c.kpi_code, v.period_id, v.value_status, v.value_decimal, v.quality_flag
           FROM finance_analysis_kpi_values v JOIN finance_analysis_kpi_catalog c ON c.id = v.kpi_catalog_id
          WHERE v.business_version_id = ? ORDER BY v.period_id, c.kpi_code`,
        [abv]
      )
    );
    record(`\n  [ANALYSIS ${label}] ${rows.length} KPI cells (${catalog.length} KPIs x ${kpiYears.length} periods)`);
    const table: any[] = [];
    for (const r of rows) {
      const py = periodLabelById.get(r.period_id) ?? r.period_id;
      const v = r.value_decimal === null ? null : Number(r.value_decimal);
      table.push({ period: py, kpi: r.kpi_code, status: r.value_status, value: v, qualityFlag: r.quality_flag });
      record(`    ${py} ${r.kpi_code.padEnd(28)} ${String(r.value_status).padEnd(18)} ${v === null ? 'null' : v.toFixed(6)}${r.quality_flag ? '  flag=' + r.quality_flag : ''}`);
    }
    return { analysisBvId: abv, table };
  }

  // =======================================================================
  // PASS A — raw extractor output, mapped 1:1, no analyst intervention
  // =======================================================================
  record(`\n================ PASS A: AS-EXTRACTED (no analyst derivation) ================`);
  const passARaw: RawRow[] = [];
  const passARules: Rule[] = [];
  let excludedNoTarget = 0;
  const excludedIds = new Set<string>();
  for (const y of YEARS) {
    for (const [cid, info] of IDX[y]) {
      const label = `${y}:${cid}`;
      const target = RAW_MAP[cid];
      if (target) {
        passARaw.push({ lineItem: label, periodId: periodByYear[y], entityCode: 'GROUP', currency: 'PLN', value: info.value, sourceRef: { source: 'apator_real_source.json', document: GROUP_DOC_BY_YEAR[y], extractorCanonicalId: cid, extractorLabel: info.label, scaling: 'thousands' } });
        passARules.push({ sourceLabel: label, statementType: target.st, lineCode: target.code });
      } else {
        passARaw.push({ lineItem: label, periodId: periodByYear[y], entityCode: 'GROUP', currency: 'PLN', value: info.value, sourceRef: { source: 'apator_real_source.json', extractorCanonicalId: cid, extractorLabel: info.label } });
        passARules.push({ sourceLabel: label, statementType: info.statementType, lineCode: 'REVENUE', action: 'EXCLUDE', excludeReasonCode: 'NO_P0_CANONICAL_TARGET' });
        excludedNoTarget++;
        excludedIds.add(cid);
      }
    }
  }
  record(`[PASS A] ${passARaw.length} real extracted line-values across FY2022-FY2024; ${passARaw.length - excludedNoTarget} have a P0 canonical target, ${excludedNoTarget} excluded (NO_P0_CANONICAL_TARGET, ${excludedIds.size} distinct extractor line ids)`);
  flag('RC-01', 'P1', 'P0 canonical taxonomy carries only a fraction of a real IFRS statement',
    `${excludedNoTarget} of ${passARaw.length} real Apator line-values (${excludedIds.size} distinct extractor canonical ids) have NO target in the 31-code Finance v3 P0 taxonomy (financial_statement_lines, is_system). The real extractor emits a 251-entry registry (server/src/services/financeCanonicalRegistry.ts). Everything below EBIT-level detail (leasing, goodwill, ROU, deferred tax, WC movements, OCI) is dropped at the Gate D boundary.`);

  const packA = await makePack('GROUP');
  const resA = await mapReconcileApprove(packA, passARaw, passARules, 'PASS A', 'THOUSANDS');
  record(`[PASS A] statement pack ok=${resA.ok} bv=${resA.bvId}`);

  let analysisA: any = null;
  if (resA.ok) analysisA = await runAnalysis(resA.bvId, 'PASS A (as-extracted)', 'THOUSANDS', [2023, 2024]);

  // =======================================================================
  // PASS B — analyst-completed pack: derived lines by explicit identities + sign normalization
  // =======================================================================
  record(`\n================ PASS B: ANALYST-COMPLETED ================`);
  interface Derived { code: string; st: 'BS' | 'P&L' | 'CF'; value: number | null; derivation: string }
  function derivedFor(y: Year): Derived[] {
    const g = (id: string) => val(y, id);
    const ebt = g('fsl-pl-ebt');
    const taxTotal = g('fsl-pl-tax') ?? ((g('fsl-pl-tax-current') ?? 0) + (g('fsl-pl-tax-deferred') ?? 0) || null);
    const netContinuing = g('fsl-pl-net-continuing');
    const netIncome = netContinuing !== null ? netContinuing : (ebt !== null && taxTotal !== null ? ebt + taxTotal : null);
    const da = ['fsl-cf-operating-depreciation-intangibles', 'fsl-cf-operating-depreciation-ppe', 'fsl-cf-operating-depreciation-rou']
      .map(g).filter((x): x is number => x !== null);
    const daTotal = da.length ? da.reduce((a, b) => a + b, 0) : null;
    const ebit = g('fsl-pl-ebit');
    const netChange = g('fsl-cf-net-change-cash');
    const cfi = g('fsl-cf-investing');
    const cff = g('fsl-cf-financing');
    const cfo = netChange !== null && cfi !== null && cff !== null ? netChange - cfi - cff : null;
    const capex = g('fsl-cf-capex');
    const fcf = cfo !== null && capex !== null ? cfo + capex : null;
    const selling = g('fsl-pl-selling');
    const gna = g('fsl-pl-gna');
    const opex = selling !== null && gna !== null ? -(selling + gna) : null;
    const ca = g('fsl-bs-current-assets');
    const cl = g('fsl-bs-current-liabilities');
    const wc = ca !== null && cl !== null ? ca - cl : null;
    const interestExpense = g('fsl-cf-operating-interest-cost');
    const cogs = g('fsl-pl-cogs');
    return [
      { code: 'NET_INCOME', st: 'P&L', value: netIncome, derivation: netContinuing !== null ? 'as reported: fsl-pl-net-continuing' : 'EBT + tax expense (tax reported negative): fsl-pl-ebt + fsl-pl-tax' },
      { code: 'DEPRECIATION', st: 'P&L', value: daTotal, derivation: 'sum of CF add-backs: intangibles + PPE + right-of-use amortisation' },
      { code: 'EBITDA', st: 'P&L', value: ebit !== null && daTotal !== null ? ebit + daTotal : null, derivation: 'EBIT + D&A (fsl-pl-ebit + summed CF depreciation add-backs)' },
      { code: 'CFO', st: 'CF', value: cfo, derivation: 'net change in cash - CFI - CFF (Apator PDFs do not expose a single CFO subtotal line to the extractor)' },
      { code: 'FCF', st: 'CF', value: fcf, derivation: 'CFO + capex (capex reported negative)' },
      { code: 'OPEX', st: 'P&L', value: opex, derivation: 'selling + general&admin costs, sign-normalised to positive' },
      { code: 'WORKING_CAPITAL', st: 'BS', value: wc, derivation: 'current assets - current liabilities' },
      { code: 'INTEREST_EXPENSE', st: 'P&L', value: interestExpense, derivation: 'CF interest-cost add-back (fsl-cf-operating-interest-cost) — the true interest expense; the extractor put NET finance result on fsl-pl-interest' },
      { code: 'COGS', st: 'P&L', value: cogs === null ? null : -cogs, derivation: 'as reported, sign-normalised to positive (P0 KPI formulas assume positive cost convention — see finding RC-04)' },
    ];
  }

  const passBRaw: RawRow[] = [];
  const passBRules: Rule[] = [];
  const derivationLedger: any[] = [];
  const SIGN_NORMALISED = new Set(['COGS', 'OPEX', 'INTEREST_EXPENSE']);
  for (const y of YEARS) {
    const derived = derivedFor(y);
    const derivedByCode = new Map(derived.map((d) => [d.code, d]));
    for (const [cid, info] of IDX[y]) {
      const target = RAW_MAP[cid];
      if (!target) continue;
      if (derivedByCode.has(target.code)) continue; // analyst-corrected below
      const label = `${y}:${cid}`;
      passBRaw.push({ lineItem: label, periodId: periodByYear[y], entityCode: 'GROUP', currency: 'PLN', value: info.value, sourceRef: { source: 'apator_real_source.json', document: GROUP_DOC_BY_YEAR[y], extractorCanonicalId: cid, extractorLabel: info.label, provenance: 'as-reported' } });
      passBRules.push({ sourceLabel: label, statementType: target.st, lineCode: target.code });
    }
    for (const d of derived) {
      if (d.value === null) { derivationLedger.push({ year: y, code: d.code, value: null, derivation: d.derivation, status: 'NOT_DERIVABLE' }); continue; }
      const label = `${y}:DERIVED:${d.code}`;
      passBRaw.push({ lineItem: label, periodId: periodByYear[y], entityCode: 'GROUP', currency: 'PLN', value: d.value, sourceRef: { source: 'apator_real_source.json', document: GROUP_DOC_BY_YEAR[y], provenance: SIGN_NORMALISED.has(d.code) ? 'analyst-normalised' : 'analyst-derived', derivation: d.derivation } });
      passBRules.push({ sourceLabel: label, statementType: d.st, lineCode: d.code });
      derivationLedger.push({ year: y, code: d.code, value: d.value, derivation: d.derivation, status: 'OK' });
    }
  }
  record(`[PASS B] ${passBRaw.length} rows (as-reported + analyst-derived); derivation ledger has ${derivationLedger.length} entries, ${derivationLedger.filter((d) => d.status === 'NOT_DERIVABLE').length} not derivable`);

  const packB = await makePack('GROUP');
  const resB = await mapReconcileApprove(packB, passBRaw, passBRules, 'PASS B', 'THOUSANDS');
  record(`[PASS B] statement pack ok=${resB.ok} bv=${resB.bvId}`);
  let analysisB: any = null;
  if (resB.ok) analysisB = await runAnalysis(resB.bvId, 'PASS B (analyst-completed)', 'THOUSANDS', [2023, 2024]);

  // =======================================================================
  // APATOR SCALE PROOF
  // =======================================================================
  record(`\n================ APATOR SCALE PROOF ================`);
  const scaleBv = resB.ok ? resB.bvId : resA.bvId;
  const scaleRows = await withPinnedPostgresTransaction((tx: Tx) =>
    tx.queryAll<any>(
      `SELECT f.line_code, l.value_status, l.value_decimal, l.unit, l.multiplier, l.presentation_currency, p.label AS period_label
         FROM finance_stmt_lines l
         JOIN financial_statement_lines f ON f.id = l.canonical_line_id
         JOIN finance_stmt_periods p ON p.period_id = l.period_id
        WHERE l.business_version_id = ? AND p.fiscal_year = 2024
          AND f.line_code = ANY(?)
        ORDER BY f.line_code`,
      [scaleBv, ['REVENUE', 'EBITDA', 'EBIT', 'NET_INCOME', 'TOTAL_ASSETS', 'EQUITY', 'CASH', 'LONG_TERM_DEBT']]
    )
  );
  const scaleProof = scaleRows.map((r: any) => {
    const stored = Number(r.value_decimal);
    const full = toFullUnitValue({ value_status: r.value_status, value_decimal: r.value_decimal, unit: r.unit, multiplier: r.multiplier });
    return {
      lineCode: r.line_code, period: r.period_label, unit: r.unit, multiplier: Number(r.multiplier),
      storedValueDecimal: stored,
      fullUnitValuePLN: full,
      naiveUnitBlindReadPLN: stored,
      ratioCorrectOverNaive: full === null ? null : full / stored,
      correctScaleBand: full === null ? null : full >= 1e8 ? 'hundreds of millions or more' : full >= 1e6 ? 'millions' : 'thousands or less',
    };
  });
  for (const s of scaleProof) {
    record(`  ${s.lineCode.padEnd(18)} stored=${s.storedValueDecimal.toLocaleString('en-US')} unit=${s.unit} -> full PLN ${s.fullUnitValuePLN === null ? 'null' : s.fullUnitValuePLN.toLocaleString('en-US')}  (naive unit-blind read would be ${s.naiveUnitBlindReadPLN.toLocaleString('en-US')}, ${s.ratioCorrectOverNaive}x too small)`);
  }
  const equity = scaleProof.find((s) => s.lineCode === 'EQUITY');
  const revenue = scaleProof.find((s) => s.lineCode === 'REVENUE');
  const scaleVerdict = {
    anchorFromHandoff: 'Apator must keep the correct scale, ~PLN 466 million, not 466 thousand',
    equityFullPLN: equity?.fullUnitValuePLN ?? null,
    revenueFullPLN: revenue?.fullUnitValuePLN ?? null,
    allInHundredsOfMillionsOrMore: scaleProof.every((s) => (s.fullUnitValuePLN ?? 0) === 0 || Math.abs(s.fullUnitValuePLN ?? 0) >= 1e6),
    passed: (equity?.fullUnitValuePLN ?? 0) >= 1e8 && (revenue?.fullUnitValuePLN ?? 0) >= 1e9,
  };
  record(`  VERDICT scale: equity=${scaleVerdict.equityFullPLN?.toLocaleString('en-US')} PLN, revenue=${scaleVerdict.revenueFullPLN?.toLocaleString('en-US')} PLN -> passed=${scaleVerdict.passed}`);

  // KPI scale-invariance control: re-import the SAME real numbers pre-multiplied to UNITS and
  // confirm the 18 P0 KPIs are bit-identical (they are all ratios/percent/days).
  record(`\n[scale control] re-importing the SAME real FY2022-24 numbers at unit=UNITS (x1000 pre-multiplied)`);
  const packC = await makePack('GROUP');
  const passCRaw: RawRow[] = passBRaw.map((r) => ({ ...r, value: r.value === null ? null : r.value * 1000, sourceRef: { ...r.sourceRef, scaleControl: 'pre-multiplied to full PLN units' } }));
  const resC = await mapReconcileApprove(packC, passCRaw, passBRules, 'SCALE CONTROL (UNITS)', 'UNITS');
  let analysisC: any = null;
  if (resC.ok) analysisC = await runAnalysis(resC.bvId, 'SCALE CONTROL (UNITS)', 'UNITS', [2023, 2024]);

  let kpiInvariance: any = { compared: 0, identical: 0, mismatches: [] as any[] };
  if (analysisB && analysisC) {
    const keyOf = (r: any) => `${r.period}|${r.kpi}`;
    const cByKey = new Map(analysisC.table.map((r: any) => [keyOf(r), r]));
    for (const b of analysisB.table) {
      const c: any = cByKey.get(keyOf(b));
      if (!c) continue;
      kpiInvariance.compared++;
      const same = b.status === c.status && ((b.value === null && c.value === null) || (b.value !== null && c.value !== null && Math.abs(b.value - c.value) <= Math.abs(b.value) * 1e-9 + 1e-12));
      if (same) kpiInvariance.identical++;
      else kpiInvariance.mismatches.push({ key: keyOf(b), thousands: { status: b.status, value: b.value }, units: { status: c.status, value: c.value } });
    }
    record(`[scale control] KPI cells compared=${kpiInvariance.compared} identical=${kpiInvariance.identical} mismatches=${kpiInvariance.mismatches.length}`);
    if (kpiInvariance.mismatches.length) {
      flag('RC-SCALE', 'P0', 'P0 KPI values are NOT invariant to the declared unit', JSON.stringify(kpiInvariance.mismatches).slice(0, 2000));
    }
  }

  // =======================================================================
  // PROBE 1 — retained-earnings roll-forward against a real IFRS equity statement
  // =======================================================================
  record(`\n================ PROBE 1: RE roll-forward with real dividends ================`);
  const packD = await makePack('GROUP');
  const probeRaw = [...passBRaw];
  const probeRules = [...passBRules];
  for (const y of YEARS) {
    const div = val(y, 'fsl-cf-dividends');
    if (div === null) continue;
    const label = `${y}:DERIVED:DIVIDENDS_DECLARED`;
    probeRaw.push({ lineItem: label, periodId: periodByYear[y], entityCode: 'GROUP', currency: 'PLN', value: Math.abs(div), sourceRef: { derivation: 'dividends paid per CF, sign-normalised positive' } });
    probeRules.push({ sourceLabel: label, statementType: 'BS', lineCode: 'DIVIDENDS_DECLARED' });
  }
  const resD = await mapReconcileApprove(packD, probeRaw, probeRules, 'PROBE 1 (with dividends)', 'THOUSANDS');
  const probe1 = {
    intent: 'Add the real, reported dividends-paid line so the RETAINED_EARNINGS roll-forward constraint trigger actually fires',
    outcome: resD.ok ? 'ACCEPTED' : 'REJECTED',
    error: (resD as any).error ?? null,
    handComputed: YEARS.filter((y) => y > 2022).map((y) => {
      const prev = (y - 1) as Year;
      const openingRE = val(prev, 'fsl-bs-retained-earnings');
      const closingRE = val(y, 'fsl-bs-retained-earnings');
      const ni = val(y, 'fsl-pl-net-continuing') ?? ((val(y, 'fsl-pl-ebt') ?? 0) + (val(y, 'fsl-pl-tax') ?? 0));
      const div = Math.abs(val(y, 'fsl-cf-dividends') ?? 0);
      return { year: y, openingRE, netIncome: ni, dividends: div, closingREReported: closingRE, closingREImplied: openingRE === null ? null : openingRE + ni - div, gapThousandsPLN: openingRE === null || closingRE === null ? null : closingRE - (openingRE + ni - div) };
    }),
  };
  record(`  PROBE 1 outcome=${probe1.outcome}${probe1.error ? ' error=' + String(probe1.error).slice(0, 400) : ''}`);
  for (const h of probe1.handComputed) record(`    FY${h.year}: opening RE ${h.openingRE} + NI ${h.netIncome} - div ${h.dividends} = ${h.closingREImplied}, but reported closing RE = ${h.closingREReported} (gap ${h.gapThousandsPLN} tys. PLN)`);
  if (!resD.ok) {
    flag('RC-02', 'P1', 'RETAINED_EARNINGS roll-forward constraint rejects a real, correctly-filed IFRS consolidated pack',
      `The P0 identity openingRE + NI - dividends = closingRE does not hold for Apator's real consolidated equity (transfers to/from other reserves, treasury shares, OCI, NCI). Adding the real dividends line makes the whole import fail: ${String((resD as any).error).slice(0, 600)}`);
  }

  // =======================================================================
  // PROBE 2 — balance-check tolerance scale
  // =======================================================================
  record(`\n================ PROBE 2: balance tolerance at unit=THOUSANDS ================`);
  const tolRows = await withPinnedPostgresTransaction((tx: Tx) =>
    tx.queryAll<any>(`SELECT finance_stmt_unit_value('THOUSANDS') AS thousands, finance_stmt_unit_value('UNITS') AS units`)
  );
  const probe2Results: any[] = [];
  for (const imbalance of [500, 1500]) {
    const packE = await makePack('GROUP');
    const y: Year = 2024;
    const ta = val(y, 'fsl-bs-total-assets')!;
    const rows: RawRow[] = [
      { lineItem: 'TA', periodId: periodByYear[y], entityCode: 'GROUP', currency: 'PLN', value: ta, sourceRef: { probe: 'balance-tolerance' } },
      { lineItem: 'TLE', periodId: periodByYear[y], entityCode: 'GROUP', currency: 'PLN', value: ta + imbalance, sourceRef: { probe: 'balance-tolerance', injectedImbalanceThousands: imbalance } },
    ];
    const rules: Rule[] = [
      { sourceLabel: 'TA', statementType: 'BS', lineCode: 'TOTAL_ASSETS' },
      { sourceLabel: 'TLE', statementType: 'BS', lineCode: 'TOTAL_LIABILITIES_EQUITY' },
    ];
    let accepted = false; let err: string | null = null;
    try {
      await statementMappingService.mapStatementLines({ organizationId: orgId, businessVersionId: packE.businessVersion.business_version_id, unit: 'THOUSANDS', presentationCurrency: 'PLN', createdBy: preparerId, rawLines: rows, rules });
      accepted = true;
    } catch (e) { err = (e as Error).message; }
    probe2Results.push({ injectedImbalanceThousandsPLN: imbalance, injectedImbalanceFullPLN: imbalance * 1000, accepted, error: err ? err.slice(0, 300) : null });
    record(`  imbalance ${imbalance} tys. PLN (= ${(imbalance * 1000).toLocaleString('en-US')} PLN): ${accepted ? 'ACCEPTED (balance check passed)' : 'REJECTED'}`);
  }
  if (probe2Results[0]?.accepted) {
    flag('RC-03', 'P1', 'Balance-check tolerance is expressed in raw stored units, so it scales 1000x with the declared unit',
      `finance_stmt_balance_tolerance() returns finance_stmt_unit_value(unit) (=1000 for THOUSANDS) and compares it against value_decimal, which is ALREADY expressed in thousands. At unit=THOUSANDS the Assets=L+E check therefore tolerates up to 1,000,000 PLN of imbalance instead of the intended 1,000 PLN ("1 full presentation unit"). Probe: a 500 tys. PLN (=500,000 PLN) imbalance on the real Apator FY2024 balance sheet was ACCEPTED. At unit=UNITS the same code tolerates 1 PLN. Same unit-multiplier class of bug as the Apator 1000x finding, in the opposite direction.`);
  }

  // =======================================================================
  // PROBE 3 — is the declared sign_convention honoured at compute time?
  // =======================================================================
  record(`\n================ PROBE 3: sign_convention=CONTRA on as-filed negative COGS ================`);
  const packF = await makePack('GROUP');
  const contraRaw: RawRow[] = [];
  const contraRules: Rule[] = [];
  for (const y of YEARS) {
    for (const [cid, info] of IDX[y]) {
      const target = RAW_MAP[cid];
      if (!target) continue;
      const label = `${y}:${cid}`;
      contraRaw.push({ lineItem: label, periodId: periodByYear[y], entityCode: 'GROUP', currency: 'PLN', value: info.value, sourceRef: { probe: 'sign-convention', extractorCanonicalId: cid } });
      // Declare every as-filed negative cost line as CONTRA — the column exists precisely to carry
      // "this value is filed with the opposite sign to the canonical convention".
      const isContra = info.value < 0 && ['COGS', 'OPEX', 'INTEREST_EXPENSE', 'TAX_EXPENSE', 'CAPEX'].includes(target.code);
      contraRules.push({ sourceLabel: label, statementType: target.st, lineCode: target.code, signConvention: isContra ? 'CONTRA' : 'NATURAL' } as Rule);
    }
  }
  const resF = await mapReconcileApprove(packF, contraRaw, contraRules, 'PROBE 3 (CONTRA)', 'THOUSANDS');
  let probe3: any = { ok: resF.ok, storedSignConventions: null, dio: null, verdict: 'not-run' };
  if (resF.ok) {
    const signRows = await withPinnedPostgresTransaction((tx: Tx) =>
      tx.queryAll<any>(
        `SELECT f.line_code, l.sign_convention, l.value_decimal FROM finance_stmt_lines l
           JOIN financial_statement_lines f ON f.id = l.canonical_line_id
           JOIN finance_stmt_periods p ON p.period_id = l.period_id
          WHERE l.business_version_id = ? AND p.fiscal_year = 2024 AND f.line_code IN ('COGS','REVENUE') ORDER BY f.line_code`,
        [resF.bvId]
      )
    );
    const analysisF = await runAnalysis(resF.bvId, 'PROBE 3 (CONTRA)', 'THOUSANDS', [2024]);
    const dioRow = analysisF.table.find((r: any) => r.kpi === 'DIO' && r.period === 'FY2024');
    probe3 = { ok: true, storedSignConventions: signRows, dio: dioRow, verdict: dioRow?.status === 'NOT_APPLICABLE' ? 'IGNORED' : 'HONOURED' };
    record(`  stored sign_convention: ${JSON.stringify(signRows)}`);
    record(`  DIO FY2024 with COGS declared CONTRA: ${JSON.stringify(dioRow)} -> sign_convention ${probe3.verdict}`);
    if (probe3.verdict === 'IGNORED') {
      flag('RC-04', 'P1', 'finance_stmt_lines.sign_convention is written but never applied by the KPI engine',
        `Real filings carry costs as negatives (Apator FY2024 COGS = ${val(2024, 'fsl-pl-cogs')} tys. PLN); the P0 KPI formulas assume the positive-cost convention the GoldCo oracle uses. Declaring the line sign_convention='CONTRA' at map time is accepted and persisted, but kpiComputeService.loadStmtLineCells() selects only (entity, canonical_line, period, scope, basis, value_status, value_decimal) — sign_convention is not in the projection and is never applied. Result: DIO/DPO stay NOT_APPLICABLE (negative denominator) even though the analyst declared the correct convention. The only way through is to physically flip the stored value, which loses the as-filed figure.`);
    }
  }

  // =======================================================================
  // PROBE 4 — valuation-scale check on real Apator FCFF, via production helpers
  // =======================================================================
  record(`\n================ PROBE 4: valuation scale on real Apator FY2024 FCFF ================`);
  const { computeGordonTerminalValue } = await import('../../../../../../server/src/services/finance/canonical/valuationTerminalService.js');
  const { discountCashFlows } = await import('../../../../../../server/src/services/finance/canonical/valuationDiscountService.js');
  const { computeEquityValue } = await import('../../../../../../server/src/services/finance/canonical/valuationBridgeService.js');
  const thousandsToPln = 1000;
  const ebit24 = val(2024, 'fsl-pl-ebit')! * thousandsToPln;
  const tax24 = Math.abs(val(2024, 'fsl-pl-tax')!) * thousandsToPln;
  const ebt24 = val(2024, 'fsl-pl-ebt')! * thousandsToPln;
  const effTaxRate = tax24 / ebt24;
  const da24 = (val(2024, 'fsl-cf-operating-depreciation-intangibles')! + val(2024, 'fsl-cf-operating-depreciation-ppe')! + val(2024, 'fsl-cf-operating-depreciation-rou')!) * thousandsToPln;
  const capex24 = Math.abs(val(2024, 'fsl-cf-capex')!) * thousandsToPln;
  const wc24 = (val(2024, 'fsl-bs-current-assets')! - val(2024, 'fsl-bs-current-liabilities')!) * thousandsToPln;
  const wc23 = (val(2023, 'fsl-bs-current-assets')! - val(2023, 'fsl-bs-current-liabilities')!) * thousandsToPln;
  const fcff24 = ebit24 * (1 - effTaxRate) + da24 - capex24 - (wc24 - wc23);
  record(`  real inputs (full PLN): EBIT=${ebit24.toLocaleString('en-US')} effTax=${(effTaxRate * 100).toFixed(2)}% D&A=${da24.toLocaleString('en-US')} capex=${capex24.toLocaleString('en-US')} dWC=${(wc24 - wc23).toLocaleString('en-US')}`);
  record(`  FCFF FY2024 = ${fcff24.toLocaleString('en-US')} PLN`);
  const netDebt = (val(2024, 'fsl-bs-long-term-borrowings')! + val(2024, 'fsl-bs-short-term-debt')! + val(2024, 'fsl-bs-long-term-debt-lease')! + val(2024, 'fsl-bs-short-term-debt-lease')!) * thousandsToPln;
  const cash24 = val(2024, 'fsl-bs-cash')! * thousandsToPln;
  const valuationGrid: any[] = [];
  for (const waccPct of [8, 9, 10, 11, 12]) {
    for (const gPct of [1, 2, 3]) {
      const tv = computeGordonTerminalValue({ fcffTerminalYear: fcff24, gPct, waccPct });
      if (!tv.ok) { valuationGrid.push({ waccPct, gPct, error: tv.code }); continue; }
      const pv = discountCashFlows({ years: [{ fiscalYear: 2025, fcff: fcff24 }], waccPct, terminalValue: tv.terminalValue } as any);
      const ev = (pv as any).enterpriseValue ?? null;
      const eq = ev === null ? null : computeEquityValue(ev, [
        { componentKind: 'DEBT', sign: 'SUBTRACT_FROM_EV', amountDecimal: netDebt, asOfDate: '2024-12-31' },
        { componentKind: 'CASH', sign: 'ADD_TO_EV', amountDecimal: cash24, asOfDate: '2024-12-31' },
      ] as any);
      valuationGrid.push({ waccPct, gPct, enterpriseValuePLN: ev, equityValuePLN: eq && (eq as any).ok ? (eq as any).equityValueDecimal : null, naiveUnitBlindEVPLN: ev === null ? null : ev / 1000 });
    }
  }
  const evs = valuationGrid.map((c) => c.enterpriseValuePLN).filter((x): x is number => typeof x === 'number');
  const probe4 = {
    disclaimer: 'WACC/g are an ILLUSTRATIVE sensitivity band, not a valuation opinion. The point of this probe is ORDER OF MAGNITUDE: every cell must land in hundreds of millions / billions of PLN, never in thousands.',
    realInputsFullPLN: { ebit: ebit24, effectiveTaxRate: effTaxRate, dAndA: da24, capex: capex24, deltaWorkingCapital: wc24 - wc23, fcff: fcff24, netDebt, cash: cash24 },
    grid: valuationGrid,
    minEVPLN: evs.length ? Math.min(...evs) : null,
    maxEVPLN: evs.length ? Math.max(...evs) : null,
    allCellsAtLeast100mPLN: evs.length > 0 && evs.every((v) => v >= 1e8),
    naiveUnitBlindWouldBeBelow1mPLN: evs.length > 0 && evs.every((v) => v / 1000 < 1e7),
  };
  record(`  EV band across ${evs.length} cells: ${probe4.minEVPLN?.toLocaleString('en-US')} .. ${probe4.maxEVPLN?.toLocaleString('en-US')} PLN`);
  record(`  all cells >= PLN 100m: ${probe4.allCellsAtLeast100mPLN}; a unit-blind read would put the same company at ${(probe4.minEVPLN ?? 0) / 1000 < 1e6 ? 'under PLN 1m' : 'PLN ' + ((probe4.minEVPLN ?? 0) / 1000).toLocaleString('en-US')}`);

  // =======================================================================
  // Data-quality observations on the real extraction
  // =======================================================================
  record(`\n================ REAL-DATA QUALITY OBSERVATIONS ================`);
  const dq: any[] = [];
  const apByYear = YEARS.map((y) => ({ year: y, ap: val(y, 'fsl-bs-ap') }));
  dq.push({ id: 'DQ-AP', observation: 'trade payables', values: apByYear });
  record(`  AP by year: ${JSON.stringify(apByYear)}`);
  if ((val(2024, 'fsl-bs-ap') ?? 0) < (val(2023, 'fsl-bs-ap') ?? 0) / 10) {
    flag('RC-05', 'P1', 'Real extraction produced an implausible AP for FY2024 and the engine computes on it without complaint',
      `fsl-bs-ap FY2024 = ${val(2024, 'fsl-bs-ap')} tys. PLN vs FY2023 = ${val(2023, 'fsl-bs-ap')} and FY2022 = ${val(2022, 'fsl-bs-ap')}. A >99% one-year collapse in trade payables for a group with PLN 1.23bn revenue is an extraction defect, not a business event. No readiness check, reconciliation rule or KPI quality flag catches it — DPO is computed and stored as a normal value.`);
  }
  const missingPerYear = YEARS.map((y) => ({ year: y, missingP0Codes: Object.values(RAW_MAP).map((t) => t.code).filter((code) => ![...IDX[y].keys()].some((cid) => RAW_MAP[cid]?.code === code)) }));
  for (const m of missingPerYear) record(`  FY${m.year} P0 codes NOT directly extracted (${m.missingP0Codes.length}): ${m.missingP0Codes.join(', ')}`);
  dq.push({ id: 'DQ-MISSING', missingPerYear });
  const arByYear = YEARS.map((y) => ({ year: y, ar: val(y, 'fsl-bs-ar') }));
  record(`  AR by year: ${JSON.stringify(arByYear)}`);
  if (val(2023, 'fsl-bs-ar') === null) {
    flag('RC-06', 'P2', 'A required KPI input is missing for one year only, silently degrading two KPIs',
      `fsl-bs-ar is extracted for FY2022 (${val(2022, 'fsl-bs-ar')}) and FY2024 (${val(2024, 'fsl-bs-ar')}) but NOT for FY2023 — the same statement type from the same issuer, one year apart. Average-balance DSO and CASH_CONVERSION_CYCLE for FY2024 therefore cannot be computed. This is an extractor coverage gap, and its downstream effect is visible only as a MISSING KPI status.`);
  }

  // =======================================================================
  // Results
  // =======================================================================
  const out = {
    generatedAt: new Date().toISOString(),
    wallClockMs: Date.now() - started,
    company: 'Grupa Apator SA',
    sourceProvenance: source.provenance,
    realLineValuesLoaded: passARaw.length,
    p0TaxonomySize: 31,
    passA: { ok: resA.ok, businessVersionId: resA.bvId, buckets: (resA as any).buckets ?? null, error: (resA as any).error ?? null, excludedNoP0Target: excludedNoTarget, distinctExcludedExtractorIds: excludedIds.size, kpis: analysisA?.table ?? null },
    passB: { ok: resB.ok, businessVersionId: resB.bvId, buckets: (resB as any).buckets ?? null, error: (resB as any).error ?? null, derivationLedger, kpis: analysisB?.table ?? null },
    scaleControlUnits: { ok: resC.ok, businessVersionId: resC.bvId, error: (resC as any).error ?? null, kpis: analysisC?.table ?? null },
    apatorScaleProof: { rows: scaleProof, verdict: scaleVerdict, kpiInvariance },
    probe1RetainedEarningsRollforward: probe1,
    probe2BalanceTolerance: { unitValues: tolRows[0], results: probe2Results },
    probe3SignConvention: probe3,
    probe4RealFcffValuationScale: probe4,
    dataQuality: dq,
    findings,
  };
  fs.writeFileSync(path.join(HERE, 'apator_real_pipeline_results.json'), JSON.stringify(out, null, 2));
  fs.writeFileSync(path.join(HERE, 'apator_real_pipeline_run.log'), logLines.join('\n'));
  record(`\n[done] ${findings.length} finding(s); results written to apator_real_pipeline_results.json`);
}

main().then(
  () => process.exit(0),
  (err) => { console.error('FATAL', err); process.exit(1); }
);
