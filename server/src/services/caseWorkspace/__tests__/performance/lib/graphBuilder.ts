/**
 * CW-PERF — deterministic CanonicalGraph generator for the frozen
 * performance profile's "Plan with 250 nodes / 500 edges" fixture (document
 * 14 DoD-I).
 *
 * Shape: a single forward chain n0 -> n1 -> ... -> n{N-1} (N-1 edges) plus
 * extra strictly-forward "skip" edges (n[i] -> n[i+k]) until the requested
 * edge count is reached. Strictly forward => acyclic by construction (no
 * separate cycle check needed here) and every node stays reachable from the
 * single entry node, satisfying casePlanVersionService's
 * computeValidationBlockers() (UNREACHABLE_NODE / NO_TERMINAL_PATH /
 * DUPLICATE_*) without this file needing to reimplement that logic.
 */

import type { CanonicalGraph, GraphEdge, GraphNode } from '../../../casePlanVersionService.js';

export function buildLinearGraph(
  nodeCount: number,
  edgeCount: number,
  idPrefix: string
): CanonicalGraph {
  if (nodeCount < 2) throw new Error('buildLinearGraph requires at least 2 nodes');
  if (edgeCount < nodeCount - 1) {
    throw new Error(
      `buildLinearGraph: edgeCount (${edgeCount}) must be >= nodeCount-1 (${nodeCount - 1}) to keep the chain connected`
    );
  }

  const nodes: GraphNode[] = Array.from({ length: nodeCount }, (_, i) => ({
    nodeId: `${idPrefix}-n${i}`,
    type: i === 0 ? 'START' : i === nodeCount - 1 ? 'END' : 'TASK',
    effectClass: 'READ_ONLY',
    inputBindings: [],
    outputBindings: [],
    artifactBindings: [],
    tags: ['cwperf'],
    metadata: { seedIndex: i },
  }));

  const edges: GraphEdge[] = [];
  // Base chain: n[i] -> n[i+1], guarantees single-entry/single-terminal reachability.
  for (let i = 0; i < nodeCount - 1; i += 1) {
    edges.push({
      edgeId: `${idPrefix}-e${i}`,
      sourceNodeId: `${idPrefix}-n${i}`,
      targetNodeId: `${idPrefix}-n${i + 1}`,
      edgeType: 'SEQUENCE',
    });
  }

  // Extra strictly-forward "skip" edges to reach the requested edge count,
  // spread across increasing skip distances so they don't all bunch at the
  // start of the chain.
  let edgeIndex = edges.length;
  let skip = 2;
  outer: while (edgeIndex < edgeCount) {
    for (let i = 0; i + skip < nodeCount; i += 1) {
      if (edgeIndex >= edgeCount) break outer;
      edges.push({
        edgeId: `${idPrefix}-e${edgeIndex}`,
        sourceNodeId: `${idPrefix}-n${i}`,
        targetNodeId: `${idPrefix}-n${i + skip}`,
        edgeType: 'SEQUENCE',
      });
      edgeIndex += 1;
    }
    skip += 1;
    if (skip > nodeCount) {
      // Exhausted every strictly-forward pair at this node count — stop rather than loop forever.
      break;
    }
  }

  return {
    schemaVersion: '1',
    graphId: `${idPrefix}-graph`,
    entryNodeIds: [`${idPrefix}-n0`],
    terminalNodeIds: [`${idPrefix}-n${nodeCount - 1}`],
    nodes,
    edges,
    variables: [],
    limits: { maxNodes: nodeCount, maxEdges: edgeCount },
    metadata: { generator: 'cwperf-graphBuilder', requestedNodeCount: nodeCount, requestedEdgeCount: edgeCount },
  };
}
