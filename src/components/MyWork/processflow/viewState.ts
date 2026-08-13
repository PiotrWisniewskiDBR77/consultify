/**
 * viewState — pure helpers for Process Flow canvas view-state persistence
 * (M07 F5b B1 — bug L-04).
 *
 * `extensions.processFlow.viewState` (layoutMode/showGrid/snap/zoom+pan) was
 * being WRITTEN on every save but never READ back at hydration — the user's
 * own grid/snap/viewport preferences were silently discarded on reload.
 *
 * Kept DOM/ReactFlow-free so normalization + fallback selection is
 * unit-testable without mounting a canvas (see
 * tests/unit/mywork/processFlowViewState.test.ts). The actual `setViewport`
 * call (which needs the live ReactFlow instance) stays in
 * IdeaProcessFlowTool.tsx.
 */

import { laneBandHeight } from './laneState';

/** Minimal node shape `computeLaneAwareFitBounds` needs — decoupled from the
 * `reactflow` `Node` type so this stays unit-testable without mounting a
 * canvas (same rationale as the rest of this file). */
export interface FitBoundsNode {
  position: { x: number; y: number };
  width?: number | null;
  height?: number | null;
}

/** Minimal lane shape — matches `Lane` from `./useProcessFlowNodes` structurally. */
export interface FitBoundsLane {
  collapsed?: boolean;
  height?: number;
}

export interface FitBoundsRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Fallback node size for nodes React Flow has not measured yet (width/height
 * undefined pre-first-render) — matches the shape default in FlowNodeComponent. */
const FALLBACK_NODE_WIDTH = 220;
const FALLBACK_NODE_HEIGHT = 64;
/** Fallback content width for an empty canvas (no nodes) so `fitBounds` still
 * has a sane rect to zoom to instead of a degenerate 0-width box. */
const EMPTY_CANVAS_WIDTH = 800;

/**
 * PF-P3-01: Process Flow's swimlanes are painted OUTSIDE the ReactFlow node
 * graph (see `LaneSystem.tsx`) as full-width bands stacked at flow-space Y
 * offsets from `laneBandLayout`. A plain `fitView()` only bounds actual
 * nodes, so an empty trailing lane (or a lane taller than the nodes it
 * contains) gets silently cropped out of the fitted view — "Fit view" would
 * lie about what "all lanes and nodes" means.
 *
 * This computes one rect that unions:
 *   - the horizontal (x) extent of the nodes (lanes have no real x-extent —
 *     they are `left-0 right-0` CSS bands, so they never need to widen the
 *     fit horizontally);
 *   - the vertical (y) extent of the FULL lane stack (top of the first lane
 *     to the bottom of the last, honouring collapse/resize) unioned with
 *     the nodes' own y-extent, in case a node has been dragged outside its
 *     lane's nominal band.
 *
 * Never returns a degenerate (zero-area) rect — an empty canvas still
 * produces a sane default width/height so `fitBounds` has something to zoom
 * to instead of NaN/Infinity.
 */
export function computeLaneAwareFitBounds(
  nodes: FitBoundsNode[],
  lanes: FitBoundsLane[],
  defaultLaneHeight: number
): FitBoundsRect {
  const laneStackHeight =
    lanes.length > 0
      ? lanes.reduce((sum, lane) => sum + laneBandHeight(lane, defaultLaneHeight), 0)
      : defaultLaneHeight;

  if (nodes.length === 0) {
    return { x: 0, y: 0, width: EMPTY_CANVAS_WIDTH, height: Math.max(laneStackHeight, 1) };
  }

  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const n of nodes) {
    const w = n.width ?? FALLBACK_NODE_WIDTH;
    const h = n.height ?? FALLBACK_NODE_HEIGHT;
    left = Math.min(left, n.position.x);
    right = Math.max(right, n.position.x + w);
    top = Math.min(top, n.position.y);
    bottom = Math.max(bottom, n.position.y + h);
  }

  const unionTop = Math.min(0, top);
  const unionBottom = Math.max(laneStackHeight, bottom);

  return {
    x: left,
    y: unionTop,
    width: Math.max(right - left, 1),
    height: Math.max(unionBottom - unionTop, 1),
  };
}

export interface ProcessFlowViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface ProcessFlowViewState {
  layoutMode: 'horizontal' | 'vertical';
  showGrid: boolean;
  snap: boolean;
  viewport?: ProcessFlowViewport;
}

export const DEFAULT_PROCESS_FLOW_VIEW_STATE: ProcessFlowViewState = {
  layoutMode: 'horizontal',
  showGrid: true,
  snap: true,
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Validates a raw viewport-shaped value coming from persisted JSON. */
export function isValidViewport(v: unknown): v is ProcessFlowViewport {
  if (!v || typeof v !== 'object') return false;
  const vp = v as Record<string, unknown>;
  return isFiniteNumber(vp.x) && isFiniteNumber(vp.y) && isFiniteNumber(vp.zoom) && vp.zoom > 0;
}

/**
 * Normalize a raw `extensions.processFlow.viewState` blob (possibly absent,
 * partial, or malformed — it comes from JSON the server round-tripped) into a
 * safe, fully-populated ProcessFlowViewState. Never throws.
 */
export function normalizeProcessFlowViewState(raw: unknown): ProcessFlowViewState {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PROCESS_FLOW_VIEW_STATE };
  const v = raw as Record<string, unknown>;
  const layoutMode: ProcessFlowViewState['layoutMode'] =
    v.layoutMode === 'vertical' ? 'vertical' : 'horizontal';
  const showGrid =
    typeof v.showGrid === 'boolean' ? v.showGrid : DEFAULT_PROCESS_FLOW_VIEW_STATE.showGrid;
  const snap = typeof v.snap === 'boolean' ? v.snap : DEFAULT_PROCESS_FLOW_VIEW_STATE.snap;
  const viewport = isValidViewport(v.viewport) ? v.viewport : undefined;
  return { layoutMode, showGrid, snap, ...(viewport ? { viewport } : {}) };
}

/** localStorage key for the last-known viewport per idea — mirrors Mind Map's
 * `mm-viewport-${ideaId}` fallback so a lost/blocked blob viewport degrades to
 * something better than a bare `fitView`. */
export function processFlowViewportStorageKey(ideaId: string): string {
  return `pf-viewport-${ideaId}`;
}

/**
 * Resolve which viewport to apply at hydration time: prefer the saved blob
 * viewport, fall back to a localStorage-cached one, else null (caller should
 * fitView instead).
 */
export function resolveHydrationViewport(
  blobViewport: unknown,
  localStorageRaw: string | null
): ProcessFlowViewport | null {
  if (isValidViewport(blobViewport)) return blobViewport;
  if (localStorageRaw) {
    try {
      const parsed = JSON.parse(localStorageRaw);
      if (isValidViewport(parsed)) return parsed;
    } catch {
      /* ignore malformed cache */
    }
  }
  return null;
}
