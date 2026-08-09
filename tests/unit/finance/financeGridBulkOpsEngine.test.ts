import { describe, expect, it } from 'vitest';

import { buildBulkOperations } from '../../../server/src/services/finance/grid/BulkOpsEngine.ts';
import type { CellRef } from '../../../server/src/types/finance/CellRef.ts';
import type { FinanceValueInput } from '../../../server/src/types/finance/Operation.ts';

function testCellRef(i: number): CellRef {
  return {
    organizationId: 'org-1',
    businessVersionId: 'bv-1',
    tableName: 'finance_stmt_lines',
    rowKey: { tableName: 'finance_stmt_lines', entityId: `entity-${i}`, canonicalLineId: 'REVENUE', consolidationScope: 'STANDALONE' },
    columnKey: { tableName: 'finance_stmt_lines', periodId: 'period-0', accumulationBasis: 'QUARTER_ONLY' },
    period: { periodId: 'period-0', accumulationBasis: 'QUARTER_ONLY' },
  };
}

function presentValue(decimal: string): FinanceValueInput {
  return {
    status: 'PRESENT_NONZERO',
    valueDecimal: decimal,
    nativeCurrency: 'USD',
    presentationCurrency: 'USD',
    unit: 'UNITS',
    multiplier: '1',
    sourceRef: null,
    isAdjustment: false,
    adjustmentReason: null,
  };
}

function baseCtx() {
  return {
    organizationId: 'org-1',
    artifactId: 'artifact-1',
    businessVersionId: 'bv-1',
    expectedWorkingRevisionId: 'wr-1',
    sourceWorkingRevisionId: 'wr-1',
    actorId: 'user-1',
    actorRole: 'preparer' as const,
    now: () => '2026-08-09T00:00:00.000Z',
    generateId: (() => {
      let n = 0;
      return () => `id-${n++}`;
    })(),
  };
}

describe('BulkOpsEngine.buildBulkOperations', () => {
  it('CLEAR emits a single clear Operation over all targets', () => {
    const targets = [testCellRef(0), testCellRef(1), testCellRef(2)];
    const result = buildBulkOperations({ ...baseCtx(), kind: 'CLEAR', targets });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.batches).toHaveLength(1);
    const op = result.batches[0]!.operations[0]!;
    expect(op.type).toBe('clear');
    if (op.type === 'clear') expect(op.target).toHaveLength(3);
  });

  it('RESET emits a reset Operation carrying the strategy', () => {
    const targets = [testCellRef(0)];
    const result = buildBulkOperations({ ...baseCtx(), kind: 'RESET', targets, strategy: 'TO_PARENT_VERSION_VALUE' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const op = result.batches[0]!.operations[0]!;
    expect(op.type).toBe('reset');
    if (op.type === 'reset') expect(op.strategy).toBe('TO_PARENT_VERSION_VALUE');
  });

  it('SET emits a bulk_set Operation with the shared value', () => {
    const targets = [testCellRef(0), testCellRef(1)];
    const result = buildBulkOperations({ ...baseCtx(), kind: 'SET', targets, value: presentValue('99') });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const op = result.batches[0]!.operations[0]!;
    expect(op.type).toBe('bulk_set');
    if (op.type === 'bulk_set') expect(op.value.valueDecimal).toBe('99');
  });

  it('splits >1000 targets into multiple batches, each independently atomic', () => {
    const targets = Array.from({ length: 2500 }, (_, i) => testCellRef(i));
    const result = buildBulkOperations({ ...baseCtx(), kind: 'CLEAR', targets });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totalCells).toBe(2500);
    expect(result.batches).toHaveLength(3);
    expect(result.batches.map((b) => (b.operations[0]!.type === 'clear' ? b.operations[0]!.target.length : -1))).toEqual([1000, 1000, 500]);
  });

  it('rejects an empty target set', () => {
    const result = buildBulkOperations({ ...baseCtx(), kind: 'CLEAR', targets: [] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('EMPTY_INPUT');
  });

  it('rejects a SET value that violates financeValueSemantics', () => {
    const result = buildBulkOperations({
      ...baseCtx(),
      kind: 'SET',
      targets: [testCellRef(0)],
      value: { ...presentValue('0'), status: 'PRESENT_NONZERO' }, // PRESENT_NONZERO requires non-zero
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION_FAILED');
  });

  it('denies mutation when businessVersionStatus is ARCHIVED', () => {
    const result = buildBulkOperations({ ...baseCtx(), businessVersionStatus: 'ARCHIVED', kind: 'CLEAR', targets: [testCellRef(0)] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('CAPABILITY_DENIED');
  });
});
