/**
 * AP-02 — FinanceImportService: parses a re-imported Excel/CSV file back
 * against a `finance_business_version`, produces a preview diff, validates
 * against the canonical taxonomy/unit contract, and applies the accepted
 * changes as ONE transactional `Operation` batch (AP-00 contract) —
 * "wszystko albo nic" (task requirement).
 *
 * Program: `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md`
 * section 3 point 2. Report: `docs/validation/finance-v3/generated/gate-d/AP-02_excel_roundtrip_report.md`.
 *
 * PIPELINE (3 explicit stages, matching the task's own list — "preview diff,
 * mapping, validation, transactional reimport"):
 *   1. `parseFinanceExcelBuffer`  — pure, no DB: bytes -> { manifest, rows }.
 *   2. `previewFinanceImport`     — read-only DB: rows -> { diff, rowErrors }.
 *      Safe to call repeatedly (e.g. as the analyst edits the mapping) with
 *      zero side effects.
 *   3. `applyFinanceImport`       — one write transaction: re-validates
 *      under `FOR UPDATE` (closing the TOCTOU gap between preview and
 *      apply), builds ONE `ApplyOperationsBatchRequest` reusing AP-00's
 *      `Operation` contract and AP-01's `paste`/`clear` verbs (same verbs
 *      `PasteEngine.ts`/`BulkOpsEngine.ts` emit — "Excel import powinien
 *      produkować Operation.batch tą samą ścieżką co paste w gridzie", task
 *      brief), applies every operation to `finance_stmt_lines` inside ONE
 *      Postgres transaction, then bumps `finance_working_revisions` via the
 *      EXACT demote-then-INSERT pattern `reopenVersion()`/
 *      `checkpointOperationStack()` already established (no third
 *      mechanism invented for "how does a new working_revision appear").
 *
 * OPERATIONS-EXECUTOR SCOPE NOTE: `Operation.ts`'s own header says the
 * executor is "out of scope for this ADR (future Gate D executive work
 * package)" — no such executor exists anywhere else in the codebase yet
 * (confirmed by search: `ApplyOperationsBatchRequest` is only ever
 * constructed by AP-01's engines/AP-04's collaboration layer, never
 * consumed). This file is that executor's first real implementation, scoped
 * narrowly to the one table `CellRef` addresses today (`finance_stmt_lines`)
 * — the same "don't design what a future work package owns" discipline
 * `ArtifactRef.ts` documents for its own six-branch union.
 *
 * BATCH SHAPE — one deliberate, documented extension over `PasteEngine.ts`'s
 * own convention: `PasteEngine` puts one `paste` op (<=1000 cells) per
 * `ApplyOperationsBatchRequest`, and emits MULTIPLE such batches (multiple
 * separate transactions) for >1000 cells, explicitly accepting a loss of
 * whole-paste atomicity above 1000 cells (see that file's header). An
 * Excel re-import has no such option — the task requires "transactional
 * reimport" to be all-or-nothing regardless of size. `ApplyOperationsBatchRequestSchema`
 * caps `operations` at 1000 *operations*, not 1000 cells per operation
 * (`opPasteSchema` itself has no per-operation cell cap) — so this executor
 * instead chunks the touched cells into <=1000-cell `paste` operations and
 * packs ALL of them (plus one `clear` operation for cleared cells) into a
 * SINGLE `ApplyOperationsBatchRequest`, applied inside ONE
 * `withPinnedPostgresTransaction` call. This stays inside the existing
 * schema (no contract change) while preserving true whole-import atomicity
 * up to 1000 chunks x 1000 cells = 1,000,000 cells, comfortably above the
 * 5k x 60 = 300k-cell size target this work package tests against.
 */

import { v4 as uuidv4 } from 'uuid';
import ExcelJS from 'exceljs';
import { Readable } from 'stream';

import { withPinnedPostgresTransaction, type PinnedTransactionClient } from '../../../database/PostgresDatabase.js';
import {
  financeStmtLinesCellRef,
  cellRefKey,
  type CellRef,
  type FinanceAccumulationBasis,
  type FinanceConsolidationScope,
} from '../../../types/finance/CellRef.js';
import {
  FinanceValueInputSchema,
  ApplyOperationsBatchRequestSchema,
  findDuplicateTargetsInBatch,
  isContentMutableStatus,
  type ApplyOperationsBatchRequest,
  type FinanceValueInput,
  type Operation,
} from '../../../types/finance/Operation.js';
import type { FinanceValue, FinanceValueStatus } from '../../../types/finance/financeValueSemantics.js';
import { MAX_CELLS_PER_OPERATION, chunkArray } from '../grid/gridCoordinates.js';
import {
  reopenVersion,
  type BusinessVersionRow,
  type RestatementClass,
  type VersionKind,
} from './artifactVersionService.js';
import { canonicalPayloadHash } from './contentHash.js';
import type { BusinessVersionStatus, FinanceRole } from './lifecycleService.js';
import {
  FINANCE_EXCEL_SHEET_NAMES,
  FINANCE_EXCEL_VALUE_COLUMNS,
  checkManifestCompatibility,
  parseBooleanCell,
  parseValueCells,
  type FinanceExcelManifest,
  type FinanceExcelManifestCheck,
} from './financeExcelShared.js';

// ---------------------------------------------------------------------------
// Stage 1 — parse (pure, no DB)
// ---------------------------------------------------------------------------

export type RawImportRow = Readonly<Record<string, unknown>> & { readonly __rowNumber: number };

export interface ParsedFinanceImport {
  manifest: FinanceExcelManifest | null;
  manifestIssues: string[];
  rows: RawImportRow[];
}

function scalarCellValue(value: ExcelJS.CellValue): unknown {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && 'result' in (value as any)) return scalarCellValue((value as any).result);
  if (typeof value === 'object' && 'text' in (value as any)) return String((value as any).text);
  return value;
}

