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
import { createEmptyWorkspaceState, type FinanceWorkspaceState } from '../../../../types/finance/WorkspaceState.js';
import {
  createFocusModeSession,
  enterFocusMode,
  exitFocusMode,
  resolveEscapeKey,
  type FocusModeTrigger,
} from '../../workspace/focusModeContract.js';
import {
  applyFocusRestoreToSelection,
  captureFocusSnapshot,
  focusRestorePatchFromFocusModeEffects,
  focusSnapshotFromFocusModeSession,
  focusTargetForOperation,
  resolveFocusRestorePatch,
} from '../FocusRestoreContract.js';
import {
  AP_OWNERS,
  COMMAND_CONTEXTS,
  COMMAND_SCOPES,
  activationSurfaces,
  comboHasGuardModifier,
  comboMatchesEvent,
  describeCombo,
  type KeyboardCommand,
  type KeyboardEventLike,
} from '../commandTypes.js';
import { AVAILABILITY_ALWAYS, type CommandEvaluationContext } from '../CommandAvailability.js';
import {
  FINANCE_KEYBOARD_COMMANDS,
  KeyboardCommandRegistry,
  MAX_UNCONFIRMED_BARE_KEY_TARGETS,
  assertDestructiveCommandsAreGuarded,
  assertNoComboCollisions,
  commandActivations,
  findComboCollisions,
  findDestructiveGuardViolations,
  requiresConfirmationBeforeExecuting,
  type CommandDispatchContext,
  type CommandDispatchResult,
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

/**
 * A grid-focused, single-cell, Windows, desktop, DRAFT-as-preparer dispatch
 * context — the ordinary working case every test varies ONE fact from.
 */
function baseDispatchContext(): CommandDispatchContext {
  return {
    context: 'grid-focused',
    platform: 'windows',
    selectedCellCount: 1,
    status: 'DRAFT',
    role: 'preparer',
    freshness: 'CURRENT',
    gates: {},
    artifactType: 'STATEMENT_PACK',
    viewportWidthPx: 1440,
  };
}

function baseEvaluationContext(): CommandEvaluationContext {
  const { context: _context, platform: _platform, selectedCellCount: _count, ...rest } = baseDispatchContext();
  return rest;
}

function workspaceStateFixture(activeCell: CellRef | null = null): FinanceWorkspaceState {
  const state = createEmptyWorkspaceState({
    organizationId: 'org-kbd',
    userId: 'user-kbd',
    artifactRef: {
      organizationId: 'org-kbd',
      artifactId: 'artifact-kbd',
      businessVersionId: 'bv-kbd',
      naturalKey: null,
      artifactType: 'STATEMENT_PACK',
    },
    sourceWorkingRevisionId: 'wr-0',
    now: () => '2026-08-10T00:00:00.000Z',
  });
  return activeCell ? { ...state, selection: { activeCell, ranges: [] } } : state;
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
        scope: 'grid' as const,
        availability: AVAILABILITY_ALWAYS,
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
          expect(AP_OWNERS).toContain(command.engineBinding.engine);
          break;
        case 'inline-contract':
          expect(command.engineBinding.contractType.length).toBeGreaterThan(0);
          expect(command.engineBinding.note.length).toBeGreaterThan(0);
          expect(AP_OWNERS).toContain(command.engineBinding.engine);
          break;
        case 'keyboard-owned':
          expect(command.engineBinding.note.length).toBeGreaterThan(0);
          break;
        case 'workspace-state':
          // Only legitimate for workspace-level commands: it says "an AP-09/AP-11
          // contract owns this state and exports no mutator", which is not a
          // statement a grid command could truthfully make.
          expect(command.scope).toBe('workspace');
          expect(command.engineBinding.stateOwner.length).toBeGreaterThan(0);
          expect(command.engineBinding.module.length).toBeGreaterThan(0);
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
// 1c. Scope (the second axis) and collision semantics under it.
// ---------------------------------------------------------------------------

describe('AP-03 command scope', () => {
  it('every command declares a scope, and both levels are populated', () => {
    for (const command of FINANCE_KEYBOARD_COMMANDS) {
      expect(COMMAND_SCOPES).toContain(command.scope);
    }
    const registry = new KeyboardCommandRegistry();
    expect(registry.forScope('grid').length).toBeGreaterThanOrEqual(22);
    expect(registry.forScope('workspace').length).toBeGreaterThanOrEqual(8);
    expect(registry.forScope('grid').length + registry.forScope('workspace').length).toBe(
      FINANCE_KEYBOARD_COMMANDS.length
    );
  });

  it('scope is NOT a free namespace: workspace commands are live on the grid surface, so they cannot reuse a grid combo', () => {
    // The dangerous misreading of "scope" would be "different scope, no conflict".
    expect(activationSurfaces('grid')).toEqual(['grid']);
    expect(activationSurfaces('workspace')).toContain('grid');

    const gridCopy = FINANCE_KEYBOARD_COMMANDS.find((c) => c.id === 'grid.copy')!;
    const workspaceImpostor = {
      ...FINANCE_KEYBOARD_COMMANDS.find((c) => c.id === 'workspace.back')!,
      id: 'workspace.impostor',
      combo: gridCopy.combo, // Mod+C, already owned by the grid.
      context: 'grid-focused' as const,
    };
    const collisions = findComboCollisions([...FINANCE_KEYBOARD_COMMANDS, workspaceImpostor]);
    expect(collisions.length).toBeGreaterThan(0);
    expect(collisions[0]!.commandIds).toEqual(expect.arrayContaining(['grid.copy', 'workspace.impostor']));
    expect(() => new KeyboardCommandRegistry([...FINANCE_KEYBOARD_COMMANDS, workspaceImpostor])).toThrow(
      /combo collision/
    );
  });

  it('genuinely DISJOINT activations may share a combo (Escape: cancel-edit while editing vs exit-focus-mode while not)', () => {
    // Both are shipped commands, both bind Escape, and the registry is clean.
    const cancel = FINANCE_KEYBOARD_COMMANDS.find((c) => c.id === 'grid.cancelEdit')!;
    const exitFocus = FINANCE_KEYBOARD_COMMANDS.find((c) => c.id === 'workspace.exitFocusMode')!;
    expect(cancel.combo.key).toBe('Escape');
    expect(exitFocus.combo.key).toBe('Escape');
    expect(cancel.scope).toBe('grid');
    expect(exitFocus.scope).toBe('workspace');
    // Disjoint because their MODE contexts do not overlap...
    const shared = commandActivations(cancel).filter((a) => commandActivations(exitFocus).includes(a));
    expect(shared).toEqual([]);
    // ...and so the shipped registry stays collision-free.
    expect(findComboCollisions(FINANCE_KEYBOARD_COMMANDS)).toEqual([]);
  });

  it('closes the pre-existing hole: a global command and a same-combo context command are now reported', () => {
    // grid.save is `global` + Mod+S. Under the old `${context}::${combo}` key
    // these two were compared in different buckets and the clash was invisible,
    // even though forContext('grid-focused') returns BOTH.
    const save = FINANCE_KEYBOARD_COMMANDS.find((c) => c.id === 'grid.save')!;
    const shadow = { ...save, id: 'grid.saveShadow', context: 'grid-focused' as const };
    const registry = new KeyboardCommandRegistry();
    expect(registry.forContext('grid-focused').filter((c) => c.combo.key === 's').length).toBe(1);
    expect(findComboCollisions([...FINANCE_KEYBOARD_COMMANDS, shadow]).map((c) => c.commandIds)).toContainEqual(
      expect.arrayContaining(['grid.save', 'grid.saveShadow'])
    );
  });
});

// ---------------------------------------------------------------------------
// 1d. canExecute / permissions — REUSING AP-09's model, plus the readable
// reason AP-09 does not carry.
// ---------------------------------------------------------------------------

describe('AP-03 canExecute and unavailability reasons', () => {
  const registry = new KeyboardCommandRegistry();
  const paste = registry.findById('grid.paste')!;
  const copy = registry.findById('grid.copy')!;

  it('the ordinary case executes: preparer, DRAFT, desktop', () => {
    expect(registry.canExecute(paste, baseEvaluationContext())).toEqual({ canExecute: true });
  });

  it('blocks by STATUS with a sentence a user can read (not the enum value)', () => {
    const result = registry.canExecute(paste, { ...baseEvaluationContext(), status: 'APPROVED' });
    expect(result.canExecute).toBe(false);
    if (result.canExecute) throw new Error('unreachable');
    expect(result.reason).toBe('STATUS');
    expect(result.detail).toBe('APPROVED');
    expect(result.message.pl).toBe('Niedostępne dla wersji w statusie „Zatwierdzone".');
    expect(result.message.key).toBe('finance.keyboard.blocked.status');
    // The readable half is the point: no raw enum leaks into the sentence.
    expect(result.message.pl).not.toContain('APPROVED');
  });

  it('blocks by ROLE, and a viewer can still copy/navigate', () => {
    const blocked = registry.canExecute(paste, { ...baseEvaluationContext(), role: 'viewer' });
    expect(blocked.canExecute).toBe(false);
    if (blocked.canExecute) throw new Error('unreachable');
    expect(blocked.reason).toBe('ROLE');
    expect(blocked.message.pl).toContain('Podgląd');
    expect(registry.canExecute(copy, { ...baseEvaluationContext(), role: 'viewer' })).toEqual({ canExecute: true });
  });

  it('blocks by ARTIFACT_TYPE — the axis a single global registry needs and a per-module bar does not', () => {
    const onlyStatements = {
      ...paste,
      availability: { ...paste.availability, artifactTypes: ['STATEMENT_PACK'] as const },
    };
    const result = registry.canExecute(onlyStatements, { ...baseEvaluationContext(), artifactType: 'VALUATION_CASE' });
    expect(result.canExecute).toBe(false);
    if (result.canExecute) throw new Error('unreachable');
    expect(result.reason).toBe('ARTIFACT_TYPE');
    expect(result.message.pl).toContain('Wycena');
  });

  it('honours AP-09s viewport policy instead of re-deciding it: mobile cannot edit or compute, tablet can review', () => {
    const compute = registry.findById('finance.compute')!;
    const comment = registry.findById('finance.comment')!;
    const mobile = { ...baseEvaluationContext(), viewportWidthPx: 390 };
    const tablet = { ...baseEvaluationContext(), viewportWidthPx: 900 };

    for (const command of [paste, compute]) {
      const result = registry.canExecute(command, mobile);
      expect(result.canExecute).toBe(false);
      if (result.canExecute) throw new Error('unreachable');
      expect(result.reason).toBe('VIEWPORT');
      expect(result.message.pl).toContain('otwórz artefakt na komputerze');
    }
    expect(registry.canExecute(comment, tablet)).toEqual({ canExecute: true });
    expect(registry.canExecute(paste, tablet).canExecute).toBe(false); // tablet: read/review only
  });

  it('GATE reasons are readable when the module supplies a gate label, and still a sentence when it does not', () => {
    const gated = {
      ...paste,
      availability: { ...paste.availability, requiresGates: ['statements.mappingComplete'] },
    };
    const withoutLabel = registry.canExecute(gated, baseEvaluationContext());
    if (withoutLabel.canExecute) throw new Error('unreachable');
    expect(withoutLabel.reason).toBe('GATE');
    expect(withoutLabel.message.pl).toContain('statements.mappingComplete');

    const withLabel = registry.canExecute(gated, {
      ...baseEvaluationContext(),
      gateLabels: { 'statements.mappingComplete': { key: 'x', pl: 'Mapowanie źródeł' } },
    });
    if (withLabel.canExecute) throw new Error('unreachable');
    expect(withLabel.message.pl).toBe('Najpierw ukończ krok: Mapowanie źródeł.');

    // Fail-closed inherited from AP-09: an unsatisfied/absent gate blocks.
    expect(
      registry.canExecute(gated, { ...baseEvaluationContext(), gates: { 'statements.mappingComplete': true } })
    ).toEqual({ canExecute: true });
  });

  it('Escape (cancelEdit) is never blocked — a blocked cancel would trap the user inside a cell editor', () => {
    const cancel = registry.findById('grid.cancelEdit')!;
    for (const ctx of [
      { ...baseEvaluationContext(), role: 'viewer' as const },
      { ...baseEvaluationContext(), status: 'ARCHIVED' as const },
      { ...baseEvaluationContext(), viewportWidthPx: 320 },
    ]) {
      expect(registry.canExecute(cancel, ctx)).toEqual({ canExecute: true });
    }
  });

  it('dispatch() blocks before it confirms — an unpermitted destructive command is never even offered a prompt', () => {
    const result = new KeyboardCommandRegistry().dispatch(event({ key: 'Delete' }), {
      ...baseDispatchContext(),
      role: 'viewer',
      selectedCellCount: 40,
    });
    expect(result.status).toBe('blocked');
    if (result.status !== 'blocked') throw new Error('unreachable');
    expect(result.reason).toBe('ROLE');
  });

  it('the same evaluator answers the palette and the keypress (no second permission model)', () => {
    const ctx = { ...baseDispatchContext(), status: 'APPROVED' as const };
    const viaDispatch = new KeyboardCommandRegistry().dispatch(event({ key: 'v', ctrlKey: true }), ctx);
    const viaQuery = registry.canExecute(paste, ctx);
    if (viaDispatch.status !== 'blocked' || viaQuery.canExecute) throw new Error('unreachable');
    expect(viaDispatch.reason).toBe(viaQuery.reason);
    expect(viaDispatch.message).toEqual(viaQuery.message);
  });
});

// ---------------------------------------------------------------------------
// 1e. Workspace-level commands, and the two phantoms they close.
// ---------------------------------------------------------------------------

describe('AP-03 workspace-level commands', () => {
  const registry = new KeyboardCommandRegistry();

  it('registers the workspace level the original registry lacked entirely', () => {
    const ids = registry.forScope('workspace').map((c) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'workspace.commandPalette',
        'workspace.toggleFocusMode',
        'workspace.exitFocusMode',
        'workspace.nextView',
        'workspace.previousView',
        'workspace.toggleRelatedPanel',
        'workspace.lifecycleMenu',
        'workspace.back',
      ])
    );
  });

  it("PHANTOM CLOSED: focusModeContract declared the trigger 'keyboard-shortcut' with no shortcut behind it", () => {
    // The declaration that had nothing behind it (a compile-time reference to
    // AP-09's union member, so removing it there fails this file too).
    const keyboardTrigger: FocusModeTrigger = 'keyboard-shortcut';
    expect(keyboardTrigger).toBe('keyboard-shortcut');
    const toggle = registry.findById('workspace.toggleFocusMode')!;
    expect(toggle.engineBinding).toMatchObject({
      kind: 'function',
      engine: 'AP-09',
      module: 'services/finance/workspace/focusModeContract.ts',
      functionName: 'enterFocusMode',
    });
    // And it really resolves from a keypress, on both platforms.
    expect(registry.resolve(event({ key: 'f', ctrlKey: true, shiftKey: true }), 'grid-focused', 'windows')?.id).toBe(
      'workspace.toggleFocusMode'
    );
    expect(registry.resolve(event({ key: 'f', metaKey: true, shiftKey: true }), 'cell-editing', 'mac')?.id).toBe(
      'workspace.toggleFocusMode'
    );
    // The trigger the resolver passes is a real member of AP-09's union.
    const session = createFocusModeSession(workspaceStateFixture());
    const entered = enterFocusMode(session, { trigger: 'keyboard-shortcut', restoreFocusToControlId: 'bar.fullscreen' });
    expect(entered.session.active).toBe(true);
    expect(entered.refetched).toBe(false);
  });

  it('PHANTOM CLOSED: FocusRestoreContract declared commandPaletteInvoke, and now a command opens the palette', () => {
    const palette = registry.findById('workspace.commandPalette')!;
    expect(palette.focusRestoreReason).toBe('commandPaletteInvoke');
    expect(registry.resolve(event({ key: 'k', ctrlKey: true }), 'grid-focused', 'windows')?.id).toBe(
      'workspace.commandPalette'
    );
  });

  it('Escape is deferred to AP-09s precedence table, not seized', () => {
    // While a cell editor is open, Escape belongs to the grid...
    expect(registry.resolve(event({ key: 'Escape' }), 'cell-editing', 'windows')?.id).toBe('grid.cancelEdit');
    // ...and outside it, to focus mode.
    expect(registry.resolve(event({ key: 'Escape' }), 'grid-focused', 'windows')?.id).toBe('workspace.exitFocusMode');
    // AP-09 remains the arbiter when several consumers are open at once.
    expect(resolveEscapeKey({ modalOpen: false, commandPaletteOpen: true, popoverOpen: false, cellEditing: true, focusModeActive: true })).toBe('command-palette');
    expect(resolveEscapeKey({ modalOpen: false, commandPaletteOpen: false, popoverOpen: false, cellEditing: true, focusModeActive: true })).toBe('cell-editing');
    expect(resolveEscapeKey({ modalOpen: false, commandPaletteOpen: false, popoverOpen: false, cellEditing: false, focusModeActive: true })).toBe('focus-mode');
  });

  it('workspace commands reuse the WorkspaceBar bridge convention (ids an adapter can point keyboardCommandId at)', () => {
    // moduleAdapters already sets keyboardCommandId: 'finance.compute' on the
    // primary CTA; every id it could point at must exist in this registry.
    for (const id of ['finance.compute', 'workspace.toggleRelatedPanel', 'workspace.lifecycleMenu']) {
      expect(registry.findById(id)).toBeDefined();
    }
    expect(registry.findById('workspace.toggleRelatedPanel')!.engineBinding).toMatchObject({
      engine: 'AP-09',
      functionName: 'buildRelatedPanel',
    });
  });

  it('no workspace command fires a lifecycle transition directly (that would bypass AP-09s destructive/confirmation flags)', () => {
    const lifecycle = registry.findById('workspace.lifecycleMenu')!;
    expect(lifecycle.destructive).toBe(false);
    expect(lifecycle.engineBinding).toMatchObject({ kind: 'inline-contract', contractType: 'WorkspaceBarLifecycleControl' });
    // Nothing in the registry binds a LifecycleAction name.
    const bound = JSON.stringify(FINANCE_KEYBOARD_COMMANDS);
    for (const action of ['approve', 'invalidate', 'archive', 'reopen']) {
      expect(bound).not.toContain(`functionName: "${action}"`);
    }
  });

  it('workspace commands are subject to the same availability model as grid commands', () => {
    const focusMode = registry.findById('workspace.toggleFocusMode')!;
    const onMobile = registry.canExecute(focusMode, { ...baseEvaluationContext(), viewportWidthPx: 375 });
    expect(onMobile.canExecute).toBe(false); // AP-09: mobile has no focus mode.
    const lifecycle = registry.findById('workspace.lifecycleMenu')!;
    expect(registry.canExecute(lifecycle, { ...baseEvaluationContext(), role: 'viewer' }).canExecute).toBe(false);
    expect(registry.canExecute(registry.findById('workspace.back')!, { ...baseEvaluationContext(), role: 'viewer' })).toEqual({ canExecute: true });
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
// 3b. THE TWO FOCUS MODELS AGREE.
//
// AP-03 (this package) tracks focus as `FocusSnapshot.activeCell` +
// `resolveFocusRestorePatch`. AP-09 (`focusModeContract.ts`) independently
// tracks it as `FocusModeSession.focusedCell` + `.restoreFocusToControlId`,
// returned as a `move-focus` effect. Nothing connected them and nothing tested
// that they agreed, so a drift — AP-09 restoring cell A while AP-03's snapshot
// says cell B — would have been invisible to every test in either package.
// ---------------------------------------------------------------------------

describe('AP-03 <-> AP-09 focus model agreement', () => {
  const cellA = cellRefAt({ row: 0, col: 0 });
  const cellB = cellRefAt({ row: 2, col: 1 });

  it('a focus-mode round trip returns focus to exactly the cell AP-03 snapshotted', () => {
    const state = workspaceStateFixture(cellB);
    const session = createFocusModeSession(state);

    // AP-03's view of "where focus is", taken before the toggle.
    const snapshot = focusSnapshotFromFocusModeSession(session, 'focusModeExit', () => '2026-08-10T00:00:00.000Z');
    expect(snapshot.activeCell).toEqual(cellB);

    const entered = enterFocusMode(session, { trigger: 'keyboard-shortcut', restoreFocusToControlId: 'bar.fullscreen' });
    const exited = exitFocusMode(entered.session, { trigger: 'escape-key' });

    // AP-09's view, produced independently by its own effect machinery.
    const patch = focusRestorePatchFromFocusModeEffects(exited.effects);
    expect(patch).not.toBeNull();
    expect(patch!.activeCell).toEqual(snapshot.activeCell); // <- the agreement.
  });

  it('exiting focus mode never collapses the selection — AP-09 promises the toggle preserves it, and AP-03 must not undo that from its side', () => {
    const state = workspaceStateFixture(cellA);
    const exited = exitFocusMode(
      enterFocusMode(createFocusModeSession(state), { trigger: 'toggle-control', restoreFocusToControlId: 'bar.fullscreen' }).session,
      { trigger: 'escape-key' }
    );
    const patch = focusRestorePatchFromFocusModeEffects(exited.effects)!;
    expect(patch.collapseSelection).toBe(false);

    const multiRange = { activeCell: cellA, ranges: [{ topLeft: cellA, bottomRight: cellB }] };
    expect(applyFocusRestoreToSelection(multiRange, patch).ranges).toEqual(multiRange.ranges);
  });

  it('AP-09s own guarantee still holds through the bridge: the workspace state object is carried by reference, never refetched', () => {
    const state = workspaceStateFixture(cellA);
    const entered = enterFocusMode(createFocusModeSession(state), {
      trigger: 'keyboard-shortcut',
      restoreFocusToControlId: 'bar.fullscreen',
    });
    const exited = exitFocusMode(entered.session, { trigger: 'escape-key' });
    expect(entered.session.workspaceState).toBe(state);
    expect(exited.session.workspaceState).toBe(state);
    expect(exited.refetched).toBe(false);
  });

  it('a no-op / control-only exit yields no patch rather than an invented target cell', () => {
    const inactive = createFocusModeSession(workspaceStateFixture(null));
    const noop = exitFocusMode(inactive, { trigger: 'escape-key' });
    expect(noop.noop).toBe(true);
    expect(focusRestorePatchFromFocusModeEffects(noop.effects)).toBeNull();

    // Active session but no focused cell (focus was on a bar control).
    const entered = enterFocusMode(createFocusModeSession(workspaceStateFixture(null)), {
      trigger: 'toggle-control',
      restoreFocusToControlId: 'bar.fullscreen',
    });
    const exited = exitFocusMode(entered.session, { trigger: 'toggle-control' });
    expect(focusRestorePatchFromFocusModeEffects(exited.effects)).toBeNull();
  });
});


// ---------------------------------------------------------------------------
// 4. Core workflow driven ENTIRELY through the registry's single entry point.
//
// WHAT THE PREVIOUS VERSION OF THIS BLOCK PROVED, AND DID NOT:
// it resolved a command, then called the engines directly, step by step. There
// was no single entry point (so nothing prevented a caller from skipping
// resolution — or a guard — entirely), no executor table (so "the command is
// wired to something" was asserted by the test author, not by the code), and
// steps 7 (replace) and 8 (save) were comments, not executed at all. It timed a
// straight line of engine calls and called the result a keyboard benchmark.
//
// WHAT THIS VERSION PROVES: every step is a synthesized KEYSTROKE fed to
// `registry.dispatch()` — the only entry point — whose outcome is routed
// through an executor table keyed by command id, exactly as the future React
// hook is specified to do. A keystroke with no registered executor throws, so
// "unhandled" cannot pass silently. Steps 7 and 8 are executed.
//
// WHAT IT STILL DOES NOT PROVE — reported as EVIDENCE_MISSING, not as a pass:
// there is no DOM here, so nothing verifies that a real grid has reachable
// focus, that `preventDefault` stops the browser stealing Ctrl+F/Ctrl+S, or
// that a human completes the flow in 90 s. Step 7 additionally has NO keyboard
// binding at all (see the dedicated test below). This block measures the
// CPU-bound share of the budget and the completeness of the command path.
// ---------------------------------------------------------------------------

interface KeyLogEntry {
  key: string;
  status: CommandDispatchResult['status'];
  commandId: string | null;
}

/**
 * The whole point: ONE way in. A test that wants to "do something" may only
 * press a key, and only what the registry dispatches can run.
 */
class KeyboardOnlySession {
  readonly registry = new KeyboardCommandRegistry();
  readonly selection = new GridSelectionModel();
  readonly stack = new OperationStack();
  readonly cellStore = new Map<string, FinanceValue>();
  readonly log: KeyLogEntry[] = [];
  clipboard: PasteSourceCell[][] = [];
  findMatches = 0;
  savedCheckpoints = 0;
  focusPatchTargets: CellRef[] = [];

  private readonly executors: Record<string, (command: KeyboardCommand) => void> = {
    'grid.extendRight': () => {
      const active = this.selection.activeCell ?? { row: 0, col: 0 };
      this.selection.extendTo({ row: active.row, col: Math.min(active.col + 1, COL_COUNT - 1) });
    },
    'grid.copy': () => {
      const row: PasteSourceCell[] = [];
      for (const coord of this.selection.iterateCells()) {
        const stored = this.getStoreValue(cellRefAt(coord));
        row.push({ value: stored ? { ...stored } : { status: 'MISSING', valueDecimal: null } });
      }
      this.clipboard = [row];
    },
    'grid.navigateDown': () => {
      const active = this.selection.activeCell ?? { row: 0, col: 0 };
      this.selection.selectSingle({ row: Math.min(active.row + 1, ROW_COUNT - 1), col: active.col });
    },
    'grid.paste': (command) => {
      const result = buildPasteOperations({
        ...ctx(),
        mode: 'VALUES_ONLY',
        anchor: this.selection.activeCell!,
        source: this.clipboard,
        resolver,
      });
      if (!result.ok) throw new Error('paste failed');
      const op = result.batches[0]!.operations[0]!;
      this.stack.push(op, op.type === 'set' ? [null] : (op as { target: CellRef[] }).target.map(() => null));
      if (op.type === 'paste') {
        op.target.forEach((target, i) => {
          const v = op.values[i]!;
          this.setStoreValue(target, {
            status: v.status,
            valueDecimal: v.valueDecimal,
            nativeCurrency: v.nativeCurrency ?? 'USD',
            presentationCurrency: v.presentationCurrency ?? 'USD',
            unit: v.unit ?? 'THOUSANDS',
            multiplier: v.multiplier ?? '1',
            sourceRef: v.sourceRef ?? null,
            isAdjustment: v.isAdjustment ?? false,
            adjustmentReason: v.adjustmentReason ?? null,
          });
        });
      }
      this.applyFocusRestore(command, focusTargetForOperation(op));
    },
    'grid.undo': (command) => {
      const undone = this.stack.undo({
        operationId: 'undo-1',
        idempotencyKey: 'undo-idem-1',
        actorId: 'user-kbd',
        actorRole: 'preparer',
        clientTimestamp: 't-undo',
        sourceWorkingRevisionId: 'wr-1',
      });
      if (!undone.ok) throw new Error('undo failed');
      this.applyFocusRestore(command, focusTargetForOperation(undone.inverseOperation));
    },
    'grid.find': (command) => {
      const snapshots: GridCellSnapshot[] = [];
      for (const [key, value] of this.cellStore.entries()) {
        const [entityId, periodId] = key.split('|');
        const coord = {
          row: Number(entityId!.replace('entity-', '')),
          col: Number(periodId!.replace('period-', '')),
        };
        snapshots.push({ coordinate: coord, ref: cellRefAt(coord), value: { ...value } });
      }
      const matches = findCells(snapshots, byDecimalEquals('200'));
      this.findMatches = matches.length;
      if (matches[0]) this.applyFocusRestore(command, matches[0].ref);
    },
    'grid.save': () => {
      // Step 8 IS executed — but against a double: `checkpointOperationStack`
      // opens a pinned Postgres transaction, which this pure-logic suite has
      // no business standing up. The keystroke, the dispatch and the routing
      // are real; the persistence is not, and is not claimed to be.
      this.savedCheckpoints += 1;
    },
  };

  constructor() {
    this.setStoreValue(cellRefAt({ row: 0, col: 0 }), presentValue('100'));
    this.setStoreValue(cellRefAt({ row: 0, col: 1 }), presentValue('200'));
    this.selection.setAnchor({ row: 0, col: 0 });
  }

  private storeKey(ref: CellRef): string {
    if (ref.rowKey.tableName !== 'finance_stmt_lines' || ref.columnKey.tableName !== 'finance_stmt_lines') {
      throw new Error('KeyboardOnlySession fixture only models finance_stmt_lines cells.');
    }
    return `${ref.rowKey.entityId}|${ref.columnKey.periodId}`;
  }
  setStoreValue(ref: CellRef, value: FinanceValue): void {
    this.cellStore.set(this.storeKey(ref), value);
  }
  getStoreValue(ref: CellRef): FinanceValue | null {
    return this.cellStore.get(this.storeKey(ref)) ?? null;
  }

  private applyFocusRestore(command: KeyboardCommand, target: CellRef): void {
    if (command.focusRestoreReason === null) return;
    const patch = resolveFocusRestorePatch(command.focusRestoreReason, target);
    this.focusPatchTargets.push(patch.activeCell);
  }

  /** The ONLY way to make anything happen in this harness. */
  press(partial: Partial<KeyboardEventLike> & { key: string }, overrides: Partial<CommandDispatchContext> = {}): CommandDispatchResult {
    const result = this.registry.dispatch(event(partial), {
      ...baseDispatchContext(),
      selectedCellCount: Math.max(this.selection.selectedCellCount(), 1),
      ...overrides,
    });
    this.log.push({
      key: partial.key,
      status: result.status,
      commandId: result.status === 'no-match' ? null : result.command.id,
    });
    if (result.status === 'execute') {
      const executor = this.executors[result.command.id];
      if (!executor) {
        throw new Error(`No executor registered for dispatched command "${result.command.id}" — the key did nothing.`);
      }
      executor(result.command);
    }
    return result;
  }
}

describe('AP-03 core workflow through the single entry point (<=90s budget)', () => {
  it('select -> copy -> navigate -> paste -> undo -> find -> save runs as KEYSTROKES, each routed by dispatch()', () => {
    const session = new KeyboardOnlySession();
    const t0 = performance.now();

    // 1. select range
    expect(session.press({ key: 'ArrowRight', shiftKey: true }).status).toBe('execute');
    expect(session.selection.selectedCellCount()).toBe(2);

    // 2. copy
    expect(session.press({ key: 'c', ctrlKey: true }).status).toBe('execute');
    expect(session.clipboard[0]!.length).toBe(2);

    // 3. navigate
    expect(session.press({ key: 'ArrowDown' }).status).toBe('execute');
    expect(session.selection.activeCell).toEqual({ row: 1, col: 1 }); // extendRight moved the active cell to col 1 first

    // 4. paste
    expect(session.press({ key: 'v', ctrlKey: true }).status).toBe('execute');
    expect(session.getStoreValue(cellRefAt({ row: 1, col: 1 }))?.valueDecimal).toBe('100');

    // 5. undo
    expect(session.press({ key: 'z', ctrlKey: true }).status).toBe('execute');
    expect(session.focusPatchTargets.length).toBeGreaterThanOrEqual(2); // paste + undo both restored focus

    // 6. find
    expect(session.press({ key: 'f', ctrlKey: true }).status).toBe('execute');
    expect(session.findMatches).toBeGreaterThanOrEqual(1);

    // 7. replace — see the dedicated test below: NOT reachable from the keyboard.

    // 8. save
    expect(session.press({ key: 's', ctrlKey: true }).status).toBe('execute');
    expect(session.savedCheckpoints).toBe(1);

    // Every keystroke was dispatched to a real, executed command — no gaps.
    expect(session.log.map((l) => l.commandId)).toEqual([
      'grid.extendRight',
      'grid.copy',
      'grid.navigateDown',
      'grid.paste',
      'grid.undo',
      'grid.find',
      'grid.save',
    ]);
    expect(session.log.every((l) => l.status === 'execute')).toBe(true);

    const elapsedMs = performance.now() - t0;
    // eslint-disable-next-line no-console
    console.log(`[perf] AP-03 keyboard-driven core workflow (7 keystrokes through dispatch): ${elapsedMs.toFixed(2)} ms`);
    expect(elapsedMs).toBeLessThan(90_000);
  });

  it('an unmapped keystroke is reported, not silently swallowed', () => {
    const session = new KeyboardOnlySession();
    expect(session.press({ key: 'q', altKey: true, shiftKey: true }).status).toBe('no-match');
  });

  it('GAP, asserted rather than glossed: step 7 (Replace) has NO keyboard binding at all', () => {
    const registry = new KeyboardCommandRegistry();
    // Find exists...
    expect(registry.findById('grid.find')).toBeDefined();
    // ...Replace does not, under any id or any plausible combo.
    expect(FINANCE_KEYBOARD_COMMANDS.some((c) => /replace/i.test(c.id) || /replace/i.test(c.label))).toBe(false);
    for (const combo of [
      { key: 'h', ctrlKey: true },
      { key: 'r', ctrlKey: true },
      { key: 'f', ctrlKey: true, shiftKey: true },
    ]) {
      const hit = registry.resolve(event(combo), 'grid-focused', 'windows');
      expect(hit?.id).not.toBe('grid.replace');
    }
    // The engine is there and works — the BINDING is what is missing, which is
    // why "keyboard-only core workflow" cannot be reported as satisfied.
    const snapshots: GridCellSnapshot[] = [
      { coordinate: { row: 0, col: 1 }, ref: cellRefAt({ row: 0, col: 1 }), value: presentValue('200') },
    ];
    expect(findCells(snapshots, byDecimalEquals('200')).length).toBe(1);
  });

  it('the guard survives the workflow: mid-flow, a bulk clear still stops for confirmation', () => {
    const session = new KeyboardOnlySession();
    session.press({ key: 'ArrowRight', shiftKey: true });
    expect(session.selection.selectedCellCount()).toBe(2);
    const cleared = session.press({ key: 'Delete' });
    expect(cleared.status).toBe('needs-confirmation');
    // And because it was not confirmed, no executor ran and nothing was destroyed.
    expect(session.getStoreValue(cellRefAt({ row: 0, col: 0 }))?.valueDecimal).toBe('100');
  });
});
