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

import type {
  CommandContext,
  CommandEngineBinding,
  CommandScope,
  CommandSurface,
  KeyboardCommand,
  KeyboardEventLike,
  Platform,
} from './commandTypes.js';
import { activationSurfaces, comboHasGuardModifier, comboIdentity, comboMatchesEvent, describeCombo } from './commandTypes.js';
import {
  AVAILABILITY_ALWAYS,
  AVAILABILITY_COMMENT,
  AVAILABILITY_COMPUTE,
  AVAILABILITY_EDIT,
  AVAILABILITY_FOCUS_MODE,
  AVAILABILITY_LIFECYCLE,
  AVAILABILITY_READ,
  evaluateCommandAvailability,
  type CommandEvaluationContext,
  type CommandExecutability,
  type CommandUnavailableReason,
} from './CommandAvailability.js';
// AP-09's label convention (i18n key + Polish default), reused rather than
// re-invented so a keyboard prompt and a Workspace Bar prompt are the same
// kind of object. `workspaceBarContract.ts` is pure data/logic with no DB and
// no DOM (its own header says so), so importing it keeps this package
// unit-testable with no environment.
import type { WorkspaceBarLabel } from '../workspace/workspaceBarContract.js';

/**
 * The most cells a DESTRUCTIVE command may touch from an UNMODIFIED key
 * without asking first. `1` — the active cell only: a blast radius the user
 * can see in full at the moment they press the key, and undo in one stroke.
 * Anything larger is by definition off-screen-capable and must be confirmed.
 */
export const MAX_UNCONFIRMED_BARE_KEY_TARGETS = 1;

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

// ---------------------------------------------------------------------------
// Destructiveness presets (see `commandTypes.ts`'s `CommandDestructivenessPolicy`).
// ---------------------------------------------------------------------------

/** The overwhelming majority: a command that cannot destroy committed content. Spread into every non-destructive entry so the three fields are never simply forgotten. */
const NON_DESTRUCTIVE = {
  destructive: false,
  requiresConfirmation: false,
  confirmAboveTargetCount: null,
} as const;

/**
 * The `Delete`/`Backspace` decision, in one place because both keys must never
 * drift apart.
 *
 * WHAT WAS WRONG: both keys were plain, unmodified, non-confirming bindings
 * onto `BULK_CLEAR_BINDING`, whose own note says it "forces value_status to
 * MISSING for every selected cell". Combined with `shift+arrow` range
 * extension — a gesture that leaves the user's hand ON the modifier row, one
 * key away from `Delete` — a single keystroke wiped an arbitrarily large
 * block of audited financial values with no confirmation, and (because
 * `focusRestoreReason` was `null`) without even defining where focus lands
 * afterwards, so the user could not see what they had just destroyed.
 *
 * THE FIX, and why it is this shape rather than a modifier:
 *  - Moving CLEAR to `Mod+Delete` would guard the bulk case at the cost of
 *    breaking the single most reflexive gesture in any grid ("select cell,
 *    press Delete"), for the one case that is genuinely harmless — clearing
 *    ONE cell, immediately undoable with `Mod+Z`. That trades a real,
 *    every-minute usability cost for protection the user does not need at
 *    blast radius 1, and it would push people toward mouse workflows, which
 *    is the opposite of this work package's goal.
 *  - The hazard is not the key, it is the SCALE. So the guard is scaled:
 *    `confirmAboveTargetCount: 1` means the bare key still clears the active
 *    cell instantly, and clearing 2+ cells requires an explicit confirmation
 *    the resolver must obtain before calling `buildBulkOperations`.
 *  - `destructive: true` is declared regardless of count, because that flag
 *    is what makes the whole class visible: `findDestructiveGuardViolations`
 *    below, the command palette, and any future audit can enumerate "every
 *    keyboard command that can destroy content" without re-reading prose.
 *  - `focusRestoreReason: 'bulkOp'` (was `null`) — `FocusRestoreContract`
 *    already had the reason and already collapses the selection to the
 *    operation's first target for it. The clear commands simply were not
 *    using it.
 */
