/**
 * @vitest-environment jsdom
 *
 * Performance measurement — useRollupComputation / computeRollupValue
 * (src/components/MyWork/table/useRollupComputation.ts).
 *
 * Context (docs/qa/ideas-complete-transformation-2026-08-09/17_PERFORMANCE_MEASUREMENT.md):
 * a prior audit flagged "Table tool: no virtualization" as the only Table-tool
 * risk. Reading useRollupComputation.ts showed a sharper problem: when a
 * table has at least one `rollup` column, computeRollupValue() is called once
 * PER ROW, and for every call it (a) walks the FULL edges array with a plain
 * for-loop to find related edges, then (b) calls `allNodes.filter(...)` over
 * the FULL node array to materialize the related nodes. That is
 * O(rows * (edges + allNodes)) — quadratic-shaped growth as the table grows,
 * entirely independent of DOM virtualization. This file measures that cost
 * directly (no React, no DOM) to get real numbers instead of guessing.
 *
 * Methodology: for each N, build N nodes and ~2N edges (each node linked to
 * its two neighbours, so avg relatedNodes per row stays small and realistic
 * — this is NOT a worst-case adversarial graph, just a plausible "chain of
 * related records" shape). Run useRollupComputation's core loop (one 'sum'
 * rollup column) REPS times, discard nothing (no warmup exclusion beyond
 * reporting rep 0 separately), report mean/min/max across REPS repetitions.
 */
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import {
  computeRollupValue,
  useRollupComputation,
} from '../../src/components/MyWork/table/useRollupComputation';
import type { ColumnDef, TableEdge, TableNode } from '../../src/components/MyWork/table/tableTypes';

function buildNodes(n: number): TableNode[] {
  const nodes: TableNode[] = [];
  for (let i = 0; i < n; i++) {
    nodes.push({
      id: `n${i}`,
      type: 'idea',
      position: { x: 0, y: 0 },
      data: { label: `Row ${i}`, score: (i % 100) + 1 },
    } as TableNode);
  }
  return nodes;
}

// Chain topology: node i links to i-1 and i+1 (like a dependency/sequence
// column a real user would build) → ~2 edges per node, ~2N edges total.
function buildEdges(n: number): TableEdge[] {
  const edges: TableEdge[] = [];
  for (let i = 0; i < n - 1; i++) {
    edges.push({ id: `e${i}`, source: `n${i}`, target: `n${i + 1}` } as TableEdge);
  }
  return edges;
}

const rollupCol: ColumnDef = {
  key: 'rollupScore',
  header: 'Rollup score',
  type: 'rollup',
  rollupSource: 'score',
  rollupFunction: 'sum',
} as ColumnDef;

function runFullRollupPass(nodes: TableNode[], edges: TableEdge[]): number {
  // Mirrors useRollupComputation's rows.map(...) loop for a single rollup column.
  let sum = 0;
  for (const row of nodes) {
    sum += computeRollupValue(row, rollupCol, nodes, edges);
  }
  return sum;
}

const SIZES = [100, 1000, 5000, 10000];
const REPS = 5;

describe('perf: useRollupComputation full pass (O(rows * (edges + allNodes)))', () => {
  const results: Array<{
    n: number;
    reps: number;
    meanMs: number;
    minMs: number;
    maxMs: number;
    allMs: number[];
  }> = [];

  for (const n of SIZES) {
    it(`N=${n}: measures ${REPS} repetitions of one full rollup pass`, () => {
      const nodes = buildNodes(n);
      const edges = buildEdges(n);

      const timings: number[] = [];
      for (let r = 0; r < REPS; r++) {
        const t0 = performance.now();
        const sum = runFullRollupPass(nodes, edges);
        const t1 = performance.now();
        timings.push(t1 - t0);
        expect(sum).toBeGreaterThan(0); // sanity: rollup actually computed something
      }
      const meanMs = timings.reduce((a, b) => a + b, 0) / timings.length;
      const minMs = Math.min(...timings);
      const maxMs = Math.max(...timings);
      results.push({ n, reps: REPS, meanMs, minMs, maxMs, allMs: timings });

      // eslint-disable-next-line no-console
      console.log(
        `[rollup-bench] N=${n} reps=${REPS} mean=${meanMs.toFixed(2)}ms ` +
          `min=${minMs.toFixed(2)}ms max=${maxMs.toFixed(2)}ms all=[${timings.map((t) => t.toFixed(2)).join(', ')}]`
      );
    });
  }

  it('prints the final N vs ms table', () => {
    // eslint-disable-next-line no-console
    console.log('\n[rollup-bench] SUMMARY TABLE (legacy computeRollupValue, unchanged)');
    // eslint-disable-next-line no-console
    console.log('N\tmean_ms\tmin_ms\tmax_ms');
    for (const r of results) {
      // eslint-disable-next-line no-console
      console.log(`${r.n}\t${r.meanMs.toFixed(2)}\t${r.minMs.toFixed(2)}\t${r.maxMs.toFixed(2)}`);
    }
    expect(results.length).toBeGreaterThan(0);
  });
});