function readManifestSheet(sheet: ExcelJS.Worksheet | undefined): { manifest: FinanceExcelManifest | null; issues: string[] } {
  if (!sheet) return { manifest: null, issues: [`No '${FINANCE_EXCEL_SHEET_NAMES.manifest}' sheet found in the uploaded file`] };
  const kv: Record<string, string> = {};
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const field = scalarCellValue(row.getCell(1).value);
    const value = scalarCellValue(row.getCell(2).value);
    if (field) kv[String(field)] = value == null ? '' : String(value);
  }
  const required = ['manifestVersion', 'source', 'exportId', 'organizationId', 'artifactId', 'artifactType', 'businessVersionId', 'businessVersionStatus', 'businessVersionNo', 'businessVersionCasVersion', 'workingRevisionId', 'asOf', 'defaultUnit', 'defaultPresentationCurrency', 'rowCount'];
  const missing = required.filter((key) => !(key in kv));
  if (missing.length > 0) return { manifest: null, issues: [`Manifest sheet is missing fields: ${missing.join(', ')}`] };
  const manifest: FinanceExcelManifest = {
    manifestVersion: Number(kv.manifestVersion) as 1,
    source: kv.source as FinanceExcelManifest['source'],
    exportId: kv.exportId!,
    organizationId: kv.organizationId!,
    artifactId: kv.artifactId!,
    artifactType: kv.artifactType as FinanceExcelManifest['artifactType'],
    businessVersionId: kv.businessVersionId!,
    businessVersionStatus: kv.businessVersionStatus as FinanceExcelManifest['businessVersionStatus'],
    businessVersionNo: Number(kv.businessVersionNo),
    businessVersionCasVersion: Number(kv.businessVersionCasVersion),
    workingRevisionId: kv.workingRevisionId!,
    asOf: kv.asOf!,
    defaultUnit: kv.defaultUnit as FinanceExcelManifest['defaultUnit'],
    defaultPresentationCurrency: kv.defaultPresentationCurrency!,
    rowCount: Number(kv.rowCount),
  };
  return { manifest, issues: [] };
}

function readValuesSheet(sheet: ExcelJS.Worksheet): RawImportRow[] {
  const headerRow = sheet.getRow(1);
  const headerByColumn = new Map<number, string>();
  for (let c = 1; c <= sheet.columnCount; c++) {
    const header = scalarCellValue(headerRow.getCell(c).value);
    if (header) headerByColumn.set(c, String(header).trim());
  }
  const rows: RawImportRow[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const sourceRow = sheet.getRow(r);
    // Skip fully-blank rows (trailing blank rows are common in hand-edited Excel files).
    let anyValue = false;
    const obj: Record<string, unknown> = {};
    for (const [col, header] of headerByColumn) {
      const value = scalarCellValue(sourceRow.getCell(col).value);
      if (value !== null && value !== '') anyValue = true;
      obj[header] = value;
    }
    if (!anyValue) continue;
    rows.push(Object.freeze({ ...obj, __rowNumber: r }) as RawImportRow);
  }
  return rows;
}

/** Parses an uploaded `.xlsx`/`.csv` buffer into `{ manifest, rows }`. CSV files carry only the Values-equivalent sheet — the caller must supply the original manifest separately in that case (task wording: "bierze zaimportowany plik... + oryginalny manifest"). */
export async function parseFinanceExcelBuffer(buffer: Buffer, filename: string): Promise<ParsedFinanceImport> {
  const workbook = new ExcelJS.Workbook();
  const isCsv = filename.toLowerCase().endsWith('.csv');
  if (isCsv) {
    await workbook.csv.read(Readable.from(buffer));
  } else {
    await workbook.xlsx.load(buffer as any);
  }

  if (isCsv) {
    const sheet = workbook.worksheets[0];
    if (!sheet) return { manifest: null, manifestIssues: ['CSV file contains no rows'], rows: [] };
    return { manifest: null, manifestIssues: [], rows: readValuesSheet(sheet) };
  }

  const { manifest, issues } = readManifestSheet(workbook.getWorksheet(FINANCE_EXCEL_SHEET_NAMES.manifest));
  const valuesSheet = workbook.getWorksheet(FINANCE_EXCEL_SHEET_NAMES.values);
  if (!valuesSheet) return { manifest, manifestIssues: [...issues, `No '${FINANCE_EXCEL_SHEET_NAMES.values}' sheet found`], rows: [] };
  return { manifest, manifestIssues: issues, rows: readValuesSheet(valuesSheet) };
}

// ---------------------------------------------------------------------------
// Row resolution: raw sheet row -> CellRef + FinanceValueInput, against a
// taxonomy lookup scoped to (organizationId, businessVersionId).
// ---------------------------------------------------------------------------

export interface FinanceImportRowError {
  rowNumber: number;
  message: string;
}

export interface ResolvedImportCell {
  rowNumber: number;
  cellKey: string;
  cellRef: CellRef;
  value: FinanceValueInput;
}

export interface TaxonomyLookups {
  entityByCode: Map<string, { id: string }>;
  periodByLabel: Map<string, { period_id: string }>;
  lineByKey: Map<string, { id: string; statement_type: string }>;
}

async function buildTaxonomyLookups(
  tx: PinnedTransactionClient,
  organizationId: string,
  businessVersionId: string
): Promise<TaxonomyLookups> {
  const entities = await tx.queryAll<{ id: string; entity_code: string }>(
    `SELECT id, entity_code FROM finance_stmt_entities WHERE organization_id = ? AND business_version_id = ?`,
    [organizationId, businessVersionId]
  );
  const periods = await tx.queryAll<{ period_id: string; label: string }>(
    `SELECT fsp.period_id, fsp.label
       FROM finance_stmt_periods fsp
       JOIN finance_stmt_calendars fsc ON fsc.fiscal_calendar_id = fsp.fiscal_calendar_id
      WHERE fsc.organization_id = ?`,
    [organizationId]
  );
  const lines = await tx.queryAll<{ id: string; line_code: string; statement_type: string }>(
    `SELECT id, line_code, statement_type FROM financial_statement_lines WHERE organization_id = ? OR organization_id IS NULL`,
    [organizationId]
  );

  return {
    entityByCode: new Map(entities.map((e) => [e.entity_code, { id: e.id }])),
    periodByLabel: new Map(periods.map((p) => [p.label, { period_id: p.period_id }])),
    lineByKey: new Map(lines.map((l) => [`${l.statement_type}|${l.line_code}`, { id: l.id, statement_type: l.statement_type }])),
  };
}

