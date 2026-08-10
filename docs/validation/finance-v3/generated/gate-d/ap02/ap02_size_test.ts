#!/usr/bin/env tsx
/**
 * AP-02 — 5k x 60 (300k-cell) size test, entirely IN MEMORY — no Postgres,
 * no real `.xlsx` file on disk beyond what `exceljs` builds in a `Buffer`.
 *
 * Task instruction, verbatim: "symuluj 5k×60 (300k komorek) eksport+import w
 * pamieci (nie musi byc realny plik binarny .xlsx jesli uzywasz CSV+JSON),
 * zmierz czas, potwierdz rozsadny budzet". Since AP-02 DID choose real
 * `.xlsx` via `exceljs` (see AP-02_excel_roundtrip_report.md section 1), this
 * script measures the REAL `.xlsx` write/read path (not a CSV+JSON stand-in)
 * — a strictly harder, more representative number than the CSV+JSON floor
 * the task offered as a fallback.
 *
 * Shape: 5,000 (entity x canonical-line) row-combinations x 60 periods =
 * 300,000 Values-sheet ROWS (one row per cell, matching `finance_stmt_lines`'
 * own long/tidy shape — NOT a 5000x60 wide spreadsheet matrix). 300,000 rows
 * x 18 columns = 5,400,000 physical Excel cells actually written/read,
 * strictly more work than a bare 300k-cell count would suggest.
 *
 * Measures FOUR phases separately (each is a distinct real cost an analyst's
 * click would pay):
 *   1. Workbook BUILD + WRITE  (`exceljs` — `addValuesSheet` equivalent, `xlsx.writeBuffer()`)
 *   2. Workbook PARSE + READ   (`parseFinanceExcelBuffer` — the real import-side reader)
 *   3. DIFF (resolve + classify) — `computeFinanceImportDiffPure`, the exact
 *      hot-path `applyFinanceImport` runs under a DB transaction, exercised
 *      here against synthetic in-memory `Map` lookups (no DB call at all).
 *   4. End-to-end total.
 *
 * Run: npx tsx docs/validation/finance-v3/generated/gate-d/ap02/ap02_size_test.ts
 */
import { performance } from 'node:perf_hooks';

