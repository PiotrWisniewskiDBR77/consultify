/**
 * @vitest-environment jsdom
 *
 * D3 — "Changes queued" indicator survives reload/tool-switch even after the
 * edit was actually saved, and a genuinely-recovered pending draft never
 * retries on its own.
 *
 * Root cause (confirmed by reading useIdeaMapSync.ts): `primeServerVersion()`
 * — called at the end of every successful GET /map hydration, by ALL FOUR
 * canvas tools (Mind Map, Process Flow, Table, Whiteboard) — used to trust a
 * `pending: true` localStorage draft (`consultify.idea-map-sync.<ideaId>`)
 * unconditionally, with no comparison against the server version it was just
 * given. `resolveIdeaMapHydration()` (used to hydrate the CANVAS content)
 * already does this comparison and clears a stale draft, but
 * `primeServerVersion()` (which drives the save-state INDICATOR) did its own
 * independent `readIdeaMapDraft()` call and skipped that check entirely.
 *
 * Concretely: an edit's autosave debounce (queueSync) writes a `pending:true`
 * localStorage snapshot ~800ms after every change (belt-and-suspenders for
 * crash/close), separately from the actual POST /map/sync flush that follows
 * ~2.5s later. If the page reloads or navigates away in that window, the
 * synchronous beforeunload/visibilitychange handler re-writes that same
 * pending:true snapshot and fires a best-effort `keepalive` flush — but the
 * success handler that would flip it back to `pending:false`
 * (`persistDraft(payload, false)`, useIdeaMapSync.ts flushNow) runs in the
 * OLD page's JS context, which is usually torn down before the keepalive
 * response arrives. The server ends up with the correct, saved data — but
 * the stale `pending:true` draft is the only thing the NEXT mount's
 * `primeServerVersion()` looks at, so it re-queues a payload that was already
 * saved and the indicator gets stuck on "Changes queued" indefinitely (it was
 * live-measured surviving 96s post-reload with zero further edits, only
 * clearing once an unrelated tool switch happened to trigger a fresh save
 * attempt).
 *
 * Separately, even a GENUINELY still-unsaved recovered draft (a real crash,
 * not this stale-flag race) was never retried automatically — it just sat
 * labeled "queued" until the user happened to make another edit. That is the
 * same family of defect as D3 (kolejkowane zmiany bez uczciwego statusu): a
 * "queued" indicator that never attempts to actually queue anything is
 * indistinguishable, from the user's point of view, from silently dropped
 * work.
 *
 * Fix (useIdeaMapSync.ts primeServerVersion): compare the recovered draft's
 * `baseVersion` against the server version just hydrated — mirroring
 * resolveIdeaMapHydration()'s existing test exactly. Stale → clear the draft
 * and report idle/saved (test 1). Genuinely ahead → keep "queued" AND
 * immediately retry the flush instead of waiting for an unrelated future
 * edit (test 2).
 */
import { act, render } from '@testing-library/react';
import React, { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';

import {
  clearIdeaMapDraft,
  readIdeaMapDraft,
  useIdeaMapSync,
  writeIdeaMapDraft,
} from '../useIdeaMapSync';

type SyncApi = ReturnType<typeof useIdeaMapSync>;

function Harness({
  ideaId,
  onReady,
}: {
  ideaId: string;
  onReady: (api: SyncApi) => void;
}) {
  const api = useIdeaMapSync({ ideaId, tool: 'whiteboard', open: true });
  useEffect(() => {
    onReady(api);
  });
  return null;
}

const flushMicrotasks = () => act(() => new Promise((r) => setTimeout(r, 0)));

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('D3 — primeServerVersion vs. a localStorage draft left over from a previous mount', () => {
  it('clears a STALE pending draft (server already caught up) instead of sticking the indicator on "queued" forever', async () => {
    const ideaId = 'idea-d3-stale-draft';
    const syncSpy = vi.spyOn(Api, 'syncMyIdeaMap');

    // Simulate the beforeunload/visibilitychange race: a draft was written
    // pending:true at baseVersion 5, but its keepalive flush actually landed
    // on the server (which is now at version 9) — the JS success handler
    // that would have flipped this to pending:false never got to run because
    // the old page tore down first.
    writeIdeaMapDraft(ideaId, {
      tool: 'whiteboard',
      payload: { nodes: [{ id: 'n1' }], edges: [] },
      baseVersion: 5,
      pending: true,
      updatedAt: Date.now(),
      lastSavedAt: null,
    });

    let api: SyncApi | null = null;
    render(<Harness ideaId={ideaId} onReady={(a) => (api = a)} />);

    // Fresh mount hydrates and discovers the server is already at version 9
    // (the keepalive save from the previous page already landed there).
    act(() => {
      api!.primeServerVersion(9);
    });
    await flushMicrotasks();

    // The stale draft must not read as "still needs saving".
    expect(api!.syncState).not.toBe('queued');
    expect(api!.syncState).toBe('idle');
    // ...and must not silently re-POST content the server already has.
    expect(syncSpy).not.toHaveBeenCalled();
    // The stale localStorage entry itself must be cleared, not left to
    // confuse the NEXT mount too.
    expect(readIdeaMapDraft(ideaId)).toBeNull();
  });

  it('retries a GENUINELY pending draft immediately instead of leaving it labeled "queued" with no activity behind it', async () => {
    const ideaId = 'idea-d3-genuine-pending-draft';
    const syncSpy = vi
      .spyOn(Api, 'syncMyIdeaMap')
      .mockImplementation(async (_id: string, payload: any) => ({
        version: payload.baseVersion + 1,
      }));

    // A draft that is genuinely still ahead of the server (baseVersion 9,
    // matching what we are about to hydrate at — never confirmed saved).
    writeIdeaMapDraft(ideaId, {
      tool: 'whiteboard',
      payload: { nodes: [{ id: 'n1', data: { label: 'unsaved edit' } }], edges: [] },
      baseVersion: 9,
      pending: true,
      updatedAt: Date.now(),
      lastSavedAt: null,
    });

    let api: SyncApi | null = null;
    render(<Harness ideaId={ideaId} onReady={(a) => (api = a)} />);

    act(() => {
      api!.primeServerVersion(9);
    });

    // Recovery marks the payload queued and, in the same tick, kicks off the
    // retry — by the time this act() settles the retry's own synchronous
    // "saving" transition has already run (flushNow sets 'saving' before its
    // first await), so the indicator is never left inert on "queued" with no
    // request behind it.
    expect(api!.syncState).toBe('saving');

    // The retry must not just sit there: the recovered draft is flushed on
    // its own, with no further caller action, and honestly resolves to
    // "saved" once the (mocked) server confirms it.
    await flushMicrotasks();
    expect(syncSpy).toHaveBeenCalledTimes(1);
    expect(syncSpy.mock.calls[0][1]).toMatchObject({ baseVersion: 9 });
    expect(api!.syncState).toBe('saved');

    clearIdeaMapDraft(ideaId);
  });
});
