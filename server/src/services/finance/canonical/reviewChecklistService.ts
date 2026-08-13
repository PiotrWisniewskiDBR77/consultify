/**
 * Finance v3 canonical — AP-06 review checklist + changed-only reviewer entry.
 *
 * Gate D, AP-06. Wraps `finance_review_checklists`
 * (migration `20260809_finance_v3_d_ap06_comments_01_tables.sql`), per
 * `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md`
 * section 3 point 6 ("review checklist") — comments/threads themselves live
 * in `commentService.ts`, not here.
 *
 * `getChangedCellsForStatementPack()` implements the same section's
 * "changed-only reviewer entry": if the artifact has a previous APPROVED
 * business version, a reviewer sees, by default, only the cells that differ
 * from that baseline (task brief: "reviewer widzi domyslnie tylko zmienione
 * komorki"). This is STATEMENT_PACK-specific today because `finance_stmt_lines`
 * is the only Gate D domain table with a shipped schema/CellRef branch (same
 * scope note as AP-00's CellRef.ts header) — a future domain table gets its
 * own comparison function alongside this one, not a rewrite of it.
 */

import { v4 as uuidv4 } from 'uuid';

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import { financeStmtLinesCellRef, type CellRef, type FinanceConsolidationScope, type FinanceAccumulationBasis } from '../../../types/finance/CellRef.js';
import { getBusinessVersion, listBusinessVersions, type BusinessVersionRow } from './artifactVersionService.js';

// ---------------------------------------------------------------------------
// finance_review_checklists — add / check / require
// ---------------------------------------------------------------------------

export interface FinanceReviewChecklistItemRow {
  id: string;
  organization_id: string;
  business_version_id: string;
  item: string;
  required: boolean;
  checked_by: string | null;
  checked_at: string | null;
  created_by: string;
  created_at: string;
}

export interface AddChecklistItemParams {
  organizationId: string;
  businessVersionId: string;
  item: string;
  required?: boolean;
  createdBy: string;
}

export type AddChecklistItemResult =
  | { ok: true; item: FinanceReviewChecklistItemRow }
  | { ok: false; code: 'ITEM_TEXT_REQUIRED'; message: string };

export async function addChecklistItem(params: AddChecklistItemParams): Promise<AddChecklistItemResult> {
  if (!params.item || !params.item.trim()) {
    return { ok: false, code: 'ITEM_TEXT_REQUIRED', message: 'Checklist item text must be non-empty' };
  }
  const row = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<FinanceReviewChecklistItemRow>(
      `INSERT INTO finance_review_checklists (
         id, organization_id, business_version_id, item, required, created_by
       ) VALUES (?, ?, ?, ?, ?, ?)
       RETURNING *`,
      [uuidv4(), params.organizationId, params.businessVersionId, params.item, params.required ?? true, params.createdBy]
    )
  );
  if (!row) throw new Error('finance_review_checklists insert returned no row');
  return { ok: true, item: row };
}

export type ChecklistItemMutationResult =
  | { ok: true; item: FinanceReviewChecklistItemRow }
  | { ok: false; code: 'NOT_FOUND' | 'ALREADY_CHECKED' | 'NOT_CHECKED'; message: string };

/** "sprawdz" — mark an item checked. */
export async function checkItem(organizationId: string, itemId: string, checkedBy: string): Promise<ChecklistItemMutationResult> {
  return withPinnedPostgresTransaction(async (tx) => {
    const current = await tx.queryOne<FinanceReviewChecklistItemRow>(
      `SELECT * FROM finance_review_checklists WHERE id = ? AND organization_id = ?`,
      [itemId, organizationId]
    );
    if (!current) return { ok: false, code: 'NOT_FOUND', message: 'Checklist item not found' };
    if (current.checked_at) return { ok: false, code: 'ALREADY_CHECKED', message: 'Checklist item is already checked' };

    const updated = await tx.queryOne<FinanceReviewChecklistItemRow>(
      `UPDATE finance_review_checklists SET checked_by = ?, checked_at = now()
        WHERE id = ? AND organization_id = ? RETURNING *`,
      [checkedBy, itemId, organizationId]
    );
    if (!updated) throw new Error('finance_review_checklists check update returned no row');
    return { ok: true, item: updated };
  });
}

