/**
 * @vitest-environment jsdom
 *
 * MM-P1-01 (2026-08-10) — Mind Map could end up with TWO blank inline
 * editors open at once when "Add sibling" is invoked via mixed
 * pointer/keyboard sequences.
 *
 * Root cause (confirmed by reading every real call site, not the audit
 * plan's guess): `addSiblingNode` (this file) is already the single
 * function every "Add sibling" surface converges on — the registry-routed
 * PPM item in NodeContextMenu.tsx, FloatingNodeToolbar's button (direct
 * prop call, no registry involved), the raw canvas Enter-key shortcut in
 * IdeaRecommendationMap.tsx, the inline hover "+" quick action, and the
 * `mm_add_sibling` bus event via useMindMapQuickActions — all end up
 * calling this exact closure. But the function itself had NO reentrancy
 * guard: every call unconditionally created a brand-new node and flagged
 * it `_startEditing`. Only the raw keyboard handler checked
 * `editingNodeIdRef` before calling in; FloatingNodeToolbar's button (a
 * pointer path) never did. Two calls landing close together — e.g. a
 * pointer click racing the Enter-key shortcut — each created their own
 * blank node, and since each mind-map node opens its own inline editor
 * independently (a per-node effect watching `data._startEditing`), two
 * calls meant two simultaneously open editors.
 *
 * This test drives the same underlying command (`addSiblingNode`) that
 * every surface calls, back to back inside one `act()` — the same shape as
 * a pointer click racing a keyboard Enter before React has flushed the
 * first call's `editingNodeIdRef`/state — and asserts exactly one new node
 * is created. A second block proves the fix does not suppress a
 * legitimate, separate follow-up insert once the first one's editor has
 * actually closed.
 */
import { act, render } from '@testing-library/react';
import React, { useState } from 'react';
import type { Edge, Node } from 'reactflow';
import { describe, expect, it, vi } from 'vitest';

import { useMindMapNodes } from '../useMindMapNodes';

type Api = ReturnType<typeof useMindMapNodes> & {
  getNodes: () => Node[];
  /**
   * Mirrors what IdeaRecommendationMap.tsx's `idea-mindmap-node-edit`
   * listener does when a pending node's editor is committed/cancelled:
   * clears `data._startEditing` on the pending node AND resets
   * `editingNodeIdRef` to null. Needed here because that listener lives in
   * the (much larger) canvas component, not in this hook — this harness
   * only exercises the hook, so the "editor closed" transition has to be
   * simulated explicitly rather than relying on a real DOM event listener
   * that isn't mounted in this test.
   */
  closePendingEditor: () => void;
};

function makeInitialGraph(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      { id: 'root', type: 'idea', position: { x: 0, y: 0 }, data: { label: 'Root' } } as any,
      {
        id: 'child-1',
        type: 'idea',
        position: { x: 220, y: 0 },
        data: { label: 'Child 1' },
        selected: true,
      } as any,
    ],
    edges: [
      {
        id: 'e-root-child-1',
        source: 'root',
        target: 'child-1',
        data: { edgeRole: 'structural' },
      } as any,
    ],
  };
}

function Harness({ onReady }: { onReady: (api: Api) => void }) {
  const initial = React.useRef(makeInitialGraph());
  const [nodes, setNodes] = useState<Node[]>(initial.current.nodes);
  const [edges, setEdges] = useState<Edge[]>(initial.current.edges);

  const api = useMindMapNodes({
    nodes,
    edges,
    setNodes,
    setEdges,
    locked: false,
    isPolish: false,
    pushUndo: () => {},
    fitView: () => true,
    remoteLockedNodeIds: new Set(),
  });

  const closePendingEditor = () => {
    // Capture the pending id BEFORE clearing the ref: `setNodes` here takes a
    // functional updater, which React only invokes later (during the render
    // phase) — reading `api.editingNodeIdRef.current` lazily *inside* that
    // updater would see it already reset to null by the synchronous line
    // below, and silently clear nothing.
    const pendingId = api.editingNodeIdRef.current;
    setNodes((prev) =>
      prev.map((n) =>
        n.id === pendingId ? { ...n, data: { ...(n.data as any), _startEditing: undefined } } : n
      )
    );
    api.editingNodeIdRef.current = null;
  };

  onReady({ ...api, getNodes: () => nodes, closePendingEditor });
  return null;
}

describe('useMindMapNodes — addSiblingNode reentrancy guard (MM-P1-01)', () => {
  it('two calls landing in the same tick (pointer racing keyboard) create exactly one new node/editor', () => {
    vi.useFakeTimers();
    try {
      let api: Api | null = null;
      render(<Harness onReady={(a) => (api = a)} />);
      expect(api).not.toBeNull();

      const before = api!.getNodes().length;

      // Simulates a pointer click on FloatingNodeToolbar's "Add sibling"
      // button racing the canvas Enter-key shortcut: both ultimately call
      // this exact function, back to back, before React has re-rendered.
      act(() => {
        api!.addSiblingNode('child-1');
        api!.addSiblingNode('child-1');
      });

      // Without the guard, the second call's setNodes(array) overwrites the
      // first call's in-memory state (both compute from the same stale
      // `nodes` closure), but `ensureCreatedNodePersists`'s 200ms recovery
      // timer then re-inserts the "missing" first node — the true
      // steady-state bug is two persisted, both-`_startEditing` nodes once
      // this timer fires, not just the immediate synchronous result.
      act(() => {
        vi.advanceTimersByTime(250);
      });

      const after = api!.getNodes();
      expect(after.length).toBe(before + 1);

      const editingNodes = after.filter((n) => (n.data as any)?._startEditing);
      expect(editingNodes.length).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('20 rapid alternating same-tick pairs never leave more than one node mid-edit', () => {
    let api: Api | null = null;
    render(<Harness onReady={(a) => (api = a)} />);
    expect(api).not.toBeNull();

    for (let i = 0; i < 20; i++) {
      act(() => {
        // Alternate call order to mirror "mixed pointer/keyboard sequences"
        // in both directions.
        if (i % 2 === 0) {
          api!.addSiblingNode('child-1');
          api!.addSiblingNode('child-1');
        } else {
          api!.addSiblingNode();
          api!.addSiblingNode('child-1');
        }
      });

      const editingNodes = api!.getNodes().filter((n) => (n.data as any)?._startEditing);
      expect(editingNodes.length).toBeLessThanOrEqual(1);

      // Close out this trial's editor (commit) before the next iteration,
      // exactly like a user finishing one insert before starting the next —
      // clears the node's `_startEditing` flag and `editingNodeIdRef` so the
      // next iteration is a legitimate, unblocked follow-up insert, not
      // another reentrant call.
      act(() => {
        api!.closePendingEditor();
      });
    }
  });

  it('does not suppress a legitimate follow-up insert once the previous editor has closed', () => {
    let api: Api | null = null;
    render(<Harness onReady={(a) => (api = a)} />);
    expect(api).not.toBeNull();

    const before = api!.getNodes().length;

    act(() => {
      api!.addSiblingNode('child-1');
    });
    expect(api!.getNodes().length).toBe(before + 1);

    // The pending node's editor closes (commit/cancel) — the real app does
    // this via the `idea-mindmap-node-edit` listener in
    // IdeaRecommendationMap.tsx, which always clears editingNodeIdRef.
    act(() => {
      api!.closePendingEditor();
    });

    // A second, separate insert must NOT be swallowed by the guard.
    act(() => {
      api!.addSiblingNode('child-1');
    });
    expect(api!.getNodes().length).toBe(before + 2);
  });
});
