import { describe, expect, it } from 'vitest';

import {
  computeLaneAwareFitBounds,
  computePaletteGutter,
  DEFAULT_PROCESS_FLOW_VIEW_STATE,
  isValidViewport,
  normalizeProcessFlowViewState,
  processFlowViewportStorageKey,
  resolveHydrationViewport,
} from '../../../src/components/MyWork/processflow/viewState';

const LANE_HEIGHT = 160;

describe('isValidViewport', () => {
  it('accepts a well-formed viewport', () => {
    expect(isValidViewport({ x: 10, y: -20, zoom: 1.5 })).toBe(true);
  });
  it('rejects missing fields', () => {
    expect(isValidViewport({ x: 10, y: -20 })).toBe(false);
  });
  it('rejects non-numeric fields', () => {
    expect(isValidViewport({ x: '10', y: 0, zoom: 1 })).toBe(false);
  });
  it('rejects zoom <= 0', () => {
    expect(isValidViewport({ x: 0, y: 0, zoom: 0 })).toBe(false);
    expect(isValidViewport({ x: 0, y: 0, zoom: -1 })).toBe(false);
  });
  it('rejects null/non-object', () => {
    expect(isValidViewport(null)).toBe(false);
    expect(isValidViewport('nope')).toBe(false);
    expect(isValidViewport(42)).toBe(false);
  });
});

describe('normalizeProcessFlowViewState', () => {
  it('returns defaults when raw is absent', () => {
    expect(normalizeProcessFlowViewState(undefined)).toEqual(DEFAULT_PROCESS_FLOW_VIEW_STATE);
    expect(normalizeProcessFlowViewState(null)).toEqual(DEFAULT_PROCESS_FLOW_VIEW_STATE);
  });
  it('returns defaults when raw is not an object', () => {
    expect(normalizeProcessFlowViewState('garbage')).toEqual(DEFAULT_PROCESS_FLOW_VIEW_STATE);
  });
  it('preserves showGrid=false and snap=false (bug L-04 regression)', () => {
    const result = normalizeProcessFlowViewState({ showGrid: false, snap: false });
    expect(result.showGrid).toBe(false);
    expect(result.snap).toBe(false);
  });
  it('defaults booleans when field is not a boolean', () => {
    const result = normalizeProcessFlowViewState({ showGrid: 'yes', snap: 1 });
    expect(result.showGrid).toBe(true);
    expect(result.snap).toBe(true);
  });
  it('accepts layoutMode vertical, defaults invalid to horizontal', () => {
    expect(normalizeProcessFlowViewState({ layoutMode: 'vertical' }).layoutMode).toBe('vertical');
    expect(normalizeProcessFlowViewState({ layoutMode: 'diagonal' }).layoutMode).toBe('horizontal');
  });
  it('carries a valid viewport through', () => {
    const result = normalizeProcessFlowViewState({ viewport: { x: 1, y: 2, zoom: 0.8 } });
    expect(result.viewport).toEqual({ x: 1, y: 2, zoom: 0.8 });
  });
  it('drops an invalid viewport', () => {
    const result = normalizeProcessFlowViewState({ viewport: { x: 1 } });
    expect(result.viewport).toBeUndefined();
  });
});

describe('resolveHydrationViewport', () => {
  it('prefers a valid blob viewport over localStorage', () => {
    const blob = { x: 1, y: 2, zoom: 1 };
    const local = JSON.stringify({ x: 9, y: 9, zoom: 9 });
    expect(resolveHydrationViewport(blob, local)).toEqual(blob);
  });
  it('falls back to localStorage when blob viewport is missing', () => {
    const local = JSON.stringify({ x: 3, y: 4, zoom: 0.5 });
    expect(resolveHydrationViewport(undefined, local)).toEqual({ x: 3, y: 4, zoom: 0.5 });
  });
  it('falls back to localStorage when blob viewport is invalid', () => {
    const local = JSON.stringify({ x: 3, y: 4, zoom: 0.5 });
    expect(resolveHydrationViewport({ x: 1 }, local)).toEqual({ x: 3, y: 4, zoom: 0.5 });
  });
  it('returns null when both are absent', () => {
    expect(resolveHydrationViewport(undefined, null)).toBeNull();
  });
  it('returns null when localStorage has malformed JSON', () => {
    expect(resolveHydrationViewport(undefined, '{not json')).toBeNull();
  });
  it('returns null when localStorage viewport is invalid', () => {
    expect(resolveHydrationViewport(undefined, JSON.stringify({ x: 1 }))).toBeNull();
  });
});

