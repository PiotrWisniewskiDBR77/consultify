/**
 * M06 Fala 3.1 — align/distribute + snap.
 * Pure-geometry coverage for computeAlignDistribute (all 6 align + 2 distribute
 * modes, ≥2/≥3 selection guards, locked-node exclusion, idempotent no-op) plus
 * the mindmapAlignSnap flag registration (OFF by default).
 */
import { describe, expect, it } from 'vitest';

import {
  type AlignMode,
  type AlignNode,
  computeAlignDistribute,
  isDistributeMode,
} from '@/components/MyWork/mindmap/alignDistribute';
import { DEFAULT_FLAGS } from '@/hooks/useFeatureFlags';

function node(
  id: string,
  x: number,
  y: number,
  w = 100,
  h = 40,
  extra: Partial<AlignNode> = {}
): AlignNode {
  return { id, position: { x, y }, width: w, height: h, ...extra };
}

// Build a lookup of {id -> {x,y}} from patches for concise assertions.
function posMap(patches: { id: string; position: { x: number; y: number } }[]) {
  return Object.fromEntries(patches.map((p) => [p.id, p.position]));
}

describe('mindmapAlignSnap flag definition', () => {
  it('is registered and OFF by default', () => {
    const flag = DEFAULT_FLAGS.find((f) => f.id === 'mindmapAlignSnap');
    expect(flag).toBeTruthy();
    expect(flag?.defaultValue).toBe(false);
    expect(flag?.allowLocalOverride).toBe(true);
  });
});

describe('isDistributeMode', () => {
  it('classifies distribute vs align modes', () => {
    expect(isDistributeMode('distribute-h')).toBe(true);
    expect(isDistributeMode('distribute-v')).toBe(true);
    expect(isDistributeMode('align-left')).toBe(false);
    expect(isDistributeMode('align-middle-v')).toBe(false);
  });
});

describe('computeAlignDistribute — selection guards', () => {
  it('returns [] for align modes with <2 nodes', () => {
    expect(computeAlignDistribute([node('a', 0, 0)], 'align-left')).toEqual([]);
  });

  it('returns [] for distribute modes with <3 nodes', () => {
    const two = [node('a', 0, 0), node('b', 200, 0)];
    expect(computeAlignDistribute(two, 'distribute-h')).toEqual([]);
    expect(computeAlignDistribute(two, 'distribute-v')).toEqual([]);
  });

  it('allows align with exactly 2 and distribute with exactly 3', () => {
    // a & b differ in y, so align-top actually moves b.
    const two = [node('a', 0, 0), node('b', 50, 80)];
    expect(computeAlignDistribute(two, 'align-top').length).toBeGreaterThan(0);
    const three = [node('a', 0, 0), node('b', 500, 0), node('c', 90, 0)];
    expect(computeAlignDistribute(three, 'distribute-h').length).toBeGreaterThan(0);
  });
});

describe('computeAlignDistribute — align modes', () => {
  const nodes = [node('a', 0, 0, 100, 40), node('b', 50, 100, 60, 40), node('c', 200, 200, 100, 40)];

  it('align-left snaps every left edge to the minimum left (a already there → no-op)', () => {
    const m = posMap(computeAlignDistribute(nodes, 'align-left'));
    expect(m.a).toBeUndefined(); // a already at x=0
    expect(m.b.x).toBe(0);
    expect(m.c.x).toBe(0);
    // y untouched
    expect(m.c.y).toBe(200);
  });

  it('align-right snaps every right edge to the maximum right (c already there → no-op)', () => {
    // max right = 200 + 100 = 300
    const m = posMap(computeAlignDistribute(nodes, 'align-right'));
    expect(m.a.x).toBe(300 - 100);
    expect(m.b.x).toBe(300 - 60);
    expect(m.c).toBeUndefined(); // c already at right=300
  });

  it('align-center-h centers every node on the mean center x', () => {
    // centers: a=50, b=80, c=250 → mean=380/3≈126.67
    const m = posMap(computeAlignDistribute(nodes, 'align-center-h'));
    const meanCx = (50 + 80 + 250) / 3;
    expect(m.a.x).toBe(Math.round(meanCx - 50));
    expect(m.b.x).toBe(Math.round(meanCx - 30));
    expect(m.c.x).toBe(Math.round(meanCx - 50));
  });

  it('align-top snaps every top to the minimum top (a already there → no-op)', () => {
    const m = posMap(computeAlignDistribute(nodes, 'align-top'));
    // a is already at y=0 so it emits no patch; b & c move to 0.
    expect(m.a).toBeUndefined();
    expect(m.b.y).toBe(0);
    expect(m.c.y).toBe(0);
    expect(m.c.x).toBe(200); // x untouched
  });

  it('align-bottom snaps every bottom to the maximum bottom (c already there → no-op)', () => {
    // max bottom = 200 + 40 = 240 → target top = 200
    const m = posMap(computeAlignDistribute(nodes, 'align-bottom'));
    expect(m.a.y).toBe(200);
    expect(m.b.y).toBe(200);
    expect(m.c).toBeUndefined(); // c already at y=200
  });

  it('align-middle-v centers every node on the mean center y (b already there → no-op)', () => {
    // centers: a=20, b=120, c=220 → mean=120 → target top=100
    const m = posMap(computeAlignDistribute(nodes, 'align-middle-v'));
    expect(m.a.y).toBe(100);
    expect(m.b).toBeUndefined(); // b already at y=100
    expect(m.c.y).toBe(100);
  });
});

