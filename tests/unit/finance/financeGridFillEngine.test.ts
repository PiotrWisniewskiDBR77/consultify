import { describe, expect, it } from 'vitest';

import { buildFillOperations, type FillSourceCell } from '../../../server/src/services/finance/grid/FillEngine.ts';
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

describe('FillEngine.buildFillOperations', () => {
  it('detects a numeric arithmetic series along a DOWN fill and continues it (paste operation)', () => {
    const source: FillSourceCell[][] = [[{ value: presentValue('10') }], [{ value: presentValue('20') }]]; // step = 10
    const result = buildFillOperations({
      ...baseCtx(),
      direction: 'DOWN',
      source,
      sourceRect: { top: 0, left: 0, bottom: 1, right: 0 },
      targetRect: { top: 2, left: 0, bottom: 4, right: 0 },
      resolver: makeResolver(100, 10),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.strategy).toBe('NUMERIC_SERIES');
    const op = result.batches[0]!.operations[0]!;
    expect(op.type).toBe('paste');
    if (op.type === 'paste') {
      expect(op.values.map((v) => v.valueDecimal)).toEqual(['30', '40', '50']);
    }
  });

  it('falls back to a uniform copy (bulk_set) when the source is a single repeated value', () => {
    const source: FillSourceCell[][] = [[{ value: presentValue('7') }]];
    const result = buildFillOperations({
      ...baseCtx(),
      direction: 'RIGHT',
      source,
      sourceRect: { top: 0, left: 0, bottom: 0, right: 0 },
      targetRect: { top: 0, left: 1, bottom: 0, right: 4 },
      resolver: makeResolver(10, 100),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.strategy).toBe('TILE_UNIFORM');
    expect(result.totalCells).toBe(4);
    const op = result.batches[0]!.operations[0]!;
    expect(op.type).toBe('bulk_set');
    if (op.type === 'bulk_set') {
      expect(op.value.valueDecimal).toBe('7');
      expect(op.target).toHaveLength(4);
    }
  });

  it('tiles a non-series, multi-value pattern cyclically (paste operation)', () => {
    const source: FillSourceCell[][] = [[{ value: presentValue('1') }, { value: presentValue('2') }]];
    const result = buildFillOperations({
      ...baseCtx(),
      direction: 'DOWN',
      source,
      sourceRect: { top: 0, left: 0, bottom: 0, right: 1 },
      targetRect: { top: 1, left: 0, bottom: 3, right: 1 },
      resolver: makeResolver(100, 10),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.strategy).toBe('TILE_PATTERN');
    const op = result.batches[0]!.operations[0]!;
    expect(op.type).toBe('paste');
    if (op.type === 'paste') {
      // Target is 3 rows x 2 cols, row-major tiling of [1,2] repeats: 1,2,1,2,1,2
      expect(op.values.map((v) => v.valueDecimal)).toEqual(['1', '2', '1', '2', '1', '2']);
    }
  });

  it('rejects a target rect that is not adjacent/aligned to the source in the given direction', () => {
    const source: FillSourceCell[][] = [[{ value: presentValue('1') }]];
    const result = buildFillOperations({
      ...baseCtx(),
      direction: 'DOWN',
      source,
      sourceRect: { top: 0, left: 0, bottom: 0, right: 0 },
      targetRect: { top: 5, left: 0, bottom: 6, right: 0 }, // gap between source and target
      resolver: makeResolver(100, 10),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('SHAPE_MISMATCH');
  });

  it('splits a large uniform fill into multiple <=1000-cell batches', () => {
    const source: FillSourceCell[][] = [[{ value: presentValue('5') }]];
    const result = buildFillOperations({
      ...baseCtx(),
      direction: 'RIGHT',
      source,
      sourceRect: { top: 0, left: 0, bottom: 0, right: 0 },
      targetRect: { top: 0, left: 1, bottom: 0, right: 1500 }, // 1500 target cells
      resolver: makeResolver(10, 2000),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totalCells).toBe(1500);
    expect(result.batches).toHaveLength(2);
    const firstOp = result.batches[0]!.operations[0]!;
    expect(firstOp.type === 'bulk_set' && firstOp.target.length).toBe(1000);
  });
});
