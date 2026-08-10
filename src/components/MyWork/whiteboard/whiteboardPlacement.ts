/**
 * whiteboardPlacement — shared, pure placement service for new Whiteboard
 * objects (WB-P1-02).
 *
 * Problem it fixes: every insertion path (toolbar add, paste, drop, outline
 * import, AI proposal apply) picked its own coordinates independently — most
 * of them collapsed onto the same fixed spot (`{x:100,y:100}` or the pasted
 * viewport center), so successive inserts landed exactly on top of each
 * other. `resolveWhiteboardPlacement` is the single function all of those
 * paths now call (wired in `IdeaWhiteboardTool.createNode`) to pick a
 * deterministic, collision-free spot instead:
 *
 *  1. Cascade — try the anchor, then a diagonal step-out from it
 *     (`CASCADE_STEP` per attempt, snapped to the canvas grid) for
 *     `CASCADE_ATTEMPTS` tries. Cheap, and gives the classic "stair-step"
 *     placement for a handful of successive inserts.
 *  2. Nearest free slot — once the cascade budget is spent (the "collision
 *     threshold"), scan outward ring by ring on a coarser slot grid centered
 *     on the anchor until an unoccupied rect is found, rather than
 *     continuing to stack.
 *  3. Last resort — if the search radius is exhausted (pathologically dense
 *     board), return the final cascade candidate so the caller always gets a
 *     position; it may overlap, but placement never throws or loops forever.
 *
 * Every candidate is clamped to stay fully inside the supplied viewport
 * (when given) so the new object is never dropped off-screen. The function
 * is pure — no DOM/ReactFlow access — so it's fully unit-testable and never
 * touches or moves any rect the caller passes in `occupiedRects` (i.e. it
 * never repositions objects the user already placed; it only picks a slot
 * for the *new* one).
 */

export interface WhiteboardRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WhiteboardViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WhiteboardPlacementInput {
  /** Footprint of the object being placed (flow units). */
  size: { width: number; height: number };
  /**
   * Desired top-left position (flow coords) — same semantics as
   * `Node.position`. Pass the viewport center minus half the object size to
   * center a fresh insert on-screen, or a caller-chosen spot (drop point,
   * paste anchor, template coordinate, AI-proposal coordinate) to cascade
   * from there instead.
   */
  anchor: { x: number; y: number };
  /**
   * Rects already occupied on the canvas, flow coords. Callers building a
   * multi-item batch (paste, outline import, AI proposal apply) should push
   * each created sibling's rect in here as they go, so items within the same
   * batch never stack on each other either.
   */
  occupiedRects: WhiteboardRect[];
  /** Visible viewport in flow coords. Omit to skip the visibility clamp. */
  viewport?: WhiteboardViewportBounds;
  /** Snap grid in flow units (default 8 — matches `useCanvasSnapping`). */
  grid?: number;
}

const CASCADE_STEP = 32;
/** Collision threshold: after this many diagonal cascade tries, stop stacking and scan for a free slot instead. */
const CASCADE_ATTEMPTS = 10;
const SLOT_STEP = 48;
const SLOT_RING_MAX = 8;

function snap(value: number, grid: number): number {
  return grid > 0 ? Math.round(value / grid) * grid : value;
}

function rectsOverlap(a: WhiteboardRect, b: WhiteboardRect): boolean {
  return (
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
  );
}

function clampToViewport(
  rect: WhiteboardRect,
  viewport?: WhiteboardViewportBounds
): WhiteboardRect {
  if (!viewport) return rect;
  // If the object is bigger than the viewport on an axis, pin it to the
  // viewport origin on that axis rather than producing a negative range.
  const maxX = viewport.x + Math.max(viewport.width - rect.width, 0);
  const maxY = viewport.y + Math.max(viewport.height - rect.height, 0);
  const x = Math.min(Math.max(rect.x, viewport.x), maxX);
  const y = Math.min(Math.max(rect.y, viewport.y), maxY);
  return { ...rect, x, y };
}

function collidesWithAny(rect: WhiteboardRect, occupied: WhiteboardRect[]): boolean {
  return occupied.some((other) => rectsOverlap(rect, other));
}

function candidateAt(
  baseX: number,
  baseY: number,
  dx: number,
  dy: number,
  size: { width: number; height: number },
  grid: number,
  viewport?: WhiteboardViewportBounds
): WhiteboardRect {
  const rect: WhiteboardRect = {
    x: snap(baseX + dx, grid),
    y: snap(baseY + dy, grid),
    width: size.width,
    height: size.height,
  };
  return clampToViewport(rect, viewport);
}

/**
 * Ring offsets (flow units, relative to center) for a square spiral scan at
 * the given ring radius — perimeter cells of a `2*span x 2*span` square,
 * spaced `SLOT_STEP` apart. Deterministic order: top edge, bottom edge, then
 * left/right edges (excluding corners already covered).
 */
function ringOffsets(ring: number): Array<{ dx: number; dy: number }> {
  const span = ring * SLOT_STEP;
  const offsets: Array<{ dx: number; dy: number }> = [];
  for (let dx = -span; dx <= span; dx += SLOT_STEP) {
    offsets.push({ dx, dy: -span });
    offsets.push({ dx, dy: span });
  }
  for (let dy = -span + SLOT_STEP; dy <= span - SLOT_STEP; dy += SLOT_STEP) {
    offsets.push({ dx: -span, dy });
    offsets.push({ dx: span, dy });
  }
  return offsets;
}

/**
 * Resolve the top-left position for a new whiteboard object. Deterministic:
 * the same `size` + `anchor` + `occupiedRects` + `viewport` always produce
 * the same output, so it is fully unit-testable without ReactFlow.
 */
export function resolveWhiteboardPlacement(input: WhiteboardPlacementInput): {
  x: number;
  y: number;
} {
  const grid = input.grid ?? 8;
  const { size, anchor, occupiedRects, viewport } = input;
  const baseX = anchor.x;
  const baseY = anchor.y;

  // 1) Deterministic diagonal cascade from the anchor.
  for (let attempt = 0; attempt <= CASCADE_ATTEMPTS; attempt++) {
    const offset = attempt * CASCADE_STEP;
    const candidate = candidateAt(baseX, baseY, offset, offset, size, grid, viewport);
    if (!collidesWithAny(candidate, occupiedRects)) {
      return { x: candidate.x, y: candidate.y };
    }
  }

  // 2) Collision threshold exceeded — scan outward ring by ring for the
  //    nearest genuinely free slot instead of continuing to stack.
  const centerX = baseX + size.width / 2;
  const centerY = baseY + size.height / 2;
  for (let ring = 1; ring <= SLOT_RING_MAX; ring++) {
    for (const { dx, dy } of ringOffsets(ring)) {
      const candidate = candidateAt(
        centerX - size.width / 2,
        centerY - size.height / 2,
        dx,
        dy,
        size,
        grid,
        viewport
      );
      if (!collidesWithAny(candidate, occupiedRects)) {
        return { x: candidate.x, y: candidate.y };
      }
    }
  }

  // 3) Search radius exhausted (pathologically dense board) — return the
  //    last cascade candidate. May overlap, but placement always resolves.
  const fallbackOffset = CASCADE_ATTEMPTS * CASCADE_STEP;
  const fallback = candidateAt(
    baseX,
    baseY,
    fallbackOffset,
    fallbackOffset,
    size,
    grid,
    viewport
  );
  return { x: fallback.x, y: fallback.y };
}

/** Default footprint for node kinds that don't compute an explicit initial style. */
export const DEFAULT_WHITEBOARD_NODE_SIZE = { width: 200, height: 120 };
