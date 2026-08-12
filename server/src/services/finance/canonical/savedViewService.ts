/**
 * Finance v3 canonical — AP-07 saved views (personal/team) + shareable URL.
 *
 * Gate D, AP-07. Wraps `finance_saved_views`
 * (migration `20260809_finance_v3_d_ap07_saved_views_01_tables.sql`), per
 * `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md`
 * section 3 point 7 ("Filtry i saved views: category, quality, missing,
 * changed, materiality, source, owner, downstream use, entity, period;
 * personal/team views i shareable URL").
 *
 * WHAT THIS FILE ADDS, NOT REBUILDS (CLAUDE.md "reuse the foundation" rule):
 *   1. AP-01's `GridViewState` (server/src/services/finance/grid/GridViewState.ts)
 *      already defines freeze/pin/hide/group and a `toJSON()`/`fromJSON()`
 *      round trip — that file's own header says it is deliberately
 *      in-memory-only and names THIS work package as the one that persists
 *      it. This file does not add a second view-state model; it stores
 *      exactly `GridViewState.toJSON()`'s shape (re-validated at the DB
 *      boundary by `GridViewStateSnapshotSchema` below, the same defensive
 *      "don't trust a JSONB round-trip blindly" discipline
 *      `commentService.ts`'s `normalizeCommentRow` applies to its own JSONB
 *      `anchor` column).
 *   2. AP-00's `WorkspaceState.ts` stores filters as an OPAQUE
 *      `{ raw: Record<string, unknown> }` bag on purpose, with a comment
 *      saying "AP-07 ... owns that shape". This file is where that shape
 *      gets designed for real: a discriminated union of typed, range-
 *      validated filters (`SavedViewFilterSchema`), not another free-form
 *      bag — the task brief is explicit: "Filtry jako ustrukturyzowany JSON
 *      (nie wolna forma) ... każdy filtr ma typ i walidowany zakres
 *      wartości."
 *
 * PERMISSIONS (decision, not specified verbatim by the task brief — DEC-
 * FIN-012 "professional standard, don't escalate routine UX calls"):
 *   - PERSONAL views: visible to, and writable only by, `owner_user_id`.
 *   - TEAM views: visible to every member of `organization_id` (this
 *     service trusts `organizationId` is already the authenticated
 *     caller's own org — same convention `finance_comments`/
 *     `finance_exceptions` use, no separate org-membership table queried
 *     here); still writable only by `owner_user_id`. Scope changes WHO CAN
 *     READ, never who can edit — the simplest model that avoids a second,
 *     independent "team edit" permission this task did not ask for.
 *
 * SHAREABLE URL (task requirement: "sam token widoku nie omija authorization
 * na dane"): `resolveSharedView()` looks a view up by its opaque
 * `share_token` and returns the VIEW DEFINITION (filters + grid layout) plus
 * a reference to the artifact it belongs to. It deliberately does NOT read
 * or return any of the artifact's actual business content (statement lines,
 * KPI values, ...) — a caller (an API route handler) resolving a shared URL
 * must still separately run the artifact's own normal organization-scoped
 * authorization check (e.g. `artifactVersionService.getArtifact` against the
 * REQUESTING user's own authenticated `organizationId`) before it serves any
 * grid data back. `resolveSharedView` itself only enforces two structural
 * guards so the token cannot be used to enumerate or peek at views outside
 * the caller's own tenant/ownership: the row's `organization_id` must match
 * the caller's, and a PERSONAL-scoped row must match the caller's user id.
 *
 * COLUMN SCHEMA MIGRATION (task requirement 4): a saved view's stored
 * `gridViewState.columns[].columnId` can reference a KPI catalog column
 * (`finance_analysis_kpi_catalog.kpi_code`) that has since been deprecated
 * (`status != 'ACTIVE'`, WP-D03 `20260809_finance_v3_d03_analysis_01_tables.sql`
 * line ~43). Every read path in this file (`getSavedView`, `listSavedViews`,
 * `resolveSharedView`) runs `resolveColumnAvailability()` and returns a
 * `columnAvailability` array alongside the (otherwise unmodified) stored
 * view — the view state itself is NEVER silently pruned or dropped, so a
 * later un-deprecation of the same kpi_code makes the column reappear with
 * no data loss. A `columnId` that does not match any known kpi_code at all
 * (e.g. a period column) is assumed available — this file has no other
 * source of truth for period/line column identity to check against.
 */

