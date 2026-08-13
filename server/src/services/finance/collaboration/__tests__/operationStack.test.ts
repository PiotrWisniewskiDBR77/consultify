/**
 * Pure unit tests for AP-04's `OperationStack` — no database, per the task
 * brief's own split ("unit: OperationStack logika bez DB"). Every case runs
 * synchronously against plain `Operation`/`FinanceValue` data (AP-00
 * contracts), mirroring `lifecycleService.test.ts`'s DB-free design.
 */
import { describe, expect, it } from 'vitest';

import { financeStmtLinesCellRef, type CellRef } from '../../../../types/finance/CellRef.js';
import type { FinanceValue } from '../../../../types/finance/financeValueSemantics.js';
import type { Operation, OpBulkSet, OpClear, OpPaste, OpReset, OpSet } from '../../../../types/finance/Operation.js';
import { DEFAULT_MAX_UNDO_DEPTH, OperationStack, operationIntendedValues } from '../operationStack.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function cell(canonicalLineId: string, periodId = 'FY2025Q1'): CellRef {
  return financeStmtLinesCellRef({
    organizationId: 'org-1',
    businessVersionId: 'bv-1',
    entityId: 'entity-1',
    canonicalLineId,
    consolidationScope: 'STANDALONE',
    periodId,
    accumulationBasis: 'QUARTER_ONLY',
  });
}