describe('computeAlignDistribute — distribute modes', () => {
  it('distribute-h equalizes horizontal gaps, extremes fixed', () => {
    // three equal 100-wide boxes; left at 0, 500, 90 → sorted a(0),c(90),b(500)
    const nodes = [node('a', 0, 0, 100), node('b', 500, 0, 100), node('c', 90, 0, 100)];
    const m = posMap(computeAlignDistribute(nodes, 'distribute-h'));
    // span = 600-0 = 600; totalW=300; gap=(600-300)/2=150
    // a at 0, c at 0+100+150=250, b at 250+100+150=500
    expect(m.a?.x ?? 0).toBe(0); // extreme unchanged → possibly no patch
    expect(m.c.x).toBe(250);
    expect(m.b?.x ?? 500).toBe(500);
  });

  it('distribute-v equalizes vertical gaps', () => {
    const nodes = [node('a', 0, 0, 100, 40), node('b', 0, 500, 100, 40), node('c', 0, 70, 100, 40)];
    const m = posMap(computeAlignDistribute(nodes, 'distribute-v'));
    // span=540-0=540; totalH=120; gap=(540-120)/2=210
    // a at 0, c at 0+40+210=250, b at 250+40+210=500
    expect(m.c.y).toBe(250);
  });
});

describe('computeAlignDistribute — locked nodes and idempotency', () => {
  it('excludes locked nodes from movement and reference', () => {
    const nodes = [
      node('a', 0, 0, 100, 40),
      node('b', 300, 0, 100, 40, { data: { locked: true } }),
      node('c', 50, 0, 100, 40),
    ];
    const m = posMap(computeAlignDistribute(nodes, 'align-left'));
    // Only a & c movable; min left among them = 0
    expect(m.b).toBeUndefined(); // locked, never moved
    expect(m.c.x).toBe(0);
  });

  it('drops to a no-op when locked nodes leave fewer than the mode needs', () => {
    const nodes = [node('a', 0, 0, 100, 40, { data: { locked: true } }), node('b', 50, 0)];
    expect(computeAlignDistribute(nodes, 'align-left')).toEqual([]);
  });

  it('returns [] (no-op) when everything is already aligned', () => {
    const nodes = [node('a', 0, 0), node('b', 0, 100)];
    expect(computeAlignDistribute(nodes, 'align-left')).toEqual([]);
  });

  it('only emits patches for nodes that actually move', () => {
    const nodes = [node('a', 0, 0), node('b', 40, 0), node('c', 0, 200)];
    const patches = computeAlignDistribute(nodes, 'align-left');
    // a and c already at x=0 → unchanged; only b moves
    const ids = patches.map((p) => p.id).sort();
    expect(ids).toEqual(['b']);
  });

  it('handles unmeasured nodes via the nominal 160x48 fallback box', () => {
    const nodes: AlignNode[] = [
      { id: 'a', position: { x: 0, y: 0 } },
      { id: 'b', position: { x: 0, y: 100 } },
      { id: 'c', position: { x: 30, y: 0 } },
    ];
    // align-right: right = x + 160. max right = 30+160=190 → a,b move to 30
    const m = posMap(computeAlignDistribute(nodes, 'align-right'));
    expect(m.a.x).toBe(30);
    expect(m.b.x).toBe(30);
  });
});

// Type-level smoke: every AlignMode is handled (compile-time exhaustiveness).
const _allModes: AlignMode[] = [
  'align-left',
  'align-center-h',
  'align-right',
  'align-top',
  'align-middle-v',
  'align-bottom',
  'distribute-h',
  'distribute-v',
];
void _allModes;