import { randomBytes } from 'node:crypto';

import { z } from 'zod';

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import { FinanceArtifactTypeValues, type FinanceArtifactType } from '../../../types/finance/ArtifactRef.js';
import { FinanceValueStatusValues } from '../../../types/finance/financeValueSemantics.js';
import { GridViewState, type GridViewStateSnapshot } from '../grid/GridViewState.js';
import { getArtifact } from './artifactVersionService.js';

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

export const FinanceSavedViewScopeValues = ['PERSONAL', 'TEAM'] as const;
export type FinanceSavedViewScope = (typeof FinanceSavedViewScopeValues)[number];

// ---------------------------------------------------------------------------
// Structured filters — task requirement: "category, quality, missing,
// changed, materiality, source, owner, downstream use, entity, period" —
// each one a typed, range-validated filter, not a free-form bag.
// ---------------------------------------------------------------------------

/**
 * Mirrors `finance_analysis_kpi_catalog.category` CHECK
 * (`20260809_finance_v3_d03_analysis_01_tables.sql`, ~line 50). No
 * independent TS enum existed anywhere in this codebase before this file;
 * kept local (not re-exported from a shared types module) because — unlike
 * `FinanceValueStatusValues`/`FinanceArtifactTypeValues`, which AP-00
 * already made the base every other module imports — this is the first and
 * only consumer of the KPI category vocabulary outside SQL.
 */
export const FinanceKpiCategoryValues = [
  'LIQUIDITY',
  'PROFITABILITY',
  'LEVERAGE',
  'COVERAGE',
  'EFFICIENCY',
  'CASH_FLOW',
  'GROWTH',
  'RETURNS',
] as const;
export type FinanceKpiCategory = (typeof FinanceKpiCategoryValues)[number];

const DecimalStringSchema = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, 'must be a decimal string (optional leading "-", digits, optional "." + digits)');

export const SavedViewFilterCategorySchema = z.object({
  type: z.literal('category'),
  values: z.array(z.enum(FinanceKpiCategoryValues)).min(1),
});

/** "quality" — reuses AP-00's `finance_value_status` vocabulary verbatim (task instruction: "quality (z financeValueSemantics)"). */
export const SavedViewFilterQualitySchema = z.object({
  type: z.literal('quality'),
  values: z.array(z.enum(FinanceValueStatusValues)).min(1),
});

/** "missing" — a simple presence toggle; MISSING is itself one of the `quality` values, but the task brief lists it as its own filter (the common "show me only the gaps" one-click toggle), so it gets its own boolean rather than forcing a caller to spell out `{type:'quality', values:['MISSING']}`. */
export const SavedViewFilterMissingSchema = z.object({
  type: z.literal('missing'),
  onlyMissing: z.boolean(),
});

/** "changed" — references AP-06's changed-only reviewer entry (`reviewChecklistService.ts`'s `getChangedCellsForStatementPack`: cells that differ from the previous APPROVED business version). This filter does not recompute that diff itself — it is a flag a grid/table consumer reads to decide whether to call that AP-06 entry point before rendering. */
export const SavedViewFilterChangedSchema = z.object({
  type: z.literal('changed'),
  changedOnly: z.boolean(),
});

/** "materiality" — minimum absolute value threshold, decimal string (never a JS number — same precision discipline as `financeValueSemantics.ts`'s `FinanceValue.valueDecimal`). `null` = no threshold. */
export const SavedViewFilterMaterialitySchema = z.object({
  type: z.literal('materiality'),
  minAbsValueDecimal: DecimalStringSchema.nullable(),
});

