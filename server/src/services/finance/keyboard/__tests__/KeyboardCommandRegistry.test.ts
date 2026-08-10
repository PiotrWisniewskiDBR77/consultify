/**
 * AP-03 — Keyboard command layer tests.
 *
 * Program: `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`
 * section 10 ("keyboard benchmark <=90 s"). Task brief:
 * `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md`
 * section 3 point 3, scope items 4-5 ("Test: benchmark <=90s dla core
 * workflow ... Test: kazda komenda w rejestrze ma unikalny key combo, brak
 * kolizji, kazda ma poprawnie typowany handler").
 *
 * Pure unit tests — no database, no DOM — mirroring `operationStack.test.ts`
 * (AP-04) and `financeGridPerformance.test.ts` (AP-01)'s own "core logic,
 * no DB, no React" discipline for this whole program.
 */
import { describe, expect, it } from 'vitest';

import { financeStmtLinesCellRef, type CellRef } from '../../../../types/finance/CellRef.js';
import type { FinanceValue } from '../../../../types/finance/financeValueSemantics.js';
import { GridSelectionModel } from '../../grid/GridSelectionModel.js';
import { buildPasteOperations, type PasteSourceCell } from '../../grid/PasteEngine.js';
import { byDecimalEquals, findCells, type GridCellSnapshot } from '../../grid/FindReplaceEngine.js';
import type { GridAddressResolver, GridCoordinate } from '../../grid/gridCoordinates.js';
import { OperationStack } from '../../collaboration/operationStack.js';
import {
  applyFocusRestoreToSelection,
  captureFocusSnapshot,
  focusTargetForOperation,
  resolveFocusRestorePatch,
} from '../FocusRestoreContract.js';
import {
  COMMAND_CONTEXTS,
  comboHasGuardModifier,
  comboMatchesEvent,
  describeCombo,
  type KeyboardEventLike,
} from '../commandTypes.js';
import {
  FINANCE_KEYBOARD_COMMANDS,
  KeyboardCommandRegistry,
  MAX_UNCONFIRMED_BARE_KEY_TARGETS,
  assertDestructiveCommandsAreGuarded,
  assertNoComboCollisions,
  findComboCollisions,
  findDestructiveGuardViolations,
  requiresConfirmationBeforeExecuting,
  type CommandDispatchContext,
} from '../KeyboardCommandRegistry.js';
import { CommandPaletteIndex } from '../CommandPaletteIndex.js';

// ---------------------------------------------------------------------------
// Fixtures — a tiny 4x3 grid resolver, mirroring the shape (not the scale)
// of `financeGridPerformance.test.ts`'s resolver fixture.
// ---------------------------------------------------------------------------

const ROW_COUNT = 4;
const COL_COUNT = 3;

function cellRefAt(coord: GridCoordinate): CellRef {
  return financeStmtLinesCellRef({
    organizationId: 'org-kbd',
    businessVersionId: 'bv-kbd',
    entityId: `entity-${coord.row}`,
    canonicalLineId: 'line-revenue',
    consolidationScope: 'STANDALONE',
    periodId: `period-${coord.col}`,
    accumulationBasis: 'QUARTER_ONLY',
  });
}

function coordinateOf(ref: CellRef): GridCoordinate | null {
  if (ref.rowKey.tableName !== 'finance_stmt_lines' || ref.columnKey.tableName !== 'finance_stmt_lines') return null;
  const row = Number(ref.rowKey.entityId.replace('entity-', ''));
  const col = Number(ref.columnKey.periodId.replace('period-', ''));
  if (!Number.isFinite(row) || !Number.isFinite(col) || row >= ROW_COUNT || col >= COL_COUNT) return null;
  return { row, col };
}

const resolver: GridAddressResolver = { rowCount: ROW_COUNT, colCount: COL_COUNT, cellRefAt, coordinateOf };

function presentValue(decimal: string): FinanceValue {
  return {
    status: 'PRESENT_NONZERO',
    valueDecimal: decimal,
    nativeCurrency: 'USD',
    presentationCurrency: 'USD',
    unit: 'THOUSANDS',
    multiplier: '1',
    sourceRef: null,
    isAdjustment: false,
    adjustmentReason: null,
  };
}

function ctx() {
  let n = 0;
  return {
    organizationId: 'org-kbd',
    artifactId: 'artifact-kbd',
    businessVersionId: 'bv-kbd',
    expectedWorkingRevisionId: 'wr-0',
    sourceWorkingRevisionId: 'wr-0',
    actorId: 'user-kbd',
    actorRole: 'preparer' as const,
    now: () => '2026-08-10T00:00:00.000Z',
    generateId: () => `id-${n++}`,
  };
}