// ── Fix verification: useRollupComputation's fast path ─────────────────────
//
// The hook itself (the actual Table-tool hot path, invoked via
// IdeaTableTool.tsx line ~620) was rewired to build an adjacency map +
// node-by-id index ONCE per memoized pass instead of calling
// computeRollupValue per row (which re-scanned the full edges/allNodes
// arrays every time — the O(rows*(edges+allNodes)) cost measured above).
// This section (a) proves the fast path returns IDENTICAL numbers to the
// legacy per-row computeRollupValue path on a small dataset, then (b)
// benchmarks the fast path's real growth curve.
describe('perf: useRollupComputation fast-path correctness + speed', () => {
  it('produces identical rollup values to the legacy per-row computeRollupValue path (N=50)', () => {
    const n = 50;
    const nodes = buildNodes(n);
    const edges = buildEdges(n);

    const legacy = nodes.map((row) => computeRollupValue(row, rollupCol, nodes, edges));

    const { result } = renderHook(() => useRollupComputation(nodes, [rollupCol], nodes, edges));
    const fast = result.current.map((row) => (row.data as any).rollupScore);

    expect(fast).toEqual(legacy);
  });

  const fastResults: Array<{ n: number; meanMs: number; minMs: number; maxMs: number }> = [];

  for (const n of SIZES) {
    it(`N=${n}: fast-path hook, ${REPS} repetitions`, () => {
      const nodes = buildNodes(n);
      const edges = buildEdges(n);

      const timings: number[] = [];
      for (let r = 0; r < REPS; r++) {
        const t0 = performance.now();
        const { result, unmount } = renderHook(() =>
          useRollupComputation(nodes, [rollupCol], nodes, edges)
        );
        const t1 = performance.now();
        timings.push(t1 - t0);
        expect(result.current.length).toBe(n);
        unmount();
      }
      const meanMs = timings.reduce((a, b) => a + b, 0) / timings.length;
      const minMs = Math.min(...timings);
      const maxMs = Math.max(...timings);
      fastResults.push({ n, meanMs, minMs, maxMs });

      // eslint-disable-next-line no-console
      console.log(
        `[rollup-fast-bench] N=${n} reps=${REPS} mean=${meanMs.toFixed(2)}ms min=${minMs.toFixed(2)}ms ` +
          `max=${maxMs.toFixed(2)}ms all=[${timings.map((t) => t.toFixed(2)).join(', ')}]`
      );
    });
  }

  it('prints the final N vs ms table (fast path) and the speedup vs the legacy pass', () => {
    // eslint-disable-next-line no-console
    console.log('\n[rollup-fast-bench] SUMMARY TABLE (fixed useRollupComputation hook)');
    // eslint-disable-next-line no-console
    console.log('N\tmean_ms\tmin_ms\tmax_ms');
    for (const r of fastResults) {
      // eslint-disable-next-line no-console
      console.log(`${r.n}\t${r.meanMs.toFixed(2)}\t${r.minMs.toFixed(2)}\t${r.maxMs.toFixed(2)}`);
    }
    expect(fastResults.length).toBeGreaterThan(0);
  });
});
