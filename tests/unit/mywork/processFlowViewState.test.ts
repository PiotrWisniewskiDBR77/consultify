import { describe, expect, it } from 'vitest';

import {
  computeLaneAwareFitBounds,
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
