/**
 * edgeRouting — pure, DOM-free orthogonal edge routing for Process Flow (M07 F5a).
 *
 * Produces an SVG path string made of horizontal/vertical segments (Lucidchart
 * style) between a source and a target point, honouring optional user waypoints
 * and offering a light L/Z auto-route that steps clear of the source/target
 * bounding boxes (NOT a full A* — spec A1 asks for "L/Z-routing z odsunięciem
 * od bbox").
 *
 * Everything here is deterministic and side-effect free so it can be unit
 * tested without React or a DOM (see tests/unit/mywork/edgeRouting.test.ts).
 */

export interface RoutePoint {
  x: number;
  y: number;
}

/** Optional axis-aligned box a route should step clear of. */
export interface RouteBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RouteOrthogonalOptions {
  /** User-placed break points (edge.data.waypoints). Routed through in order. */
  waypoints?: RoutePoint[];
  /** Source node box — the first leg leaves clear of it. */
  sourceBox?: RouteBox;
  /** Target node box — the last leg approaches clear of it. */
  targetBox?: RouteBox;
  /** Clearance kept from a bounding box before turning (px). Default 20. */
  offset?: number;
}

export interface OrthogonalRoute {
  /** Ordered corner points, source first, target last. */
  points: RoutePoint[];
  /** SVG path `d` attribute built from `points` (all H/V segments). */
  path: string;
  /** Mid-point of the longest segment — a stable label anchor. */
  labelPoint: RoutePoint;
}

const DEFAULT_OFFSET = 20;

function almostEqual(a: number, b: number, eps = 0.01): boolean {
  return Math.abs(a - b) <= eps;
}

/**
 * Drop consecutive duplicate points and collapse collinear H/V runs.
 * Points listed in `protectedPts` (e.g. user waypoints) are never collapsed
 * away even when collinear — a waypoint is an intentional vertex.
 */
export function simplifyPoints(
  points: RoutePoint[],
  protectedPts: RoutePoint[] = []
): RoutePoint[] {
  const isProtected = (p: RoutePoint) =>
    protectedPts.some((w) => almostEqual(w.x, p.x) && almostEqual(w.y, p.y));

  const deduped: RoutePoint[] = [];
  for (const p of points) {
    const last = deduped[deduped.length - 1];
    if (!last || !almostEqual(last.x, p.x) || !almostEqual(last.y, p.y)) {
      deduped.push({ x: p.x, y: p.y });
    }
  }
  if (deduped.length <= 2) return deduped;
  const out: RoutePoint[] = [deduped[0]];
  for (let i = 1; i < deduped.length - 1; i++) {
    const prev = out[out.length - 1];
    const cur = deduped[i];
    const next = deduped[i + 1];
    if (isProtected(cur)) {
      out.push(cur);
      continue;
    }
    const collinearX = almostEqual(prev.x, cur.x) && almostEqual(cur.x, next.x);
    const collinearY = almostEqual(prev.y, cur.y) && almostEqual(cur.y, next.y);
    if (collinearX || collinearY) continue; // cur adds no corner
    out.push(cur);
  }
  out.push(deduped[deduped.length - 1]);
  return out;
}

/**
 * Orthogonal L/Z connector between two adjacent points. Emits a single mid
 * corner: an "L" when only one axis differs, a "Z" (two corners via a mid
 * gutter) when both differ. The mid gutter is placed halfway so the connector
 * reads symmetrically regardless of direction.
 */
function orthogonalLeg(a: RoutePoint, b: RoutePoint): RoutePoint[] {
  const sameX = almostEqual(a.x, b.x);
  const sameY = almostEqual(a.y, b.y);
  if (sameX || sameY) return [a, b]; // straight H or V line — pure L with no corner
  // Z-route: step horizontally to a mid gutter, then vertically, then across.
  const midX = (a.x + b.x) / 2;
  return [a, { x: midX, y: a.y }, { x: midX, y: b.y }, b];
}

/** Right edge x / clearance-adjusted exit point away from a box. */
function exitPoint(
  p: RoutePoint,
  box: RouteBox | undefined,
  offset: number,
  toward: RoutePoint
): RoutePoint {
  if (!box) return p;
  // Step outward along the dominant axis toward the destination, keeping
  // `offset` clearance beyond the nearest box face.
  const dx = toward.x - p.x;
  const dy = toward.y - p.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const face = dx >= 0 ? box.x + box.width : box.x;
    const clear = dx >= 0 ? face + offset : face - offset;
    return { x: clear, y: p.y };
  }
  const face = dy >= 0 ? box.y + box.height : box.y;
  const clear = dy >= 0 ? face + offset : face - offset;
  return { x: p.x, y: clear };
}

/**
 * Route an orthogonal connector from `source` to `target`, optionally through
 * `waypoints`, stepping clear of source/target boxes.
 *
 * Pure function — no DOM, no React. Given identical inputs it always returns an
 * identical route (deterministic), which is what makes it unit-testable.
 */
export function routeOrthogonal(
  source: RoutePoint,
  target: RoutePoint,
  options: RouteOrthogonalOptions = {}
): OrthogonalRoute {
  const offset = options.offset ?? DEFAULT_OFFSET;
  const waypoints = (options.waypoints ?? []).map((w) => ({ x: w.x, y: w.y }));

  // Sequence of anchor points the route must visit, in order.
  const firstAfterSource = waypoints[0] ?? target;
  const lastBeforeTarget = waypoints[waypoints.length - 1] ?? source;
  const src = exitPoint(source, options.sourceBox, offset, firstAfterSource);
  const tgt = exitPoint(target, options.targetBox, offset, lastBeforeTarget);

  const anchors: RoutePoint[] = [source, src, ...waypoints, tgt, target];

  // Stitch orthogonal legs between each consecutive anchor pair.
  const stitched: RoutePoint[] = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const leg = orthogonalLeg(anchors[i], anchors[i + 1]);
    // Avoid duplicating the shared endpoint between legs.
    if (i === 0) stitched.push(...leg);
    else stitched.push(...leg.slice(1));
  }

  const points = simplifyPoints(stitched, waypoints);
  const path = pointsToPath(points);
  const labelPoint = longestSegmentMidpoint(points);
  return { points, path, labelPoint };
}

/** Build an SVG `d` from ordered points (M then L for each subsequent point). */
export function pointsToPath(points: RoutePoint[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  const round = (n: number) => Math.round(n * 100) / 100;
  let d = `M ${round(first.x)},${round(first.y)}`;
  for (const p of rest) d += ` L ${round(p.x)},${round(p.y)}`;
  return d;
}

/** Mid-point of the longest segment — stable anchor for an edge label. */
export function longestSegmentMidpoint(points: RoutePoint[]): RoutePoint {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return { ...points[0] };
  let best = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
  let bestLen = -1;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y); // manhattan (H or V leg)
    if (len > bestLen) {
      bestLen = len;
      best = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  }
  return best;
}

/**
 * Whether a straight orthogonal segment (a→b, already axis-aligned) crosses a
 * box. Used by tests to assert bbox avoidance and could gate a future re-route.
 */
export function segmentIntersectsBox(a: RoutePoint, b: RoutePoint, box: RouteBox): boolean {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const bx1 = box.x;
  const bx2 = box.x + box.width;
  const by1 = box.y;
  const by2 = box.y + box.height;
  // No overlap on either axis → no intersection.
  if (maxX < bx1 || minX > bx2) return false;
  if (maxY < by1 || minY > by2) return false;
  return true;
}
