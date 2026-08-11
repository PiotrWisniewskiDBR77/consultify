/**
 * Finance v3 canonical — Statement Pack mapping service (Gate D / Fala 3, WP-D02).
 *
 * Program: `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`
 * section 5 "Workflow" (Upload/resume -> malware/file validation -> parse ->
 * MAP -> reconcile -> exception resolution -> review -> approve). This module
 * is the "map" step. Schema: `docs/validation/finance-v3/generated/gate-d/
 * WP-D01_statements_schema_ADR.md` section 4.5 (`finance_stmt_lines`), shipped
 * as real migrations in `server/migrations/20260809_finance_v3_d01_statements_01_tables.sql`.
 *
 * SCOPE BOUNDARY (explicit, per this work package's brief): file upload,
 * malware scanning, and PDF/XLSX extraction are NOT part of this module.
 * Callers hand this service already-parsed rows —
 * `{ lineItem, periodId, entityCode, currency, value, sourceRef }` — where
 * `periodId` is an existing `finance_stmt_periods.period_id` and `entityCode`
 * is an existing `finance_stmt_entities.entity_code` for the target
 * `business_version_id`. Resolving a raw source period LABEL (e.g. "FY2025")
 * into a `finance_stmt_periods` row, and declaring the consolidation
 * perimeter into `finance_stmt_entities`, are WP-D01 schema concerns already
 * shipped — this service consumes those dimension rows, it does not create
 * them.
 *
 * Mapping rules are a plain dictionary keyed by a normalized source label ->
 * canonical `(statementType, lineCode)`, per the task's explicit instruction
 * ("prosty słownik na start, nie ML"). No fuzzy matching, no LLM call.
 *
 * WHY `withPinnedPostgresTransaction`: the whole batch of raw lines for one
 * mapping call is written in ONE transaction so the deferred constraint
 * triggers on `finance_stmt_lines` (balance / cash roll-forward / retained-
 * earnings roll-forward / elimination balance — WP-D01 section 5) evaluate
 * against the complete batch at COMMIT, exactly the "check the whole batch
 * paste/import, not a transiently-unbalanced partial state" semantics the ADR
 * documents. Mapping a Statement Pack across multiple separate calls before
 * all of Assets/Liabilities+Equity exist is expected to trip those triggers —
 * that is the schema working as designed, not a bug in this service.
 */

import { v4 as uuidv4 } from 'uuid';

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StatementType = 'P&L' | 'BS' | 'CF';
export type ConsolidationScope = 'STANDALONE' | 'CONSOLIDATED' | 'ELIMINATION';
export type AccumulationBasis = 'QUARTER_ONLY' | 'YTD' | 'LTM' | 'FULL_YEAR';
export type SignConvention = 'NATURAL' | 'CONTRA';
export type AccountingPolicy = 'IFRS' | 'LOCAL_GAAP' | 'US_GAAP';
export type FinanceUnit = 'UNITS' | 'THOUSANDS' | 'MILLIONS' | 'BILLIONS';
export type FinanceValueStatus = 'PRESENT_ZERO' | 'PRESENT_NONZERO' | 'MISSING' | 'NA' | 'NOT_APPLICABLE';

/** `finance_stmt_reconciliation.bucket` CHECK values (WP-D01 section 4.6). 'CANONICAL' is
 *  reserved for a future rollup-detail row shape this work package does not emit. */
export type ReconciliationBucket = 'MAPPED' | 'EXCLUDED' | 'UNMAPPED' | 'DUPLICATE' | 'RECLASS' | 'ELIMINATION' | 'CANONICAL';

/** The mocked "already parsed" input shape this work package's brief specifies verbatim. */
export interface RawStatementLine {
  lineItem: string;
  periodId: string;
  entityCode: string;
  currency: string;
  /** `null`/`undefined` -> `value_status='MISSING'`, written as-is, never silently coerced to 0. */
  value: number | null;
  sourceRef: Record<string, unknown>;
}