function resolveImportRow(
  raw: RawImportRow,
  organizationId: string,
  businessVersionId: string,
  lookups: TaxonomyLookups
): { ok: true; cell: ResolvedImportCell } | { ok: false; error: FinanceImportRowError } {
  const rowNumber = raw.__rowNumber;
  const get = (col: (typeof FINANCE_EXCEL_VALUE_COLUMNS)[number]): string => {
    const v = raw[col];
    return v == null ? '' : String(v).trim();
  };
  const fail = (message: string) => ({ ok: false as const, error: { rowNumber, message } });

  const statementType = get('Statement Type');
  if (statementType !== 'P&L' && statementType !== 'BS' && statementType !== 'CF') {
    return fail(`Statement Type '${statementType}' must be one of P&L, BS, CF`);
  }
  const lineCode = get('Line Code');
  const line = lookups.lineByKey.get(`${statementType}|${lineCode}`);
  if (!line) return fail(`Line Code '${lineCode}' is not a known ${statementType} canonical line`);

  const entityCode = get('Entity Code');
  const entity = lookups.entityByCode.get(entityCode);
  if (!entity) return fail(`Entity Code '${entityCode}' is not a known entity for this business version`);

  const periodLabel = get('Period Label');
  const period = lookups.periodByLabel.get(periodLabel);
  if (!period) return fail(`Period Label '${periodLabel}' does not match any known period`);

  const accumulationBasis = get('Accumulation Basis') as FinanceAccumulationBasis;
  if (!['QUARTER_ONLY', 'YTD', 'LTM', 'FULL_YEAR'].includes(accumulationBasis)) {
    return fail(`Accumulation Basis '${accumulationBasis}' is invalid`);
  }
  const consolidationScope = get('Consolidation Scope') as FinanceConsolidationScope;
  if (!['STANDALONE', 'CONSOLIDATED', 'ELIMINATION'].includes(consolidationScope)) {
    return fail(`Consolidation Scope '${consolidationScope}' is invalid`);
  }

  const parsedValue = parseValueCells(raw['Value Status'], raw['Value']);
  if (!parsedValue.ok) return fail(parsedValue.message);

  const isAdjustment = parseBooleanCell(raw['Is Adjustment']);
  const adjustmentReason = get('Adjustment Reason') || null;
  if (isAdjustment && !adjustmentReason) return fail(`Is Adjustment = TRUE requires a non-empty Adjustment Reason`);

  const nativeCurrency = get('Native Currency');
  const presentationCurrency = get('Presentation Currency');
  const unit = get('Unit');
  const multiplier = get('Multiplier') || '1';
  if (nativeCurrency.length !== 3) return fail(`Native Currency '${nativeCurrency}' must be a 3-letter ISO 4217 code`);
  if (presentationCurrency.length !== 3) return fail(`Presentation Currency '${presentationCurrency}' must be a 3-letter ISO 4217 code`);
  if (!['UNITS', 'THOUSANDS', 'MILLIONS', 'BILLIONS'].includes(unit)) return fail(`Unit '${unit}' is invalid`);

  const cellRef = financeStmtLinesCellRef({
    organizationId,
    businessVersionId,
    entityId: entity.id,
    canonicalLineId: line.id,
    consolidationScope,
    periodId: period.period_id,
    accumulationBasis,
  });

  const valueInput: FinanceValueInput = {
    status: parsedValue.status,
    valueDecimal: parsedValue.valueDecimal,
    nativeCurrency,
    presentationCurrency,
    unit: unit as FinanceValue['unit'],
    multiplier,
    sourceRef: null,
    isAdjustment,
    adjustmentReason,
  };
  const parsedSchema = FinanceValueInputSchema.safeParse(valueInput);
  if (!parsedSchema.success) {
    return fail(`Row fails FinanceValue shape validation: ${parsedSchema.error.issues.map((i) => i.message).join('; ')}`);
  }

  return { ok: true, cell: { rowNumber, cellKey: cellRefKey(cellRef), cellRef, value: parsedSchema.data } };
}

// ---------------------------------------------------------------------------
// Diff — resolved import rows vs. the live `finance_stmt_lines` state.
// ---------------------------------------------------------------------------

export interface FinanceImportDiffEntryChange {
  cellKey: string;
  cellRef: CellRef;
  before: { status: FinanceValueStatus; valueDecimal: string | null };
  after: ResolvedImportCell;
}

export interface FinanceImportDiff {
  toAdd: ResolvedImportCell[];
  toChange: FinanceImportDiffEntryChange[];
  toClear: { cellKey: string; cellRef: CellRef }[];
  unchangedCount: number;
}

export interface CurrentCellRow {
  cell_key: string;
  value_status: FinanceValueStatus;
  value_decimal: string | null;
  native_currency: string;
  presentation_currency: string;
  unit: string;
  multiplier: string;
  is_adjustment: boolean;
  adjustment_reason: string | null;
}

async function loadCurrentCells(
  tx: PinnedTransactionClient,
  organizationId: string,
  businessVersionId: string
): Promise<Map<string, CurrentCellRow>> {
  const rows = await tx.queryAll<{
    entity_id: string;
    canonical_line_id: string;
    consolidation_scope: FinanceConsolidationScope;
    period_id: string;
    accumulation_basis: FinanceAccumulationBasis;
    value_status: FinanceValueStatus;
    value_decimal: string | null;
    native_currency: string;
    presentation_currency: string;
    unit: string;
    multiplier: string;
    is_adjustment: boolean;
    adjustment_reason: string | null;
  }>(
    `SELECT entity_id, canonical_line_id, consolidation_scope, period_id, accumulation_basis,
            value_status, value_decimal::text AS value_decimal, native_currency, presentation_currency,
            unit, multiplier::text AS multiplier, is_adjustment, adjustment_reason
       FROM finance_stmt_lines WHERE organization_id = ? AND business_version_id = ?`,
    [organizationId, businessVersionId]
  );
  const map = new Map<string, CurrentCellRow>();
  for (const row of rows) {
    const ref = financeStmtLinesCellRef({
      organizationId,
      businessVersionId,
      entityId: row.entity_id,
      canonicalLineId: row.canonical_line_id,
      consolidationScope: row.consolidation_scope,
      periodId: row.period_id,
      accumulationBasis: row.accumulation_basis,
    });
    const key = cellRefKey(ref);
    map.set(key, { cell_key: key, ...row });
  }
  return map;
}

