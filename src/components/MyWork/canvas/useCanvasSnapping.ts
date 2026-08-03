/**
 * useCanvasSnapping — Fala 3 (Z14) shared snapping for the IDEE ReactFlow
 * canvases (Whiteboard · Process Flow · Recommendation Map / Mind Map).
 *
 * Two independent concerns, kept decoupled on purpose:
 *
 *  1. SNAP (this hook) — magnetic position correction while a node is dragged.
 *     Snaps the dragged node to (a) a neighbour's left/centre/right edge on X
 *     or top/middle/bottom edge on Y when within `threshold` *screen* pixels,
 *     else (b) an 8px grid. Wired via `onNodeDrag` / `onNodeDragStop` so it
 *     never fights ReactFlow's own drag maths (v11 recomputes each frame from
 *     the drag-start offset, not from node.position — so overriding the applied
 *     position inside the same pointer-event tick is batched by React and never
 *     paints an un-snapped frame, and never drifts/accumulates).
 *
 *  2. GUIDES (CanvasSnapGuides) — the thin blue lines. Drawn by a separate
 *     store-reading overlay: once SNAP has aligned the dragged node, its edges
 *     sit exactly on the neighbour's, so the overlay detects the alignment and
 *     draws the line. No guide list is threaded through React state, so the
 *     graph never re-renders per drag frame (only the tiny overlay does).
 *
 * `computeSnap` is a pure function so it can be unit-tested without ReactFlow.
 * Persistence is untouched: positions still flow through the canvas's existing
 * onNodesChange → setNodes → save path.
 */
import { useCallback } from 'react';
import { type Node, useReactFlow } from 'reactflow';

/** Fallback box dimensions when a node hasn't been measured yet. */
const DEFAULT_W = 160;
const DEFAULT_H = 48;

export interface SnapGuideLine {
  /** 'v' = vertical line (aligned X), 'h' = horizontal line (aligned Y). */
  orientation: 'v' | 'h';
  /** Flow-coord of the line (x for vertical, y for horizontal). */
  pos: number;
  /** Flow-coord span [from, to] along the perpendicular axis. */
  from: number;
  to: number;
}

export interface SnapResult {
  /** Corrected flow position for the dragged node. */
  position: { x: number; y: number };
  /** Whether any correction (neighbour or grid) was applied. */
  snapped: boolean;
  /** Guide lines (flow coords) — for callers that want to draw them explicitly. */
  guides: SnapGuideLine[];
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
  cx: number;
  cy: number;
}

interface SnapNeighbor {
  position: { x: number; y: number };
  width?: number | null;
  height?: number | null;
}

interface SnapDragged extends SnapNeighbor {
  id?: string;
}

function toBox(n: SnapNeighbor): Box {
  const w = n.width && n.width > 0 ? n.width : DEFAULT_W;
  const h = n.height && n.height > 0 ? n.height : DEFAULT_H;
  const x = n.position.x;
  const y = n.position.y;
  return { left: x, right: x + w, top: y, bottom: y + h, cx: x + w / 2, cy: y + h / 2 };
}

export interface ComputeSnapOptions {
  /** Grid size in flow units (default 8). */
  grid?: number;
  /** Alignment tolerance in flow units (already zoom-corrected by the caller). */
  threshold?: number;
  /** Apply the grid fallback when no neighbour matches an axis (default true). */
  gridEnabled?: boolean;
}

/**
 * Pure snapping calculation. Given the dragged node and its neighbours (flow
 * coords), returns the corrected position + the guide lines that correction
 * produced. Neighbour alignment wins over the grid; the grid is only a fallback
 * per-axis when no neighbour is within `threshold`.
 */
export function computeSnap(
  dragged: SnapDragged,
  neighbors: SnapNeighbor[],
  opts: ComputeSnapOptions = {}
): SnapResult {
  const grid = opts.grid ?? 8;
  const threshold = opts.threshold ?? 6;
  const gridEnabled = opts.gridEnabled ?? true;

  const d = toBox(dragged);
  const others = neighbors.map(toBox);

  // X axis: left / centre / right anchors.
  const xAnchors: (keyof Box)[] = ['left', 'cx', 'right'];
  const yAnchors: (keyof Box)[] = ['top', 'cy', 'bottom'];

  const guides: SnapGuideLine[] = [];

  // ── X ─────────────────────────────────────────────────────────────────────
  let bestX: { delta: number; abs: number; at: number; o: Box } | null = null;
  for (const da of xAnchors) {
    for (const o of others) {
      for (const oa of xAnchors) {
        const delta = (o[oa] as number) - (d[da] as number);
        const abs = Math.abs(delta);
        if (abs <= threshold && (!bestX || abs < bestX.abs)) {
          bestX = { delta, abs, at: o[oa] as number, o };
        }
      }
    }
  }

  // ── Y ─────────────────────────────────────────────────────────────────────
  let bestY: { delta: number; abs: number; at: number; o: Box } | null = null;
  for (const da of yAnchors) {
    for (const o of others) {
      for (const oa of yAnchors) {
        const delta = (o[oa] as number) - (d[da] as number);
        const abs = Math.abs(delta);
        if (abs <= threshold && (!bestY || abs < bestY.abs)) {
          bestY = { delta, abs, at: o[oa] as number, o };
        }
      }
    }
  }

  let x = dragged.position.x;
  let y = dragged.position.y;
  let snapped = false;

  if (bestX) {
    x += bestX.delta;
    snapped = true;
    const top = Math.min(d.top, bestX.o.top);
    const bottom = Math.max(d.bottom, bestX.o.bottom);
    guides.push({ orientation: 'v', pos: bestX.at, from: top, to: bottom });
  } else if (gridEnabled) {
    const gx = Math.round(x / grid) * grid;
    if (gx !== x) snapped = true;
    x = gx;
  }

  if (bestY) {
    y += bestY.delta;
    snapped = true;
    const left = Math.min(d.left, bestY.o.left);
    const right = Math.max(d.right, bestY.o.right);
    guides.push({ orientation: 'h', pos: bestY.at, from: left, to: right });
  } else if (gridEnabled) {
    const gy = Math.round(y / grid) * grid;
    if (gy !== y) snapped = true;
    y = gy;
  }

  return { position: { x, y }, snapped, guides };
}