const CLEAR_DESTRUCTIVENESS = {
  destructive: true,
  requiresConfirmation: false,
  confirmAboveTargetCount: MAX_UNCONFIRMED_BARE_KEY_TARGETS,
} as const;

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
    scope: 'grid',
    availability: AVAILABILITY_READ,
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
    ...NON_DESTRUCTIVE,
  },
  {
    id: 'grid.paste',
    combo: { key: 'v', mod: true },
    context: 'grid-focused',
    scope: 'grid',
    availability: AVAILABILITY_EDIT,
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
    ...NON_DESTRUCTIVE,
  },
  {
    id: 'grid.undo',
    combo: { key: 'z', mod: true },
    context: 'grid-focused',
    scope: 'grid',
    availability: AVAILABILITY_EDIT,
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
    ...NON_DESTRUCTIVE,
  },
  {
    id: 'grid.redo',
    combo: { key: 'z', mod: true, shift: true },
    context: 'grid-focused',
    scope: 'grid',
    availability: AVAILABILITY_EDIT,
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
    ...NON_DESTRUCTIVE,
  },
  {
    id: 'grid.find',
    combo: { key: 'f', mod: true },
    context: 'grid-focused',
    scope: 'grid',
    availability: AVAILABILITY_READ,
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
    ...NON_DESTRUCTIVE,
  },
  {
    id: 'grid.save',
    combo: { key: 's', mod: true },
    context: 'global',
    scope: 'grid',
    availability: AVAILABILITY_EDIT,
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
    ...NON_DESTRUCTIVE,
  },
  {
    id: 'grid.clearDelete',
    combo: { key: 'Delete' },
    context: 'grid-focused',
    scope: 'grid',
    availability: AVAILABILITY_EDIT,
    category: 'editing',
    label: 'Clear',
    description:
      'Clear the selected cell(s) — sets value_status to MISSING. Clearing more than one cell asks for confirmation first.',
    engineBinding: BULK_CLEAR_BINDING,
    focusRestoreReason: 'bulkOp',
    ...CLEAR_DESTRUCTIVENESS,
  },
  {
    id: 'grid.clearBackspace',
    combo: { key: 'Backspace' },
    context: 'grid-focused',
    scope: 'grid',
    availability: AVAILABILITY_EDIT,
    category: 'editing',
    label: 'Clear',
    description:
      'Clear the selected cell(s) — sets value_status to MISSING. (Backspace alias of Delete, matching Excel/Sheets.) Clearing more than one cell asks for confirmation first.',
    engineBinding: BULK_CLEAR_BINDING,
    focusRestoreReason: 'bulkOp',
    ...CLEAR_DESTRUCTIVENESS,
  },
  {
    id: 'grid.navigateUp',
    combo: { key: 'ArrowUp' },
    context: 'grid-focused',
    scope: 'grid',
    availability: AVAILABILITY_READ,
    category: 'navigation',
    label: 'Move up',
    description: 'Move the active cell one row up, replacing the current selection.',
    engineBinding: NAVIGATE_BINDING,
    focusRestoreReason: null,
    ...NON_DESTRUCTIVE,
  },
  {
    id: 'grid.navigateDown',
    combo: { key: 'ArrowDown' },
    context: 'grid-focused',
    scope: 'grid',
    availability: AVAILABILITY_READ,
    category: 'navigation',
    label: 'Move down',
    description: 'Move the active cell one row down, replacing the current selection.',
    engineBinding: NAVIGATE_BINDING,
    focusRestoreReason: null,
    ...NON_DESTRUCTIVE,
  },
  {
    id: 'grid.navigateLeft',
    combo: { key: 'ArrowLeft' },
    context: 'grid-focused',
    scope: 'grid',
    availability: AVAILABILITY_READ,
    category: 'navigation',
    label: 'Move left',
    description: 'Move the active cell one column left, replacing the current selection.',
    engineBinding: NAVIGATE_BINDING,
    focusRestoreReason: null,
    ...NON_DESTRUCTIVE,
  },
  {
    id: 'grid.navigateRight',
    combo: { key: 'ArrowRight' },
    context: 'grid-focused',
    scope: 'grid',
    availability: AVAILABILITY_READ,
    category: 'navigation',
    label: 'Move right',
    description: 'Move the active cell one column right, replacing the current selection.',
    engineBinding: NAVIGATE_BINDING,
    focusRestoreReason: null,
    ...NON_DESTRUCTIVE,
  },
  {
    id: 'grid.extendUp',
    combo: { key: 'ArrowUp', shift: true },
    context: 'grid-focused',
    scope: 'grid',
    availability: AVAILABILITY_READ,
    category: 'navigation',
    label: 'Extend selection up',
    description: 'Extend the current range selection one row up from the gesture anchor.',
    engineBinding: EXTEND_BINDING,
    focusRestoreReason: null,
    ...NON_DESTRUCTIVE,
  },
  {
    id: 'grid.extendDown',
    combo: { key: 'ArrowDown', shift: true },
    context: 'grid-focused',
    scope: 'grid',
    availability: AVAILABILITY_READ,
    category: 'navigation',
    label: 'Extend selection down',
    description: 'Extend the current range selection one row down from the gesture anchor.',
    engineBinding: EXTEND_BINDING,
    focusRestoreReason: null,
    ...NON_DESTRUCTIVE,
  },
  {
    id: 'grid.extendLeft',
    combo: { key: 'ArrowLeft', shift: true },
    context: 'grid-focused',
    scope: 'grid',
    availability: AVAILABILITY_READ,
    category: 'navigation',
    label: 'Extend selection left',
    description: 'Extend the current range selection one column left from the gesture anchor.',
    engineBinding: EXTEND_BINDING,
    focusRestoreReason: null,
    ...NON_DESTRUCTIVE,
  },
  {
    id: 'grid.extendRight',
    combo: { key: 'ArrowRight', shift: true },
    context: 'grid-focused',
    scope: 'grid',
    availability: AVAILABILITY_READ,
    category: 'navigation',
    label: 'Extend selection right',
    description: 'Extend the current range selection one column right from the gesture anchor.',
    engineBinding: EXTEND_BINDING,
    focusRestoreReason: null,
    ...NON_DESTRUCTIVE,
  },
  {
    id: 'grid.confirmEdit',
    combo: { key: 'Enter' },
    context: 'cell-editing',
    scope: 'grid',
    availability: AVAILABILITY_EDIT,
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
    ...NON_DESTRUCTIVE,
  },
  {
    id: 'grid.cancelEdit',
    combo: { key: 'Escape' },
    context: 'cell-editing',
    scope: 'grid',
    availability: AVAILABILITY_ALWAYS,
    category: 'editing',
    label: 'Cancel edit',
    description: 'Discard the in-progress cell edit buffer without submitting an Operation.',
    engineBinding: {
      kind: 'keyboard-owned',
      note: 'Pure local UI state discard — the edit buffer never became an Operation, so there is nothing to submit and no AP-01/AP-04 engine call at all.',
    },
    focusRestoreReason: 'editCancel',
    ...NON_DESTRUCTIVE,
  },
  {
    id: 'grid.nextCellTab',
    combo: { key: 'Tab' },
    context: 'grid-focused',
    scope: 'grid',
    availability: AVAILABILITY_READ,
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
    ...NON_DESTRUCTIVE,
  },

  // --- Finance-specific shortcuts (task brief: "skroty Compute/Compare/Comments") ---
  {
    id: 'finance.compute',
    combo: { key: 'Enter', mod: true },
    context: 'grid-focused',
    scope: 'grid',
    availability: AVAILABILITY_COMPUTE,
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
    ...NON_DESTRUCTIVE,
  },
  {
    id: 'finance.compare',
    combo: { key: 'd', mod: true },
    context: 'grid-focused',
    scope: 'grid',
    availability: AVAILABILITY_READ,
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
    ...NON_DESTRUCTIVE,
  },
  {
    id: 'finance.comment',
    combo: { key: 'm', mod: true },
    context: 'grid-focused',
    scope: 'grid',
    availability: AVAILABILITY_COMMENT,
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
    ...NON_DESTRUCTIVE,
  },

  // --- Workspace-level shortcuts -------------------------------------------
  // Everything above acts on cells. Everything below acts on the artifact
  // shell: views, focus mode, the Related drawer, lifecycle, Back, and the
  // command palette itself. Their absence was not a gap in ambition, it was a
  // gap that made two OTHER contracts describe behaviour that did not exist:
  //   - `focusModeContract.ts` declares `FocusModeTrigger = ... |
  //     'keyboard-shortcut'`, and no keyboard shortcut existed to produce it.
  //   - `FocusRestoreContract.ts` declares the reason `'commandPaletteInvoke'`,
  //     and no command opened the palette.
  // Both are closed here.
  //
  // Combo choice follows `WorkspaceBarPrimaryAction.keyboardCommandId`'s
  // premise that the bar and this registry describe the SAME actions, so the
  // ids below are the ids an adapter can point at.
  {
    id: 'workspace.commandPalette',
    combo: { key: 'k', mod: true },
    context: 'global',
    scope: 'workspace',
    availability: AVAILABILITY_READ,
    category: 'workspace',
    label: 'Command palette',
    description: 'Open the command palette to search every available command by name or description.',
    engineBinding: {
      kind: 'keyboard-owned',
      note: '`CommandPaletteIndex` (this package) is the searchable index; opening/closing the palette is local UI state this package`s resolver owns end to end. Mod+K is the cross-application convention (VS Code, Linear, Slack, Notion) and is deliberately `global` — the palette is the escape hatch when a user does not remember a shortcut, which is exactly the moment they may be mid-edit.',
    },
    focusRestoreReason: 'commandPaletteInvoke',
    ...NON_DESTRUCTIVE,
  },
  {
    id: 'workspace.toggleFocusMode',
    combo: { key: 'f', mod: true, shift: true },
    context: 'global',
    scope: 'workspace',
    availability: AVAILABILITY_FOCUS_MODE,
    category: 'workspace',
    label: 'Focus mode',
    description: 'Toggle the full work-area (focus) mode — hides global topbar and Finance chrome, keeps Menu 1, the Workspace Bar, view navigation and the workspace.',
    engineBinding: {
      kind: 'function',
      engine: 'AP-09',
      module: 'services/finance/workspace/focusModeContract.ts',
      functionName: 'enterFocusMode',
      note: "THE PHANTOM THIS CLOSES: `FocusModeTrigger` already listed 'keyboard-shortcut' as a way to enter focus mode, but no shortcut existed anywhere in the registry. The resolver picks `enterFocusMode` or `exitFocusMode` (same module) by `FocusModeSession.active` and passes { trigger: 'keyboard-shortcut', restoreFocusToControlId: <the bar's fullscreen control id> } — that id is what returns keyboard focus to the control on exit instead of dumping the user at document start.",
    },
    focusRestoreReason: null,
    ...NON_DESTRUCTIVE,
  },
  {
    id: 'workspace.exitFocusMode',
    combo: { key: 'Escape' },
    context: 'grid-focused',
    scope: 'workspace',
    availability: AVAILABILITY_FOCUS_MODE,
    category: 'workspace',
    label: 'Exit focus mode',
    description: 'Leave focus mode and restore the hidden chrome ("Esc wychodzi").',
    engineBinding: {
      kind: 'function',
      engine: 'AP-09',
      module: 'services/finance/workspace/focusModeContract.ts',
      functionName: 'exitFocusMode',
      note: 'Escape is CONTESTED and this command does not own it unconditionally: `resolveEscapeKey` (same module) is the single precedence table — modal > command-palette > popover > cell-editing > focus-mode. A key handler must consult it FIRST and only dispatch here when it answers `focus-mode`. Registered in `grid-focused` (not `global`) so it can never race `grid.cancelEdit`, which owns Escape in `cell-editing`.',
    },
    focusRestoreReason: null,
    ...NON_DESTRUCTIVE,
  },
  {
    id: 'workspace.nextView',
    combo: { key: 'PageDown', mod: true },
    context: 'grid-focused',
    scope: 'workspace',
    availability: AVAILABILITY_READ,
    category: 'workspace',
    label: 'Next view',
    description: 'Switch to the next view of this workspace (e.g. P&L -> Bilans -> Cash flow).',
    engineBinding: {
      kind: 'workspace-state',
      stateOwner: 'WorkspaceBarViewNavigation.activeViewId',
      module: 'services/finance/workspace/workspaceBarContract.ts',
      note: 'Mod+PageDown/PageUp is the sheet-switching combo in Excel, which is the closest existing analogue to switching P&L/BS/CF. AP-09 declares the view list and the active id but exports no mutator — the workspace shell holds that state, so this is a documented gap in AP-09`s surface, not a missing call here. Wraps at the ends; `WorkspaceBarView.state` is not consulted (a not-configured view is still reachable — that is how the user configures it).',
    },
    focusRestoreReason: null,
    ...NON_DESTRUCTIVE,
  },
  {
    id: 'workspace.previousView',
    combo: { key: 'PageUp', mod: true },
    context: 'grid-focused',
    scope: 'workspace',
    availability: AVAILABILITY_READ,
    category: 'workspace',
    label: 'Previous view',
    description: 'Switch to the previous view of this workspace.',
    engineBinding: {
      kind: 'workspace-state',
      stateOwner: 'WorkspaceBarViewNavigation.activeViewId',
      module: 'services/finance/workspace/workspaceBarContract.ts',
      note: 'Mirror of `workspace.nextView`; same documented AP-09 gap.',
    },
    focusRestoreReason: null,
    ...NON_DESTRUCTIVE,
  },
  {
    id: 'workspace.toggleRelatedPanel',
    combo: { key: 'r', mod: true, shift: true },
    context: 'grid-focused',
    scope: 'workspace',
    availability: AVAILABILITY_READ,
    category: 'workspace',
    label: 'Powiązane',
    description: 'Open or close the Related (Powiązane) drawer — parents, children, indirect descendants and siblings of this artifact.',
    engineBinding: {
      kind: 'function',
      engine: 'AP-09',
      module: 'services/finance/workspace/lineageNavigatorContract.ts',
      functionName: 'buildRelatedPanel',
      note: 'The drawer`s CONTENT is built by this AP-11 function; its open/closed state is shell state. `moduleAdapters.ts` gives every one of the five modules a `finance.<module>.related` secondary action with `keyboardCommandId: null` — this is the command that field can now point at, which is precisely what `WorkspaceBarSecondaryAction.keyboardCommandId` exists for.',
    },
    focusRestoreReason: null,
    ...NON_DESTRUCTIVE,
  },
  {
    id: 'workspace.lifecycleMenu',
    combo: { key: 'l', mod: true, shift: true },
    context: 'grid-focused',
    scope: 'workspace',
    availability: AVAILABILITY_LIFECYCLE,
    category: 'workspace',
    label: 'Status i cykl życia',
    description: 'Open the lifecycle (status) control and its permitted transitions for this version.',
    engineBinding: {
      kind: 'inline-contract',
      engine: 'AP-09',
      module: 'services/finance/workspace/workspaceBarContract.ts',
      contractType: 'WorkspaceBarLifecycleControl',
      note: "DELIBERATELY OPENS THE MENU RATHER THAN FIRING A TRANSITION. A shortcut that submitted for review or archived a version directly would be a second destructive-by-keyboard surface, and it would bypass `WorkspaceBarLifecycleTransition`'s own destructive/requiresConfirmation/requiresReason flags — the very fields this wave exists to honour. The keyboard gets the user TO the lifecycle control (OWN-FIN-012: the bar is the lifecycle centre); the transition is then chosen explicitly, under AP-09's rules, which is also why this command is not itself destructive.",
    },
    focusRestoreReason: null,
    ...NON_DESTRUCTIVE,
  },
  {
    id: 'workspace.back',
    combo: { key: 'ArrowLeft', alt: true },
    context: 'grid-focused',
    scope: 'workspace',
    availability: AVAILABILITY_READ,
    category: 'workspace',
    label: 'Wróć do listy',
    description: 'Leave the artifact and return to the module list (OWN-FIN-016 "Back to list").',
    engineBinding: {
      kind: 'workspace-state',
      stateOwner: 'WorkspaceBarIdentity.back.targetListRoute',
      module: 'services/finance/workspace/workspaceBarContract.ts',
      note: 'Alt+Left is the platform Back gesture on Windows/Linux and is unclaimed by this grid (arrow combos here use shift, never alt), so it does not shadow `grid.navigateLeft`/`grid.extendLeft`. The route is data AP-09 already carries; performing the navigation is the shell`s job. An unsaved draft is the shell`s concern too — `autosaveService` owns that, this command does not silently discard anything, which is why it is not destructive.',
    },
    focusRestoreReason: null,
    ...NON_DESTRUCTIVE,
  },
];

