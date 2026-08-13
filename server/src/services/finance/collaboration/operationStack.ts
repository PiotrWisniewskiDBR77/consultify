/**
 * AP-04 — OperationStack: in-memory, per-open-artifact undo/redo stack.
 *
 * Program: `docs/validation/finance-v3/FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md`
 * section 5 (AP-04: "Undo, autosave i conflicts"). Task brief:
 * `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md`
 * section 3 point 4 ("session-level stack, atomowe cofniecie bulk/paste").
 * ADR: `docs/validation/finance-v3/generated/gate-d/AP-04_undo_autosave_conflicts_ADR.md`.
 *
 * Builds directly on AP-00's `Operation` discriminated union
 * (`server/src/types/finance/Operation.ts`) rather than inventing a parallel
 * "edit" type — one `Operation` (set/clear/paste/bulk_set/reset) IS one undo
 * unit. This is what makes bulk/paste undo ATOMIC BY CONSTRUCTION: a
 * `paste`/`bulk_set`/`clear`/`reset` already bundles every targeted `CellRef`
 * into ONE `Operation` object (AP-00 ADR section 6.1), so one stack entry ==
 * one whole Operation == one undo step that reverts every targeted cell in a
 * single move, never cell-by-cell. No separate "batch id" grouping concept is
 * needed on top of what AP-00 already shipped.
 *
 * Pure, DB-free (zero imports from `pg`/`DbPromise`/Express) — mirrors
 * `lifecycleService.ts`'s discipline of a fully unit-testable-without-Postgres
 * module (WP-C02 report section 2's design goal for that file, applied here).
 */

import type { FinanceRole } from '../canonical/lifecycleService.js';
import type { FinanceValue } from '../../../types/finance/financeValueSemantics.js';
import { operationTargets, type Operation, type FinanceValueInput } from '../../../types/finance/Operation.js';

// ---------------------------------------------------------------------------
// Depth — configurable, not hardcoded, default satisfies the task brief's
// "min. 50 poziomow" floor.
// ---------------------------------------------------------------------------

export const DEFAULT_MAX_UNDO_DEPTH = 50;

// ---------------------------------------------------------------------------
// Stack entry
// ---------------------------------------------------------------------------

export interface OperationStackEntry {
  operation: Operation;
  /**
   * The value at each target cell IMMEDIATELY BEFORE this operation was
   * applied, aligned by index with `operationTargets(operation)`. `null`
   * means the cell had no value yet (equivalent to MISSING). Captured at
   * `push()` time by the caller (the grid/executor, which is the only thing
   * that actually knows the pre-edit state) — this is what lets `undo()`
   * build an exact, atomic inverse without querying anything.
   */
  priorValues: (FinanceValue | null)[];
  /** ISO-8601, when this entry was pushed (local/client clock). */
  pushedAt: string;
}

// ---------------------------------------------------------------------------
// Undo/redo results
// ---------------------------------------------------------------------------

export interface UndoRedoMintParams {
  /** Fresh, caller-generated identity for the operation this undo/redo step produces — never reuse the original entry's ids (see doc comments on buildInverseOperation/rehydrateOperation below for why). */
  operationId: string;
  idempotencyKey: string;
  actorId: string;
  actorRole: FinanceRole;
  clientTimestamp: string;
  /** The working_revision_id this undo/redo is composed against RIGHT NOW — not necessarily the same one the original operation was composed against, if a checkpoint has landed since. */
  sourceWorkingRevisionId: string | null;
}

export type UndoResult =
  | { ok: true; undoneEntry: OperationStackEntry; inverseOperation: Operation }
  | { ok: false; code: 'NOTHING_TO_UNDO' };

export type RedoResult =
  | { ok: true; redoneEntry: OperationStackEntry; operation: Operation }
  | { ok: false; code: 'NOTHING_TO_REDO' };

// ---------------------------------------------------------------------------
// OperationStack
// ---------------------------------------------------------------------------

export class OperationStack {
  private entries: OperationStackEntry[] = [];
  /** Number of entries currently "applied" (undoable). entries[cursor..] is the redo branch. */
  private cursor = 0;
  readonly maxDepth: number;

  constructor(options: { maxDepth?: number } = {}) {
    const maxDepth = options.maxDepth ?? DEFAULT_MAX_UNDO_DEPTH;
    if (!Number.isInteger(maxDepth) || maxDepth < 1) {
      throw new Error(`OperationStack: maxDepth must be a positive integer, got ${maxDepth}`);
    }
    this.maxDepth = maxDepth;
  }

