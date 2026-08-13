/**
 * AP-00 — WorkspaceState: what the frontend holds per open Finance artifact,
 * serialized for crash recovery.
 *
 * Program: `docs/validation/finance-v3/FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md`
 * section 5 (AP-00: "WorkspaceState"; AP-04: "Undo, autosave i conflicts",
 * "≤5 s crash recovery"). ADR:
 * `docs/validation/finance-v3/generated/gate-d/AP-00_shared_contracts_ADR.md`.
 *
 * This file defines the SERIALIZATION CONTRACT for crash recovery only. It
 * does NOT design AP-04's undo/redo stack semantics, autosave scheduling, or
 * mine/theirs/base conflict resolution algorithm — those are AP-04's own
 * scope (task instruction: "referencja, nie projektuj tu"). What this file
 * guarantees is: everything AP-04 needs to reconstruct a workspace after a
 * crash/reload is representable here, and round-trips through
 * JSON-serializable storage (localStorage/IndexedDB) fast enough to meet the
 * master plan's "≤5 s crash recovery ... accepted edits" budget.
 *
 * Two deliberate size-control decisions, both because a 10k x 120 grid
 * (AP-01 target = up to 1.2M logical cells) makes "just serialize
 * everything" a correctness AND a performance bug:
 *   1. Selection stores RANGE CORNERS ONLY (`topLeft`/`bottomRight`
 *      `CellRef`s), never every selected `CellRef` — the same way Excel's
 *      selection state is two corners, not N cells. `CellRef` has no
 *      universal "next cell" ordering AP-00 can define generically (each
 *      table's `rowKey`/`columnKey` shape is table-specific), so "top-left"/
 *      "bottom-right" is an opaque pair whose ordering is AP-01's own grid
 *      layout to interpret — WorkspaceState does not need to understand it,
 *      only round-trip it.
 *   2. Filters are stored as OPAQUE JSON (`raw: Record<string, unknown>`),
 *      not a designed filter model — AP-07 (Filters/saved views, P1, not
 *      yet designed) owns that shape. This file only guarantees whatever
 *      AP-07 eventually produces survives a crash-recovery round trip.
 */

import { z } from 'zod';

import { ArtifactRefSchema, type ArtifactRef } from './ArtifactRef.js';
import { CellRefSchema, type CellRef } from './CellRef.js';
import { OperationSchema, type Operation } from './Operation.js';

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

export const FinanceGridRangeSelectionSchema = z.object({
  topLeft: CellRefSchema,
  bottomRight: CellRefSchema,
});
export type FinanceGridRangeSelection = z.infer<typeof FinanceGridRangeSelectionSchema>;

export const FinanceGridSelectionStateSchema = z.object({
  activeCell: CellRefSchema.nullable(),
  /** Multi-range (ctrl/cmd-click) selection — master plan section 10 "multi-range selection". Corners only, see file header. */
  ranges: z.array(FinanceGridRangeSelectionSchema),
});
export type FinanceGridSelectionState = z.infer<typeof FinanceGridSelectionStateSchema>;

// ---------------------------------------------------------------------------
// Filters — intentionally opaque, see file header. AP-07 owns the real model.
// ---------------------------------------------------------------------------

export const FinanceGridFilterStateSchema = z.object({
  raw: z.record(z.string(), z.unknown()),
});
export type FinanceGridFilterState = z.infer<typeof FinanceGridFilterStateSchema>;

// ---------------------------------------------------------------------------
// Scroll
// ---------------------------------------------------------------------------

export const FinanceGridScrollStateSchema = z.object({
  scrollTop: z.number().min(0),
  scrollLeft: z.number().min(0),
  /** Best-effort anchor for scroll restoration after a reload — opaque, AP-01-defined identifier of the first fully-visible row (NOT necessarily a full CellRef, since a row header may not itself be an addressable cell in every table). */
  firstVisibleRowKey: z.unknown().nullable(),
});
export type FinanceGridScrollState = z.infer<typeof FinanceGridScrollStateSchema>;

// ---------------------------------------------------------------------------
// Unsaved operation stack — the crash-recovery core.
// ---------------------------------------------------------------------------

export const FinanceUnsavedOperationStackEntrySchema = z.object({
  operation: OperationSchema,
  /** ISO-8601, client clock, when the operation was applied locally (optimistic UI). */
  appliedAt: z.string().min(1),
  /** False until the batch containing this operation round-trips a successful `ApplyOperationsBatchResult` from the server. Crash recovery replays entries with `committed: false`; entries with `committed: true` are retained only until the next successful checkpoint prunes them (AP-04's own scope — this field just carries the fact). */
  committed: z.boolean(),
});
export type FinanceUnsavedOperationStackEntry = z.infer<typeof FinanceUnsavedOperationStackEntrySchema>;

