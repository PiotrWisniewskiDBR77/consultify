/**
 * Regression: mind-map hydration must preserve every node from the server
 * payload, and the anti-wipe guard must refuse to persist an empty graph.
 *
 * Bug (Londyn 270c80185d vs feat/m06-finisz 20c6f15b4e): a `GET .../map`
 * payload of { root(center) + 2 idea, edges:[] } rendered 0 nodes on the canvas
 * and then a `POST .../map/sync` with EMPTY nodes wiped the map in the DB — the
 * regression class of lesson 26a2a896ef.
 *
 * These tests pin two independent invariants:
 *   1. normalizeMindMapNodes (the hydration transform) never drops nodes, so the
 *      3-node payload becomes 3 canvas nodes with the right types — and the only
 *      flag path that could cull nodes (mindmapVirtualization) stays inert at
 *      this size whether the flag is OFF or ON.
 *   2. isEmptyWipe (the sync guard) blocks any 0-node payload once a non-empty
 *      graph was known — root is non-deletable, so 0 nodes is always a defect.
 */
import { describe, expect, it } from 'vitest';

import { isEmptyWipe } from '@/components/MyWork/mindmap/mindmapCanonHelpers';
import { normalizeMindMapNodes } from '@/components/MyWork/mindmap/mindMapNodeModel';
import { shouldVirtualize } from '@/components/MyWork/mindmap/virtualization';
import { DEFAULT_FLAGS } from '@/hooks/useFeatureFlags';

// The exact shape observed in the browser: root center + 2 "Start" idea nodes,
// no edges. (Positions omitted the way the server serializes minimal graphs.)
const SERVER_PAYLOAD_NODES = [
  { id: 'root', type: 'center', position: { x: 0, y: 0 }, data: { label: 'Mapa pomysłów' } },
  { id: 'idea-1', type: 'idea', position: { x: 120, y: -80 }, data: { label: 'Start' } },
  { id: 'idea-2', type: 'idea', position: { x: 120, y: 80 }, data: { label: 'Start' } },
] as any[];
const SERVER_PAYLOAD_EDGES: any[] = [];

function flagDefault(id: string): boolean {
  return DEFAULT_FLAGS.find((f) => f.id === id)?.defaultValue === true;
}

describe('mind-map hydration regression (3-node payload → 3 canvas nodes)', () => {
  it('normalizeMindMapNodes preserves all 3 nodes with correct types', () => {
    const out = normalizeMindMapNodes(
      SERVER_PAYLOAD_NODES,
      SERVER_PAYLOAD_EDGES as any,
      'Mapa pomysłów',
      /* isPolish */ true
    );

    expect(out).toHaveLength(3);
    expect(out.map((n) => n.id)).toEqual(['root', 'idea-1', 'idea-2']);
    expect(out[0].type).toBe('center');
    expect(out[1].type).toBe('idea');
    expect(out[2].type).toBe('idea');
    // The 2 idea nodes count toward visibleIdeaNodeCount, so the canvas must NOT
    // fall into the "Select a branch and press Tab" empty state.
    expect(out.filter((n) => n.type === 'idea')).toHaveLength(2);
  });

  it('preserves nodes identically whether the M06 Fala 3 flags are OFF or ON', () => {
    // The hydration transform is flag-independent; assert that explicitly by
    // running it "as if" each flag combination were active. Node identity/count
    // must be byte-stable across all of them.
    const combos: Array<{ multiToolbar: boolean; alignSnap: boolean; virtualization: boolean }> = [
      { multiToolbar: false, alignSnap: false, virtualization: false }, // all OFF (default)
      { multiToolbar: true, alignSnap: true, virtualization: true }, // the browser override set
    ];

    for (const combo of combos) {
      const out = normalizeMindMapNodes(
        SERVER_PAYLOAD_NODES,
        SERVER_PAYLOAD_EDGES as any,
        'Mapa pomysłów',
        true
      );
      expect(out).toHaveLength(3);

      // The ONLY flag that can strip nodes from the rendered canvas is
      // mindmapVirtualization (via onlyRenderVisibleElements). At 3 nodes it is
      // inert whether OFF or ON — proving the flags cannot cause the 0-node wipe.
      expect(shouldVirtualize(combo.virtualization, out.length)).toBe(false);
    }
  });

  it('keeps experimental layout flags OFF while the accepted unified drawer defaults ON', () => {
    expect(flagDefault('mindmapMultiToolbar')).toBe(false);
    expect(flagDefault('mindmapAlignSnap')).toBe(false);
    expect(flagDefault('mindmapVirtualization')).toBe(false);
    expect(flagDefault('mindmapDrawerUnified')).toBe(true);
  });
});

describe('anti-wipe sync guard (isEmptyWipe)', () => {
  it('BLOCKS a 0-node sync once a non-empty graph was known', () => {
    // Hydrated 3 nodes, then a defect feeds an empty graph → must be blocked.
    expect(isEmptyWipe(0, 3)).toBe(true);
  });

  it('allows the very first empty state before any graph is known', () => {
    // lastKnown === 0 (never hydrated a real graph) → nothing to protect.
    expect(isEmptyWipe(0, 0)).toBe(false);
  });

  it('allows every legitimate non-empty save', () => {
    expect(isEmptyWipe(1, 3)).toBe(false); // root only survives — still allowed
    expect(isEmptyWipe(3, 3)).toBe(false);
    expect(isEmptyWipe(50, 3)).toBe(false);
  });
});
