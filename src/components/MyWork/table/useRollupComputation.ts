/**
 * useRollupComputation — computes rollup aggregation values for rollup-type columns.
 *
 * For each row, finds related nodes via edges and aggregates the rollupSource
 * field using the rollupFunction specified on the column definition.
 *
 * Perf fix (docs/qa/ideas-complete-transformation-2026-08-09/
 * 17_PERFORMANCE_MEASUREMENT.md): the hook used to call `computeRollupValue`
 * once per row, and that function re-scanned the FULL `edges` array with a
 * plain loop AND ran `allNodes.filter(...)` over the FULL node array on
 * every call — O(rows * (edges + allNodes)). Measured: N=1000 rows/edges
 * took ~300ms per pass, N=5000 took ~9s, growth far steeper than linear.
 * `useRollupComputation` now builds an adjacency map (O(edges)) and a
 * node-by-id index (O(allNodes)) ONCE per memoized pass, then does an O(1)
 * map lookup per row instead of two full-array scans — O(edges + allNodes +
 * rows * avgDegree). `computeRollupValue`'s exported signature/behavior is
 * unchanged (still does the naive O(edges + allNodes) scan per call) so any
 * other caller — none found in this repo at the time of this fix, but it is
 * a named export — keeps working identically; only the hook's own hot loop
 * was rewired to the fast path via the shared `aggregateRollup` helper.
 */
import { useMemo } from 'react';

import type { ColumnDef, TableEdge, TableNode } from './tableTypes';

function aggregateRollup(relatedNodes: TableNode[], col: ColumnDef): number {
  if (relatedNodes.length === 0) return 0;
  const field = col.rollupSource as string;

  switch (col.rollupFunction) {
    case 'count':
      return relatedNodes.length;
    case 'sum':
      return relatedNodes.reduce((acc, n) => acc + (Number(n.data?.[field]) || 0), 0);
    case 'avg': {
      const sum = relatedNodes.reduce((acc, n) => acc + (Number(n.data?.[field]) || 0), 0);
      return Math.round((sum / relatedNodes.length) * 100) / 100;
    }
    case 'min':
      return Math.min(...relatedNodes.map((n) => Number(n.data?.[field]) || 0));
    case 'max':
      return Math.max(...relatedNodes.map((n) => Number(n.data?.[field]) || 0));
    case 'percent_empty': {
      const empty = relatedNodes.filter((n) => !n.data?.[field]).length;
      return Math.round((empty / relatedNodes.length) * 10000) / 100;
    }
    case 'percent_not_empty': {
      const filled = relatedNodes.filter((n) => !!n.data?.[field]).length;
      return Math.round((filled / relatedNodes.length) * 10000) / 100;
    }
    default:
      return relatedNodes.length;
  }
}

/**
 * @deprecated internal fast path (`useRollupComputation`'s useMemo body) no
 * longer calls this — kept exported, unchanged, for API compatibility with
 * any external caller that wants a single-node/single-column computation
 * without building the table-wide indices below.
 */
function computeRollupValue(
  node: TableNode,
  col: ColumnDef,
  allNodes: TableNode[],
  edges: TableEdge[]
): number {
  if (!col.rollupSource) return 0;

  const relatedIds = new Set<string>();
  for (const e of edges) {
    if (e.source === node.id) relatedIds.add(e.target);
    if (e.target === node.id) relatedIds.add(e.source);
  }
  const relatedNodes = allNodes.filter((n) => relatedIds.has(n.id));
  return aggregateRollup(relatedNodes, col);
}

export function useRollupComputation(
  rows: TableNode[],
  columns: ColumnDef[],
  allNodes: TableNode[],
  edges: TableEdge[]
): TableNode[] {
  return useMemo(() => {
    const rollupCols = columns.filter(
      (c) => c.type === 'rollup' && c.rollupSource && c.rollupFunction
    );
    if (rollupCols.length === 0) return rows;

    // Built once per memoized pass — O(edges) — instead of re-scanning
    // `edges` from inside a per-row call (was O(rows * edges)).
    const adjacency = new Map<string, Set<string>>();
    for (const e of edges) {
      if (!adjacency.has(e.source)) adjacency.set(e.source, new Set());
      if (!adjacency.has(e.target)) adjacency.set(e.target, new Set());
      adjacency.get(e.source)!.add(e.target);
      adjacency.get(e.target)!.add(e.source);
    }
    // Built once — O(allNodes) — instead of `allNodes.filter(...)` from
    // inside a per-row call (was another O(allNodes) scan per row).
    const nodeById = new Map<string, TableNode>();
    for (const n of allNodes) nodeById.set(n.id, n);

    return rows.map((row) => {
      const relatedIds = adjacency.get(row.id);
      const relatedNodes: TableNode[] = [];
      if (relatedIds) {
        for (const id of relatedIds) {
          const n = nodeById.get(id);
          if (n) relatedNodes.push(n);
        }
      }
      const rollupData: Record<string, number> = {};
      for (const col of rollupCols) {
        rollupData[col.key] = aggregateRollup(relatedNodes, col);
      }
      return {
        ...row,
        data: { ...row.data, ...rollupData },
      };
    });
  }, [rows, columns, allNodes, edges]);
}

export { computeRollupValue };
