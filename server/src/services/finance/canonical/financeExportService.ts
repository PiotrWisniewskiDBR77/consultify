/**
 * AP-02 — FinanceExportService: exports one `finance_business_version`'s
 * Statement Pack content (`finance_stmt_lines`) to a real `.xlsx` workbook.
 *
 * Program: `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md`
 * section 3 point 2. Report: `docs/validation/finance-v3/generated/gate-d/AP-02_excel_roundtrip_report.md`.
 * Schema: `server/migrations/20260809_finance_v3_d01_statements_01_tables.sql`
 * (`finance_stmt_lines`, `finance_stmt_entities`, `finance_stmt_periods`),
 * `server/migrations/20260809_finance_v3_d03_analysis_01_tables.sql`
 * (`finance_analysis_kpi_catalog`, formula reference sheet).
 *
 * Four sheets, always in this order: `Manifest` (key/value pairs — task
 * requirement "manifest version/unit/source"), `Values` (current
 * `finance_stmt_lines` rows for the requested business version), `Formulas`
 * (Analysis KPI catalog, formula AST rendered readable — see
 * `financeExcelShared.ts` `renderFormulaNode`), `Template` (Values' own
 * header row, zero data rows — task requirement "szablon... zgodny z
 * canonical taxonomy").
 *
 * WHY `withPinnedPostgresTransaction` for a read-only export: same
 * conventions as every other canonical service in this program
 * (`artifactVersionService.ts` header) — `DbPromise`'s `fallback: true`
 * default would turn a real query failure into an export that silently
 * claims "zero rows" instead of failing loud.
 */

import { v4 as uuidv4 } from 'uuid';
import ExcelJS from 'exceljs';

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import { financeStmtLinesCellRef, cellRefKey } from '../../../types/finance/CellRef.js';
import type { FinanceArtifactType } from './lifecycleService.js';
import type { FormulaNode } from './formulaAstEvaluator.js';
import {
  FINANCE_EXCEL_MANIFEST_SOURCE,
  FINANCE_EXCEL_MANIFEST_VERSION,
  FINANCE_EXCEL_SHEET_NAMES,
  FINANCE_EXCEL_VALUE_COLUMNS,
  financeExcelRowToCells,
  formatBooleanCell,
  renderFormulaNode,
  type FinanceExcelManifest,
  type FinanceExcelValueRow,
} from './financeExcelShared.js';

// ---------------------------------------------------------------------------
// Row shapes read straight off the DB (raw, snake_case) before projection.
// ---------------------------------------------------------------------------

interface StmtLineExportRawRow {
  statement_type: 'P&L' | 'BS' | 'CF';
  canonical_line_id: string;
  line_code: string;
  line_name: string;
  entity_id: string;
  entity_code: string;
  legal_name: string;
  period_id: string;
  period_label: string;
  fiscal_year: number;
  accumulation_basis: FinanceExcelValueRow['accumulationBasis'];
  consolidation_scope: FinanceExcelValueRow['consolidationScope'];
  value_status: FinanceExcelValueRow['valueStatus'];
  value_decimal: string | null;
  native_currency: string;
  presentation_currency: string;
  unit: FinanceExcelValueRow['unit'];
  multiplier: string;
  is_adjustment: boolean;
  adjustment_reason: string | null;
}

interface KpiCatalogRawRow {
  kpi_code: string;
  kpi_name: string;
  category: string;
  unit_type: string;
  formula_ast: FormulaNode;
  required_canonical_line_codes: string[];
}

export type ExportFinanceStatementPackErrorCode = 'NOT_FOUND' | 'WRONG_ARTIFACT_TYPE';

export interface ExportFinanceStatementPackParams {
  organizationId: string;
  artifactId: string;
  businessVersionId: string;
  requestedBy: string;
}

export type ExportFinanceStatementPackResult =
  | { ok: true; manifest: FinanceExcelManifest; workbookBuffer: Buffer }
  | { ok: false; code: ExportFinanceStatementPackErrorCode; message: string };

