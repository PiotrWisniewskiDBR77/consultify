import { useCallback } from 'react';
import type { Edge, Node } from 'reactflow';

const H_GAP = 220;
const V_GAP = 70;
const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;

/**
 * Recursive horizontal tree layout that handles N levels of depth.
 * Root is placed on the left; children fan out to the right.
 * Each parent is vertically centered among its children.
 *
 * Returns the next available Y position (yStart + total height consumed).
 */
function layoutSubtree(
  nodeId: string,
  x: number,
  yStart: number,
  adj: Map<string, string[]>,
  positions: Map<string, { x: number; y: number }>,
  visited: Set<string>
): number {
  if (visited.has(nodeId)) return yStart;
  visited.add(nodeId);

  const children = adj.get(nodeId) || [];
  if (children.length === 0) {
    positions.set(nodeId, { x, y: yStart });
    return yStart + V_GAP;
  }

  const childX = x + H_GAP;
  let yNext = yStart;
  for (const childId of children) {
    yNext = layoutSubtree(childId, childX, yNext, adj, positions, visited);
  }

  const firstChildY = positions.get(children[0])?.y ?? yStart;
  const lastChildY = positions.get(children[children.length - 1])?.y ?? yStart;
  const yMid = (firstChildY + lastChildY) / 2;
  positions.set(nodeId, { x, y: yMid });

  return yNext;
}

/**
 * Recursive N-level horizontal tree layout.
 * Backward-compatible: handles both free-form trees and legacy branch-* SWOT maps.
 */
export function useAutoLayout() {
  const autoLayout = useCallback((nodes: Node[], edges: Edge[]): Node[] => {
    if (nodes.length === 0) return nodes;

    const adj = new Map<string, string[]>();
    const hasParent = new Set<string>();

    for (const edge of edges) {
      const children = adj.get(edge.source) || [];
      children.push(edge.target);
      adj.set(edge.source, children);
      hasParent.add(edge.target);
    }

    const rootNode = nodes.find((n) => n.id === 'root');
    const rootId = rootNode ? 'root' : nodes.find((n) => !hasParent.has(n.id))?.id;

    if (!rootId) return nodes;

    const positions = new Map<string, { x: number; y: number }>();
    const visited = new Set<string>();

    layoutSubtree(rootId, 0, 0, adj, positions, visited);

    const orphans = nodes.filter((n) => !positions.has(n.id));
    const maxY =
      positions.size > 0
        ? Math.max(...Array.from(positions.values()).map((p) => p.y)) + V_GAP * 2
        : 0;

    orphans.forEach((orphan, idx) => {
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      positions.set(orphan.id, {
        x: col * (NODE_WIDTH + 20),
        y: maxY + row * (NODE_HEIGHT + 20),
      });
    });

    return nodes.map((n) => {
      const pos = positions.get(n.id);
      if (!pos) return n;
      return { ...n, position: { x: pos.x, y: pos.y } };
    });
  }, []);

  /**
   * Re-layout only the subtree rooted at `subtreeRootId`, leaving all other
   * node positions untouched. Useful after addChild/addSibling to avoid
   * disrupting manually positioned nodes elsewhere in the map.
   */
  const partialLayoutSubtree = useCallback(
    (nodes: Node[], edges: Edge[], subtreeRootId: string): Node[] => {
      if (nodes.length === 0) return nodes;

      const adj = new Map<string, string[]>();
      for (const edge of edges) {
        const children = adj.get(edge.source) || [];
        children.push(edge.target);
        adj.set(edge.source, children);
      }

      const subtreeRoot = nodes.find((n) => n.id === subtreeRootId);
      if (!subtreeRoot) return nodes;

      const positions = new Map<string, { x: number; y: number }>();
      const visited = new Set<string>();
      layoutSubtree(
        subtreeRootId,
        subtreeRoot.position.x,
        subtreeRoot.position.y,
        adj,
        positions,
        visited
      );

      return nodes.map((n) => {
        if (n.id === subtreeRootId) return n;
        const pos = positions.get(n.id);
        if (!pos) return n;
        return { ...n, position: { x: pos.x, y: pos.y } };
      });
    },
    []
  );

  return { autoLayout, partialLayoutSubtree };
}