// ---------------------------------------------------------------------------
// Collision detection — task scope item 5 ("kazda komenda w rejestrze ma
// unikalny key combo, brak kolizji"), scoped per `context` (see file header).
// ---------------------------------------------------------------------------

export interface ComboCollision {
  /** The surface the two commands are simultaneously live on. */
  surface: CommandSurface;
  context: CommandContext;
  comboIdentity: string;
  commandIds: readonly string[];
}

/**
 * The MODE contexts a key can actually be pressed in. `'global'` is not one of
 * them — it is a shorthand meaning "all of them", which is exactly why it must
 * be expanded before comparing commands (see `commandActivations`).
 */
const DISPATCHABLE_CONTEXTS: readonly CommandContext[] = ['grid-focused', 'cell-editing'];

/**
 * Every `(surface, context)` pair in which a command is live — its ACTIVATION
 * SET. Two commands may share a key combo if and only if their activation sets
 * are disjoint.
 *
 * WHY THIS REPLACED THE OLD `${context}::${combo}` KEY, and why it is not the
 * naive "different scope, therefore no conflict":
 *
 *  1. Adding `scope` invites the reading "grid and workspace are separate
 *     namespaces, so both may bind Mod+K". That reading is WRONG for this
 *     product: a workspace shortcut such as Focus Mode is pressed while the
 *     GRID has focus. The two scopes co-activate on the grid surface, so
 *     `activationSurfaces` puts workspace commands on both surfaces and the
 *     collision check catches the ambiguity instead of blessing it. Disjoint
 *     scopes MAY share a combo — but only when they are genuinely disjoint,
 *     which is computed here, never assumed from the label.
 *  2. It also closes a hole the old key had: a `'global'` command was only
 *     ever compared against other `'global'` commands, so a `grid-focused`
 *     command duplicating `grid.save`'s Mod+S would NOT have been reported —
 *     while `forContext('grid-focused')` would have returned both, which is
 *     the definition of the ambiguity this function exists to prevent.
 */
