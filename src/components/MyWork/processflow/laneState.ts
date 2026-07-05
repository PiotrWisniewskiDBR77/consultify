/**
 * laneState — pure helpers for swimlane collapse/resize (M07 F5a A3).
 *
 * Kept DOM-free and side-effect free so the collapse/resize transitions and the
 * vertical layout maths (band offsets / node visibility) are unit-testable
 * without React (see tests/unit/mywork/laneState.test.ts).
 *
 * State lives in `extensions.processFlow.lanes[].{collapsed,width,height}` and
 * persists through the existing graph blob — no persistence-layer change.
 */
import type { Lane } from './useProcessFlowNodes';

/** Height of a collapsed lane band (px) — just enough for the header row. */
export const COLLAPSED_LANE_HEIGHT = 28;

/** Resolve a lane's rendered band height, honouring collapse + user resize. */
export function laneBandHeight(lane: Pick<Lane, 'collapsed' | 'height'>, defaultHeight: number): number {
  if (lane.collapsed) return COLLAPSED_LANE_HEIGHT;
  const h = lane.height;
  return typeof h === 'number' && h > 0 ? h : defaultHeight;
}

/** Toggle (or explicitly set) a lane's collapsed flag, returning a new array. */
export function toggleLaneCollapsed(lanes: Lane[], laneId: string, next?: boolean): Lane[] {
  return lanes.map((l) =>
    l.id === laneId ? { ...l, collapsed: next ?? !l.collapsed } : l
  );
}

/** Set a lane's height, clamped to a sane minimum; returns a new array. */
export function setLaneHeight(lanes: Lane[], laneId: string, height: number, minHeight = 60): Lane[] {
  const clamped = Math.max(minHeight, Math.round(height));
  return lanes.map((l) => (l.id === laneId ? { ...l, height: clamped } : l));
}

/**
 * Cumulative Y offset (top) of each lane band given collapse/resize state.
 * Returns a map laneId → { top, height }. Order follows the `lanes` array.
 */
export function laneBandLayout(
  lanes: Lane[],
  defaultHeight: number
): Record<string, { top: number; height: number; index: number }> {
  const out: Record<string, { top: number; height: number; index: number }> = {};
  let top = 0;
  lanes.forEach((lane, index) => {
    const height = laneBandHeight(lane, defaultHeight);
    out[lane.id] = { top, height, index };
    top += height;
  });
  return out;
}

/**
 * Whether a node belongs to a currently-collapsed lane (so it should be hidden
 * from the canvas). Nodes with no laneId are always visible.
 */
export function isNodeInCollapsedLane(
  nodeLaneId: unknown,
  lanes: Lane[]
): boolean {
  if (typeof nodeLaneId !== 'string' || !nodeLaneId) return false;
  const lane = lanes.find((l) => l.id === nodeLaneId);
  return Boolean(lane?.collapsed);
}