/** Symmetric undo of checkItem() — clears checked_by/checked_at. */
export async function uncheckItem(organizationId: string, itemId: string): Promise<ChecklistItemMutationResult> {
  return withPinnedPostgresTransaction(async (tx) => {
    const current = await tx.queryOne<FinanceReviewChecklistItemRow>(
      `SELECT * FROM finance_review_checklists WHERE id = ? AND organization_id = ?`,
      [itemId, organizationId]
    );
    if (!current) return { ok: false, code: 'NOT_FOUND', message: 'Checklist item not found' };
    if (!current.checked_at) return { ok: false, code: 'NOT_CHECKED', message: 'Checklist item is not checked' };

    const updated = await tx.queryOne<FinanceReviewChecklistItemRow>(
      `UPDATE finance_review_checklists SET checked_by = NULL, checked_at = NULL
        WHERE id = ? AND organization_id = ? RETURNING *`,
      [itemId, organizationId]
    );
    if (!updated) throw new Error('finance_review_checklists uncheck update returned no row');
    return { ok: true, item: updated };
  });
}

/** "wymagaj" — toggle whether an item is required (does not affect already-checked state). */
export async function setChecklistItemRequired(
  organizationId: string,
  itemId: string,
  required: boolean
): Promise<ChecklistItemMutationResult> {
  const updated = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<FinanceReviewChecklistItemRow>(
      `UPDATE finance_review_checklists SET required = ? WHERE id = ? AND organization_id = ? RETURNING *`,
      [required, itemId, organizationId]
    )
  );
  if (!updated) return { ok: false, code: 'NOT_FOUND', message: 'Checklist item not found' };
  return { ok: true, item: updated };
}

export async function listChecklistItems(organizationId: string, businessVersionId: string): Promise<FinanceReviewChecklistItemRow[]> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryAll<FinanceReviewChecklistItemRow>(
      `SELECT * FROM finance_review_checklists WHERE organization_id = ? AND business_version_id = ? ORDER BY created_at ASC`,
      [organizationId, businessVersionId]
    )
  );
}

/** True iff every `required=true` item on this business version is checked. Empty checklist -> true (nothing outstanding). */
export async function allRequiredItemsChecked(organizationId: string, businessVersionId: string): Promise<boolean> {
  const row = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ outstanding: string }>(
      `SELECT COUNT(*) AS outstanding FROM finance_review_checklists
        WHERE organization_id = ? AND business_version_id = ? AND required = true AND checked_at IS NULL`,
      [organizationId, businessVersionId]
    )
  );
  return Number(row?.outstanding ?? 0) === 0;
}

// ---------------------------------------------------------------------------
// Changed-only reviewer entry (STATEMENT_PACK / finance_stmt_lines)
// ---------------------------------------------------------------------------

interface StmtLineDiffRow {
  entity_id: string;
  canonical_line_id: string;
  period_id: string;
  accumulation_basis: FinanceAccumulationBasis;
  consolidation_scope: FinanceConsolidationScope;
  cur_value_status: string | null;
  cur_value_decimal: string | null;
  prev_value_status: string | null;
  prev_value_decimal: string | null;
}

export interface ChangedCellValue {
  valueStatus: string;
  valueDecimal: string | null;
}

export interface ChangedCellEntry {
  cellRef: CellRef;
  previous: ChangedCellValue | null;
  current: ChangedCellValue | null;
}

export type GetChangedCellsResult =
  | {
      ok: true;
      hasPreviousApproved: true;
      previousBusinessVersionId: string;
      /** Every finance_stmt_lines cell that differs (added/removed/value or status changed) between previousBusinessVersionId and businessVersionId. */
      changedCells: ChangedCellEntry[];
    }
  | {
      ok: true;
      hasPreviousApproved: false;
      previousBusinessVersionId: null;
      /** No baseline to diff against — caller should show the full grid, not an empty "nothing changed" state. */
      changedCells: null;
    }
  | { ok: false; code: 'NOT_FOUND'; message: string };

/** Resolves "the previous APPROVED business version" for `businessVersionId`'s artifact: its own parent if that parent is APPROVED, else the highest version_no APPROVED sibling below it. */
async function findPreviousApprovedBusinessVersion(
  organizationId: string,
  current: BusinessVersionRow
): Promise<BusinessVersionRow | null> {
  if (current.parent_version_id) {
    const parent = await getBusinessVersion(organizationId, current.parent_version_id);
    if (parent && parent.status === 'APPROVED') return parent;
  }
  const siblings = await listBusinessVersions(organizationId, current.artifact_id);
  const approvedBelow = siblings
    .filter((v) => v.status === 'APPROVED' && v.version_no < current.version_no)
    .sort((a, b) => b.version_no - a.version_no);
  return approvedBelow[0] ?? null;
}

