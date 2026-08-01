/**
 * useVersionHistory — server-side persistence coverage (Module 12 audit gap #3).
 *
 * Before this wiring the hook kept versions in React state only, so history
 * vanished on refresh. These tests assert the durable behavior:
 *   - on mount the hook hydrates from GET /presentations/decks/:id/versions
 *   - persisted server snapshots appear in the timeline and survive a remount
 *   - restoring a persisted snapshot POSTs to the server restore endpoint and
 *     re-fetches the canonical deck, returning the restored Deck
 *   - restoring an ephemeral in-session checkpoint restores instantly (no fetch)
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Deck } from '../../wizard/types';
import { useVersionHistory, type VersionRestoreResult } from '../useVersionHistory';

const DECK_ID = 'deck-123';

function makeDeck(overrides: Record<string, unknown> = {}): Deck {
  return {
    deck_id: DECK_ID,
    title: 'Test Deck',
    cards: [{ card_id: 'c1', blocks: [] }],
    ...overrides,
  } as unknown as Deck;
}

const SERVER_VERSIONS = [
  {
    id: 'ver-2',
    deck_id: DECK_ID,
    version: 2,
    slide_count: 5,
    created_by: 'u1',
    created_at: '2026-06-02T10:05:00.000Z',
  },
  {
    id: 'ver-1',
    deck_id: DECK_ID,
    version: 1,
    slide_count: 3,
    created_by: 'u1',
    created_at: '2026-06-02T10:00:00.000Z',
  },
];

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('useVersionHistory — server persistence', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('hydrates persisted version history from the server on mount', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: SERVER_VERSIONS }));

    const deck = makeDeck();
    const { result } = renderHook(() => useVersionHistory(deck, DECK_ID, () => 2));

    await waitFor(() => {
      expect(result.current.versions.length).toBe(2);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/presentations/decks/${DECK_ID}/versions`,
      expect.objectContaining({ method: 'GET' })
    );
    // Persisted snapshots are flagged so they survive refresh and route restores
    // through the server.
    expect(result.current.versions.every((v) => v.persisted)).toBe(true);
    // Newest version first.
    expect(result.current.versions[0].id).toBe('ver-2');
    expect(result.current.historyStatus).toBe('available');
  });

  it('treats the first canonical deck as clean and only marks real edits dirty', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: [] }));
    const initialDeck = makeDeck();
    const { result, rerender } = renderHook(
      ({ deck }: { deck: Deck }) => useVersionHistory(deck, DECK_ID),
      { initialProps: { deck: initialDeck } }
    );

    await waitFor(() => expect(result.current.historyStatus).toBe('available'));
    expect(result.current.hasUnsavedChanges).toBe(false);

    const editedDeck = makeDeck({ title: 'Edited title' });
    rerender({ deck: editedDeck });
    await waitFor(() => expect(result.current.hasUnsavedChanges).toBe(true));

    act(() => result.current.markSaved(editedDeck));
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('reports history unavailable instead of presenting a failed request as an empty history', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: false }, false, 503));
    const deck = makeDeck();
    const { result } = renderHook(() => useVersionHistory(deck, DECK_ID, () => 1));

    await waitFor(() => expect(result.current.historyStatus).toBe('unavailable'));
    expect(result.current.versions).toEqual([]);
  });

  it('restores a persisted snapshot via the server and returns the restored deck', async () => {
    const restoredDeck = makeDeck({
      title: 'Restored Deck',
      cards: [{ card_id: 'r1', blocks: [] }],
    });

    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.endsWith('/versions') && (!opts || opts.method === 'GET')) {
        return Promise.resolve(jsonResponse({ success: true, data: SERVER_VERSIONS }));
      }
      if (url.endsWith('/versions/ver-1/restore') && opts?.method === 'POST') {
        return Promise.resolve(jsonResponse({ success: true, version: 3 }));
      }
      if (url === `/api/presentations/decks/${DECK_ID}` && (!opts || opts.method === 'GET')) {
        return Promise.resolve(
          jsonResponse({ success: true, data: { deck_json: JSON.stringify(restoredDeck) } })
        );
      }
      return Promise.resolve(jsonResponse({}, false, 404));
    });

    const deck = makeDeck();
    const onServerVersion = vi.fn();
    const { result } = renderHook(() => useVersionHistory(deck, DECK_ID, () => 2, onServerVersion));
    await waitFor(() => expect(result.current.versions.length).toBe(2));

    let restored: VersionRestoreResult | null = null;
    await act(async () => {
      restored = await result.current.restoreVersion('ver-1');
    });

    expect(restored).not.toBeNull();
    expect((restored as unknown as VersionRestoreResult).deck.title).toBe('Restored Deck');
    expect((restored as unknown as VersionRestoreResult).deck.deck_id).toBe(DECK_ID);
    // MAT-006B — the caller needs to know this content is already on the server,
    // so it can baseline it instead of autosaving it straight back.
    expect((restored as unknown as VersionRestoreResult).source).toBe('server');
    expect((restored as unknown as VersionRestoreResult).serverVersion).toBe(3);
    expect(onServerVersion).toHaveBeenCalledWith(3);

    // Server restore endpoint was hit, then the canonical deck re-fetched.
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/presentations/decks/${DECK_ID}/versions/ver-1/restore`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ expectedVersion: 2 }) })
    );
  });

  it('does not read back or apply a restore rejected with a version conflict', async () => {
    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.endsWith('/versions') && (!opts || opts.method === 'GET')) {
        return Promise.resolve(jsonResponse({ success: true, data: SERVER_VERSIONS }));
      }
      if (url.endsWith('/versions/ver-1/restore')) {
        return Promise.resolve(
          jsonResponse({ code: 'VERSION_CONFLICT', serverVersion: 3, clientVersion: 2 }, false, 409)
        );
      }
      return Promise.resolve(jsonResponse({}, false, 404));
    });
    const deck = makeDeck();
    const { result } = renderHook(() => useVersionHistory(deck, DECK_ID, () => 2));
    await waitFor(() => expect(result.current.versions.length).toBe(2));
    let restored: VersionRestoreResult | null = { deck: makeDeck(), source: 'server' };
    await act(async () => {
      restored = await result.current.restoreVersion('ver-1');
    });
    expect(restored).toBeNull();
    expect(fetchMock).not.toHaveBeenCalledWith(
      `/api/presentations/decks/${DECK_ID}`,
      expect.anything()
    );
  });

  it('restores an in-session checkpoint instantly without a server round-trip', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: [] }));

    const deck = makeDeck();
    const { result } = renderHook(() => useVersionHistory(deck, DECK_ID));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    act(() => {
      result.current.saveManualCheckpoint('Before big edit');
    });

    const checkpoint = result.current.versions.find((v) => v.type === 'manual');
    expect(checkpoint).toBeTruthy();
    expect(checkpoint?.persisted).toBeFalsy();

    const callsBefore = fetchMock.mock.calls.length;
    let restored: VersionRestoreResult | null = null;
    await act(async () => {
      restored = await result.current.restoreVersion(checkpoint!.id);
    });

    // Local restore returns the cached deck JSON and makes no extra fetch.
    expect(restored).not.toBeNull();
    expect((restored as unknown as VersionRestoreResult).deck.deck_id).toBe(DECK_ID);
    // Not on the server — the caller must still let autosave persist it.
    expect((restored as unknown as VersionRestoreResult).source).toBe('session');
    expect((restored as unknown as VersionRestoreResult).serverVersion).toBeUndefined();
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  /**
   * MAT-006B / P1 — ★ THIS HOOK IS NOT A WRITER ANY MORE.
   *
   * It used to run a SECOND autosave next to DeckBuilder's debounced one: a 30 s
   * `setInterval` PUT to the same `/autosave` endpoint, with its own baseline
   * and its own version token that started at 1 and was never seeded from the
   * canonical load. On any deck with `version > 1` that PUT 409-ed by
   * construction. The loop is deleted; the assertion is now absolute — no deck
   * state, edited or restored, may produce a write from here.
   *
   * The companion guarantee (an EDIT still reaches the server) moved to the one
   * remaining writer and is covered by `useDeckAutosave.test.ts` and
   * `DeckBuilder.restoreNoWrite.test.tsx`.
   */
  it('never issues an autosave PUT — not for a restored deck, not for an edited one', async () => {
    const restoredDeck = makeDeck({
      title: 'Restored Deck',
      cards: [{ card_id: 'r1', blocks: [] }],
    });
    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.endsWith('/versions') && (!opts || opts.method === 'GET')) {
        return Promise.resolve(jsonResponse({ success: true, data: SERVER_VERSIONS }));
      }
      if (url.endsWith('/versions/ver-1/restore') && opts?.method === 'POST') {
        return Promise.resolve(jsonResponse({ success: true, version: 3 }));
      }
      if (url === `/api/presentations/decks/${DECK_ID}` && (!opts || opts.method === 'GET')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            data: { version: 3, deck_json: JSON.stringify(restoredDeck) },
          })
        );
      }
      if (url.endsWith('/autosave')) {
        return Promise.resolve(jsonResponse({ success: true, version: 4 }));
      }
      return Promise.resolve(jsonResponse({}, false, 404));
    });
    const autosavePuts = () =>
      fetchMock.mock.calls.filter(
        (call: any[]) =>
          String(call[0]).endsWith('/autosave') &&
          (call[1] as RequestInit | undefined)?.method === 'PUT'
      );

    const { result, rerender } = renderHook(
      ({ deck }: { deck: Deck }) => useVersionHistory(deck, DECK_ID, () => 2),
      { initialProps: { deck: makeDeck() } }
    );
    await waitFor(() => expect(result.current.versions.length).toBe(2));

    let restored: VersionRestoreResult | null = null;
    await act(async () => {
      restored = await result.current.restoreVersion('ver-1');
    });
    expect(restored).not.toBeNull();

    vi.useFakeTimers();
    try {
      rerender({ deck: (restored as unknown as VersionRestoreResult).deck });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(31_000);
      });
      expect(autosavePuts()).toHaveLength(0);

      // An UNSAVED edit sits there for two full former intervals and still
      // produces nothing: the second writer is gone, not merely baselined.
      rerender({ deck: makeDeck({ title: 'Edited after restore' }) });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(61_000);
      });
      expect(autosavePuts()).toHaveLength(0);
      // ...and it is correctly reported as unsaved, so `beforeunload` still warns.
      expect(result.current.hasUnsavedChanges).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * The version token lives in ONE place (DeckBuilder's `serverVersionRef`, read
   * through `getExpectedVersion`). This hook used to keep a private one starting
   * at 1, which it also used as the restore fallback — so on a deck at version 7
   * a restore could go out claiming version 1 and be rejected. With no token
   * supplied the hook must refuse to guess rather than fabricate a conflict.
   */
  it('sends the caller-owned expected version on restore and never a fabricated one', async () => {
    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.endsWith('/versions') && (!opts || opts.method === 'GET')) {
        return Promise.resolve(jsonResponse({ success: true, data: SERVER_VERSIONS }));
      }
      if (url.endsWith('/versions/ver-1/restore') && opts?.method === 'POST') {
        return Promise.resolve(jsonResponse({ success: true, version: 8 }));
      }
      if (url === `/api/presentations/decks/${DECK_ID}` && (!opts || opts.method === 'GET')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            data: { version: 8, deck_json: JSON.stringify(makeDeck()) },
          })
        );
      }
      return Promise.resolve(jsonResponse({}, false, 404));
    });

    // A deck the user has edited many times — exactly the case the private
    // token got wrong.
    const { result } = renderHook(() => useVersionHistory(makeDeck(), DECK_ID, () => 7));
    await waitFor(() => expect(result.current.versions.length).toBe(2));

    await act(async () => {
      await result.current.restoreVersion('ver-1');
    });

    const restoreCall = fetchMock.mock.calls.find((call: any[]) =>
      String(call[0]).endsWith('/versions/ver-1/restore')
    );
    expect(restoreCall).toBeTruthy();
    expect(JSON.parse(String((restoreCall![1] as RequestInit).body))).toEqual({
      expectedVersion: 7,
    });
  });

  it('refuses a server restore when no expected version is available instead of guessing', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: SERVER_VERSIONS }));
    const { result } = renderHook(() => useVersionHistory(makeDeck(), DECK_ID));
    await waitFor(() => expect(result.current.versions.length).toBe(2));

    let restored: VersionRestoreResult | null = { deck: makeDeck(), source: 'server' };
    await act(async () => {
      restored = await result.current.restoreVersion('ver-1');
    });

    expect(restored).toBeNull();
    expect(fetchMock.mock.calls.some((call: any[]) => String(call[0]).includes('/restore'))).toBe(
      false
    );
  });

  /**
   * `hasUnsavedChanges` arms the `beforeunload` warning, so a rejected write must
   * never clear it. The old second loop advanced its baseline on any non-409
   * response — a 500 showed "Saved" and let the user close the tab.
   */
  it('keeps changes marked unsaved when the writer reports a failed save', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: [] }));
    const { result, rerender } = renderHook(
      ({ deck }: { deck: Deck }) => useVersionHistory(deck, DECK_ID, () => 4),
      { initialProps: { deck: makeDeck() } }
    );
    await waitFor(() => expect(result.current.historyStatus).toBe('available'));

    // The loader baselined the opened deck: nothing unsaved.
    act(() => result.current.markSaved(makeDeck()));
    expect(result.current.hasUnsavedChanges).toBe(false);

    const edited = makeDeck({ title: 'Edited' });
    rerender({ deck: edited });
    expect(result.current.hasUnsavedChanges).toBe(true);

    // The one writer tries and fails.
    act(() => result.current.noteSaveStarted());
    expect(result.current.isSaving).toBe(true);
    act(() => result.current.noteSaveFailed());

    expect(result.current.isSaving).toBe(false);
    expect(result.current.hasUnsavedChanges).toBe(true);
    expect(result.current.lastSavedAt).toBeNull();

    // Control: the same edit, accepted, does clear it and stamps the save.
    act(() => result.current.noteSaveStarted());
    act(() => result.current.notePersistedSave(edited));
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(result.current.lastSavedAt).toBeTypeOf('number');
  });

  /**
   * The other half of the lost update, as the user experiences it: undo INSIDE a
   * round trip makes the deck byte-identical to the last saved baseline while
   * the server is about to hold the OTHER state. A plain string compare calls
   * that "saved" — the badge flips to Saved and `beforeunload` goes quiet, over
   * a write the user has not been told about.
   */
  it('does not call an undo made during an in-flight save "saved"', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: [] }));
    const baseline = makeDeck({ title: 'baseline' });
    const { result, rerender } = renderHook(
      ({ deck }: { deck: Deck }) => useVersionHistory(deck, DECK_ID, () => 4),
      { initialProps: { deck: baseline } }
    );
    await waitFor(() => expect(result.current.historyStatus).toBe('available'));

    act(() => result.current.markSaved(baseline));
    rerender({ deck: makeDeck({ title: 'edit A' }) });
    expect(result.current.hasUnsavedChanges).toBe(true);

    // The write of "edit A" leaves the browser, then the user undoes.
    act(() => result.current.noteSaveStarted());
    rerender({ deck: makeDeck({ title: 'baseline' }) });

    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  /**
   * The writer reports asynchronously. If the user edited again while the PUT
   * was in flight, the accepted payload is NOT what is on screen — reporting it
   * as "saved" would silence `beforeunload` over live, unsaved work.
   */
  it('stays unsaved when the accepted payload is not the deck on screen', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: [] }));
    const inFlight = makeDeck({ title: 'A' });
    const { result, rerender } = renderHook(
      ({ deck }: { deck: Deck }) => useVersionHistory(deck, DECK_ID, () => 4),
      { initialProps: { deck: inFlight } }
    );
    await waitFor(() => expect(result.current.historyStatus).toBe('available'));

    act(() => result.current.noteSaveStarted());
    // User keeps typing while A is in flight.
    rerender({ deck: makeDeck({ title: 'B' }) });
    // A comes back accepted.
    act(() => result.current.notePersistedSave(inFlight));

    expect(result.current.hasUnsavedChanges).toBe(true);
  });
});
