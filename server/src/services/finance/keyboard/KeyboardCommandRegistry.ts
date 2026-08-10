/**
 * AP-03 — KeyboardCommandRegistry: the declarative key-combo -> action map
 * (task scope item "a"), plus the runtime registry that indexes it by
 * context and validates it has no combo collisions.
 *
 * Program: `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`
 * section 10. Task brief:
 * `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md`
 * section 3 point 3 ("pelna nawigacja i edycja, copy/paste, undo/redo, find,
 * save, edit, delete, select oraz skroty Compute/Compare/Comments").
 * ADR context for the engines these commands bind to: AP-01 grid engines
 * (`../grid/*.ts`), AP-04 undo/autosave/compute-pinning
 * (`../collaboration/{operationStack,autosaveService,computePinning}.ts`),
 * AP-05 Compare (`../canonical/financeCompareService.ts`), AP-06 Comments
 * (`../canonical/commentService.ts`).
 *
 * COLLISION SCOPE, documented judgment call: uniqueness is checked PER
 * `context`, not globally. A key combo meaning two different things in two
 * different contexts is standard editor behavior, not a bug — `Enter` is
 * "start editing the active cell" when `context: 'grid-focused'` and
 * "confirm the in-progress edit" when `context: 'cell-editing'` in every
 * spreadsheet application this program is modeled on (Excel, Sheets, Airtable
 * ...). A single global combo->command map would make that ordinary pattern
 * unrepresentable. What this registry DOES forbid is two commands with the
 * IDENTICAL `(context, combo)` pair — that is an unresolvable ambiguity, not
 * a deliberate mode switch — enforced by `assertNoComboCollisions` below, run
 * automatically by the `KeyboardCommandRegistry` constructor AND exercised
 * directly by the AP-03 test suite (task scope item 5).
 */

import type { CommandContext, CommandEngineBinding, KeyboardCommand, KeyboardEventLike, Platform } from './commandTypes.js';
import { comboIdentity, comboMatchesEvent } from './commandTypes.js';

// ---------------------------------------------------------------------------
// Reusable engine bindings — several commands over the SAME underlying
// engine function (Delete vs Backspace both clear; four arrow keys all call
// `GridSelectionModel.selectSingle`) share one binding object rather than
// four textually-identical copies drifting apart under future edits.
// ---------------------------------------------------------------------------

const BULK_CLEAR_BINDING: CommandEngineBinding = {
  kind: 'function',
  engine: 'AP-01',
  module: 'services/finance/grid/BulkOpsEngine.ts',
  functionName: 'buildBulkOperations',
  note: "Call with { kind: 'CLEAR', targets: <selected CellRefs> } — forces value_status to MISSING for every selected cell (Operation.ts's own distinction: CLEAR, never RESET, is what a keyboard Delete/Backspace means).",
};

const NAVIGATE_BINDING: CommandEngineBinding = {
  kind: 'function',
  engine: 'AP-01',
  module: 'services/finance/grid/GridSelectionModel.ts',
  functionName: 'selectSingle',
  note: 'Target coordinate = the active cell shifted by one row/col in the arrow`s direction, clamped to [0, rowCount)/[0, colCount) via `isCoordInBounds` (gridCoordinates.ts) — that arithmetic is resolver-owned (AP-03), not an AP-01 export; `selectSingle` itself just replaces the selection with the resolved 1x1 coordinate.',
};

const EXTEND_BINDING: CommandEngineBinding = {
  kind: 'function',
  engine: 'AP-01',
  module: 'services/finance/grid/GridSelectionModel.ts',
  functionName: 'extendTo',
  note: 'Same resolver-owned coordinate arithmetic as `NAVIGATE_BINDING`, but calls `extendTo` instead of `selectSingle` so the gesture extends from `anchorCell` (Excel shift+arrow semantics) rather than replacing the selection.',
};