/**
 * WHY an exclusion needs a KIND, not just a reason code (BUGFIX RC-01).
 *
 * `action='EXCLUDE'` conflates two things that must never be conflated:
 *  - ANALYST_DECISION — "this real source line is deliberately kept out of the
 *    canonical model" (one-off gain, non-recurring item, out-of-perimeter row).
 *    The canonical pack is complete WITHOUT it; the exclusion is the answer.
 *  - NO_CANONICAL_TARGET — "the canonical taxonomy has nowhere to put this real
 *    source line". The canonical pack is INCOMPLETE because of it; the exclusion
 *    is the problem, not the answer.
 *
 * Before this fix both landed in the EXCLUDED bucket, which the waterfall
 * subtracts out of the residual — so a Statement Pack that dropped 76% of a real
 * IFRS statement for lack of taxonomy targets reconciled with residual 0 and
 * status CLEAN (REAL_COMPANY_PROOF_report.md, RC-01: 212 of 280 real Apator
 * line-values). `excludeKind` makes the difference declarable, and
 * `MappedRowResult.coverageLoss` carries it into the reconciliation waterfall.
 */
export type ExcludeKind = 'ANALYST_DECISION' | 'NO_CANONICAL_TARGET';

/**
 * Fallback recognition for callers that only set `excludeReasonCode` (the shape the
 * Apator real-company harness actually emits) and never learned about `excludeKind`.
 * A reason code in this set is treated as `excludeKind='NO_CANONICAL_TARGET'`.
 * Exported so callers can assert against it instead of re-typing the strings.
 */
export const TAXONOMY_GAP_EXCLUSION_REASON_CODES: ReadonlySet<string> = new Set([
  'NO_P0_CANONICAL_TARGET',
  'NO_CANONICAL_TARGET',
  'CANONICAL_TARGET_MISSING',
  'CANONICAL_LINE_NOT_FOUND',
  'TAXONOMY_GAP',
]);

export interface MappingRule {
  /** Matched against `RawStatementLine.lineItem` after normalization (trim/lowercase/collapse-whitespace). */
  sourceLabel: string;
  statementType: StatementType;
  lineCode: string;
  /** Default 'MAP'. */
  action?: 'MAP' | 'EXCLUDE' | 'RECLASS';
  /** Required (by this service, app-level) when action='EXCLUDE'. */
  excludeReasonCode?: string;
  /** Default 'ANALYST_DECISION' (unless `excludeReasonCode` is in `TAXONOMY_GAP_EXCLUSION_REASON_CODES`). */
  excludeKind?: ExcludeKind;
  /** Required when action='RECLASS' — the line this row is redirected TO. */
  reclassTargetLineCode?: string;
  reclassTargetStatementType?: StatementType;
  /** Default 'CONSOLIDATED'. 'ELIMINATION' requires `eliminationCounterpartyEntityCode`. */
  consolidationScope?: ConsolidationScope;
  eliminationCounterpartyEntityCode?: string;
  /** Default 'NATURAL'. */
  signConvention?: SignConvention;
  /** Default 'IFRS'. */
  accountingPolicy?: AccountingPolicy;
}

export interface MapStatementLinesParams {
  organizationId: string;
  businessVersionId: string;
  unit: FinanceUnit;
  presentationCurrency: string;
  /** Default 'FULL_YEAR'. */
  accumulationBasis?: AccumulationBasis;
  createdBy: string;
  rawLines: RawStatementLine[];
  rules: MappingRule[];
}

