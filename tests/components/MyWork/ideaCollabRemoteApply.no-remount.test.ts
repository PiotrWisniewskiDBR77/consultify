/**
 * @vitest-environment jsdom
 *
 * DP-3 (T6) — shared useIdeaCollab remote-apply + graph_version contract.
 *
 * Pins the three invariants of the shared Ideas collab layer
 * (Harvard/wdrozenie-100/_M06_DP3_MULTIPLAYER_PLAN_2026-07-04.md §4):
 *
 *  1. an incoming `graph_patch` is applied through FUNCTIONAL
 *     setNodes/setEdges on the live canvas state and the canvas component is
 *     NOT remounted (hard lesson 26a2a896ef — mount counter stays at 1);
 *  2. an incoming `graph_version` (gateway persisted a live patch into the
 *     canonical row) silently advances the version refs —
 *     useIdeaMapSync.serverVersionRef and useMindMapPersistence's
 *     localVersionRef/lastHydratedRuntimeVersionRef — WITHOUT re-rendering
 *     and WITHOUT re-triggering hydrate() (no re-hydration, no remount);
 *  3. flag OFF ⇒ no graph_version on the wire ⇒ today's behavior verbatim
 *     (unseen version jumps >1 still re-hydrate; patches apply as before).
 */
import { act, render, renderHook, screen } from '@testing-library/react';
import { createElement, useEffect, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const syncMyIdeaMap = vi.fn();
const getMyIdeaMap = vi.fn();
const createMyIdeaMapSnapshot = vi.fn().mockResolvedValue(null);

vi.mock('@/services/api', () => ({
  Api: {
    syncMyIdeaMap: (...a: unknown[]) => syncMyIdeaMap(...a),
    getMyIdeaMap: (...a: unknown[]) => getMyIdeaMap(...a),
    createMyIdeaMapSnapshot: (...a: unknown[]) => createMyIdeaMapSnapshot(...a),
  },
}));
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { useIdeaCollab } from '@/components/MyWork/canvas/useIdeaCollab';
import { useIdeaMapSync } from '@/components/MyWork/canvas/useIdeaMapSync';
import { useMindMapPersistence } from '@/components/MyWork/mindmap/useMindMapPersistence';

const ME = 'user-me';

function emitPatch(
  userId: string,
  operations: Array<{ op: string; data: any }>,
  ideaId?: string
) {
  window.dispatchEvent(
    new CustomEvent('idea-collab-graph-patch', {
      detail: { userId, operations, ...(ideaId ? { ideaId } : {}) },
    })
  );
}

function emitGraphVersion(version: number, ideaId?: string) {
  window.dispatchEvent(
    new CustomEvent('idea-collab-graph-version', {
      detail: { version, ...(ideaId ? { ideaId } : {}) },
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  try {
    window.localStorage.clear();
  } catch {
    /* ignore */
  }
});

// ── 1. remote graph_patch → functional apply, canvas NOT remounted ───────────
describe('useIdeaCollab — remote apply without canvas remount', () => {
  it('applies an incoming graph_patch and keeps the canvas mounted (mount count stays 1)', () => {
    const mountCount = { current: 0 };

    // "Canvas" stand-in: counts real mounts via a []-dep effect.
    const Canvas = ({ nodes }: { nodes: any[] }) => {
      useEffect(() => {
        mountCount.current += 1;
      }, []);
      return createElement(
        'div',
        { 'data-testid': 'canvas' },
        nodes.map((n) => `${n.id}@${n.position?.x ?? '?'}`).join('|')
      );
    };

    const Host = () => {
      const [nodes, setNodes] = useState<any[]>([
        { id: 'root', position: { x: 0, y: 0 }, data: { label: 'Root' } },
      ]);
      const [, setEdges] = useState<any[]>([]);
      useIdeaCollab({
        ideaId: 'idea-1',
        tool: 'mindmap',
        currentUserId: ME,
        setNodes: setNodes as any,
        setEdges: setEdges as any,
      });
      return createElement(Canvas, { nodes });
    };

    render(createElement(Host));
    expect(mountCount.current).toBe(1);

    act(() => {
      emitPatch(
        'user-other',
        [
          { op: 'add_node', data: { id: 'n1', position: { x: 5, y: 5 }, data: { label: 'A' } } },
          { op: 'update_node', data: { id: 'n1', position: { x: 9, y: 9 } } },
        ],
        'idea-1'
      );
    });

    // Node applied via functional setState on live canvas state…
    expect(screen.getByTestId('canvas').textContent).toBe('root@0|n1@9');
    // …and the canvas component was NOT remounted.
    expect(mountCount.current).toBe(1);
  });

  it('ignores own echo, other-idea events; applies untagged events (back-compat)', () => {
    let nodes: any[] = [];
    const setNodes = vi.fn((updater: any) => {
      nodes = typeof updater === 'function' ? updater(nodes) : updater;
    });
    const setEdges = vi.fn();
    renderHook(() =>
      useIdeaCollab({
        ideaId: 'idea-1',
        tool: 'whiteboard',
        currentUserId: ME,
        setNodes: setNodes as any,
        setEdges: setEdges as any,
      })
    );

    // own echo → ignored
    act(() => emitPatch(ME, [{ op: 'add_node', data: { id: 'echo' } }], 'idea-1'));
    expect(nodes).toHaveLength(0);

    // another idea's canvas → ignored
    act(() => emitPatch('u2', [{ op: 'add_node', data: { id: 'foreign' } }], 'idea-OTHER'));
    expect(nodes).toHaveLength(0);

    // untagged (legacy dispatch) → applied
    act(() => emitPatch('u2', [{ op: 'add_node', data: { id: 'n1' } }]));
    expect(nodes.map((n) => n.id)).toEqual(['n1']);

    // idempotent add (no duplicates)
    act(() => emitPatch('u2', [{ op: 'add_node', data: { id: 'n1' } }], 'idea-1'));
    expect(nodes.map((n) => n.id)).toEqual(['n1']);
  });

  it('does not re-broadcast remote-applied ops (echo guard)', async () => {
    const send = vi.fn();
    let latest: any = null;
    const setNodes = vi.fn();
    const setEdges = vi.fn();
    const { result } = renderHook(() => {
      latest = useIdeaCollab({
        ideaId: 'idea-1',
        currentUserId: ME,
        setNodes: setNodes as any,
        setEdges: setEdges as any,
      });
      return latest;
    });
    act(() => result.current.registerCollabSend(send));

    act(() => {
      emitPatch('u2', [{ op: 'add_node', data: { id: 'n1' } }], 'idea-1');
      // While the remote patch is applied (same tick), local broadcasts are muted.
      latest.broadcastGraphPatch([{ op: 'add_node', data: { id: 'n1' } }]);
    });
    expect(send).not.toHaveBeenCalled();

    // The guard releases on the next tick — then local broadcasts flow again.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      latest.broadcastGraphPatch([{ op: 'add_node', data: { id: 'n2' } }]);
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'graph_patch',
        operations: [{ op: 'add_node', data: { id: 'n2' } }],
      })
    );
  });
});