/** "source" — free-text source identifiers (matched against `FinanceValue.sourceRef`'s `source_document_ref` at the query layer; this file only validates shape, not semantics of what a source id means). */
export const SavedViewFilterSourceSchema = z.object({
  type: z.literal('source'),
  values: z.array(z.string().min(1)).min(1),
});

/** "owner" — user ids. */
export const SavedViewFilterOwnerSchema = z.object({
  type: z.literal('owner'),
  values: z.array(z.string().min(1)).min(1),
});

/** "downstream use" — reuses AP-00's `FinanceArtifactType` vocabulary: "this cell/line feeds a downstream artifact of type X" (e.g. a Statement line flagged as feeding a BASELINE_MODEL). */
export const SavedViewFilterDownstreamUseSchema = z.object({
  type: z.literal('downstream_use'),
  values: z.array(z.enum(FinanceArtifactTypeValues)).min(1),
});

/** "entity" — entity ids (`CellRef`'s `rowKey.entityId`). No entity catalog table exists yet to validate membership against, so this filter validates SHAPE (non-empty string ids), not existence — same limitation `resolveColumnAvailability` documents for non-KPI columns. */
export const SavedViewFilterEntitySchema = z.object({
  type: z.literal('entity'),
  values: z.array(z.string().min(1)).min(1),
});

/** "period" — period ids (`CellRef`'s `columnKey.periodId` / `period.periodId`). */
export const SavedViewFilterPeriodSchema = z.object({
  type: z.literal('period'),
  values: z.array(z.string().min(1)).min(1),
});

export const SavedViewFilterSchema = z.discriminatedUnion('type', [
  SavedViewFilterCategorySchema,
  SavedViewFilterQualitySchema,
  SavedViewFilterMissingSchema,
  SavedViewFilterChangedSchema,
  SavedViewFilterMaterialitySchema,
  SavedViewFilterSourceSchema,
  SavedViewFilterOwnerSchema,
  SavedViewFilterDownstreamUseSchema,
  SavedViewFilterEntitySchema,
  SavedViewFilterPeriodSchema,
]);
export type SavedViewFilter = z.infer<typeof SavedViewFilterSchema>;
export type SavedViewFilterType = SavedViewFilter['type'];

export const SavedViewFilterSetSchema = z.array(SavedViewFilterSchema);
export type SavedViewFilterSet = SavedViewFilter[];

// ---------------------------------------------------------------------------
// view_state — { gridViewState: GridViewStateSnapshot, filters }.
// GridViewStateSnapshotSchema mirrors GridViewState.ts's plain TS interfaces
// (that file has no zod schema of its own — it is a pure in-memory class);
// re-validating its shape here, rather than trusting the JSONB round-trip
// blindly, is deliberately defensive at the DB boundary only. It duplicates
// SHAPE, never business logic (freeze/pin/hide/group semantics stay owned
// by GridViewState.ts itself — this schema cannot express or enforce them).
// ---------------------------------------------------------------------------

const GridViewColumnStateSchema = z.object({
  columnId: z.string().min(1),
  hidden: z.boolean(),
  pinned: z.enum(['LEFT', 'RIGHT']).nullable(),
  groupId: z.string().nullable(),
});

const GridViewRowStateSchema = z.object({
  rowId: z.string().min(1),
  hidden: z.boolean(),
  groupId: z.string().nullable(),
});

const GridViewGroupStateSchema = z.object({
  groupId: z.string().min(1),
  label: z.string(),
  axis: z.enum(['ROW', 'COLUMN']),
  collapsed: z.boolean(),
  memberIds: z.array(z.string().min(1)),
});

export const GridViewStateSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  freezeRowsCount: z.number().int().min(0),
  freezeColumnsCount: z.number().int().min(0),
  columns: z.array(GridViewColumnStateSchema),
  rows: z.array(GridViewRowStateSchema),
  groups: z.array(GridViewGroupStateSchema),
});

export const FINANCE_SAVED_VIEW_STATE_SCHEMA_VERSION = 1 as const;

