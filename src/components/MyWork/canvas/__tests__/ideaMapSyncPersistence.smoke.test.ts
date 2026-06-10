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

import { useIdeaMapSync } from '../useIdeaMapSync';

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
      await result.current.flushNow({ nodes: [], edges: [] }, { reason: 'manual' }).catch(() => {});
    });

    expect(result.current.syncState).toBe('conflict');
    expect(onConflict).toHaveBeenCalledWith(12, null);
  });

  it('degrades to offline when navigator is offline', async () => {
    const onLineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    syncMyIdeaMap.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useIdeaMapSync({ ideaId: 'idea-1', tool, open: true }));

    await act(async () => {
      await result.current.flushNow({ nodes: [], edges: [] }, { reason: 'manual' }).catch(() => {});
    });

    expect(result.current.syncState).toBe('offline');
    onLineSpy.mockRestore();
  });
});