export interface MappedRowResult {
  rowIndex: number;
  raw: RawStatementLine;
  bucket: ReconciliationBucket;
  /** The "as declared by the rule" canonical line — for RECLASS this is the ORIGINAL/as-filed line, not the target. */
  canonicalLineId: string | null;
  /** Set only for bucket='RECLASS' — the line the value actually landed on in `finance_stmt_lines`. */
  reclassTargetLineId: string | null;
  eliminationCounterpartyEntityId: string | null;
  entityId: string | null;
  /** FK-safe resolved period id, or null if `raw.periodId` did not resolve to a real `finance_stmt_periods` row. */
  periodId: string | null;
  /** `finance_stmt_lines.id` this row was written to, or null if nothing was written (EXCLUDED/UNMAPPED/DUPLICATE). */
  stmtLineId: string | null;
  sourceAmount: number;
  /** Amount actually contributed to the canonical total; null when nothing was written. */
  mappedAmount: number | null;
  signConvention: SignConvention;
  reasonCode: string | null;
  duplicateOfRowIndex: number | null;
  /**
   * True when this row's source value never reached the canonical model AND that is a
   * completeness defect rather than a deliberate answer: every UNMAPPED row, plus every
   * EXCLUDED row whose exclusion is a taxonomy gap (`excludeKind='NO_CANONICAL_TARGET'`
   * or a reason code in `TAXONOMY_GAP_EXCLUSION_REASON_CODES`).
   *
   * DUPLICATE is deliberately NOT coverage loss — the value IS in the canonical model
   * (the first occurrence claimed the cell); the duplicate is a conflict, already caught
   * as residual by the waterfall. See BUGFIX_RC01_RC05_report.md.
   */
  coverageLoss: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
}

function valueStatusFor(value: number | null | undefined): FinanceValueStatus {
  if (value === null || value === undefined) return 'MISSING';
  if (value === 0) return 'PRESENT_ZERO';
  return 'PRESENT_NONZERO';
}

function cellKey(entityId: string, canonicalLineId: string, periodId: string, accumulationBasis: string, consolidationScope: string): string {
  return [entityId, canonicalLineId, periodId, accumulationBasis, consolidationScope].join('::');
}

function lineCodeKey(statementType: string, lineCode: string): string {
  return `${statementType}::${lineCode}`;
}

/**
 * RC-01 classification: does this row's absence from the canonical model mean the
 * canonical model is INCOMPLETE (coverage loss) or that it is COMPLETE BY DECISION?
 */
export function isCoverageLoss(bucket: ReconciliationBucket, reasonCode: string | null, excludeKind?: ExcludeKind): boolean {
  if (bucket === 'UNMAPPED') return true;
  if (bucket !== 'EXCLUDED') return false;
  if (excludeKind === 'NO_CANONICAL_TARGET') return true;
  if (excludeKind === 'ANALYST_DECISION') return false;
  return reasonCode !== null && TAXONOMY_GAP_EXCLUSION_REASON_CODES.has(reasonCode);
}

function emptyResult(
  rowIndex: number,
  raw: RawStatementLine,
  bucket: ReconciliationBucket,
  overrides: Partial<MappedRowResult> = {}
): MappedRowResult {
  const base: MappedRowResult = {
    rowIndex,
    raw,
    bucket,
    canonicalLineId: null,
    reclassTargetLineId: null,
    eliminationCounterpartyEntityId: null,
    entityId: null,
    periodId: null,
    stmtLineId: null,
    sourceAmount: raw.value ?? 0,
    mappedAmount: null,
    signConvention: 'NATURAL',
    reasonCode: null,
    duplicateOfRowIndex: null,
    coverageLoss: false,
    ...overrides,
  };
  // Never let a caller-supplied override understate coverage loss for an UNMAPPED row.
  if (base.bucket === 'UNMAPPED') base.coverageLoss = true;
  return base;
}

// ---------------------------------------------------------------------------
// mapStatementLines
// ---------------------------------------------------------------------------