export const FinanceSavedViewStateSchema = z.object({
  schemaVersion: z.literal(FINANCE_SAVED_VIEW_STATE_SCHEMA_VERSION),
  gridViewState: GridViewStateSnapshotSchema,
  filters: SavedViewFilterSetSchema,
});
export type FinanceSavedViewState = z.infer<typeof FinanceSavedViewStateSchema>;

// ---------------------------------------------------------------------------
// Row shape
// ---------------------------------------------------------------------------

export interface FinanceSavedViewRow {
  id: string;
  organization_id: string;
  artifact_id: string;
  artifact_type: FinanceArtifactType;
  scope: FinanceSavedViewScope;
  owner_user_id: string;
  name: string;
  view_state: FinanceSavedViewState;
  share_token: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** Same defensive JSONB-string-vs-parsed-object guard `commentService.ts`'s `normalizeCommentRow` applies to `anchor`. */
function normalizeSavedViewRow(row: FinanceSavedViewRow): FinanceSavedViewRow {
  if (row && typeof row.view_state === 'string') {
    try {
      row.view_state = JSON.parse(row.view_state);
    } catch {
      /* leave as-is; caller sees the raw string if parsing ever fails */
    }
  }
  return row;
}

export interface SavedViewColumnAvailability {
  columnId: string;
  available: boolean;
  /** `null` when available. `'KPI_DEPRECATED'` when the column's kpi_code exists in the catalog but is not (or no longer) `status='ACTIVE'`. */
  reason: 'KPI_DEPRECATED' | null;
}

export interface LoadedSavedView extends FinanceSavedViewRow {
  columnAvailability: SavedViewColumnAvailability[];
}

/**
 * Cross-references every stored `gridViewState.columns[].columnId` against
 * `finance_analysis_kpi_catalog`. A columnId with NO matching kpi_code at
 * all is assumed to be a non-KPI column (e.g. a period column) and reported
 * available — this file has no other source of truth to check such columns
 * against (see file header). `organization_id IS NULL` covers UNIVERSAL-tier
 * catalog rows (available to every org); `organization_id = ?` covers
 * ORG_CUSTOM-tier rows scoped to the caller's own org, mirroring the same
 * tier logic `kpiComputeService.ts` uses to resolve a kpi_code.
 */
async function resolveColumnAvailability(
  organizationId: string,
  gridViewState: GridViewStateSnapshot
): Promise<SavedViewColumnAvailability[]> {
  const columnIds = gridViewState.columns.map((c) => c.columnId);
  if (columnIds.length === 0) return [];

  const rows = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<{ kpi_code: string; status: string }>(
      `SELECT kpi_code, status FROM finance_analysis_kpi_catalog
        WHERE kpi_code = ANY(?) AND (organization_id IS NULL OR organization_id = ?)
        ORDER BY (status = 'ACTIVE') DESC`,
      [columnIds, organizationId]
    )
  );

  // First row per kpi_code wins — the ORDER BY puts an ACTIVE row (if any exists across catalog
  // versions/tiers for that code) ahead of a DEPRECATED/DRAFT one, so a code with both an old
  // deprecated row and a current active one is correctly reported available.
  const statusByCode = new Map<string, string>();
  for (const row of rows) {
    if (!statusByCode.has(row.kpi_code)) statusByCode.set(row.kpi_code, row.status);
  }

  return columnIds.map((columnId) => {
    const status = statusByCode.get(columnId);
    if (status === undefined) return { columnId, available: true, reason: null };
    if (status === 'ACTIVE') return { columnId, available: true, reason: null };
    return { columnId, available: false, reason: 'KPI_DEPRECATED' };
  });
}

async function loadSavedView(row: FinanceSavedViewRow): Promise<LoadedSavedView> {
  const columnAvailability = await resolveColumnAvailability(row.organization_id, row.view_state.gridViewState);
  return { ...row, columnAvailability };
}

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

