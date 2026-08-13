/**
 * AP-01 — performance proxy tests at the master plan's stated scale (10k x
 * 120 logical cells, section 10: ">=45 FPS, input p95<100 ms, 1000-cell
 * paste jako jedna transakcja").
 *
 * These are NOT DOM/frame-rate benchmarks — there is no React component in
 * this work package (see the ADR's explicit UI-out-of-scope note). They
 * measure the one thing this package's pure functions actually own: how
 * long it takes to go from "user selected/pasted/filled N cells" to a
 * ready-to-submit `Operation.batch` (or, for selection, to fully drain a
 * large selection's coordinate iterator). That is the CPU-bound share of the
 * budget a future React grid would spend before even touching the DOM /
 * network — see the ADR section 5 for how these numbers are meant to be
 * read against the product's 45 FPS / 100 ms targets (they are a lower
 * bound / sanity check, not proof of the full budget).
 *
 * Grid shape: 10,000 rows (100 entities x 100 canonical lines) x 120 columns
 * (120 monthly periods) = 1,200,000 logical cells. Populated data is a
 * SPARSE `Map<canonical-cell-key, FinanceValue>` holding ~50,000 entries
 * (~4% density) — never a 10000x120 array of cell objects — because a dense
 * array of that size (1.2M objects, each with 9 FinanceValue fields) is
 * exactly the "correctness AND performance bug" `WorkspaceState.ts`'s own
 * file header warns against for this same scale.
 */

import { describe, expect, it } from 'vitest';

import { GridSelectionModel } from '../../../server/src/services/finance/grid/GridSelectionModel.ts';
import { buildPasteOperations, type PasteSourceCell } from '../../../server/src/services/finance/grid/PasteEngine.ts';
import { buildFillOperations, type FillSourceCell } from '../../../server/src/services/finance/grid/FillEngine.ts';
import { buildBulkOperations } from '../../../server/src/services/finance/grid/BulkOpsEngine.ts';
import { cellRefKey } from '../../../server/src/types/finance/CellRef.ts';
import type { CellRef, FinanceAccumulationBasis } from '../../../server/src/types/finance/CellRef.ts';
import type { GridAddressResolver, GridCoordinate } from '../../../server/src/services/finance/grid/gridCoordinates.ts';
import type { FinanceValue } from '../../../server/src/types/finance/financeValueSemantics.ts';
import type { FinanceValueInput } from '../../../server/src/types/finance/Operation.ts';

// ---------------------------------------------------------------------------
// Sparse 10k x 120 grid simulation — TEST-ONLY harness. Production storage
// (which array-of-structs or column-store the real grid uses in the browser)
// is an AP-01 React-layer decision this core-logic package does not make;
// this Map is just enough to exercise the engines at realistic scale.
// ---------------------------------------------------------------------------

const ROW_COUNT = 10_000; // 100 entities x 100 canonical lines
const COL_COUNT = 120; // 120 monthly periods
const ENTITIES_PER_ROW_BLOCK = 100;

const ENTITY_PREFIX_LEN = 'entity-'.length;
const LINE_PREFIX_LEN = 'line-'.length;
const PERIOD_PREFIX_LEN = 'period-'.length;

function cellRefAt(coord: GridCoordinate): CellRef {
  const entityIndex = Math.floor(coord.row / ENTITIES_PER_ROW_BLOCK);
  const lineIndex = coord.row % ENTITIES_PER_ROW_BLOCK;
  const basis: FinanceAccumulationBasis = 'QUARTER_ONLY';
  return {
    organizationId: 'org-perf',
    businessVersionId: 'bv-perf',
    tableName: 'finance_stmt_lines',
    rowKey: {
      tableName: 'finance_stmt_lines',
      entityId: `entity-${entityIndex}`,
      canonicalLineId: `line-${lineIndex}`,
      consolidationScope: 'STANDALONE',
    },
    columnKey: { tableName: 'finance_stmt_lines', periodId: `period-${coord.col}`, accumulationBasis: basis },
    period: { periodId: `period-${coord.col}`, accumulationBasis: basis },
  };
}