export async function getChangedCellsForStatementPack(
  organizationId: string,
  businessVersionId: string,
  opts: { previousApprovedBusinessVersionId?: string } = {}
): Promise<GetChangedCellsResult> {
  const current = await getBusinessVersion(organizationId, businessVersionId);
  if (!current) return { ok: false, code: 'NOT_FOUND', message: 'Business version not found' };

  let previous: BusinessVersionRow | null = null;
  if (opts.previousApprovedBusinessVersionId) {
    previous = await getBusinessVersion(organizationId, opts.previousApprovedBusinessVersionId);
  } else {
    previous = await findPreviousApprovedBusinessVersion(organizationId, current);
  }

  if (!previous) {
    return { ok: true, hasPreviousApproved: false, previousBusinessVersionId: null, changedCells: null };
  }

  // NOTE on the join key: `finance_stmt_entities` rows are scoped ONE-PER-`business_version_id`
  // (`uq_finance_stmt_entities_version_code UNIQUE (business_version_id, entity_code)` — see the
  // WP-D01 migration) — a reopened business version does not get a copy of its parent's entity
  // rows, so `cur.entity_id` and `prev.entity_id` are ALWAYS different generated ids even for
  // "the same" legal entity. Joining on raw `entity_id` would therefore make every cell look
  // changed (100% false-positive diff). `entity_code` is the column's own documented "stable
  // natural key across versions/periods for the same legal entity" (WP-D01 migration comment on
  // `finance_stmt_entities.entity_code`) — that is the correct join key here.
  const diffRows = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<StmtLineDiffRow>(
      `WITH cur AS (
         SELECT sl.*, e.entity_code
         FROM finance_stmt_lines sl
         JOIN finance_stmt_entities e ON e.id = sl.entity_id AND e.organization_id = sl.organization_id
         WHERE sl.organization_id = ? AND sl.business_version_id = ?
       ), prev AS (
         SELECT sl.*, e.entity_code
         FROM finance_stmt_lines sl
         JOIN finance_stmt_entities e ON e.id = sl.entity_id AND e.organization_id = sl.organization_id
         WHERE sl.organization_id = ? AND sl.business_version_id = ?
       )
       SELECT
         -- Prefer the CURRENT version's entity_id so the returned CellRef resolves against
         -- businessVersionId (the version the caller is reviewing); prev's entity_id is only a
         -- fallback for a cell that was REMOVED (exists in prev, not in cur) and cannot be
         -- anchored in the current version's own entity rows at all.
         COALESCE(cur.entity_id, prev.entity_id) AS entity_id,
         COALESCE(cur.canonical_line_id, prev.canonical_line_id) AS canonical_line_id,
         COALESCE(cur.period_id, prev.period_id) AS period_id,
         COALESCE(cur.accumulation_basis, prev.accumulation_basis) AS accumulation_basis,
         COALESCE(cur.consolidation_scope, prev.consolidation_scope) AS consolidation_scope,
         cur.value_status AS cur_value_status, cur.value_decimal AS cur_value_decimal,
         prev.value_status AS prev_value_status, prev.value_decimal AS prev_value_decimal
       FROM cur
       FULL OUTER JOIN prev
         ON cur.entity_code = prev.entity_code
        AND cur.canonical_line_id = prev.canonical_line_id
        AND cur.period_id = prev.period_id
        AND cur.accumulation_basis = prev.accumulation_basis
        AND cur.consolidation_scope = prev.consolidation_scope
       WHERE cur.id IS NULL OR prev.id IS NULL
          OR cur.value_status IS DISTINCT FROM prev.value_status
          OR cur.value_decimal IS DISTINCT FROM prev.value_decimal`,
      [organizationId, businessVersionId, organizationId, previous.business_version_id]
    )
  );

  const changedCells: ChangedCellEntry[] = diffRows.map((row) => ({
    cellRef: financeStmtLinesCellRef({
      organizationId,
      businessVersionId,
      entityId: row.entity_id,
      canonicalLineId: row.canonical_line_id,
      consolidationScope: row.consolidation_scope,
      periodId: row.period_id,
      accumulationBasis: row.accumulation_basis,
    }),
    previous: row.prev_value_status ? { valueStatus: row.prev_value_status, valueDecimal: row.prev_value_decimal } : null,
    current: row.cur_value_status ? { valueStatus: row.cur_value_status, valueDecimal: row.cur_value_decimal } : null,
  }));

  return {
    ok: true,
    hasPreviousApproved: true,
    previousBusinessVersionId: previous.business_version_id,
    changedCells,
  };
}
