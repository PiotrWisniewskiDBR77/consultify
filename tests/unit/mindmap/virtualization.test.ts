/**
 * M06 Fala 3.3 — viewport virtualization / culling.
 *
 * Covers the pure decision + intersection helpers that gate ReactFlow's built-in
 * `onlyRenderVisibleElements`, plus the `mindmapVirtualization` flag registration
 * (OFF by default → no behavior change).
 */
import { describe, expect, it } from 'vitest';

import {
  type FlowViewport,
  type NodeBox,
  VIRTUALIZATION_NODE_THRESHOLD,
  isNodeRenderable,
  shouldVirtualize,
} from '@/components/MyWork/mindmap/virtualization';
import { DEFAULT_FLAGS } from '@/hooks/useFeatureFlags';

function box(id: string, x: number, y: number, width = 160, height = 48): NodeBox {
  return { id, x, y, width, height };
}

const VIEWPORT: FlowViewport = { minX: 0, minY: 0, maxX: 1000, maxY: 800 };

describe('shouldVirtualize', () => {
  it('never virtualizes when the flag is OFF, regardless of node count', () => {
    expect(shouldVirtualize(false, 0)).toBe(false);
    expect(shouldVirtualize(false, 5000)).toBe(false);
  });

  it('engages only at/above the threshold when the flag is ON', () => {
    expect(shouldVirtualize(true, VIRTUALIZATION_NODE_THRESHOLD - 1)).toBe(false);
    expect(shouldVirtualize(true, VIRTUALIZATION_NODE_THRESHOLD)).toBe(true);
    expect(shouldVirtualize(true, VIRTUALIZATION_NODE_THRESHOLD + 1)).toBe(true);
  });

  it('respects a custom threshold', () => {
    expect(shouldVirtualize(true, 100, 500)).toBe(false);
    expect(shouldVirtualize(true, 500, 500)).toBe(true);
  });

  it('keeps small/medium maps out of virtualization (byte-identical to OFF)', () => {
    expect(shouldVirtualize(true, 50)).toBe(false);
    expect(shouldVirtualize(true, 299)).toBe(false);
  });
});

describe('isNodeRenderable', () => {
  it('renders a node fully inside the viewport', () => {
    expect(isNodeRenderable(box('a', 100, 100), VIEWPORT)).toBe(true);
  });

  it('culls a node fully to the left / above / right / below', () => {
    expect(isNodeRenderable(box('l', -500, 100), VIEWPORT)).toBe(false);
    expect(isNodeRenderable(box('t', 100, -500), VIEWPORT)).toBe(false);
    expect(isNodeRenderable(box('r', 1500, 100), VIEWPORT)).toBe(false);
    expect(isNodeRenderable(box('b', 100, 1500), VIEWPORT)).toBe(false);
  });

  it('renders a node straddling the viewport edge', () => {
    // right edge crosses maxX (960..1120 vs maxX=1000)
    expect(isNodeRenderable(box('edge', 960, 400), VIEWPORT)).toBe(true);
  });

  it('pulls an off-screen node back in via the margin', () => {
    // node at x=-200..-40 is off-screen with margin 0, on-screen with margin 300
    expect(isNodeRenderable(box('m', -200, 100), VIEWPORT, { margin: 0 })).toBe(false);
    expect(isNodeRenderable(box('m', -200, 100), VIEWPORT, { margin: 300 })).toBe(true);
  });

  it('always mounts selected/editing/locked nodes even when off-screen', () => {
    const keep = new Set(['sel']);
    // far off-screen, but in the keep-mounted set → renderable
    expect(isNodeRenderable(box('sel', 9999, 9999), VIEWPORT, { keepMountedIds: keep })).toBe(true);
    // same position, not in the set → culled
    expect(isNodeRenderable(box('other', 9999, 9999), VIEWPORT, { keepMountedIds: keep })).toBe(
      false
    );
  });
});

describe('mindmapVirtualization flag registration', () => {
  it('is registered and OFF by default (flag OFF = no behavior change)', () => {
    const flag = DEFAULT_FLAGS.find((f) => f.id === 'mindmapVirtualization');
    expect(flag).toBeDefined();
    expect(flag?.defaultValue).toBe(false);
    expect(flag?.category).toBe('beta');
    expect(flag?.allowLocalOverride).toBe(true);
  });
});
