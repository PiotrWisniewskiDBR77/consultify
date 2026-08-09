import { describe, expect, it } from 'vitest';

import { buildPasteOperations, type PasteSourceCell } from '../../../server/src/services/finance/grid/PasteEngine.ts';
import type { CellRef } from '../../../server/src/types/finance/CellRef.ts';
import type { GridAddressResolver, GridCoordinate } from '../../../server/src/services/finance/grid/gridCoordinates.ts';
import type { FinanceValueInput } from '../../../server/src/types/finance/Operation.ts';

function cellRefAt(coord: GridCoordinate): CellRef {
  return {
    organizationId: 'org-1',
    businessVersionId: 'bv-1',
    tableName: 'finance_stmt_lines',
    rowKey: { tableName: 'finance_stmt_lines', entityId: `entity-${coord.row}`, canonicalLineId: 'REVENUE', consolidationScope: 'STANDALONE' },
    columnKey: { tableName: 'finance_stmt_lines', periodId: `period-${coord.col}`, accumulationBasis: 'QUARTER_ONLY' },
    period: { periodId: `period-${coord.col}`, accumulationBasis: 'QUARTER_ONLY' },
  };
}

function makeResolver(rowCount: number, colCount: number): GridAddressResolver {
  return { rowCount, colCount, cellRefAt, coordinateOf: () => null };
}

function presentValue(decimal: string): FinanceValueInput {
  return {
    status: decimal === '0' ? 'PRESENT_ZERO' : 'PRESENT_NONZERO',
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

describe('PasteEngine.buildPasteOperations', () => {
  it('builds a single paste Operation for a small rectangular block', () => {
    const source: PasteSourceCell[][] = [
      [{ value: presentValue('10') }, { value: presentValue('20') }],
      [{ value: presentValue('30') }, { value: presentValue('40') }],
    ];
    const result = buildPasteOperations({
      ...baseCtx(),
      mode: 'ALL',
      anchor: { row: 0, col: 0 },
      source,
      resolver: makeResolver(100, 100),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totalCells).toBe(4);
    expect(result.batches).toHaveLength(1);
    const op = result.batches[0]!.operations[0]!;
    expect(op.type).toBe('paste');
    if (op.type === 'paste') {
      expect(op.target).toHaveLength(4);
      expect(op.values).toHaveLength(4);
      expect(op.values.map((v) => v.valueDecimal)).toEqual(['10', '20', '30', '40']);
    }
  });

  it('splits a >1000-cell paste into multiple sequential, individually-atomic batches', () => {
    const width = 50;
    const height = 25; // 1250 cells total
    const source: PasteSourceCell[][] = Array.from({ length: height }, (_, r) =>
      Array.from({ length: width }, (_, c) => ({ value: presentValue(String(r * width + c)) }))
    );
    const result = buildPasteOperations({
      ...baseCtx(),
      mode: 'VALUES_ONLY',
      anchor: { row: 0, col: 0 },
      source,
      resolver: makeResolver(200, 200),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totalCells).toBe(1250);
    expect(result.batches).toHaveLength(2);
    expect(result.batches[0]!.operations[0]!.type === 'paste' && result.batches[0]!.operations[0]!.target.length).toBe(1000);
    expect(result.batches[1]!.operations[0]!.type === 'paste' && result.batches[1]!.operations[0]!.target.length).toBe(250);
    // Each batch has its own batchIdempotencyKey (sequential, independent atomicity).
    expect(result.batches[0]!.batchIdempotencyKey).not.toBe(result.batches[1]!.batchIdempotencyKey);
  });

  it('rejects FORMULAS_ONLY and FORMATS_ONLY with UNSUPPORTED_MODE rather than silently pasting values', () => {
    const source: PasteSourceCell[][] = [[{ value: presentValue('1') }]];
    for (const mode of ['FORMULAS_ONLY', 'FORMATS_ONLY'] as const) {
      const result = buildPasteOperations({ ...baseCtx(), mode, anchor: { row: 0, col: 0 }, source, resolver: makeResolver(10, 10) });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe('UNSUPPORTED_MODE');
    }
  });

  it('rejects a paste target that exceeds resolver bounds', () => {
    const source: PasteSourceCell[][] = [[{ value: presentValue('1') }, { value: presentValue('2') }]];
    const result = buildPasteOperations({ ...baseCtx(), mode: 'ALL', anchor: { row: 0, col: 9 }, source, resolver: makeResolver(10, 10) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('OUT_OF_BOUNDS');
  });

  it('rejects an empty source block', () => {
    const result = buildPasteOperations({ ...baseCtx(), mode: 'ALL', anchor: { row: 0, col: 0 }, source: [], resolver: makeResolver(10, 10) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('EMPTY_INPUT');
  });

  it('rejects a source cell that violates financeValueSemantics (PRESENT_NONZERO with null decimal)', () => {
    const badSource: PasteSourceCell[][] = [
      [{ value: { ...presentValue('1'), status: 'PRESENT_NONZERO', valueDecimal: null } }],
    ];
    const result = buildPasteOperations({ ...baseCtx(), mode: 'ALL', anchor: { row: 0, col: 0 }, source: badSource, resolver: makeResolver(10, 10) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION_FAILED');
    expect(result.issues && result.issues.length).toBeGreaterThan(0);
  });

  it('denies mutation when businessVersionStatus is not content-mutable', () => {
    const source: PasteSourceCell[][] = [[{ value: presentValue('1') }]];
    const result = buildPasteOperations({
      ...baseCtx(),
      businessVersionStatus: 'APPROVED',
      mode: 'ALL',
      anchor: { row: 0, col: 0 },
      source,
      resolver: makeResolver(10, 10),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('CAPABILITY_DENIED');
  });
});