export function commandActivations(command: KeyboardCommand): string[] {
  const contexts = command.context === 'global' ? DISPATCHABLE_CONTEXTS : [command.context];
  const keys: string[] = [];
  for (const surface of activationSurfaces(command.scope)) {
    for (const context of contexts) keys.push(`${surface}::${context}`);
  }
  return keys;
}

/** Pure check — returns every activation in which two or more commands answer to the same combo, or `[]` if the registry is collision-free. Exported so the test suite (task scope item 5) can assert against it directly without relying on the constructor throwing. */
export function findComboCollisions(commands: readonly KeyboardCommand[]): ComboCollision[] {
  const groups = new Map<string, { surface: CommandSurface; context: CommandContext; comboIdentity: string; commandIds: string[] }>();
  for (const command of commands) {
    const combo = comboIdentity(command.combo);
    for (const activation of commandActivations(command)) {
      const [surface, context] = activation.split('::') as [CommandSurface, CommandContext];
      const key = `${activation}::${combo}`;
      const existing = groups.get(key);
      if (existing) {
        if (!existing.commandIds.includes(command.id)) existing.commandIds.push(command.id);
      } else {
        groups.set(key, { surface, context, comboIdentity: combo, commandIds: [command.id] });
      }
    }
  }
  return [...groups.values()].filter((g) => g.commandIds.length > 1);
}