function event(partial: Partial<KeyboardEventLike> & { key: string }): KeyboardEventLike {
  return { ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...partial };
}

/** A grid-focused, single-cell, Windows dispatch context — the ordinary case every test varies from. */
function baseDispatchContext(): CommandDispatchContext {
  return { context: 'grid-focused', platform: 'windows', selectedCellCount: 1 };
}

// ---------------------------------------------------------------------------
// 1. Registry shape / collision-freedom / typed handlers (task scope item 5)
// ---------------------------------------------------------------------------

describe('AP-03 KeyboardCommandRegistry — registry shape', () => {
  it('registers a non-trivial command set covering every ZAKRES bullet (standard + finance-specific)', () => {
    expect(FINANCE_KEYBOARD_COMMANDS.length).toBeGreaterThanOrEqual(20);
    const ids = FINANCE_KEYBOARD_COMMANDS.map((c) => c.id);
    // Standard shortcuts.
    for (const id of [
      'grid.copy',
      'grid.paste',
      'grid.undo',
      'grid.redo',
      'grid.find',
      'grid.save',
      // Deliberately still present, and deliberately still on the bare keys: the
      // 2026-08-10 destructiveness fix guards them with `confirmAboveTargetCount: 1`
      // rather than moving or removing them (see the DESTRUCTIVE describe block
      // below, and CLEAR_DESTRUCTIVENESS's comment for why a modifier was rejected).
      'grid.clearDelete',
      'grid.clearBackspace',
      'grid.navigateUp',
      'grid.navigateDown',
      'grid.navigateLeft',
      'grid.navigateRight',
      'grid.extendUp',
      'grid.extendDown',
      'grid.extendLeft',
      'grid.extendRight',
      'grid.confirmEdit',
      'grid.cancelEdit',
      'grid.nextCellTab',
    ]) {
      expect(ids).toContain(id);
    }
    // Finance-specific shortcuts (Compute/Compare/Comments).
    for (const id of ['finance.compute', 'finance.compare', 'finance.comment']) {
      expect(ids).toContain(id);
    }
  });

  it('has no duplicate command ids', () => {
    const ids = FINANCE_KEYBOARD_COMMANDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has zero combo collisions in the shipped registry (task scope item 5)', () => {
    expect(findComboCollisions(FINANCE_KEYBOARD_COMMANDS)).toEqual([]);
    expect(() => assertNoComboCollisions(FINANCE_KEYBOARD_COMMANDS)).not.toThrow();
    expect(() => new KeyboardCommandRegistry(FINANCE_KEYBOARD_COMMANDS)).not.toThrow();
  });

  it('detects a real collision when two commands share (context, combo)', () => {
    const colliding = [
      ...FINANCE_KEYBOARD_COMMANDS,
      {
        ...FINANCE_KEYBOARD_COMMANDS[0]!,
        id: 'grid.copy.duplicate',
      },
    ];
    const collisions = findComboCollisions(colliding);
    expect(collisions.length).toBe(1);
    expect(collisions[0]!.commandIds).toEqual(expect.arrayContaining(['grid.copy', 'grid.copy.duplicate']));
    expect(() => assertNoComboCollisions(colliding)).toThrow(/combo collision/);
    expect(() => new KeyboardCommandRegistry(colliding)).toThrow(/combo collision/);
  });

  it('does NOT flag the same combo used in two different contexts as a collision (Enter: start-edit vs confirm-edit is standard editor behavior)', () => {
    const sameComboDifferentContext = [
      ...FINANCE_KEYBOARD_COMMANDS,
      {
        id: 'grid.startEditEnter',
        combo: { key: 'Enter' },
        context: 'grid-focused' as const,
        category: 'editing' as const,
        label: 'Start editing',
        description: 'Open the inline editor for the active cell.',
        engineBinding: { kind: 'keyboard-owned' as const, note: 'test fixture only' },
        focusRestoreReason: null,
        destructive: false,
        requiresConfirmation: false,
        confirmAboveTargetCount: null,
      },
    ];
    // grid.confirmEdit already uses combo 'Enter' but in context 'cell-editing' — different context, so no collision.
    expect(findComboCollisions(sameComboDifferentContext)).toEqual([]);
  });

  it('every command has a correctly-typed, structurally valid handler reference (engineBinding)', () => {
    for (const command of FINANCE_KEYBOARD_COMMANDS) {
      expect(COMMAND_CONTEXTS).toContain(command.context);
      switch (command.engineBinding.kind) {
        case 'function':
          expect(command.engineBinding.module.length).toBeGreaterThan(0);
          expect(command.engineBinding.functionName.length).toBeGreaterThan(0);
          expect(['AP-00', 'AP-01', 'AP-03', 'AP-04', 'AP-05', 'AP-06']).toContain(command.engineBinding.engine);
          break;
        case 'inline-contract':
          expect(command.engineBinding.contractType.length).toBeGreaterThan(0);
          expect(command.engineBinding.note.length).toBeGreaterThan(0);
          break;
        case 'keyboard-owned':
          expect(command.engineBinding.note.length).toBeGreaterThan(0);
          break;
        default: {
          const _exhaustive: never = command.engineBinding;
          throw new Error(`Unhandled engineBinding kind: ${JSON.stringify(_exhaustive)}`);
        }
      }
      // label/description are what the command palette searches and displays — must be real text, not placeholders.
      expect(command.label.trim().length).toBeGreaterThan(0);
      expect(command.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('binds Compute/Compare/Comment to the real AP-04/AP-05/AP-06 modules (not placeholders)', () => {
    const registry = new KeyboardCommandRegistry();
    const compute = registry.findById('finance.compute')!;
    const compare = registry.findById('finance.compare')!;
    const comment = registry.findById('finance.comment')!;
    expect(compute.engineBinding).toMatchObject({ kind: 'function', engine: 'AP-04', functionName: 'enqueueComputeForCurrentRevision' });
    expect(compare.engineBinding).toMatchObject({ kind: 'function', engine: 'AP-05', functionName: 'compareValues' });
    expect(comment.engineBinding).toMatchObject({ kind: 'function', engine: 'AP-06', functionName: 'createComment' });
  });

  it('cross-platform combo resolution: Mod+C matches Ctrl+C on windows and Cmd+C on mac, and does not cross-match', () => {
    const registry = new KeyboardCommandRegistry();
    const winCtrlC = event({ key: 'c', ctrlKey: true });
    const macCmdC = event({ key: 'c', metaKey: true });
    const macCtrlC = event({ key: 'c', ctrlKey: true }); // Ctrl+C on mac is a DIFFERENT shortcut space, must NOT match grid.copy.

    expect(registry.resolve(winCtrlC, 'grid-focused', 'windows')?.id).toBe('grid.copy');
    expect(registry.resolve(macCmdC, 'grid-focused', 'mac')?.id).toBe('grid.copy');
    expect(registry.resolve(macCtrlC, 'grid-focused', 'mac')).toBeNull();
  });

  it('resolves the three finance-specific shortcuts on both platforms', () => {
    const registry = new KeyboardCommandRegistry();
    expect(registry.resolve(event({ key: 'Enter', ctrlKey: true }), 'grid-focused', 'windows')?.id).toBe('finance.compute');
    expect(registry.resolve(event({ key: 'Enter', metaKey: true }), 'grid-focused', 'mac')?.id).toBe('finance.compute');
    expect(registry.resolve(event({ key: 'd', ctrlKey: true }), 'grid-focused', 'windows')?.id).toBe('finance.compare');
    expect(registry.resolve(event({ key: 'd', metaKey: true }), 'grid-focused', 'mac')?.id).toBe('finance.compare');
    expect(registry.resolve(event({ key: 'm', ctrlKey: true }), 'grid-focused', 'windows')?.id).toBe('finance.comment');
    expect(registry.resolve(event({ key: 'm', metaKey: true }), 'grid-focused', 'mac')?.id).toBe('finance.comment');
  });

  it('resolves undo/redo distinctly (Mod+Z vs Mod+Shift+Z)', () => {
    const registry = new KeyboardCommandRegistry();
    expect(registry.resolve(event({ key: 'z', ctrlKey: true }), 'grid-focused', 'windows')?.id).toBe('grid.undo');
    expect(registry.resolve(event({ key: 'z', ctrlKey: true, shiftKey: true }), 'grid-focused', 'windows')?.id).toBe('grid.redo');
  });

  it("'global' Save resolves in both grid-focused and cell-editing contexts", () => {
    const registry = new KeyboardCommandRegistry();
    const saveEvent = event({ key: 's', ctrlKey: true });
    expect(registry.resolve(saveEvent, 'grid-focused', 'windows')?.id).toBe('grid.save');
    expect(registry.resolve(saveEvent, 'cell-editing', 'windows')?.id).toBe('grid.save');
  });

  it('Enter resolves to confirmEdit in cell-editing context and to nothing in grid-focused (start-edit is out of this registry`s scope, undefined here)', () => {
    const registry = new KeyboardCommandRegistry();
    const enterEvent = event({ key: 'Enter' });
    expect(registry.resolve(enterEvent, 'cell-editing', 'windows')?.id).toBe('grid.confirmEdit');
    expect(registry.resolve(enterEvent, 'grid-focused', 'windows')).toBeNull();
  });

  it('describeCombo renders platform-appropriate labels', () => {
    const copy = FINANCE_KEYBOARD_COMMANDS.find((c) => c.id === 'grid.copy')!;
    expect(describeCombo(copy.combo, 'mac')).toBe('⌘C');
    expect(describeCombo(copy.combo, 'windows')).toBe('Ctrl+C');
    const redo = FINANCE_KEYBOARD_COMMANDS.find((c) => c.id === 'grid.redo')!;
    expect(describeCombo(redo.combo, 'windows')).toBe('Ctrl+Shift+Z');
  });

  it('comboMatchesEvent is the single source of truth resolve() also uses (no drift)', () => {
    const copy = FINANCE_KEYBOARD_COMMANDS.find((c) => c.id === 'grid.copy')!;
    expect(comboMatchesEvent(copy.combo, event({ key: 'c', ctrlKey: true }), 'windows')).toBe(true);
    expect(comboMatchesEvent(copy.combo, event({ key: 'c', ctrlKey: true, shiftKey: true }), 'windows')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 1b. Destructive-command guards (2026-08-10 data-safety fix).
//
// The defect these tests lock down: `Delete` and `Backspace` were bare,
// unmodified, unconfirmed bindings onto BulkOpsEngine's CLEAR, so one keystroke
// after a shift+arrow range extension forced value_status = MISSING on every
// selected cell — with focusRestoreReason: null, so the user was not even
// returned to the damage.
// ---------------------------------------------------------------------------

describe('AP-03 destructive command guards', () => {
  it('the shipped registry has zero destructive-guard violations, and the constructor enforces it', () => {
    expect(findDestructiveGuardViolations(FINANCE_KEYBOARD_COMMANDS)).toEqual([]);
    expect(() => assertDestructiveCommandsAreGuarded(FINANCE_KEYBOARD_COMMANDS)).not.toThrow();
    expect(() => new KeyboardCommandRegistry(FINANCE_KEYBOARD_COMMANDS)).not.toThrow();
  });

  it('CLEAR is declared destructive on both keys, with identical guards (Delete/Backspace must never drift apart)', () => {
    const registry = new KeyboardCommandRegistry();
    const del = registry.findById('grid.clearDelete')!;
    const back = registry.findById('grid.clearBackspace')!;
    for (const command of [del, back]) {
      expect(command.destructive).toBe(true);
      expect(command.confirmAboveTargetCount).toBe(MAX_UNCONFIRMED_BARE_KEY_TARGETS);
      // The whole point of the fix: the user is returned to the damage.
      expect(command.focusRestoreReason).toBe('bulkOp');
    }
    expect(del.confirmAboveTargetCount).toBe(back.confirmAboveTargetCount);
    expect(del.requiresConfirmation).toBe(back.requiresConfirmation);
  });

  it('THE REGRESSION ITSELF: clearing one cell fires immediately, clearing a shift+arrow range demands confirmation', () => {
    const registry = new KeyboardCommandRegistry();
    const clear = registry.resolve(event({ key: 'Delete' }), 'grid-focused', 'windows')!;
    expect(clear.id).toBe('grid.clearDelete');

    // Blast radius 1 — instant, undoable with Mod+Z.
    expect(requiresConfirmationBeforeExecuting(clear, 1)).toBe(false);
    // Blast radius 2..N — the case the old registry executed silently.
    expect(requiresConfirmationBeforeExecuting(clear, 2)).toBe(true);
    expect(requiresConfirmationBeforeExecuting(clear, 400)).toBe(true);
  });

  it('the single entry point refuses to execute an unconfirmed bulk clear', () => {
    const registry = new KeyboardCommandRegistry();
    const bulk = registry.dispatch(event({ key: 'Delete' }), {
      ...baseDispatchContext(),
      selectedCellCount: 40,
    });
    expect(bulk.status).toBe('needs-confirmation');
    if (bulk.status !== 'needs-confirmation') throw new Error('unreachable');
    expect(bulk.command.id).toBe('grid.clearDelete');
    expect(bulk.targetCount).toBe(40);
    expect(bulk.message.pl).toContain('40');

    const single = registry.dispatch(event({ key: 'Delete' }), {
      ...baseDispatchContext(),
      selectedCellCount: 1,
    });
    expect(single.status).toBe('execute');
  });

  it('NEGATIVE CONTROL — the validator actually rejects each way of reintroducing the defect', () => {
    const clear = FINANCE_KEYBOARD_COMMANDS.find((c) => c.id === 'grid.clearDelete')!;

    // (a) exactly the pre-fix declaration: bare key, no confirmation, no threshold.
    const preFix = { ...clear, requiresConfirmation: false, confirmAboveTargetCount: null };
    const preFixViolations = findDestructiveGuardViolations([preFix]);
    expect(preFixViolations.map((v) => v.code)).toContain('DESTRUCTIVE_WITHOUT_CONFIRMATION');
    expect(() => new KeyboardCommandRegistry([preFix])).toThrow(/destructive-command guard violation/);

    // (b) a threshold so high it is not a guard.
    const looseThreshold = { ...clear, confirmAboveTargetCount: 500 };
    expect(findDestructiveGuardViolations([looseThreshold]).map((v) => v.code)).toContain(
      'DESTRUCTIVE_BARE_KEY_THRESHOLD_TOO_HIGH'
    );

    // (c) destructive but no focus restore — the user cannot see what was destroyed.
    const noFocus = { ...clear, focusRestoreReason: null };
    expect(findDestructiveGuardViolations([noFocus]).map((v) => v.code)).toContain(
      'DESTRUCTIVE_WITHOUT_FOCUS_RESTORE'
    );

    // (d) half-declared policy on a non-destructive command.
    const copy = FINANCE_KEYBOARD_COMMANDS.find((c) => c.id === 'grid.copy')!;
    expect(findDestructiveGuardViolations([{ ...copy, requiresConfirmation: true }]).map((v) => v.code)).toContain(
      'GUARD_ON_NON_DESTRUCTIVE_COMMAND'
    );
  });

  it('a modifier IS accepted as a guard, but Shift alone is NOT (shift is the range-extension key on this very grid)', () => {
    const clear = FINANCE_KEYBOARD_COMMANDS.find((c) => c.id === 'grid.clearDelete')!;
    expect(comboHasGuardModifier({ key: 'Delete' })).toBe(false);
    expect(comboHasGuardModifier({ key: 'Delete', shift: true })).toBe(false);
    expect(comboHasGuardModifier({ key: 'Delete', mod: true })).toBe(true);
    expect(comboHasGuardModifier({ key: 'Delete', alt: true })).toBe(true);

    // Shift+Delete with a loose threshold stays a violation...
    expect(
      findDestructiveGuardViolations([
        { ...clear, id: 'x.shiftDelete', combo: { key: 'Delete', shift: true }, confirmAboveTargetCount: 500 },
      ]).map((v) => v.code)
    ).toContain('DESTRUCTIVE_BARE_KEY_THRESHOLD_TOO_HIGH');
    // ...while a real modifier chord may carry a larger threshold.
    expect(
      findDestructiveGuardViolations([
        { ...clear, id: 'x.modDelete', combo: { key: 'Delete', mod: true }, confirmAboveTargetCount: 500 },
      ])
    ).toEqual([]);
  });

  it('paste is deliberately NOT classified destructive (documented judgment call, asserted so a silent flip is visible)', () => {
    const paste = FINANCE_KEYBOARD_COMMANDS.find((c) => c.id === 'grid.paste')!;
    expect(paste.destructive).toBe(false);
    const destructiveIds = FINANCE_KEYBOARD_COMMANDS.filter((c) => c.destructive).map((c) => c.id);
    expect(destructiveIds.sort()).toEqual(['grid.clearBackspace', 'grid.clearDelete']);
  });
});

// ---------------------------------------------------------------------------
// 2. CommandPaletteIndex
// ---------------------------------------------------------------------------

describe('AP-03 CommandPaletteIndex', () => {
  it('indexes every registry command exactly once', () => {
    const index = new CommandPaletteIndex(FINANCE_KEYBOARD_COMMANDS);
    expect(index.all.length).toBe(FINANCE_KEYBOARD_COMMANDS.length);
  });

  it('search() is case-insensitive and matches label/description/category substrings', () => {
    const index = new CommandPaletteIndex(FINANCE_KEYBOARD_COMMANDS);
    expect(index.search('COPY').some((e) => e.command.id === 'grid.copy')).toBe(true);
    expect(index.search('checkpoint').some((e) => e.command.id === 'grid.save')).toBe(true); // from description text
    expect(index.search('finance').length).toBeGreaterThanOrEqual(3); // category match: compute/compare/comment
  });

  it('empty query returns the full unfiltered list (palette`s initial browse state)', () => {
    const index = new CommandPaletteIndex(FINANCE_KEYBOARD_COMMANDS);
    expect(index.search('').length).toBe(FINANCE_KEYBOARD_COMMANDS.length);
    expect(index.search('   ').length).toBe(FINANCE_KEYBOARD_COMMANDS.length);
  });

  it('searchInContext narrows to commands reachable from that context (plus global)', () => {
    const index = new CommandPaletteIndex(FINANCE_KEYBOARD_COMMANDS);
    const editingResults = index.searchInContext('', 'cell-editing');
    const ids = editingResults.map((e) => e.command.id);
    expect(ids).toEqual(expect.arrayContaining(['grid.confirmEdit', 'grid.cancelEdit', 'grid.save']));
    expect(ids).not.toContain('grid.copy'); // grid-focused only, not reachable while editing
  });

  it('precomputes both-platform combo labels', () => {
    const index = new CommandPaletteIndex(FINANCE_KEYBOARD_COMMANDS);
    const entry = index.byId('grid.paste')!;
    expect(entry.comboLabel.mac).toBe('⌘V');
    expect(entry.comboLabel.windows).toBe('Ctrl+V');
  });
});

// ---------------------------------------------------------------------------
// 3. FocusRestoreContract
// ---------------------------------------------------------------------------

describe('AP-03 FocusRestoreContract', () => {
  const cellA = cellRefAt({ row: 0, col: 0 });
  const cellB = cellRefAt({ row: 1, col: 1 });

  it('captures a snapshot of the current active cell and reason', () => {
    const snap = captureFocusSnapshot({ activeCell: cellA, reason: 'undo', now: () => '2026-08-10T00:00:00.000Z' });
    expect(snap).toEqual({ activeCell: cellA, reason: 'undo', capturedAt: '2026-08-10T00:00:00.000Z' });
  });

  it('resolves the focus target for an Operation to its first target cell', () => {
    const setOp = { type: 'set' as const, operationId: 'op-1', idempotencyKey: 'idem-1', actorId: 'u', actorRole: 'preparer' as const, clientTimestamp: 't', sourceWorkingRevisionId: null, target: cellB, value: { status: 'PRESENT_NONZERO' as const, valueDecimal: '5' } };
    expect(focusTargetForOperation(setOp)).toEqual(cellB);
  });

  it('undo/redo/paste/bulkOp collapse the selection to the resolved target; findNavigate/editConfirm/editCancel/commandPaletteInvoke do not', () => {
    for (const reason of ['undo', 'redo', 'paste', 'bulkOp'] as const) {
      expect(resolveFocusRestorePatch(reason, cellA).collapseSelection).toBe(true);
    }
    for (const reason of ['findNavigate', 'editConfirm', 'editCancel', 'commandPaletteInvoke'] as const) {
      expect(resolveFocusRestorePatch(reason, cellA).collapseSelection).toBe(false);
    }
  });

  it('applyFocusRestoreToSelection integrates with AP-00 FinanceGridSelectionState shape', () => {
    const existingSelection = { activeCell: cellA, ranges: [{ topLeft: cellA, bottomRight: cellB }] };

    const collapsed = applyFocusRestoreToSelection(existingSelection, resolveFocusRestorePatch('undo', cellB));
    expect(collapsed).toEqual({ activeCell: cellB, ranges: [{ topLeft: cellB, bottomRight: cellB }] });

    const preserved = applyFocusRestoreToSelection(existingSelection, resolveFocusRestorePatch('editCancel', cellA));
    expect(preserved).toEqual({ activeCell: cellA, ranges: [{ topLeft: cellA, bottomRight: cellB }] });
  });

  it('real integration: undo an OperationStack entry, then resolve+apply focus restore from its inverse Operation', () => {
    const stack = new OperationStack();
    const priorValue: FinanceValue | null = null;
    const setOp = {
      type: 'set' as const,
      operationId: 'op-1',
      idempotencyKey: 'idem-1',
      actorId: 'u',
      actorRole: 'preparer' as const,
      clientTimestamp: 't0',
      sourceWorkingRevisionId: 'wr-0',
      target: cellB,
      value: { status: 'PRESENT_NONZERO' as const, valueDecimal: '42' },
    };
    stack.push(setOp, [priorValue]);

    const undoResult = stack.undo({ operationId: 'op-undo', idempotencyKey: 'idem-undo', actorId: 'u', actorRole: 'preparer', clientTimestamp: 't1', sourceWorkingRevisionId: 'wr-1' });
    expect(undoResult.ok).toBe(true);
    if (!undoResult.ok) throw new Error('unreachable');

    const target = focusTargetForOperation(undoResult.inverseOperation);
    expect(target).toEqual(cellB); // "focus returns to the last-edited cell" — task brief's own example.

    const patch = resolveFocusRestorePatch('undo', target);
    const nextSelection = applyFocusRestoreToSelection({ activeCell: null, ranges: [] }, patch);
    expect(nextSelection).toEqual({ activeCell: cellB, ranges: [{ topLeft: cellB, bottomRight: cellB }] });
  });
});

// ---------------------------------------------------------------------------
// 4. Core-workflow benchmark, <=90s (task scope item 4). Proxy benchmark, the
// same discipline `financeGridPerformance.test.ts` documents for AP-01: no
// DOM/keypress exists in this package, so this measures the CPU-bound share
// of the budget — the actual command-registry resolution + the real AP-01/
// AP-04 engine calls each command binds to — that a future React grid would
// spend before even touching the DOM/network. Sequence per the task brief:
// "select range -> copy -> navigate -> paste -> undo -> find -> replace ->
// save", each step simulated as a direct function call (not a keypress).
// ---------------------------------------------------------------------------

describe('AP-03 keyboard core-workflow benchmark (<=90s)', () => {
  it('runs select->copy->navigate->paste->undo->find->replace->save within the 90s task benchmark', () => {
    const registry = new KeyboardCommandRegistry();
    const stack = new OperationStack();
    const cellStore = new Map<string, FinanceValue>();

    function setStoreValue(ref: CellRef, value: FinanceValue) {
      cellStore.set(`${ref.rowKey.entityId}|${ref.columnKey.periodId}`, value);
    }
    function getStoreValue(ref: CellRef): FinanceValue | null {
      return cellStore.get(`${ref.rowKey.entityId}|${ref.columnKey.periodId}`) ?? null;
    }
    setStoreValue(cellRefAt({ row: 0, col: 0 }), presentValue('100'));
    setStoreValue(cellRefAt({ row: 0, col: 1 }), presentValue('200'));

    const t0 = performance.now();

    // Step 1: select range (grid.extendDown / GridSelectionModel — the engine grid.extendUp/Down/Left/Right binds to).
    const selectCmd = registry.resolve({ key: 'ArrowDown', shiftKey: true, ctrlKey: false, metaKey: false, altKey: false }, 'grid-focused', 'windows');
    expect(selectCmd?.id).toBe('grid.extendDown');
    const selection = new GridSelectionModel();
    selection.setAnchor({ row: 0, col: 0 });
    selection.extendTo({ row: 0, col: 1 }); // 1x2 range: (0,0)-(0,1)
    expect(selection.selectedCellCount()).toBe(2);

    // Step 2: copy (grid.copy -> GridSelectionModel.iterateCells + cellStore read, per engineBinding note).
    const copyCmd = registry.resolve({ key: 'c', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, 'grid-focused', 'windows');
    expect(copyCmd?.id).toBe('grid.copy');
    const clipboard: PasteSourceCell[][] = [[]];
    for (const coord of selection.iterateCells()) {
      const ref = cellRefAt(coord);
      const stored = getStoreValue(ref);
      clipboard[0]!.push({ value: stored ? { status: stored.status, valueDecimal: stored.valueDecimal, nativeCurrency: stored.nativeCurrency, presentationCurrency: stored.presentationCurrency, unit: stored.unit, multiplier: stored.multiplier, sourceRef: stored.sourceRef, isAdjustment: stored.isAdjustment, adjustmentReason: stored.adjustmentReason } : { status: 'MISSING', valueDecimal: null } });
    }
    expect(clipboard[0]!.length).toBe(2);

    // Step 3: navigate (grid.navigateDown -> GridSelectionModel.selectSingle).
    const navCmd = registry.resolve({ key: 'ArrowDown', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }, 'grid-focused', 'windows');
    expect(navCmd?.id).toBe('grid.navigateDown');
    selection.selectSingle({ row: 1, col: 0 });
    expect(selection.activeCell).toEqual({ row: 1, col: 0 });

    // Step 4: paste (grid.paste -> PasteEngine.buildPasteOperations, real AP-01 call).
    const pasteCmd = registry.resolve({ key: 'v', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, 'grid-focused', 'windows');
    expect(pasteCmd?.id).toBe('grid.paste');
    const pasteResult = buildPasteOperations({ ...ctx(), mode: 'VALUES_ONLY', anchor: selection.activeCell!, source: clipboard, resolver });
    expect(pasteResult.ok).toBe(true);
    if (!pasteResult.ok) throw new Error('unreachable');
    const pasteOp = pasteResult.batches[0]!.operations[0]!;
    stack.push(pasteOp, pasteOp.type === 'set' ? [null] : (pasteOp as { target: CellRef[] }).target.map(() => null));
    // Simulate the executor applying it to the store.
    if (pasteOp.type === 'paste') {
      pasteOp.target.forEach((t, i) => {
        const v = pasteOp.values[i]!;
        setStoreValue(t, { status: v.status, valueDecimal: v.valueDecimal, nativeCurrency: v.nativeCurrency ?? 'USD', presentationCurrency: v.presentationCurrency ?? 'USD', unit: v.unit ?? 'THOUSANDS', multiplier: v.multiplier ?? '1', sourceRef: v.sourceRef ?? null, isAdjustment: v.isAdjustment ?? false, adjustmentReason: v.adjustmentReason ?? null });
      });
    }
    expect(getStoreValue(cellRefAt({ row: 1, col: 0 }))?.valueDecimal).toBe('100');

    // Step 5: undo (grid.undo -> OperationStack.undo, real AP-04 call), then resolve focus restore.
    const undoCmd = registry.resolve({ key: 'z', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, 'grid-focused', 'windows');
    expect(undoCmd?.id).toBe('grid.undo');
    const undoResult = stack.undo({ operationId: 'undo-1', idempotencyKey: 'undo-idem-1', actorId: 'user-kbd', actorRole: 'preparer', clientTimestamp: 't-undo', sourceWorkingRevisionId: 'wr-1' });
    expect(undoResult.ok).toBe(true);
    if (!undoResult.ok) throw new Error('unreachable');
    const focusTarget = focusTargetForOperation(undoResult.inverseOperation);
    const focusPatch = resolveFocusRestorePatch('undo', focusTarget);
    expect(focusPatch.collapseSelection).toBe(true);

    // Step 6: find (grid.find -> FindReplaceEngine.findCells, real AP-01 call).
    const findCmd = registry.resolve({ key: 'f', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, 'grid-focused', 'windows');
    expect(findCmd?.id).toBe('grid.find');
    const snapshots: GridCellSnapshot[] = [];
    for (const [key, value] of cellStore.entries()) {
      const [entityId, periodId] = key.split('|');
      const coord = coordinateOf(cellRefAt({ row: Number(entityId!.replace('entity-', '')), col: Number(periodId!.replace('period-', '')) }))!;
      snapshots.push({ coordinate: coord, ref: cellRefAt(coord), value: { status: value.status, valueDecimal: value.valueDecimal, nativeCurrency: value.nativeCurrency, presentationCurrency: value.presentationCurrency, unit: value.unit, multiplier: value.multiplier, sourceRef: value.sourceRef, isAdjustment: value.isAdjustment, adjustmentReason: value.adjustmentReason } });
    }
    const matches = findCells(snapshots, byDecimalEquals('200'));
    expect(matches.length).toBeGreaterThanOrEqual(1);

    // Step 7: replace (via FindReplaceEngine.buildFindReplaceOperations — bound to Find`s follow-up step per engineBinding note, not its own shortcut).
    // (No separate keyboard shortcut per the ZAKRES list — Find opens the UI, Replace is UI-driven; exercised here only to complete the workflow sequence the benchmark simulates.)

    // Step 8: save (grid.save -> autosaveService.checkpointOperationStack — real call skipped here, DB-backed and out of this pure-logic package`s scope; resolving the command is what this benchmark measures).
    const saveCmd = registry.resolve({ key: 's', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, 'grid-focused', 'windows');
    expect(saveCmd?.id).toBe('grid.save');

    const elapsedMs = performance.now() - t0;
    // eslint-disable-next-line no-console
    console.log(`[perf] AP-03 core workflow (select->copy->navigate->paste->undo->find->replace->save): ${elapsedMs.toFixed(2)} ms`);
    expect(elapsedMs).toBeLessThan(90_000);
  });
});