  /**
   * Push a newly-applied operation. Standard undo-stack semantics: discards
   * any redo branch (a new edit after undoing invalidates redo — the same
   * behavior Excel/Sheets/every editor uses), then evicts the OLDEST entry
   * once `maxDepth` is exceeded (a bounded, not unbounded, stack — directly
   * addresses AP-00 ADR section 10 point 3's flagged open risk: "an analyst
   * who leaves a Draft open ... could accumulate an unbounded stack").
   */
  push(operation: Operation, priorValues: (FinanceValue | null)[]): void {
    const targets = operationTargets(operation);
    if (priorValues.length !== targets.length) {
      throw new Error(
        `OperationStack.push: priorValues.length (${priorValues.length}) must equal operation target count (${targets.length}) for operation ${operation.operationId}`
      );
    }
    this.entries = this.entries.slice(0, this.cursor);
    this.entries.push({ operation, priorValues, pushedAt: new Date().toISOString() });
    if (this.entries.length > this.maxDepth) {
      this.entries.shift();
    }
    this.cursor = this.entries.length;
  }

  canUndo(): boolean {
    return this.cursor > 0;
  }

  canRedo(): boolean {
    return this.cursor < this.entries.length;
  }

  /** Total entries currently held (undo + redo branches combined). */
  depth(): number {
    return this.entries.length;
  }

  undoDepthRemaining(): number {
    return this.cursor;
  }

  redoDepthRemaining(): number {
    return this.entries.length - this.cursor;
  }

  /** Non-mutating peek — for a UI "Undo <description>" affordance. */
  peekUndo(): OperationStackEntry | null {
    return this.canUndo() ? this.entries[this.cursor - 1] : null;
  }

  peekRedo(): OperationStackEntry | null {
    return this.canRedo() ? this.entries[this.cursor] : null;
  }

  /**
   * Undo the most recent entry. Returns a single inverse `Operation`
   * (always shape `paste`, see `buildInverseOperation` below) that reverts
   * EVERY target cell of the undone entry in one move — the atomic
   * bulk/paste undo the task brief requires. Does not itself apply the
   * inverse; the caller submits it through the normal
   * `ApplyOperationsBatchRequest` executor path (AP-00 ADR section 6.2), the
   * same as any other edit.
   */
  undo(mint: UndoRedoMintParams): UndoResult {
    if (!this.canUndo()) return { ok: false, code: 'NOTHING_TO_UNDO' };
    const entry = this.entries[this.cursor - 1];
    this.cursor -= 1;
    return { ok: true, undoneEntry: entry, inverseOperation: buildInverseOperation(entry, mint) };
  }

  /**
   * Redo replays the ORIGINAL operation that was undone, re-minted with a
   * fresh operation identity (see `rehydrateOperation` below).
   */
  redo(mint: UndoRedoMintParams): RedoResult {
    if (!this.canRedo()) return { ok: false, code: 'NOTHING_TO_REDO' };
    const entry = this.entries[this.cursor];
    this.cursor += 1;
    return { ok: true, redoneEntry: entry, operation: rehydrateOperation(entry.operation, mint) };
  }

  /** Full entry list, oldest-first — the serialization source for `WorkspaceState.unsavedOperationStack` (server/src/types/finance/WorkspaceState.ts) and for `AutosaveService.checkpointOperationStack`. */
  toArray(): readonly OperationStackEntry[] {
    return this.entries.slice();
  }

  /** Current cursor position, for serialization round-trips (`fromEntries`). */
  cursorPosition(): number {
    return this.cursor;
  }

  /** Reconstruct a stack from a previously-serialized entry list — the crash-recovery entry point (`crashRecoveryService.ts`). Truncates to `maxDepth` from the end (most recent entries win) if the persisted list is longer than the configured depth. */
  static fromEntries(
    entries: readonly OperationStackEntry[],
    options: { maxDepth?: number; cursor?: number } = {}
  ): OperationStack {
    const stack = new OperationStack({ maxDepth: options.maxDepth });
    const bounded = entries.length > stack.maxDepth ? entries.slice(entries.length - stack.maxDepth) : entries.slice();
    stack.entries = bounded;
    const requestedCursor = options.cursor ?? bounded.length;
    stack.cursor = Math.max(0, Math.min(requestedCursor, bounded.length));
    return stack;
  }
}