export function assertNoComboCollisions(commands: readonly KeyboardCommand[]): void {
  const collisions = findComboCollisions(commands);
  if (collisions.length > 0) {
    const detail = collisions
      .map((c) => `[${c.surface}/${c.context}] ${c.comboIdentity} <- ${c.commandIds.join(', ')}`)
      .join('; ');
    throw new Error(`KeyboardCommandRegistry: combo collision(s) detected: ${detail}`);
  }
}

// ---------------------------------------------------------------------------
// Destructive-command guards — the SECOND registry-level invariant, added for
// the same reason as the first: so that a future edit CANNOT reintroduce the
// defect by accident. `assertNoComboCollisions` makes an ambiguous binding
// impossible; `assertDestructiveCommandsAreGuarded` makes an UNGUARDED
// DESTRUCTIVE binding impossible. Both run in the constructor, so every
// `new KeyboardCommandRegistry(...)` — including the one a future React hook
// creates at app start — is the enforcement point.
//
// This is the keyboard-layer counterpart of `validateWorkspaceBarConfig`'s
// `DESTRUCTIVE_WITHOUT_CONFIRMATION` rule (AP-09, `workspaceBarContract.ts`),
// down to the error code, so the two halves of the product cannot end up with
// two different definitions of "guarded".
// ---------------------------------------------------------------------------

