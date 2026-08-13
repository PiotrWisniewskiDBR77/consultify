#!/usr/bin/env tsx
/**
 * GoldCo Manufacturing Group — pipeline run (Gate D / Fala 3, gold vertical
 * slice). THIS is the system-under-test half of the exercise: it feeds the
 * numbers computed independently in `goldco_oracle.ts` (read from
 * `goldco_oracle.json`, never recomputed here) through the REAL, already-
 * committed Gate D services —
 *   statementMappingService.mapStatementLines()
 *   statementReconciliationService.runReconciliation()
 *   artifactVersionService.{createArtifact,transition,approveVersion,reopenVersion}
 * — against a migrated ephemeral PostgreSQL instance, then reads every
 * intermediate value back OUT of the database (never returns the oracle's
 * own numbers) into `goldco_pipeline_results.json`, compared separately in
 * `goldco_compare.ts`.
 *
 * DB ISOLATION (hard requirement, see task brief + WP-D01b/WP-D02 precedent):
 * own ephemeral Postgres cluster only, never demo/dev/prod, never the shared
 * Homebrew instance (PID 911). This script does NOT start Postgres itself —
 * run it against an already-migrated ephemeral cluster (see
 * GOLDCO_STATEMENTS_VERTICAL_SLICE_REPORT.md section "How to reproduce" for
 * the exact initdb/migrate commands used).
 *
 * Run:
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/finance_v3_goldco \
 *   npx tsx docs/validation/finance-v3/generated/gate-d/goldco/goldco_pipeline.ts
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
if (!(process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && CONNECTION_STRING.startsWith('postgres'))) {
  throw new Error('goldco_pipeline.ts requires RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgresql://... against an ephemeral cluster — refusing to run against an ambiguous/default target.');
}
process.env.DB_TYPE = 'postgres';

const HERE = path.dirname(new URL(import.meta.url).pathname);

async function main() {
  // Relative specifiers with a `.js` extension pointing at `.ts` source files,
  // exactly the convention `statementServices.pg.test.ts` and every other
  // Gate C/D test file in this repo already uses (tsx's loader resolves the
  // `.ts` sibling) — six `../` from `docs/validation/finance-v3/generated/
  // gate-d/goldco/` reaches the repo root.
  const { withPinnedPostgresTransaction } = await import(
    '../../../../../../server/src/database/PostgresDatabase.js'
  );
  const artifactVersionService = await import(
    '../../../../../../server/src/services/finance/canonical/artifactVersionService.js'
  );
  const statementMappingService = await import(
    '../../../../../../server/src/services/finance/canonical/statementMappingService.js'
  );
  const statementReconciliationService = await import(
    '../../../../../../server/src/services/finance/canonical/statementReconciliationService.js'
  );

  type Tx = { queryAll: Function; queryOne: Function; queryRun: Function };

  const oracle = JSON.parse(fs.readFileSync(path.join(HERE, 'goldco_oracle.json'), 'utf8'));

  const log: string[] = [];
  const record = (msg: string) => {
    // eslint-disable-next-line no-console
    console.log(msg);
    log.push(msg);
  };

  const orgId = `org-goldco-${randomUUID()}`;
  const preparerId = `user-preparer-goldco`;
  const reviewerId = `user-reviewer-goldco`;
  const approverId = `user-approver-goldco`; // deliberately DIFFERENT from preparer/reviewer — STATEMENT_PACK defaults to MATERIAL risk tier, which forbids self-approval (lifecycleService.checkSelfApproval)

  const bugs: Array<{ id: string; severity: string; summary: string; evidence: string; status: string }> = [];

  await withPinnedPostgresTransaction((tx: Tx) => tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'GoldCo Manufacturing Group']));

  // ---------------------------------------------------------------------
  // Calendars + periods: one STANDARD calendar, FY2023/FY2024/FY2025 (FY)
  // periods with an explicit previous_period_id chain, plus 12 MONTH
  // periods for FY2025 (parent monthly P&L detail).
  // ---------------------------------------------------------------------
  const calendar = await withPinnedPostgresTransaction((tx: Tx) =>
    tx.queryOne(
      `INSERT INTO finance_stmt_calendars (organization_id, calendar_type, fiscal_year_end_month, effective_from, created_by)
       VALUES (?, 'STANDARD', 12, '2020-01-01', ?) RETURNING fiscal_calendar_id`,
      [orgId, preparerId]
    )
  );
  const calendarId = calendar.fiscal_calendar_id;

  async function makePeriod(fiscalYear: number, start: string, end: string, label: string, previousPeriodId: string | null) {
    const row = await withPinnedPostgresTransaction((tx: Tx) =>
      tx.queryOne(
        `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, period_start, period_end, label, previous_period_id, created_by)
         VALUES (?, ?, 'FY', ?, ?, ?, ?, ?, ?) RETURNING period_id`,
        [orgId, calendarId, fiscalYear, start, end, label, previousPeriodId, preparerId]
      )
    );
    return row.period_id as string;
  }
  async function makeMonthPeriod(fiscalYear: number, month: number, start: string, end: string, label: string, previousPeriodId: string | null) {
    const row = await withPinnedPostgresTransaction((tx: Tx) =>
      tx.queryOne(
        `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, fiscal_month, period_start, period_end, label, previous_period_id, created_by)
         VALUES (?, ?, 'MONTH', ?, ?, ?, ?, ?, ?, ?) RETURNING period_id`,
        [orgId, calendarId, fiscalYear, month, start, end, label, previousPeriodId, preparerId]
      )
    );
    return row.period_id as string;
  }

  const periodFY2023 = await makePeriod(2023, '2023-01-01', '2023-12-31', 'FY2023', null);
  const periodFY2024 = await makePeriod(2024, '2024-01-01', '2024-12-31', 'FY2024', periodFY2023);
  const periodFY2025 = await makePeriod(2025, '2025-01-01', '2025-12-31', 'FY2025', periodFY2024);

  const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const monthPeriods: string[] = [];
  {
    let prev: string | null = null;
    for (let m = 1; m <= 12; m++) {
      const start = `2025-${String(m).padStart(2, '0')}-01`;
      const end = `2025-${String(m).padStart(2, '0')}-${String(monthDays[m - 1]).padStart(2, '0')}`;
      const pid = await makeMonthPeriod(2025, m, start, end, `2025-M${String(m).padStart(2, '0')}`, prev);
      monthPeriods.push(pid);
      prev = pid;
    }
  }
  record(`[periods] FY2023=${periodFY2023} FY2024=${periodFY2024} FY2025=${periodFY2025} + 12 month periods for FY2025`);

  // ---------------------------------------------------------------------
  // Custom org-scoped canonical taxonomy lines the system taxonomy does not
  // have: CTA_OCI (cumulative translation adjustment, informational — not
  // part of any trigger check) and INTERCOMPANY_LOAN (the elimination pair
  // line). Org-scoped rows are a documented, already-supported mechanism
  // (statementMappingService.ts prefetches "organization_id IS NULL OR
  // organization_id = ?", org-specific rows win — see file header comment
  // "Org-specific rows win over global system rows").
  // ---------------------------------------------------------------------
  async function makeCustomLine(id: string, statementType: string, lineCode: string, name: string) {
    await withPinnedPostgresTransaction((tx: Tx) =>
      tx.queryRun(
        `INSERT INTO financial_statement_lines (id, organization_id, statement_type, line_code, line_name, is_system)
         VALUES (?, ?, ?, ?, ?, false) ON CONFLICT (id) DO NOTHING`,
        [id, orgId, statementType, lineCode, name]
      )
    );
  }
  // IDs randomized per run (not a fixed string) — a fixed id + ON CONFLICT DO
  // NOTHING would silently keep a PRIOR run's row (scoped to that run's own
  // throwaway orgId) on any re-run against the same ephemeral database,
  // making these custom lines invisible to the current run's org scope.
  await makeCustomLine(`fsl-goldco-cta-oci-${randomUUID()}`, 'BS', 'CTA_OCI', 'Cumulative Translation Adjustment (OCI)');
  await makeCustomLine(`fsl-goldco-icloan-${randomUUID()}`, 'BS', 'INTERCOMPANY_LOAN', 'Intercompany Loan (Parent <-> Sub)');
  record(`[taxonomy] custom org-scoped lines CTA_OCI, INTERCOMPANY_LOAN created`);

  // ---------------------------------------------------------------------
  // Generic helpers: build a Statement Pack (createArtifact), an entity row
  // scoped to that business_version_id, and a full P&L/BS/CF raw-line +
  // rule set from an oracle-shaped bundle.
  // ---------------------------------------------------------------------
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

  // Field-name -> (statementType, lineCode) map matching the oracle JSON's
  // pl/bs object keys exactly (see goldco_oracle.ts derivePL/deriveBS/withEquityPlug).
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

  // NOTE on consolidation_scope for the main GoldCo packs below: rules built
  // by buildFullPackRows() deliberately do NOT set `consolidationScope`, so
  // every row lands at the schema's own column DEFAULT — 'CONSOLIDATED'
  // (`finance_stmt_lines.consolidation_scope ... DEFAULT 'CONSOLIDATED'`,
  // WP-D01 ADR section 4.5) — NOT 'STANDALONE', even though these are, in
  // narrative terms, each entity's own standalone pack. This is deliberate,
  // not an oversight: `finance_stmt_check_balance()` /
  // `finance_stmt_check_cash_rollforward()` /
  // `finance_stmt_check_retained_earnings_rollforward()` (section 8.1/8.3/8.4
  // of `20260809_finance_v3_d01_statements_02_integrity.sql`) only ever
  // query `consolidation_scope = 'CONSOLIDATED'` rows — leaving these packs
  // at the default scope is the only way this slice can exercise those
  // three triggers against real, multi-year, oracle-derived data end to
  // end. The `unbalancedProbe()` function below instead deliberately SETS
  // `consolidationScope: 'STANDALONE'` on one of its two legs specifically
  // to prove, live, that the same trigger silently never fires for that
  // scope — see BUG-GOLDCO-02.
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

  async function mapReconcileApprove(
    businessVersionId: string, artifactId: string, expectedVersionStart: number,
    rawLines: any[], rules: any[], label: string, opts: { consolidationScope?: string } = {}
  ) {
    const scopedRules = opts.consolidationScope ? rules.map((r) => ({ ...r, consolidationScope: opts.consolidationScope })) : rules;
    const mapped = await statementMappingService.mapStatementLines({
      organizationId: orgId, businessVersionId, unit: 'UNITS', presentationCurrency: 'PLN',
      createdBy: preparerId, rawLines, rules: scopedRules,
    });
    // Only UNMAPPED/DUPLICATE are actual problems — EXCLUDED/RECLASS/ELIMINATION
    // are legitimate, expected bucket outcomes for rows whose rule says so.
    const badBuckets = mapped.filter((m: any) => m.bucket === 'UNMAPPED' || m.bucket === 'DUPLICATE');
    if (badBuckets.length > 0) {
      record(`  [WARN][${label}] ${badBuckets.length} row(s) UNMAPPED/DUPLICATE: ${JSON.stringify(badBuckets.map((b: any) => ({ item: b.raw.lineItem, bucket: b.bucket, reason: b.reasonCode })))}`);
    }
    const recon = await statementReconciliationService.runReconciliation({
      organizationId: orgId, artifactId, businessVersionId, sourceSystem: 'goldco:vertical_slice',
      mappingResults: mapped, createdBy: preparerId, attemptReadinessTransition: true,
      actorId: preparerId, role: 'preparer', expectedVersion: expectedVersionStart,
    });
    record(`  [${label}] reconciliation status=${recon.run.status} residual=${recon.run.residual} ready=${recon.readiness.ready} transitionOk=${recon.readiness.transitionResult?.ok}`);
    if (!recon.readiness.transitionResult?.ok) {
      const failed = recon.readiness.checks.filter((c: any) => !c.passed);
      record(`  [${label}] readiness FAILED checks: ${JSON.stringify(failed)}`);
      return { mapped, recon, approved: null as any };
    }
    // freshness defaults to 'NEVER_COMPUTED' on create (finance_business_versions
    // DDL, b01); approveVersion() requires freshness='CURRENT' (WP-B02 section 5.1
    // point 1(i)). No compute-job service exists in this Statements-only (Fala 3)
    // scope to set it naturally — same documented workaround the existing
    // canonicalServices.pg.test.ts suite already uses (direct UPDATE), not a
    // bug or a gap specific to this slice.
    await withPinnedPostgresTransaction((tx: Tx) => tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?`, [businessVersionId]));

    // start_review (T4, reviewer role) then approve (T8, approver role != preparer, MATERIAL risk tier).
    const started = await artifactVersionService.transition({
      organizationId: orgId, businessVersionId, action: 'start_review', actorId: reviewerId, role: 'reviewer',
      expectedVersion: recon.readiness.businessVersion.version,
    });
    if (!started.ok) { record(`  [${label}] start_review FAILED: ${JSON.stringify(started)}`); return { mapped, recon, approved: null as any }; }
    let approved: any;
    try {
      approved = await artifactVersionService.approveVersion({
        organizationId: orgId, businessVersionId, actorId: approverId, role: 'approver',
        expectedVersion: started.businessVersion.version, editorUserIds: [preparerId], reviewStartedBy: reviewerId,
      });
      record(`  [${label}] approve ok=${approved.ok}${approved.ok ? '' : ' code=' + (approved as any).code}`);
    } catch (err: any) {
      // BUG-GOLDCO-03 (see below): approveVersion() on a version WITH a
      // parent_version_id (i.e. every reopened/restated version) throws a
      // raw Postgres unique-violation instead of returning a structured
      // ApproveResult — caught here so the rest of the slice can continue
      // and the failure is captured as data, not a crashed script.
      record(`  [${label}] approve THREW: ${String(err.message || err)}`);
      approved = { ok: false, code: 'DB_CONSTRAINT_VIOLATION', message: String(err.message || err) };
    }
    return { mapped, recon, approved };
  }

  // =======================================================================
  // 1. PARENT standalone: FY2023 -> FY2024(original, APPROVED) -> reopen ->
  //    RESTATED(APPROVED) -> FY2025(built on restated closing).
  // =======================================================================
  record(`\n=== PARENT standalone FY2023 ===`);
  const packParentFY2023 = await makeStatementPack();
  const entParentFY2023 = await makeEntity(packParentFY2023.businessVersion.business_version_id, 'PARENT', { functionalCurrency: 'PLN' });
  const rowsParentFY2023 = buildFullPackRows('PARENT', periodFY2023, 'PLN', oracle.parent.FY2023, { includeCF: true });
  const resParentFY2023 = await mapReconcileApprove(
    packParentFY2023.businessVersion.business_version_id, packParentFY2023.artifact.artifact_id,
    packParentFY2023.businessVersion.version, rowsParentFY2023.rawLines, rowsParentFY2023.rules, 'PARENT FY2023'
  );

  record(`\n=== PARENT standalone FY2024 (ORIGINAL) ===`);
  const packParentFY2024 = await makeStatementPack();
  const entParentFY2024 = await makeEntity(packParentFY2024.businessVersion.business_version_id, 'PARENT', { functionalCurrency: 'PLN' });
  const rowsParentFY2024Orig = buildFullPackRows('PARENT', periodFY2024, 'PLN', oracle.parent.FY2024_original, { includeCF: true });
  const resParentFY2024Orig = await mapReconcileApprove(
    packParentFY2024.businessVersion.business_version_id, packParentFY2024.artifact.artifact_id,
    packParentFY2024.businessVersion.version, rowsParentFY2024Orig.rawLines, rowsParentFY2024Orig.rules, 'PARENT FY2024 ORIGINAL'
  );

  record(`\n=== PARENT FY2024 RESTATEMENT (reopen with versionKind=RESTATED -> remap -> approve) — BUG-GOLDCO-01 + BUG-GOLDCO-03 FIX RE-TEST ===`);
  let packParentFY2024Restated: any = null;
  if (resParentFY2024Orig.approved?.ok) {
    const origBvId = packParentFY2024.businessVersion.business_version_id;
    const origApprovedVersion = resParentFY2024Orig.approved.businessVersion.version;
    const RESTATEMENT_REASON =
      'Inventory valuation error discovered during FY2025 Q1 close: obsolete/slow-moving finished-goods stock at the Radom plant was carried at cost instead of net realizable value in the FY2024 audited pack.';
    // BUG-GOLDCO-01 FIX (2026-08-09): reopenVersion() now accepts
    // versionKind/restatementReason/restatementClass directly and persists
    // them on the new DRAFT row itself — no more post-hoc workaround UPDATE.
    const reopened = await artifactVersionService.reopenVersion({
      organizationId: orgId, businessVersionId: origBvId, actorId: approverId, role: 'approver',
      expectedVersion: origApprovedVersion, reason: RESTATEMENT_REASON,
      versionKind: 'RESTATED', restatementReason: RESTATEMENT_REASON, restatementClass: 'ERROR_CORRECTION',
    });
    if (!reopened.ok) {
      record(`  [PARENT FY2024 RESTATED] reopen FAILED: ${JSON.stringify(reopened)}`);
    } else {
      const newBvId = reopened.businessVersion.business_version_id;
      record(`  [PARENT FY2024 RESTATED] reopened vN+1=${newBvId} (parent=${origBvId}), status=${reopened.businessVersion.status}, version_kind=${reopened.businessVersion.version_kind}`);

      if (
        reopened.businessVersion.version_kind !== 'RESTATED' ||
        reopened.businessVersion.restatement_reason !== RESTATEMENT_REASON ||
        reopened.businessVersion.restatement_class !== 'ERROR_CORRECTION'
      ) {
        throw new Error(`BUG-GOLDCO-01 REGRESSION: reopenVersion() did not persist version_kind/restatement_reason/restatement_class as requested — got ${JSON.stringify({ version_kind: reopened.businessVersion.version_kind, restatement_reason: reopened.businessVersion.restatement_reason, restatement_class: reopened.businessVersion.restatement_class })}`);
      }
      record(`  [PARENT FY2024 RESTATED] BUG-GOLDCO-01 FIX CONFIRMED: reopenVersion() itself persisted version_kind=RESTATED + restatement_reason + restatement_class, no workaround UPDATE used.`);

      // Read back directly from the DB (not just the service's own return value) — same
      // discipline as the rest of this pipeline (never echo the caller's own input as proof).
      const confirmKind = await withPinnedPostgresTransaction((tx: Tx) =>
        tx.queryOne(`SELECT version_kind, restatement_reason, restatement_class FROM finance_business_versions WHERE business_version_id = ?`, [newBvId])
      );
      record(`  [PARENT FY2024 RESTATED] version_kind read back from DB: ${JSON.stringify(confirmKind)}`);
      if ((confirmKind as any)?.version_kind !== 'RESTATED') {
        throw new Error(`BUG-GOLDCO-01 REGRESSION: DB row does not show version_kind='RESTATED': ${JSON.stringify(confirmKind)}`);
      }

      const entRestated = await makeEntity(newBvId, 'PARENT', { functionalCurrency: 'PLN' });
      const rowsRestated = buildFullPackRows('PARENT', periodFY2024, 'PLN', oracle.parent.FY2024_restated, { includeCF: true });
      const resRestated = await mapReconcileApprove(
        newBvId, reopened.businessVersion.artifact_id, reopened.businessVersion.version,
        rowsRestated.rawLines, rowsRestated.rules, 'PARENT FY2024 RESTATED'
      );
      packParentFY2024Restated = { businessVersionId: newBvId, res: resRestated };

      // BUG-GOLDCO-03 FIX (2026-08-09): approveVersion() now supersedes the
      // parent BEFORE flipping the child to APPROVED, in the same transaction
      // — a reopened/restated version can now reach APPROVED without hitting
      // uq_finance_bv_one_approved.
      if (!resRestated.approved?.ok) {
        throw new Error(`BUG-GOLDCO-03 REGRESSION: approveVersion() on the RESTATED version did not reach APPROVED: ${JSON.stringify(resRestated.approved)}`);
      }
      record(`  [PARENT FY2024 RESTATED] BUG-GOLDCO-03 FIX CONFIRMED: approveVersion() succeeded, status=${resRestated.approved.businessVersion.status}`);

      // Confirm vN (original) is now SUPERSEDED (T9, fired inside approveVersion
      // when vN+1 was approved) and was NEVER mutated in place except for that
      // one status flip — content rows (finance_stmt_lines) for vN are untouched.
      const origAfter = await withPinnedPostgresTransaction((tx: Tx) =>
        tx.queryOne(`SELECT status, superseded_by_version_id FROM finance_business_versions WHERE business_version_id = ?`, [origBvId])
      );
      record(`  [PARENT FY2024 ORIGINAL] post-restatement status: ${JSON.stringify(origAfter)}`);
      if ((origAfter as any)?.status !== 'SUPERSEDED' || (origAfter as any)?.superseded_by_version_id !== newBvId) {
        throw new Error(`BUG-GOLDCO-03 REGRESSION: original vN did not become SUPERSEDED pointing at the restated child: ${JSON.stringify(origAfter)}`);
      }
      record(`  [PARENT FY2024 ORIGINAL] BUG-GOLDCO-03 FIX CONFIRMED: original correctly SUPERSEDED, superseded_by_version_id points at the restated child.`);
      const origLinesStillThere = await withPinnedPostgresTransaction((tx: Tx) =>
        tx.queryOne(`SELECT count(*)::int AS n FROM finance_stmt_lines WHERE business_version_id = ?`, [origBvId])
      );
      record(`  [PARENT FY2024 ORIGINAL] finance_stmt_lines row count (must be unchanged, ${rowsParentFY2024Orig.rawLines.length} expected): ${origLinesStillThere.n}`);
    }
  } else {
    record(`  [PARENT FY2024 RESTATED] SKIPPED — original FY2024 pack did not reach APPROVED`);
  }

  record(`\n=== PARENT standalone FY2025 (built on RESTATED FY2024 closing) ===`);
  const packParentFY2025 = await makeStatementPack();
  const entParentFY2025 = await makeEntity(packParentFY2025.businessVersion.business_version_id, 'PARENT', { functionalCurrency: 'PLN' });
  const rowsParentFY2025 = buildFullPackRows('PARENT', periodFY2025, 'PLN', oracle.parent.FY2025, { includeCF: true });
  const resParentFY2025 = await mapReconcileApprove(
    packParentFY2025.businessVersion.business_version_id, packParentFY2025.artifact.artifact_id,
    packParentFY2025.businessVersion.version, rowsParentFY2025.rawLines, rowsParentFY2025.rules, 'PARENT FY2025'
  );

  // =======================================================================
  // 2. PARENT FY2025 monthly P&L detail — one pack, 12 MONTH periods, P&L
  //    lines only (no BS/CF -> balance trigger never fires for these rows).
  // =======================================================================
  record(`\n=== PARENT FY2025 monthly P&L detail ===`);
  const packParentMonthly = await makeStatementPack();
  const entParentMonthly = await makeEntity(packParentMonthly.businessVersion.business_version_id, 'PARENT', { functionalCurrency: 'PLN' });
  const monthlyRawLines: any[] = [];
  const monthlyRules: any[] = [];
  for (const m of oracle.parent.FY2025_monthly) {
    const periodId = monthPeriods[m.month - 1];
    for (const [field, code] of Object.entries(PL_FIELD_MAP)) {
      const label = `PARENT:M${m.month}:${field}`;
      monthlyRawLines.push({ lineItem: label, periodId, entityCode: 'PARENT', currency: 'PLN', value: m[field], sourceRef: { month: m.month, field } });
      monthlyRules.push({ sourceLabel: label, statementType: 'P&L', lineCode: code });
    }
    // CASH (BS) + NET_CHANGE_CASH (CF) per month, at CONSOLIDATED scope (the
    // default here too — see the note above buildFullPackRows) so
    // finance_stmt_check_cash_rollforward() fires LIVE across all 11
    // consecutive same-business-version month pairs (M1 has no
    // previous_period_id -> documented no-op for that one month only).
    const cashLabel = `PARENT:M${m.month}:cash`;
    monthlyRawLines.push({ lineItem: cashLabel, periodId, entityCode: 'PARENT', currency: 'PLN', value: m.cash, sourceRef: { month: m.month, field: 'cash' } });
    monthlyRules.push({ sourceLabel: cashLabel, statementType: 'BS', lineCode: 'CASH' });
    const ncLabel = `PARENT:M${m.month}:netChangeCash`;
    monthlyRawLines.push({ lineItem: ncLabel, periodId, entityCode: 'PARENT', currency: 'PLN', value: m.netChangeCash, sourceRef: { month: m.month, field: 'netChangeCash' } });
    monthlyRules.push({ sourceLabel: ncLabel, statementType: 'CF', lineCode: 'NET_CHANGE_CASH' });
  }
  const resParentMonthly = await mapReconcileApprove(
    packParentMonthly.businessVersion.business_version_id, packParentMonthly.artifact.artifact_id,
    packParentMonthly.businessVersion.version, monthlyRawLines, monthlyRules, 'PARENT FY2025 MONTHLY'
  );

  // =======================================================================
  // 3. SUB standalone: FY2023 -> FY2024 -> FY2025 (EUR, no restatement).
  // =======================================================================
  async function subPack(label: string, periodId: string, bundle: Bundle) {
    record(`\n=== SUB standalone ${label} ===`);
    const pack = await makeStatementPack();
    await makeEntity(pack.businessVersion.business_version_id, 'SUB', { functionalCurrency: 'EUR' });
    const rows = buildFullPackRows('SUB', periodId, 'EUR', bundle);
    const res = await mapReconcileApprove(pack.businessVersion.business_version_id, pack.artifact.artifact_id, pack.businessVersion.version, rows.rawLines, rows.rules, `SUB ${label}`);
    return { pack, res };
  }
  const subFY2023 = await subPack('FY2023', periodFY2023, oracle.sub.FY2023);
  const subFY2024 = await subPack('FY2024', periodFY2024, oracle.sub.FY2024);
  const subFY2025 = await subPack('FY2025', periodFY2025, oracle.sub.FY2025);

  // =======================================================================
  // 4. Negative-test probe: a deliberately UNBALANCED pack, mapped TWICE —
  //    once at consolidationScope='STANDALONE' (default choice for a
  //    genuine single-entity pack) and once at 'CONSOLIDATED' — to prove
  //    live whether finance_stmt_check_balance() actually fires for both
  //    scopes or only one. (Static reading of
  //    20260809_finance_v3_d01_statements_02_integrity.sql section 8.1 shows
  //    the trigger's own SELECT is hardcoded to
  //    `consolidation_scope = 'CONSOLIDATED'` for BOTH the TOTAL_ASSETS and
  //    TOTAL_LIABILITIES_EQUITY lookups — this probe reproduces that live,
  //    not just by code reading.)
  // =======================================================================
  record(`\n=== NEGATIVE-TEST PROBE: unbalanced pack, STANDALONE vs CONSOLIDATED scope — BUG-GOLDCO-02 FIX RE-TEST ===`);
  const UNBALANCED_DELTA = 50_000_000;
  async function unbalancedProbe(scope: 'STANDALONE' | 'CONSOLIDATED') {
    const pack = await makeStatementPack();
    const bvId = pack.businessVersion.business_version_id;
    await makeEntity(bvId, 'PROBE', { functionalCurrency: 'PLN' });
    const rawLines = [
      { lineItem: 'Total assets', periodId: periodFY2025, entityCode: 'PROBE', currency: 'PLN', value: 100_000_000, sourceRef: {} },
      { lineItem: 'Total liabilities and equity', periodId: periodFY2025, entityCode: 'PROBE', currency: 'PLN', value: 100_000_000 - UNBALANCED_DELTA, sourceRef: {} },
    ];
    const rules = [
      { sourceLabel: 'Total assets', statementType: 'BS', lineCode: 'TOTAL_ASSETS', consolidationScope: scope },
      { sourceLabel: 'Total liabilities and equity', statementType: 'BS', lineCode: 'TOTAL_LIABILITIES_EQUITY', consolidationScope: scope },
    ];
    try {
      const mapped = await statementMappingService.mapStatementLines({
        organizationId: orgId, businessVersionId: bvId, unit: 'UNITS', presentationCurrency: 'PLN', createdBy: preparerId, rawLines, rules,
      });
      const stillThere = await withPinnedPostgresTransaction((tx: Tx) =>
        tx.queryOne(`SELECT count(*)::int AS n FROM finance_stmt_lines WHERE business_version_id = ?`, [bvId])
      );
      return { scope, rejected: false, mappedCount: mapped.length, storedCount: stillThere.n };
    } catch (err: any) {
      return { scope, rejected: true, error: String(err.message || err) };
    }
  }
  const probeStandalone = await unbalancedProbe('STANDALONE');
  const probeConsolidated = await unbalancedProbe('CONSOLIDATED');
  record(`  [PROBE STANDALONE, ${UNBALANCED_DELTA} PLN off-balance] result: ${JSON.stringify(probeStandalone)}`);
  record(`  [PROBE CONSOLIDATED, ${UNBALANCED_DELTA} PLN off-balance] result: ${JSON.stringify(probeConsolidated)}`);
  // BUG-GOLDCO-02 FIX (2026-08-09, additive migration
  // 20260809_finance_v3_d01b_statements_02b_integrity_scope_fix.sql):
  // finance_stmt_check_balance() (and the cash/RE roll-forward triggers)
  // now check NEW.consolidation_scope instead of a hardcoded 'CONSOLIDATED'
  // literal — an unbalanced pack must now be rejected at BOTH scopes.
  if (probeStandalone.rejected && probeConsolidated.rejected) {
    record(`  BUG-GOLDCO-02 FIX CONFIRMED: the PLN ${UNBALANCED_DELTA} imbalance is now rejected at BOTH STANDALONE and CONSOLIDATED scope (previously STANDALONE was silently accepted).`);
  } else {
    throw new Error(`BUG-GOLDCO-02 REGRESSION: expected both STANDALONE and CONSOLIDATED to reject the unbalanced probe — got standalone.rejected=${probeStandalone.rejected} consolidated.rejected=${probeConsolidated.rejected}`);
  }

  // =======================================================================
  // 5. Consolidated FY2025 Group pack: PARENT (CONSOLIDATED scope = group
  //    totals, computed by the oracle) + SUB (CONSOLIDATED scope = FX-
  //    translated PLN figures, computed by the oracle) + ELIM (intercompany
  //    loan, matched NATURAL/CONTRA pair on the SAME canonical line, per
  //    the trigger's per-canonical-line netting design, WP-D01 section 5.4).
  // =======================================================================
  record(`\n=== Consolidated GoldCo Group FY2025 pack ===`);
  const packGroup = await makeStatementPack();
  const groupBvId = packGroup.businessVersion.business_version_id;
  const entGroupParent = await makeEntity(groupBvId, 'PARENT', { role: 'GROUP_PARENT', consolidationMethod: 'NOT_CONSOLIDATED', functionalCurrency: 'PLN' });
  const entGroupSub = await makeEntity(groupBvId, 'SUB', { role: 'SUBSIDIARY', consolidationMethod: 'FULL', ownershipPct: 80, functionalCurrency: 'EUR' });
  await makeEntity(groupBvId, 'ELIM', { role: 'ELIMINATION_BUCKET', consolidationMethod: 'NOT_CONSOLIDATED', functionalCurrency: 'PLN' });

  const g = oracle.groupFY2025;
  const st = oracle.sub.FY2025_translated;

  const groupRawLines: any[] = [];
  const groupRules: any[] = [];
  const pushGroup = (entityCode: string, label: string, statementType: 'P&L' | 'BS', lineCode: string, value: number, scope: string) => {
    groupRawLines.push({ lineItem: label, periodId: periodFY2025, entityCode, currency: 'PLN', value, sourceRef: { source: 'goldco_oracle.json:groupFY2025' } });
    groupRules.push({ sourceLabel: label, statementType, lineCode, consolidationScope: scope });
  };
  // PARENT entity, CONSOLIDATED scope = the GROUP consolidated totals (oracle-computed).
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
  // NCI equity/net-income split and parent-attributable net income are NOT
  // written as finance_stmt_lines rows — the canonical taxonomy has no
  // NCI_EQUITY/NCI_NET_INCOME line codes and adding more custom org-scoped
  // lines for a value that is pure disclosure math (never an input to any
  // trigger) is out of scope for this slice. They are compared directly
  // from the oracle JSON's own NCI split against the ORACLE'S OWN
  // total-equity/net-income figures in goldco_compare.ts's internal
  // consistency section, not against a pipeline-stored value — documented,
  // not silently skipped.

  // SUB entity, CONSOLIDATED scope = FX-translated (PLN) figures (oracle-computed).
  pushGroup('SUB', 'SUBTRANS:PL:REVENUE', 'P&L', 'REVENUE', st.pl.revenue, 'CONSOLIDATED');
  pushGroup('SUB', 'SUBTRANS:PL:COGS', 'P&L', 'COGS', st.pl.cogs, 'CONSOLIDATED');
  pushGroup('SUB', 'SUBTRANS:PL:NET_INCOME', 'P&L', 'NET_INCOME', st.pl.netIncome, 'CONSOLIDATED');
  pushGroup('SUB', 'SUBTRANS:BS:TOTAL_ASSETS', 'BS', 'TOTAL_ASSETS', st.bsPreCTA.totalAssets, 'CONSOLIDATED');
  pushGroup('SUB', 'SUBTRANS:BS:TOTAL_LIABILITIES', 'BS', 'TOTAL_LIABILITIES', st.bsPreCTA.totalLiabilities, 'CONSOLIDATED');
  pushGroup('SUB', 'SUBTRANS:BS:EQUITY', 'BS', 'EQUITY', st.equityPostCTA, 'CONSOLIDATED');
  pushGroup('SUB', 'SUBTRANS:BS:TOTAL_LIABILITIES_EQUITY', 'BS', 'TOTAL_LIABILITIES_EQUITY', st.totalLiabilitiesEquity, 'CONSOLIDATED');
  pushGroup('SUB', 'SUBTRANS:BS:CTA_OCI', 'BS', 'CTA_OCI', st.cta, 'CONSOLIDATED');

  // ELIMINATION pair — SAME canonical line (INTERCOMPANY_LOAN), matched
  // NATURAL/CONTRA legs netting to exactly zero (see statementReconciliationService
  // / trigger note above): PARENT's leg removes its intercompany loan
  // RECEIVABLE from the consolidated balance, SUB's leg removes the
  // matching loan PAYABLE.
  groupRawLines.push({ lineItem: 'ELIM:PARENT:INTERCOMPANY_LOAN', periodId: periodFY2025, entityCode: 'PARENT', currency: 'PLN', value: -oracle.intercompany.loanPLN, sourceRef: { leg: 'parent_receivable' } });
  groupRules.push({ sourceLabel: 'ELIM:PARENT:INTERCOMPANY_LOAN', statementType: 'BS', lineCode: 'INTERCOMPANY_LOAN', consolidationScope: 'ELIMINATION', signConvention: 'NATURAL', eliminationCounterpartyEntityCode: 'SUB' });
  groupRawLines.push({ lineItem: 'ELIM:SUB:INTERCOMPANY_LOAN', periodId: periodFY2025, entityCode: 'SUB', currency: 'PLN', value: -oracle.intercompany.loanPLN, sourceRef: { leg: 'sub_payable' } });
  groupRules.push({ sourceLabel: 'ELIM:SUB:INTERCOMPANY_LOAN', statementType: 'BS', lineCode: 'INTERCOMPANY_LOAN', consolidationScope: 'ELIMINATION', signConvention: 'CONTRA', eliminationCounterpartyEntityCode: 'PARENT' });

  const resGroup = await mapReconcileApprove(groupBvId, packGroup.artifact.artifact_id, packGroup.businessVersion.version, groupRawLines, groupRules, 'GROUP FY2025 CONSOLIDATED');

  // =======================================================================
  // Read every intermediate value back OUT of finance_stmt_lines (never
  // out of the oracle) for goldco_compare.ts.
  // =======================================================================
  async function readCell(businessVersionId: string, entityCode: string, lineCode: string, periodId: string, scope: string) {
    const row = await withPinnedPostgresTransaction((tx: Tx) =>
      tx.queryOne(
        `SELECT l.value_decimal, l.value_status FROM finance_stmt_lines l
           JOIN finance_stmt_entities e ON e.id = l.entity_id
           JOIN financial_statement_lines c ON c.id = l.canonical_line_id
         WHERE l.business_version_id = ? AND e.entity_code = ? AND c.line_code = ? AND l.period_id = ? AND l.consolidation_scope = ?`,
        [businessVersionId, entityCode, lineCode, periodId, scope]
      )
    );
    return row ? Number(row.value_decimal) : null;
  }

  const CF_FIELD_MAP: Record<string, string> = { cfo: 'CFO', cfi: 'CFI', cff: 'CFF', netChangeCash: 'NET_CHANGE_CASH' };

  async function readBundleBack(businessVersionId: string, entityCode: string, periodId: string, scope = 'CONSOLIDATED') {
    const out: Record<string, number | null> = {};
    for (const [field, code] of Object.entries({ ...PL_FIELD_MAP, ...BS_FIELD_MAP })) {
      out[field] = await readCell(businessVersionId, entityCode, code, periodId, scope);
    }
    out.retainedEarnings = await readCell(businessVersionId, entityCode, 'RETAINED_EARNINGS', periodId, scope);
    out.dividendsDeclared = await readCell(businessVersionId, entityCode, 'DIVIDENDS_DECLARED', periodId, scope);
    for (const [field, code] of Object.entries(CF_FIELD_MAP)) {
      out[field] = await readCell(businessVersionId, entityCode, code, periodId, scope);
    }
    return out;
  }

  const pipelineResults: any = {
    meta: { orgId, generatedAt: new Date().toISOString() },
    bugs,
    parent: {
      FY2023: await readBundleBack(packParentFY2023.businessVersion.business_version_id, 'PARENT', periodFY2023),
      FY2024_original: await readBundleBack(packParentFY2024.businessVersion.business_version_id, 'PARENT', periodFY2024),
      FY2024_restated: packParentFY2024Restated ? await readBundleBack(packParentFY2024Restated.businessVersionId, 'PARENT', periodFY2024) : null,
      FY2025: await readBundleBack(packParentFY2025.businessVersion.business_version_id, 'PARENT', periodFY2025),
    },
    parentMonthly: await Promise.all(
      oracle.parent.FY2025_monthly.map(async (m: any) => {
        const periodId = monthPeriods[m.month - 1];
        const out: Record<string, number | null> = { month: m.month };
        for (const [field, code] of Object.entries(PL_FIELD_MAP)) {
          out[field] = await readCell(packParentMonthly.businessVersion.business_version_id, 'PARENT', code, periodId, 'CONSOLIDATED');
        }
        out.cash = await readCell(packParentMonthly.businessVersion.business_version_id, 'PARENT', 'CASH', periodId, 'CONSOLIDATED');
        out.netChangeCash = await readCell(packParentMonthly.businessVersion.business_version_id, 'PARENT', 'NET_CHANGE_CASH', periodId, 'CONSOLIDATED');
        return out;
      })
    ),
    sub: {
      FY2023: await readBundleBack(subFY2023.pack.businessVersion.business_version_id, 'SUB', periodFY2023),
      FY2024: await readBundleBack(subFY2024.pack.businessVersion.business_version_id, 'SUB', periodFY2024),
      FY2025: await readBundleBack(subFY2025.pack.businessVersion.business_version_id, 'SUB', periodFY2025),
    },
    group: {
      pl: {
        revenue: await readCell(groupBvId, 'PARENT', 'REVENUE', periodFY2025, 'CONSOLIDATED'),
        cogs: await readCell(groupBvId, 'PARENT', 'COGS', periodFY2025, 'CONSOLIDATED'),
        netIncomeConsolidated: await readCell(groupBvId, 'PARENT', 'NET_INCOME', periodFY2025, 'CONSOLIDATED'),
      },
      bs: {
        totalAssets: await readCell(groupBvId, 'PARENT', 'TOTAL_ASSETS', periodFY2025, 'CONSOLIDATED'),
        totalLiabilities: await readCell(groupBvId, 'PARENT', 'TOTAL_LIABILITIES', periodFY2025, 'CONSOLIDATED'),
        totalEquity: await readCell(groupBvId, 'PARENT', 'EQUITY', periodFY2025, 'CONSOLIDATED'),
        totalLiabilitiesEquity: await readCell(groupBvId, 'PARENT', 'TOTAL_LIABILITIES_EQUITY', periodFY2025, 'CONSOLIDATED'),
      },
      subTranslated: {
        revenue: await readCell(groupBvId, 'SUB', 'REVENUE', periodFY2025, 'CONSOLIDATED'),
        netIncome: await readCell(groupBvId, 'SUB', 'NET_INCOME', periodFY2025, 'CONSOLIDATED'),
        totalAssets: await readCell(groupBvId, 'SUB', 'TOTAL_ASSETS', periodFY2025, 'CONSOLIDATED'),
        equity: await readCell(groupBvId, 'SUB', 'EQUITY', periodFY2025, 'CONSOLIDATED'),
        totalLiabilitiesEquity: await readCell(groupBvId, 'SUB', 'TOTAL_LIABILITIES_EQUITY', periodFY2025, 'CONSOLIDATED'),
        cta: await readCell(groupBvId, 'SUB', 'CTA_OCI', periodFY2025, 'CONSOLIDATED'),
      },
      eliminationRows: await withPinnedPostgresTransaction((tx: Tx) =>
        tx.queryAll(
          `SELECT e.entity_code, l.value_decimal, l.sign_convention FROM finance_stmt_lines l
             JOIN finance_stmt_entities e ON e.id = l.entity_id
             JOIN financial_statement_lines c ON c.id = l.canonical_line_id
           WHERE l.business_version_id = ? AND c.line_code = 'INTERCOMPANY_LOAN' AND l.consolidation_scope = 'ELIMINATION'`,
          [groupBvId]
        )
      ),
      businessVersionStatus: (await withPinnedPostgresTransaction((tx: Tx) =>
        tx.queryOne(`SELECT status FROM finance_business_versions WHERE business_version_id = ?`, [groupBvId])
      ))?.status,
    },
    restatement: packParentFY2024Restated
      ? {
          originalBusinessVersionId: packParentFY2024.businessVersion.business_version_id,
          restatedBusinessVersionId: packParentFY2024Restated.businessVersionId,
          originalStatusAfter: (await withPinnedPostgresTransaction((tx: Tx) =>
            tx.queryOne(`SELECT status, superseded_by_version_id FROM finance_business_versions WHERE business_version_id = ?`, [packParentFY2024.businessVersion.business_version_id])
          )),
          restatedStatusAfter: (await withPinnedPostgresTransaction((tx: Tx) =>
            tx.queryOne(`SELECT status, version_kind, restatement_reason, restatement_class, parent_version_id FROM finance_business_versions WHERE business_version_id = ?`, [packParentFY2024Restated.businessVersionId])
          )),
        }
      : null,
    negativeProbe: { standalone: probeStandalone, consolidated: probeConsolidated },
    packStatuses: {
      parentFY2023: resParentFY2023.approved?.ok ?? false,
      parentFY2024Original: resParentFY2024Orig.approved?.ok ?? false,
      parentFY2024Restated: packParentFY2024Restated?.res?.approved?.ok ?? false,
      parentFY2025: resParentFY2025.approved?.ok ?? false,
      parentMonthly: resParentMonthly.approved?.ok ?? false,
      subFY2023: subFY2023.res.approved?.ok ?? false,
      subFY2024: subFY2024.res.approved?.ok ?? false,
      subFY2025: subFY2025.res.approved?.ok ?? false,
      group: resGroup.approved?.ok ?? false,
    },
    log,
  };

  const outPath = path.join(HERE, 'goldco_pipeline_results.json');
  fs.writeFileSync(outPath, JSON.stringify(pipelineResults, null, 2));
  record(`\n[goldco_pipeline] wrote ${outPath}`);
  record(`[goldco_pipeline] bugs found: ${bugs.length} (${bugs.map((b) => b.id).join(', ') || 'none'})`);
}

main().then(
  () => process.exit(0),
  (err) => {
    // eslint-disable-next-line no-console
    console.error('[goldco_pipeline] FATAL', err);
    process.exit(1);
  }
);