function valuesEqual(current: CurrentCellRow, incoming: FinanceValueInput): boolean {
  return (
    current.value_status === incoming.status &&
    current.value_decimal === incoming.valueDecimal &&
    (incoming.nativeCurrency === undefined || current.native_currency === incoming.nativeCurrency) &&
    (incoming.presentationCurrency === undefined || current.presentation_currency === incoming.presentationCurrency) &&
    (incoming.unit === undefined || current.unit === incoming.unit) &&
    (incoming.multiplier === undefined || current.multiplier === incoming.multiplier) &&
    current.is_adjustment === (incoming.isAdjustment ?? false) &&
    (current.adjustment_reason ?? null) === (incoming.adjustmentReason ?? null)
  );
}

export interface ComputeDiffResult {
  diff: FinanceImportDiff;
  rowErrors: FinanceImportRowError[];
}

/**
 * The pure hot-path: raw rows + already-fetched taxonomy lookups + already-
 * fetched current-cell map -> diff. Zero DB/network calls — factored out of
 * `computeFinanceImportDiff` (below) specifically so a size/performance test
 * can exercise the EXACT SAME row-resolution + diff-classification code
 * against synthetic in-memory `Map`s, without spinning up Postgres (task
 * requirement: "symuluj... w pamięci"). See
 * `docs/validation/finance-v3/generated/gate-d/ap02/ap02_size_test.ts`.
 */
export function computeFinanceImportDiffPure(
  organizationId: string,
  businessVersionId: string,
  rows: readonly RawImportRow[],
  lookups: TaxonomyLookups,
  current: ReadonlyMap<string, CurrentCellRow>
): ComputeDiffResult {
  const rowErrors: FinanceImportRowError[] = [];
  const seenKeys = new Set<string>();
  const toAdd: ResolvedImportCell[] = [];
  const toChange: FinanceImportDiffEntryChange[] = [];
  const toClear: { cellKey: string; cellRef: CellRef }[] = [];
  let unchangedCount = 0;

  for (const raw of rows) {
    const resolved = resolveImportRow(raw, organizationId, businessVersionId, lookups);
    if (!resolved.ok) {
      rowErrors.push(resolved.error);
      continue;
    }
    const { cell } = resolved;
    if (seenKeys.has(cell.cellKey)) {
      rowErrors.push({ rowNumber: cell.rowNumber, message: `Duplicate row for the same cell (${cell.cellKey}) — every cell must appear at most once in one import file` });
      continue;
    }
    seenKeys.add(cell.cellKey);

    const existing = current.get(cell.cellKey);
    if (!existing) {
      if (cell.value.status === 'MISSING') {
        unchangedCount += 1; // a brand-new blank row is a no-op, not an "add"
      } else {
        toAdd.push(cell);
      }
      continue;
    }
    if (valuesEqual(existing, cell.value)) {
      unchangedCount += 1;
      continue;
    }
    if (cell.value.status === 'MISSING' && existing.value_status !== 'MISSING') {
      toClear.push({ cellKey: cell.cellKey, cellRef: cell.cellRef });
      continue;
    }
    toChange.push({
      cellKey: cell.cellKey,
      cellRef: cell.cellRef,
      before: { status: existing.value_status, valueDecimal: existing.value_decimal },
      after: cell,
    });
  }

  return { diff: { toAdd, toChange, toClear, unchangedCount }, rowErrors };
}

async function computeFinanceImportDiff(
  tx: PinnedTransactionClient,
  organizationId: string,
  businessVersionId: string,
  rows: RawImportRow[]
): Promise<ComputeDiffResult> {
  const lookups = await buildTaxonomyLookups(tx, organizationId, businessVersionId);
  const current = await loadCurrentCells(tx, organizationId, businessVersionId);
  return computeFinanceImportDiffPure(organizationId, businessVersionId, rows, lookups, current);
}

// ---------------------------------------------------------------------------
// Stage 2 — preview (read-only)
// ---------------------------------------------------------------------------

export interface PreviewFinanceImportParams {
  organizationId: string;
  artifactId: string;
  businessVersionId: string;
  manifest: FinanceExcelManifest;
  rows: RawImportRow[];
}

export interface FinanceImportPreviewResult {
  ok: boolean; // false iff there are blocking rowErrors or manifest incompatibility
  manifestCheck: FinanceExcelManifestCheck;
  diff: FinanceImportDiff;
  rowErrors: FinanceImportRowError[];
  totalRows: number;
}

export async function previewFinanceImport(params: PreviewFinanceImportParams): Promise<FinanceImportPreviewResult> {
  const manifestCheck = checkManifestCompatibility(params.manifest, params);
  const { diff, rowErrors } = await withPinnedPostgresTransaction((tx) =>
    computeFinanceImportDiff(tx, params.organizationId, params.businessVersionId, params.rows)
  );
  return {
    ok: manifestCheck.ok && rowErrors.length === 0,
    manifestCheck,
    diff,
    rowErrors,
    totalRows: params.rows.length,
  };
}

// ---------------------------------------------------------------------------
// Stage 3 — apply (one transactional Operation.batch, all-or-nothing)
// ---------------------------------------------------------------------------

export interface ApplyFinanceImportReopenParams {
  reason: string;
  expectedVersion: number;
  versionKind?: Extract<VersionKind, 'ORIGINAL' | 'RESTATED'>;
  restatementReason?: string;
  restatementClass?: RestatementClass;
}