async function main() {
  const financeExcelShared = await import('../../../../../../server/src/services/finance/canonical/financeExcelShared.js');
  const financeImportService = await import('../../../../../../server/src/services/finance/canonical/financeImportService.js');
  const ExcelJS = (await import('exceljs')).default;

  const ENTITY_COUNT = 50;
  const LINE_COUNT = 100; // 50 x 100 = 5,000 row-combinations
  const PERIOD_COUNT = 60;
  const TOTAL_CELLS = ENTITY_COUNT * LINE_COUNT * PERIOD_COUNT;
  console.log(`AP-02 size test: ${ENTITY_COUNT} entities x ${LINE_COUNT} lines x ${PERIOD_COUNT} periods = ${TOTAL_CELLS.toLocaleString()} cells`);

  // --- Synthetic taxonomy (in-memory Maps, no DB) -----------------------------
  const organizationId = 'org-ap02-sizetest';
  const businessVersionId = 'bv-ap02-sizetest';

  const entityByCode = new Map<string, { id: string }>();
  for (let e = 0; e < ENTITY_COUNT; e++) entityByCode.set(`ENT${e}`, { id: `entity-${e}` });

  const periodByLabel = new Map<string, { period_id: string }>();
  for (let p = 0; p < PERIOD_COUNT; p++) periodByLabel.set(`P${p}`, { period_id: `period-${p}` });

  const lineByKey = new Map<string, { id: string; statement_type: string }>();
  for (let l = 0; l < LINE_COUNT; l++) lineByKey.set(`P&L|LINE${l}`, { id: `line-${l}`, statement_type: 'P&L' });

  const lookups = { entityByCode, periodByLabel, lineByKey };
  const current = new Map(); // empty — every resolved cell classifies as "add" (worst case for diff-building cost)

  // --- Phase 1: build 300k synthetic rows + write a real .xlsx workbook ------
  const t0 = performance.now();
  const rows: any[] = [];
  for (let e = 0; e < ENTITY_COUNT; e++) {
    for (let l = 0; l < LINE_COUNT; l++) {
      for (let p = 0; p < PERIOD_COUNT; p++) {
        rows.push({
          statementType: 'P&L',
          lineCode: `LINE${l}`,
          lineName: `Synthetic Line ${l}`,
          entityCode: `ENT${e}`,
          entityName: `Synthetic Entity ${e}`,
          periodLabel: `P${p}`,
          fiscalYear: 2020 + (p % 6),
          accumulationBasis: 'FULL_YEAR',
          consolidationScope: 'CONSOLIDATED',
          valueStatus: 'PRESENT_NONZERO',
          valueDecimal: String(1000 + e * 37 + l * 11 + p),
          nativeCurrency: 'USD',
          presentationCurrency: 'USD',
          unit: 'THOUSANDS',
          multiplier: '1',
          isAdjustment: false,
          adjustmentReason: null,
          cellKey: `synthetic-${e}-${l}-${p}`,
        });
      }
    }
  }
  const t1 = performance.now();
  console.log(`  row generation:        ${(t1 - t0).toFixed(0)} ms for ${rows.length.toLocaleString()} rows`);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(financeExcelShared.FINANCE_EXCEL_SHEET_NAMES.values);
  sheet.columns = financeExcelShared.FINANCE_EXCEL_VALUE_COLUMNS.map((header: string) => ({ header, key: header, width: 18 }));
  for (const row of rows) {
    sheet.addRow({
      ...financeExcelShared.financeExcelRowToCells(row),
      'Is Adjustment': financeExcelShared.formatBooleanCell(row.isAdjustment),
    });
  }
  const t2 = performance.now();
  console.log(`  workbook build (rows):  ${(t2 - t1).toFixed(0)} ms`);

  const buffer = Buffer.from((await workbook.xlsx.writeBuffer()) as unknown as ArrayBuffer);
  const t3 = performance.now();
  console.log(`  workbook write (xlsx):  ${(t3 - t2).toFixed(0)} ms  (buffer size: ${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`  PHASE 1 (build+write) TOTAL: ${(t3 - t0).toFixed(0)} ms`);

  // --- Phase 2: parse the .xlsx buffer back into rows -------------------------
  const t4 = performance.now();
  const parsed = await financeImportService.parseFinanceExcelBuffer(buffer, 'ap02_sizetest.xlsx');
  const t5 = performance.now();
  console.log(`  PHASE 2 (parse) TOTAL:       ${(t5 - t4).toFixed(0)} ms  (parsed ${parsed.rows.length.toLocaleString()} rows)`);
  if (parsed.rows.length !== rows.length) {
    console.error(`  MISMATCH: expected ${rows.length} parsed rows, got ${parsed.rows.length}`);
    process.exitCode = 1;
  }

  // Reshape parsed rows into the header-keyed RawImportRow shape resolveImportRow expects
  // (parseFinanceExcelBuffer already returns exactly that shape for a real Values sheet —
  // this line only re-labels the type for computeFinanceImportDiffPure's signature).
  const rawRows = parsed.rows;

  // --- Phase 3: diff (resolve + classify), the exact applyFinanceImport hot path
  const t6 = performance.now();
  const diffResult = financeImportService.computeFinanceImportDiffPure(organizationId, businessVersionId, rawRows, lookups as any, current as any);
  const t7 = performance.now();
  console.log(`  PHASE 3 (diff/resolve) TOTAL: ${(t7 - t6).toFixed(0)} ms`);
  console.log(`    rowErrors: ${diffResult.rowErrors.length}, toAdd: ${diffResult.diff.toAdd.length.toLocaleString()}, toChange: ${diffResult.diff.toChange.length}, toClear: ${diffResult.diff.toClear.length}, unchanged: ${diffResult.diff.unchangedCount}`);
  if (diffResult.rowErrors.length > 0) {
    console.error(`  FIRST ROW ERROR: ${JSON.stringify(diffResult.rowErrors[0])}`);
  }
  if (diffResult.diff.toAdd.length !== TOTAL_CELLS) {
    console.error(`  MISMATCH: expected ${TOTAL_CELLS} toAdd, got ${diffResult.diff.toAdd.length}`);
    process.exitCode = 1;
  }

  const totalMs = t7 - t0;
  console.log(`\n=== TOTAL end-to-end (build -> write -> parse -> diff): ${totalMs.toFixed(0)} ms (${(totalMs / 1000).toFixed(1)} s) for ${TOTAL_CELLS.toLocaleString()} cells ===`);
  console.log(`Per-cell average: ${((totalMs / TOTAL_CELLS) * 1000).toFixed(2)} microseconds/cell`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
