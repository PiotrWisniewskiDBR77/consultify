/**
 * AP-03 — FocusRestoreContract: how a future UI remembers and restores
 * keyboard focus around a command that can move or destroy the thing that
 * had focus (undo, redo, paste, a bulk op, a find jump, confirming/
 * cancelling a cell edit, or invoking a command from the palette).
 *
 * Program: `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`
 * section 10 ("Keyboard: ... focus restore ..."). Task brief:
 * `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md`
 * section 3 point 3.
 *
 * SCOPE: this file is a CONTRACT (types + pure functions), not a DOM focus
 * manager — there is no `HTMLElement.focus()` call anywhere in this package
 * (see the AP-03 report's UI-out-of-scope note, same discipline AP-01's ADR
 * applies to its own core-logic packages). A future `FinanceDataGrid` React
 * component owns the actual `ref.current.focus()` call; what it needs FROM
 * this contract is "which `CellRef` should receive focus, and should the
 * grid's selection collapse to just that cell or stay as-is" — both answered
 * by `resolveFocusRestorePatch` below.
 *
 * INTEGRATION WITH AP-00's WorkspaceState: `FinanceGridSelectionState`
 * (`server/src/types/finance/WorkspaceState.ts`) already models exactly
 * `{ activeCell, ranges }` — this file does not invent a parallel "focus"
 * field. `applyFocusRestoreToSelection` below produces a patch shaped
 * exactly like that type's own fields, so a caller can spread it directly
 * into `FinanceWorkspaceState.selection`.
 */

import type { CellRef } from '../../../types/finance/CellRef.js';
import type { FinanceGridSelectionState } from '../../../types/finance/WorkspaceState.js';
import { operationTargets, type Operation } from '../../../types/finance/Operation.js';
import type { FocusModeEffect, FocusModeSession } from '../workspace/focusModeContract.js';

// ---------------------------------------------------------------------------
// Reasons a focus-restore decision is being made — one entry per command (or
// command-outcome) in `KeyboardCommandRegistry` that can move focus. Kept as
// a closed union (not a free string) so `resolveFocusRestorePatch`'s
// collapse-vs-preserve table below is exhaustively checked by the compiler
// whenever a new reason is added.
// ---------------------------------------------------------------------------

export const FOCUS_RESTORE_REASONS = [
  'undo',
  'redo',
  'paste',
  'bulkOp',
  'findNavigate',
  'editConfirm',
  'editCancel',
  'commandPaletteInvoke',
  /** Added with the workspace-level commands: leaving focus mode returns focus to the cell AP-09's `FocusModeSession` was holding. See the AP-09 bridge at the bottom of this file. */
  'focusModeExit',
] as const;
export type FocusRestoreReason = (typeof FOCUS_RESTORE_REASONS)[number];

// ---------------------------------------------------------------------------
// Snapshot — "where was focus right before the triggering command ran".
// Captured BEFORE the command executes (the command's own effect may move
// the active cell or destroy the selection it was captured from — paste
// growing past the current viewport, undo replacing the active cell
// entirely, etc.), so the caller always has a well-defined fallback even if
// resolving the command's own "natural" focus target fails.
// ---------------------------------------------------------------------------

export interface FocusSnapshot {
  /** `null` only for a brand-new, never-focused artifact (WorkspaceState.selection.activeCell starts `null` — see `createEmptyWorkspaceState`). */
  activeCell: CellRef | null;
  reason: FocusRestoreReason;
  /** ISO-8601, client clock. */
  capturedAt: string;
}

export function captureFocusSnapshot(params: {
  activeCell: CellRef | null;
  reason: FocusRestoreReason;
  now?: () => string;
}): FocusSnapshot {
  const now = params.now ?? (() => new Date().toISOString());
  return { activeCell: params.activeCell, reason: params.reason, capturedAt: now() };
}

// ---------------------------------------------------------------------------
// Resolving WHERE focus should land after an Operation-producing command.
// ---------------------------------------------------------------------------

/**
 * Excel/Sheets convention this contract adopts: after undo/redo/paste/a bulk
 * op, focus lands on the FIRST target cell of the `Operation` that was just
 * applied (undo: the inverse `paste` AP-04's `OperationStack.undo` returns;
 * redo: the rehydrated original; paste/bulk op: the operation the engine
 * just built) — `operationTargets` (AP-00, `Operation.ts`) already defines
 * "first target" consistently across all five operation types (a `set`'s
 * one-and-only target, or index 0 of a `clear`/`paste`/`bulk_set`/`reset`
 * array), so this function does not need its own per-type branching.
 */
export function focusTargetForOperation(operation: Operation): CellRef {
  const targets = operationTargets(operation);
  // Every real Operation carries >=1 target — engines reject an empty target
  // set with EngineError('EMPTY_INPUT') before an Operation is ever built
  // (see PasteEngine/BulkOpsEngine/FindReplaceEngine), and `opXSchema`'s own
  // zod shapes enforce `.min(1)` on every array-target branch. A `targets[0]`
  // that is `undefined` here would mean an engine or the zod contract itself
  // is broken, not a case this function should silently paper over.
  const first = targets[0];
  if (!first) {
    throw new Error('focusTargetForOperation: operation has no targets (violates the AP-00 Operation contract).');
  }
  return first;
}