export type CommandGuardViolationCode =
  /** Destructive with no guard whatsoever: no confirmation, no count threshold. Same code name as AP-09's bar validator. */
  | 'DESTRUCTIVE_WITHOUT_CONFIRMATION'
  /** Destructive on a key with no Ctrl/Cmd/Alt, guarded only by a threshold that is too permissive to be a guard. */
  | 'DESTRUCTIVE_BARE_KEY_THRESHOLD_TOO_HIGH'
  /** Destructive but does not say where focus lands afterwards — the user cannot see what was destroyed. */
  | 'DESTRUCTIVE_WITHOUT_FOCUS_RESTORE'
  /** A confirmation guard declared on a command that is not destructive: either the flag or the classification is wrong. */
  | 'GUARD_ON_NON_DESTRUCTIVE_COMMAND';

export interface CommandGuardViolation {
  code: CommandGuardViolationCode;
  commandId: string;
  message: string;
}

/**
 * Pure check — returns every destructive-guard violation, or `[]`. Exported so
 * tests assert against it directly (and so a future contributor can run it
 * over a candidate command set before adding it).
 */
export function findDestructiveGuardViolations(commands: readonly KeyboardCommand[]): CommandGuardViolation[] {
  const violations: CommandGuardViolation[] = [];
  for (const command of commands) {
    const combo = describeCombo(command.combo, 'windows');
    if (!command.destructive) {
      if (command.requiresConfirmation || command.confirmAboveTargetCount !== null) {
        violations.push({
          code: 'GUARD_ON_NON_DESTRUCTIVE_COMMAND',
          commandId: command.id,
          message:
            `"${command.id}" declares a confirmation guard but destructive=false. ` +
            'Either mark it destructive or drop the guard — a half-declared policy is how the next reviewer is misled.',
        });
      }
      continue;
    }
    if (!command.requiresConfirmation && command.confirmAboveTargetCount === null) {
      violations.push({
        code: 'DESTRUCTIVE_WITHOUT_CONFIRMATION',
        commandId: command.id,
        message:
          `Destructive command "${command.id}" (${combo}) must set requiresConfirmation or a ` +
          'confirmAboveTargetCount threshold (OWN-FIN-012, same rule as the Workspace Bar validator).',
      });
    }
    if (
      !command.requiresConfirmation &&
      !comboHasGuardModifier(command.combo) &&
      command.confirmAboveTargetCount !== null &&
      command.confirmAboveTargetCount > MAX_UNCONFIRMED_BARE_KEY_TARGETS
    ) {
      violations.push({
        code: 'DESTRUCTIVE_BARE_KEY_THRESHOLD_TOO_HIGH',
        commandId: command.id,
        message:
          `Destructive command "${command.id}" is bound to the unmodified key ${combo} and would clear up to ` +
          `${command.confirmAboveTargetCount} cells without asking. A bare key may destroy at most ` +
          `${MAX_UNCONFIRMED_BARE_KEY_TARGETS} cell(s) unconfirmed — add a Ctrl/Cmd/Alt modifier, set ` +
          'requiresConfirmation, or lower the threshold.',
      });
    }
    if (command.focusRestoreReason === null) {
      violations.push({
        code: 'DESTRUCTIVE_WITHOUT_FOCUS_RESTORE',
        commandId: command.id,
        message:
          `Destructive command "${command.id}" declares focusRestoreReason: null. A command that removes content ` +
          'must define where focus lands, otherwise the user cannot see what it did (FocusRestoreContract.ts).',
      });
    }
  }
  return violations;
}

