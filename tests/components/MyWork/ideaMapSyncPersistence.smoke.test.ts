/**
 * @vitest-environment jsdom
 *
 * Idea map-sync persistence — smoke (WS-02). Covers the shared save layer that
 * Mind Map AND Whiteboard (and Table) all persist through:
 * `POST /my-work/my-ideas/:id/map/sync` via Api.syncMyIdeaMap.
 *
 * Pins the production-critical round-trip:
 *   queueSync(payload) → flushNow() → syncMyIdeaMap called with the tool's
 *   payload + baseVersion; server version is adopted; state → 'saved'.
 * Plus 409 conflict handling and offline degradation (no throw escapes state).
 * Plus L-03 (shared version registry across tools) and L-04 (unmount draft persist).
 *
 * Parametrised over 'mindmap' and 'whiteboard' so both surfaces are exercised.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import { readIdeaMapDraft, useIdeaMapSync } from '@/components/MyWork/canvas/useIdeaMapSync';

const TOOLS = ['mindmap', 'whiteboard'] as const;

describe.each(TOOLS)('useIdeaMapSync persistence [%s]', (tool) => {
  beforeEach(() => {
    vi.clearAllMocks();
    try {
      window.localStorage.clear();
    } catch {
      /* ignore */
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('flushNow round-trips the payload and adopts the server version', async () => {
    syncMyIdeaMap.mockResolvedValue({ version: 7 });
    const { result } = renderHook(() => useIdeaMapSync({ ideaId: 'idea-1', tool, open: true }));

    const payload = {
      nodes: [{ id: 'n1', data: { label: 'A' } }],
      edges: [],
      preferredTool: tool,
    };

    await act(async () => {
      await result.current.flushNow(payload, { reason: 'manual' });
    });

    expect(syncMyIdeaMap).toHaveBeenCalledTimes(1);
    const [id, body] = syncMyIdeaMap.mock.calls[0];
    expect(id).toBe('idea-1');
    expect(body.nodes).toEqual(payload.nodes);
    expect(body.preferredTool).toBe(tool);
    expect(body.baseVersion).toBeGreaterThanOrEqual(1);
    expect(result.current.syncState).toBe('saved');
    expect(result.current.currentVersionRef.current).toBe(7);
  });

  it('does not save when locked', async () => {
    const { result } = renderHook(() =>
      useIdeaMapSync({ ideaId: 'idea-1', tool, open: true, locked: true })
    );
    await act(async () => {
      await result.current.flushNow({ nodes: [], edges: [] }, { reason: 'manual' });
    });
    expect(syncMyIdeaMap).not.toHaveBeenCalled();
  });

  it('surfaces a 409 as conflict state and reports the server version', async () => {
    const err: any = new Error('conflict');
    err.status = 409;
    err.data = { currentVersion: 12 };
    syncMyIdeaMap.mockRejectedValue(err);

    const onConflict = vi.fn();
    const { result } = renderHook(() =>
      useIdeaMapSync({ ideaId: 'idea-1', tool, open: true, onConflict })
    );

    await act(async () => {
      await result.current
        .flushNow({ nodes: [{ id: 'root' }], edges: [] }, { reason: 'manual' })
        .catch(() => {});
    });

    expect(result.current.syncState).toBe('conflict');
    expect(onConflict).toHaveBeenCalledWith(12, null);
  });

  it('degrades to offline when navigator is offline', async () => {
    const onLineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    syncMyIdeaMap.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useIdeaMapSync({ ideaId: 'idea-1', tool, open: true }));

    await act(async () => {
      await result.current
        .flushNow({ nodes: [{ id: 'root' }], edges: [] }, { reason: 'manual' })
        .catch(() => {});
    });

    expect(result.current.syncState).toBe('offline');
    onLineSpy.mockRestore();
  });
});

