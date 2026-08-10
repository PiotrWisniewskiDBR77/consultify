/**
 * WB-P1-02 — shared whiteboard placement service.
 *
 * Pure-function tests: given existing node rects + a viewport + a size, the
 * service must return a deterministic, collision-free (or nearest-free-slot)
 * position, clamped inside the viewport. No ReactFlow/DOM involved.
 */
import { describe, expect, it } from 'vitest';

import {
  computeTidyLayout,
  DEFAULT_WHITEBOARD_NODE_SIZE,
  rectOfWhiteboardNode,
  resolveWhiteboardPlacement,
  type WhiteboardRect,
} from '../whiteboardPlacement';

const VIEWPORT = { x: 0, y: 0, width: 1280, height: 800 };
const NOTE_SIZE = { width: 180, height: 100 };

function overlaps(a: WhiteboardRect, b: WhiteboardRect): boolean {
  return (
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
  );
}

function containsFully(rect: WhiteboardRect, viewport: WhiteboardRect): boolean {
  return (
    rect.x >= viewport.x &&
    rect.y >= viewport.y &&
    rect.x + rect.width <= viewport.x + viewport.width &&
    rect.y + rect.height <= viewport.y + viewport.height
  );
}

describe('resolveWhiteboardPlacement', () => {
  it('places the very first object at the (grid-snapped) anchor when nothing else occupies it', () => {
    const anchor = { x: 552, y: 352 }; // already a multiple of the default 8px grid
    const pos = resolveWhiteboardPlacement({
      size: NOTE_SIZE,
      anchor,
      occupiedRects: [],
      viewport: VIEWPORT,
    });
    expect(pos).toEqual(anchor);
  });

  it('is deterministic: same inputs always produce the same output', () => {
    const occupied: WhiteboardRect[] = [{ x: 550, y: 350, width: 180, height: 100 }];
    const a = resolveWhiteboardPlacement({
      size: NOTE_SIZE,
      anchor: { x: 550, y: 350 },
      occupiedRects: occupied,
      viewport: VIEWPORT,
    });
    const b = resolveWhiteboardPlacement({
      size: NOTE_SIZE,
      anchor: { x: 550, y: 350 },
      occupiedRects: occupied,
      viewport: VIEWPORT,
    });
    expect(a).toEqual(b);
  });

  it('never returns a rect that fully overlaps an existing one at the same anchor', () => {
    const anchor = { x: 550, y: 350 };
    const existing: WhiteboardRect = { x: anchor.x, y: anchor.y, width: 180, height: 100 };
    const pos = resolveWhiteboardPlacement({
      size: NOTE_SIZE,
      anchor,
      occupiedRects: [existing],
      viewport: VIEWPORT,
    });
    const rect = { ...pos, width: NOTE_SIZE.width, height: NOTE_SIZE.height };
    expect(overlaps(rect, existing)).toBe(false);
  });

  it('ten successive inserts at the same anchor are all individually distinct and non-overlapping with every predecessor', () => {
    const anchor = { x: 640, y: 400 };
    const placed: WhiteboardRect[] = [];
    for (let i = 0; i < 10; i++) {
      const pos = resolveWhiteboardPlacement({
        size: NOTE_SIZE,
        anchor,
        occupiedRects: placed,
        viewport: VIEWPORT,
      });
      const rect = { ...pos, width: NOTE_SIZE.width, height: NOTE_SIZE.height };
      // Must not collide with anything placed so far.
      for (const prior of placed) {
        expect(overlaps(rect, prior)).toBe(false);
      }
      // Must stay fully on-screen.
      expect(containsFully(rect, VIEWPORT)).toBe(true);
      placed.push(rect);
    }
    // Ten genuinely distinct positions.
    const unique = new Set(placed.map((r) => `${r.x},${r.y}`));
    expect(unique.size).toBe(10);
  });

  it('a mixed batch of 12 notes/shapes/frames has no complete overlap between any pair', () => {
    const anchor = { x: 640, y: 400 };
    const sizes = [
      NOTE_SIZE, // sticky
      { width: 160, height: 80 }, // shape rectangle
      { width: 220, height: 80 }, // text block
      { width: 400, height: 300 }, // frame
      NOTE_SIZE,
      { width: 120, height: 120 }, // shape circle
      DEFAULT_WHITEBOARD_NODE_SIZE, // kpi badge
      NOTE_SIZE,
      { width: 200, height: 150 }, // image
      { width: 100, height: 100 }, // shape diamond
      NOTE_SIZE,
      { width: 400, height: 300 }, // frame
    ];
    const placed: WhiteboardRect[] = [];
    for (const size of sizes) {
      const pos = resolveWhiteboardPlacement({
        size,
        anchor,
        occupiedRects: placed,
        viewport: VIEWPORT,
      });
      placed.push({ ...pos, ...size });
    }
    expect(placed).toHaveLength(12);
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        // "no complete overlap" — the acceptance bar is that no pair sits
        // exactly on top of each other (identical rect), which is the
        // observable defect (WB-P1-02). The service additionally avoids
        // partial overlap whenever the search radius allows it.
        expect(placed[i]).not.toEqual(placed[j]);
      }
    }
  });

  it('respects the grid: every returned coordinate is a multiple of the grid size', () => {
    const occupied: WhiteboardRect[] = [{ x: 100, y: 100, width: 180, height: 100 }];
    const pos = resolveWhiteboardPlacement({
      size: NOTE_SIZE,
      anchor: { x: 103, y: 97 },
      occupiedRects: occupied,
      viewport: VIEWPORT,
      grid: 8,
    });
    expect(pos.x % 8).toBe(0);
    expect(pos.y % 8).toBe(0);
  });

  it('keeps the full object inside the viewport even when the anchor is near an edge', () => {
    const pos = resolveWhiteboardPlacement({
      size: NOTE_SIZE,
      anchor: { x: -50, y: -50 },
      occupiedRects: [],
      viewport: VIEWPORT,
    });
    const rect = { ...pos, width: NOTE_SIZE.width, height: NOTE_SIZE.height };
    expect(containsFully(rect, VIEWPORT)).toBe(true);
  });

  it('after the cascade collision threshold, escalates to a nearest-free-slot scan rather than stacking', () => {
    // Densely pack rects around the anchor so every cascade attempt
    // (up to the threshold) still collides, forcing the ring-scan path.
    const anchor = { x: 600, y: 400 };
    const occupied: WhiteboardRect[] = [];
    for (let gx = -2; gx <= 2; gx++) {
      for (let gy = -2; gy <= 2; gy++) {
        occupied.push({
          x: anchor.x + gx * 40,
          y: anchor.y + gy * 40,
          width: 180,
          height: 100,
        });
      }
    }
    const pos = resolveWhiteboardPlacement({
      size: NOTE_SIZE,
      anchor,
      occupiedRects: occupied,
      viewport: VIEWPORT,
    });
    const rect = { ...pos, width: NOTE_SIZE.width, height: NOTE_SIZE.height };
    for (const o of occupied) {
      expect(overlaps(rect, o)).toBe(false);
    }
  });

  it('does not mutate or reposition any rect in occupiedRects (never auto-moves existing objects)', () => {
    const occupied: WhiteboardRect[] = [{ x: 300, y: 300, width: 180, height: 100 }];
    const snapshot = JSON.parse(JSON.stringify(occupied));
    resolveWhiteboardPlacement({
      size: NOTE_SIZE,
      anchor: { x: 300, y: 300 },
      occupiedRects: occupied,
      viewport: VIEWPORT,
    });
    expect(occupied).toEqual(snapshot);
  });

  it('falls back gracefully (still returns a position) when the board is pathologically dense', () => {
    const anchor = { x: 400, y: 400 };
    const occupied: WhiteboardRect[] = [];
    for (let gx = -10; gx <= 10; gx++) {
      for (let gy = -10; gy <= 10; gy++) {
        occupied.push({ x: anchor.x + gx * 20, y: anchor.y + gy * 20, width: 180, height: 100 });
      }
    }
    const pos = resolveWhiteboardPlacement({
      size: NOTE_SIZE,
      anchor,
      occupiedRects: occupied,
      viewport: VIEWPORT,
    });
    expect(typeof pos.x).toBe('number');
    expect(typeof pos.y).toBe('number');
    expect(Number.isFinite(pos.x)).toBe(true);
    expect(Number.isFinite(pos.y)).toBe(true);
  });
});