/** Pure projection, exported separately so `financeImportService.ts`'s diff logic (and tests) can build the exact same shape without re-running the export's SQL. `organizationId`/`businessVersionId` scope the `cellKey` column identically to how the importer recomputes it from its own resolved `CellRef` — both sides must agree for the "Cell Key" staleness cross-check to mean anything. */
export function toFinanceExcelValueRow(
  raw: StmtLineExportRawRow,
  organizationId: string,
  businessVersionId: string
): FinanceExcelValueRow {
  const ref = financeStmtLinesCellRef({
    organizationId,
    businessVersionId,
    entityId: raw.entity_id,
    canonicalLineId: raw.canonical_line_id,
    consolidationScope: raw.consolidation_scope,
    periodId: raw.period_id,
    accumulationBasis: raw.accumulation_basis,
  });
  return {
    statementType: raw.statement_type,
    lineCode: raw.line_code,
    lineName: raw.line_name,
    entityCode: raw.entity_code,
    entityName: raw.legal_name,
    periodLabel: raw.period_label,
    fiscalYear: raw.fiscal_year,
    accumulationBasis: raw.accumulation_basis,
    consolidationScope: raw.consolidation_scope,
    valueStatus: raw.value_status,
    valueDecimal: raw.value_decimal,
    nativeCurrency: raw.native_currency,
    presentationCurrency: raw.presentation_currency,
    unit: raw.unit,
    multiplier: raw.multiplier,
    isAdjustment: raw.is_adjustment,
    adjustmentReason: raw.adjustment_reason,
    cellKey: cellRefKey(ref),
  };
}

async function buildManifestAndRows(params: ExportFinanceStatementPackParams): Promise<
  | { ok: true; manifest: FinanceExcelManifest; rows: FinanceExcelValueRow[]; kpiRows: KpiCatalogRawRow[] }
  | { ok: false; code: ExportFinanceStatementPackErrorCode; message: string }
> {
  return withPinnedPostgresTransaction(async (tx) => {
    const artifact = await tx.queryOne<{ artifact_id: string; artifact_type: FinanceArtifactType }>(
      `SELECT artifact_id, artifact_type FROM finance_artifacts WHERE artifact_id = ? AND organization_id = ?`,
      [params.artifactId, params.organizationId]
    );
    if (!artifact) return { ok: false, code: 'NOT_FOUND', message: 'Artifact not found' };
    if (artifact.artifact_type !== 'STATEMENT_PACK') {
      return {
        ok: false,
        code: 'WRONG_ARTIFACT_TYPE',
        message: `financeExportService only exports STATEMENT_PACK artifacts today (got ${artifact.artifact_type})`,
      };
    }

    const businessVersion = await tx.queryOne<{
      business_version_id: string;
      status: FinanceExcelManifest['businessVersionStatus'];
      version_no: number;
      version: number;
    }>(
      `SELECT business_version_id, status, version_no, version FROM finance_business_versions
        WHERE business_version_id = ? AND organization_id = ? AND artifact_id = ?`,
      [params.businessVersionId, params.organizationId, params.artifactId]
    );
    if (!businessVersion) return { ok: false, code: 'NOT_FOUND', message: 'Business version not found for this artifact' };

    const workingRevision = await tx.queryOne<{ working_revision_id: string }>(
      `SELECT working_revision_id FROM finance_working_revisions
        WHERE business_version_id = ? AND organization_id = ?
        ORDER BY revision_seq DESC LIMIT 1`,
      [params.businessVersionId, params.organizationId]
    );

    const rawRows = await tx.queryAll<StmtLineExportRawRow>(
      `SELECT
         fsl.statement_type, fsl.canonical_line_id, csl.line_code, csl.line_name,
         fsl.entity_id, fse.entity_code, fse.legal_name,
         fsl.period_id, fsp.label AS period_label, fsp.fiscal_year,
         fsl.accumulation_basis, fsl.consolidation_scope,
         fsl.value_status, fsl.value_decimal::text AS value_decimal,
         fsl.native_currency, fsl.presentation_currency, fsl.unit, fsl.multiplier::text AS multiplier,
         fsl.is_adjustment, fsl.adjustment_reason
       FROM finance_stmt_lines fsl
       JOIN financial_statement_lines csl ON csl.id = fsl.canonical_line_id
       JOIN finance_stmt_entities fse ON fse.id = fsl.entity_id
       JOIN finance_stmt_periods fsp ON fsp.period_id = fsl.period_id
       WHERE fsl.business_version_id = ? AND fsl.organization_id = ?
       ORDER BY csl.sort_order ASC, csl.line_code ASC, fse.entity_code ASC, fsp.fiscal_year ASC, fsp.period_start ASC`,
      [params.businessVersionId, params.organizationId]
    );

    const kpiRows = await tx.queryAll<KpiCatalogRawRow>(
      `SELECT kpi_code, kpi_name, category, unit_type, formula_ast, required_canonical_line_codes
         FROM finance_analysis_kpi_catalog
        WHERE status = 'ACTIVE' AND (tier = 'UNIVERSAL' OR organization_id = ?)
        ORDER BY category ASC, kpi_code ASC`,
      [params.organizationId]
    );

    const rows = rawRows.map((raw) => toFinanceExcelValueRow(raw, params.organizationId, params.businessVersionId));

    // Default unit/currency for the manifest: the mode across exported rows
    // (task requirement "manifest version/unit/source" — a single
    // display-convenience default, NOT a claim that every row shares it;
    // every row still carries its own authoritative unit/currency columns).
    const unitCounts = new Map<string, number>();
    const currencyCounts = new Map<string, number>();
    for (const row of rows) {
      unitCounts.set(row.unit, (unitCounts.get(row.unit) ?? 0) + 1);
      currencyCounts.set(row.presentationCurrency, (currencyCounts.get(row.presentationCurrency) ?? 0) + 1);
    }
    const mostCommon = <T extends string>(counts: Map<string, number>, fallback: T): T =>
      ([...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] as T) ?? fallback;

    const manifest: FinanceExcelManifest = {
      manifestVersion: FINANCE_EXCEL_MANIFEST_VERSION,
      source: FINANCE_EXCEL_MANIFEST_SOURCE,
      exportId: uuidv4(),
      organizationId: params.organizationId,
      artifactId: params.artifactId,
      artifactType: artifact.artifact_type,
      businessVersionId: businessVersion.business_version_id,
      businessVersionStatus: businessVersion.status,
      businessVersionNo: businessVersion.version_no,
      businessVersionCasVersion: businessVersion.version,
      workingRevisionId: workingRevision?.working_revision_id ?? '',
      asOf: new Date().toISOString(),
      defaultUnit: mostCommon(unitCounts, 'UNITS'),
      defaultPresentationCurrency: mostCommon(currencyCounts, 'USD'),
      rowCount: rows.length,
    };

    return { ok: true, manifest, rows, kpiRows };
  });
}