// ---------------------------------------------------------------------------
// FinanceWorkspaceState — the full per-artifact, per-user serialization unit.
// ---------------------------------------------------------------------------

export const FINANCE_WORKSPACE_STATE_SCHEMA_VERSION = 1 as const;

export const FinanceWorkspaceStateSchema = z.object({
  /**
   * This file's OWN serialization version — independent of
   * `engine_manifest_id`/`business_version_id`. Bump on any breaking shape
   * change to this schema so AP-04's crash-recovery loader can detect and
   * discard an incompatible persisted blob (e.g. from a previous deploy)
   * instead of crashing while trying to parse it.
   */
  schemaVersion: z.literal(FINANCE_WORKSPACE_STATE_SCHEMA_VERSION),
  organizationId: z.string().min(1),
  /** Workspace state is per-user, not shared — distinct from the artifact's own multi-user Draft content. */
  userId: z.string().min(1),
  artifactRef: ArtifactRefSchema,
  openedAt: z.string().min(1),
  lastLocalEditAt: z.string().min(1).nullable(),
  selection: FinanceGridSelectionStateSchema,
  filters: FinanceGridFilterStateSchema,
  scroll: FinanceGridScrollStateSchema,
  /** Ordered oldest-first; AP-04 replays this on crash recovery. No max-length enforced by this contract — see the ADR's escalation section for why an eviction/bound policy is flagged as an open question, not decided here. */
  unsavedOperationStack: z.array(FinanceUnsavedOperationStackEntrySchema),
  /** The `working_revision_id` this local state was built against — the workspace-level analogue of `Operation.sourceWorkingRevisionId`, used as the "as of" pin for AP-04's mine/theirs/base conflict resolution. */
  sourceWorkingRevisionId: z.string().min(1).nullable(),
});
export type FinanceWorkspaceState = z.infer<typeof FinanceWorkspaceStateSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function createEmptyWorkspaceState(params: {
  organizationId: string;
  userId: string;
  artifactRef: ArtifactRef;
  sourceWorkingRevisionId: string | null;
  now?: () => string;
}): FinanceWorkspaceState {
  const now = params.now ?? (() => new Date().toISOString());
  return {
    schemaVersion: FINANCE_WORKSPACE_STATE_SCHEMA_VERSION,
    organizationId: params.organizationId,
    userId: params.userId,
    artifactRef: params.artifactRef,
    openedAt: now(),
    lastLocalEditAt: null,
    selection: { activeCell: null, ranges: [] },
    filters: { raw: {} },
    scroll: { scrollTop: 0, scrollLeft: 0, firstVisibleRowKey: null },
    unsavedOperationStack: [],
    sourceWorkingRevisionId: params.sourceWorkingRevisionId,
  };
}

export function hasUncommittedEdits(state: Pick<FinanceWorkspaceState, 'unsavedOperationStack'>): boolean {
  return state.unsavedOperationStack.some((entry) => !entry.committed);
}

/** Every `CellRef` any uncommitted operation in the stack targets — AP-04's crash-recovery replay entry point. */
export function uncommittedTargets(state: Pick<FinanceWorkspaceState, 'unsavedOperationStack'>): CellRef[] {
  const targets: CellRef[] = [];
  for (const entry of state.unsavedOperationStack) {
    if (entry.committed) continue;
    const op: Operation = entry.operation;
    if (op.type === 'set') {
      targets.push(op.target);
    } else {
      targets.push(...op.target);
    }
  }
  return targets;
}

export type WorkspaceStateParseResult =
  | { ok: true; state: FinanceWorkspaceState }
  | { ok: false; code: 'INVALID_WORKSPACE_STATE' | 'UNSUPPORTED_SCHEMA_VERSION'; message: string };

/** Runtime validation entry point for a persisted blob (localStorage/IndexedDB) — mirrors the `{ ok }` convention used throughout `server/src/services/finance/canonical/*.ts`. Checks `schemaVersion` FIRST and returns a distinct error code so the caller can decide to discard-and-recreate rather than surface a confusing generic parse error. */
export function parseWorkspaceState(input: unknown): WorkspaceStateParseResult {
  if (typeof input === 'object' && input !== null && 'schemaVersion' in input) {
    const version = (input as { schemaVersion?: unknown }).schemaVersion;
    if (version !== FINANCE_WORKSPACE_STATE_SCHEMA_VERSION) {
      return {
        ok: false,
        code: 'UNSUPPORTED_SCHEMA_VERSION',
        message: `Expected schemaVersion ${FINANCE_WORKSPACE_STATE_SCHEMA_VERSION}, got ${String(version)}`,
      };
    }
  }
  const result = FinanceWorkspaceStateSchema.safeParse(input);
  if (!result.success) {
    return { ok: false, code: 'INVALID_WORKSPACE_STATE', message: result.error.message };
  }
  return { ok: true, state: result.data };
}