describe('rectOfWhiteboardNode', () => {
  it('prefers an explicit width/height over style, and style over the fallback default', () => {
    expect(
      rectOfWhiteboardNode({ position: { x: 1, y: 2 }, width: 50, height: 60, style: { width: 999, height: 999 } })
    ).toEqual({ x: 1, y: 2, width: 50, height: 60 });
    expect(
      rectOfWhiteboardNode({ position: { x: 1, y: 2 }, style: { width: 70, height: 80 } })
    ).toEqual({ x: 1, y: 2, width: 70, height: 80 });
    expect(rectOfWhiteboardNode({ position: { x: 1, y: 2 } })).toEqual({
      x: 1,
      y: 2,
      ...DEFAULT_WHITEBOARD_NODE_SIZE,
    });
  });

  it('ignores a non-positive width/height and falls through to style/default', () => {
    expect(
      rectOfWhiteboardNode({ position: { x: 0, y: 0 }, width: 0, height: -5, style: { width: 40, height: 30 } })
    ).toEqual({ x: 0, y: 0, width: 40, height: 30 });
  });
});

describe('computeTidyLayout (WB-P2-03 "Tidy board" / "Auto arrange selection")', () => {
  it('places every item without any overlap among them or with fixedRects, reusing resolveWhiteboardPlacement unmodified', () => {
    const items = [
      { id: 'a', rect: { x: 500, y: 500, width: 180, height: 100 } },
      { id: 'b', rect: { x: 500, y: 500, width: 180, height: 100 } },
      { id: 'c', rect: { x: 500, y: 500, width: 180, height: 100 } },
    ];
    const fixedRects: WhiteboardRect[] = [{ x: 100, y: 100, width: 180, height: 100 }];
    const layout = computeTidyLayout({
      items,
      anchor: { x: 100, y: 100 },
      fixedRects,
      viewport: VIEWPORT,
      grid: 8,
    });

    expect(layout.size).toBe(3);
    const placedRects = items.map((it) => ({
      ...layout.get(it.id)!,
      width: it.rect.width,
      height: it.rect.height,
    }));
    for (let i = 0; i < placedRects.length; i++) {
      // Never overlaps the fixed obstacle.
      expect(overlaps(placedRects[i], fixedRects[0])).toBe(false);
      // Never overlaps an earlier-placed item.
      for (let j = 0; j < i; j++) {
        expect(overlaps(placedRects[i], placedRects[j])).toBe(false);
      }
    }
  });

  it('is deterministic: same items/anchor/fixedRects always produce the same layout', () => {
    const items = [
      { id: 'x', rect: { x: 10, y: 10, width: 100, height: 60 } },
      { id: 'y', rect: { x: 10, y: 10, width: 100, height: 60 } },
    ];
    const input = { items, anchor: { x: 10, y: 10 }, grid: 8 };
    const a = computeTidyLayout(input);
    const b = computeTidyLayout(input);
    expect(Array.from(a.entries())).toEqual(Array.from(b.entries()));
  });

  it('does not mutate the caller-supplied fixedRects (obstacles never move)', () => {
    const fixedRects: WhiteboardRect[] = [{ x: 20, y: 20, width: 100, height: 60 }];
    const snapshot = JSON.parse(JSON.stringify(fixedRects));
    computeTidyLayout({
      items: [{ id: 'only', rect: { x: 20, y: 20, width: 100, height: 60 } }],
      anchor: { x: 20, y: 20 },
      fixedRects,
    });
    expect(fixedRects).toEqual(snapshot);
  });
});