function coordinateOf(ref: CellRef): GridCoordinate | null {
  if (ref.rowKey.tableName !== 'finance_stmt_lines' || ref.columnKey.tableName !== 'finance_stmt_lines') return null;
  const entityIndex = Number(ref.rowKey.entityId.slice(ENTITY_PREFIX_LEN));
  const lineIndex = Number(ref.rowKey.canonicalLineId.slice(LINE_PREFIX_LEN));
  const col = Number(ref.columnKey.periodId.slice(PERIOD_PREFIX_LEN));
  if (!Number.isFinite(entityIndex) || !Number.isFinite(lineIndex) || !Number.isFinite(col)) return null;
  const row = entityIndex * ENTITIES_PER_ROW_BLOCK + lineIndex;
  if (row >= ROW_COUNT || col >= COL_COUNT) return null;
  return { row, col };
}

const perfResolver: GridAddressResolver = { rowCount: ROW_COUNT, colCount: COL_COUNT, cellRefAt, coordinateOf };

/** Deterministic LCG (no `Math.random`) so the sparse population and any sampled coordinates are stable across CI runs. */
function makeLcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function buildSparseStore(density: number, seed = 42): Map<string, FinanceValue> {
  const rand = makeLcg(seed);
  const store = new Map<string, FinanceValue>();
  const targetCount = Math.floor(ROW_COUNT * COL_COUNT * density);
  for (let i = 0; i < targetCount; i++) {
    const row = Math.floor(rand() * ROW_COUNT);
    const col = Math.floor(rand() * COL_COUNT);
    const ref = cellRefAt({ row, col });
    const decimal = Math.floor(rand() * 1_000_000);
    store.set(cellRefKey(ref), {
      status: 'PRESENT_NONZERO',
      valueDecimal: String(decimal),
      nativeCurrency: 'USD',
      presentationCurrency: 'USD',
      unit: 'THOUSANDS',
      multiplier: '1',
      sourceRef: null,
      isAdjustment: false,
      adjustmentReason: null,
    });
  }
  return store;
}

