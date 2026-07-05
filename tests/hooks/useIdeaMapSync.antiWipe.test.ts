/**
 * @vitest-environment jsdom
 *
 * Anti-wipe guard on the shared sync layer (canvas/useIdeaMapSync.flushNow).
 *
 * Live regression (Londyn m06 integration): the Recommendation map hydrated a
 * 3-node server payload (root `center` + 2 `idea`), but a flush through the
 * canvas/useIdeaMapSync path POSTed `nodes:[]` (baseVersion 63) and wiped the
 * map in the DB — the 26a2a896ef class of silent-destroy bug. The scheduleSave
 * guard in useMindMapPersistence does NOT cover this path because the workspace
 * runtime captures/flushes here directly.
 *
 * Guard contract (this file pins it):
 *  - a legitimate non-empty payload (the exact 3-node hydration shape) flushes;
 *  - a 0-node payload flushed BEFORE hydration (version never primed) is
 *    refused — this is the exact pre-hydrate wipe from the repro;
 *  - a 0-node payload flushed AFTER a non-empty hydrate is refused;
 *  - the poisoned empty payload is dropped, not resurrected by the deferred
 *    re-flush in the finally block.
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

import { useIdeaMapSync } from '@/components/MyWork/canvas/useIdeaMapSync';

// Exact payload shape from the captured GET /my-work/my-ideas/:id/map response:
// root type:center + 2 type:idea "Start", no edges.
const THREE_NODE_MAP = {
  nodes: [
    { id: 'root', type: 'center', data: { label: 'Recommendation' }, position: { x: 0, y: 0 } },
    { id: 'idea-1', type: 'idea', data: { label: 'Start' }, position: { x: 200, y: -80 } },
    { id: 'idea-2', type: 'idea', data: { label: 'Start' }, position: { x: 200, y: 80 } },
  ],
  edges: [] as unknown[],
  preferredTool: 'mindmap' as const,
};

describe('useIdeaMapSync — anti-wipe guard (flushNow)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    try {
      window.localStorage.clear();
    } catch {
      /* ignore */
    }
  });
  afterEach(() => vi.restoreAllMocks());

  it('flushes the exact 3-node hydration payload after the version is primed', async () => {
    syncMyIdeaMap.mockResolvedValue({ version: 64 });
    const { result } = renderHook(() =>
      useIdeaMapSync({ ideaId: 'rec-idea', tool: 'mindmap', open: true })
    );

    await act(async () => {
      // Hydration primes the version with the just-loaded node count.
      result.current.primeServerVersion(63, THREE_NODE_MAP.nodes.length);
      await result.current.flushNow(THREE_NODE_MAP, { reason: 'manual' });
    });

    expect(syncMyIdeaMap).toHaveBeenCalledTimes(1);
    const [id, body] = syncMyIdeaMap.mock.calls[0];
    expect(id).toBe('rec-idea');
    expect(body.nodes).toHaveLength(3);
    expect(body.nodes[0].type).toBe('center');
    expect(body.nodes.filter((n: any) => n.type === 'idea')).toHaveLength(2);
    expect(body.baseVersion).toBe(63);
    expect(result.current.syncState).toBe('saved');
    expect(result.current.currentVersionRef.current).toBe(64);
  });

  it('refuses a 0-node flush BEFORE hydration (the pre-hydrate wipe from the repro)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    syncMyIdeaMap.mockResolvedValue({ version: 64 });
    const { result } = renderHook(() =>
      useIdeaMapSync({ ideaId: 'rec-idea', tool: 'mindmap', open: true })
    );

    let ret: unknown = 'sentinel';
    await act(async () => {
      // No primeServerVersion() → hydration has not completed. This mirrors the
      // captured flush that POSTed nodes:[] before the 3-node GET had landed.
      ret = await result.current.flushNow({ nodes: [], edges: [] }, { reason: 'draft' });
    });

    expect(syncMyIdeaMap).not.toHaveBeenCalled();
    expect(ret).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('anti-wipe guard'));
  });

  it('refuses a 0-node flush AFTER a non-empty hydrate', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    syncMyIdeaMap.mockResolvedValue({ version: 64 });
    const { result } = renderHook(() =>
      useIdeaMapSync({ ideaId: 'rec-idea', tool: 'mindmap', open: true })
    );

    await act(async () => {
      // Hydrate with the 3-node map (seeds the non-empty baseline)…
      result.current.primeServerVersion(63, THREE_NODE_MAP.nodes.length);
      // …then a defective transform tries to flush an empty graph.
      await result.current.flushNow({ nodes: [], edges: [] }, { reason: 'draft' });
    });

    expect(syncMyIdeaMap).not.toHaveBeenCalled();
    expect(result.current.currentVersionRef.current).toBe(63);
  });

  it('does not resurrect the blocked empty payload via the deferred re-flush', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    syncMyIdeaMap.mockResolvedValue({ version: 64 });
    const { result } = renderHook(() =>
      useIdeaMapSync({ ideaId: 'rec-idea', tool: 'mindmap', open: true })
    );

    await act(async () => {
      result.current.primeServerVersion(63, THREE_NODE_MAP.nodes.length);
      // Queue an empty payload, then flush — the guard must drop it so the
      // finally-block re-flush has nothing poisoned to re-send.
      result.current.queueSync({ nodes: [], edges: [] }, { localOnly: true });
      await result.current.flushNow({ nodes: [], edges: [] }, { reason: 'draft' });
    });

    // A subsequent legitimate flush still works and is the only POST.
    await act(async () => {
      await result.current.flushNow(THREE_NODE_MAP, { reason: 'manual' });
    });
    expect(syncMyIdeaMap).toHaveBeenCalledTimes(1);
    expect(syncMyIdeaMap.mock.calls[0][1].nodes).toHaveLength(3);
  });
});
