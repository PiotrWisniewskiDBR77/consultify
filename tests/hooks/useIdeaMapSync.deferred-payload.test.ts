/**
 * @vitest-environment jsdom
 *
 * useIdeaMapSync — deferred-payload regression (M07 §3/§6 P0 data-loss).
 *
 * Bug: flushNow's success path cleared queuedPayloadRef UNCONDITIONALLY before the
 * finally block ran. If a second flush enqueued a newer payload (P2) while the first
 * flush (P1) was in-flight, P2 was wiped by P1's success path → the user's latest nodes
 * were silently dropped and lost after reload.
 *
 * Fix (useIdeaMapSync.ts ~L300): only clear queuedPayloadRef when it STILL === the
 * payload just saved; otherwise the finally block re-flushes the newer (deferred) payload
 * with the post-success baseVersion.
 *
 * This test drives the public hook surface:
 *   1. flushNow(P1) — Api.syncMyIdeaMap returns a controllable (manually-resolved) promise.
 *   2. WHILE that call is pending, flushNow(P2). The in-flight guard defers P2 into
 *      queuedPayloadRef and returns null (no 2nd Api call yet).
 *   3. Resolve P1's promise. The finally block must re-flush P2 (NOT drop it), and the
 *      re-flush must carry the bumped baseVersion from P1's response.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useIdeaMapSync } from '@/components/MyWork/canvas/useIdeaMapSync';

// --- Controllable Api.syncMyIdeaMap mock -----------------------------------
// Each call returns a fresh promise whose resolver we capture, so the test can
// keep the first flush "in flight" while it enqueues the second payload.
const syncMock = vi.fn();

vi.mock('@/services/api', () => ({
  Api: {
    syncMyIdeaMap: (...args: any[]) => syncMock(...args),
    createMyIdeaMapSnapshot: vi.fn().mockResolvedValue(null),
  },
}));

interface Deferred {
  promise: Promise<any>;
  resolve: (v: any) => void;
}
function deferred(): Deferred {
  let resolve!: (v: any) => void;
  const promise = new Promise<any>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const P1 = { nodes: [{ id: 'n1' }], edges: [] };
const P2 = { nodes: [{ id: 'n1' }, { id: 'n2' }], edges: [] };

describe('useIdeaMapSync — deferred payload is not dropped (M07 P0)', () => {
  beforeEach(() => {
    syncMock.mockReset();
    try {
      window.localStorage.clear();
    } catch {
      /* ignore */
    }
  });

  it('re-flushes a payload enqueued while the first flush is in-flight, with the bumped baseVersion', async () => {
    const d1 = deferred();
    const d2 = deferred();
    // First call → pending promise (in flight). Second call → its own pending promise.
    syncMock
      .mockReturnValueOnce(d1.promise) // P1 flush
      .mockReturnValueOnce(d2.promise); // deferred re-flush of P2

    const { result } = renderHook(() =>
      useIdeaMapSync({ ideaId: 'idea-1', tool: 'whiteboard' as any, open: true })
    );

    // 1. Start flushing P1. Its Api.syncMyIdeaMap promise is left pending.
    let flush1!: Promise<any>;
    act(() => {
      flush1 = result.current.flushNow(P1, { reason: 'draft' });
    });
    expect(syncMock).toHaveBeenCalledTimes(1);
    expect(syncMock.mock.calls[0][1]).toMatchObject({ nodes: P1.nodes, baseVersion: 1 });

    // 2. While P1 is in flight, enqueue P2. The in-flight guard must defer it
    //    (NOT issue a 2nd Api call yet) and stash it in the queue.
    let flush2!: Promise<any>;
    act(() => {
      flush2 = result.current.flushNow(P2, { reason: 'draft' });
    });
    expect(await flush2).toBeNull(); // deferred → returns null
    expect(syncMock).toHaveBeenCalledTimes(1); // still only the first call

    // 3. Resolve P1 with a bumped server version. The success path must NOT wipe P2
    //    (queuedPayloadRef !== P1), and the finally block must re-flush P2.
    await act(async () => {
      d1.resolve({ version: 7 });
      await flush1;
      // Let the finally-scheduled re-flush microtask run.
      await Promise.resolve();
      await Promise.resolve();
    });

    // P2 must have been re-flushed — proof the deferred payload was NOT dropped.
    expect(syncMock).toHaveBeenCalledTimes(2);
    const secondCall = syncMock.mock.calls[1][1];
    expect(secondCall.nodes).toEqual(P2.nodes); // the NEWER payload, not P1
    // ...and it carried the version bumped by P1's success (7), not the stale baseVersion 1.
    expect(secondCall.baseVersion).toBe(7);

    // Finish the second flush so no unhandled promise lingers.
    await act(async () => {
      d2.resolve({ version: 8 });
      await Promise.resolve();
    });
  });
});