export interface ApplyFinanceImportParams {
  organizationId: string;
  artifactId: string;
  businessVersionId: string;
  expectedWorkingRevisionId: string;
  actorId: string;
  actorRole: FinanceRole;
  manifest: FinanceExcelManifest;
  rows: RawImportRow[];
  batchIdempotencyKey: string;
  /** Supplied only when the caller has already confirmed (via the preview's `STATE_PRECONDITION_FAILED`/`reopenRequired`) that the target is `APPROVED` and wants this call to reopen it first. Reuses `artifactVersionService.reopenVersion()` verbatim — this file never mutates an Approved version's content directly (task requirement 3). */
  reopen?: ApplyFinanceImportReopenParams;
}

export type ApplyFinanceImportErrorCode =
  | 'NOT_FOUND'
  | 'MANIFEST_MISMATCH'
  | 'STATE_PRECONDITION_FAILED'
  | 'WORKING_REVISION_CONFLICT'
  | 'VALIDATION_FAILED'
  | 'REOPEN_FAILED';

export type ApplyFinanceImportResult =
  | {
      ok: true;
      businessVersionId: string;
      newWorkingRevisionId: string;
      newRevisionSeq: number;
      appliedCount: { added: number; changed: number; cleared: number };
      idempotentReplay: boolean;
      reopened: boolean;
    }
  | {
      ok: false;
      code: ApplyFinanceImportErrorCode;
      message: string;
      reopenRequired?: boolean;
      rowErrors?: FinanceImportRowError[];
      currentWorkingRevisionId?: string;
    };

function operationsFromDiff(diff: FinanceImportDiff, ctx: {
  actorId: string;
  actorRole: FinanceRole;
  sourceWorkingRevisionId: string;
  now: string;
}): Operation[] {
  const operations: Operation[] = [];
  const addAndChange = [
    ...diff.toAdd.map((c) => ({ cellRef: c.cellRef, value: c.value })),
    ...diff.toChange.map((c) => ({ cellRef: c.after.cellRef, value: c.after.value })),
  ];
  const targetChunks = chunkArray(addAndChange, MAX_CELLS_PER_OPERATION);
  for (const chunk of targetChunks) {
    operations.push({
      type: 'paste',
      operationId: uuidv4(),
      idempotencyKey: uuidv4(),
      actorId: ctx.actorId,
      actorRole: ctx.actorRole,
      clientTimestamp: ctx.now,
      sourceWorkingRevisionId: ctx.sourceWorkingRevisionId,
      target: chunk.map((c) => c.cellRef),
      values: chunk.map((c) => c.value),
    });
  }
  if (diff.toClear.length > 0) {
    const clearChunks = chunkArray(diff.toClear, MAX_CELLS_PER_OPERATION);
    for (const chunk of clearChunks) {
      operations.push({
        type: 'clear',
        operationId: uuidv4(),
        idempotencyKey: uuidv4(),
        actorId: ctx.actorId,
        actorRole: ctx.actorRole,
        clientTimestamp: ctx.now,
        sourceWorkingRevisionId: ctx.sourceWorkingRevisionId,
        target: chunk.map((c) => c.cellRef),
      });
    }
  }
  return operations;
}

/** The AP-00 executor for `finance_stmt_lines` — applies one already-validated batch of `paste`/`clear` operations inside the CALLER's transaction. Not exported: `applyFinanceImport` is the only caller today; a future generic AP-00 executor (any grid mutation, not just Excel import) would lift this out, per the file header's scope note. */
async function executeStmtLinesOperations(tx: PinnedTransactionClient, operations: readonly Operation[]): Promise<number> {
  let applied = 0;
  for (const op of operations) {
    if (op.type === 'paste') {
      for (let i = 0; i < op.target.length; i++) {
        const ref = op.target[i]!;
        const value = op.values[i]!;
        if (ref.rowKey.tableName !== 'finance_stmt_lines' || ref.columnKey.tableName !== 'finance_stmt_lines') {
          throw new Error(`executeStmtLinesOperations: unsupported table ${ref.tableName}`);
        }
        await tx.queryRun(
          `INSERT INTO finance_stmt_lines (
             organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id,
             accumulation_basis, consolidation_scope, value_status, value_decimal,
             native_currency, presentation_currency, unit, multiplier, source_ref, is_adjustment, adjustment_reason,
             sign_convention, accounting_policy, created_by
           )
           SELECT ?, ?, csl.statement_type, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NATURAL', 'IFRS', ?
             FROM financial_statement_lines csl WHERE csl.id = ?
           ON CONFLICT ON CONSTRAINT uq_finance_stmt_lines_cell DO UPDATE SET
             value_status = EXCLUDED.value_status,
             value_decimal = EXCLUDED.value_decimal,
             native_currency = EXCLUDED.native_currency,
             presentation_currency = EXCLUDED.presentation_currency,
             unit = EXCLUDED.unit,
             multiplier = EXCLUDED.multiplier,
             is_adjustment = EXCLUDED.is_adjustment,
             adjustment_reason = EXCLUDED.adjustment_reason,
             updated_at = now()`,
          [
            ref.organizationId,
            ref.businessVersionId,
            ref.rowKey.canonicalLineId,
            ref.rowKey.entityId,
            ref.columnKey.periodId,
            ref.columnKey.accumulationBasis,
            ref.rowKey.consolidationScope,
            value.status,
            value.valueDecimal,
            value.nativeCurrency,
            value.presentationCurrency,
            value.unit,
            value.multiplier ?? '1',
            value.sourceRef ? JSON.stringify(value.sourceRef) : null,
            value.isAdjustment ?? false,
            value.adjustmentReason ?? null,
            op.actorId,
            ref.rowKey.canonicalLineId,
          ]
        );
        applied += 1;
      }
    } else if (op.type === 'clear') {
      for (const ref of op.target) {
        if (ref.rowKey.tableName !== 'finance_stmt_lines' || ref.columnKey.tableName !== 'finance_stmt_lines') {
          throw new Error(`executeStmtLinesOperations: unsupported table ${ref.tableName}`);
        }
        const result = await tx.queryRun(
          `UPDATE finance_stmt_lines SET value_status = 'MISSING', value_decimal = NULL, updated_at = now()
            WHERE organization_id = ? AND business_version_id = ? AND entity_id = ? AND canonical_line_id = ?
              AND period_id = ? AND accumulation_basis = ? AND consolidation_scope = ?`,
          [
            ref.organizationId,
            ref.businessVersionId,
            ref.rowKey.entityId,
            ref.rowKey.canonicalLineId,
            ref.columnKey.periodId,
            ref.columnKey.accumulationBasis,
            ref.rowKey.consolidationScope,
          ]
        );
        applied += result.changes;
      }
    } else {
      throw new Error(`executeStmtLinesOperations: operation type '${op.type}' is not implemented by the Excel-import executor (only 'paste'/'clear' are needed for re-import)`);
    }
  }
  return applied;
}

