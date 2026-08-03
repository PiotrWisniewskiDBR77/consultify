import { useCallback } from 'react';
import type { Edge, Node } from 'reactflow';

const H_GAP = 220;
const V_GAP = 70;
const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;
/** Prześwit między dolną krawędzią węzła a górną krawędzią następnego. */
const V_CLEARANCE = 12;

/**
 * Pionowy skok do następnego rodzeństwa.
 *
 * PRZED: stała `V_GAP = 70` liczona od GÓRNEJ krawędzi do górnej krawędzi,
 * niezależnie od tego, jak wysoki jest węzeł. Węzły mind mapy nie mają jednej
 * wysokości: świeżo dodany, pusty węzeł renderuje podpowiedź typu semantycznego
 * („Key insight / Open question / Action item / …") i mierzy ~120 px — czyli
 * prawie DWA razy więcej niż skok. Efekt: dwa dodania pod rząd i nowe węzły
 * zachodziły na siebie (zgłoszenie A5: „kilka węzłów zlepionych w jednym
 * miejscu"). Teraz skok respektuje ZMIERZONĄ wysokość węzła.
 *
 * `heights` bierze się z `node.height`, które ReactFlow zapisuje po zmierzeniu
 * węzła. Dla węzła jeszcze niezmierzonego (dosłownie ta jedna klatka, w której
 * powstaje) wracamy do dotychczasowego `V_GAP` — jego własna wysokość i tak
 * wpływa dopiero na POZYCJĘ NASTĘPNEGO rodzeństwa, a wtedy jest już zmierzony.
 */
function slotHeight(nodeId: string, heights: Map<string, number>): number {
  const h = heights.get(nodeId);
  if (!h || !Number.isFinite(h) || h <= 0) return V_GAP;
  return Math.max(V_GAP, h + V_CLEARANCE);
}

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
  visited: Set<string>,
  heights: Map<string, number>
): number {
  if (visited.has(nodeId)) return yStart;
  visited.add(nodeId);

  const children = adj.get(nodeId) || [];
  if (children.length === 0) {
    positions.set(nodeId, { x, y: yStart });
    return yStart + slotHeight(nodeId, heights);
  }

  const childX = x + H_GAP;
  let yNext = yStart;
  for (const childId of children) {
    yNext = layoutSubtree(childId, childX, yNext, adj, positions, visited, heights);
  }

  const firstChildY = positions.get(children[0])?.y ?? yStart;
  const lastChildY = positions.get(children[children.length - 1])?.y ?? yStart;
  const yMid = (firstChildY + lastChildY) / 2;
  positions.set(nodeId, { x, y: yMid });

  return yNext;
}

/**
 * Wysokość wyrenderowanego węzła, odczytana z DOM.
 *
 * Potrzebne, bo `node.height` (bookkeeping ReactFlow) NIE dociera do stanu
 * `nodes` dla świeżo dodanych węzłów — zmierzone: wszystkie węzły z hydracji
 * mają `height`, a każdy dodany przez „+Gałąź"/„+Sąsiad" ma `undefined`, nawet
 * kilkadziesiąt sekund po utworzeniu. A to właśnie te węzły są najwyższe
 * (pusty węzeł renderuje podpowiedź typu semantycznego, ~98 px zamiast 66) i to
 * one na siebie nachodziły.
 *
 * `offsetHeight` to wysokość w układzie CSS, czyli dokładnie ta sama przestrzeń,
 * w której liczymy layout — transformacja skalująca płótna siedzi na przodku
 * (`.react-flow__viewport`) i jej nie zmienia.
 */
function domNodeHeight(nodeId: string): number | undefined {
  if (typeof document === 'undefined') return undefined;
  try {
    const escaped = (window as any).CSS?.escape ? CSS.escape(nodeId) : nodeId;
    const el = document.querySelector(
      `.react-flow__node[data-id="${escaped}"]`
    ) as HTMLElement | null;
    const h = el?.offsetHeight;
    return typeof h === 'number' && h > 0 ? h : undefined;
  } catch {
    return undefined;
  }
}

/** Wysokości węzłów: najpierw stan ReactFlow, w razie braku pomiar z DOM. */
function measuredHeights(nodes: Node[]): Map<string, number> {
  const heights = new Map<string, number>();
  for (const n of nodes) {
    const stateHeight = (n as any).height;
    const h =
      typeof stateHeight === 'number' && Number.isFinite(stateHeight) && stateHeight > 0
        ? stateHeight
        : domNodeHeight(n.id);
    if (h) heights.set(n.id, h);
  }
  return heights;
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

    layoutSubtree(rootId, 0, 0, adj, positions, visited, measuredHeights(nodes));

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
        visited,
        measuredHeights(nodes)
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
