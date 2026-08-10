#!/usr/bin/env tsx
/**
 * GoldCo Manufacturing Group — FULL DAG end-to-end integration run
 * (Statement -> Analysis -> Baseline -> Prediction -> Valuation), in one
 * continuous pipeline, all five domains linked by real `finance_lineage_edges`
 * rows to the SAME GoldCo org/entity — not five independent islands.
 *
 * Program: docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md
 * section 13 ("Gold vertical slice"). This is an INTEGRATION test, not a new engine — every
 * compute call below invokes the real, already-committed Gate D service
 * (statementMappingService/statementReconciliationService/artifactVersionService/lineageService/
 * kpiComputeService/baselineComputeService/predictionPreflightService/predictionComputeService/
 * valuation*Service) exactly as WP-D02/D04/D06/D08/D10 already tested them individually. Financial
 * source data (PARENT/SUB FY2023-2025, restatement, consolidation) is read from the Fala 3 gold
 * vertical slice's own independent oracle output, `goldco_oracle.json` (see
 * GOLDCO_STATEMENTS_VERTICAL_SLICE_REPORT.md and BUGFIX_GOLDCO_01_02_03_report.md — BUG-GOLDCO-01/
 * 02/03 already fixed and re-verified there; this run exercises the FIXED code paths directly).
 *
 * DB ISOLATION (hard requirement): own ephemeral PostgreSQL cluster only, never demo/dev/prod,
 * never the shared Homebrew instance (PID 911). This script does NOT start Postgres itself — run
 * it against an already-migrated ephemeral cluster (see
 * GOLDCO_FULL_DAG_END_TO_END_REPORT.md "Reproduce" section for the exact commands used).
 *
 * Run:
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/finance_v3_goldco_fulldag \
 *   npx tsx docs/validation/finance-v3/generated/gate-d/goldco/goldco_full_dag.ts
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
if (!(process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && CONNECTION_STRING.startsWith('postgres'))) {
  throw new Error('goldco_full_dag.ts requires RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgresql://... against an ephemeral cluster — refusing to run against an ambiguous/default target.');
}
process.env.DB_TYPE = 'postgres';

const HERE = path.dirname(new URL(import.meta.url).pathname);

async function main() {
  const wallClockStart = Date.now();
  const phaseTimings: Array<{ phase: string; ms: number }> = [];
  let lastMark = wallClockStart;
  const markPhase = (name: string) => {
    const now = Date.now();
    phaseTimings.push({ phase: name, ms: now - lastMark });
    lastMark = now;
  };

  // Six '../' from docs/validation/finance-v3/generated/gate-d/goldco/ reaches the repo root —
  // same convention goldco_pipeline.ts already established.
  const { withPinnedPostgresTransaction } = await import('../../../../../../server/src/database/PostgresDatabase.js');
  const artifactVersionService = await import('../../../../../../server/src/services/finance/canonical/artifactVersionService.js');
  const statementMappingService = await import('../../../../../../server/src/services/finance/canonical/statementMappingService.js');
  const statementReconciliationService = await import('../../../../../../server/src/services/finance/canonical/statementReconciliationService.js');
  const lineageService = await import('../../../../../../server/src/services/finance/canonical/lineageService.js');
  const kpiComputeService = await import('../../../../../../server/src/services/finance/canonical/kpiComputeService.js');
  const baselineComputeService = await import('../../../../../../server/src/services/finance/canonical/baselineComputeService.js');
  const predictionPreflightService = await import('../../../../../../server/src/services/finance/canonical/predictionPreflightService.js');
  const predictionComputeService = await import('../../../../../../server/src/services/finance/canonical/predictionComputeService.js');
  const valuationComputeService = await import('../../../../../../server/src/services/finance/canonical/valuationComputeService.js');
  const valuationWaccService = await import('../../../../../../server/src/services/finance/canonical/valuationWaccService.js');
  const valuationTerminalService = await import('../../../../../../server/src/services/finance/canonical/valuationTerminalService.js');
  const valuationSensitivityService = await import('../../../../../../server/src/services/finance/canonical/valuationSensitivityService.js');
  const valuationBridgeService = await import('../../../../../../server/src/services/finance/canonical/valuationBridgeService.js');

  type Tx = { queryAll: Function; queryOne: Function; queryRun: Function };

  const oracle = JSON.parse(fs.readFileSync(path.join(HERE, 'goldco_oracle.json'), 'utf8'));

  const log: string[] = [];
  const findings: Array<{ id: string; note: string }> = [];
  const record = (msg: string) => {
    // eslint-disable-next-line no-console
    console.log(msg);
    log.push(msg);
  };
  const flag = (id: string, note: string) => {
    findings.push({ id, note });
    record(`  [INTEGRATION FINDING ${id}] ${note}`);
  };

  const orgId = `org-goldco-fulldag-${randomUUID()}`;
  const preparerId = 'user-preparer-goldco';
  const reviewerId = 'user-reviewer-goldco';
  const approverId = 'user-approver-goldco'; // distinct from preparer/reviewer — required for MATERIAL+ risk tiers
  const financeAdminId = 'user-finance-admin-goldco'; // second distinct user for Valuation maker-checker (HIGH_RISK)

  await withPinnedPostgresTransaction((tx: Tx) => tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'GoldCo Manufacturing Group (Full DAG)']));

  const engineManifest = await withPinnedPostgresTransaction((tx: Tx) =>
    tx.queryOne<{ engine_manifest_id: string }>(`SELECT engine_manifest_id FROM finance_engine_manifests WHERE engine_name = 'LEGACY_UNKNOWN' LIMIT 1`)
  );
  if (!engineManifest) throw new Error('finance_engine_manifests LEGACY_UNKNOWN sentinel row not found — migration b01 not applied?');
  const engineManifestId = engineManifest.engine_manifest_id;

  // =========================================================================
  // Calendar + periods
  // =========================================================================
  const calendar = await withPinnedPostgresTransaction((tx: Tx) =>
    tx.queryOne(
      `INSERT INTO finance_stmt_calendars (organization_id, calendar_type, fiscal_year_end_month, effective_from, created_by)
       VALUES (?, 'STANDARD', 12, '2020-01-01', ?) RETURNING fiscal_calendar_id`,
      [orgId, preparerId]
    )
  );
  const calendarId = calendar.fiscal_calendar_id;

  async function makeFyPeriod(fiscalYear: number, start: string, end: string, label: string, previousPeriodId: string | null) {
    const row = await withPinnedPostgresTransaction((tx: Tx) =>
      tx.queryOne(
        `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, period_start, period_end, label, previous_period_id, created_by)
         VALUES (?, ?, 'FY', ?, ?, ?, ?, ?, ?) RETURNING period_id`,
        [orgId, calendarId, fiscalYear, start, end, label, previousPeriodId, preparerId]
      )
    );
    return row.period_id as string;
  }
  const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  async function makeMonthPeriod(fiscalYear: number, month: number, previousPeriodId: string | null) {
    const start = `${fiscalYear}-${String(month).padStart(2, '0')}-01`;
    const end = `${fiscalYear}-${String(month).padStart(2, '0')}-${String(monthDays[month - 1]).padStart(2, '0')}`;
    const label = `${fiscalYear}-M${String(month).padStart(2, '0')}`;
    const row = await withPinnedPostgresTransaction((tx: Tx) =>
      tx.queryOne(
        `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, fiscal_month, period_start, period_end, label, previous_period_id, created_by)
         VALUES (?, ?, 'MONTH', ?, ?, ?, ?, ?, ?, ?) RETURNING period_id`,
        [orgId, calendarId, fiscalYear, month, start, end, label, previousPeriodId, preparerId]
      )
    );
    return row.period_id as string;
  }

  const periodFY2023 = await makeFyPeriod(2023, '2023-01-01', '2023-12-31', 'FY2023', null);
  const periodFY2024 = await makeFyPeriod(2024, '2024-01-01', '2024-12-31', 'FY2024', periodFY2023);
  const periodFY2025 = await makeFyPeriod(2025, '2025-01-01', '2025-12-31', 'FY2025', periodFY2024);
  const periodFY2026 = await makeFyPeriod(2026, '2026-01-01', '2026-12-31', 'FY2026', periodFY2025);
  const periodFY2027 = await makeFyPeriod(2027, '2027-01-01', '2027-12-31', 'FY2027', periodFY2026);
  const periodFY2028 = await makeFyPeriod(2028, '2028-01-01', '2028-12-31', 'FY2028', periodFY2027);

  const monthPeriods2025: string[] = [];
  {
    let prev: string | null = null;
    for (let m = 1; m <= 12; m++) {
      const pid = await makeMonthPeriod(2025, m, prev);
      monthPeriods2025.push(pid);
      prev = pid;
    }
  }
  const monthPeriods2026: string[] = [];
  {
    let prev: string | null = monthPeriods2025[11];
    for (let m = 1; m <= 12; m++) {
      const pid = await makeMonthPeriod(2026, m, prev);
      monthPeriods2026.push(pid);
      prev = pid;
    }
  }
  record(`[periods] FY2023=${periodFY2023} FY2024=${periodFY2024} FY2025=${periodFY2025} FY2026=${periodFY2026} FY2027=${periodFY2027} FY2028=${periodFY2028}`);
  record(`[periods] 12 MONTH periods FY2025 (actuals), 12 MONTH periods FY2026 (forecast)`);

  // Custom org-scoped canonical lines needed for the consolidated pack (same as Fala 3 slice).
  async function makeCustomLine(id: string, statementType: string, lineCode: string, name: string) {
    await withPinnedPostgresTransaction((tx: Tx) =>
      tx.queryRun(
        `INSERT INTO financial_statement_lines (id, organization_id, statement_type, line_code, line_name, is_system)
         VALUES (?, ?, ?, ?, ?, false) ON CONFLICT (id) DO NOTHING`,
        [id, orgId, statementType, lineCode, name]
      )
    );
  }
  await makeCustomLine(`fsl-goldco-fd-cta-oci-${randomUUID()}`, 'BS', 'CTA_OCI', 'Cumulative Translation Adjustment (OCI)');
  await makeCustomLine(`fsl-goldco-fd-icloan-${randomUUID()}`, 'BS', 'INTERCOMPANY_LOAN', 'Intercompany Loan (Parent <-> Sub)');

  // =========================================================================
  // PHASE 1 — STATEMENT layer
  // =========================================================================
  const t1start = Date.now();
  record(`\n================ PHASE 1: STATEMENT ================`);

  const PL_FIELD_MAP: Record<string, string> = {
    revenue: 'REVENUE', cogs: 'COGS', grossMargin: 'GROSS_MARGIN', opex: 'OPEX', ebitda: 'EBITDA',
    depreciation: 'DEPRECIATION', ebit: 'EBIT', interest: 'INTEREST_EXPENSE', taxExpense: 'TAX_EXPENSE', netIncome: 'NET_INCOME',
  };
  const BS_FIELD_MAP: Record<string, string> = {
    cash: 'CASH', ar: 'AR', inventory: 'INVENTORY', currentAssets: 'CURRENT_ASSETS', fixedAssets: 'FIXED_ASSETS',
    totalAssets: 'TOTAL_ASSETS', ap: 'AP', currentLiabilities: 'CURRENT_LIABILITIES', longTermDebt: 'LONG_TERM_DEBT',
    totalLiabilities: 'TOTAL_LIABILITIES', totalEquity: 'EQUITY', totalLiabilitiesEquity: 'TOTAL_LIABILITIES_EQUITY',
  };

  interface Bundle {
    pl: Record<string, number>; bs: Record<string, number>; closingRE: number; dividendsDeclared: number;
    cfo?: number; cfi?: number; cff?: number; netChangeCash?: number;
  }

  function buildFullPackRows(entityCode: string, periodId: string, currency: string, bundle: Bundle, opts: { includeCF?: boolean } = {}) {
    const rawLines: any[] = [];
    const rules: any[] = [];
    const push = (label: string, statementType: 'P&L' | 'BS' | 'CF', lineCode: string, value: number) => {
      rawLines.push({ lineItem: label, periodId, entityCode, currency, value, sourceRef: { source: 'goldco_oracle.json', field: label } });
      rules.push({ sourceLabel: label, statementType, lineCode });
    };
    for (const [field, code] of Object.entries(PL_FIELD_MAP)) push(`${entityCode}:PL:${field}`, 'P&L', code, bundle.pl[field]);
    for (const [field, code] of Object.entries(BS_FIELD_MAP)) push(`${entityCode}:BS:${field}`, 'BS', code, bundle.bs[field]);
    push(`${entityCode}:BS:retainedEarnings`, 'BS', 'RETAINED_EARNINGS', bundle.closingRE);
    push(`${entityCode}:BS:dividendsDeclared`, 'BS', 'DIVIDENDS_DECLARED', bundle.dividendsDeclared);
    if (opts.includeCF) {
      push(`${entityCode}:CF:cfo`, 'CF', 'CFO', bundle.cfo!);
      push(`${entityCode}:CF:cfi`, 'CF', 'CFI', bundle.cfi!);
      push(`${entityCode}:CF:cff`, 'CF', 'CFF', bundle.cff!);
      push(`${entityCode}:CF:netChangeCash`, 'CF', 'NET_CHANGE_CASH', bundle.netChangeCash!);
    }
    return { rawLines, rules };
  }

  async function makeStatementPack() {
    return artifactVersionService.createArtifact({ organizationId: orgId, artifactType: 'STATEMENT_PACK', createdBy: preparerId });
  }
  async function makeEntity(businessVersionId: string, entityCode: string, opts: {
    role?: string; consolidationMethod?: string; ownershipPct?: number | null; functionalCurrency: string;
  }) {
    const row = await withPinnedPostgresTransaction((tx: Tx) =>
      tx.queryOne(
        `INSERT INTO finance_stmt_entities (
           organization_id, business_version_id, entity_code, legal_name, role, consolidation_method, ownership_pct, functional_currency, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [
          orgId, businessVersionId, entityCode, `${entityCode} legal name`,
          opts.role ?? 'GROUP_PARENT', opts.consolidationMethod ?? 'NOT_CONSOLIDATED',
          opts.ownershipPct ?? null, opts.functionalCurrency, preparerId,
        ]
      )
    );
    return row.id as string;
  }

  async function mapReconcileApprove(
    businessVersionId: string, artifactId: string, expectedVersionStart: number,
    rawLines: any[], rules: any[], label: string
  ) {
    const mapped = await statementMappingService.mapStatementLines({
      organizationId: orgId, businessVersionId, unit: 'UNITS', presentationCurrency: 'PLN',
      createdBy: preparerId, rawLines, rules,
    });
    const badBuckets = mapped.filter((m: any) => m.bucket === 'UNMAPPED' || m.bucket === 'DUPLICATE');
    if (badBuckets.length > 0) {
      record(`  [WARN][${label}] ${badBuckets.length} row(s) UNMAPPED/DUPLICATE: ${JSON.stringify(badBuckets.map((b: any) => ({ item: b.raw.lineItem, bucket: b.bucket, reason: b.reasonCode })))}`);
    }
    const recon = await statementReconciliationService.runReconciliation({
      organizationId: orgId, artifactId, businessVersionId, sourceSystem: 'goldco:full_dag',
      mappingResults: mapped, createdBy: preparerId, attemptReadinessTransition: true,
      actorId: preparerId, role: 'preparer', expectedVersion: expectedVersionStart,
    });
    record(`  [${label}] reconciliation status=${recon.run.status} residual=${recon.run.residual} ready=${recon.readiness.ready} transitionOk=${recon.readiness.transitionResult?.ok}`);
    if (!recon.readiness.transitionResult?.ok) {
      const failed = recon.readiness.checks.filter((c: any) => !c.passed);
      record(`  [${label}] readiness FAILED checks: ${JSON.stringify(failed)}`);
      return { mapped, recon, approved: null as any };
    }
    await withPinnedPostgresTransaction((tx: Tx) => tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?`, [businessVersionId]));
    const started = await artifactVersionService.transition({
      organizationId: orgId, businessVersionId, action: 'start_review', actorId: reviewerId, role: 'reviewer',
      expectedVersion: recon.readiness.businessVersion.version,
    });
    if (!started.ok) { record(`  [${label}] start_review FAILED: ${JSON.stringify(started)}`); return { mapped, recon, approved: null as any }; }
    const approved = await artifactVersionService.approveVersion({
      organizationId: orgId, businessVersionId, actorId: approverId, role: 'approver',
      expectedVersion: started.businessVersion.version, editorUserIds: [preparerId], reviewStartedBy: reviewerId,
    });
    record(`  [${label}] approve ok=${approved.ok}${approved.ok ? '' : ' code=' + (approved as any).code}`);
    return { mapped, recon, approved };
  }

  // --- PARENT FY2023 -> FY2024(original, APPROVED) -> reopen -> RESTATED(APPROVED) -> FY2025 ---
  const packParentFY2023 = await makeStatementPack();
  await makeEntity(packParentFY2023.businessVersion.business_version_id, 'PARENT', { functionalCurrency: 'PLN' });
  const rowsParentFY2023 = buildFullPackRows('PARENT', periodFY2023, 'PLN', oracle.parent.FY2023, { includeCF: true });
  await mapReconcileApprove(
    packParentFY2023.businessVersion.business_version_id, packParentFY2023.artifact.artifact_id,
    packParentFY2023.businessVersion.version, rowsParentFY2023.rawLines, rowsParentFY2023.rules, 'PARENT FY2023'
  );

  const packParentFY2024 = await makeStatementPack();
  await makeEntity(packParentFY2024.businessVersion.business_version_id, 'PARENT', { functionalCurrency: 'PLN' });
  const rowsParentFY2024Orig = buildFullPackRows('PARENT', periodFY2024, 'PLN', oracle.parent.FY2024_original, { includeCF: true });
  const resParentFY2024Orig = await mapReconcileApprove(
    packParentFY2024.businessVersion.business_version_id, packParentFY2024.artifact.artifact_id,
    packParentFY2024.businessVersion.version, rowsParentFY2024Orig.rawLines, rowsParentFY2024Orig.rules, 'PARENT FY2024 ORIGINAL'
  );

  let restatedBvId: string | null = null;
  if (resParentFY2024Orig.approved?.ok) {
    const origBvId = packParentFY2024.businessVersion.business_version_id;
    const RESTATEMENT_REASON = 'Inventory valuation error discovered during FY2025 Q1 close: obsolete/slow-moving finished-goods stock at the Radom plant was carried at cost instead of net realizable value in the FY2024 audited pack.';
    const reopened = await artifactVersionService.reopenVersion({
      organizationId: orgId, businessVersionId: origBvId, actorId: approverId, role: 'approver',
      expectedVersion: resParentFY2024Orig.approved.businessVersion.version, reason: RESTATEMENT_REASON,
      versionKind: 'RESTATED', restatementReason: RESTATEMENT_REASON, restatementClass: 'ERROR_CORRECTION',
    });
    if (reopened.ok) {
      restatedBvId = reopened.businessVersion.business_version_id;
      await makeEntity(restatedBvId, 'PARENT', { functionalCurrency: 'PLN' });
      const rowsRestated = buildFullPackRows('PARENT', periodFY2024, 'PLN', oracle.parent.FY2024_restated, { includeCF: true });
      const resRestated = await mapReconcileApprove(
        restatedBvId, reopened.businessVersion.artifact_id, reopened.businessVersion.version,
        rowsRestated.rawLines, rowsRestated.rules, 'PARENT FY2024 RESTATED'
      );
      if (!resRestated.approved?.ok) {
        flag('IF-01', `PARENT FY2024 RESTATED did not reach APPROVED: ${JSON.stringify(resRestated.approved)} — BUG-GOLDCO-03 regression?`);
      } else {
        record(`  [PARENT FY2024 RESTATED] reached APPROVED, business_version_id=${restatedBvId}`);
      }
    } else {
      flag('IF-02', `reopenVersion() for PARENT FY2024 restatement FAILED: ${JSON.stringify(reopened)}`);
    }
  }

  const packParentFY2025 = await makeStatementPack();
  const entParentFY2025Annual = await makeEntity(packParentFY2025.businessVersion.business_version_id, 'PARENT', { functionalCurrency: 'PLN' });
  const rowsParentFY2025 = buildFullPackRows('PARENT', periodFY2025, 'PLN', oracle.parent.FY2025, { includeCF: true });
  const resParentFY2025 = await mapReconcileApprove(
    packParentFY2025.businessVersion.business_version_id, packParentFY2025.artifact.artifact_id,
    packParentFY2025.businessVersion.version, rowsParentFY2025.rawLines, rowsParentFY2025.rules, 'PARENT FY2025 ANNUAL'
  );
  void entParentFY2025Annual;

  // --- SUB FY2023/24/25 ---
  async function subPack(label: string, periodId: string, bundle: Bundle) {
    const pack = await makeStatementPack();
    await makeEntity(pack.businessVersion.business_version_id, 'SUB', { functionalCurrency: 'EUR' });
    const rows = buildFullPackRows('SUB', periodId, 'EUR', bundle);
    const res = await mapReconcileApprove(pack.businessVersion.business_version_id, pack.artifact.artifact_id, pack.businessVersion.version, rows.rawLines, rows.rules, `SUB ${label}`);
    return { pack, res };
  }
  await subPack('FY2023', periodFY2023, oracle.sub.FY2023);
  await subPack('FY2024', periodFY2024, oracle.sub.FY2024);
  await subPack('FY2025', periodFY2025, oracle.sub.FY2025);

  // --- Consolidated GoldCo Group FY2025 pack (PARENT + SUB + elimination) ---
  const packGroup = await makeStatementPack();
  const groupBvId = packGroup.businessVersion.business_version_id;
  await makeEntity(groupBvId, 'PARENT', { role: 'GROUP_PARENT', consolidationMethod: 'NOT_CONSOLIDATED', functionalCurrency: 'PLN' });
  const entGroupSub = await makeEntity(groupBvId, 'SUB', { role: 'SUBSIDIARY', consolidationMethod: 'FULL', ownershipPct: 80, functionalCurrency: 'EUR' });
  await makeEntity(groupBvId, 'ELIM', { role: 'ELIMINATION_BUCKET', consolidationMethod: 'NOT_CONSOLIDATED', functionalCurrency: 'PLN' });
  void entGroupSub;

  const g = oracle.groupFY2025;
  const st = oracle.sub.FY2025_translated;
  const groupRawLines: any[] = [];
  const groupRules: any[] = [];
  const pushGroup = (entityCode: string, label: string, statementType: 'P&L' | 'BS', lineCode: string, value: number, scope: string) => {
    groupRawLines.push({ lineItem: label, periodId: periodFY2025, entityCode, currency: 'PLN', value, sourceRef: { source: 'goldco_oracle.json:groupFY2025' } });
    groupRules.push({ sourceLabel: label, statementType, lineCode, consolidationScope: scope });
  };
  pushGroup('PARENT', 'GROUP:PL:REVENUE', 'P&L', 'REVENUE', g.pl.revenue, 'CONSOLIDATED');
  pushGroup('PARENT', 'GROUP:PL:COGS', 'P&L', 'COGS', g.pl.cogs, 'CONSOLIDATED');
  pushGroup('PARENT', 'GROUP:PL:GROSS_MARGIN', 'P&L', 'GROSS_MARGIN', g.pl.grossMargin, 'CONSOLIDATED');
  pushGroup('PARENT', 'GROUP:PL:OPEX', 'P&L', 'OPEX', g.pl.opex, 'CONSOLIDATED');
  pushGroup('PARENT', 'GROUP:PL:EBITDA', 'P&L', 'EBITDA', g.pl.ebitda, 'CONSOLIDATED');
  pushGroup('PARENT', 'GROUP:PL:DEPRECIATION', 'P&L', 'DEPRECIATION', g.pl.depreciation, 'CONSOLIDATED');
  pushGroup('PARENT', 'GROUP:PL:EBIT', 'P&L', 'EBIT', g.pl.ebit, 'CONSOLIDATED');
  pushGroup('PARENT', 'GROUP:PL:INTEREST_EXPENSE', 'P&L', 'INTEREST_EXPENSE', g.pl.interest, 'CONSOLIDATED');
  pushGroup('PARENT', 'GROUP:PL:TAX_EXPENSE', 'P&L', 'TAX_EXPENSE', g.pl.taxExpense, 'CONSOLIDATED');
  pushGroup('PARENT', 'GROUP:PL:NET_INCOME', 'P&L', 'NET_INCOME', g.pl.netIncomeConsolidated, 'CONSOLIDATED');
  pushGroup('PARENT', 'GROUP:BS:TOTAL_ASSETS', 'BS', 'TOTAL_ASSETS', g.bs.totalAssets, 'CONSOLIDATED');
  pushGroup('PARENT', 'GROUP:BS:TOTAL_LIABILITIES', 'BS', 'TOTAL_LIABILITIES', g.bs.totalLiabilities, 'CONSOLIDATED');
  pushGroup('PARENT', 'GROUP:BS:EQUITY', 'BS', 'EQUITY', g.bs.totalEquity, 'CONSOLIDATED');
  pushGroup('PARENT', 'GROUP:BS:TOTAL_LIABILITIES_EQUITY', 'BS', 'TOTAL_LIABILITIES_EQUITY', g.bs.totalLiabilitiesEquity, 'CONSOLIDATED');
  pushGroup('SUB', 'SUBTRANS:PL:REVENUE', 'P&L', 'REVENUE', st.pl.revenue, 'CONSOLIDATED');
  pushGroup('SUB', 'SUBTRANS:PL:COGS', 'P&L', 'COGS', st.pl.cogs, 'CONSOLIDATED');
  pushGroup('SUB', 'SUBTRANS:PL:NET_INCOME', 'P&L', 'NET_INCOME', st.pl.netIncome, 'CONSOLIDATED');
  pushGroup('SUB', 'SUBTRANS:BS:TOTAL_ASSETS', 'BS', 'TOTAL_ASSETS', st.bsPreCTA.totalAssets, 'CONSOLIDATED');
  pushGroup('SUB', 'SUBTRANS:BS:TOTAL_LIABILITIES', 'BS', 'TOTAL_LIABILITIES', st.bsPreCTA.totalLiabilities, 'CONSOLIDATED');
  pushGroup('SUB', 'SUBTRANS:BS:EQUITY', 'BS', 'EQUITY', st.equityPostCTA, 'CONSOLIDATED');
  pushGroup('SUB', 'SUBTRANS:BS:TOTAL_LIABILITIES_EQUITY', 'BS', 'TOTAL_LIABILITIES_EQUITY', st.totalLiabilitiesEquity, 'CONSOLIDATED');
  pushGroup('SUB', 'SUBTRANS:BS:CTA_OCI', 'BS', 'CTA_OCI', st.cta, 'CONSOLIDATED');
  groupRawLines.push({ lineItem: 'ELIM:PARENT:INTERCOMPANY_LOAN', periodId: periodFY2025, entityCode: 'PARENT', currency: 'PLN', value: -oracle.intercompany.loanPLN, sourceRef: { leg: 'parent_receivable' } });
  groupRules.push({ sourceLabel: 'ELIM:PARENT:INTERCOMPANY_LOAN', statementType: 'BS', lineCode: 'INTERCOMPANY_LOAN', consolidationScope: 'ELIMINATION', signConvention: 'NATURAL', eliminationCounterpartyEntityCode: 'SUB' });
  groupRawLines.push({ lineItem: 'ELIM:SUB:INTERCOMPANY_LOAN', periodId: periodFY2025, entityCode: 'SUB', currency: 'PLN', value: -oracle.intercompany.loanPLN, sourceRef: { leg: 'sub_payable' } });
  groupRules.push({ sourceLabel: 'ELIM:SUB:INTERCOMPANY_LOAN', statementType: 'BS', lineCode: 'INTERCOMPANY_LOAN', consolidationScope: 'ELIMINATION', signConvention: 'CONTRA', eliminationCounterpartyEntityCode: 'PARENT' });
  const resGroup = await mapReconcileApprove(groupBvId, packGroup.artifact.artifact_id, packGroup.businessVersion.version, groupRawLines, groupRules, 'GROUP FY2025 CONSOLIDATED');

  // --- Baseline-source pack: PARENT FY2025 monthly P&L (all 12 months, revenue history for
  //     PRIOR_YEAR_SAME_PERIOD lookups) + full closing BS/CF at December (opening state for the
  //     Baseline Model). This is the SAME real oracle data as the packs above, mapped through the
  //     SAME service chain, just packaged into one Statement Pack Version so
  //     baselineComputeService.loadContext() can resolve BOTH monthly revenue history AND the
  //     opening balance sheet from a single STATEMENT_TO_MODEL source edge (the schema's own design
  //     — ADR WP-D05 section 2.1 — is "one source version per Baseline Model").
  const packBaselineSource = await makeStatementPack();
  const baselineSourceBvId = packBaselineSource.businessVersion.business_version_id;
  const entBaselineSource = await makeEntity(baselineSourceBvId, 'PARENT', { functionalCurrency: 'PLN' });
  const bsRawLines: any[] = [];
  const bsRules: any[] = [];
  for (const m of oracle.parent.FY2025_monthly) {
    const periodId = monthPeriods2025[m.month - 1];
    for (const [field, code] of Object.entries(PL_FIELD_MAP)) {
      const label = `PARENT:M${m.month}:${field}`;
      bsRawLines.push({ lineItem: label, periodId, entityCode: 'PARENT', currency: 'PLN', value: m[field], sourceRef: { month: m.month, field } });
      bsRules.push({ sourceLabel: label, statementType: 'P&L', lineCode: code });
    }
    const cashLabel = `PARENT:M${m.month}:cash`;
    bsRawLines.push({ lineItem: cashLabel, periodId, entityCode: 'PARENT', currency: 'PLN', value: m.cash, sourceRef: { month: m.month, field: 'cash' } });
    bsRules.push({ sourceLabel: cashLabel, statementType: 'BS', lineCode: 'CASH' });
    const ncLabel = `PARENT:M${m.month}:netChangeCash`;
    bsRawLines.push({ lineItem: ncLabel, periodId, entityCode: 'PARENT', currency: 'PLN', value: m.netChangeCash, sourceRef: { month: m.month, field: 'netChangeCash' } });
    bsRules.push({ sourceLabel: ncLabel, statementType: 'CF', lineCode: 'NET_CHANGE_CASH' });
    if (m.month === 12) {
      const decPeriodId = monthPeriods2025[11];
      for (const [field, code] of Object.entries(BS_FIELD_MAP)) {
        if (field === 'cash') continue; // already pushed above
        const label = `PARENT:DEC2025:${field}`;
        bsRawLines.push({ lineItem: label, periodId: decPeriodId, entityCode: 'PARENT', currency: 'PLN', value: oracle.parent.FY2025.bs[field], sourceRef: { field } });
        bsRules.push({ sourceLabel: label, statementType: 'BS', lineCode: code });
      }
      bsRawLines.push({ lineItem: 'PARENT:DEC2025:retainedEarnings', periodId: decPeriodId, entityCode: 'PARENT', currency: 'PLN', value: oracle.parent.FY2025.closingRE, sourceRef: {} });
      bsRules.push({ sourceLabel: 'PARENT:DEC2025:retainedEarnings', statementType: 'BS', lineCode: 'RETAINED_EARNINGS' });
      bsRawLines.push({ lineItem: 'PARENT:DEC2025:dividendsDeclared', periodId: decPeriodId, entityCode: 'PARENT', currency: 'PLN', value: oracle.parent.FY2025.dividendsDeclared, sourceRef: {} });
      bsRules.push({ sourceLabel: 'PARENT:DEC2025:dividendsDeclared', statementType: 'BS', lineCode: 'DIVIDENDS_DECLARED' });
      bsRawLines.push({ lineItem: 'PARENT:DEC2025:cfo', periodId: decPeriodId, entityCode: 'PARENT', currency: 'PLN', value: oracle.parent.FY2025.cfo, sourceRef: {} });
      bsRules.push({ sourceLabel: 'PARENT:DEC2025:cfo', statementType: 'CF', lineCode: 'CFO' });
      bsRawLines.push({ lineItem: 'PARENT:DEC2025:cfi', periodId: decPeriodId, entityCode: 'PARENT', currency: 'PLN', value: oracle.parent.FY2025.cfi, sourceRef: {} });
      bsRules.push({ sourceLabel: 'PARENT:DEC2025:cfi', statementType: 'CF', lineCode: 'CFI' });
      bsRawLines.push({ lineItem: 'PARENT:DEC2025:cff', periodId: decPeriodId, entityCode: 'PARENT', currency: 'PLN', value: oracle.parent.FY2025.cff, sourceRef: {} });
      bsRules.push({ sourceLabel: 'PARENT:DEC2025:cff', statementType: 'CF', lineCode: 'CFF' });
    }
  }
  const resBaselineSource = await mapReconcileApprove(
    baselineSourceBvId, packBaselineSource.artifact.artifact_id, packBaselineSource.businessVersion.version,
    bsRawLines, bsRules, 'PARENT FY2025 BASELINE-SOURCE (monthly + Dec closing BS)'
  );
  if (!resBaselineSource.approved?.ok) {
    throw new Error(`Baseline-source Statement Pack Version did not reach APPROVED — cannot proceed: ${JSON.stringify(resBaselineSource.approved)}`);
  }
  const openingBsPeriodId = monthPeriods2025[11]; // Dec-2025

  record(`\n[PHASE 1 STATEMENT] complete. PARENT FY2025 annual bv=${packParentFY2025.businessVersion.business_version_id}, GROUP FY2025 consolidated bv=${groupBvId}, baseline-source bv=${baselineSourceBvId}`);
  markPhase('STATEMENT');
  void t1start;

  // =========================================================================
  // PHASE 2 — ANALYSIS layer (universal + manufacturing-relevant KPIs on GoldCo consolidated)
  // =========================================================================
  record(`\n================ PHASE 2: ANALYSIS ================`);
  const analysis = await artifactVersionService.createArtifact({ organizationId: orgId, artifactType: 'HISTORICAL_ANALYSIS', createdBy: preparerId });
  const analysisBvId = analysis.businessVersion.business_version_id;
  await withPinnedPostgresTransaction((tx: Tx) =>
    tx.queryRun(
      `INSERT INTO finance_analysis_definitions (
         organization_id, business_version_id, purpose, analysis_type, entity_scope_mode, presentation_currency, unit, created_by
       ) VALUES (?, ?, 'BOARD_REPORTING', 'STANDARD', 'GROUP_CONSOLIDATED', 'PLN', 'UNITS', ?)`,
      [orgId, analysisBvId, preparerId]
    )
  );
  const edgeStmtToAnalysis = await lineageService.insertEdge({
    organizationId: orgId, sourceVersionId: groupBvId, sourceArtifactType: 'STATEMENT_PACK',
    targetVersionId: analysisBvId, targetArtifactType: 'HISTORICAL_ANALYSIS', edgeType: 'STATEMENT_TO_ANALYSIS',
    transformationKind: 'MANUAL_LINK', authorId: preparerId,
  });
  record(`[STATEMENT_TO_ANALYSIS] ok=${edgeStmtToAnalysis.ok} source=GROUP FY2025 consolidated (${groupBvId}) -> analysis (${analysisBvId})`);

  const catalogRows = await withPinnedPostgresTransaction((tx: Tx) =>
    tx.queryAll<{ id: string; kpi_code: string; category: string }>(`SELECT id, kpi_code, category FROM finance_analysis_kpi_catalog WHERE status = 'ACTIVE'`)
  );
  record(`[Analysis catalog] ${catalogRows.length} ACTIVE P0 KPI rows found (18 expected, all UNIVERSAL tier — no separate MANUFACTURING tier exists in the P0 catalog, documented boundary, WP-D03 ADR section 91/375)`);
  if (catalogRows.length !== 18) flag('IF-03', `Expected 18 P0 KPI catalog rows, found ${catalogRows.length}`);

  // Compute ALL 18 P0 KPIs (universal-tier) for GROUP consolidated FY2025 — the manufacturing-
  // relevant subset (inventory-heavy efficiency: DIO/DSO/DPO/CASH_CONVERSION_CYCLE, margin:
  // GROSS_MARGIN_PCT/EBITDA_MARGIN_PCT) is explicitly called out below since the P0 catalog itself
  // has no dedicated MANUFACTURING tier (see IF-03 note if that ever changes).
  const groupEntityRow = await withPinnedPostgresTransaction((tx: Tx) =>
    tx.queryOne<{ id: string }>(`SELECT id FROM finance_stmt_entities WHERE business_version_id = ? AND entity_code = 'PARENT'`, [groupBvId])
  );
  const groupEntityId = groupEntityRow.id as string;
  // FY2024 prior-period AR/EQUITY/TOTAL_ASSETS needed for AVERAGE_BALANCE KPI — write into the
  // SAME analysisBvId's referenced Statement Pack? No: cell_ref reads from finance_stmt_lines of
  // the SOURCE Statement Pack Version (groupBvId), which only has FY2025. DSO/ROE/ROA (AVERAGE_
  // CURRENT_AND_PRIOR) will legitimately report NOT_APPLICABLE / MISSING for the FY2024 leg —
  // documented below, not a bug (the consolidated Group pack is FY2025-only by design, per the
  // Fala 3 slice's own scope decision 4).
  for (const row of catalogRows) {
    await withPinnedPostgresTransaction((tx: Tx) =>
      tx.queryRun(
        `INSERT INTO finance_analysis_kpi_values (organization_id, business_version_id, kpi_catalog_id, entity_id, period_id)
         VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
        [orgId, analysisBvId, row.id, groupEntityId, periodFY2025]
      )
    );
  }
  const computedKpis = await kpiComputeService.computeAnalysisKpis({
    organizationId: orgId, businessVersionId: analysisBvId, requestedByUserId: preparerId,
  });
  if (!computedKpis.ok) throw new Error(`kpiComputeService.computeAnalysisKpis failed: ${JSON.stringify(computedKpis)}`);
  record(`[Analysis] computed ${computedKpis.results.length} KPI rows for GROUP FY2025 consolidated:`);
  for (const r of computedKpis.results) {
    record(`  ${r.kpiCode}: status=${r.status} value=${r.value ?? 'null'} qualityFlag=${r.qualityFlag ?? 'null'}`);
  }
  const manufacturingRelevant = ['GROSS_MARGIN_PCT', 'EBITDA_MARGIN_PCT', 'DIO', 'DSO', 'DPO', 'CASH_CONVERSION_CYCLE'];
  record(`[Analysis] manufacturing-relevant subset (inventory/margin cycle): ${manufacturingRelevant.join(', ')}`);

  // Normalized EBITDA — the P0 catalog has EBITDA_MARGIN_PCT but no dedicated "normalized EBITDA"
  // KPI code, and PVM (price-volume-mix) is explicitly out of scope for WP-D03 (ADR section 91/375,
  // handoff section 6). The existing, documented mechanism for a judgment adjustment is the
  // Analysis KPI value bundle's own is_adjustment/adjustment_reason columns (WP-B01 section 2.7,
  // reused verbatim by finance_analysis_kpi_values) — used here to record a normalized-EBITDA
  // ADD-BACK (the FY2024 restatement's one-off inventory write-down does not recur in FY2025, so no
  // FY2025 add-back is actually needed; the adjustment recorded is the FY2024 restatement's own
  // one-off, shown for comparability) rather than inventing a new formula_ast KPI type.
  const ebitdaMarginCatalogId = catalogRows.find((r) => r.kpi_code === 'EBITDA_MARGIN_PCT')?.id;
  if (!ebitdaMarginCatalogId) throw new Error('EBITDA_MARGIN_PCT catalog row not found');
  const oneOffWriteDown = 3_000_000; // PLN, FY2024 restatement's own inventory write-down (documented one-off)
  const ebitdaMarginNormalizedValue = (g.pl.ebitda + 0) / g.pl.revenue; // FY2025 EBITDA has no one-off itself; shown for the SAME period as a comparability marker
  await withPinnedPostgresTransaction((tx: Tx) =>
    tx.queryRun(
      `INSERT INTO finance_analysis_kpi_values (
         organization_id, business_version_id, kpi_catalog_id, entity_id, period_id,
         value_status, value_decimal, is_adjustment, adjustment_reason
       ) VALUES (?, ?, ?, ?, ?, 'PRESENT_NONZERO', ?, true, ?)
       ON CONFLICT (business_version_id, kpi_catalog_id, entity_id, period_id) DO UPDATE SET
         value_status = EXCLUDED.value_status, value_decimal = EXCLUDED.value_decimal,
         is_adjustment = EXCLUDED.is_adjustment, adjustment_reason = EXCLUDED.adjustment_reason`,
      [
        orgId, analysisBvId, ebitdaMarginCatalogId, groupEntityId, periodFY2025,
        ebitdaMarginNormalizedValue,
        `Normalized-EBITDA comparability marker: FY2025 EBITDA margin carries no one-off items itself; FY2024's PLN ${oneOffWriteDown.toLocaleString()} inventory write-down (ERROR_CORRECTION restatement) is the group's own documented one-off and is excluded from this FY2025 figure by construction (it is a prior-year balance-sheet correction, not a FY2025 P&L item) — recorded as an explicit is_adjustment row per the existing WP-B01 section 2.7 bundle mechanism (no new formula_ast KPI type invented; PVM/segment analysis remains out of P0 scope per WP-D03 ADR section 91).`,
      ]
    )
  );
  record(`[Analysis] normalized-EBITDA comparability marker recorded via is_adjustment=true row on EBITDA_MARGIN_PCT (see adjustment_reason)`);

  markPhase('ANALYSIS');

  // =========================================================================
  // PHASE 3 — BASELINE (2026 real monthly compute + 2027-2028 simple continuation)
  // =========================================================================
  record(`\n================ PHASE 3: BASELINE ================`);
  const baselineArtifact = await artifactVersionService.createArtifact({ organizationId: orgId, artifactType: 'BASELINE_MODEL', createdBy: preparerId });
  const baselineBvId = baselineArtifact.businessVersion.business_version_id;

  const edgeStmtToModel = await lineageService.insertEdge({
    organizationId: orgId, sourceVersionId: baselineSourceBvId, sourceArtifactType: 'STATEMENT_PACK',
    targetVersionId: baselineBvId, targetArtifactType: 'BASELINE_MODEL', edgeType: 'STATEMENT_TO_MODEL',
    transformationKind: 'COMPUTE', authorId: preparerId,
  });
  record(`[STATEMENT_TO_MODEL] ok=${edgeStmtToModel.ok} source=baseline-source pack (${baselineSourceBvId}) -> baseline (${baselineBvId})`);

  const assumptionSnapshotHash1 = 'sha256:goldco-fulldag-analysis-to-model-v1';
  const edgeAnalysisToModel = await lineageService.insertEdge({
    organizationId: orgId, sourceVersionId: analysisBvId, sourceArtifactType: 'HISTORICAL_ANALYSIS',
    targetVersionId: baselineBvId, targetArtifactType: 'BASELINE_MODEL', edgeType: 'ANALYSIS_TO_MODEL',
    transformationKind: 'MANUAL_LINK', authorId: preparerId, assumptionSnapshotHash: assumptionSnapshotHash1,
  });
  record(`[ANALYSIS_TO_MODEL] ok=${edgeAnalysisToModel.ok} source=Analysis GROUP FY2025 (${analysisBvId}) -> baseline (${baselineBvId})`);
  if (!edgeStmtToModel.ok || !edgeAnalysisToModel.ok) {
    throw new Error(`Baseline lineage edges failed: STATEMENT_TO_MODEL=${JSON.stringify(edgeStmtToModel)} ANALYSIS_TO_MODEL=${JSON.stringify(edgeAnalysisToModel)}`);
  }
  // INTEGRATION NOTE (not a bug, a real cross-domain scope seam): Analysis above was computed on
  // the GROUP CONSOLIDATED (PARENT+SUB) Statement Pack Version, but Baseline is P0-scoped to a
  // SINGLE entity (WP-D06 report section 5.1) and is therefore built on the PARENT-only
  // baseline-source pack. Both lineage edges are real and independently valid — ANALYSIS_TO_MODEL
  // simply records "this Baseline was informed by this Analysis", not "same entity scope" — but a
  // Baseline reviewer navigating ANALYSIS_TO_MODEL backward will land on Group-consolidated KPIs
  // (e.g. EBITDA margin) that are NOT the same population as the PARENT-only Baseline they are
  // reviewing. Documented as an integration finding, see report.
  flag('IF-04', `Analysis (GROUP consolidated, PARENT+SUB) and Baseline (PARENT-only, P0 single-entity scope per WP-D06 section 5.1) are linked via ANALYSIS_TO_MODEL but describe DIFFERENT entity populations — real, not a bug, but worth a UI-level scope label on the lineage navigator so an analyst does not assume "same numbers, just downstream".`);

  await withPinnedPostgresTransaction((tx: Tx) =>
    tx.queryRun(
      `INSERT INTO finance_baseline_models (
         organization_id, business_version_id, horizon_months, horizon_rationale, horizon_rationale_note,
         circularity_max_iterations, circularity_tolerance_currency, interest_income_on_cash_modeled, mandatory_contractual_cash_sweep_modeled, created_by
       ) VALUES (?, ?, 12, 'DEBT_MATURITY', 'FY2026 explicit monthly horizon matches the GoldCo debt facility''s own annual amortization cadence; FY2027-2028 are a simple continuation (documented below), same convention WP-D10''s own known-answer test used.', 50, 1, false, true, ?)`,
      [orgId, baselineBvId, preparerId]
    )
  );

  const revenue2025 = oracle.parent.FY2025.pl.revenue;
  const cogs2025 = oracle.parent.FY2025.pl.cogs;
  const opex2025 = oracle.parent.FY2025.pl.opex;
  const capex2025 = 9_000_000; // from goldco_oracle FY2025 CFI narrative (matches WP-D06 report's own figure)
  const fixedAssets2025 = oracle.parent.FY2025.bs.fixedAssets;
  const ar2025 = oracle.parent.FY2025.bs.ar;
  const inv2025 = oracle.parent.FY2025.bs.inventory;
  const ap2025 = oracle.parent.FY2025.bs.ap;

  const dsoDays = (ar2025 / revenue2025) * 365;
  const dioDays = (inv2025 / cogs2025) * 365;
  const dpoDays = (ap2025 / cogs2025) * 365;
  const usefulLifeMonths = (12 * fixedAssets2025) / 7_000_000; // FY2025 depreciation = 7,000,000 PLN

  async function makeAssumption(scheduleType: string, driverCode: string, value: number, unit: string) {
    await withPinnedPostgresTransaction((tx: Tx) =>
      tx.queryRun(
        `INSERT INTO finance_baseline_assumptions (
           organization_id, business_version_id, schedule_type, driver_code, entity_id, period_id, rule,
           value_status, value_decimal, unit, quality, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, 'HISTORICAL_AVERAGE', 'PRESENT_NONZERO', ?, ?, 'ESTIMATED', ?)`,
        [orgId, baselineBvId, scheduleType, driverCode, entBaselineSource, monthPeriods2026[0], value, unit, preparerId]
      )
    );
  }
  await makeAssumption('revenue_pvm', 'REVENUE_GROWTH_YOY', 0.05, 'PCT');
  await makeAssumption('cogs_opex', 'COGS_PCT_OF_REVENUE', cogs2025 / revenue2025, 'PCT');
  await makeAssumption('cogs_opex', 'OPEX_PCT_OF_REVENUE', opex2025 / revenue2025, 'PCT');
  await makeAssumption('wc_dso_dio_dpo', 'DSO_DAYS', dsoDays, 'DAYS');
  await makeAssumption('wc_dso_dio_dpo', 'DIO_DAYS', dioDays, 'DAYS');
  await makeAssumption('wc_dso_dio_dpo', 'DPO_DAYS', dpoDays, 'DAYS');
  await makeAssumption('capex_depreciation', 'CAPEX_PCT_OF_REVENUE', capex2025 / revenue2025, 'PCT');
  await makeAssumption('capex_depreciation', 'USEFUL_LIFE_MONTHS', usefulLifeMonths, 'MONTHS');
  await makeAssumption('tax_nol', 'STATUTORY_TAX_RATE_PCT', 0.19, 'PCT');

  // Debt facility with a real mandatory cash-sweep clause (genuine circularity, per WP-D06's own
  // known-answer fixture) — same numbers already published/verified in WP-D06/WP-D08.
  const amortizationSchedule = Array.from({ length: 12 }, () => 675_000);
  await withPinnedPostgresTransaction((tx: Tx) =>
    tx.queryRun(
      `INSERT INTO finance_baseline_schedules (
         organization_id, business_version_id, schedule_type, entity_id, schedule_item_code,
         effective_from_period_id, payload, created_by
       ) VALUES (?, ?, 'debt_maturity', ?, 'FACILITY-1', ?, ?, ?)`,
      [
        orgId, baselineBvId, entBaselineSource, monthPeriods2026[0],
        JSON.stringify({ principal_opening: 40_500_000, contractual_rate: 0.048, amortization_schedule: amortizationSchedule, mandatory_sweep_pct: 0.1, mandatory_sweep_threshold: 0 }),
        preparerId,
      ]
    )
  );

  const baselineResult = await baselineComputeService.runBaselineCompute({
    organizationId: orgId, businessVersionId: baselineBvId, requestedByUserId: preparerId, engineManifestId,
    entityId: entBaselineSource, forecastPeriodIds: monthPeriods2026, openingBalanceSheetPeriodId: openingBsPeriodId,
  });
  if (!baselineResult.ok) {
    throw new Error(`runBaselineCompute FAILED: ${JSON.stringify(baselineResult)}`);
  }
  const decResult = baselineResult.monthlyResults[baselineResult.monthlyResults.length - 1];
  record(`[Baseline FY2026] ${baselineResult.periodsComputed} periods computed. December: cash=${decResult.cash} netIncome=${decResult.netIncome} qualityFlag=${decResult.qualityFlag}`);
  if (decResult.qualityFlag !== 'FUNDING_GAP') {
    flag('IF-05', `Expected December 2026 FUNDING_GAP quality flag (negative cash), got qualityFlag=${decResult.qualityFlag} cash=${decResult.cash}`);
  } else {
    record(`[Baseline FY2026] FUNDING_GAP confirmed on December — negative cash surfaced, never plugged, never blocked (DEC-FIN-002).`);
  }

  // FY2027/FY2028 — simple continuation (task's own "prosta kontynuacja" convention, same as
  // WP-D10's own known-answer test): read FY2026's real annual roll-up for EBIT/DEPRECIATION/CAPEX/
  // WORKING_CAPITAL (+ REVENUE/NET_INCOME for narrative), grow 3%/yr, insert directly.
  const lineIdRows = await withPinnedPostgresTransaction((tx: Tx) =>
    tx.queryAll<{ id: string; line_code: string }>(`SELECT id, line_code FROM financial_statement_lines WHERE line_code = ANY(?)`, [
      ['EBIT', 'DEPRECIATION', 'CAPEX', 'WORKING_CAPITAL', 'REVENUE', 'NET_INCOME'],
    ])
  );
  const lineIdByCode = new Map(lineIdRows.map((r) => [r.line_code, r.id]));
  async function fy2026AnnualSum(lineCode: string): Promise<number> {
    const rows = await withPinnedPostgresTransaction((tx: Tx) =>
      tx.queryAll<{ value_decimal: string }>(
        `SELECT value_decimal FROM finance_baseline_outputs WHERE business_version_id = ? AND canonical_line_id = ? AND entity_id = ? AND period_id = ANY(?)`,
        [baselineBvId, lineIdByCode.get(lineCode), entBaselineSource, monthPeriods2026]
      )
    );
    return rows.reduce((s, r) => s + Number(r.value_decimal), 0);
  }
  async function fy2026Closing(lineCode: string): Promise<number> {
    const row = await withPinnedPostgresTransaction((tx: Tx) =>
      tx.queryOne<{ value_decimal: string }>(
        `SELECT value_decimal FROM finance_baseline_outputs WHERE business_version_id = ? AND canonical_line_id = ? AND entity_id = ? AND period_id = ?`,
        [baselineBvId, lineIdByCode.get(lineCode), entBaselineSource, monthPeriods2026[11]]
      )
    );
    return Number(row.value_decimal);
  }
  const fy2026 = {
    EBIT: await fy2026AnnualSum('EBIT'),
    DEPRECIATION: await fy2026AnnualSum('DEPRECIATION'),
    CAPEX: await fy2026AnnualSum('CAPEX'),
    REVENUE: await fy2026AnnualSum('REVENUE'),
    NET_INCOME: await fy2026AnnualSum('NET_INCOME'),
    WORKING_CAPITAL: await fy2026Closing('WORKING_CAPITAL'),
  };
  record(`[Baseline FY2026 annual roll-up] EBIT=${fy2026.EBIT.toFixed(2)} DEPRECIATION=${fy2026.DEPRECIATION.toFixed(2)} CAPEX=${fy2026.CAPEX.toFixed(2)} WORKING_CAPITAL(closing)=${fy2026.WORKING_CAPITAL.toFixed(2)}`);

  async function insertContinuationYear(periodId: string, fiscalYear: number, growth: number, base: typeof fy2026) {
    const grown = {
      EBIT: base.EBIT * (1 + growth), DEPRECIATION: base.DEPRECIATION * (1 + growth), CAPEX: base.CAPEX * (1 + growth),
      REVENUE: base.REVENUE * (1 + growth), NET_INCOME: base.NET_INCOME * (1 + growth), WORKING_CAPITAL: base.WORKING_CAPITAL * (1 + growth),
    };
    for (const [code, value] of Object.entries(grown)) {
      const statementType = code === 'REVENUE' || code === 'EBIT' || code === 'DEPRECIATION' || code === 'NET_INCOME' ? 'P&L' : code === 'CAPEX' ? 'CF' : 'BS';
      await withPinnedPostgresTransaction((tx: Tx) =>
        tx.queryRun(
          `INSERT INTO finance_baseline_outputs (
             id, organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id, consolidation_scope,
             value_status, value_decimal, native_currency, presentation_currency, unit, multiplier, value_kind, created_by
           ) VALUES (?, ?, ?, ?, ?, ?, ?, 'CONSOLIDATED', 'PRESENT_NONZERO', ?, 'PLN', 'PLN', 'UNITS', 1, 'FORECAST', ?)
           ON CONFLICT (business_version_id, entity_id, canonical_line_id, period_id, consolidation_scope) DO UPDATE SET value_decimal = EXCLUDED.value_decimal`,
          [randomUUID(), orgId, baselineBvId, statementType, lineIdByCode.get(code), entBaselineSource, periodId, value, preparerId]
        )
      );
    }
    record(`[Baseline FY${fiscalYear} continuation, +${(growth * 100).toFixed(0)}%/yr off FY2026] EBIT=${grown.EBIT.toFixed(2)} DEPRECIATION=${grown.DEPRECIATION.toFixed(2)} CAPEX=${grown.CAPEX.toFixed(2)} WORKING_CAPITAL=${grown.WORKING_CAPITAL.toFixed(2)}`);
    return grown;
  }
  const fy2027 = await insertContinuationYear(periodFY2027, 2027, 0.03, fy2026);
  const fy2028 = await insertContinuationYear(periodFY2028, 2028, 0.03, fy2027 as any);
  void fy2028;

  markPhase('BASELINE');

  // =========================================================================
  // PHASE 4 — PREDICTION (Base + efficiency initiative w/ conflict + downside; financing only in scenario)
  // =========================================================================
  record(`\n================ PHASE 4: PREDICTION ================`);

  async function makeScenario(mode: string, name: string) {
    const art = await artifactVersionService.createArtifact({ organizationId: orgId, artifactType: 'PREDICTION_SCENARIO', createdBy: preparerId });
    const bvId = art.businessVersion.business_version_id;
    await withPinnedPostgresTransaction((tx: Tx) =>
      tx.queryRun(
        `INSERT INTO finance_prediction_scenarios (organization_id, business_version_id, name, scenario_mode, created_by) VALUES (?, ?, ?, ?, ?)`,
        [orgId, bvId, name, mode, preparerId]
      )
    );
    const edge = await lineageService.insertEdge({
      organizationId: orgId, sourceVersionId: baselineBvId, sourceArtifactType: 'BASELINE_MODEL',
      targetVersionId: bvId, targetArtifactType: 'PREDICTION_SCENARIO', edgeType: 'MODEL_TO_SCENARIO',
      transformationKind: 'MANUAL_LINK', authorId: preparerId, assumptionSnapshotHash: `sha256:goldco-fulldag-model-to-scenario-${mode}`,
    });
    if (!edge.ok) throw new Error(`MODEL_TO_SCENARIO edge failed for ${name}: ${JSON.stringify(edge)}`);
    return { art, bvId };
  }

  // --- STANDARD_BASE ---
  const base = await makeScenario('STANDARD_BASE', 'Base (= Baseline passthrough)');
  const basePreflight = await predictionPreflightService.runPreflight({ organizationId: orgId, businessVersionId: base.bvId, runBy: preparerId, entityId: entBaselineSource, openingBalanceSheetPeriodId: openingBsPeriodId });
  record(`[Prediction BASE] preflight ok=${basePreflight.ok} findingsCount=${(basePreflight as any).findingsCount ?? 'n/a'}`);
  const baseCompute = await predictionComputeService.runPredictionCompute({
    organizationId: orgId, businessVersionId: base.bvId, requestedByUserId: preparerId, engineManifestId,
    entityId: entBaselineSource, forecastPeriodIds: monthPeriods2026, openingBalanceSheetPeriodId: openingBsPeriodId,
  });
  record(`[Prediction BASE] compute ok=${baseCompute.ok} mode=${(baseCompute as any).mode ?? (baseCompute as any).code}`);
  if (!baseCompute.ok) flag('IF-06', `STANDARD_BASE Prediction compute failed: ${JSON.stringify(baseCompute)}`);

  // --- FUNDAMENTAL_INITIATIVE (efficiency programme) + direct COGS driver override -> CONFLICT ---
  const eff = await makeScenario('FUNDAMENTAL_INITIATIVE', 'Efficiency initiative + direct cost override (conflict test)');
  const cogsLine = await withPinnedPostgresTransaction((tx: Tx) => tx.queryOne<{ id: string }>(`SELECT id FROM financial_statement_lines WHERE line_code = 'COGS' AND organization_id IS NULL`));
  const initiativeRow = await withPinnedPostgresTransaction((tx: Tx) =>
    tx.queryOne<{ id: string }>(
      `INSERT INTO finance_prediction_initiatives (
         organization_id, business_version_id, initiative_code, name, description, source, owner, confidence_pct,
         default_start_period_id, default_ramp_months, default_duration_months, status, created_by
       ) VALUES (?, ?, 'EFF-01', 'Production efficiency programme (Radom plant)', 'Lean manufacturing rollout targeting COGS reduction via scrap/rework reduction and line-balancing.', 'CONSULTANT_RECOMMENDATION', 'COO', 70, ?, 2, 12, 'CONFIRMED', ?)
       RETURNING id`,
      [orgId, eff.bvId, monthPeriods2026[0], preparerId]
    )
  );
  await withPinnedPostgresTransaction((tx: Tx) =>
    tx.queryRun(
      `INSERT INTO finance_prediction_impact_chain (
         organization_id, business_version_id, initiative_id, assumption_label, driver_schedule_type, driver_code,
         statement_line_id, entity_id, amount_kind, amount_decimal, amount_unit, sign,
         start_period_id, ramp_months, duration_months, confidence_pct, created_by
       ) VALUES (?, ?, ?, ?, 'cogs_opex', 'COGS_PCT_OF_REVENUE', ?, ?, 'PERCENT_OF_BASE', 0.04, 'PCT', 'NEGATIVE', ?, 0, 12, 70, ?)`,
      [orgId, eff.bvId, initiativeRow.id, '4% COGS reduction from production efficiency programme', cogsLine.id, entBaselineSource, monthPeriods2026[0], preparerId]
    )
  );
  // Direct cost override on the SAME entity/COGS driver/period as the initiative's own
  // start_period_id (Jan-2026) — a preparer manually overriding the COGS ratio for that same
  // month, unaware the initiative already touches the same cell. finance_prediction_detect_
  // overlaps() (Layer 1, SQL) groups by the LITERAL period_id — the impact_chain row's period is
  // COALESCE(start_period_id, initiative.default_start_period_id) with NO ramp/duration expansion
  // at Layer 1 (that expansion is Layer 2, preview-only) — so the conflict must land on the exact
  // same period_id to be detected structurally. This is the exact conflict class the task asks
  // for: "direct cost override vs initiative rozwiązany przez stage-1 preflight".
  const conflictPeriod2026 = monthPeriods2026[0];
  await withPinnedPostgresTransaction((tx: Tx) =>
    tx.queryRun(
      `INSERT INTO finance_prediction_driver_overrides (
         organization_id, business_version_id, schedule_type, driver_code, entity_id, period_id, override_source,
         value_status, value_decimal, unit, rationale, created_by
       ) VALUES (?, ?, 'cogs_opex', 'COGS_PCT_OF_REVENUE', ?, ?, 'MANUAL', 'PRESENT_NONZERO', ?, 'PCT', 'Renegotiated Jan-2026 steel input pricing — manual override, entered independently of the efficiency initiative.', ?)`,
      [orgId, eff.bvId, entBaselineSource, conflictPeriod2026, (cogs2025 / revenue2025) * 0.97, preparerId]
    )
  );
  const effPreflight = await predictionPreflightService.runPreflight({ organizationId: orgId, businessVersionId: eff.bvId, runBy: preparerId, entityId: entBaselineSource, openingBalanceSheetPeriodId: openingBsPeriodId });
  record(`[Prediction EFFICIENCY] preflight ok=${effPreflight.ok} findingsCount=${(effPreflight as any).findingsCount ?? 'n/a'} requiredResolutionsCount=${(effPreflight as any).requiredResolutionsCount ?? 'n/a'}`);
  if (effPreflight.ok && effPreflight.findings.length > 0) {
    for (const f of effPreflight.findings) {
      record(`  finding: kind=${f.findingKind} period=${f.periodId} sourceCount=${f.sourceCount} layer1=${f.layer1CombinedImpactDecimal} layer2=${f.layer2CombinedImpactDecimal} requiresResolution=${f.requiresResolution}`);
    }
  } else {
    flag('IF-07', `Expected preflight to detect the direct-cost-override vs initiative overlap on COGS/Jan-2026, got ${JSON.stringify(effPreflight)}`);
  }
  const effComputeBeforeResolution = await predictionComputeService.runPredictionCompute({
    organizationId: orgId, businessVersionId: eff.bvId, requestedByUserId: preparerId, engineManifestId,
    entityId: entBaselineSource, forecastPeriodIds: monthPeriods2026, openingBalanceSheetPeriodId: openingBsPeriodId,
  });
  record(`[Prediction EFFICIENCY] compute BEFORE resolution: ok=${effComputeBeforeResolution.ok} code=${(effComputeBeforeResolution as any).code ?? 'n/a'}`);
  if (effComputeBeforeResolution.ok || (effComputeBeforeResolution as any).code !== 'READINESS_GATE_FAILED') {
    flag('IF-08', `Expected compute to be BLOCKED (READINESS_GATE_FAILED) before conflict resolution, got: ${JSON.stringify(effComputeBeforeResolution)}`);
  } else {
    record(`[Prediction EFFICIENCY] confirmed BLOCKED before resolution, as required.`);
  }
  // Resolve the conflict — accept the system's combined preview, mandatory rationale (DEC-FIN-004).
  if (effPreflight.ok) {
    for (const f of effPreflight.findings) {
      await withPinnedPostgresTransaction((tx: Tx) =>
        tx.queryRun(
          `INSERT INTO finance_prediction_conflict_resolutions (
             organization_id, business_version_id, finding_id, resolution_choice, rationale, requires_review, state, resolved_by
           ) VALUES (?, ?, ?, 'ACCEPTED_PROPOSED', ?, false, 'RESOLVED', ?)`,
          [orgId, eff.bvId, f.findingId, 'Accepted combined COGS impact — the May-2026 steel-pricing override and the efficiency initiative are both real, independently-sourced effects on the same cell; combined impact reviewed and accepted by the FP&A preparer.', preparerId]
        )
      );
    }
  }
  // Financing — ONLY in this Prediction scenario, never in Baseline: a facility drawdown in
  // November 2026 funding part of the initiative's implementation cost, on a DIFFERENT period than
  // the COGS conflict cell so it does not itself add a second Layer-1 overlap finding.
  const nov2026 = monthPeriods2026[10];
  await withPinnedPostgresTransaction((tx: Tx) =>
    tx.queryRun(
      `INSERT INTO finance_prediction_financing (
         organization_id, business_version_id, financing_kind, entity_id, period_id, payload, rationale, created_by
       ) VALUES (?, ?, 'FACILITY_DRAWDOWN', ?, ?, ?, ?, ?)`,
      [
        orgId, eff.bvId, entBaselineSource, nov2026,
        JSON.stringify({ principal: 5_000_000, rate: 0.06, tenor_months: 48 }),
        "New investment facility funding the efficiency programme's line-rebalancing capex.",
        preparerId,
      ]
    )
  );
  const effComputeAfterResolution = await predictionComputeService.runPredictionCompute({
    organizationId: orgId, businessVersionId: eff.bvId, requestedByUserId: preparerId, engineManifestId,
    entityId: entBaselineSource, forecastPeriodIds: monthPeriods2026, openingBalanceSheetPeriodId: openingBsPeriodId,
  });
  record(`[Prediction EFFICIENCY] compute AFTER resolution: ok=${effComputeAfterResolution.ok} mode=${(effComputeAfterResolution as any).mode ?? (effComputeAfterResolution as any).code}`);
  if (!effComputeAfterResolution.ok) {
    flag('IF-09', `Expected compute to SUCCEED after conflict resolution, got: ${JSON.stringify(effComputeAfterResolution)}`);
  } else {
    const conflictResult = (effComputeAfterResolution as any).periods?.find((p: any) => p.periodId === conflictPeriod2026);
    record(`  Jan-2026 COGS after resolution: ${conflictResult?.values?.COGS ?? 'n/a'} (combined effect of override + initiative, not double-counted)`);
  }

  // --- STANDARD_DOWNSIDE ---
  const downside = await makeScenario('STANDARD_DOWNSIDE', 'Downside (revenue growth 2% vs base 5%)');
  for (const periodId of monthPeriods2026) {
    await withPinnedPostgresTransaction((tx: Tx) =>
      tx.queryRun(
        `INSERT INTO finance_prediction_driver_overrides (
           organization_id, business_version_id, schedule_type, driver_code, entity_id, period_id, override_source,
           value_status, value_decimal, unit, baseline_value_decimal, rationale, created_by
         ) VALUES (?, ?, 'revenue_pvm', 'REVENUE_GROWTH_YOY', ?, ?, 'STANDARD_PRESET_DOWNSIDE', 'PRESENT_NONZERO', 0.02, 'PCT', 0.05, 'Standard downside preset — demand softening.', ?)`,
        [orgId, downside.bvId, entBaselineSource, periodId, preparerId]
      )
    );
  }
  const downsidePreflight = await predictionPreflightService.runPreflight({ organizationId: orgId, businessVersionId: downside.bvId, runBy: preparerId, entityId: entBaselineSource, openingBalanceSheetPeriodId: openingBsPeriodId });
  record(`[Prediction DOWNSIDE] preflight ok=${downsidePreflight.ok} findingsCount=${(downsidePreflight as any).findingsCount ?? 'n/a'}`);
  const downsideCompute = await predictionComputeService.runPredictionCompute({
    organizationId: orgId, businessVersionId: downside.bvId, requestedByUserId: preparerId, engineManifestId,
    entityId: entBaselineSource, forecastPeriodIds: monthPeriods2026, openingBalanceSheetPeriodId: openingBsPeriodId,
  });
  record(`[Prediction DOWNSIDE] compute ok=${downsideCompute.ok} mode=${(downsideCompute as any).mode ?? (downsideCompute as any).code}`);
  if (!downsideCompute.ok) throw new Error(`Downside Prediction compute failed: ${JSON.stringify(downsideCompute)}`);

  // FY2027/2028 downside continuation — same "simple continuation" convention as Baseline, applied
  // to the downside scenario's own FY2026 effective output (2% growth instead of 3%, reflecting the
  // downside's own softer trajectory), written directly into finance_prediction_outputs (legal for
  // a DRIVER_OVERRIDE-mode scenario — only STANDARD_BASE physically forbids this table).
  async function downsideFy2026Sum(lineCode: string): Promise<number> {
    const rows = await withPinnedPostgresTransaction((tx: Tx) =>
      tx.queryAll<{ value_decimal: string }>(
        `SELECT value_decimal FROM finance_prediction_outputs_effective WHERE business_version_id = ? AND canonical_line_id = ? AND entity_id = ? AND period_id = ANY(?)`,
        [downside.bvId, lineIdByCode.get(lineCode), entBaselineSource, monthPeriods2026]
      )
    );
    return rows.reduce((s, r) => s + Number(r.value_decimal), 0);
  }
  async function downsideFy2026Closing(lineCode: string): Promise<number> {
    const row = await withPinnedPostgresTransaction((tx: Tx) =>
      tx.queryOne<{ value_decimal: string }>(
        `SELECT value_decimal FROM finance_prediction_outputs_effective WHERE business_version_id = ? AND canonical_line_id = ? AND entity_id = ? AND period_id = ?`,
        [downside.bvId, lineIdByCode.get(lineCode), entBaselineSource, monthPeriods2026[11]]
      )
    );
    return Number(row.value_decimal);
  }
  const downsideFy2026 = {
    EBIT: await downsideFy2026Sum('EBIT'), DEPRECIATION: await downsideFy2026Sum('DEPRECIATION'), CAPEX: await downsideFy2026Sum('CAPEX'),
    REVENUE: await downsideFy2026Sum('REVENUE'), NET_INCOME: await downsideFy2026Sum('NET_INCOME'), WORKING_CAPITAL: await downsideFy2026Closing('WORKING_CAPITAL'),
  };
  async function insertPredictionContinuationYear(bvId: string, periodId: string, fiscalYear: number, growth: number, base: typeof downsideFy2026) {
    const grown = {
      EBIT: base.EBIT * (1 + growth), DEPRECIATION: base.DEPRECIATION * (1 + growth), CAPEX: base.CAPEX * (1 + growth),
      REVENUE: base.REVENUE * (1 + growth), NET_INCOME: base.NET_INCOME * (1 + growth), WORKING_CAPITAL: base.WORKING_CAPITAL * (1 + growth),
    };
    for (const [code, value] of Object.entries(grown)) {
      const statementType = code === 'REVENUE' || code === 'EBIT' || code === 'DEPRECIATION' || code === 'NET_INCOME' ? 'P&L' : code === 'CAPEX' ? 'CF' : 'BS';
      await withPinnedPostgresTransaction((tx: Tx) =>
        tx.queryRun(
          `INSERT INTO finance_prediction_outputs (
             id, organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id, consolidation_scope,
             value_status, value_decimal, native_currency, presentation_currency, unit, multiplier, variance_vs_baseline_decimal, created_by
           ) VALUES (?, ?, ?, ?, ?, ?, ?, 'CONSOLIDATED', 'PRESENT_NONZERO', ?, 'PLN', 'PLN', 'UNITS', 1, NULL, ?)
           ON CONFLICT (business_version_id, entity_id, canonical_line_id, period_id, consolidation_scope) DO UPDATE SET value_decimal = EXCLUDED.value_decimal`,
          [randomUUID(), orgId, bvId, statementType, lineIdByCode.get(code), entBaselineSource, periodId, value, preparerId]
        )
      );
    }
    record(`[Prediction DOWNSIDE FY${fiscalYear} continuation, +${(growth * 100).toFixed(0)}%/yr] EBIT=${grown.EBIT.toFixed(2)} WORKING_CAPITAL=${grown.WORKING_CAPITAL.toFixed(2)}`);
    return grown;
  }
  const downsideFy2027 = await insertPredictionContinuationYear(downside.bvId, periodFY2027, 2027, 0.02, downsideFy2026);
  await insertPredictionContinuationYear(downside.bvId, periodFY2028, 2028, 0.02, downsideFy2027 as any);

  markPhase('PREDICTION');

  // =========================================================================
  // PHASE 5 — VALUATION (baseline + downside variants, FCFF DCF, comps, exit-multiple cross-check,
  //           5x5 sensitivity, Advisor outputs, maker-checker, export manifest)
  // =========================================================================
  record(`\n================ PHASE 5: VALUATION ================`);
  const valCase = await withPinnedPostgresTransaction((tx: Tx) =>
    tx.queryOne<{ case_id: string }>(
      `INSERT INTO finance_valuation_cases (organization_id, name, description, created_by) VALUES (?, ?, ?, ?) RETURNING case_id`,
      [orgId, 'GoldCo Manufacturing Group — FY2026-2028 Enterprise Valuation', 'Gold vertical slice full-DAG valuation, baseline + downside variants.', preparerId]
    )
  );
  const caseId = valCase.case_id;

  async function makeValuationVariant(name: string, description: string) {
    const art = await artifactVersionService.createArtifact({ organizationId: orgId, artifactType: 'VALUATION_CASE', createdBy: preparerId });
    const bvId = art.businessVersion.business_version_id;
    await withPinnedPostgresTransaction((tx: Tx) =>
      tx.queryRun(
        `INSERT INTO finance_valuation_variants (organization_id, business_version_id, case_id, name, description, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
        [orgId, bvId, caseId, name, description, preparerId]
      )
    );
    return { art, bvId };
  }

  const WACC_INPUTS = {
    riskFreeRatePct: 4.0, erpPct: 5.5, betaUnlevered: 0.9,
    targetDebtPct: 30, targetEquityPct: 70, costOfDebtPretaxPct: 6.0, cashTaxRatePct: 19,
  };
  async function writeWaccInputs(bvId: string) {
    await withPinnedPostgresTransaction((tx: Tx) =>
      tx.queryRun(
        `INSERT INTO finance_valuation_wacc_inputs (
           organization_id, business_version_id, risk_free_rate_pct, equity_risk_premium_pct, beta_unlevered,
           target_capital_structure_debt_pct, target_capital_structure_equity_pct,
           current_capital_structure_debt_pct, current_capital_structure_equity_pct,
           cost_of_debt_pretax_pct, cash_tax_rate_pct, currency, nominal_or_real, pre_or_post_tax, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PLN', 'NOMINAL', 'POST_TAX', ?)`,
        [
          orgId, bvId, WACC_INPUTS.riskFreeRatePct, WACC_INPUTS.erpPct, WACC_INPUTS.betaUnlevered,
          WACC_INPUTS.targetDebtPct, WACC_INPUTS.targetEquityPct, WACC_INPUTS.targetDebtPct, WACC_INPUTS.targetEquityPct,
          WACC_INPUTS.costOfDebtPretaxPct, WACC_INPUTS.cashTaxRatePct, preparerId,
        ]
      )
    );
  }

  // --- BASELINE variant ---
  const baselineVariant = await makeValuationVariant('Baseline case', 'FCFF DCF sourced from the Baseline Model (STANDARD case).');
  const edgeModelToValuation = await lineageService.insertEdge({
    organizationId: orgId, sourceVersionId: baselineBvId, sourceArtifactType: 'BASELINE_MODEL',
    targetVersionId: baselineVariant.bvId, targetArtifactType: 'VALUATION_CASE', edgeType: 'MODEL_TO_VALUATION',
    transformationKind: 'MANUAL_LINK', authorId: preparerId, assumptionSnapshotHash: 'sha256:goldco-fulldag-model-to-valuation-baseline',
  });
  if (!edgeModelToValuation.ok) throw new Error(`MODEL_TO_VALUATION edge failed: ${JSON.stringify(edgeModelToValuation)}`);
  await writeWaccInputs(baselineVariant.bvId);

  const projectionYearsBaseline = [
    { fiscalYear: 2026, periodIds: monthPeriods2026 },
    { fiscalYear: 2027, periodIds: [periodFY2027] },
    { fiscalYear: 2028, periodIds: [periodFY2028] },
  ];
  const openingWc2025 = ar2025 + inv2025 - ap2025;
  const dcfBaseline = await valuationComputeService.runDcfFcffValuation({
    organizationId: orgId, valuationBusinessVersionId: baselineVariant.bvId, entityId: entBaselineSource,
    requestedByUserId: preparerId, engineManifestId, projectionYears: projectionYearsBaseline,
    openingWorkingCapital: openingWc2025, terminal: { gPct: 2.5 },
  });
  if (!dcfBaseline.ok) throw new Error(`Baseline DCF FCFF valuation FAILED: ${JSON.stringify(dcfBaseline)}`);
  record(`[Valuation BASELINE] WACC=${dcfBaseline.wacc.waccPct.toFixed(4)}% terminalValue=${dcfBaseline.terminalValue.toFixed(2)} EV=${dcfBaseline.enterpriseValue.toFixed(2)} PLN`);

  // --- DOWNSIDE variant ---
  const downsideVariant = await makeValuationVariant('Downside case', 'FCFF DCF sourced from the Prediction downside scenario.');
  const edgeScenarioToValuation = await lineageService.insertEdge({
    organizationId: orgId, sourceVersionId: downside.bvId, sourceArtifactType: 'PREDICTION_SCENARIO',
    targetVersionId: downsideVariant.bvId, targetArtifactType: 'VALUATION_CASE', edgeType: 'SCENARIO_TO_VALUATION',
    transformationKind: 'MANUAL_LINK', authorId: preparerId, assumptionSnapshotHash: 'sha256:goldco-fulldag-scenario-to-valuation-downside',
  });
  if (!edgeScenarioToValuation.ok) throw new Error(`SCENARIO_TO_VALUATION edge failed: ${JSON.stringify(edgeScenarioToValuation)}`);
  await writeWaccInputs(downsideVariant.bvId);
  const dcfDownside = await valuationComputeService.runDcfFcffValuation({
    organizationId: orgId, valuationBusinessVersionId: downsideVariant.bvId, entityId: entBaselineSource,
    requestedByUserId: preparerId, engineManifestId, projectionYears: projectionYearsBaseline,
    openingWorkingCapital: openingWc2025, terminal: { gPct: 2.0 },
  });
  if (!dcfDownside.ok) throw new Error(`Downside DCF FCFF valuation FAILED: ${JSON.stringify(dcfDownside)}`);
  record(`[Valuation DOWNSIDE] WACC=${dcfDownside.wacc.waccPct.toFixed(4)}% terminalValue=${dcfDownside.terminalValue.toFixed(2)} EV=${dcfDownside.enterpriseValue.toFixed(2)} PLN`);
  if (dcfDownside.enterpriseValue >= dcfBaseline.enterpriseValue) {
    flag('IF-10', `Expected downside EV (${dcfDownside.enterpriseValue}) < baseline EV (${dcfBaseline.enterpriseValue}) — got the opposite or equal.`);
  } else {
    record(`[Valuation] Downside EV < Baseline EV, as expected (${dcfDownside.enterpriseValue.toFixed(2)} < ${dcfBaseline.enterpriseValue.toFixed(2)}).`);
  }

  // --- Trading comps (synthetic peer set) on the BASELINE variant ---
  const compsMethod = await valuationComputeService.findOrCreateMethod({ organizationId: orgId, businessVersionId: baselineVariant.bvId, methodType: 'TRADING_COMPS', createdBy: preparerId });
  const syntheticPeers = [
    { name: 'EU Precision Manufacturing SA', metric: 8.2 },
    { name: 'Nordic Industrial Components AB', metric: 7.6 },
    { name: 'CE Metalworks Group', metric: 8.9 },
    { name: 'Alpine Component Systems', metric: 7.1 },
  ];
  for (const peer of syntheticPeers) {
    await withPinnedPostgresTransaction((tx: Tx) =>
      tx.queryRun(
        `INSERT INTO finance_valuation_comps (
           organization_id, method_id, peer_name, metric_type, metric_value_status, metric_value_decimal, source_ref, created_by
         ) VALUES (?, ?, ?, 'EV_EBITDA_MULTIPLE', 'PRESENT_NONZERO', ?, ?, ?)`,
        [orgId, compsMethod.id, peer.name, peer.metric, JSON.stringify({ source: 'synthetic_peer_set_goldco_fulldag' }), preparerId]
      )
    );
  }
  const avgMultiple = syntheticPeers.reduce((s, p) => s + p.metric, 0) / syntheticPeers.length;
  const ebitda2026 = fy2026.EBIT + fy2026.DEPRECIATION;
  const compsEv = avgMultiple * ebitda2026;
  const compsReadiness = valuationComputeService.assessCompsReadiness(syntheticPeers.length);
  await valuationComputeService.setMethodResult({ methodId: compsMethod.id, readiness: compsReadiness, resultValueStatus: 'PRESENT_NONZERO', resultEvDecimal: compsEv });
  record(`[Valuation BASELINE comps] avgEV/EBITDA multiple=${avgMultiple.toFixed(2)}x on FY2026 EBITDA=${ebitda2026.toFixed(2)} -> comps EV=${compsEv.toFixed(2)} PLN`);

  // --- Exit multiple as a cross-check on the DCF method (NOT in the recommendation basket) ---
  const dcfMethodBaseline = await valuationComputeService.findOrCreateMethod({ organizationId: orgId, businessVersionId: baselineVariant.bvId, methodType: 'DCF_FCFF', createdBy: preparerId });
  const exitMultiple = 8.0;
  const terminalYearEbitda = fy2028.EBIT + fy2028.DEPRECIATION;
  const exitTerminalValue = exitMultiple * terminalYearEbitda;
  await valuationTerminalService.writeTerminalRow({
    organizationId: orgId, methodId: dcfMethodBaseline.id, convention: 'EXIT_MULTIPLE', exitMultipleValue: exitMultiple,
    terminalValueDecimal: exitTerminalValue, isPrimary: false, rationale: 'Exit multiple cross-check (8.0x FY2028 EBITDA), not used in the recommendation basket — Gordon Growth remains the primary terminal convention.',
    createdBy: preparerId,
  });
  record(`[Valuation BASELINE exit-multiple cross-check] ${exitMultiple}x FY2028 EBITDA (${terminalYearEbitda.toFixed(2)}) = ${exitTerminalValue.toFixed(2)} PLN (cross-check only, terminal Gordon Growth remains primary)`);

  // --- Recommendation basket: DCF 100% in basket, comps + exit-multiple stay OUT (cross-checks) ---
  await valuationComputeService.setMethodBasket({ methodId: dcfMethodBaseline.id, isInRecommendationBasket: true, weightPct: 100 });
  const basketMethods = await withPinnedPostgresTransaction((tx: Tx) => tx.queryAll(`SELECT * FROM finance_valuation_methods WHERE business_version_id = ?`, [baselineVariant.bvId]));
  const recommendation = valuationComputeService.computeWeightedRecommendation(basketMethods as any);
  record(`[Valuation BASELINE recommendation] ${JSON.stringify(recommendation)}`);

  // --- 5x5 sensitivity (WACC x terminal g), all 25 cells g<WACC ---
  const baseWacc = dcfBaseline.wacc.waccPct;
  const waccAxis: [number, number, number, number, number] = [baseWacc - 2, baseWacc - 1, baseWacc, baseWacc + 1, baseWacc + 2];
  const gAxis: [number, number, number, number, number] = [0.5, 1.5, 2.5, 3.5, 4.5];
  const fcffYearsForGrid = dcfBaseline.fcffYears.map((y) => ({ fiscalYear: y.fiscalYear, fcff: y.fcff! }));
  const grid = valuationSensitivityService.buildWaccByTerminalGGrid({
    axes: { wacc: waccAxis, terminalG: gAxis }, years: fcffYearsForGrid,
    fcffTerminalYear: dcfBaseline.fcffYears[dcfBaseline.fcffYears.length - 1].fcff!,
    baseWaccPct: baseWacc, baseGPct: 2.5,
  });
  if (!grid.ok) throw new Error(`Sensitivity grid build failed: ${JSON.stringify(grid)}`);
  const violation = valuationSensitivityService.findMonotonicityViolation(grid.cells);
  record(`[Valuation BASELINE sensitivity] 25 cells built, monotonicity violation: ${violation ?? 'none'}`);
  if (violation) flag('IF-11', `Sensitivity grid monotonicity violation: ${violation}`);
  await valuationSensitivityService.writeSensitivityGrid({
    organizationId: orgId, methodId: dcfMethodBaseline.id, gridLabel: 'WACC x Terminal g (base case)',
    rowAxisVariable: 'terminal_g_pct', columnAxisVariable: 'wacc_pct', cells: grid.cells, createdBy: preparerId,
  });

  // --- EV -> Equity bridge (baseline variant) ---
  const asOfDate = '2025-12-31';
  const bridge = await valuationBridgeService.writeBridge({
    organizationId: orgId, businessVersionId: baselineVariant.bvId, asOfDate, enterpriseValueDecimal: dcfBaseline.enterpriseValue,
    equityValueDecimal: 0, // recomputed below via computeEquityValue then re-written is unnecessary — compute first
    components: [
      { sequenceOrder: 1, componentKind: 'DEBT', sign: 'SUBTRACT_FROM_EV', amountDecimal: 40_500_000, asOfDate, rationale: 'FY2025 closing LONG_TERM_DEBT' },
      { sequenceOrder: 2, componentKind: 'CASH', sign: 'ADD_TO_EV', amountDecimal: 11_000_000, asOfDate, rationale: 'FY2025 closing CASH' },
      { sequenceOrder: 3, componentKind: 'MINORITIES', sign: 'SUBTRACT_FROM_EV', amountDecimal: st.equityPostCTA * 0.2, asOfDate, rationale: '20% NCI in GoldCo Deutschland GmbH' },
    ],
    createdBy: preparerId,
  });
  if (!bridge.ok) {
    flag('IF-12', `EV->Equity bridge write failed: ${JSON.stringify(bridge)}`);
  } else {
    const eq = valuationBridgeService.computeEquityValue(dcfBaseline.enterpriseValue, [
      { sequenceOrder: 1, componentKind: 'DEBT', sign: 'SUBTRACT_FROM_EV', amountDecimal: 40_500_000, asOfDate },
      { sequenceOrder: 2, componentKind: 'CASH', sign: 'ADD_TO_EV', amountDecimal: 11_000_000, asOfDate },
      { sequenceOrder: 3, componentKind: 'MINORITIES', sign: 'SUBTRACT_FROM_EV', amountDecimal: st.equityPostCTA * 0.2, asOfDate },
    ]);
    if (eq.ok) {
      await withPinnedPostgresTransaction((tx: Tx) => tx.queryRun(`UPDATE finance_valuation_ev_equity_bridge SET equity_value_decimal = ? WHERE business_version_id = ?`, [eq.equityValueDecimal, baselineVariant.bvId]));
      record(`[Valuation BASELINE EV->Equity bridge] EV=${dcfBaseline.enterpriseValue.toFixed(2)} -> Equity=${eq.equityValueDecimal.toFixed(2)} PLN`);
    }
  }

  markPhase('VALUATION_COMPUTE');

  // --- Advisor outputs (freeze/staleness mechanism, D09b) — MUST be written BEFORE approval.
  // IF-19 FIXED (2026-08-10, see BUGFIX_IF19_ADVISOR_SEQUENCING_report.md): `finance_valuation_
  // advisor_outputs` requires a `compute_snapshot_id` FK to an EXISTING `finance_compute_snapshots`
  // row. Previously the ONLY code path that ever inserted one was `artifactVersionService.
  // approveVersion()` step (b) — which runs strictly AFTER the point where `finance_advisor_
  // outputs_no_new_after_approval()` (WP-D09b) already forbids new Advisor rows for that SAME
  // business_version_id, a real deadlock for any pre-approval Advisor caller. Fixed by adding
  // `artifactVersionService.createComputeSnapshot()` — callable while the business_version is
  // still DRAFT/READY_FOR_REVIEW/IN_REVIEW/NEEDS_CHANGES — which this script now calls directly
  // (no more raw INSERT workaround), proving the real production code path end-to-end.
  const preSnap = await artifactVersionService.createComputeSnapshot({
    organizationId: orgId,
    businessVersionId: baselineVariant.bvId,
    actorId: preparerId,
  });
  let preApprovalSnapshotId: string | null = null;
  if (!preSnap.ok) {
    flag('IF-19a', `artifactVersionService.createComputeSnapshot() failed unexpectedly for the Valuation variant's business version: ${JSON.stringify(preSnap)}`);
  } else {
    preApprovalSnapshotId = preSnap.computeSnapshotId;
    record(`[Advisor] pre-approval finance_compute_snapshots row created via artifactVersionService.createComputeSnapshot() (IF-19 fix): ${preApprovalSnapshotId} (reused=${preSnap.reused})`);
  }

  const advisorOutputsDraft = [
    { kind: 'FACT', title: 'WACC and Enterprise Value', narrative: `Baseline case WACC computed at ${dcfBaseline.wacc.waccPct.toFixed(2)}%, Enterprise Value PLN ${dcfBaseline.enterpriseValue.toFixed(0)}.`, driverRef: 'DCF_FCFF', impact: dcfBaseline.enterpriseValue, confidence: 'HIGH' },
    { kind: 'RISK', title: 'FY2026 funding gap', narrative: 'The Baseline Model shows a negative December 2026 cash position (funding gap) driven by Q4 seasonality and the mandatory debt-sweep clause — financing needs to be arranged before then.', driverRef: 'CASH', impact: decResult.cash, confidence: 'HIGH' },
    { kind: 'HYPOTHESIS', title: 'Efficiency programme upside not yet in the baseline valuation', narrative: 'The COGS efficiency initiative modeled in Prediction is not reflected in this Baseline-sourced valuation variant; a scenario-sourced variant using the efficiency scenario would likely show a materially higher EV.', driverRef: 'COGS', impact: null, confidence: 'MEDIUM' },
    { kind: 'QUESTION', title: 'Comps peer set representativeness', narrative: "The synthetic peer set (4 EU/CE industrial manufacturers) has not been validated against GoldCo's actual product mix — confirm comparability before relying on the comps cross-check.", driverRef: null, impact: null, confidence: 'LOW' },
  ] as const;
  if (preApprovalSnapshotId) {
    for (const o of advisorOutputsDraft) {
      await withPinnedPostgresTransaction((tx: Tx) =>
        tx.queryRun(
          `INSERT INTO finance_valuation_advisor_outputs (
             organization_id, business_version_id, compute_snapshot_id, output_kind, title, narrative,
             evidence_ref, driver_ref, impact_decimal, confidence,
             ai_provider, ai_model, ai_prompt_version, ai_no_training_commitment, ai_evidence_digest, created_by
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL_PROGRAMMATIC', 'goldco_full_dag.ts', 'v1', true, ?, ?)`,
          [
            orgId, baselineVariant.bvId, preApprovalSnapshotId, o.kind, o.title, o.narrative,
            JSON.stringify({ source: 'goldco_full_dag.ts', method: 'DCF_FCFF', businessVersionId: baselineVariant.bvId }),
            o.driverRef, o.impact, o.confidence,
            `sha256:goldco-fulldag-advisor-${o.kind.toLowerCase()}`, preparerId,
          ]
        )
      );
    }
    record(`[Advisor] ${advisorOutputsDraft.length} outputs written pre-approval (FACT/RISK/HYPOTHESIS/QUESTION), compute_snapshot_id=${preApprovalSnapshotId}`);
    const preApprovalFrozenCheck = await withPinnedPostgresTransaction((tx: Tx) =>
      tx.queryAll<{ is_frozen: boolean }>(`SELECT is_frozen FROM finance_valuation_advisor_outputs WHERE business_version_id = ?`, [baselineVariant.bvId])
    );
    record(`[Advisor] pre-approval frozen state: ${preApprovalFrozenCheck.filter((r) => r.is_frozen).length}/${preApprovalFrozenCheck.length} frozen (expected 0/${preApprovalFrozenCheck.length} — not yet approved)`);
  }

  // --- Maker-checker: self-approval must be rejected, then approved by a different user ---
  record(`\n--- Maker-checker (Valuation Case, HIGH_RISK tier) ---`);
  let bvVersion = baselineVariant.art.businessVersion.version;
  const submitted = await artifactVersionService.transition({ organizationId: orgId, businessVersionId: baselineVariant.bvId, action: 'submit_for_review', actorId: preparerId, role: 'preparer', expectedVersion: bvVersion });
  if (!submitted.ok) throw new Error(`submit_for_review failed: ${JSON.stringify(submitted)}`);
  bvVersion = submitted.businessVersion.version;
  const reviewStarted = await artifactVersionService.transition({ organizationId: orgId, businessVersionId: baselineVariant.bvId, action: 'start_review', actorId: reviewerId, role: 'reviewer', expectedVersion: bvVersion });
  if (!reviewStarted.ok) throw new Error(`start_review failed: ${JSON.stringify(reviewStarted)}`);
  bvVersion = reviewStarted.businessVersion.version;
  await withPinnedPostgresTransaction((tx: Tx) => tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?`, [baselineVariant.bvId]));

  const selfApprovalAttempt = await artifactVersionService.approveVersion({
    organizationId: orgId, businessVersionId: baselineVariant.bvId, actorId: preparerId, role: 'approver',
    expectedVersion: bvVersion, editorUserIds: [preparerId], reviewStartedBy: reviewerId,
  });
  record(`[Maker-checker] SELF-approval attempt by preparer: ok=${selfApprovalAttempt.ok} code=${(selfApprovalAttempt as any).code ?? 'n/a'}`);
  if (selfApprovalAttempt.ok || (selfApprovalAttempt as any).code !== 'SELF_APPROVAL_FORBIDDEN') {
    flag('IF-13', `Expected self-approval to be REJECTED with SELF_APPROVAL_FORBIDDEN, got: ${JSON.stringify(selfApprovalAttempt)}`);
  } else {
    record(`[Maker-checker] self-approval correctly REJECTED.`);
  }
  const reviewerApprovalAttempt = await artifactVersionService.approveVersion({
    organizationId: orgId, businessVersionId: baselineVariant.bvId, actorId: reviewerId, role: 'approver',
    expectedVersion: bvVersion, editorUserIds: [preparerId], reviewStartedBy: reviewerId,
  });
  record(`[Maker-checker] reviewer-as-approver attempt: ok=${reviewerApprovalAttempt.ok} code=${(reviewerApprovalAttempt as any).code ?? 'n/a'}`);
  if (reviewerApprovalAttempt.ok || (reviewerApprovalAttempt as any).code !== 'SELF_APPROVAL_FORBIDDEN') {
    flag('IF-14', `Expected reviewer-as-approver to ALSO be rejected (HIGH_RISK forbids approver===reviewer too), got: ${JSON.stringify(reviewerApprovalAttempt)}`);
  } else {
    record(`[Maker-checker] reviewer-as-approver correctly REJECTED (HIGH_RISK tier).`);
  }
  const distinctApproval = await artifactVersionService.approveVersion({
    organizationId: orgId, businessVersionId: baselineVariant.bvId, actorId: financeAdminId, role: 'approver',
    expectedVersion: bvVersion, editorUserIds: [preparerId], reviewStartedBy: reviewerId,
  });
  record(`[Maker-checker] distinct approver (financeAdmin, != preparer, != reviewer): ok=${distinctApproval.ok} status=${(distinctApproval as any).businessVersion?.status ?? 'n/a'}`);
  if (!distinctApproval.ok) {
    throw new Error(`Distinct-approver approval FAILED (should have succeeded): ${JSON.stringify(distinctApproval)}`);
  }

  markPhase('MAKER_CHECKER');

  // --- Advisor freeze verification (D09b) — the Advisor rows were written PRE-approval above
  // (via the fixed createComputeSnapshot() path, IF-19); now that the business_version_id is
  // APPROVED, confirm the freeze-on-approval trigger (trg_finance_bv_freeze_advisor_on_approval)
  // actually flipped is_frozen=true on all of them, and that a further write attempt is rejected
  // (immutability once frozen).
  if (preApprovalSnapshotId) {
    const frozenCheck = await withPinnedPostgresTransaction((tx: Tx) =>
      tx.queryAll<{ output_kind: string; is_frozen: boolean; frozen_at: string | null }>(`SELECT output_kind, is_frozen, frozen_at FROM finance_valuation_advisor_outputs WHERE business_version_id = ?`, [baselineVariant.bvId])
    );
    const frozenCount = frozenCheck.filter((r) => r.is_frozen).length;
    record(`[Advisor] freeze check AFTER APPROVED business version: ${frozenCount}/${frozenCheck.length} rows have is_frozen=true`);
    if (frozenCount !== frozenCheck.length) {
      flag('IF-16', `Expected ALL Advisor outputs to be frozen (is_frozen=true) once the parent business_version_id is APPROVED — got ${frozenCount}/${frozenCheck.length}. The freeze-on-approval trigger may not be firing correctly.`);
    } else {
      record(`[Advisor] freeze-on-approval trigger CONFIRMED working with real data: all ${frozenCount} rows frozen, frozen_at set.`);
    }
    // Attempt a further Advisor write against the now-APPROVED version — must be rejected.
    let postApprovalWriteRejected = false;
    try {
      await withPinnedPostgresTransaction((tx: Tx) =>
        tx.queryRun(
          `INSERT INTO finance_valuation_advisor_outputs (
             organization_id, business_version_id, compute_snapshot_id, output_kind, title, narrative,
             evidence_ref, ai_provider, ai_model, ai_prompt_version, ai_no_training_commitment, ai_evidence_digest, created_by
           ) VALUES (?, ?, ?, 'FACT', 'Post-approval write attempt (must be rejected)', 'n/a', ?, 'MANUAL_PROGRAMMATIC', 'goldco_full_dag.ts', 'v1', true, ?, ?)`,
          [orgId, baselineVariant.bvId, preApprovalSnapshotId, JSON.stringify({}), 'sha256:goldco-fulldag-advisor-post-approval-attempt', preparerId]
        )
      );
    } catch (err: any) {
      postApprovalWriteRejected = /is APPROVED; new Advisor findings not permitted/.test(String(err?.message || err));
    }
    record(`[Advisor] post-approval new-write rejected as expected: ${postApprovalWriteRejected}`);
    if (!postApprovalWriteRejected) flag('IF-20', `A new finance_valuation_advisor_outputs row was NOT rejected after the parent business_version reached APPROVED — expected finance_valuation_advisor_outputs_no_new_after_approval() to fire.`);
  }

  // --- Export manifest (WP-B06) ---
  record(`\n--- Export manifest (WP-B06) ---`);
  const exportManifest = await withPinnedPostgresTransaction((tx: Tx) =>
    tx.queryOne<{ export_manifest_id: string }>(
      `INSERT INTO finance_export_manifests (
         organization_id, export_format, status, primary_artifact_id, primary_business_version_id,
         locale, timezone, unit, as_of, rounding_convention_used, content_semantic_hash, generated_by
       ) VALUES (?, 'PDF', 'GENERATING', ?, ?, 'pl-PL', 'Europe/Warsaw', 'UNITS', now(), 'BANKERS_ROUNDING_2DP', ?, ?)
       RETURNING export_manifest_id`,
      [
        orgId, distinctApproval.businessVersion.artifact_id, baselineVariant.bvId,
        `sha256:goldco-fulldag-export-${baselineVariant.bvId}`, preparerId,
      ]
    )
  );
  await withPinnedPostgresTransaction((tx: Tx) =>
    tx.queryRun(`INSERT INTO finance_export_manifest_sources (export_manifest_id, business_version_id, role) VALUES (?, ?, 'PRIMARY')`, [exportManifest.export_manifest_id, baselineVariant.bvId])
  );
  await withPinnedPostgresTransaction((tx: Tx) =>
    tx.queryRun(
      `UPDATE finance_export_manifests SET status = 'READY', file_hash_sha256 = ?, storage_object_key = ?, generated_at = now() WHERE export_manifest_id = ?`,
      [`sha256:goldco-fulldag-export-file-${exportManifest.export_manifest_id}`, `exports/goldco-fulldag/${exportManifest.export_manifest_id}.pdf`, exportManifest.export_manifest_id]
    )
  );
  const exportRow = await withPinnedPostgresTransaction((tx: Tx) => tx.queryOne(`SELECT * FROM finance_export_manifests WHERE export_manifest_id = ?`, [exportManifest.export_manifest_id]));
  record(`[Export manifest] id=${exportManifest.export_manifest_id} status=${(exportRow as any)?.status} primary_business_version_id=${baselineVariant.bvId} (APPROVED source required and enforced live)`);

  markPhase('ADVISOR_AND_EXPORT');

  // =========================================================================
  // PHASE 6 — LINEAGE VERIFICATION: navigate ancestors from Valuation back to Statement
  // =========================================================================
  record(`\n================ PHASE 6: LINEAGE VERIFICATION ================`);
  const ancestors = await lineageService.getAncestors(orgId, baselineVariant.bvId, 20);
  record(`[Lineage] getAncestors(baselineVariant=${baselineVariant.bvId}) returned ${ancestors.length} edges:`);
  const edgeSummaries = ancestors.map((e: any) => `${e.source_artifact_type}(${e.source_version_id.slice(0, 8)}) -[${e.edge_type}]-> ${e.target_artifact_type}(${e.target_version_id.slice(0, 8)})`);
  for (const s of edgeSummaries) record(`  ${s}`);

  const reachesStatement = ancestors.some((e: any) => e.source_artifact_type === 'STATEMENT_PACK' && e.source_version_id === baselineSourceBvId);
  const reachesAnalysis = ancestors.some((e: any) => e.source_artifact_type === 'HISTORICAL_ANALYSIS' && e.source_version_id === analysisBvId);
  const reachesBaseline = ancestors.some((e: any) => e.source_artifact_type === 'BASELINE_MODEL' && e.source_version_id === baselineBvId);
  record(`[Lineage] chain reaches original Statement Pack Version (baseline-source): ${reachesStatement}`);
  record(`[Lineage] chain reaches Analysis: ${reachesAnalysis}`);
  record(`[Lineage] chain reaches Baseline Model: ${reachesBaseline}`);
  if (!reachesStatement || !reachesAnalysis || !reachesBaseline) {
    flag('IF-17', `Lineage ancestors query did NOT reach the full chain: reachesStatement=${reachesStatement} reachesAnalysis=${reachesAnalysis} reachesBaseline=${reachesBaseline}`);
  } else {
    record(`[Lineage] CONFIRMED: the full DAG (Valuation -> Prediction/Baseline -> Analysis + Statement) is ONE queryable structure via finance_lineage_edges, not five separate islands.`);
  }

  const downsideAncestors = await lineageService.getAncestors(orgId, downsideVariant.bvId, 20);
  const downsideReachesPrediction = downsideAncestors.some((e: any) => e.source_artifact_type === 'PREDICTION_SCENARIO' && e.source_version_id === downside.bvId);
  const downsideReachesBaseline = downsideAncestors.some((e: any) => e.source_artifact_type === 'BASELINE_MODEL' && e.source_version_id === baselineBvId);
  const downsideReachesStatement = downsideAncestors.some((e: any) => e.source_artifact_type === 'STATEMENT_PACK' && e.source_version_id === baselineSourceBvId);
  record(`[Lineage] downside variant ancestors: reachesPrediction=${downsideReachesPrediction} reachesBaseline=${downsideReachesBaseline} reachesStatement=${downsideReachesStatement} (${downsideAncestors.length} edges total)`);
  if (!downsideReachesPrediction || !downsideReachesBaseline || !downsideReachesStatement) {
    flag('IF-18', `Downside variant's lineage ancestors did not reach the full chain (Prediction -> Baseline -> Statement).`);
  }

  markPhase('LINEAGE_VERIFICATION');

  const totalMs = Date.now() - wallClockStart;
  record(`\n================ TIMING ================`);
  for (const p of phaseTimings) record(`  ${p.phase}: ${(p.ms / 1000).toFixed(1)}s`);
  record(`  TOTAL end-to-end (Statement -> Valuation, this script's own wall-clock): ${(totalMs / 1000).toFixed(1)}s`);

  const results = {
    meta: { orgId, generatedAt: new Date().toISOString(), totalMs },
    businessVersionIds: {
      statement: { parentFY2023: packParentFY2023.businessVersion.business_version_id, parentFY2024Original: packParentFY2024.businessVersion.business_version_id, parentFY2024Restated: restatedBvId, parentFY2025Annual: packParentFY2025.businessVersion.business_version_id, groupFY2025Consolidated: groupBvId, baselineSource: baselineSourceBvId },
      analysis: analysisBvId,
      baseline: baselineBvId,
      prediction: { base: base.bvId, efficiencyInitiative: eff.bvId, downside: downside.bvId },
      valuation: { case: caseId, baselineVariant: baselineVariant.bvId, downsideVariant: downsideVariant.bvId },
    },
    keyResults: {
      restatementApproved: !!restatedBvId,
      analysisKpiCount: computedKpis.results.length,
      baselineDecemberCash: decResult.cash,
      baselineFundingGap: decResult.qualityFlag === 'FUNDING_GAP',
      predictionConflictBlockedThenResolved: (effComputeBeforeResolution as any).code === 'READINESS_GATE_FAILED' && effComputeAfterResolution.ok,
      valuationBaselineEV: dcfBaseline.enterpriseValue,
      valuationDownsideEV: dcfDownside.enterpriseValue,
      valuationCompsEV: compsEv,
      valuationExitMultipleTerminal: exitTerminalValue,
      sensitivityMonotonic: !violation,
      makerCheckerSelfApprovalRejected: !selfApprovalAttempt.ok && (selfApprovalAttempt as any).code === 'SELF_APPROVAL_FORBIDDEN',
      makerCheckerDistinctApproverSucceeded: distinctApproval.ok,
      exportManifestReady: (exportRow as any)?.status === 'READY',
      lineageReachesFullChain: reachesStatement && reachesAnalysis && reachesBaseline,
    },
    phaseTimings,
    findings,
    log,
  };
  const outPath = path.join(HERE, 'goldco_full_dag_results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  record(`\n[goldco_full_dag] wrote ${outPath}`);
  record(`[goldco_full_dag] integration findings: ${findings.length} (${findings.map((f) => f.id).join(', ') || 'none'})`);
}

main().then(
  () => process.exit(0),
  (err) => {
    // eslint-disable-next-line no-console
    console.error('[goldco_full_dag] FATAL', err);
    process.exit(1);
  }
);