function batchContentHash(operations: readonly Operation[]): string {
  // W10-D01 fix: was its own second `sha256(JSON.stringify(...))` implementation;
  // now a thin named wrapper over the ONE canonical hash primitive
  // (`./contentHash.ts`) — hashes the OPERATIONS applied, not a full re-read of
  // every row in the business version, which would be needlessly expensive for
  // a large pack.
  return canonicalPayloadHash(operations);
}

/**
 * Copies `finance_stmt_entities` + `finance_stmt_lines` from one business
 * version to another — the content-copy `reopenVersion()` itself does not
 * perform (see the call site's comment for why). Remaps
 * `finance_stmt_entities.id`/`parent_entity_row_id` to fresh rows (entity
 * rows are version-scoped, not shared) before copying `finance_stmt_lines`,
 * which must point at the NEW entity rows, not the old business version's.
 *
 * KNOWN LIMITATION (documented, not silently accepted): this performs one
 * INSERT per source row rather than a batched multi-row INSERT — acceptable
 * for a reopen's typical entity/line-count (tens to low thousands), but a
 * future generic Gate D reopen-content-copy service should batch this the
 * same way a production `finance_stmt_lines` bulk loader would.
 */
async function copyStatementPackContentForReopen(params: {
  organizationId: string;
  fromBusinessVersionId: string;
  toBusinessVersionId: string;
  actorId: string;
}): Promise<{ entitiesCopied: number; linesCopied: number }> {
  return withPinnedPostgresTransaction(async (tx) => {
    const entities = await tx.queryAll<{
      id: string;
      entity_code: string;
      legal_name: string;
      jurisdiction: string | null;
      role: string;
      parent_entity_row_id: string | null;
      consolidation_method: string;
      ownership_pct: string | null;
      functional_currency: string;
      perimeter_event: string;
      perimeter_event_date: string | null;
      discontinued_operation: boolean;
    }>(`SELECT * FROM finance_stmt_entities WHERE organization_id = ? AND business_version_id = ?`, [
      params.organizationId,
      params.fromBusinessVersionId,
    ]);

    const entityIdMap = new Map<string, string>();
    for (const e of entities) {
      const inserted = await tx.queryOne<{ id: string }>(
        `INSERT INTO finance_stmt_entities (
           organization_id, business_version_id, entity_code, legal_name, jurisdiction, role,
           parent_entity_row_id, consolidation_method, ownership_pct, functional_currency,
           perimeter_event, perimeter_event_date, discontinued_operation, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [
          params.organizationId,
          params.toBusinessVersionId,
          e.entity_code,
          e.legal_name,
          e.jurisdiction,
          e.role,
          e.consolidation_method,
          e.ownership_pct,
          e.functional_currency,
          e.perimeter_event,
          e.perimeter_event_date,
          e.discontinued_operation,
          params.actorId,
        ]
      );
      if (!inserted) throw new Error('finance_stmt_entities copy-forward insert returned no row');
      entityIdMap.set(e.id, inserted.id);
    }
    // Second pass: fix up parent_entity_row_id now that every new id is known.
    for (const e of entities) {
      if (e.parent_entity_row_id && entityIdMap.has(e.parent_entity_row_id)) {
        await tx.queryRun(`UPDATE finance_stmt_entities SET parent_entity_row_id = ? WHERE id = ?`, [
          entityIdMap.get(e.parent_entity_row_id),
          entityIdMap.get(e.id),
        ]);
      }
    }

    const lines = await tx.queryAll<{
      statement_type: string;
      canonical_line_id: string;
      entity_id: string;
      period_id: string;
      accumulation_basis: string;
      consolidation_scope: string;
      value_status: FinanceValueStatus;
      value_decimal: string | null;
      native_currency: string;
      presentation_currency: string;
      unit: string;
      multiplier: string;
      source_ref: unknown;
      is_adjustment: boolean;
      adjustment_reason: string | null;
      sign_convention: string;
      accounting_policy: string;
      ifrs16_treatment: string | null;
      discontinued_operations: boolean;
      exceptional_item: boolean;
    }>(
      `SELECT statement_type, canonical_line_id, entity_id, period_id, accumulation_basis, consolidation_scope,
              value_status, value_decimal::text AS value_decimal, native_currency, presentation_currency, unit,
              multiplier::text AS multiplier, source_ref, is_adjustment, adjustment_reason, sign_convention,
              accounting_policy, ifrs16_treatment, discontinued_operations, exceptional_item
         FROM finance_stmt_lines WHERE organization_id = ? AND business_version_id = ?`,
      [params.organizationId, params.fromBusinessVersionId]
    );
    let linesCopied = 0;
    for (const l of lines) {
      const newEntityId = entityIdMap.get(l.entity_id);
      if (!newEntityId) continue; // defensive — every line's entity_id must have been copied above
      await tx.queryRun(
        `INSERT INTO finance_stmt_lines (
           organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id,
           accumulation_basis, consolidation_scope, value_status, value_decimal, native_currency,
           presentation_currency, unit, multiplier, source_ref, is_adjustment, adjustment_reason,
           sign_convention, accounting_policy, ifrs16_treatment, discontinued_operations, exceptional_item, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          params.organizationId,
          params.toBusinessVersionId,
          l.statement_type,
          l.canonical_line_id,
          newEntityId,
          l.period_id,
          l.accumulation_basis,
          l.consolidation_scope,
          l.value_status,
          l.value_decimal,
          l.native_currency,
          l.presentation_currency,
          l.unit,
          l.multiplier,
          l.source_ref ? JSON.stringify(l.source_ref) : null,
          l.is_adjustment,
          l.adjustment_reason,
          l.sign_convention,
          l.accounting_policy,
          l.ifrs16_treatment,
          l.discontinued_operations,
          l.exceptional_item,
          params.actorId,
        ]
      );
      linesCopied += 1;
    }

    return { entitiesCopied: entities.length, linesCopied };
  });
}

