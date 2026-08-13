import { describe, expect, it } from 'vitest';

import {
  buildFindReplaceOperations,
  byDecimalInRange,
  byNoConfirmedValue,
  byStatus,
  findCells,
  type GridCellSnapshot,
} from '../../../server/src/services/finance/grid/FindReplaceEngine.ts';
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

function value(status: FinanceValueInput['status'], decimal: string | null): FinanceValueInput {
  return {
    status,
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

function snapshot(i: number, status: FinanceValueInput['status'], decimal: string | null): GridCellSnapshot {
  return { coordinate: { row: i, col: 0 }, ref: testCellRef(i), value: value(status, decimal) };
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

describe('FindReplaceEngine', () => {
  const cells: GridCellSnapshot[] = [
    snapshot(0, 'PRESENT_NONZERO', '100'),
    snapshot(1, 'PRESENT_NONZERO', '250'),
    snapshot(2, 'MISSING', null),
    snapshot(3, 'PRESENT_ZERO', '0'),
    snapshot(4, 'NA', null),
  ];

  it('findCells returns every cell matching a predicate', () => {
    const missingOrNa = findCells(cells, byNoConfirmedValue());
    expect(missingOrNa.map((c) => c.coordinate.row)).toEqual([2, 4]);
  });

  it('predicate builders compose with && for a range + status query', () => {
    const inRange = findCells(cells, (c) => byStatus('PRESENT_NONZERO')(c) && byDecimalInRange(200, 300)(c));
    expect(inRange.map((c) => c.coordinate.row)).toEqual([1]);
  });

  it('buildFindReplaceOperations with a shared replacement emits bulk_set', () => {
    const matches = findCells(cells, byNoConfirmedValue());
    const result = buildFindReplaceOperations({ ...baseCtx(), matches, replacement: value('PRESENT_ZERO', '0') });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const op = result.batches[0]!.operations[0]!;
    expect(op.type).toBe('bulk_set');
    if (op.type === 'bulk_set') expect(op.target).toHaveLength(2);
  });

  it('buildFindReplaceOperations with a per-cell function emits paste', () => {
    const matches = findCells(cells, byStatus('PRESENT_NONZERO'));
    const result = buildFindReplaceOperations({
      ...baseCtx(),
      matches,
      replacement: (cell) => value('PRESENT_NONZERO', String(Number(cell.value.valueDecimal) * 2)),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const op = result.batches[0]!.operations[0]!;
    expect(op.type).toBe('paste');
    if (op.type === 'paste') expect(op.values.map((v) => v.valueDecimal)).toEqual(['200', '500']);
  });

  it('rejects an empty match set', () => {
    const result = buildFindReplaceOperations({ ...baseCtx(), matches: [], replacement: value('MISSING', null) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('EMPTY_INPUT');
  });
});