describe('processFlowViewportStorageKey', () => {
  it('namespaces by ideaId', () => {
    expect(processFlowViewportStorageKey('idea-1')).toBe('pf-viewport-idea-1');
    expect(processFlowViewportStorageKey('idea-2')).toBe('pf-viewport-idea-2');
  });
});

// PF-P3-01: "Fit view" must fit ALL lanes and nodes, not just the nodes a
// plain fitView() would bound — lanes are painted OUTSIDE the node graph
// (LaneSystem.tsx) as full-width bands stacked at flow-space Y offsets.
describe('computeLaneAwareFitBounds', () => {
  it('extends the fit height to cover an EMPTY trailing lane a plain fitView would crop', () => {
    // One node sits only in lane 0; three lanes exist total.
    const nodes = [{ position: { x: 0, y: 20 }, width: 200, height: 60 }];
    const lanes = [{}, {}, {}]; // 3 default-height lanes, only the first has a node
    const bounds = computeLaneAwareFitBounds(nodes, lanes, LANE_HEIGHT);
    // A naive node-only fit would stop at y=80 (20+60). The lane stack is
    // 3*160=480 — the fix must reach that, not just the node's own bottom.
    expect(bounds.height).toBeGreaterThanOrEqual(3 * LANE_HEIGHT);
  });

  it('does not shrink below the node bounds when lanes are shorter than the content', () => {
    // A node dragged below its lane's nominal band (e.g. a resized/collapsed
    // lane) must still be included — the union takes the taller of the two.
    const nodes = [{ position: { x: 0, y: 900 }, width: 200, height: 60 }];
    const lanes = [{ height: 100 }];
    const bounds = computeLaneAwareFitBounds(nodes, lanes, LANE_HEIGHT);
    expect(bounds.y).toBeLessThanOrEqual(900);
    expect(bounds.y + bounds.height).toBeGreaterThanOrEqual(960);
  });

  it('honours collapsed lanes in the total stack height', () => {
    const nodes = [{ position: { x: 0, y: 20 }, width: 200, height: 60 }];
    const expandedLanes = [{}, {}];
    const collapsedLanes = [{}, { collapsed: true }];
    const expandedBounds = computeLaneAwareFitBounds(nodes, expandedLanes, LANE_HEIGHT);
    const collapsedBounds = computeLaneAwareFitBounds(nodes, collapsedLanes, LANE_HEIGHT);
    expect(collapsedBounds.height).toBeLessThan(expandedBounds.height);
  });

  it('falls back to a sane non-degenerate rect for an empty canvas (no nodes yet)', () => {
    const bounds = computeLaneAwareFitBounds([], [{}, {}], LANE_HEIGHT);
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThanOrEqual(2 * LANE_HEIGHT);
  });

  it('falls back to a default lane height with zero lanes so the rect never collapses to zero', () => {
    const bounds = computeLaneAwareFitBounds([], [], LANE_HEIGHT);
    expect(bounds.height).toBeGreaterThan(0);
    expect(bounds.width).toBeGreaterThan(0);
  });

  it('uses node x-extent for width — lanes have no real x-extent to widen it', () => {
    const nodes = [
      { position: { x: 0, y: 0 }, width: 200, height: 60 },
      { position: { x: 500, y: 0 }, width: 200, height: 60 },
    ];
    const bounds = computeLaneAwareFitBounds(nodes, [{}], LANE_HEIGHT);
    expect(bounds.x).toBe(0);
    expect(bounds.width).toBe(700); // rightmost node right edge (500+200) - left (0)
  });

  it('falls back to a default node size for unmeasured nodes (width/height undefined)', () => {
    const nodes = [{ position: { x: 0, y: 0 } }];
    const bounds = computeLaneAwareFitBounds(nodes, [{}], LANE_HEIGHT);
    expect(bounds.width).toBeGreaterThan(0);
    expect(Number.isFinite(bounds.width)).toBe(true);
  });
});

