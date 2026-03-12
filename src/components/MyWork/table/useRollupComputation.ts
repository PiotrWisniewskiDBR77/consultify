/**
 * useRollupComputation — computes rollup aggregation values for rollup-type columns.
 *
 * For each row, finds related nodes via edges and aggregates the rollupSource
 * field using the rollupFunction specified on the column definition.
 */
import { useMemo } from 'react';

import type { ColumnDef, TableEdge, TableNode } from './tableTypes';

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

  if (relatedNodes.length === 0) return 0;

  const field = col.rollupSource;

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

    return rows.map((row) => {
      const rollupData: Record<string, number> = {};
      for (const col of rollupCols) {
        rollupData[col.key] = computeRollupValue(row, col, allNodes, edges);
      }
      return {
        ...row,
        data: { ...row.data, ...rollupData },
      };
    });
  }, [rows, columns, allNodes, edges]);
}

export { computeRollupValue };