export function assertDestructiveCommandsAreGuarded(commands: readonly KeyboardCommand[]): void {
  const violations = findDestructiveGuardViolations(commands);
  if (violations.length > 0) {
    const detail = violations.map((v) => `[${v.code}] ${v.message}`).join(' | ');
    throw new Error(`KeyboardCommandRegistry: destructive-command guard violation(s): ${detail}`);
  }
}

/**
 * THE RUNTIME ENFORCEMENT POINT a future key handler must call between
 * resolving a command and invoking its engine binding: given the command and
 * how many cells the current selection would actually hit, must the user
 * confirm first?
 *
 * Declaring the policy is not the same as applying it — this function is what
 * makes the declaration operative, and `dispatch()` below calls it so a
 * caller using the registry's single entry point cannot forget.
 */
export function requiresConfirmationBeforeExecuting(command: KeyboardCommand, targetCount: number): boolean {
  if (!command.destructive) return false;
  if (command.requiresConfirmation) return true;
  if (command.confirmAboveTargetCount === null) return true; // Unreachable in a validated registry; fail closed anyway.
  return targetCount > command.confirmAboveTargetCount;
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
    assertDestructiveCommandsAreGuarded(commands);
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

  /** Every command at one level. The palette groups by this; an audit of "what can the keyboard do to the artifact shell" reads it directly. */
  forScope(scope: CommandScope): readonly KeyboardCommand[] {
    return this.commands.filter((c) => c.scope === scope);
  }

  /**
   * "May this command run right now, and if not, what do I tell the user" —
   * without an event. This is what a command palette calls to render a row as
   * disabled WITH a reason, and what a tooltip calls; `dispatch` calls the
   * same function, so a palette row and a keypress can never disagree.
   */
  canExecute(command: KeyboardCommand, ctx: CommandEvaluationContext): CommandExecutability {
    return evaluateCommandAvailability(command.availability, ctx);
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

  /**
   * THE SINGLE ENTRY POINT. `resolve()` answers "which command", which is only
   * half of what a key handler needs — the other half is "may it run, and must
   * the user be asked first". Splitting those across separate calls is exactly
   * how a guard gets skipped: a caller that only knows about `resolve()` will
   * happily invoke a destructive binding it was never cleared for.
   *
   * `dispatch()` is therefore the method a key handler is expected to call for
   * EVERY keydown, and the only one that returns an executable outcome.
   */
  dispatch(event: KeyboardEventLike, ctx: CommandDispatchContext): CommandDispatchResult {
    const command = this.resolve(event, ctx.context, ctx.platform);
    if (!command) return { status: 'no-match' };
    return decideDispatch(command, ctx);
  }
}

// ---------------------------------------------------------------------------
// Dispatch outcome — what a key handler is told to do.
// ---------------------------------------------------------------------------

/**
 * Everything `dispatch` needs. The availability facts are REQUIRED, not
 * optional: a dispatch context that may omit `role`/`status` is a dispatch
 * context in which forgetting one field silently turns a fail-closed
 * permission model into a fail-open one. A real key handler always has these
 * — they are the same facts the Workspace Bar is already rendered from.
 */
export interface CommandDispatchContext extends CommandEvaluationContext {
  context: CommandContext;
  platform: Platform;
  /**
   * How many cells the command would actually touch, i.e. the size of the
   * current selection (`GridSelectionModel.selectedCellCount()`). Only
   * meaningful for cell-scoped commands; pass `1` when no range applies.
   */
  selectedCellCount: number;
}

export type CommandDispatchResult =
  | { status: 'no-match' }
  | {
      status: 'blocked';
      command: KeyboardCommand;
      reason: CommandUnavailableReason;
      detail: string;
      /** What the user is shown — the readable half AP-09's `ControlState` does not carry. */
      message: WorkspaceBarLabel;
    }
  | {
      status: 'needs-confirmation';
      command: KeyboardCommand;
      targetCount: number;
      /** Displayable prompt — i18n key plus the Polish default, the AP-09 `WorkspaceBarLabel` convention. */
      message: WorkspaceBarLabel;
    }
  | { status: 'execute'; command: KeyboardCommand; targetCount: number };

function decideDispatch(command: KeyboardCommand, ctx: CommandDispatchContext): CommandDispatchResult {
  const executability = evaluateCommandAvailability(command.availability, ctx);
  if (!executability.canExecute) {
    return {
      status: 'blocked',
      command,
      reason: executability.reason,
      detail: executability.detail,
      message: executability.message,
    };
  }

  const targetCount = ctx.selectedCellCount;
  if (requiresConfirmationBeforeExecuting(command, targetCount)) {
    return {
      status: 'needs-confirmation',
      command,
      targetCount,
      message: {
        key: 'finance.keyboard.confirmDestructive',
        pl: `Wyczyścić ${targetCount} komórek? Wartości zostaną oznaczone jako brakujące (można cofnąć: Ctrl/Cmd+Z).`,
      },
    };
  }
  return { status: 'execute', command, targetCount };
}