function addManifestSheet(workbook: ExcelJS.Workbook, manifest: FinanceExcelManifest): void {
  const sheet = workbook.addWorksheet(FINANCE_EXCEL_SHEET_NAMES.manifest);
  sheet.columns = [
    { header: 'Field', key: 'field', width: 28 },
    { header: 'Value', key: 'value', width: 60 },
  ];
  for (const [field, value] of Object.entries(manifest)) {
    sheet.addRow({ field, value: String(value) });
  }
  sheet.getRow(1).font = { bold: true };
}

function addValuesSheet(workbook: ExcelJS.Workbook, sheetName: string, rows: FinanceExcelValueRow[]): void {
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = FINANCE_EXCEL_VALUE_COLUMNS.map((header) => ({ header, key: header, width: 18 }));
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    const cells = financeExcelRowToCells(row);
    sheet.addRow({
      ...cells,
      'Is Adjustment': formatBooleanCell(row.isAdjustment),
    });
  }
}

function addFormulasSheet(workbook: ExcelJS.Workbook, kpiRows: KpiCatalogRawRow[]): void {
  const sheet = workbook.addWorksheet(FINANCE_EXCEL_SHEET_NAMES.formulas);
  sheet.columns = [
    { header: 'KPI Code', key: 'kpiCode', width: 22 },
    { header: 'KPI Name', key: 'kpiName', width: 28 },
    { header: 'Category', key: 'category', width: 16 },
    { header: 'Unit Type', key: 'unitType', width: 12 },
    { header: 'Formula', key: 'formula', width: 60 },
    { header: 'Required Lines', key: 'requiredLines', width: 40 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const kpi of kpiRows) {
    sheet.addRow({
      kpiCode: kpi.kpi_code,
      kpiName: kpi.kpi_name,
      category: kpi.category,
      unitType: kpi.unit_type,
      formula: renderFormulaNode(kpi.formula_ast),
      requiredLines: kpi.required_canonical_line_codes.join(', '),
    });
  }
}

export async function exportFinanceStatementPack(
  params: ExportFinanceStatementPackParams
): Promise<ExportFinanceStatementPackResult> {
  const built = await buildManifestAndRows(params);
  if (!built.ok) return built;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Consultify Finance v3 (AP-02)';
  workbook.created = new Date();

  addManifestSheet(workbook, built.manifest);
  addValuesSheet(workbook, FINANCE_EXCEL_SHEET_NAMES.values, built.rows);
  addFormulasSheet(workbook, built.kpiRows);
  addValuesSheet(workbook, FINANCE_EXCEL_SHEET_NAMES.template, []); // empty template, headers only

  const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  return { ok: true, manifest: built.manifest, workbookBuffer: Buffer.from(buffer) };
}
