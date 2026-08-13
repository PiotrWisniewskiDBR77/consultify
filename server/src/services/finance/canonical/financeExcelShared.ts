/**
 * AP-02 — Excel/CSV round-trip: shared manifest/row schema between
 * `financeExportService.ts` and `financeImportService.ts`.
 *
 * Program: `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md`
 * section 3 point 2 ("Excel/CSV round-trip: szablon, eksport wartości i
 * formuł, preview diff, mapping, validation, transactional reimport oraz
 * manifest version/unit/source"). Report:
 * `docs/validation/finance-v3/generated/gate-d/AP-02_excel_roundtrip_report.md`.
 *
 * FORMAT DECISION (see the report's section 1 for the full rationale):
 * real `.xlsx` via `exceljs` (already a repo dependency —
 * `server/src/services/workbook/WorkbookBuilder.ts`,
 * `server/src/services/workbook/workbookImport.ts` — not a from-scratch
 * binary parser), with `.csv` supported for the single-sheet "Values" case.
 * The workbook always carries FOUR sheets: `Manifest` (key/value), `Values`
 * (current data), `Formulas` (Analysis KPI reference, human-readable), and
 * `Template` (blank headers only, canonical taxonomy column order).
 *
 * "MISSING never becomes zero" (master plan section 2.4 / `financeValueSemantics.ts`
 * doctrine, restated for the spreadsheet boundary): a truly blank cell in the
 * `Value`/`Value Status` pair always parses to `MISSING`, never `PRESENT_ZERO`.
 * An explicit `0` in the `Value` column parses to `PRESENT_ZERO`. There is no
 * code path that turns "cell was empty" into `valueDecimal: '0'`.
 */

import {
  FinanceAccumulationBasisValues,
  FinanceConsolidationScopeValues,
  type FinanceAccumulationBasis,
  type FinanceConsolidationScope,
} from '../../../types/finance/CellRef.js';
import {
  FinanceUnitValues,
  FinanceValueStatusValues,
  type FinanceUnit,
  type FinanceValueStatus,
} from '../../../types/finance/financeValueSemantics.js';
import type { FinanceArtifactType } from './lifecycleService.js';
import type { BusinessVersionStatus } from './lifecycleService.js';
import type { FormulaNode } from './formulaAstEvaluator.js';

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

export const FINANCE_EXCEL_MANIFEST_SOURCE = 'consultify-finance-v3-ap02' as const;
export const FINANCE_EXCEL_MANIFEST_VERSION = 1 as const;

/**
 * Round-trip identity + governance fields (task requirement: "manifest
 * version/unit/source"). `businessVersionCasVersion` is
 * `finance_business_versions.version` (the optimistic-concurrency integer —
 * see `artifactVersionService.ts` `transition()`/`reopenVersion()`), NOT
 * `version_no` (the human-facing v1/v2/v3 sequence) — re-import needs the
 * CAS integer if a reopen becomes necessary (`ReopenVersionParams.expectedVersion`).
 */
export interface FinanceExcelManifest {
  manifestVersion: typeof FINANCE_EXCEL_MANIFEST_VERSION;
  source: typeof FINANCE_EXCEL_MANIFEST_SOURCE;
  exportId: string;
  organizationId: string;
  artifactId: string;
  artifactType: FinanceArtifactType;
  businessVersionId: string;
  businessVersionStatus: BusinessVersionStatus;
  businessVersionNo: number;
  businessVersionCasVersion: number;
  workingRevisionId: string;
  asOf: string;
  defaultUnit: FinanceUnit;
  defaultPresentationCurrency: string;
  rowCount: number;
}

export const FINANCE_EXCEL_MANIFEST_FIELD_ORDER: readonly (keyof FinanceExcelManifest)[] = [
  'manifestVersion',
  'source',
  'exportId',
  'organizationId',
  'artifactId',
  'artifactType',
  'businessVersionId',
  'businessVersionStatus',
  'businessVersionNo',
  'businessVersionCasVersion',
  'workingRevisionId',
  'asOf',
  'defaultUnit',
  'defaultPresentationCurrency',
  'rowCount',
];

export interface FinanceExcelManifestCheck {
  ok: boolean;
  issues: string[];
}

