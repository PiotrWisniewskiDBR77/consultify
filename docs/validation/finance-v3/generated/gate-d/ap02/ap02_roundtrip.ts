#!/usr/bin/env tsx
/**
 * AP-02 — Excel/CSV round-trip integration test, against a real migrated
 * ephemeral Postgres (never demo/dev/prod, never the shared Homebrew
 * instance — same isolation discipline as `goldco_pipeline.ts`).
 *
 * Fixture: a small GoldCo-flavored Statement Pack (Fala 3's org — "GoldCo
 * Manufacturing Group" — reused by name/spirit, NOT the full 500+-fact
 * oracle from `goldco_oracle.json`; see AP-02_excel_roundtrip_report.md
 * section 3 for why a smaller, purpose-built fixture was used instead of
 * replaying the full oracle for this work package).
 *
 * Exercises, against the REAL DB-backed services (not mocks):
 *   1. `exportFinanceStatementPack` on a DRAFT business version.
 *   2. A simulated re-import: parse the exported workbook back to rows,
 *      change a few values, add a few new cells, clear one.
 *   3. `previewFinanceImport` — diff correctness (add/change/clear/unchanged).
 *   4. `applyFinanceImport` — transactional apply, re-read from DB to prove
 *      the values actually changed.
 *   5. The Approved-immutability guard: force the business version to
 *      APPROVED (direct SQL — this test does not exercise the full
 *      readiness/reconciliation ceremony `approveVersion()` requires; that
 *      is GOLDCO_FULL_DAG_END_TO_END_REPORT.md's job, not AP-02's), then
 *      confirm import WITHOUT `reopen` is rejected, and import WITH
 *      `reopen` succeeds against a NEW draft while the Approved row stays
 *      byte-identical.
 *
 * Run:
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/<db> \
 *   npx tsx docs/validation/finance-v3/generated/gate-d/ap02/ap02_roundtrip.ts
 */
import { randomUUID } from 'node:crypto';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
if (!(process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && CONNECTION_STRING.startsWith('postgres'))) {
  throw new Error('ap02_roundtrip.ts requires RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgresql://... against an ephemeral cluster — refusing to run against an ambiguous/default target.');
}
process.env.DB_TYPE = 'postgres';

