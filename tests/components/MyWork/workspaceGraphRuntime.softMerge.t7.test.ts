/**
 * @vitest-environment jsdom
 *
 * DP-3 (T7 Part C) — degraded→online conflict soft-merge.
 *
 * Before: useWorkspaceGraphRuntime.refresh() (called both on cold mount and
 * on a WS `onConflict` reconnect) unconditionally overwrote local canvas
 * state with the canonical GET response. On a genuine reconnect race — an
 * edit queued in-memory (useIdeaMapSync.queuedPayloadRef) but not yet
 * persisted to localStorage (the draft write is debounced ~800ms) and not
 * yet flushed to the server — that edit was silently discarded.
 *
 * After: refresh() consults the freshest in-memory queued payload
 * (getQueuedPayload(), exposed from useIdeaMapSync) FIRST; only when nothing
 * is queued does it fall back to the existing resolveIdeaMapHydration
 * (localStorage draft) path used for cold hydration. This keeps the
 * hard-toast fallback in useIdeaMapSync (onConflict) but stops the
 * reconnect from clobbering unflushed local edits.
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMyIdeaMap = vi.fn();

vi.mock('@/services/api', () => ({
  Api: {
    getMyIdeaMap: (...a: unknown[]) => getMyIdeaMap(...a),
    syncMyIdeaMap: vi.fn().mockResolvedValue({ version: 1 }),
    createMyIdeaMapSnapshot: vi.fn().mockResolvedValue(null),
  },
}));

import { useWorkspaceGraphRuntime } from '@/components/MyWork/canvas/workspaceGraphRuntime';

describe('useWorkspaceGraphRuntime.refresh — degraded→online soft-merge', () => {
  beforeEach(() => {
    getMyIdeaMap.mockReset();
    try {
      window.localStorage.clear();
    } catch {
      /* ignore */
    }
  });

  it('preserves an unflushed in-memory edit across a reconnect refresh instead of overwriting it with the canonical GET', async () => {
    getMyIdeaMap.mockResolvedValue({
      map: {
        nodes: [{ id: 'server-node' }],
        edges: [],
        extensions: {},
        version: 5,
      },
    });

    const { result } = renderHook(() =>
      useWorkspaceGraphRuntime({
        ideaId: 'idea-softmerge',
        open: true,
        preferredTool: 'mindmap' as any,
        language: 'en',
      })
    );

    // Wait for the initial cold-mount refresh to settle.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.graph.nodes.map((n: any) => n.id)).toEqual(['server-node']);

    // Simulate a local edit that has been queued (in-memory) but not yet
    // flushed to the server and not yet written to localStorage (the
    // <800ms draftMs window from the reload-race bug).
    act(() => {
      result.current.applyGraphMutation((draft) => ({
        ...draft,
        nodes: [...draft.nodes, { id: 'local-pending-node' } as any],
      }));
    });
    expect(result.current.graph.nodes.map((n: any) => n.id)).toEqual([
      'server-node',
      'local-pending-node',
    ]);
    // Confirm nothing reached localStorage yet (draftMs debounce not fired).
    expect(window.localStorage.getItem('consultify.idea-map-sync.idea-softmerge')).toBeNull();

    // Reconnect: gateway/WS onConflict fires → refresh() re-runs against a
    // canonical GET that does NOT yet know about the pending edit.
    getMyIdeaMap.mockResolvedValue({
      map: {
        nodes: [{ id: 'server-node' }],
        edges: [],
        extensions: {},
        version: 5,
      },
    });
    await act(async () => {
      await result.current.refresh();
    });

    // The pending local edit must survive the reconnect — NOT be silently
    // dropped in favor of the (now stale) canonical graph.
    expect(result.current.graph.nodes.map((n: any) => n.id)).toEqual([
      'server-node',
      'local-pending-node',
    ]);
  });

  it('does NOT let a 0-node queued payload clobber a non-empty server map on refresh (M06 bootstrap-wipe regression)', async () => {
    // Live regression (Londyn m06): on mount the mind/idea tool captures its
    // empty initial ReactFlow state (nodes:[]) BEFORE the GET /map resolves, so
    // useIdeaMapSync.queuedPayloadRef holds a 0-node payload. refresh() then
    // trusted that queued payload over the canonical 3-node server graph
    // (DP-3 soft-merge), setting the runtime graph to 0 nodes — which made the
    // mind-map hydrate bootstrap the 6-node starter and sync it back, silently
    // destroying the user's real map. refresh() must ignore an empty queued
    // payload when the server map is non-empty.
    getMyIdeaMap.mockResolvedValue({
      map: {
        nodes: [{ id: 'root', type: 'center' }, { id: 'n1', type: 'idea' }, { id: 'n2', type: 'idea' }],
        edges: [{ id: 'e1', source: 'root', target: 'n1' }, { id: 'e2', source: 'root', target: 'n2' }],
        extensions: {},
        version: 1,
      },
    });

    const { result } = renderHook(() =>
      useWorkspaceGraphRuntime({
        ideaId: 'idea-bootstrap-wipe',
        open: true,
        preferredTool: 'mindmap' as any,
        language: 'en',
      })
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.graph.nodes.map((n: any) => n.id)).toEqual(['root', 'n1', 'n2']);

    // Queue an EMPTY payload (the pre-hydrate empty-capture from the repro).
    act(() => {
      result.current.captureToolGraph({ nodes: [], edges: [] });
    });

    // Reconnect / re-hydrate against the same non-empty canonical server map.
    await act(async () => {
      await result.current.refresh();
    });

    // The real 3-node server graph MUST survive — the 0-node queued payload is
    // refused, so no bootstrap wipe follows.
    expect(result.current.graph.nodes.map((n: any) => n.id)).toEqual(['root', 'n1', 'n2']);
  });

  it('falls back to the plain canonical graph when nothing is queued (today’s behavior preserved)', async () => {
    getMyIdeaMap.mockResolvedValue({
      map: { nodes: [{ id: 'a' }], edges: [], extensions: {}, version: 2 },
    });
    const { result } = renderHook(() =>
      useWorkspaceGraphRuntime({
        ideaId: 'idea-plain',
        open: true,
        preferredTool: 'mindmap' as any,
        language: 'en',
      })
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.graph.nodes.map((n: any) => n.id)).toEqual(['a']);

    getMyIdeaMap.mockResolvedValue({
      map: { nodes: [{ id: 'a' }, { id: 'b' }], edges: [], extensions: {}, version: 3 },
    });
    await act(async () => {
      await result.current.refresh();
    });
    // No local pending edits — refresh reflects the server 1:1.
    expect(result.current.graph.nodes.map((n: any) => n.id)).toEqual(['a', 'b']);
    expect(result.current.graph.version).toBe(3);
  });
});
