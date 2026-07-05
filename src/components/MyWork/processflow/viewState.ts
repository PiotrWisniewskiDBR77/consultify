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
  const layoutMode: ProcessFlowViewState['layoutMode'] = v.layoutMode === 'vertical' ? 'vertical' : 'horizontal';
  const showGrid = typeof v.showGrid === 'boolean' ? v.showGrid : DEFAULT_PROCESS_FLOW_VIEW_STATE.showGrid;
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