/** Structural compatibility check between a re-imported manifest and the live target — NOT a byte-equality check (e.g. `rowCount`/`asOf` are expected to differ once the file has been edited offline). */
export function checkManifestCompatibility(
  manifest: Pick<FinanceExcelManifest, 'source' | 'manifestVersion' | 'organizationId' | 'artifactId'>,
  target: { organizationId: string; artifactId: string }
): FinanceExcelManifestCheck {
  const issues: string[] = [];
  if (manifest.source !== FINANCE_EXCEL_MANIFEST_SOURCE) {
    issues.push(`Manifest source '${manifest.source}' is not a recognized Finance v3 export (expected '${FINANCE_EXCEL_MANIFEST_SOURCE}')`);
  }
  if (manifest.manifestVersion !== FINANCE_EXCEL_MANIFEST_VERSION) {
    issues.push(`Manifest version ${manifest.manifestVersion} is not supported (expected ${FINANCE_EXCEL_MANIFEST_VERSION})`);
  }
  if (manifest.organizationId !== target.organizationId) {
    issues.push(`Manifest organizationId '${manifest.organizationId}' does not match target organizationId '${target.organizationId}'`);
  }
  if (manifest.artifactId !== target.artifactId) {
    issues.push(`Manifest artifactId '${manifest.artifactId}' does not match target artifactId '${target.artifactId}'`);
  }
  return { ok: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
// Sheet names
// ---------------------------------------------------------------------------

export const FINANCE_EXCEL_SHEET_NAMES = {
  manifest: 'Manifest',
  values: 'Values',
  formulas: 'Formulas',
  template: 'Template',
} as const;

// ---------------------------------------------------------------------------
// Values / Template column schema — single source of truth for both the
// export writer and the import reader (header text is matched by name, not
// position, so a re-ordered/re-saved Excel file still round-trips).
// ---------------------------------------------------------------------------

export const FINANCE_EXCEL_VALUE_COLUMNS = [
  'Statement Type',
  'Line Code',
  'Line Name',
  'Entity Code',
  'Entity Name',
  'Period Label',
  'Fiscal Year',
  'Accumulation Basis',
  'Consolidation Scope',
  'Value Status',
  'Value',
  'Native Currency',
  'Presentation Currency',
  'Unit',
  'Multiplier',
  'Is Adjustment',
  'Adjustment Reason',
  'Cell Key',
] as const;
export type FinanceExcelValueColumn = (typeof FINANCE_EXCEL_VALUE_COLUMNS)[number];

/** Columns that are informational only (ignored by the importer's mapping logic; present for analyst readability / grep-ability, and cross-checked opportunistically). */
export const FINANCE_EXCEL_INFO_ONLY_COLUMNS: ReadonlySet<FinanceExcelValueColumn> = new Set([
  'Line Name',
  'Entity Name',
  'Fiscal Year',
  'Cell Key',
]);

export interface FinanceExcelValueRow {
  statementType: 'P&L' | 'BS' | 'CF';
  lineCode: string;
  lineName: string;
  entityCode: string;
  entityName: string;
  periodLabel: string;
  fiscalYear: number;
  accumulationBasis: FinanceAccumulationBasis;
  consolidationScope: FinanceConsolidationScope;
  valueStatus: FinanceValueStatus;
  valueDecimal: string | null;
  nativeCurrency: string;
  presentationCurrency: string;
  unit: FinanceUnit;
  multiplier: string;
  isAdjustment: boolean;
  adjustmentReason: string | null;
  cellKey: string;
}

export function financeExcelRowToCells(row: FinanceExcelValueRow): Record<FinanceExcelValueColumn, string | number | boolean | null> {
  return {
    'Statement Type': row.statementType,
    'Line Code': row.lineCode,
    'Line Name': row.lineName,
    'Entity Code': row.entityCode,
    'Entity Name': row.entityName,
    'Period Label': row.periodLabel,
    'Fiscal Year': row.fiscalYear,
    'Accumulation Basis': row.accumulationBasis,
    'Consolidation Scope': row.consolidationScope,
    'Value Status': row.valueStatus,
    Value: row.valueDecimal,
    'Native Currency': row.nativeCurrency,
    'Presentation Currency': row.presentationCurrency,
    Unit: row.unit,
    Multiplier: row.multiplier,
    'Is Adjustment': row.isAdjustment,
    'Adjustment Reason': row.adjustmentReason,
    'Cell Key': row.cellKey,
  };
}

// ---------------------------------------------------------------------------
// Value/status cell parsing — the load-bearing "never silent zero" logic.
// ---------------------------------------------------------------------------

export type ParseValueCellsResult =
  | { ok: true; status: FinanceValueStatus; valueDecimal: string | null }
  | { ok: false; message: string };

function cellText(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim();
}

/**
 * Parses the `Value Status` + `Value` column pair for one row.
 *   - both blank                      -> MISSING (never PRESENT_ZERO)
 *   - status in {MISSING,NA,NOT_APPLICABLE}, Value must be blank -> that status
 *   - Value present, status blank     -> inferred from the number (0 -> PRESENT_ZERO, else PRESENT_NONZERO)
 *   - Value present, status explicit  -> status must agree with the inferred one, else VALIDATION error
 */
export function parseValueCells(statusRaw: unknown, valueRaw: unknown): ParseValueCellsResult {
  const statusText = cellText(statusRaw).toUpperCase();
  const valueText = cellText(valueRaw);

  if (statusText && !(FinanceValueStatusValues as readonly string[]).includes(statusText)) {
    return { ok: false, message: `Unknown Value Status '${statusText}' (expected one of ${FinanceValueStatusValues.join(', ')})` };
  }

  if (!statusText && !valueText) {
    return { ok: true, status: 'MISSING', valueDecimal: null };
  }

  if (statusText === 'MISSING' || statusText === 'NA' || statusText === 'NOT_APPLICABLE') {
    if (valueText) return { ok: false, message: `Value Status '${statusText}' requires an empty Value cell, got '${valueText}'` };
    return { ok: true, status: statusText, valueDecimal: null };
  }

  if (!valueText) {
    // statusText must be PRESENT_ZERO/PRESENT_NONZERO here (blank Value contradicts a "present" status).
    return { ok: false, message: `Value Status '${statusText}' requires a numeric Value` };
  }

  const numeric = Number(valueText);
  if (!Number.isFinite(numeric)) {
    return { ok: false, message: `Value '${valueText}' is not a valid number` };
  }
  const inferredStatus: FinanceValueStatus = numeric === 0 ? 'PRESENT_ZERO' : 'PRESENT_NONZERO';
  if (statusText && statusText !== inferredStatus) {
    return {
      ok: false,
      message: `Value Status '${statusText}' does not match Value '${valueText}' (expected '${inferredStatus}' for this number)`,
    };
  }
  return { ok: true, status: inferredStatus, valueDecimal: valueText };
}

export function formatBooleanCell(value: boolean): string {
  return value ? 'TRUE' : 'FALSE';
}

export function parseBooleanCell(raw: unknown): boolean {
  const text = cellText(raw).toUpperCase();
  return text === 'TRUE' || text === '1' || text === 'YES';
}

// ---------------------------------------------------------------------------
// Formula AST -> human-readable string (task requirement: "formula AST w
// czytelnej reprezentacji, nie surowy JSON"). Reuses the REAL `FormulaNode`
// type `formulaAstEvaluator.ts` (WP-D04) already defines and evaluates
// against, instead of inventing a parallel loose shape.
// ---------------------------------------------------------------------------

const OPERATOR_SYMBOL: Record<string, string> = {
  add: '+',
  subtract: '-',
  multiply: '*',
  divide: '/',
  ratio: '/',
};

function renderCellRefOperand(cellRef: Extract<FormulaNode, { kind: 'cell_ref' }>['cellRef']): string {
  const entityScope = cellRef.entityScope === 'ANALYSIS_DEFAULT' ? null : cellRef.entityScope.entityCode;
  const parts = [cellRef.canonicalLineCode];
  const qualifiers = [cellRef.consolidationScope, entityScope, cellRef.periodOffset].filter(Boolean);
  return qualifiers.length ? `${parts[0]}[${qualifiers.join(',')}]` : parts[0]!;
}

/** Renders a `finance_analysis_kpi_catalog.formula_ast` tree as a readable infix expression, e.g. `CURRENT_ASSETS / CURRENT_LIABILITIES` or `(CURRENT_ASSETS - INVENTORY) / CURRENT_LIABILITIES`. Falls back to a compact JSON fragment only for node shapes this renderer does not recognize (defensive — every shape `formulaAstEvaluator.ts` accepts is covered). */
export function renderFormulaNode(node: FormulaNode, depth = 0): string {
  if (node.node === 'operand') {
    if (node.kind === 'cell_ref') return renderCellRefOperand(node.cellRef);
    if (node.kind === 'literal' && 'value' in node) return String(node.value);
    if (node.kind === 'literal' && 'valueRef' in node) return node.valueRef;
    if (node.kind === 'formula_ref') return `KPI(${node.kpiCode})`;
    return JSON.stringify(node);
  }
  if (node.node === 'operator') {
    const symbol = OPERATOR_SYMBOL[node.op] ?? node.op;
    const rendered = `${renderFormulaNode(node.left, depth + 1)} ${symbol} ${renderFormulaNode(node.right, depth + 1)}`;
    return depth > 0 ? `(${rendered})` : rendered;
  }
  return JSON.stringify(node);
}

// Re-export enum value lists callers of this module commonly need alongside
// the schema above, so financeImportService.ts does not need a second import
// line into ../../../types/finance/* for these.
export { FinanceAccumulationBasisValues, FinanceConsolidationScopeValues, FinanceUnitValues, FinanceValueStatusValues };
export type { FinanceAccumulationBasis, FinanceConsolidationScope, FinanceUnit, FinanceValueStatus };