// ---------------------------------------------------------------------------
// The registry data — task scope item "a": "kazda komenda ma: key combo
// (cross-platform Mac/Windows), handler function reference ..., context ...,
// opisowa etykieta". Grouped standard-then-finance-specific, matching the
// task brief's own two-part listing.
// ---------------------------------------------------------------------------

export const FINANCE_KEYBOARD_COMMANDS: readonly KeyboardCommand[] = [
  // --- Standard shortcuts ---------------------------------------------------
  {
    id: 'grid.copy',
    combo: { key: 'c', mod: true },
    context: 'grid-focused',
    category: 'clipboard',
    label: 'Copy',
    description: 'Copy the selected cell(s) to the clipboard.',
    engineBinding: {
      kind: 'function',
      engine: 'AP-01',
      module: 'services/finance/grid/GridSelectionModel.ts',
      functionName: 'iterateCells',
      note: 'AP-01 has no dedicated "copy" builder (only paste consumes a source block, per PasteEngine.ts`s own file header). Copy walks `GridSelectionModel.iterateCells()` and reads each coordinate`s value from the caller-owned cell-value store (the same `GridCellSnapshot` source `FindReplaceEngine.ts` documents this package never owns) to serialize a TSV/clipboard payload — AP-03-owned glue on top of the one AP-01 read primitive that actually exists for this.',
    },
    focusRestoreReason: null,
  },
  {
    id: 'grid.paste',
    combo: { key: 'v', mod: true },
    context: 'grid-focused',
    category: 'clipboard',
    label: 'Paste',
    description: 'Paste clipboard contents as a rectangular block anchored at the active cell.',
    engineBinding: {
      kind: 'function',
      engine: 'AP-01',
      module: 'services/finance/grid/PasteEngine.ts',
      functionName: 'buildPasteOperations',
    },
    focusRestoreReason: 'paste',
  },
  {
    id: 'grid.undo',
    combo: { key: 'z', mod: true },
    context: 'grid-focused',
    category: 'history',
    label: 'Undo',
    description: 'Undo the last operation — atomic: reverts every cell a bulk/paste operation touched in one move.',
    engineBinding: {
      kind: 'function',
      engine: 'AP-04',
      module: 'services/finance/collaboration/operationStack.ts',
      functionName: 'undo',
      note: 'Instance method on the artifact`s open `OperationStack`. Returns an inverse `Operation` the resolver still has to submit through the normal `ApplyOperationsBatchRequest` executor path (AP-00 ADR section 6.2) — `undo()` itself does not apply anything.',
    },
    focusRestoreReason: 'undo',
  },
  {
    id: 'grid.redo',
    combo: { key: 'z', mod: true, shift: true },
    context: 'grid-focused',
    category: 'history',
    label: 'Redo',
    description: 'Redo the most recently undone operation.',
    engineBinding: {
      kind: 'function',
      engine: 'AP-04',
      module: 'services/finance/collaboration/operationStack.ts',
      functionName: 'redo',
      note: 'Instance method on the same `OperationStack`; replays the original operation with a freshly-minted operation identity (see `rehydrateOperation`\'s doc comment in `operationStack.ts` for why the ids cannot be reused verbatim).',
    },
    focusRestoreReason: 'redo',
  },
  {
    id: 'grid.find',
    combo: { key: 'f', mod: true },
    context: 'grid-focused',
    category: 'search',
    label: 'Find',
    description: 'Open find and scan visible cells against a value/status predicate.',
    engineBinding: {
      kind: 'function',
      engine: 'AP-01',
      module: 'services/finance/grid/FindReplaceEngine.ts',
      functionName: 'findCells',
      note: 'Predicate is caller-composed from `byStatus`/`byDecimalEquals`/`byDecimalInRange`/`byNoConfirmedValue` (same module) or a free-form closure — this command only opens the find UI / runs the scan, not the subsequent Replace step (no Replace shortcut is in the task`s standard-shortcut list; Replace is UI-driven after Find, using `buildFindReplaceOperations` in the same module).',
    },
    focusRestoreReason: 'findNavigate',
  },
  {
    id: 'grid.save',
    combo: { key: 's', mod: true },
    context: 'global',
    category: 'file',
    label: 'Save',
    description: 'Explicitly checkpoint the operation stack (in addition to autosave).',
    engineBinding: {
      kind: 'function',
      engine: 'AP-04',
      module: 'services/finance/collaboration/autosaveService.ts',
      functionName: 'checkpointOperationStack',
    },
    focusRestoreReason: null,
  },
  {
    id: 'grid.clearDelete',
    combo: { key: 'Delete' },
    context: 'grid-focused',
    category: 'editing',
    label: 'Clear',
    description: 'Clear the selected cell(s) — sets value_status to MISSING.',
    engineBinding: BULK_CLEAR_BINDING,
    focusRestoreReason: null,
  },
  {
    id: 'grid.clearBackspace',
    combo: { key: 'Backspace' },
    context: 'grid-focused',
    category: 'editing',
    label: 'Clear',
    description: 'Clear the selected cell(s) — sets value_status to MISSING. (Backspace alias of Delete, matching Excel/Sheets.)',
    engineBinding: BULK_CLEAR_BINDING,
    focusRestoreReason: null,
  },
  {
    id: 'grid.navigateUp',
    combo: { key: 'ArrowUp' },
    context: 'grid-focused',
    category: 'navigation',
    label: 'Move up',
    description: 'Move the active cell one row up, replacing the current selection.',
    engineBinding: NAVIGATE_BINDING,
    focusRestoreReason: null,
  },
  {
    id: 'grid.navigateDown',
    combo: { key: 'ArrowDown' },
    context: 'grid-focused',
    category: 'navigation',
    label: 'Move down',
    description: 'Move the active cell one row down, replacing the current selection.',
    engineBinding: NAVIGATE_BINDING,
    focusRestoreReason: null,
  },
  {
    id: 'grid.navigateLeft',
    combo: { key: 'ArrowLeft' },
    context: 'grid-focused',
    category: 'navigation',
    label: 'Move left',
    description: 'Move the active cell one column left, replacing the current selection.',
    engineBinding: NAVIGATE_BINDING,
    focusRestoreReason: null,
  },
  {
    id: 'grid.navigateRight',
    combo: { key: 'ArrowRight' },
    context: 'grid-focused',
    category: 'navigation',
    label: 'Move right',
    description: 'Move the active cell one column right, replacing the current selection.',
    engineBinding: NAVIGATE_BINDING,
    focusRestoreReason: null,
  },
  {
    id: 'grid.extendUp',
    combo: { key: 'ArrowUp', shift: true },
    context: 'grid-focused',
    category: 'navigation',
    label: 'Extend selection up',
    description: 'Extend the current range selection one row up from the gesture anchor.',
    engineBinding: EXTEND_BINDING,
    focusRestoreReason: null,
  },
  {
    id: 'grid.extendDown',
    combo: { key: 'ArrowDown', shift: true },
    context: 'grid-focused',
    category: 'navigation',
    label: 'Extend selection down',
    description: 'Extend the current range selection one row down from the gesture anchor.',
    engineBinding: EXTEND_BINDING,
    focusRestoreReason: null,
  },
  {
    id: 'grid.extendLeft',
    combo: { key: 'ArrowLeft', shift: true },
    context: 'grid-focused',
    category: 'navigation',
    label: 'Extend selection left',
    description: 'Extend the current range selection one column left from the gesture anchor.',
    engineBinding: EXTEND_BINDING,
    focusRestoreReason: null,
  },
  {
    id: 'grid.extendRight',
    combo: { key: 'ArrowRight', shift: true },
    context: 'grid-focused',
    category: 'navigation',
    label: 'Extend selection right',
    description: 'Extend the current range selection one column right from the gesture anchor.',
    engineBinding: EXTEND_BINDING,
    focusRestoreReason: null,
  },
  {
    id: 'grid.confirmEdit',
    combo: { key: 'Enter' },
    context: 'cell-editing',
    category: 'editing',
    label: 'Confirm edit',
    description: 'Commit the in-progress cell edit as a single-cell set Operation.',
    engineBinding: {
      kind: 'inline-contract',
      engine: 'AP-00',
      module: 'types/finance/Operation.ts',
      contractType: 'OpSet',
      note: "No AP-01/AP-04 engine builds a single-cell 'set' Operation — PasteEngine/BulkOpsEngine/FindReplaceEngine all build multi-cell batches (paste/bulk_set), and OperationStack only ever emits the inverse of an already-applied one. A single confirmed cell edit is a direct literal against Operation.ts's own OpSet shape (type: 'set', target: CellRef, value: FinanceValueInput), stamped with the same actor/idempotency/sourceWorkingRevisionId fields every engine's EngineMutationContext already carries, then submitted through the identical ApplyOperationsBatchRequest executor path as every other engine's output. Documented contract gap, not an invented convention — mirrors how PasteEngine.ts documents its own FORMULAS_ONLY/FORMATS_ONLY gap.",
    },
    focusRestoreReason: 'editConfirm',
  },
  {
    id: 'grid.cancelEdit',
    combo: { key: 'Escape' },
    context: 'cell-editing',
    category: 'editing',
    label: 'Cancel edit',
    description: 'Discard the in-progress cell edit buffer without submitting an Operation.',
    engineBinding: {
      kind: 'keyboard-owned',
      note: 'Pure local UI state discard — the edit buffer never became an Operation, so there is nothing to submit and no AP-01/AP-04 engine call at all.',
    },
    focusRestoreReason: 'editCancel',
  },
  {
    id: 'grid.nextCellTab',
    combo: { key: 'Tab' },
    context: 'grid-focused',
    category: 'navigation',
    label: 'Next cell',
    description: 'Move the active cell one column right, wrapping to the start of the next row at the row end.',
    engineBinding: {
      kind: 'function',
      engine: 'AP-01',
      module: 'services/finance/grid/GridSelectionModel.ts',
      functionName: 'selectSingle',
      note: 'Row-wrap arithmetic (col == colCount-1 -> col=0, row+=1) is resolver-owned (AP-03), same split as `NAVIGATE_BINDING`.',
    },
    focusRestoreReason: null,
  },

  // --- Finance-specific shortcuts (task brief: "skroty Compute/Compare/Comments") ---
  {
    id: 'finance.compute',
    combo: { key: 'Enter', mod: true },
    context: 'grid-focused',
    category: 'finance',
    label: 'Compute',
    description: "Enqueue a compute job pinned to the artifact's current working-revision content hash.",
    engineBinding: {
      kind: 'function',
      engine: 'AP-04',
      module: 'services/finance/collaboration/computePinning.ts',
      functionName: 'enqueueComputeForCurrentRevision',
    },
    focusRestoreReason: null,
  },
  {
    id: 'finance.compare',
    combo: { key: 'd', mod: true },
    context: 'grid-focused',
    category: 'finance',
    label: 'Compare',
    description: 'Open Compare against the currently configured second source (period/version/entity/scenario/method).',
    engineBinding: {
      kind: 'function',
      engine: 'AP-05',
      module: 'services/finance/canonical/financeCompareService.ts',
      functionName: 'compareValues',
      note: 'Generic primitive every named wrapper (comparePeriods/compareVersions/compareEntities/compareScenarios/compareValuationMethods/compareActualVsForecast, same module) delegates to. Which wrapper actually runs is a UI-state decision (the workspace`s currently active Compare axis) made by the resolver, not by this registry entry — the binding documents the shared primitive, not one fixed axis.',
    },
    focusRestoreReason: null,
  },
  {
    id: 'finance.comment',
    combo: { key: 'm', mod: true },
    context: 'grid-focused',
    category: 'finance',
    label: 'Comment',
    description: 'Open a new comment composer anchored at the active cell.',
    engineBinding: {
      kind: 'function',
      engine: 'AP-06',
      module: 'services/finance/canonical/commentService.ts',
      functionName: 'createComment',
      note: "`anchor` = the active cell's CellRef (AP-00) — omitted/null would create an artifact-level comment instead, which this shortcut does not do (a future artifact-level comment entry point is a separate, unbound command, out of this registry's current scope).",
    },
    focusRestoreReason: null,
  },
];