export async function mapStatementLines(params: MapStatementLinesParams): Promise<MappedRowResult[]> {
  const accumulationBasis: AccumulationBasis = params.accumulationBasis ?? 'FULL_YEAR';
  const rulesByLabel = new Map<string, MappingRule>();
  for (const rule of params.rules) rulesByLabel.set(normalizeLabel(rule.sourceLabel), rule);

  return withPinnedPostgresTransaction(async (tx) => {
    // --- Prefetch: entities referenced by raw rows AND by rule elimination counterparties. ---
    const entityCodes = new Set<string>(params.rawLines.map((l) => l.entityCode));
    for (const rule of params.rules) {
      if (rule.eliminationCounterpartyEntityCode) entityCodes.add(rule.eliminationCounterpartyEntityCode);
    }
    const entityCodeList = Array.from(entityCodes);
    const entityRows = entityCodeList.length
      ? await tx.queryAll<{ id: string; entity_code: string }>(
          `SELECT id, entity_code FROM finance_stmt_entities WHERE business_version_id = ? AND entity_code = ANY(?)`,
          [params.businessVersionId, entityCodeList]
        )
      : [];
    const entityByCode = new Map(entityRows.map((r) => [r.entity_code, r.id]));

    // --- Prefetch: periods referenced by raw rows (existence check only). ---
    const periodIdList = Array.from(new Set(params.rawLines.map((l) => l.periodId)));
    const periodRows = periodIdList.length
      ? await tx.queryAll<{ period_id: string }>(`SELECT period_id FROM finance_stmt_periods WHERE period_id = ANY(?)`, [periodIdList])
      : [];
    const knownPeriods = new Set(periodRows.map((r) => r.period_id));

    // --- Prefetch: canonical taxonomy ids for every (statementType, lineCode) any rule references. ---
    // Org-specific rows win over global system rows for the same (statement_type, line_code) —
    // ORDER BY puts NULL organization_id first so the org-specific row (if any) overwrites it below.
    const taxonomyRows = await tx.queryAll<{ id: string; line_code: string; statement_type: string; organization_id: string | null }>(
      `SELECT id, line_code, statement_type, organization_id FROM financial_statement_lines
        WHERE organization_id IS NULL OR organization_id = ?
        ORDER BY organization_id NULLS FIRST`,
      [params.organizationId]
    );
    const lineCodeIdMap = new Map<string, string>();
    for (const row of taxonomyRows) {
      lineCodeIdMap.set(lineCodeKey(row.statement_type, row.line_code), row.id);
    }

    const results: MappedRowResult[] = [];
    // cellKey -> rowIndex of the row that first occupied that finance_stmt_lines cell
    // (mirrors uq_finance_stmt_lines_cell exactly: entity/canonical_line/period/basis/scope).
    const seenCells = new Map<string, number>();

    for (let rowIndex = 0; rowIndex < params.rawLines.length; rowIndex++) {
      const raw = params.rawLines[rowIndex];
      const rule = rulesByLabel.get(normalizeLabel(raw.lineItem));

      if (!rule) {
        results.push(emptyResult(rowIndex, raw, 'UNMAPPED', { entityId: entityByCode.get(raw.entityCode) ?? null, reasonCode: 'NO_MAPPING_RULE' }));
        continue;
      }

      const ruleLineId = lineCodeIdMap.get(lineCodeKey(rule.statementType, rule.lineCode)) ?? null;

      if (rule.action === 'EXCLUDE') {
        const excludeReasonCode = rule.excludeReasonCode ?? 'EXCLUDED_BY_RULE';
        results.push(
          emptyResult(rowIndex, raw, 'EXCLUDED', {
            canonicalLineId: ruleLineId,
            entityId: entityByCode.get(raw.entityCode) ?? null,
            signConvention: rule.signConvention ?? 'NATURAL',
            reasonCode: excludeReasonCode,
            // RC-01: an exclusion made because the taxonomy has no target is a coverage
            // defect, not an analyst decision — it must not be netted away silently.
            coverageLoss: isCoverageLoss('EXCLUDED', excludeReasonCode, rule.excludeKind),
          })
        );
        continue;
      }

      const entityId = entityByCode.get(raw.entityCode) ?? null;
      if (!entityId) {
        results.push(emptyResult(rowIndex, raw, 'UNMAPPED', { canonicalLineId: ruleLineId, reasonCode: 'ENTITY_NOT_FOUND' }));
        continue;
      }
      if (!knownPeriods.has(raw.periodId)) {
        results.push(emptyResult(rowIndex, raw, 'UNMAPPED', { canonicalLineId: ruleLineId, entityId, reasonCode: 'PERIOD_NOT_FOUND' }));
        continue;
      }
      if (!ruleLineId) {
        results.push(emptyResult(rowIndex, raw, 'UNMAPPED', { entityId, periodId: raw.periodId, reasonCode: 'CANONICAL_LINE_NOT_FOUND' }));
        continue;
      }

      const isReclass = rule.action === 'RECLASS';
      let targetLineId = ruleLineId;
      let reclassTargetLineId: string | null = null;
      if (isReclass) {
        const targetKey = lineCodeKey(rule.reclassTargetStatementType ?? rule.statementType, rule.reclassTargetLineCode ?? '');
        const resolvedTarget = lineCodeIdMap.get(targetKey) ?? null;
        if (!resolvedTarget) {
          results.push(
            emptyResult(rowIndex, raw, 'UNMAPPED', {
              canonicalLineId: ruleLineId,
              entityId,
              periodId: raw.periodId,
              reasonCode: 'RECLASS_TARGET_NOT_FOUND',
            })
          );
          continue;
        }
        targetLineId = resolvedTarget;
        reclassTargetLineId = resolvedTarget;
      }

      const consolidationScope: ConsolidationScope = rule.consolidationScope ?? 'CONSOLIDATED';
      const isElimination = consolidationScope === 'ELIMINATION';
      let eliminationCounterpartyEntityId: string | null = null;
      if (isElimination) {
        eliminationCounterpartyEntityId = rule.eliminationCounterpartyEntityCode
          ? entityByCode.get(rule.eliminationCounterpartyEntityCode) ?? null
          : null;
        if (!eliminationCounterpartyEntityId) {
          results.push(
            emptyResult(rowIndex, raw, 'UNMAPPED', {
              canonicalLineId: ruleLineId,
              reclassTargetLineId,
              entityId,
              periodId: raw.periodId,
              reasonCode: 'ELIMINATION_COUNTERPARTY_NOT_FOUND',
            })
          );
          continue;
        }
      }

      const key = cellKey(entityId, targetLineId, raw.periodId, accumulationBasis, consolidationScope);
      const existingRowIndex = seenCells.get(key);
      if (existingRowIndex !== undefined) {
        // Same (entity, canonical_line, period, basis, scope) cell already claimed by an earlier
        // raw row in this batch -> DUPLICATE, not silently overwritten and not silently dropped.
        // This is the mechanism that catches "two different mappings of the same position give
        // different totals" (see statementReconciliationService's CD Projekt regression test).
        results.push(
          emptyResult(rowIndex, raw, 'DUPLICATE', {
            canonicalLineId: ruleLineId,
            reclassTargetLineId,
            eliminationCounterpartyEntityId,
            entityId,
            periodId: raw.periodId,
            signConvention: rule.signConvention ?? 'NATURAL',
            reasonCode: 'DUPLICATE_CELL_MAPPING',
            duplicateOfRowIndex: existingRowIndex,
            coverageLoss: false, // conflict, not a gap — already surfaced as residual
          })
        );
        continue;
      }
      seenCells.set(key, rowIndex);

      const valueStatus = valueStatusFor(raw.value);
      const stmtLineId = uuidv4();
      await tx.queryRun(
        `INSERT INTO finance_stmt_lines (
           id, organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id,
           accumulation_basis, consolidation_scope, value_status, value_decimal, native_currency,
           presentation_currency, unit, multiplier, source_ref, is_adjustment, sign_convention,
           accounting_policy, reclassified_from_line_id, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          stmtLineId,
          params.organizationId,
          params.businessVersionId,
          rule.statementType,
          targetLineId,
          entityId,
          raw.periodId,
          accumulationBasis,
          consolidationScope,
          valueStatus,
          valueStatus === 'MISSING' ? null : raw.value,
          raw.currency,
          params.presentationCurrency,
          params.unit,
          1,
          JSON.stringify(raw.sourceRef ?? {}),
          false,
          rule.signConvention ?? 'NATURAL',
          rule.accountingPolicy ?? 'IFRS',
          isReclass ? ruleLineId : null,
          params.createdBy,
        ]
      );

      const bucket: ReconciliationBucket = isReclass ? 'RECLASS' : isElimination ? 'ELIMINATION' : 'MAPPED';
      results.push({
        rowIndex,
        raw,
        bucket,
        canonicalLineId: ruleLineId,
        reclassTargetLineId,
        eliminationCounterpartyEntityId,
        entityId,
        periodId: raw.periodId,
        stmtLineId,
        sourceAmount: raw.value ?? 0,
        // MISSING contributes null (0-by-convention downstream), never a fabricated 0 that
        // would be indistinguishable from a real PRESENT_ZERO value.
        mappedAmount: raw.value,
        signConvention: rule.signConvention ?? 'NATURAL',
        reasonCode: null,
        duplicateOfRowIndex: null,
        coverageLoss: false,
      });
    }

    return results;
  });
}

// ---------------------------------------------------------------------------
// Pakiet B2 — thin reader (DEC-FIN-012). `mapStatementLines` above only ever
// WRITES `finance_stmt_lines`; no prior caller anywhere in `services/finance/**`
// reads it back out (statementReconciliationService.ts's
// `loadBalanceSheetObservations` reads a BS-only slice for its own internal
// plausibility check, not a general-purpose reader). Org-scoped SELECT only,
// joined against the same three dimension tables `mapStatementLines` itself
// resolves against (canonical taxonomy / entities / periods), so a caller gets
// human-readable `lineCode`/`entityCode`/`periodLabel` without a second round
// trip — every FinanceValue-bundle column (status/decimal/currency/unit/
// multiplier/sourceRef) is carried through untouched.
// ---------------------------------------------------------------------------

export interface StatementLineListRow {
  id: string;
  organization_id: string;
  business_version_id: string;
  statement_type: StatementType;
  canonical_line_id: string;
  line_code: string;
  entity_id: string;
  entity_code: string;
  period_id: string;
  period_label: string;
  accumulation_basis: AccumulationBasis;
  consolidation_scope: ConsolidationScope;
  value_status: FinanceValueStatus;
  value_decimal: string | null;
  native_currency: string;
  presentation_currency: string;
  unit: FinanceUnit;
  multiplier: string;
  source_ref: Record<string, unknown> | null;
  is_adjustment: boolean;
  adjustment_reason: string | null;
  sign_convention: SignConvention;
  accounting_policy: AccountingPolicy;
  reclassified_from_line_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ListStatementLinesFilters {
  statementType?: StatementType;
  entityId?: string;
  periodId?: string;
}

export async function listStatementLines(
  organizationId: string,
  businessVersionId: string,
  filters: ListStatementLinesFilters = {}
): Promise<StatementLineListRow[]> {
  const conditions = ['l.organization_id = ?', 'l.business_version_id = ?'];
  const params: unknown[] = [organizationId, businessVersionId];
  if (filters.statementType) {
    conditions.push('l.statement_type = ?');
    params.push(filters.statementType);
  }
  if (filters.entityId) {
    conditions.push('l.entity_id = ?');
    params.push(filters.entityId);
  }
  if (filters.periodId) {
    conditions.push('l.period_id = ?');
    params.push(filters.periodId);
  }
  return withPinnedPostgresTransaction((tx) =>
    tx.queryAll<StatementLineListRow>(
      `SELECT l.id, l.organization_id, l.business_version_id, l.statement_type, l.canonical_line_id,
              fsl.line_code, l.entity_id, e.entity_code, l.period_id, p.label AS period_label,
              l.accumulation_basis, l.consolidation_scope, l.value_status, l.value_decimal,
              l.native_currency, l.presentation_currency, l.unit, l.multiplier, l.source_ref,
              l.is_adjustment, l.adjustment_reason, l.sign_convention, l.accounting_policy,
              l.reclassified_from_line_id, l.created_by, l.created_at, l.updated_at
         FROM finance_stmt_lines l
         JOIN financial_statement_lines fsl ON fsl.id = l.canonical_line_id
         JOIN finance_stmt_entities e ON e.id = l.entity_id
         JOIN finance_stmt_periods p ON p.period_id = l.period_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY l.statement_type ASC, fsl.line_code ASC, e.entity_code ASC, p.period_start ASC`,
      params
    )
  );
}