// ── 2. graph_version → silent serverVersionRef adoption (useIdeaMapSync) ─────
describe('useIdeaMapSync — graph_version adopts the canonical version silently', () => {
  it('updates serverVersionRef without re-rendering; next flush uses the fresh baseVersion', async () => {
    syncMyIdeaMap.mockResolvedValue({ version: 10 });
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useIdeaMapSync({ ideaId: 'gv-idea', tool: 'mindmap', open: true });
    });
    const rendersBefore = renders;

    act(() => emitGraphVersion(9, 'gv-idea'));

    // Ref advanced…
    expect(result.current.currentVersionRef.current).toBe(9);
    // …with ZERO re-renders (no state touched → no re-hydration, no remount).
    expect(renders).toBe(rendersBefore);

    // The next POST /map/sync sends the adopted baseVersion (no spurious 409).
    // Non-empty payload: a 0-node flush before the map has ever hydrated is
    // correctly refused by the anti-wipe guard (26a2a896ef class bug) — that
    // guard is a separate, deliberate invariant, not what this test pins.
    await act(async () => {
      await result.current.flushNow(
        { nodes: [{ id: 'n1', type: 'idea', position: { x: 0, y: 0 }, data: {} }], edges: [] },
        { reason: 'manual' }
      );
    });
    expect(syncMyIdeaMap.mock.calls[0]).toBeDefined();
    const [, body] = syncMyIdeaMap.mock.calls[0];
    expect(body.baseVersion).toBe(9);
  });

  it('ignores versions for another idea and stale/backwards versions', () => {
    const { result } = renderHook(() =>
      useIdeaMapSync({ ideaId: 'gv-idea-2', tool: 'whiteboard', open: true })
    );

    act(() => emitGraphVersion(7, 'someone-elses-idea'));
    expect(result.current.currentVersionRef.current).toBe(1);

    act(() => emitGraphVersion(3, 'gv-idea-2'));
    expect(result.current.currentVersionRef.current).toBe(3);

    act(() => emitGraphVersion(2, 'gv-idea-2'));
    expect(result.current.currentVersionRef.current).toBe(3);
  });
});