function value(valueDecimal: string): FinanceValue {
  return {
    status: 'PRESENT_NONZERO',
    valueDecimal,
    nativeCurrency: 'USD',
    presentationCurrency: 'USD',
    unit: 'UNITS',
    multiplier: '1',
    sourceRef: null,
    isAdjustment: false,
    adjustmentReason: null,
  };
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function common(overrides: Partial<Operation> = {}) {
  return {
    operationId: nextId('op'),
    idempotencyKey: nextId('idem'),
    actorId: 'user-1',
    actorRole: 'preparer' as const,
    clientTimestamp: new Date().toISOString(),
    sourceWorkingRevisionId: 'wr-0',
    ...overrides,
  };
}

function setOp(target: CellRef, v: string): OpSet {
  return { ...common(), type: 'set', target, value: { status: 'PRESENT_NONZERO', valueDecimal: v } };
}

function pasteOp(targets: CellRef[], values: string[]): OpPaste {
  return {
    ...common(),
    type: 'paste',
    target: targets,
    values: values.map((v) => ({ status: 'PRESENT_NONZERO' as const, valueDecimal: v })),
  };
}

function bulkSetOp(targets: CellRef[], v: string): OpBulkSet {
  return { ...common(), type: 'bulk_set', target: targets, value: { status: 'PRESENT_NONZERO', valueDecimal: v } };
}

function clearOp(targets: CellRef[]): OpClear {
  return { ...common(), type: 'clear', target: targets };
}

function resetOp(targets: CellRef[]): OpReset {
  return { ...common(), type: 'reset', target: targets, strategy: 'TO_PARENT_VERSION_VALUE' };
}

const mint = {
  operationId: 'inverse-op',
  idempotencyKey: 'inverse-idem',
  actorId: 'user-1',
  actorRole: 'preparer' as const,
  clientTimestamp: '2026-08-09T12:00:00.000Z',
  sourceWorkingRevisionId: 'wr-1',
};

// ---------------------------------------------------------------------------
// Basic push/undo/redo
// ---------------------------------------------------------------------------

describe('OperationStack — basic push/undo/redo', () => {
  it('starts empty: cannot undo or redo', () => {
    const stack = new OperationStack();
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(false);
    expect(stack.depth()).toBe(0);
  });

  it('push then undo returns an inverse paste restoring the prior value', () => {
    const stack = new OperationStack();
    const c = cell('REVENUE');
    stack.push(setOp(c, '100'), [value('50')]);
    expect(stack.canUndo()).toBe(true);

    const result = stack.undo(mint);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.inverseOperation.type).toBe('paste');
    if (result.inverseOperation.type !== 'paste') throw new Error('unreachable');
    expect(result.inverseOperation.target).toEqual([c]);
    expect(result.inverseOperation.values.map((v) => ({ status: v.status, valueDecimal: v.valueDecimal }))).toEqual([
      { status: 'PRESENT_NONZERO', valueDecimal: '50' },
    ]);
    // fresh identity, not reused from the original operation
    expect(result.inverseOperation.operationId).toBe('inverse-op');
    expect(result.inverseOperation.sourceWorkingRevisionId).toBe('wr-1');
  });

  it('undo on an empty stack returns NOTHING_TO_UNDO', () => {
    const stack = new OperationStack();
    const result = stack.undo(mint);
    expect(result).toEqual({ ok: false, code: 'NOTHING_TO_UNDO' });
  });

  it('redo replays the original operation with a FRESH identity', () => {
    const stack = new OperationStack();
    const c = cell('REVENUE');
    const original = setOp(c, '100');
    stack.push(original, [null]);
    stack.undo(mint);

    expect(stack.canRedo()).toBe(true);
    const redone = stack.redo({ ...mint, operationId: 'redo-op', idempotencyKey: 'redo-idem' });
    expect(redone.ok).toBe(true);
    if (!redone.ok) throw new Error('unreachable');
    expect(redone.operation.type).toBe('set');
    if (redone.operation.type !== 'set') throw new Error('unreachable');
    expect(redone.operation.target).toEqual(c);
    expect(redone.operation.value).toEqual({ status: 'PRESENT_NONZERO', valueDecimal: '100' });
    expect(redone.operation.operationId).toBe('redo-op');
    expect(redone.operation.operationId).not.toBe(original.operationId);
  });

  it('redo on a stack with nothing undone returns NOTHING_TO_REDO', () => {
    const stack = new OperationStack();
    stack.push(setOp(cell('REVENUE'), '100'), [null]);
    const result = stack.redo(mint);
    expect(result).toEqual({ ok: false, code: 'NOTHING_TO_REDO' });
  });

  it('a new push after an undo discards the redo branch (standard editor semantics)', () => {
    const stack = new OperationStack();
    stack.push(setOp(cell('A'), '1'), [null]);
    stack.undo(mint);
    expect(stack.canRedo()).toBe(true);

    stack.push(setOp(cell('B'), '2'), [null]);
    expect(stack.canRedo()).toBe(false);
    // the undone A entry was discarded by the new push, not kept alongside B
    expect(stack.depth()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Atomic bulk/paste undo — the task brief's core requirement
// ---------------------------------------------------------------------------

describe('OperationStack — atomic bulk/paste undo (task: "cofa CALY Operation jednym ruchem")', () => {
  it('undoing a 3-cell paste reverts all 3 cells in ONE inverse operation, not three', () => {
    const stack = new OperationStack();
    const targets = [cell('A'), cell('B'), cell('C')];
    const priorValues = [value('1'), null, value('3')];
    stack.push(pasteOp(targets, ['10', '20', '30']), priorValues);

    expect(stack.depth()).toBe(1); // ONE stack entry for the whole paste, not three
    const result = stack.undo(mint);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.inverseOperation.type).toBe('paste');
    if (result.inverseOperation.type !== 'paste') throw new Error('unreachable');
    // all three cells restored in the SAME operation
    expect(result.inverseOperation.target).toEqual(targets);
    expect(result.inverseOperation.values.map((v) => ({ status: v.status, valueDecimal: v.valueDecimal }))).toEqual([
      { status: 'PRESENT_NONZERO', valueDecimal: '1' },
      { status: 'MISSING', valueDecimal: null },
      { status: 'PRESENT_NONZERO', valueDecimal: '3' },
    ]);
  });

  it('undoing a bulk_set reverts every targeted cell to its own distinct prior value in one move', () => {
    const stack = new OperationStack();
    const targets = [cell('A'), cell('B')];
    stack.push(bulkSetOp(targets, '999'), [value('5'), value('7')]);

    const result = stack.undo(mint);
    if (!result.ok) throw new Error('unreachable');
    if (result.inverseOperation.type !== 'paste') throw new Error('unreachable');
    expect(result.inverseOperation.values.map((v) => v.valueDecimal)).toEqual(['5', '7']);
  });

  it('undoing a clear restores whatever was cleared, for every target, atomically', () => {
    const stack = new OperationStack();
    const targets = [cell('A'), cell('B')];
    stack.push(clearOp(targets), [value('42'), value('43')]);

    const result = stack.undo(mint);
    if (!result.ok) throw new Error('unreachable');
    if (result.inverseOperation.type !== 'paste') throw new Error('unreachable');
    expect(result.inverseOperation.values.map((v) => v.valueDecimal)).toEqual(['42', '43']);
  });

  it('undoing a reset restores the local edit the reset discarded, for every target, atomically', () => {
    const stack = new OperationStack();
    const targets = [cell('A'), cell('B'), cell('C')];
    stack.push(resetOp(targets), [value('1'), value('2'), null]);

    const result = stack.undo(mint);
    if (!result.ok) throw new Error('unreachable');
    if (result.inverseOperation.type !== 'paste') throw new Error('unreachable');
    expect(result.inverseOperation.target).toHaveLength(3);
    expect(result.inverseOperation.values.map((v) => ({ status: v.status, valueDecimal: v.valueDecimal }))).toEqual([
      { status: 'PRESENT_NONZERO', valueDecimal: '1' },
      { status: 'PRESENT_NONZERO', valueDecimal: '2' },
      { status: 'MISSING', valueDecimal: null },
    ]);
  });

  it('rejects a push whose priorValues length does not match the operation target count', () => {
    const stack = new OperationStack();
    expect(() => stack.push(pasteOp([cell('A'), cell('B')], ['1', '2']), [value('0')])).toThrow(/priorValues.length/);
  });
});

// ---------------------------------------------------------------------------
// Depth / eviction
// ---------------------------------------------------------------------------

describe('OperationStack — depth, min 50, configurable', () => {
  it('defaults to at least 50 undo levels', () => {
    expect(DEFAULT_MAX_UNDO_DEPTH).toBeGreaterThanOrEqual(50);
    const stack = new OperationStack();
    expect(stack.maxDepth).toBe(DEFAULT_MAX_UNDO_DEPTH);
  });

  it('is configurable to a smaller depth', () => {
    const stack = new OperationStack({ maxDepth: 3 });
    expect(stack.maxDepth).toBe(3);
  });

  it('evicts the OLDEST entry once maxDepth is exceeded (bounded, not unbounded, stack)', () => {
    const stack = new OperationStack({ maxDepth: 3 });
    for (let i = 0; i < 5; i++) {
      stack.push(setOp(cell(`L${i}`), String(i)), [null]);
    }
    expect(stack.depth()).toBe(3);
    // the two oldest pushes (L0, L1) were evicted; undoing 3 times reaches L2, L3, L4
    const first = stack.undo(mint);
    if (!first.ok) throw new Error('unreachable');
    if (first.inverseOperation.type !== 'paste') throw new Error('unreachable');
    expect((first.inverseOperation.target[0] as CellRef).rowKey).toMatchObject({ canonicalLineId: 'L4' });
  });

  it('rejects a non-positive-integer maxDepth', () => {
    expect(() => new OperationStack({ maxDepth: 0 })).toThrow();
    expect(() => new OperationStack({ maxDepth: -1 })).toThrow();
    expect(() => new OperationStack({ maxDepth: 1.5 })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Serialization round-trip (crash recovery entry point)
// ---------------------------------------------------------------------------

describe('OperationStack.fromEntries / toArray — serialization round-trip', () => {
  it('round-trips entries and cursor position', () => {
    const stack = new OperationStack();
    stack.push(setOp(cell('A'), '1'), [null]);
    stack.push(setOp(cell('B'), '2'), [null]);
    stack.undo(mint); // cursor now at 1

    const entries = stack.toArray();
    const restored = OperationStack.fromEntries(entries, { cursor: stack.cursorPosition() });
    expect(restored.depth()).toBe(2);
    expect(restored.canUndo()).toBe(true);
    expect(restored.canRedo()).toBe(true);
  });

  it('truncates a persisted list longer than maxDepth, keeping the most recent entries', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      operation: setOp(cell(`L${i}`), String(i)),
      priorValues: [null],
      pushedAt: new Date().toISOString(),
    }));
    const restored = OperationStack.fromEntries(entries, { maxDepth: 4 });
    expect(restored.depth()).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// operationIntendedValues — shared projection also used by conflictResolver.ts
// ---------------------------------------------------------------------------

describe('operationIntendedValues', () => {
  it('set -> [value]', () => {
    expect(operationIntendedValues(setOp(cell('A'), '5'))).toEqual([{ status: 'PRESENT_NONZERO', valueDecimal: '5' }]);
  });

  it('bulk_set -> the same value repeated per target', () => {
    const targets = [cell('A'), cell('B')];
    expect(operationIntendedValues(bulkSetOp(targets, '9'))).toEqual([
      { status: 'PRESENT_NONZERO', valueDecimal: '9' },
      { status: 'PRESENT_NONZERO', valueDecimal: '9' },
    ]);
  });

  it('paste -> its own values array, aligned', () => {
    const targets = [cell('A'), cell('B')];
    expect(operationIntendedValues(pasteOp(targets, ['1', '2']))).toEqual([
      { status: 'PRESENT_NONZERO', valueDecimal: '1' },
      { status: 'PRESENT_NONZERO', valueDecimal: '2' },
    ]);
  });

  it('clear -> MISSING per target', () => {
    const targets = [cell('A'), cell('B')];
    expect(operationIntendedValues(clearOp(targets))).toEqual([
      { status: 'MISSING', valueDecimal: null },
      { status: 'MISSING', valueDecimal: null },
    ]);
  });

  it('reset -> null per target (unresolvable without a DB read — never guessed)', () => {
    const targets = [cell('A'), cell('B')];
    expect(operationIntendedValues(resetOp(targets))).toEqual([null, null]);
  });
});
