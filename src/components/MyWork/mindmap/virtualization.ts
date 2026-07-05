/**
 * virtualization.ts — M06 Fala 3.3 pure helpers for large-map viewport culling.
 *
 * Strategy: we do NOT strip nodes from the graph model (that would break the
 * minimap, multi-select styling of off-screen nodes, SmartGuidesOverlay peers
 * which read `nodeInternals` from the store, and edge endpoints). Instead we
 * toggle ReactFlow's built-in `onlyRenderVisibleElements`, which keeps every
 * node in the store but only mounts DOM for nodes intersecting the viewport.
 *
 * These helpers are pure so the decision logic is unit-testable without a DOM.
 */

/**
 * Node count at or above which viewport culling is worth its per-move cost.
 * Below this, every node fits comfortably in the DOM and culling only adds
 * intersection-test overhead — so small/medium maps stay byte-identical to OFF.
 */
export const VIRTUALIZATION_NODE_THRESHOLD = 300;

/**
 * Decide whether ReactFlow should only render viewport-visible elements.
 *
 * @param flagEnabled  the `mindmapVirtualization` feature flag
 * @param nodeCount    total nodes currently in the graph
 * @param threshold    node count to cross before culling engages
 * @returns            true → pass onlyRenderVisibleElements to <ReactFlow>
 */
export function shouldVirtualize(
  flagEnabled: boolean,
  nodeCount: number,
  threshold: number = VIRTUALIZATION_NODE_THRESHOLD
): boolean {
  if (!flagEnabled) return false;
  return nodeCount >= threshold;
}

/**
 * Axis-aligned box for a node (flow coordinates). Mirrors alignDistribute's
 * box model so callers can reuse measured dimensions.
 */
export interface NodeBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Viewport rectangle in flow coordinates. */
export interface FlowViewport {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Reference culling predicate used to validate ReactFlow's built-in behavior in
 * tests (and available as a fallback if a custom culler is ever needed): a node
 * is "renderable" if its box intersects the viewport expanded by `margin`, OR if
 * it must stay mounted regardless of position (selected / editing / locked).
 *
 * Keeping selected/editing/locked nodes always-mounted guarantees that
 * multi-select styling, inline editing and lock overlays never blink out when a
 * node is scrolled off-screen — matching the "logical selection survives" rule.
 */
export function isNodeRenderable(
  box: NodeBox,
  viewport: FlowViewport,
  opts: {
    margin?: number;
    keepMountedIds?: ReadonlySet<string>;
  } = {}
): boolean {
  const { margin = 0, keepMountedIds } = opts;
  if (keepMountedIds?.has(box.id)) return true;
  const left = box.x - margin;
  const top = box.y - margin;
  const right = box.x + box.width + margin;
  const bottom = box.y + box.height + margin;
  // AABB intersection test.
  return !(
    right < viewport.minX ||
    left > viewport.maxX ||
    bottom < viewport.minY ||
    top > viewport.maxY
  );
}