// ---------------------------------------------------------------------------
// Resolving the PATCH to apply to WorkspaceState.selection.
// ---------------------------------------------------------------------------

export interface FocusRestorePatch {
  activeCell: CellRef;
  /**
   * `true` — collapse the grid's (possibly multi-range) selection down to a
   * single 1x1 range at `activeCell`, mirroring `GridSelectionModel
   * .selectSingle`'s shape. Applies to reasons where the OPERATION defines a
   * new "the thing you just did" focal point that should replace whatever
   * was selected before (undo/redo/paste/bulkOp) — matches Excel's own
   * behavior of re-selecting the undone/pasted range's anchor, not the
   * selection that happened to exist beforehand.
   * `false` — leave `ranges` untouched, only move `activeCell` within the
   * existing selection shape. Applies to reasons that are not themselves a
   * grid mutation (findNavigate jumps the active cell without changing what
   * is selected; editConfirm/editCancel return focus to the cell that was
   * already the sole reason a range of size 1 existed; commandPaletteInvoke
   * returns focus to wherever it was, since the palette itself is not a
   * selection-shaping gesture).
   */
  collapseSelection: boolean;
}

const COLLAPSE_ON_REASONS: ReadonlySet<FocusRestoreReason> = new Set(['undo', 'redo', 'paste', 'bulkOp']);

export function resolveFocusRestorePatch(reason: FocusRestoreReason, target: CellRef): FocusRestorePatch {
  return { activeCell: target, collapseSelection: COLLAPSE_ON_REASONS.has(reason) };
}

/**
 * Applies a `FocusRestorePatch` to an AP-00 `FinanceGridSelectionState`,
 * producing the exact shape a caller spreads into
 * `FinanceWorkspaceState.selection`. Pure — does not mutate `selection`.
 */
export function applyFocusRestoreToSelection(
  selection: FinanceGridSelectionState,
  patch: FocusRestorePatch
): FinanceGridSelectionState {
  if (!patch.collapseSelection) {
    return { ...selection, activeCell: patch.activeCell };
  }
  return {
    activeCell: patch.activeCell,
    ranges: [{ topLeft: patch.activeCell, bottomRight: patch.activeCell }],
  };
}

// ---------------------------------------------------------------------------
// BRIDGE TO AP-09's FOCUS MODE — added 2026-08-10.
//
// Before this section the codebase carried TWO unrelated descriptions of "who
// had focus and where does it go back to":
//
//   AP-03 (this file)      `FocusSnapshot.activeCell` + `resolveFocusRestorePatch`
//   AP-09 (focusModeContract) `FocusModeSession.focusedCell` +
//                             `.restoreFocusToControlId`, returned as a
//                             `{ kind: 'move-focus' }` effect
//
// Nothing connected them and nothing tested that they agreed, so they could
// drift silently: AP-09 restoring focus to cell A while AP-03's snapshot said
// cell B would be invisible to every existing test in either package. These
// two functions are the connection, and `KeyboardCommandRegistry.test.ts`
// asserts the round trip.
//
// Direction of authority, stated so the bridge is not mistaken for a merge:
// AP-09 owns focus mode's own capture (it must, since entering focus mode is
// not a keyboard command's outcome — it can be a mouse click on the bar's
// fullscreen control). AP-03 owns what the GRID does with a restored cell.
// The bridge converts, it does not duplicate state.
// ---------------------------------------------------------------------------

/** Read AP-09's session as an AP-03 snapshot. Used when a keyboard command runs while focus mode is active and needs the pre-existing focus target. */
export function focusSnapshotFromFocusModeSession(
  session: Pick<FocusModeSession, 'focusedCell'>,
  reason: FocusRestoreReason,
  now?: () => string
): FocusSnapshot {
  return captureFocusSnapshot({ activeCell: session.focusedCell, reason, ...(now ? { now } : {}) });
}

/**
 * Convert the `move-focus` effect AP-09 emits from `exitFocusMode` into the
 * patch this contract applies to `FinanceWorkspaceState.selection`.
 *
 * `null` when the effect carries no cell (focus returns to the bar control
 * that opened focus mode, which is a DOM concern, not a selection one) or
 * when no `move-focus` effect is present at all — a no-op exit. Returning
 * `null` rather than inventing a target is deliberate: guessing a cell here
 * would move the user's selection on a toggle that AP-09 guarantees changes
 * nothing.
 */
export function focusRestorePatchFromFocusModeEffects(
  effects: readonly FocusModeEffect[]
): FocusRestorePatch | null {
  const moveFocus = effects.find((e): e is Extract<FocusModeEffect, { kind: 'move-focus' }> => e.kind === 'move-focus');
  if (!moveFocus || moveFocus.cell === null) return null;
  // 'focusModeExit' never collapses: AP-09's contract is that the toggle
  // preserves selection, filters, scroll, focus and draft. Collapsing the
  // selection here would break that guarantee from the other side.
  return resolveFocusRestorePatch('focusModeExit', moveFocus.cell);
}