export interface CreateSavedViewParams {
  organizationId: string;
  artifactId: string;
  scope: FinanceSavedViewScope;
  ownerUserId: string;
  name: string;
  /** Either a live `GridViewState` (its `.toJSON()` is used) or an already-serialized snapshot. */
  gridViewState: GridViewState | GridViewStateSnapshot;
  filters?: readonly SavedViewFilter[];
  createdBy: string;
}

export type CreateSavedViewResult =
  | { ok: true; view: FinanceSavedViewRow }
  | {
      ok: false;
      code: 'NAME_REQUIRED' | 'INVALID_FILTERS' | 'INVALID_GRID_VIEW_STATE' | 'ARTIFACT_NOT_FOUND';
      message: string;
    };

function generateShareToken(): string {
  return randomBytes(24).toString('base64url');
}

export async function createSavedView(params: CreateSavedViewParams): Promise<CreateSavedViewResult> {
  // Gate E FIX-B (proof-gaps pass, 2026-08-12) — LUKA 3: ownership is checked BEFORE any body-shape
  // validation (name/filters/gridViewState), not after. Previously a cross-tenant artifactId
  // could surface as NAME_REQUIRED/INVALID_FILTERS/INVALID_GRID_VIEW_STATE (400) instead of the
  // uniform ARTIFACT_NOT_FOUND (404) every other tenant-scoped denial in this surface already
  // returns, depending on what else was wrong with the request body — a weak, inconsistent
  // response-shape oracle (no leak, no write, but distinguishable from the normal "doesn't exist
  // anywhere" 404). artifact_type is ALSO ALWAYS derived from this real finance_artifacts row,
  // never trusted from a caller-supplied value — see migration file header ("savedViewService.ts
  // derives it FROM the artifact row").
  const artifact = await getArtifact(params.organizationId, params.artifactId);
  if (!artifact) {
    return { ok: false, code: 'ARTIFACT_NOT_FOUND', message: `No finance_artifacts row for artifact_id='${params.artifactId}' in this organization` };
  }

  if (!params.name || !params.name.trim()) {
    return { ok: false, code: 'NAME_REQUIRED', message: 'Saved view name must be non-empty' };
  }

  const filtersResult = SavedViewFilterSetSchema.safeParse(params.filters ?? []);
  if (!filtersResult.success) {
    return { ok: false, code: 'INVALID_FILTERS', message: filtersResult.error.message };
  }

  const gridViewSnapshot = params.gridViewState instanceof GridViewState ? params.gridViewState.toJSON() : params.gridViewState;
  const snapshotResult = GridViewStateSnapshotSchema.safeParse(gridViewSnapshot);
  if (!snapshotResult.success) {
    return { ok: false, code: 'INVALID_GRID_VIEW_STATE', message: snapshotResult.error.message };
  }

  const viewState: FinanceSavedViewState = {
    schemaVersion: FINANCE_SAVED_VIEW_STATE_SCHEMA_VERSION,
    gridViewState: snapshotResult.data,
    filters: filtersResult.data,
  };

  const shareToken = generateShareToken();

  const row = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<FinanceSavedViewRow>(
      `INSERT INTO finance_saved_views (
         organization_id, artifact_id, artifact_type, scope, owner_user_id, name, view_state, share_token, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
      [
        params.organizationId,
        params.artifactId,
        artifact.artifact_type,
        params.scope,
        params.ownerUserId,
        params.name,
        JSON.stringify(viewState),
        shareToken,
        params.createdBy,
      ]
    )
  );
  if (!row) throw new Error('finance_saved_views insert returned no row');
  return { ok: true, view: normalizeSavedViewRow(row) };
}

// ---------------------------------------------------------------------------
// update / delete — owner-only, regardless of scope (see file header).
// ---------------------------------------------------------------------------

export interface UpdateSavedViewPatch {
  name?: string;
  gridViewState?: GridViewState | GridViewStateSnapshot;
  filters?: readonly SavedViewFilter[];
}

export interface UpdateSavedViewParams {
  organizationId: string;
  viewId: string;
  requesterUserId: string;
  patch: UpdateSavedViewPatch;
}

export type UpdateSavedViewResult =
  | { ok: true; view: FinanceSavedViewRow }
  | { ok: false; code: 'NOT_FOUND' | 'FORBIDDEN' | 'NAME_REQUIRED' | 'INVALID_FILTERS' | 'INVALID_GRID_VIEW_STATE'; message: string };

export async function updateSavedView(params: UpdateSavedViewParams): Promise<UpdateSavedViewResult> {
  const current = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<FinanceSavedViewRow>(`SELECT * FROM finance_saved_views WHERE id = ? AND organization_id = ?`, [
      params.viewId,
      params.organizationId,
    ])
  );
  if (!current) return { ok: false, code: 'NOT_FOUND', message: 'Saved view not found' };
  if (current.owner_user_id !== params.requesterUserId) {
    return { ok: false, code: 'FORBIDDEN', message: 'Only the owner may edit a saved view (personal or team-scoped)' };
  }
  const normalizedCurrent = normalizeSavedViewRow(current);

  let name = normalizedCurrent.name;
  if (params.patch.name !== undefined) {
    if (!params.patch.name.trim()) return { ok: false, code: 'NAME_REQUIRED', message: 'Saved view name must be non-empty' };
    name = params.patch.name;
  }

  let filters = normalizedCurrent.view_state.filters;
  if (params.patch.filters !== undefined) {
    const filtersResult = SavedViewFilterSetSchema.safeParse(params.patch.filters);
    if (!filtersResult.success) return { ok: false, code: 'INVALID_FILTERS', message: filtersResult.error.message };
    filters = filtersResult.data;
  }

  let gridViewState = normalizedCurrent.view_state.gridViewState;
  if (params.patch.gridViewState !== undefined) {
    const snapshot = params.patch.gridViewState instanceof GridViewState ? params.patch.gridViewState.toJSON() : params.patch.gridViewState;
    const snapshotResult = GridViewStateSnapshotSchema.safeParse(snapshot);
    if (!snapshotResult.success) return { ok: false, code: 'INVALID_GRID_VIEW_STATE', message: snapshotResult.error.message };
    gridViewState = snapshotResult.data;
  }

  const viewState: FinanceSavedViewState = { schemaVersion: FINANCE_SAVED_VIEW_STATE_SCHEMA_VERSION, gridViewState, filters };

  const updated = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<FinanceSavedViewRow>(
      `UPDATE finance_saved_views SET name = ?, view_state = ?
        WHERE id = ? AND organization_id = ? RETURNING *`,
      [name, JSON.stringify(viewState), params.viewId, params.organizationId]
    )
  );
  if (!updated) throw new Error('finance_saved_views update returned no row');
  return { ok: true, view: normalizeSavedViewRow(updated) };
}

export type DeleteSavedViewResult = { ok: true } | { ok: false; code: 'NOT_FOUND' | 'FORBIDDEN'; message: string };

export async function deleteSavedView(
  organizationId: string,
  viewId: string,
  requesterUserId: string
): Promise<DeleteSavedViewResult> {
  return withPinnedPostgresTransaction(async (tx) => {
    const current = await tx.queryOne<FinanceSavedViewRow>(`SELECT * FROM finance_saved_views WHERE id = ? AND organization_id = ?`, [
      viewId,
      organizationId,
    ]);
    if (!current) return { ok: false, code: 'NOT_FOUND', message: 'Saved view not found' };
    if (current.owner_user_id !== requesterUserId) {
      return { ok: false, code: 'FORBIDDEN', message: 'Only the owner may delete a saved view (personal or team-scoped)' };
    }
    await tx.queryRun(`DELETE FROM finance_saved_views WHERE id = ? AND organization_id = ?`, [viewId, organizationId]);
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// list / get — visibility per file header: PERSONAL = owner only, TEAM = whole org.
// ---------------------------------------------------------------------------

export interface ListSavedViewsParams {
  organizationId: string;
  artifactId: string;
  requesterUserId: string;
}

/** Every TEAM view on this artifact, plus the requester's own PERSONAL views on it. Tenant isolation is implicit — `organization_id = ?` is always in the WHERE clause, so a view from another organization can never appear regardless of scope. */
export async function listSavedViews(params: ListSavedViewsParams): Promise<LoadedSavedView[]> {
  const rows = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<FinanceSavedViewRow>(
      `SELECT * FROM finance_saved_views
        WHERE organization_id = ? AND artifact_id = ?
          AND (scope = 'TEAM' OR (scope = 'PERSONAL' AND owner_user_id = ?))
        ORDER BY created_at DESC`,
      [params.organizationId, params.artifactId, params.requesterUserId]
    )
  );
  const normalized = rows.map(normalizeSavedViewRow);
  return Promise.all(normalized.map(loadSavedView));
}

export type GetSavedViewResult = { ok: true; view: LoadedSavedView } | { ok: false; code: 'NOT_FOUND'; message: string };

/**
 * `NOT_FOUND` covers BOTH "no such row" and "row exists but this requester
 * cannot see it" (a PERSONAL view owned by someone else) — deliberately the
 * same error code for both, so this endpoint never discloses that a
 * personal view with a given id exists at all to a non-owner.
 */
export async function getSavedView(organizationId: string, viewId: string, requesterUserId: string): Promise<GetSavedViewResult> {
  const row = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<FinanceSavedViewRow>(`SELECT * FROM finance_saved_views WHERE id = ? AND organization_id = ?`, [viewId, organizationId])
  );
  if (!row) return { ok: false, code: 'NOT_FOUND', message: 'Saved view not found' };
  const normalized = normalizeSavedViewRow(row);
  if (normalized.scope === 'PERSONAL' && normalized.owner_user_id !== requesterUserId) {
    return { ok: false, code: 'NOT_FOUND', message: 'Saved view not found' };
  }
  return { ok: true, view: await loadSavedView(normalized) };
}

// ---------------------------------------------------------------------------
// shareable URL — see file header for the authorization boundary this draws.
// ---------------------------------------------------------------------------

export interface ResolveSharedViewParams {
  shareToken: string;
  /** The REQUESTING user's own authenticated organization — never taken from the token or any client-supplied value the token itself carries. */
  organizationId: string;
  requesterUserId: string;
}

export type ResolveSharedViewResult = { ok: true; view: LoadedSavedView } | { ok: false; code: 'NOT_FOUND'; message: string };

/**
 * Looks a saved view up by its opaque `share_token` ALONE (the only reader
 * in this file allowed to do that — every other function above scopes by
 * `organization_id` from the very first query). Returns `NOT_FOUND` — never
 * a more specific "wrong org" / "not your personal view" code, to avoid
 * letting a token leak whether a view exists in a tenant/scope the caller
 * cannot see — for:
 *   - no row with this token at all;
 *   - a row that exists but belongs to a DIFFERENT organization than the
 *     caller's own authenticated `organizationId` (tenant isolation);
 *   - a PERSONAL-scoped row whose owner is not the caller.
 *
 * Callers MUST NOT treat a successful resolve as authorization to read the
 * underlying artifact's data — see file header.
 */
export async function resolveSharedView(params: ResolveSharedViewParams): Promise<ResolveSharedViewResult> {
  const row = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<FinanceSavedViewRow>(`SELECT * FROM finance_saved_views WHERE share_token = ?`, [params.shareToken])
  );
  if (!row) return { ok: false, code: 'NOT_FOUND', message: 'Saved view not found' };
  const normalized = normalizeSavedViewRow(row);
  if (normalized.organization_id !== params.organizationId) {
    return { ok: false, code: 'NOT_FOUND', message: 'Saved view not found' };
  }
  if (normalized.scope === 'PERSONAL' && normalized.owner_user_id !== params.requesterUserId) {
    return { ok: false, code: 'NOT_FOUND', message: 'Saved view not found' };
  }
  return { ok: true, view: await loadSavedView(normalized) };
}