export async function applyFinanceImport(params: ApplyFinanceImportParams): Promise<ApplyFinanceImportResult> {
  const manifestCheck = checkManifestCompatibility(params.manifest, params);
  if (!manifestCheck.ok) {
    return { ok: false, code: 'MANIFEST_MISMATCH', message: manifestCheck.issues.join('; ') };
  }

  let effectiveBusinessVersionId = params.businessVersionId;
  let effectiveWorkingRevisionId = params.expectedWorkingRevisionId;
  let reopened = false;

  const currentBv = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<BusinessVersionRow>(
      `SELECT * FROM finance_business_versions WHERE business_version_id = ? AND organization_id = ?`,
      [params.businessVersionId, params.organizationId]
    )
  );
  if (!currentBv) return { ok: false, code: 'NOT_FOUND', message: 'Business version not found' };

  if (!isContentMutableStatus(currentBv.status)) {
    if (!params.reopen) {
      return {
        ok: false,
        code: 'STATE_PRECONDITION_FAILED',
        message: `Business version is ${currentBv.status} — Approved statement packs are immutable. Reopen before importing.`,
        reopenRequired: true,
      };
    }
    const reopenResult = await reopenVersion({
      organizationId: params.organizationId,
      businessVersionId: params.businessVersionId,
      actorId: params.actorId,
      role: params.actorRole,
      expectedVersion: params.reopen.expectedVersion,
      reason: params.reopen.reason,
      versionKind: params.reopen.versionKind,
      restatementReason: params.reopen.restatementReason,
      restatementClass: params.reopen.restatementClass,
    });
    if (!reopenResult.ok) {
      return { ok: false, code: 'REOPEN_FAILED', message: `reopenVersion failed: ${reopenResult.code} — ${reopenResult.message}` };
    }
    effectiveBusinessVersionId = reopenResult.businessVersion.business_version_id;
    effectiveWorkingRevisionId = reopenResult.workingRevision.working_revision_id;
    reopened = true;

    // GAP CLOSED (AP-02 discovery, 2026-08-10): `reopenVersion()`
    // (`artifactVersionService.ts`, Gate C — artifact-type-agnostic) creates
    // the new `business_version_id`/`working_revision_id` copy-on-write pair
    // but does NOT copy any Gate-D domain content table, because Gate C has
    // no knowledge of `finance_stmt_entities`/`finance_stmt_lines` (those are
    // Statements-domain, Gate D). This is an explicitly-documented, deferred
    // gap, not a guess: `WP-D01_statements_schema_ADR.md` section on
    // version-scoping says content tables are version-scoped by
    // `business_version_id` "dokladnie po to, zeby reopen... mogl skopiowac
    // tresc z vN do vN+1... ten ADR NIE implementuje tej kopii (nalezy do
    // wykonawczego Gate D razem z reszta serwisu reopen)" — i.e. the ADR
    // designed the schema for this copy but explicitly left the copy itself
    // unimplemented. Confirmed empirically here (not just by reading the doc
    // comment): a reopen without this copy step left the new draft with ZERO
    // `finance_stmt_entities` rows, so `previewFinanceImport`'s own taxonomy
    // lookup rejected every row with "Entity Code ... is not a known entity
    // for this business version" on the very next call.
    //
    // Scope decision: this file closes the gap ONLY for what AP-02's own
    // reopen+reimport flow needs (Statement Pack `finance_stmt_entities` +
    // `finance_stmt_lines`), not a generic "copy any Gate D content table for
    // any reopen caller" mechanism — that belongs to whichever future Gate D
    // work package the ADR itself deferred it to (flagged separately).
    await copyStatementPackContentForReopen({
      organizationId: params.organizationId,
      fromBusinessVersionId: params.businessVersionId,
      toBusinessVersionId: effectiveBusinessVersionId,
      actorId: params.actorId,
    });
  }

  return withPinnedPostgresTransaction(async (tx) => {
    const bv = await tx.queryOne<BusinessVersionRow>(
      `SELECT * FROM finance_business_versions WHERE business_version_id = ? AND organization_id = ? FOR UPDATE`,
      [effectiveBusinessVersionId, params.organizationId]
    );
    if (!bv) return { ok: false, code: 'NOT_FOUND', message: 'Business version not found' };
    if (!isContentMutableStatus(bv.status)) {
      return { ok: false, code: 'STATE_PRECONDITION_FAILED', message: `Business version is ${bv.status}, not content-mutable`, reopenRequired: true };
    }

    const currentWr = await tx.queryOne<{ working_revision_id: string; revision_seq: number; artifact_id: string; checkpoint_payload: unknown }>(
      `SELECT working_revision_id, revision_seq, artifact_id, checkpoint_payload
         FROM finance_working_revisions
        WHERE artifact_id = ? AND organization_id = ? AND is_current = true FOR UPDATE`,
      [params.artifactId, params.organizationId]
    );
    if (!currentWr) return { ok: false, code: 'NOT_FOUND', message: 'No current working revision for this artifact' };
    if (currentWr.working_revision_id !== effectiveWorkingRevisionId) {
      return {
        ok: false,
        code: 'WORKING_REVISION_CONFLICT',
        message: `Working revision moved from ${effectiveWorkingRevisionId} to ${currentWr.working_revision_id}`,
        currentWorkingRevisionId: currentWr.working_revision_id,
      };
    }

    // Idempotency replay: has this exact batchIdempotencyKey already been
    // committed as a checkpoint? (mirrors `checkpointOperationStack`'s own
    // demote-then-insert ledger, reusing `checkpoint_payload` rather than a
    // new table.)
    const replay = await tx.queryOne<{ working_revision_id: string; revision_seq: number; checkpoint_payload: any }>(
      `SELECT working_revision_id, revision_seq, checkpoint_payload FROM finance_working_revisions
        WHERE artifact_id = ? AND organization_id = ? AND checkpoint_payload->>'batchIdempotencyKey' = ?
        ORDER BY revision_seq DESC LIMIT 1`,
      [params.artifactId, params.organizationId, params.batchIdempotencyKey]
    );
    if (replay) {
      const appliedCount = replay.checkpoint_payload?.appliedCount ?? { added: 0, changed: 0, cleared: 0 };
      return {
        ok: true,
        businessVersionId: effectiveBusinessVersionId,
        newWorkingRevisionId: replay.working_revision_id,
        newRevisionSeq: Number(replay.revision_seq),
        appliedCount,
        idempotentReplay: true,
        reopened,
      };
    }

    const { diff, rowErrors } = await computeFinanceImportDiff(tx, params.organizationId, effectiveBusinessVersionId, params.rows);
    if (rowErrors.length > 0) {
      return { ok: false, code: 'VALIDATION_FAILED', message: `${rowErrors.length} row(s) failed validation`, rowErrors };
    }
    if (diff.toAdd.length === 0 && diff.toChange.length === 0 && diff.toClear.length === 0) {
      return {
        ok: true,
        businessVersionId: effectiveBusinessVersionId,
        newWorkingRevisionId: currentWr.working_revision_id,
        newRevisionSeq: Number(currentWr.revision_seq),
        appliedCount: { added: 0, changed: 0, cleared: 0 },
        idempotentReplay: false,
        reopened,
      };
    }

    const now = new Date().toISOString();
    const operations = operationsFromDiff(diff, {
      actorId: params.actorId,
      actorRole: params.actorRole,
      sourceWorkingRevisionId: effectiveWorkingRevisionId,
      now,
    });

    const batchRequest: ApplyOperationsBatchRequest = {
      organizationId: params.organizationId,
      artifactId: params.artifactId,
      businessVersionId: effectiveBusinessVersionId,
      expectedWorkingRevisionId: effectiveWorkingRevisionId,
      batchIdempotencyKey: params.batchIdempotencyKey,
      operations: operations.slice(0, 1000), // schema cap — see file header for why 1000 chunked-paste-ops is enough for the 300k-cell target
    };
    if (operations.length > 1000) {
      return {
        ok: false,
        code: 'VALIDATION_FAILED',
        message: `Import touches too many cells to fit in one batch: ${operations.length} operations needed, 1000 max (see AP-00 ApplyOperationsBatchRequestSchema). Split the import file.`,
      };
    }
    const parsedBatch = ApplyOperationsBatchRequestSchema.safeParse(batchRequest);
    if (!parsedBatch.success) {
      return { ok: false, code: 'VALIDATION_FAILED', message: `Batch failed AP-00 schema validation: ${parsedBatch.error.issues.map((i) => i.message).join('; ')}` };
    }
    const duplicates = findDuplicateTargetsInBatch(parsedBatch.data.operations);
    if (duplicates.length > 0) {
      return { ok: false, code: 'VALIDATION_FAILED', message: `Batch has duplicate cell targets: ${duplicates.join(', ')}` };
    }

    const appliedCells = await executeStmtLinesOperations(tx, parsedBatch.data.operations);
    const appliedCount = { added: diff.toAdd.length, changed: diff.toChange.length, cleared: diff.toClear.length };
    if (appliedCells !== diff.toAdd.length + diff.toChange.length + diff.toClear.length) {
      throw new Error(`executeStmtLinesOperations applied ${appliedCells} cells, expected ${diff.toAdd.length + diff.toChange.length + diff.toClear.length} — aborting transaction`);
    }

    // Demote-then-INSERT working revision — same ordering `reopenVersion()`/
    // `checkpointOperationStack()` already use.
    await tx.queryRun(`UPDATE finance_working_revisions SET is_current = false WHERE artifact_id = ? AND is_current = true`, [params.artifactId]);
    const newWorkingRevisionId = uuidv4();
    const nextSeq = Number(currentWr.revision_seq) + 1;
    const checkpointPayload = {
      source: 'EXCEL_IMPORT',
      batchIdempotencyKey: params.batchIdempotencyKey,
      exportId: params.manifest.exportId,
      appliedCount,
    };
    const inserted = await tx.queryOne<{ working_revision_id: string; revision_seq: number }>(
      `INSERT INTO finance_working_revisions (
         working_revision_id, artifact_id, organization_id, business_version_id, source_business_version_id,
         revision_seq, content_semantic_hash, is_current, crash_recovery_checkpoint,
         checkpoint_payload, checkpoint_source, edited_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, true, false, ?, 'EXPLICIT_SAVE', ?)
       RETURNING working_revision_id, revision_seq`,
      [
        newWorkingRevisionId,
        params.artifactId,
        params.organizationId,
        effectiveBusinessVersionId,
        bv.parent_version_id,
        nextSeq,
        batchContentHash(parsedBatch.data.operations),
        JSON.stringify(checkpointPayload),
        params.actorId,
      ]
    );
    if (!inserted) throw new Error('finance_working_revisions insert (Excel import) returned no row');

    return {
      ok: true,
      businessVersionId: effectiveBusinessVersionId,
      newWorkingRevisionId: inserted.working_revision_id,
      newRevisionSeq: Number(inserted.revision_seq),
      appliedCount,
      idempotentReplay: false,
      reopened,
    };
  });
}
