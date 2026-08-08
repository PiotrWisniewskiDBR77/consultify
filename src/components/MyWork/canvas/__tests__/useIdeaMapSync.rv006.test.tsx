/**
 * @vitest-environment jsdom
 *
 * CB-05/RV-006 — isolated reproduction of the spurious representation-switch
 * conflict, and proof of the fix.
 *
 * Root cause (confirmed by reading IdeaMapWorkspace.tsx): Mind Map and
 * Process Flow share ONE `useWorkspaceGraphRuntime` instance that is
 * instantiated once, unconditionally, at the workspace level — it stays
 * `open` for the whole session regardless of which representation is on
 * screen. Whiteboard and Table each own a SEPARATE `useIdeaMapSync` instance
 * that is only mounted while their own tool is active. All instances write
 * their server version into the module-level `globalIdeaVersions` map on
 * every successful save — but each instance's own `serverVersionRef` is a
 * plain ref that does not react when a SIBLING instance bumps that map. So
 * while the user is on Whiteboard (which saves and bumps the version), the
 * always-mounted shared Mind Map/Process Flow engine is left holding a
 * stale version; switching back to it (or its own background autosave)
 * races that stale baseVersion into the server and gets a same-tab 409 that
 * is NOT a real conflict — nobody else touched the graph.
 *
 * This test reproduces exactly that sequence directly through the hook's
 * public API (no DOM/UI involved) and asserts the fix in useIdeaMapSync.ts
 * (resync `serverVersionRef` from `globalIdeaVersions` right before every
 * network write) makes the second instance's flush succeed on the first try
 * — no 409, no onConflict call, no self-heal retry needed — while leaving a
 * GENUINE conflict (a version `globalIdeaVersions` never saw, i.e. a
 * different browser tab/user) to still 409 and still recover via the
 * existing onConflict/self-heal path, unmasked.
 */
import { act, render } from '@testing-library/react';
import React, { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';

import { useIdeaMapSync } from '../useIdeaMapSync';

type SyncApi = ReturnType<typeof useIdeaMapSync>;

function Harness({
  ideaId,
  tool,
  onConflict,
  onReady,
}: {
  ideaId: string;
  tool: 'mindmap' | 'whiteboard';
  onConflict: (v: number) => void;
  onReady: (api: SyncApi) => void;
}) {
  const api = useIdeaMapSync({ ideaId, tool, open: true, onConflict });
  useEffect(() => {
    onReady(api);
  });
  return null;
}

/** A fake server that only accepts a write whose baseVersion matches its
 * current version, exactly like the real POST /map/sync 409 contract. */
function makeFakeServer(startVersion: number) {
  let version = startVersion;
  return {
    getVersion: () => version,
    /** Simulates a write this browser tab never learned about (a different
     * tab/user), so its local `globalIdeaVersions` map stays behind. */
    advanceExternally: () => {
      version += 1;
    },
    handler: vi.fn(async (_ideaId: string, payload: any) => {
      if (payload.baseVersion !== version) {
        const err: any = new Error('conflict');
        err.status = 409;
        err.data = { currentVersion: version };
        throw err;
      }
      version += 1;
      return { version };
    }),
  };
}

const flushMicrotasks = () => act(() => new Promise((r) => setTimeout(r, 0)));

describe('RV-006 — shared version invariant across sibling sync-engine instances', () => {
  it('a same-tab write from a sibling instance no longer 409s the always-mounted shared instance', async () => {
    const ideaId = 'idea-rv006-siblings';
    const server = makeFakeServer(5);
    const spy = vi.spyOn(Api, 'syncMyIdeaMap').mockImplementation(server.handler as any);

    let sharedApi: SyncApi | null = null;
    let whiteboardApi: SyncApi | null = null;
    const sharedOnConflict = vi.fn();
    const whiteboardOnConflict = vi.fn();

    render(
      <>
        <Harness
          ideaId={ideaId}
          tool="mindmap"
          onConflict={sharedOnConflict}
          onReady={(api) => {
            sharedApi = api;
          }}
        />
        <Harness
          ideaId={ideaId}
          tool="whiteboard"
          onConflict={whiteboardOnConflict}
          onReady={(api) => {
            whiteboardApi = api;
          }}
        />
      </>
    );

    // Both instances hydrate at the same starting server version — exactly
    // what happens when the idea workspace first loads.
    act(() => {
      sharedApi!.primeServerVersion(5);
      whiteboardApi!.primeServerVersion(5);
    });

    // User works on Whiteboard for a bit; it saves successfully (server: 5→6).
    await act(async () => {
      await whiteboardApi!.flushNow({ nodes: [{ id: 'n1' }], edges: [] }, { reason: 'draft' });
    });
    expect(server.getVersion()).toBe(6);
    expect(whiteboardOnConflict).not.toHaveBeenCalled();

    // User switches back to Mind Map. The shared engine never re-hydrated
    // (it was open/mounted the whole time) — without the fix this flush
    // would send the stale baseVersion=5 and 409 against the real server
    // state of 6, even though nothing genuinely conflicts.
    await act(async () => {
      await sharedApi!.flushNow({ nodes: [{ id: 'n1' }], edges: [] }, { reason: 'draft' });
    });

    expect(sharedOnConflict).not.toHaveBeenCalled();
    expect(server.getVersion()).toBe(7);
    // The last call to the API must have carried the freshest known version
    // (6), not the stale one (5) captured at this instance's own hydrate.
    const lastCallPayload = spy.mock.calls[spy.mock.calls.length - 1][1];
    expect(lastCallPayload.baseVersion).toBe(6);

    spy.mockRestore();
  });

  it('a GENUINE conflict (a version this tab never learned about) still 409s and still recovers via onConflict — the invariant does not mask real concurrent edits', async () => {
    const ideaId = 'idea-rv006-genuine-conflict';
    const server = makeFakeServer(5);
    vi.spyOn(Api, 'syncMyIdeaMap').mockImplementation(server.handler as any);

    let api: SyncApi | null = null;
    const onConflict = vi.fn();

    render(
      <Harness
        ideaId={ideaId}
        tool="mindmap"
        onConflict={onConflict}
        onReady={(a) => {
          api = a;
        }}
      />
    );

    act(() => {
      api!.primeServerVersion(5);
    });

    // Simulate a write from a genuinely different browser tab/user: the
    // server version advances to 6 WITHOUT this tab's globalIdeaVersions
    // map ever learning about it (that only happens via THIS tab's own
    // successful saves or WS graph_version events, neither of which fired
    // here).
    server.advanceExternally();

    await act(async () => {
      await api!
        .flushNow({ nodes: [{ id: 'n1' }], edges: [] }, { reason: 'draft' })
        .catch(() => null);
    });

    // A real conflict still surfaces — the shared-version invariant only
    // catches up to versions THIS tab already knows about; it cannot and
    // must not manufacture knowledge of someone else's write.
    expect(onConflict).toHaveBeenCalledTimes(1);
    expect(onConflict).toHaveBeenCalledWith(6, null);

    // The built-in self-heal retry (unrelated to this fix, pre-existing
    // behaviour) then re-sends with the corrected baseVersion and succeeds —
    // the graph converges instead of being stuck in "conflict" forever.
    await flushMicrotasks();
    expect(server.getVersion()).toBe(7);

    vi.restoreAllMocks();
  });
});
