import { describe, expect, it } from 'vitest';

import {
  longestSegmentMidpoint,
  pointsToPath,
  routeOrthogonal,
  segmentIntersectsBox,
  simplifyPoints,
  type RouteBox,
  type RoutePoint,
} from '../../../src/components/MyWork/processflow/edgeRouting';

/** Assert every consecutive point pair is axis-aligned (H or V only). */
function assertOrthogonal(points: RoutePoint[]) {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const sameX = Math.abs(a.x - b.x) < 0.01;
    const sameY = Math.abs(a.y - b.y) < 0.01;
    expect(sameX || sameY).toBe(true);
  }
}

describe('routeOrthogonal — L/Z routing', () => {
  it('straight horizontal source/target produces a single L (no corner)', () => {
    const r = routeOrthogonal({ x: 0, y: 0 }, { x: 100, y: 0 });
    assertOrthogonal(r.points);
    expect(r.points[0]).toEqual({ x: 0, y: 0 });
    expect(r.points[r.points.length - 1]).toEqual({ x: 100, y: 0 });
    // A pure straight line collapses to the two endpoints.
    expect(r.points).toHaveLength(2);
  });

  it('straight vertical source/target produces a single V line', () => {
    const r = routeOrthogonal({ x: 5, y: 0 }, { x: 5, y: 80 });
    assertOrthogonal(r.points);
    expect(r.points).toHaveLength(2);
  });

  it('diagonal offset produces a Z-route with mid gutter, all axis-aligned', () => {
    const r = routeOrthogonal({ x: 0, y: 0 }, { x: 100, y: 60 });
    assertOrthogonal(r.points);
    // Z-route: at least one intermediate corner between the endpoints.
    expect(r.points.length).toBeGreaterThanOrEqual(3);
    expect(r.points[0]).toEqual({ x: 0, y: 0 });
    expect(r.points[r.points.length - 1]).toEqual({ x: 100, y: 60 });
  });

  it('is deterministic for identical inputs', () => {
    const a = routeOrthogonal({ x: 0, y: 0 }, { x: 100, y: 60 });
    const b = routeOrthogonal({ x: 0, y: 0 }, { x: 100, y: 60 });
    expect(a.path).toBe(b.path);
    expect(a.points).toEqual(b.points);
  });
});

describe('routeOrthogonal — waypoints', () => {
  it('routes through user waypoints in order', () => {
    const waypoints: RoutePoint[] = [
      { x: 50, y: 40 },
      { x: 90, y: 40 },
    ];
    const r = routeOrthogonal({ x: 0, y: 0 }, { x: 140, y: 80 }, { waypoints });
    assertOrthogonal(r.points);
    // Both waypoints must appear as vertices on the route.
    for (const w of waypoints) {
      const hit = r.points.some((p) => Math.abs(p.x - w.x) < 0.01 && Math.abs(p.y - w.y) < 0.01);
      expect(hit).toBe(true);
    }
    // Order preserved: waypoint 0 index < waypoint 1 index.
    const idx0 = r.points.findIndex((p) => Math.abs(p.x - 50) < 0.01 && Math.abs(p.y - 40) < 0.01);
    const idx1 = r.points.findIndex((p) => Math.abs(p.x - 90) < 0.01 && Math.abs(p.y - 40) < 0.01);
    expect(idx0).toBeGreaterThanOrEqual(0);
    expect(idx1).toBeGreaterThan(idx0);
  });

  it('single waypoint still yields an orthogonal route touching it', () => {
    const r = routeOrthogonal({ x: 0, y: 0 }, { x: 200, y: 0 }, { waypoints: [{ x: 100, y: 50 }] });
    assertOrthogonal(r.points);
    const hit = r.points.some((p) => Math.abs(p.x - 100) < 0.01 && Math.abs(p.y - 50) < 0.01);
    expect(hit).toBe(true);
  });
});

describe('routeOrthogonal — bbox clearance', () => {
  it('exits clear of the source box before turning toward target', () => {
    const sourceBox: RouteBox = { x: -40, y: -20, width: 80, height: 40 };
    const r = routeOrthogonal({ x: 40, y: 0 }, { x: 300, y: 120 }, {
      sourceBox,
      offset: 20,
    });
    assertOrthogonal(r.points);
    // The first move must clear the source box right face (40) + offset (20) = 60.
    const firstStep = r.points[1];
    expect(firstStep.x).toBeGreaterThanOrEqual(60 - 0.01);
  });

  it('the leg leaving the source does not re-enter the source box', () => {
    const sourceBox: RouteBox = { x: -40, y: -20, width: 80, height: 40 };
    const r = routeOrthogonal({ x: 40, y: 0 }, { x: 300, y: 120 }, { sourceBox, offset: 20 });
    // The exit leg (points[0]→points[1]) should clear the box on the exit side.
    // We only assert the far leg (2nd onward) never crosses back into the box.
    let crosses = false;
    for (let i = 1; i < r.points.length - 1; i++) {
      if (segmentIntersectsBox(r.points[i], r.points[i + 1], sourceBox)) crosses = true;
    }
    expect(crosses).toBe(false);
  });
});

describe('helpers', () => {
  it('simplifyPoints collapses collinear runs and dedupes', () => {
    const pts: RoutePoint[] = [
      { x: 0, y: 0 },
      { x: 0, y: 0 }, // dupe
      { x: 50, y: 0 },
      { x: 100, y: 0 }, // collinear with prev
      { x: 100, y: 50 },
    ];
    const out = simplifyPoints(pts);
    expect(out).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
    ]);
  });

  it('pointsToPath emits M then L commands', () => {
    const d = pointsToPath([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 20 },
    ]);
    expect(d).toBe('M 0,0 L 10,0 L 10,20');
  });

  it('longestSegmentMidpoint picks the mid of the longest leg', () => {
    const mid = longestSegmentMidpoint([
      { x: 0, y: 0 },
      { x: 10, y: 0 }, // len 10
      { x: 10, y: 100 }, // len 100 (longest)
    ]);
    expect(mid).toEqual({ x: 10, y: 50 });
  });

  it('segmentIntersectsBox detects a crossing and a miss', () => {
    const box: RouteBox = { x: 0, y: 0, width: 20, height: 20 };
    expect(segmentIntersectsBox({ x: -10, y: 10 }, { x: 30, y: 10 }, box)).toBe(true);
    expect(segmentIntersectsBox({ x: -10, y: 100 }, { x: 30, y: 100 }, box)).toBe(false);
  });
});