// ── L-03: shared version registry across tools ────────────────────────────────
describe('L-03 — cross-tool version sharing (same ideaId)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    try { window.localStorage.clear(); } catch { /* ignore */ }
  });

  it('second tool instance inherits version bumped by the first tool', async () => {
    syncMyIdeaMap.mockResolvedValue({ version: 5 });

    // First tool saves and bumps to v5
    const { result: hookA, unmount: unmountA } = renderHook(() =>
      useIdeaMapSync({ ideaId: 'l03-idea', tool: 'mindmap', open: true })
    );
    await act(async () => {
      hookA.current.primeServerVersion(4);
      await hookA.current.flushNow({ nodes: [{ id: 'root' }], edges: [] }, { reason: 'manual' });
    });
    expect(hookA.current.currentVersionRef.current).toBe(5);
    unmountA();

    // Second tool (different tool type, same ideaId) starts at v5, NOT v1
    const { result: hookB } = renderHook(() =>
      useIdeaMapSync({ ideaId: 'l03-idea', tool: 'whiteboard', open: true })
    );
    expect(hookB.current.currentVersionRef.current).toBe(5);

    // When it saves, baseVersion sent to server is 5 (not 1)
    syncMyIdeaMap.mockResolvedValue({ version: 6 });
    await act(async () => {
      hookB.current.primeServerVersion(5);
      await hookB.current.flushNow({ nodes: [{ id: 'root' }], edges: [] }, { reason: 'manual' });
    });
    const [, body] = syncMyIdeaMap.mock.calls[syncMyIdeaMap.mock.calls.length - 1];
    expect(body.baseVersion).toBe(5); // not 1 — no spurious 409
  });
});

// ── L-04: persist queued payload on unmount ───────────────────────────────────
describe('L-04 — unmount persists queued payload to localStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    try { window.localStorage.clear(); } catch { /* ignore */ }
  });

  it('writes pending draft to localStorage when component unmounts with queued changes', async () => {
    syncMyIdeaMap.mockResolvedValue({ version: 1 });

    const payload = { nodes: [{ id: 'n1', data: { label: 'Draft node' } }], edges: [] };
    const { result, unmount } = renderHook(() =>
      useIdeaMapSync({ ideaId: 'l04-idea', tool: 'mindmap', open: true })
    );

    // Queue a sync (sets queuedPayloadRef immediately, timer fires after 60s)
    act(() => { result.current.queueSync(payload); });

    // Unmount before the 60s timer fires
    unmount();

    // Draft must have been written to localStorage
    const draft = readIdeaMapDraft('l04-idea');
    expect(draft).not.toBeNull();
    expect(draft!.pending).toBe(true);
    expect(draft!.payload.nodes).toEqual(payload.nodes);
    expect(draft!.tool).toBe('mindmap');
  });

  it('does NOT write to localStorage when there is no queued payload on unmount', () => {
    const { unmount } = renderHook(() =>
      useIdeaMapSync({ ideaId: 'l04-clean-idea', tool: 'mindmap', open: true })
    );
    unmount();
    const draft = readIdeaMapDraft('l04-clean-idea');
    expect(draft).toBeNull(); // nothing queued → nothing written
  });
});

// ── L-05: teardown flush uses fetch keepalive (survives page unload) ───────────
describe('L-05 — teardown flush is sent with keepalive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    try { window.localStorage.clear(); } catch { /* ignore */ }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('flushNow forwards keepalive to Api.syncMyIdeaMap when requested', async () => {
    syncMyIdeaMap.mockResolvedValue({ version: 2 });
    const { result } = renderHook(() =>
      useIdeaMapSync({ ideaId: 'l05-idea', tool: 'mindmap', open: true })
    );

    await act(async () => {
      await result.current.flushNow(
        { nodes: [{ id: 'n1', data: {} }], edges: [] },
        { reason: 'draft', keepalive: true }
      );
    });

    const [, body] = syncMyIdeaMap.mock.calls[0];
    expect(body.keepalive).toBe(true);
  });

  it('visibilitychange→hidden flushes a queued payload with keepalive', async () => {
    syncMyIdeaMap.mockResolvedValue({ version: 2 });
    const { result } = renderHook(() =>
      useIdeaMapSync({ ideaId: 'l05-vis-idea', tool: 'mindmap', open: true })
    );

    act(() => {
      result.current.queueSync({ nodes: [{ id: 'n1', data: {} }], edges: [] });
    });

    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    expect(syncMyIdeaMap).toHaveBeenCalled();
    const [, body] = syncMyIdeaMap.mock.calls[syncMyIdeaMap.mock.calls.length - 1];
    expect(body.keepalive).toBe(true);
  });

  it('beforeunload flushes a queued payload with keepalive', async () => {
    syncMyIdeaMap.mockResolvedValue({ version: 2 });
    const { result } = renderHook(() =>
      useIdeaMapSync({ ideaId: 'l05-unload-idea', tool: 'mindmap', open: true })
    );

    act(() => {
      result.current.queueSync({ nodes: [{ id: 'n1', data: {} }], edges: [] });
    });

    await act(async () => {
      window.dispatchEvent(new Event('beforeunload'));
      await Promise.resolve();
    });

    expect(syncMyIdeaMap).toHaveBeenCalled();
    const [, body] = syncMyIdeaMap.mock.calls[syncMyIdeaMap.mock.calls.length - 1];
    expect(body.keepalive).toBe(true);
  });
});
