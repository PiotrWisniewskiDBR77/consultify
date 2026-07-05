/**
 * @vitest-environment jsdom
 *
 * useIdeaMapSync — reload-race regression (M07 BUG-1, 2026-06-24).
 *
 * Bug: nodes added <draftMs (800ms) before a hard reload were lost. The draft is only
 * written to localStorage 800ms after editing stops (draftTimer), and on a hard reload
 * (F5) the React unmount cleanup does NOT run. The beforeunload handler only fired a
 * best-effort keepalive POST — droppable under load — so the latest nodes had no durable
 * record and the next mount hydrated an empty/stale map → "0 nodes after reload".
 *
 * Fix (useIdeaMapSync.ts): beforeunload / visibilitychange-hidden now persist the queued
 * payload to localStorage SYNCHRONOUSLY (before the keepalive flush). The next mount
 * recovers it via resolveIdeaMapHydration even if the POST never lands.
 *
 * Recreated 2026-07-04 (DP-3 T7): the original test (72a063f54d) was lost — `/tests/` is
 * gitignored (see finding_tests_dir_gitignored_force_add) and the file never landed via
 * `git add -f` on this branch. The underlying fix in useIdeaMapSync.ts is intact; this
 * file re-pins the regression per the T7 contract ("reload-race pozostaje zielony").
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readIdeaMapDraft, useIdeaMapSync } from '@/components/MyWork/canvas/useIdeaMapSync';

// Keep every flush in-flight (never resolves) so the keepalive POST cannot async-overwrite
// the synchronous draft with pending:false — we are asserting the SYNCHRONOUS write only.
const syncMock = vi.fn().mockReturnValue(new Promise<never>(() => {}));

vi.mock('@/services/api', () => ({
  Api: {
    syncMyIdeaMap: (...args: any[]) => syncMock(...args),
    createMyIdeaMapSnapshot: vi.fn().mockResolvedValue(null),
  },
}));

const PAYLOAD = { nodes: [{ id: 'n1' }, { id: 'n2' }, { id: 'n3' }], edges: [] };

describe('useIdeaMapSync — beforeunload persists draft synchronously (M07 reload-race)', () => {
  beforeEach(() => {
    syncMock.mockClear();
    try {
      window.localStorage.clear();
    } catch {
      /* ignore */
    }
  });

  it('writes the queued payload to localStorage on beforeunload without waiting for the 800ms draft timer', () => {
    const { result } = renderHook(() =>
      useIdeaMapSync({ ideaId: 'idea-reload', tool: 'process_flow' as any, open: true })
    );

    // Queue an edit. localOnly so no sync timer is scheduled; the 800ms draftTimer is
    // pending but NOT yet fired — exactly the lost-edit window.
    act(() => {
      result.current.queueSync(PAYLOAD, { localOnly: true });
    });
    expect(readIdeaMapDraft('idea-reload')).toBeNull(); // draft timer has not fired yet

    // Hard reload: beforeunload fires synchronously.
    act(() => {
      window.dispatchEvent(new Event('beforeunload'));
    });

    // The fix must have persisted the draft synchronously, pending + latest nodes.
    const draft = readIdeaMapDraft('idea-reload');
    expect(draft).not.toBeNull();
    expect(draft!.pending).toBe(true);
    expect(draft!.payload.nodes).toEqual(PAYLOAD.nodes);
  });

  it('also persists synchronously when the tab is backgrounded (visibilitychange → hidden)', () => {
    const { result } = renderHook(() =>
      useIdeaMapSync({ ideaId: 'idea-bg', tool: 'process_flow' as any, open: true })
    );
    act(() => {
      result.current.queueSync(PAYLOAD, { localOnly: true });
    });
    // Force document.visibilityState = 'hidden'.
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const draft = readIdeaMapDraft('idea-bg');
    expect(draft).not.toBeNull();
    expect(draft!.payload.nodes).toEqual(PAYLOAD.nodes);
  });
});