function presentValue(decimal: string): FinanceValueInput {
  return {
    status: decimal === '0' ? 'PRESENT_ZERO' : 'PRESENT_NONZERO',
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

function baseCtx() {
  let n = 0;
  return {
    organizationId: 'org-perf',
    artifactId: 'artifact-perf',
    businessVersionId: 'bv-perf',
    expectedWorkingRevisionId: 'wr-perf',
    sourceWorkingRevisionId: 'wr-perf',
    actorId: 'user-perf',
    actorRole: 'preparer' as const,
    now: () => '2026-08-09T00:00:00.000Z',
    generateId: () => `id-${n++}`,
  };
}

describe('AP-01 Finance Data Grid — 10k x 120 performance proxy', () => {
  it('builds a sparse ~50k-cell store over a 1.2M logical-cell grid without materializing the full grid', () => {
    const t0 = performance.now();
    const store = buildSparseStore(0.04);
    const elapsedMs = performance.now() - t0;
    expect(store.size).toBeGreaterThan(30_000);
    expect(store.size).toBeLessThan(ROW_COUNT * COL_COUNT); // proves it is sparse, not dense
    // eslint-disable-next-line no-console
    console.log(`[perf] sparse store build: ${store.size} entries in ${elapsedMs.toFixed(2)} ms`);
    expect(elapsedMs).toBeLessThan(2000);
  });

  it('selects the ENTIRE 1.2M-cell grid and drains iterateCells within budget', () => {
    const model = new GridSelectionModel();
    const t0 = performance.now();
    model.addRange({ top: 0, left: 0, bottom: ROW_COUNT - 1, right: COL_COUNT - 1 });
    const addElapsedMs = performance.now() - t0;
    expect(model.selectedCellCount()).toBe(ROW_COUNT * COL_COUNT);
    expect(addElapsedMs).toBeLessThan(10); // single-rect add is O(1) regardless of cell count

    const t1 = performance.now();
    let count = 0;
    for (const _coord of model.iterateCells()) count++;
    const iterateElapsedMs = performance.now() - t1;
    expect(count).toBe(ROW_COUNT * COL_COUNT);
    // eslint-disable-next-line no-console
    console.log(`[perf] full-grid selection add: ${addElapsedMs.toFixed(2)} ms, drain 1.2M coords: ${iterateElapsedMs.toFixed(2)} ms`);
    expect(iterateElapsedMs).toBeLessThan(1000);
  });

  it('performs 500 add/subtract/toggle selection mutations against a scattered pattern within budget', () => {
    const model = new GridSelectionModel();
    const rand = makeLcg(7);
    const t0 = performance.now();
    for (let i = 0; i < 500; i++) {
      const top = Math.floor(rand() * (ROW_COUNT - 20));
      const left = Math.floor(rand() * (COL_COUNT - 5));
      const rect = { top, left, bottom: top + 10, right: left + 3 };
      if (i % 3 === 0) model.subtractRange(rect);
      else if (i % 3 === 1) model.toggleRange(rect);
      else model.addRange(rect);
    }
    const elapsedMs = performance.now() - t0;
    // eslint-disable-next-line no-console
    console.log(`[perf] 500 mixed selection mutations (ends with ${model.ranges.length} disjoint ranges): ${elapsedMs.toFixed(2)} ms`);
    expect(elapsedMs).toBeLessThan(500);
  });

  it('builds a 1000-cell paste batch (the master plan benchmark size) within budget', () => {
    const width = 40;
    const height = 25; // exactly 1000 cells
    const source: PasteSourceCell[][] = Array.from({ length: height }, (_, r) =>
      Array.from({ length: width }, (_, c) => ({ value: presentValue(String(r * width + c)) }))
    );
    const t0 = performance.now();
    const result = buildPasteOperations({ ...baseCtx(), mode: 'ALL', anchor: { row: 0, col: 0 }, source, resolver: perfResolver });
    const elapsedMs = performance.now() - t0;
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totalCells).toBe(1000);
    expect(result.batches).toHaveLength(1); // exactly at the cap -> still one atomic batch
    // eslint-disable-next-line no-console
    console.log(`[perf] 1000-cell paste batch build: ${elapsedMs.toFixed(2)} ms`);
    expect(elapsedMs).toBeLessThan(100);
  });

  it('builds a 10,000-cell fill-down series across the full row extent within budget', () => {
    const source: FillSourceCell[][] = [[{ value: presentValue('100') }], [{ value: presentValue('110') }]];
    const t0 = performance.now();
    const result = buildFillOperations({
      ...baseCtx(),
      direction: 'DOWN',
      source,
      sourceRect: { top: 0, left: 0, bottom: 1, right: 0 },
      targetRect: { top: 2, left: 0, bottom: ROW_COUNT - 1, right: 0 }, // 9998 target cells
      resolver: perfResolver,
    });
    const elapsedMs = performance.now() - t0;
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.strategy).toBe('NUMERIC_SERIES');
    expect(result.totalCells).toBe(ROW_COUNT - 2);
    expect(result.batches.length).toBe(Math.ceil((ROW_COUNT - 2) / 1000));
    // eslint-disable-next-line no-console
    console.log(`[perf] ${result.totalCells}-cell fill-down series build (${result.batches.length} batches): ${elapsedMs.toFixed(2)} ms`);
    expect(elapsedMs).toBeLessThan(300);
  });

  it('builds a bulk clear across a full column (10,000 cells) within budget', () => {
    const model = new GridSelectionModel();
    model.addRange({ top: 0, left: 0, bottom: ROW_COUNT - 1, right: 0 });
    const t0 = performance.now();
    const targets: CellRef[] = [...model.iterateCells()].map((coord) => perfResolver.cellRefAt(coord));
    const result = buildBulkOperations({ ...baseCtx(), kind: 'CLEAR', targets });
    const elapsedMs = performance.now() - t0;
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totalCells).toBe(ROW_COUNT);
    expect(result.batches.length).toBe(Math.ceil(ROW_COUNT / 1000));
    // eslint-disable-next-line no-console
    console.log(`[perf] ${ROW_COUNT}-cell bulk clear build (${result.batches.length} batches): ${elapsedMs.toFixed(2)} ms`);
    expect(elapsedMs).toBeLessThan(300);
  });

  it('reads 2,000 random cells from the sparse store via cellRefKey lookups within budget (proxy for scroll-driven viewport reads)', () => {
    const store = buildSparseStore(0.04);
    const rand = makeLcg(99);
    const coords: GridCoordinate[] = Array.from({ length: 2000 }, () => ({
      row: Math.floor(rand() * ROW_COUNT),
      col: Math.floor(rand() * COL_COUNT),
    }));
    const t0 = performance.now();
    let hits = 0;
    for (const coord of coords) {
      const ref = perfResolver.cellRefAt(coord);
      if (store.get(cellRefKey(ref))) hits++;
    }
    const elapsedMs = performance.now() - t0;
    // eslint-disable-next-line no-console
    console.log(`[perf] 2000 random cell lookups (${hits} hits): ${elapsedMs.toFixed(2)} ms`);
    expect(elapsedMs).toBeLessThan(50);
  });
});