// F6 (DEC-461, defekt zrzut 17-pomysly-process-flow-po.png): the floating
// tool palette is `position: fixed` over the canvas and covers a node
// rendered near the canvas's left edge (screenshot: first-step card at
// screen x≈60-130, exactly where the palette rail sits). `fitView`/a
// restored viewport must nudge the VIEWPORT — never node data — right by at
// least the palette's real width + 16px so nothing renders under it.
describe('computePaletteGutter', () => {
  it('requires a viewport shift covering the palette width plus the 16px margin', () => {
    // Palette rail spans screen x 82..128 (its own left inset + ~46px
    // width, matching CanvasLeftToolbar's icon-button sizing); canvas
    // container starts at screen x 70 (collapsed app sidebar).
    const railRect = { left: 82, right: 128 };
    const containerRect = { left: 70, right: 1100 };
    // (128 - 70) + 16 = 74 — a node whose flow x=0 lands before this
    // viewport.x would render under the palette; a node here or further
    // right renders clear of it.
    expect(computePaletteGutter(railRect, containerRect)).toBe(74);
  });

  it('returns 0 when the palette does not reach the canvas left edge (e.g. dragged away)', () => {
    const railRect = { left: 900, right: 946 };
    const containerRect = { left: 70, right: 1100 };
    expect(computePaletteGutter(railRect, containerRect)).toBe(0);
  });

  it('never returns a negative gutter — clamps at 0', () => {
    const railRect = { left: -50, right: -10 };
    const containerRect = { left: 70, right: 1100 };
    expect(computePaletteGutter(railRect, containerRect)).toBe(0);
  });

  it('honours a custom margin', () => {
    const railRect = { left: 82, right: 128 };
    const containerRect = { left: 70, right: 1100 };
    expect(computePaletteGutter(railRect, containerRect, 0)).toBe(58);
  });

  // ── F8a: PRAWDZIWE prostokąty z REALNEJ powłoki ──────────────────────────
  // Zmierzone na stagingu `6c34292eb0` (org Northwind, konto Iriny, 1440×900,
  // My Work → Ideas → „Protect the planned maintenance window…" → Open Flow);
  // surowe wartości: `~/Developer/cto-codex/fala-f8a-20260915/pomiar/m5-badge.json`.
  //   kontener płótna (.react-flow)                 left = 64
  //   pasek palety [data-mels-floating-rail-surface] 76 … 130
  //   plakietka trybu „SELECT" (mode badge)         131 … 176
  //   węzeł „Protect the planned maintenance…"      140 … 290  ← pod plakietką
  // Dev-render tego nie miał: tam kontener zaczynał się na 0, a plakietki nie
  // było wcale — dlatego F6 przeszła testy i poległa na żywym ekranie.
  describe('F8a — realne prostokąty powłoki (rail 76–130, plakietka 131–176, kontener 64)', () => {
    const containerRect = { left: 64, right: 1088 };
    const railRect = { left: 76, right: 130 };
    const modeBadgeRect = { left: 131, right: 176 };

    it('sam pasek daje rynnę 82 — czyli DOKŁADNIE stan, który zostawił węzeł pod plakietką', () => {
      // 130 - 64 + 16 = 82 → węzeł na ekranie x = 64 + 82 = 146, a plakietka
      // sięga 176. To jest defekt ze zrzutu 57, wyrażony liczbą.
      expect(computePaletteGutter(railRect, containerRect)).toBe(82);
      expect(containerRect.left + 82).toBeLessThan(modeBadgeRect.right);
    });

    it('pasek + plakietka dają rynnę 128 — węzeł startuje 16 px ZA całą paletą', () => {
      const gutter = computePaletteGutter([railRect, modeBadgeRect], containerRect);
      // 176 - 64 + 16 = 128
      expect(gutter).toBe(128);
      // Dowód wprost w jednostkach ekranu: lewa krawędź węzła minus prawa
      // krawędź najdalszego elementu palety = margines 16 px.
      expect(containerRect.left + gutter - modeBadgeRect.right).toBe(16);
    });

    it('bierze NAJWIĘKSZĄ rynnę niezależnie od kolejności prostokątów', () => {
      expect(computePaletteGutter([modeBadgeRect, railRect], containerRect)).toBe(128);
    });

    it('pomija elementy palety przeciągnięte z dala od lewej krawędzi', () => {
      const daleko = { left: 900, right: 946 };
      expect(computePaletteGutter([railRect, daleko], containerRect)).toBe(82);
      expect(computePaletteGutter([daleko], containerRect)).toBe(0);
    });
  });
});
