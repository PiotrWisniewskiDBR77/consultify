import { describe, expect, it } from 'vitest';

import {
  COLLAPSED_LANE_HEIGHT,
  isNodeInCollapsedLane,
  laneBandHeight,
  laneBandLayout,
  setLaneHeight,
  toggleLaneCollapsed,
} from '../../../src/components/MyWork/processflow/laneState';
import type { Lane } from '../../../src/components/MyWork/processflow/useProcessFlowNodes';

const DEFAULT = 140;

function lane(id: string, extra: Partial<Lane> = {}): Lane {
  return { id, label: id, color: '#e0e7ff', ...extra };
}

describe('laneBandHeight', () => {
  it('returns default when no override', () => {
    expect(laneBandHeight(lane('a'), DEFAULT)).toBe(DEFAULT);
  });
  it('returns collapsed height when collapsed (overrides height)', () => {
    expect(laneBandHeight(lane('a', { collapsed: true, height: 300 }), DEFAULT)).toBe(
      COLLAPSED_LANE_HEIGHT
    );
  });
  it('returns user height when set and not collapsed', () => {
    expect(laneBandHeight(lane('a', { height: 220 }), DEFAULT)).toBe(220);
  });
  it('ignores non-positive height', () => {
    expect(laneBandHeight(lane('a', { height: 0 }), DEFAULT)).toBe(DEFAULT);
  });
});

describe('toggleLaneCollapsed', () => {
  it('toggles from undefined to true', () => {
    const next = toggleLaneCollapsed([lane('a'), lane('b')], 'a');
    expect(next.find((l) => l.id === 'a')?.collapsed).toBe(true);
    expect(next.find((l) => l.id === 'b')?.collapsed).toBeUndefined();
  });
  it('toggles from true to false', () => {
    const next = toggleLaneCollapsed([lane('a', { collapsed: true })], 'a');
    expect(next[0].collapsed).toBe(false);
  });
  it('honours explicit next value', () => {
    const next = toggleLaneCollapsed([lane('a', { collapsed: true })], 'a', true);
    expect(next[0].collapsed).toBe(true);
  });
  it('returns a new array (immutable)', () => {
    const input = [lane('a')];
    const next = toggleLaneCollapsed(input, 'a');
    expect(next).not.toBe(input);
    expect(input[0].collapsed).toBeUndefined();
  });
});

describe('setLaneHeight', () => {
  it('clamps to minimum', () => {
    const next = setLaneHeight([lane('a')], 'a', 10, 60);
    expect(next[0].height).toBe(60);
  });
  it('rounds and applies height', () => {
    const next = setLaneHeight([lane('a')], 'a', 199.6);
    expect(next[0].height).toBe(200);
  });
  it('only touches the target lane', () => {
    const next = setLaneHeight([lane('a'), lane('b')], 'b', 180);
    expect(next.find((l) => l.id === 'a')?.height).toBeUndefined();
    expect(next.find((l) => l.id === 'b')?.height).toBe(180);
  });
});

describe('laneBandLayout', () => {
  it('stacks band tops cumulatively', () => {
    const layout = laneBandLayout([lane('a'), lane('b'), lane('c')], DEFAULT);
    expect(layout.a.top).toBe(0);
    expect(layout.b.top).toBe(DEFAULT);
    expect(layout.c.top).toBe(DEFAULT * 2);
  });
  it('collapsed lane shrinks the stack below it', () => {
    const layout = laneBandLayout([lane('a', { collapsed: true }), lane('b')], DEFAULT);
    expect(layout.a.height).toBe(COLLAPSED_LANE_HEIGHT);
    expect(layout.b.top).toBe(COLLAPSED_LANE_HEIGHT);
  });
  it('respects per-lane user height', () => {
    const layout = laneBandLayout([lane('a', { height: 200 }), lane('b')], DEFAULT);
    expect(layout.a.height).toBe(200);
    expect(layout.b.top).toBe(200);
  });
});

describe('isNodeInCollapsedLane', () => {
  const lanes = [lane('a', { collapsed: true }), lane('b')];
  it('true for a node in a collapsed lane', () => {
    expect(isNodeInCollapsedLane('a', lanes)).toBe(true);
  });
  it('false for a node in an expanded lane', () => {
    expect(isNodeInCollapsedLane('b', lanes)).toBe(false);
  });
  it('false for a node with no lane', () => {
    expect(isNodeInCollapsedLane(undefined, lanes)).toBe(false);
    expect(isNodeInCollapsedLane('', lanes)).toBe(false);
  });
});