async function main() {
  const { withPinnedPostgresTransaction } = await import('../../../../../../server/src/database/PostgresDatabase.js');
  const artifactVersionService = await import('../../../../../../server/src/services/finance/canonical/artifactVersionService.js');
  const financeExportService = await import('../../../../../../server/src/services/finance/canonical/financeExportService.js');
  const financeImportService = await import('../../../../../../server/src/services/finance/canonical/financeImportService.js');

  type Tx = { queryAll: Function; queryOne: Function; queryRun: Function };

  const bugs: Array<{ id: string; severity: string; summary: string }> = [];
  const assert = (cond: boolean, id: string, severity: string, summary: string) => {
    if (!cond) bugs.push({ id, severity, summary });
    console.log(`${cond ? 'PASS' : 'FAIL'} ${id} — ${summary}`);
  };

  const orgId = `org-ap02-goldco-${randomUUID()}`;
  const preparerId = 'user-preparer-ap02';
  const approverId = 'user-approver-ap02';

  await withPinnedPostgresTransaction((tx: Tx) => tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'GoldCo Manufacturing Group (AP-02 fixture)']));

  // --- Calendar + 2 FY periods -------------------------------------------------
  const calendarId = await withPinnedPostgresTransaction(async (tx: Tx) => {
    const row = await tx.queryOne(
      `INSERT INTO finance_stmt_calendars (organization_id, calendar_type, fiscal_year_end_month, effective_from, created_by)
       VALUES (?, 'STANDARD', 12, '2020-01-01', ?) RETURNING fiscal_calendar_id`,
      [orgId, preparerId]
    );
    return row.fiscal_calendar_id as string;
  });

  const periodFY2024 = await withPinnedPostgresTransaction(async (tx: Tx) => {
    const row = await tx.queryOne(
      `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, period_start, period_end, label, created_by)
       VALUES (?, ?, 'FY', 2024, '2024-01-01', '2024-12-31', 'FY2024', ?) RETURNING period_id`,
      [orgId, calendarId, preparerId]
    );
    return row.period_id as string;
  });
  const periodFY2025 = await withPinnedPostgresTransaction(async (tx: Tx) => {
    const row = await tx.queryOne(
      `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, period_start, period_end, label, previous_period_id, created_by)
       VALUES (?, ?, 'FY', 2025, '2025-01-01', '2025-12-31', 'FY2025', ?, ?) RETURNING period_id`,
      [orgId, calendarId, periodFY2024, preparerId]
    );
    return row.period_id as string;
  });

  // --- Artifact + business version v1 (DRAFT) ---------------------------------
  const created = await artifactVersionService.createArtifact({
    organizationId: orgId,
    artifactType: 'STATEMENT_PACK',
    naturalKey: 'goldco-ap02-statement-pack',
    createdBy: preparerId,
  });
  const artifactId = created.artifact.artifact_id;
  let bv1 = created.businessVersion.business_version_id;

  // --- Entity scoped to bv1 -----------------------------------------------------
  const entityId = await withPinnedPostgresTransaction(async (tx: Tx) => {
    const row = await tx.queryOne(
      `INSERT INTO finance_stmt_entities (organization_id, business_version_id, entity_code, legal_name, role, consolidation_method, ownership_pct, functional_currency, created_by)
       VALUES (?, ?, 'GOLDCO_PARENT', 'GoldCo Manufacturing Group', 'GROUP_PARENT', 'FULL', 100, 'USD', ?) RETURNING id`,
      [orgId, bv1, preparerId]
    );
    return row.id as string;
  });

  const lineIds = await withPinnedPostgresTransaction(async (tx: Tx) => {
    const rows = await tx.queryAll(
      `SELECT id, statement_type, line_code FROM financial_statement_lines
        WHERE line_code IN ('REVENUE','COGS','GROSS_MARGIN','CASH','CURRENT_ASSETS','CURRENT_LIABILITIES')`
    );
    const map = new Map<string, string>();
    for (const r of rows as any[]) map.set(r.line_code, r.id);
    return map;
  });

  // --- Seed finance_stmt_lines: FY2024 fully populated, FY2025 partially -----
  await withPinnedPostgresTransaction(async (tx: Tx) => {
    const insertLine = async (
      lineCode: string,
      statementType: 'P&L' | 'BS',
      periodId: string,
      status: string,
      value: string | null
    ) => {
      await tx.queryRun(
        `INSERT INTO finance_stmt_lines (
           organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id,
           value_status, value_decimal, native_currency, presentation_currency, unit, accounting_policy, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'USD', 'USD', 'THOUSANDS', 'IFRS', ?)`,
        [orgId, bv1, statementType, lineIds.get(lineCode), entityId, periodId, status, value, preparerId]
      );
    };
    // FY2024 — fully populated
    await insertLine('REVENUE', 'P&L', periodFY2024, 'PRESENT_NONZERO', '500000');
    await insertLine('COGS', 'P&L', periodFY2024, 'PRESENT_NONZERO', '300000');
    await insertLine('GROSS_MARGIN', 'P&L', periodFY2024, 'PRESENT_NONZERO', '200000');
    await insertLine('CASH', 'BS', periodFY2024, 'PRESENT_NONZERO', '80000');
    await insertLine('CURRENT_ASSETS', 'BS', periodFY2024, 'PRESENT_NONZERO', '220000');
    await insertLine('CURRENT_LIABILITIES', 'BS', periodFY2024, 'PRESENT_NONZERO', '150000');
    // FY2025 — only REVENUE/COGS known so far (rest MISSING or absent)
    await insertLine('REVENUE', 'P&L', periodFY2025, 'PRESENT_NONZERO', '560000');
    await insertLine('COGS', 'P&L', periodFY2025, 'PRESENT_NONZERO', '340000');
    await insertLine('CASH', 'BS', periodFY2025, 'MISSING', null); // explicit MISSING row — the analyst knows this cell should exist but doesn't have it yet
  });

  // =============================================================================
  // PHASE A — export -> simulated offline edit -> preview -> apply, on DRAFT bv1
  // =============================================================================

  const exportResult = await financeExportService.exportFinanceStatementPack({
    organizationId: orgId,
    artifactId,
    businessVersionId: bv1,
    requestedBy: preparerId,
  });
  assert(exportResult.ok === true, 'AP02-T1', 'P0', 'exportFinanceStatementPack succeeds for a DRAFT business version');
  if (!exportResult.ok) return finish();

  assert(exportResult.manifest.rowCount === 9, 'AP02-T2', 'P1', `manifest.rowCount reflects the 9 seeded rows (got ${exportResult.manifest.rowCount})`);
  assert(exportResult.workbookBuffer.length > 0, 'AP02-T3', 'P1', 'exported workbook buffer is non-empty');

  const parsed = await financeImportService.parseFinanceExcelBuffer(exportResult.workbookBuffer, 'goldco_ap02_export.xlsx');
  assert(parsed.manifest !== null, 'AP02-T4', 'P0', 'exported workbook round-trips through parseFinanceExcelBuffer with a readable Manifest sheet');
  assert(parsed.rows.length === 9, 'AP02-T5', 'P1', `parsed Values sheet has 9 rows (got ${parsed.rows.length})`);

  // Simulate an analyst's offline edit pass:
  //   - CHANGE: REVENUE FY2024 500000 -> 512000 (typo fix)
  //   - CLEAR:  CURRENT_LIABILITIES FY2024 150000 -> blank (analyst says "actually don't have this any more")
  //   - keep the explicit MISSING (CASH FY2025) MISSING — must stay MISSING, not become 0
  //   - ADD: GROSS_MARGIN FY2025, CASH FY2025 (fills the previously-missing cell), CURRENT_ASSETS FY2025, CURRENT_LIABILITIES FY2025
  const editedRows = parsed.rows.map((row) => {
    const r: Record<string, unknown> = { ...row };
    if (r['Line Code'] === 'REVENUE' && r['Period Label'] === 'FY2024') {
      r['Value'] = '512000';
      r['Value Status'] = ''; // left blank on purpose — importer must INFER PRESENT_NONZERO from the number, not require the analyst to also set the status column
    }
    if (r['Line Code'] === 'CURRENT_LIABILITIES' && r['Period Label'] === 'FY2024') {
      r['Value'] = '';
      r['Value Status'] = '';
    }
    return r;
  });
  const newRowTemplate = (overrides: Record<string, unknown>) => ({
    'Statement Type': overrides.statementType,
    'Line Code': overrides.lineCode,
    'Line Name': '',
    'Entity Code': 'GOLDCO_PARENT',
    'Entity Name': '',
    'Period Label': 'FY2025',
    'Fiscal Year': 2025,
    'Accumulation Basis': 'FULL_YEAR',
    'Consolidation Scope': 'CONSOLIDATED',
    'Value Status': '',
    Value: overrides.value,
    'Native Currency': 'USD',
    'Presentation Currency': 'USD',
    Unit: 'THOUSANDS',
    Multiplier: '1',
    'Is Adjustment': 'FALSE',
    'Adjustment Reason': '',
    'Cell Key': '',
    __rowNumber: 900 + Number(overrides.seq),
  });
  // CASH FY2025 already exists as an explicit-MISSING row in `editedRows` (seeded
  // that way above) — fill it IN PLACE rather than appending a second row for the
  // same cell (a duplicate-cell row is a real, deliberately-rejected error case;
  // see the `parseFinanceExcelBuffer`+`previewFinanceImport` duplicate-target
  // check exercised by feeding the SAME cell twice further down, not here).
  const editedRowsFilled = editedRows.map((row) => {
    const r: Record<string, unknown> = { ...row };
    if (r['Line Code'] === 'CASH' && r['Period Label'] === 'FY2025') {
      r['Value'] = '91000';
      r['Value Status'] = '';
    }
    return r;
  });
  const newRows = [
    newRowTemplate({ statementType: 'P&L', lineCode: 'GROSS_MARGIN', value: '220000', seq: 1 }),
    newRowTemplate({ statementType: 'BS', lineCode: 'CURRENT_ASSETS', value: '240000', seq: 3 }),
    newRowTemplate({ statementType: 'BS', lineCode: 'CURRENT_LIABILITIES', value: '0', seq: 4 }), // explicit zero — must become PRESENT_ZERO, not MISSING
  ];
  const simulatedReimportRows = [...editedRowsFilled, ...newRows] as any;

  const preview = await financeImportService.previewFinanceImport({
    organizationId: orgId,
    artifactId,
    businessVersionId: bv1,
    manifest: parsed.manifest!,
    rows: simulatedReimportRows,
  });
  assert(preview.rowErrors.length === 0, 'AP02-T6', 'P0', `preview has zero row validation errors (got ${preview.rowErrors.length}: ${JSON.stringify(preview.rowErrors)})`);
  assert(preview.diff.toChange.length === 2, 'AP02-T7', 'P0', `preview detects exactly 2 changes (REVENUE FY2024, CASH FY2025 MISSING->91000) — got ${preview.diff.toChange.length}`);
  assert(preview.diff.toClear.length === 1, 'AP02-T8', 'P0', `preview detects exactly 1 clear (CURRENT_LIABILITIES FY2024) — got ${preview.diff.toClear.length}`);
  assert(preview.diff.toAdd.length === 3, 'AP02-T9', 'P0', `preview detects exactly 3 adds (GROSS_MARGIN/CURRENT_ASSETS/CURRENT_LIABILITIES FY2025) — got ${preview.diff.toAdd.length}`);
  const addedZero = preview.diff.toAdd.find((c) => c.value.status === 'PRESENT_ZERO');
  assert(!!addedZero, 'AP02-T10', 'P0', 'explicit 0 in the Value column resolves to PRESENT_ZERO (never silently MISSING)');
  const clearedRow = preview.diff.toClear[0];
  assert(!!clearedRow, 'AP02-T11', 'P0', 'clear diff entry present for the blanked CURRENT_LIABILITIES cell');

  const applyResult = await financeImportService.applyFinanceImport({
    organizationId: orgId,
    artifactId,
    businessVersionId: bv1,
    expectedWorkingRevisionId: exportResult.manifest.workingRevisionId,
    actorId: preparerId,
    actorRole: 'preparer',
    manifest: parsed.manifest!,
    rows: simulatedReimportRows,
    batchIdempotencyKey: `ap02-apply-${randomUUID()}`,
  });
  assert(applyResult.ok === true, 'AP02-T12', 'P0', `applyFinanceImport succeeds on DRAFT (got: ${JSON.stringify(applyResult)})`);
  if (applyResult.ok) {
    assert(applyResult.appliedCount.added === 3 && applyResult.appliedCount.changed === 2 && applyResult.appliedCount.cleared === 1, 'AP02-T13', 'P0', `appliedCount matches diff (got ${JSON.stringify(applyResult.appliedCount)})`);
  }

  // Re-read from DB to prove the transactional apply actually landed.
  const postApplyRows = await withPinnedPostgresTransaction((tx: Tx) =>
    tx.queryAll(
      `SELECT csl.line_code, fsp.label AS period_label, fsl.value_status, fsl.value_decimal::text AS value_decimal
         FROM finance_stmt_lines fsl
         JOIN financial_statement_lines csl ON csl.id = fsl.canonical_line_id
         JOIN finance_stmt_periods fsp ON fsp.period_id = fsl.period_id
        WHERE fsl.business_version_id = ?`,
      [bv1]
    )
  );
  const byKey = new Map((postApplyRows as any[]).map((r) => [`${r.line_code}|${r.period_label}`, r]));
  const revenue2024 = byKey.get('REVENUE|FY2024');
  assert(revenue2024?.value_decimal === '512000', 'AP02-T14', 'P0', `REVENUE FY2024 updated to 512000 in DB (got ${revenue2024?.value_decimal})`);
  const curLiab2024 = byKey.get('CURRENT_LIABILITIES|FY2024');
  assert(curLiab2024?.value_status === 'MISSING' && curLiab2024?.value_decimal === null, 'AP02-T15', 'P0', `CURRENT_LIABILITIES FY2024 cleared to MISSING, not 0 (got status=${curLiab2024?.value_status} value=${curLiab2024?.value_decimal})`);
  const cash2025 = byKey.get('CASH|FY2025');
  assert(cash2025?.value_decimal === '91000', 'AP02-T16', 'P0', `CASH FY2025 (previously MISSING) now 91000 (got ${cash2025?.value_decimal})`);
  const curLiab2025 = byKey.get('CURRENT_LIABILITIES|FY2025');
  assert(curLiab2025?.value_status === 'PRESENT_ZERO' && curLiab2025?.value_decimal === '0', 'AP02-T17', 'P0', `new CURRENT_LIABILITIES FY2025 is PRESENT_ZERO/0, never silently MISSING (got status=${curLiab2025?.value_status} value=${curLiab2025?.value_decimal})`);

  // Idempotency replay: re-applying the SAME batchIdempotencyKey must be a no-op replay, not a double-apply.
  const replayResult = await financeImportService.applyFinanceImport({
    organizationId: orgId,
    artifactId,
    businessVersionId: bv1,
    expectedWorkingRevisionId: applyResult.ok ? applyResult.newWorkingRevisionId : exportResult.manifest.workingRevisionId,
    actorId: preparerId,
    actorRole: 'preparer',
    manifest: parsed.manifest!,
    rows: simulatedReimportRows,
    batchIdempotencyKey: applyResult.ok ? (await withPinnedPostgresTransaction((tx: Tx) => tx.queryOne(`SELECT checkpoint_payload->>'batchIdempotencyKey' AS k FROM finance_working_revisions WHERE working_revision_id = ?`, [applyResult.newWorkingRevisionId]))).k : 'n/a',
  });
  assert(replayResult.ok === true && (replayResult as any).idempotentReplay === true, 'AP02-T18', 'P1', `re-applying the same batchIdempotencyKey replays idempotently (got ${JSON.stringify(replayResult)})`);

  // =============================================================================
  // PHASE B — Approved-immutability guard
  // =============================================================================
  // Force bv1 to APPROVED via direct SQL — this test does not exercise the full
  // readiness/reconciliation ceremony `approveVersion()` requires (out of AP-02's
  // scope; see GOLDCO_FULL_DAG_END_TO_END_REPORT.md for that). Only the IMPORT
  // guard's reaction to an Approved status is under test here. The DB itself
  // still enforces `finance_bv_enforce_immutability()`'s "no APPROVED without a
  // compute_snapshot_id" invariant (Gate A finding) — a minimal snapshot row is
  // required even for this direct-SQL shortcut, which is itself a useful signal
  // that the guard is a real, physically-enforced invariant, not just an
  // application convention this file could have bypassed.
  const approvedBv = await withPinnedPostgresTransaction(async (tx: Tx) => {
    const wr = await tx.queryOne(`SELECT working_revision_id FROM finance_working_revisions WHERE artifact_id = ? AND is_current = true`, [artifactId]);
    const manifestRow = await tx.queryOne(`SELECT engine_manifest_id FROM finance_business_versions WHERE business_version_id = ?`, [bv1]);
    const snapshot = await tx.queryOne(
      `INSERT INTO finance_compute_snapshots (artifact_id, organization_id, working_revision_id, engine_manifest_id, as_of, created_by)
       VALUES (?, ?, ?, ?, now(), ?) RETURNING compute_snapshot_id`,
      [artifactId, orgId, wr.working_revision_id, manifestRow.engine_manifest_id, preparerId]
    );
    const row = await tx.queryOne(
      `UPDATE finance_business_versions SET status = 'APPROVED', compute_snapshot_id = ?, version = version + 1 WHERE business_version_id = ? RETURNING version`,
      [snapshot.compute_snapshot_id, bv1]
    );
    return row;
  });

  const preApprovedRows = await withPinnedPostgresTransaction((tx: Tx) => tx.queryAll(`SELECT id, value_status, value_decimal::text AS value_decimal FROM finance_stmt_lines WHERE business_version_id = ? ORDER BY id`, [bv1]));

  const rejectedImport = await financeImportService.applyFinanceImport({
    organizationId: orgId,
    artifactId,
    businessVersionId: bv1,
    expectedWorkingRevisionId: applyResult.ok ? applyResult.newWorkingRevisionId : '',
    actorId: preparerId,
    actorRole: 'preparer',
    manifest: parsed.manifest!,
    rows: simulatedReimportRows,
    batchIdempotencyKey: `ap02-rejected-${randomUUID()}`,
  });
  assert(rejectedImport.ok === false && (rejectedImport as any).code === 'STATE_PRECONDITION_FAILED' && (rejectedImport as any).reopenRequired === true, 'AP02-T19', 'P0', `import on APPROVED without reopen is rejected (got ${JSON.stringify(rejectedImport)})`);

  const reopenedImport = await financeImportService.applyFinanceImport({
    organizationId: orgId,
    artifactId,
    businessVersionId: bv1,
    expectedWorkingRevisionId: applyResult.ok ? applyResult.newWorkingRevisionId : '',
    actorId: approverId,
    actorRole: 'approver',
    manifest: parsed.manifest!,
    rows: simulatedReimportRows.map((r: any) => (r['Line Code'] === 'REVENUE' && r['Period Label'] === 'FY2024' ? { ...r, Value: '999999', 'Value Status': '' } : r)),
    batchIdempotencyKey: `ap02-reopen-import-${randomUUID()}`,
    reopen: { reason: 'AP-02 test: re-import after approval requires reopen', expectedVersion: approvedBv.version },
  });
  assert(reopenedImport.ok === true && (reopenedImport as any).reopened === true, 'AP02-T20', 'P0', `import on APPROVED WITH reopen succeeds against a new draft (got ${JSON.stringify(reopenedImport)})`);
  if (reopenedImport.ok) {
    assert((reopenedImport as any).businessVersionId !== bv1, 'AP02-T21', 'P0', 'reopen produced a NEW business_version_id, distinct from the Approved bv1');
  }

  const postApprovedRows = await withPinnedPostgresTransaction((tx: Tx) => tx.queryAll(`SELECT id, value_status, value_decimal::text AS value_decimal FROM finance_stmt_lines WHERE business_version_id = ? ORDER BY id`, [bv1]));
  assert(JSON.stringify(preApprovedRows) === JSON.stringify(postApprovedRows), 'AP02-T22', 'P0', 'Approved bv1 finance_stmt_lines rows are BYTE-IDENTICAL before/after the reopen+import (immutability upheld)');

  if (reopenedImport.ok) {
    const newBvRows = await withPinnedPostgresTransaction((tx: Tx) =>
      tx.queryAll(
        `SELECT csl.line_code, fsl.value_decimal::text AS value_decimal
           FROM finance_stmt_lines fsl JOIN financial_statement_lines csl ON csl.id = fsl.canonical_line_id
          WHERE fsl.business_version_id = ? AND csl.line_code = 'REVENUE'`,
        [(reopenedImport as any).businessVersionId]
      )
    );
    const newRevenue = (newBvRows as any[]).find((r) => r.value_decimal === '999999');
    assert(!!newRevenue, 'AP02-T23', 'P0', 'the NEW draft (post-reopen) carries the re-imported value, the Approved parent does not');
  }

  finish();

  function finish() {
    console.log('\n=== AP-02 round-trip summary ===');
    console.log(`Total assertions: (see PASS/FAIL lines above)`);
    console.log(`Bugs found: ${bugs.length}`);
    for (const b of bugs) console.log(`  [${b.severity}] ${b.id}: ${b.summary}`);
    if (bugs.length > 0) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