// ---------------------------------------------------------------------------
// Inverse construction
// ---------------------------------------------------------------------------

function financeValueToInput(value: FinanceValue | null): FinanceValueInput {
  if (value === null) {
    return { status: 'MISSING', valueDecimal: null };
  }
  return {
    status: value.status,
    valueDecimal: value.valueDecimal,
    nativeCurrency: value.nativeCurrency,
    presentationCurrency: value.presentationCurrency,
    unit: value.unit,
    multiplier: value.multiplier,
    sourceRef: value.sourceRef,
    isAdjustment: value.isAdjustment,
    adjustmentReason: value.adjustmentReason,
  };
}

/**
 * The inverse of ANY stack entry — regardless of whether the original
 * operation was `set`/`bulk_set`/`paste`/`clear`/`reset` — is always ONE
 * `paste` operation writing `priorValues` back to every target the original
 * operation touched. This is deliberate, not a simplification that loses
 * information: `priorValues` was captured before the entry's Operation was
 * applied, so replaying it exactly undoes that Operation's effect, whatever
 * it was — `clear`'s inverse restores whatever was cleared, `reset`'s
 * inverse restores whatever local edit the reset discarded. One Operation
 * in, one Operation out, all targets at once — the atomic guarantee the task
 * brief asks for ("cofa CALY Operation ... jednym ruchem, nie komorka po
 * komorce").
 */
function buildInverseOperation(entry: OperationStackEntry, mint: UndoRedoMintParams): Operation {
  const targets = operationTargets(entry.operation);
  const values = entry.priorValues.map(financeValueToInput);
  return {
    type: 'paste',
    operationId: mint.operationId,
    idempotencyKey: mint.idempotencyKey,
    actorId: mint.actorId,
    actorRole: mint.actorRole,
    clientTimestamp: mint.clientTimestamp,
    sourceWorkingRevisionId: mint.sourceWorkingRevisionId,
    target: targets,
    values,
  };
}

/**
 * Redo replays the ORIGINAL operation's target/value payload verbatim, but
 * with a FRESH `operationId`/`idempotencyKey`/`clientTimestamp`/
 * `sourceWorkingRevisionId`. Reusing the stale ones would be wrong two ways:
 * (a) the original `idempotencyKey` may already be recorded against the
 * undo's inverse-apply attempt, so replaying it verbatim risks a spurious
 * idempotent-replay match against the WRONG mutation; (b) `sourceWorkingRevisionId`
 * pinned a working revision that has, correctly, since moved (the undo
 * itself created a new checkpoint) — resubmitting the stale pin would fail
 * the executor's CAS check for no real reason.
 */
function rehydrateOperation(original: Operation, mint: UndoRedoMintParams): Operation {
  return {
    ...original,
    operationId: mint.operationId,
    idempotencyKey: mint.idempotencyKey,
    clientTimestamp: mint.clientTimestamp,
    sourceWorkingRevisionId: mint.sourceWorkingRevisionId,
  } as Operation;
}

// ---------------------------------------------------------------------------
// Shared helper — every Operation type's per-target intended VALUE, aligned
// by index with `operationTargets(operation)`. Exported because
// `conflictResolver.ts` needs the exact same projection to build its "mine"/
// "theirs" per-cell maps from raw Operation payloads — one implementation,
// not two copies that could drift.
// ---------------------------------------------------------------------------

const MISSING_INPUT: FinanceValueInput = { status: 'MISSING', valueDecimal: null };

export function operationIntendedValues(operation: Operation): (FinanceValueInput | null)[] {
  switch (operation.type) {
    case 'set':
      return [operation.value];
    case 'bulk_set':
      return operation.target.map(() => operation.value);
    case 'paste':
      return operation.values;
    case 'clear':
      return operation.target.map(() => MISSING_INPUT);
    case 'reset':
      // The post-reset value is whatever the parent business_version holds —
      // unknown to this pure, DB-free layer. `null` signals "unresolvable
      // without a DB read", which conflictResolver.ts treats as
      // "needs explicit MERGE_PER_CELL", never as a silent guess.
      return operation.target.map(() => null);
    default: {
      const _exhaustive: never = operation;
      return _exhaustive;
    }
  }
}