// ---------------------------------------------------------------------------
// Collision detection — task scope item 5 ("kazda komenda w rejestrze ma
// unikalny key combo, brak kolizji"), scoped per `context` (see file header).
// ---------------------------------------------------------------------------

export interface ComboCollision {
  context: CommandContext;
  comboIdentity: string;
  commandIds: readonly string[];
}

/** Pure check — returns every `(context, combo)` group with more than one command, or `[]` if the registry is collision-free. Exported so the test suite (task scope item 5) can assert against it directly without relying on the constructor throwing. */
export function findComboCollisions(commands: readonly KeyboardCommand[]): ComboCollision[] {
  const groups = new Map<string, { context: CommandContext; comboIdentity: string; commandIds: string[] }>();
  for (const command of commands) {
    const key = `${command.context}::${comboIdentity(command.combo)}`;
    const existing = groups.get(key);
    if (existing) {
      existing.commandIds.push(command.id);
    } else {
      groups.set(key, { context: command.context, comboIdentity: comboIdentity(command.combo), commandIds: [command.id] });
    }
  }
  return [...groups.values()].filter((g) => g.commandIds.length > 1);
}

export function assertNoComboCollisions(commands: readonly KeyboardCommand[]): void {
  const collisions = findComboCollisions(commands);
  if (collisions.length > 0) {
    const detail = collisions
      .map((c) => `[${c.context}] ${c.comboIdentity} <- ${c.commandIds.join(', ')}`)
      .join('; ');
    throw new Error(`KeyboardCommandRegistry: combo collision(s) detected: ${detail}`);
  }
}