// ── 3. graph_version → NO re-hydration of the mind map ───────────────────────
describe('useMindMapPersistence — live-seen versions never re-hydrate the canvas', () => {
  const runtimeNodes = [
    { id: 'root', type: 'center', position: { x: 0, y: 0 }, data: { label: 'T' } },
    { id: 'n-a', type: 'branch', position: { x: 10, y: 10 }, data: { label: 'A' } },
  ];

  function makeOpts(shared: { setNodes: any; setEdges: any }, version: number) {
    return {
      ideaId: 'mm-idea',
      ideaTitle: 'T',
      isPolish: false,
      locked: false,
      i18nLanguage: 'en',
      nodes: [] as any[],
      edges: [] as any[],
      setNodes: shared.setNodes,
      setEdges: shared.setEdges,
      setCollapsedNodeIds: vi.fn(),
      collapsedNodeIds: new Set<string>(),
      fitView: vi.fn(),
      setViewport: vi.fn(),
      getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
      clearUndoHistory: vi.fn(),
      externalRuntime: {
        version,
        loading: false,
        saving: false,
        lastSavedAt: null,
        syncState: 'idle' as const,
        nodes: runtimeNodes as any[],
        edges: [{ id: 'e1', source: 'root', target: 'n-a' }] as any[],
        extensions: {} as Record<string, unknown>,
        captureGraph: vi.fn(),
        flushGraph: vi.fn().mockResolvedValue(null),
        refresh: vi.fn().mockResolvedValue(undefined),
      },
    };
  }

  it('a runtimeVersion jump already seen via graph_version does NOT re-trigger hydrate()', () => {
    const shared = { setNodes: vi.fn(), setEdges: vi.fn() };
    const { rerender } = renderHook((props: any) => useMindMapPersistence(props), {
      initialProps: makeOpts(shared, 2),
    });
    const callsAfterMount = shared.setNodes.mock.calls.length;
    expect(callsAfterMount).toBeGreaterThan(0); // initial hydration happened

    // Live patches were applied to the canvas; gateway confirms version 6.
    act(() => emitGraphVersion(6, 'mm-idea'));

    // Runtime state later catches up to v6 (e.g. flush response) — a >1 jump.
    act(() => rerender(makeOpts(shared, 6)));

    // NO re-hydration: setNodes was not called again (canvas untouched).
    expect(shared.setNodes.mock.calls.length).toBe(callsAfterMount);
  });

  it('control (flag OFF ⇒ no graph_version): an unseen >1 jump still re-hydrates', () => {
    const shared = { setNodes: vi.fn(), setEdges: vi.fn() };
    const { rerender } = renderHook((props: any) => useMindMapPersistence(props), {
      initialProps: makeOpts(shared, 2),
    });
    const callsAfterMount = shared.setNodes.mock.calls.length;

    // No graph_version seen — external change detection must keep working.
    act(() => rerender(makeOpts(shared, 6)));

    expect(shared.setNodes.mock.calls.length).toBeGreaterThan(callsAfterMount);
  });

  it('ignores graph_version for another idea (would-be jump still re-hydrates)', () => {
    const shared = { setNodes: vi.fn(), setEdges: vi.fn() };
    const { rerender } = renderHook((props: any) => useMindMapPersistence(props), {
      initialProps: makeOpts(shared, 2),
    });
    const callsAfterMount = shared.setNodes.mock.calls.length;

    act(() => emitGraphVersion(6, 'a-different-idea'));
    act(() => rerender(makeOpts(shared, 6)));

    expect(shared.setNodes.mock.calls.length).toBeGreaterThan(callsAfterMount);
  });
});