export interface UseCanvasSnappingOptions {
  /** Grid size in flow units (default 8). */
  grid?: number;
  /** Alignment tolerance in *screen* pixels (default 6); divided by zoom. */
  threshold?: number;
  /** Master switch — when false the handlers no-op (default true). */
  enabled?: boolean;
  /**
   * Apply the grid fallback (default true). Set false on canvases that already
   * pass ReactFlow's native `snapToGrid` so the grid isn't applied twice.
   */
  gridEnabled?: boolean;
}

export interface UseCanvasSnappingResult {
  onNodeDrag: (event: unknown, node: Node) => void;
  onNodeDragStop: (event?: unknown, node?: Node) => void;
}

/** Minimal ReactFlow-instance surface the snap step needs. */
export interface SnapInstance {
  getNodes: () => Node[];
  setNodes: (updater: (nodes: Node[]) => Node[]) => void;
  getZoom?: () => number;
}

/**
 * Core snap step, shared by the context hook and the ref-based hook. Reads the
 * live nodes from `instance`, computes the correction for the dragged node and
 * writes only that node back. Returns true if a correction was applied.
 */
function applySnap(
  instance: SnapInstance | null | undefined,
  node: Node,
  opts: Required<Pick<UseCanvasSnappingOptions, 'grid' | 'threshold' | 'gridEnabled'>>
): boolean {
  if (!instance || !node) return false;
  const nodes = instance.getNodes();
  // Multi-select drag: leave group moves to ReactFlow (snapping one member
  // would shear the selection). Only snap a single, un-grouped drag.
  const selectedCount = nodes.reduce((n, x) => (x.selected ? n + 1 : n), 0);
  if (selectedCount > 1 && node.selected) return false;

  const zoom = typeof instance.getZoom === 'function' ? instance.getZoom() : 1;
  const thresholdFlow = opts.threshold / (zoom || 1);

  const neighbors = nodes.filter((n) => n.id !== node.id && !n.hidden && !n.parentNode);
  if (neighbors.length === 0) return false;

  const { position, snapped } = computeSnap(
    { id: node.id, position: node.position, width: node.width, height: node.height },
    neighbors.map((n) => ({ position: n.position, width: n.width, height: n.height })),
    { grid: opts.grid, threshold: thresholdFlow, gridEnabled: opts.gridEnabled }
  );

  if (!snapped) return false;
  if (position.x === node.position.x && position.y === node.position.y) return false;

  instance.setNodes((nds) => nds.map((n) => (n.id === node.id ? { ...n, position } : n)));
  return true;
}

/**
 * Hook: returns `onNodeDrag` / `onNodeDragStop` handlers to spread onto a
 * <ReactFlow>. Compose with any existing handlers by calling both.
 *
 * Only runs work during a drag; reads live nodes from the ReactFlow store
 * (already the current viewport's graph) and corrects only the dragged node.
 */
export function useCanvasSnapping(opts: UseCanvasSnappingOptions = {}): UseCanvasSnappingResult {
  const { grid = 8, threshold = 6, enabled = true, gridEnabled = true } = opts;
  const rf = useReactFlow();

  const onNodeDrag = useCallback(
    (_event: unknown, node: Node) => {
      if (!enabled) return;
      applySnap(rf, node, { grid, threshold, gridEnabled });
    },
    [enabled, rf, grid, threshold, gridEnabled]
  );

  // Guides clear themselves (the store-reading overlay renders nothing once the
  // drag flag is off); nothing to tear down here, but the handler is exposed so
  // canvases can wire the full onNodeDrag/onNodeDragStop lifecycle uniformly.
  const onNodeDragStop = useCallback((_event?: unknown, _node?: Node) => {
    /* no-op: overlay is store-driven; positions persist via onNodesChange */
  }, []);

  return { onNodeDrag, onNodeDragStop };
}

/**
 * Ref-based variant for canvases that render <ReactFlow> in the *same*
 * component as <ReactFlowProvider> (so `useReactFlow` context isn't available at
 * that component's top level) but hold the instance from `onInit`. Pass a getter
 * returning the ReactFlow instance (or null before init).
 */
export function useCanvasSnappingRef(
  getInstance: () => SnapInstance | null | undefined,
  opts: UseCanvasSnappingOptions = {}
): UseCanvasSnappingResult {
  const { grid = 8, threshold = 6, enabled = true, gridEnabled = true } = opts;

  const onNodeDrag = useCallback(
    (_event: unknown, node: Node) => {
      if (!enabled) return;
      applySnap(getInstance(), node, { grid, threshold, gridEnabled });
    },
    [enabled, getInstance, grid, threshold, gridEnabled]
  );

  const onNodeDragStop = useCallback((_event?: unknown, _node?: Node) => {
    /* no-op: overlay is store-driven; positions persist via onNodesChange */
  }, []);

  return { onNodeDrag, onNodeDragStop };
}

export default useCanvasSnapping;