// ---------------------------------------------------------------------------
// KeyboardCommandRegistry — the runtime lookup surface a future resolver
// (task scope item "b") queries: "given this context and this KeyboardEvent-
// like input, which command (if any) fires".
// ---------------------------------------------------------------------------

export class KeyboardCommandRegistry {
  private readonly commands: readonly KeyboardCommand[];

  constructor(commands: readonly KeyboardCommand[] = FINANCE_KEYBOARD_COMMANDS) {
    assertNoComboCollisions(commands);
    this.commands = commands;
  }

  all(): readonly KeyboardCommand[] {
    return this.commands;
  }

  findById(id: string): KeyboardCommand | undefined {
    return this.commands.find((c) => c.id === id);
  }

  /** Every command reachable while `context` is active — `'global'` commands are included alongside the exact-matching ones, since they fire regardless of grid-focused/cell-editing (see `commandTypes.ts`'s `CommandContext` doc comment). */
  forContext(context: CommandContext): readonly KeyboardCommand[] {
    return this.commands.filter((c) => c.context === context || c.context === 'global');
  }

  /**
   * Resolves ONE `KeyboardEventLike` in ONE `context`, on ONE `platform`, to
   * the command that should fire, or `null` if nothing matches. `platform`
   * has no default on purpose — a resolver always knows its platform (e.g.
   * `navigator.platform`/`navigator.userAgentData`, sniffed once at app
   * start) and silently defaulting it here would risk every `mod`-combo
   * command matching the wrong modifier key on macOS. Returns the first
   * match in registration order — `assertNoComboCollisions` (run in the
   * constructor) already guarantees at most one REAL match can exist for a
   * given `(context, combo)` pair, so "first match" is a defensive
   * tie-break, not a meaningful priority order.
   */
  resolve(event: KeyboardEventLike, context: CommandContext, platform: Platform): KeyboardCommand | null {
    for (const command of this.forContext(context)) {
      if (comboMatchesEvent(command.combo, event, platform)) return command;
    }
    return null;
  }
}
