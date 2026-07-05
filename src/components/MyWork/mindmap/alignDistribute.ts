/**
 * alignDistribute — pure geometry for the M06 Fala 3.1 align/distribute tools.
 *
 * Given a set of ReactFlow-style nodes and a mode, computes the new absolute
 * position for each moved node. It never mutates the input, never touches node
 * data, and returns only the *changed* positions (a patch), so callers can feed
 * them straight into `setNodes` / a realtime broadcast without re-laying-out the
 * whole map.
 *
 * Bounds model: a node's box is `[x, x + width] × [y, y + height]`, matching
 * ReactFlow's `position` (top-left) + measured `width`/`height`. When a node has
 * not been measured yet we fall back to a nominal 160×48 box (same default the
 * canvas uses for anchor math elsewhere) so alignment stays stable pre-measure.
 *
 * Guards mirror the spec: alignment needs ≥2 nodes, distribution needs ≥3.
 */

export type AlignMode =
  | 'align-left'
  | 'align-center-h' // shared vertical center line (x)
  | 'align-right'
  | 'align-top'
  | 'align-middle-v' // shared horizontal center line (y)
  | 'align-bottom'
  | 'distribute-h' // equal horizontal gaps
  | 'distribute-v'; // equal vertical gaps

export interface AlignNode {
  id: string;
  position: { x: number; y: number };
  width?: number | null;
  height?: number | null;
  /** Optional — locked nodes are excluded from movement (never repositioned). */
  data?: { locked?: boolean } | Record<string, unknown> | null;
}

export interface PositionPatch {
  id: string;
  position: { x: number; y: number };
}

const DEFAULT_W = 160;
const DEFAULT_H = 48;

function boxOf(n: AlignNode) {
  const w = typeof n.width === 'number' && n.width > 0 ? n.width : DEFAULT_W;
  const h = typeof n.height === 'number' && n.height > 0 ? n.height : DEFAULT_H;
  return {
    id: n.id,
    x: n.position.x,
    y: n.position.y,
    w,
    h,
    left: n.position.x,
    right: n.position.x + w,
    top: n.position.y,
    bottom: n.position.y + h,
    cx: n.position.x + w / 2,
    cy: n.position.y + h / 2,
  };
}

function isLocked(n: AlignNode): boolean {
  return Boolean((n.data as { locked?: boolean } | null | undefined)?.locked);
}

/** True if this mode is a distribute (needs ≥3), else an align (needs ≥2). */
export function isDistributeMode(mode: AlignMode): boolean {
  return mode === 'distribute-h' || mode === 'distribute-v';
}

/**
 * Compute position patches for the given mode. Returns `[]` (a no-op) when the
 * selection is too small for the mode, when every candidate is locked, or when
 * no node actually moves (idempotent re-apply).
 */
export function computeAlignDistribute(nodes: AlignNode[], mode: AlignMode): PositionPatch[] {
  // Locked nodes act as neither movers nor reference — they are simply out.
  const movable = nodes.filter((n) => !isLocked(n));
  const minCount = isDistributeMode(mode) ? 3 : 2;
  if (movable.length < minCount) return [];

  const boxes = movable.map(boxOf);
  const patches: PositionPatch[] = [];
  const pushIfMoved = (id: string, x: number, y: number, curX: number, curY: number) => {
    // Round to avoid sub-pixel jitter churning realtime/persist diffs.
    const nx = Math.round(x);
    const ny = Math.round(y);
    if (nx === Math.round(curX) && ny === Math.round(curY)) return;
    patches.push({ id, position: { x: nx, y: ny } });
  };

  switch (mode) {
    case 'align-left': {
      const target = Math.min(...boxes.map((b) => b.left));
      for (const b of boxes) pushIfMoved(b.id, target, b.y, b.x, b.y);
      break;
    }
    case 'align-right': {
      const target = Math.max(...boxes.map((b) => b.right));
      for (const b of boxes) pushIfMoved(b.id, target - b.w, b.y, b.x, b.y);
      break;
    }
    case 'align-center-h': {
      // Shared vertical center line = mean of node centers (x).
      const target = boxes.reduce((s, b) => s + b.cx, 0) / boxes.length;
      for (const b of boxes) pushIfMoved(b.id, target - b.w / 2, b.y, b.x, b.y);
      break;
    }
    case 'align-top': {
      const target = Math.min(...boxes.map((b) => b.top));
      for (const b of boxes) pushIfMoved(b.id, b.x, target, b.x, b.y);
      break;
    }
    case 'align-bottom': {
      const target = Math.max(...boxes.map((b) => b.bottom));
      for (const b of boxes) pushIfMoved(b.id, b.x, target - b.h, b.x, b.y);
      break;
    }
    case 'align-middle-v': {
      // Shared horizontal center line = mean of node centers (y).
      const target = boxes.reduce((s, b) => s + b.cy, 0) / boxes.length;
      for (const b of boxes) pushIfMoved(b.id, b.x, target - b.h / 2, b.x, b.y);
      break;
    }
    case 'distribute-h': {
      // Keep the two extreme (leftmost/rightmost) nodes fixed; space the rest so
      // the gaps between successive boxes are equal.
      const sorted = [...boxes].sort((a, b) => a.left - b.left);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalW = sorted.reduce((s, b) => s + b.w, 0);
      const span = last.right - first.left;
      const gap = (span - totalW) / (sorted.length - 1);
      let cursor = first.left;
      for (const b of sorted) {
        pushIfMoved(b.id, cursor, b.y, b.x, b.y);
        cursor += b.w + gap;
      }
      break;
    }
    case 'distribute-v': {
      const sorted = [...boxes].sort((a, b) => a.top - b.top);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalH = sorted.reduce((s, b) => s + b.h, 0);
      const span = last.bottom - first.top;
      const gap = (span - totalH) / (sorted.length - 1);
      let cursor = first.top;
      for (const b of sorted) {
        pushIfMoved(b.id, b.x, cursor, b.x, b.y);
        cursor += b.h + gap;
      }
      break;
    }
    default:
      return [];
  }

  return patches;
}
