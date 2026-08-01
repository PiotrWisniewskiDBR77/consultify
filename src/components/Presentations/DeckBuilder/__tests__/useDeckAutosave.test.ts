/**
 * useDeckAutosave — no write on read-only reopen (MAT-006B).
 *
 * The regression: DeckBuilder's autosave effect fired on every change of the
 * memoized `{deckId, deck}` pair once the initial load flag was set. Because the
 * load sets that flag AND replaces `deck` in the same commit, merely OPENING a
 * deck issued a PUT /autosave — bumping `version` (invalidating another
 * session's MAT-006A compare-and-swap token), inserting a version-history
 * snapshot of an unchanged deck, moving `updated_at`, and on the
 * `unified_json`-only path silently persisting a converted `deck_json`.
 *
 * These tests drive the real hook with a mocked `fetch`, so they assert on the
 * network call the browser would actually make — not on an internal flag.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { createRef, type MutableRefObject } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Deck } from '../../wizard/types';
import { type DeckAutosaveConflict, useDeckAutosave } from '../useDeckAutosave';

const DECK_ID = 'atelier--deck--line3-steering';

function makeDeck(title = 'Line 3 Digital Twin — Steering Committee Deck'): Deck {
  return {
    deck_id: DECK_ID,
    title,
    status: 'ready',
    cards: [
      { card_id: 'c1', order_index: 0, title: 'Cover', blocks: [] },
      { card_id: 'c2', order_index: 1, title: 'Executive summary', blocks: [] },
    ],
  } as unknown as Deck;
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function mutableRef<T>(value: T): MutableRefObject<T> {
  const ref = createRef<T>() as MutableRefObject<T>;
  ref.current = value;
  return ref;
}

interface HarnessProps {
  deck: Deck | null;
  paused?: boolean;
}

describe('useDeckAutosave — reopen must not write', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let onConflict: ReturnType<typeof vi.fn>;
  let fetchLatestDeck: ReturnType<typeof vi.fn>;
  let hasLoadedInitialRef: MutableRefObject<boolean>;
  let serverVersionRef: MutableRefObject<number>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn(async () => jsonResponse({ version: 5 }));
    onConflict = vi.fn();
    fetchLatestDeck = vi.fn(async () => ({ data: {} }));
    hasLoadedInitialRef = mutableRef(true);
    serverVersionRef = mutableRef(4);
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', {
      getItem: () => 'test-token',
      setItem: () => undefined,
      removeItem: () => undefined,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const renderAutosave = (initial: HarnessProps) =>
    renderHook(
      ({ deck, paused }: HarnessProps) =>
        useDeckAutosave({
          deckId: DECK_ID,
          deck,
          hasLoadedInitialRef,
          serverVersionRef,
          paused: Boolean(paused),
          onConflict: onConflict as (c: DeckAutosaveConflict) => void,
          fetchLatestDeck: fetchLatestDeck as (id: string) => Promise<any>,
        }),
      { initialProps: initial }
    );

  it('does not autosave the deck the loader just baselined (read-only reopen)', async () => {
    const loaded = makeDeck();
    const { result, rerender } = renderAutosave({ deck: null });

    // This is exactly what DeckBuilder's loader does: baseline, then set state.
    act(() => result.current.markPersisted(loaded));
    rerender({ deck: loaded });

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still autosaves once the user actually edits the deck', async () => {
    const loaded = makeDeck();
    const { result, rerender } = renderAutosave({ deck: null });
    act(() => result.current.markPersisted(loaded));
    rerender({ deck: loaded });
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(fetchMock).not.toHaveBeenCalled();

    const edited = makeDeck('Line 3 Digital Twin — Steering Committee Deck (rev B)');
    rerender({ deck: edited });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/presentations/decks/${DECK_ID}/autosave`);
    expect(init.method).toBe('PUT');
    expect((init.headers as Record<string, string>)['X-Deck-Version']).toBe('4');
    expect(JSON.parse(String(init.body)).title).toContain('rev B');
  });

  it('adopts the server version and does not re-save the state it just persisted', async () => {
    const loaded = makeDeck();
    const { result, rerender } = renderAutosave({ deck: null });
    act(() => result.current.markPersisted(loaded));
    rerender({ deck: loaded });

    const edited = makeDeck('edited once');
    rerender({ deck: edited });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    await waitFor(() => expect(serverVersionRef.current).toBe(5));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A re-render with the SAME deck (parent state churn, not an edit) must not
    // produce a second write.
    rerender({ deck: edited });
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not write while a version conflict is unresolved', async () => {
    const loaded = makeDeck();
    const { result, rerender } = renderAutosave({ deck: null });
    act(() => result.current.markPersisted(loaded));
    rerender({ deck: makeDeck('edited during conflict'), paused: true });

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces a 409 as a conflict and leaves the version token untouched', async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({ code: 'VERSION_CONFLICT', serverVersion: 9 }, 409)
    );
    fetchLatestDeck.mockImplementation(async () => ({
      data: {
        version: 9,
        title: 'Server copy',
        deck_json: JSON.stringify({ cards: [{ card_id: 's1' }], title: 'Server copy' }),
      },
    }));

    const loaded = makeDeck();
    const { result, rerender } = renderAutosave({ deck: null });
    act(() => result.current.markPersisted(loaded));
    rerender({ deck: makeDeck('local edit') });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    await waitFor(() => expect(onConflict).toHaveBeenCalledTimes(1));
    const conflict = onConflict.mock.calls[0][0] as DeckAutosaveConflict;
    expect(conflict.serverVersion).toBe(9);
    expect(conflict.pendingServer?.title).toBe('Server copy');
    // The rejected write must not advance our CAS token.
    expect(serverVersionRef.current).toBe(4);
  });

  it('does not write before the initial canonical load has completed', async () => {
    hasLoadedInitialRef.current = false;
    const { rerender } = renderAutosave({ deck: null });
    rerender({ deck: makeDeck('arrived before load flag') });

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  /**
   * ★ ONE AUTOSAVE OWNER (MAT-006B / P1).
   *
   * These drive the round trip itself: the PUT is held open so the test can act
   * while it is in flight. That window is where the two defects lived — the lost
   * update (an edit back to the previous baseline read as "no change" because the
   * baseline only advances on completion) and the second writer's overlapping,
   * differently-versioned PUT to the same endpoint.
   */
  describe('one writer, one queue, one version token', () => {
    /** A fetch whose responses the test releases by hand. */
    function deferredFetch() {
      const pending: Array<(res: Response) => void> = [];
      const impl = vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            pending.push(resolve);
          })
      );
      return { impl, pending };
    }

    const putBodies = () =>
      fetchMock.mock.calls
        .filter((call: any[]) => (call[1] as RequestInit | undefined)?.method === 'PUT')
        .map((call: any[]) => JSON.parse(String((call[1] as RequestInit).body)).title as string);

    /**
     * THE LOST UPDATE. Edit → save in flight → undo back to the previous state →
     * the old code compared against `persistedRef` (still the pre-save baseline),
     * saw "nothing changed", armed nothing, and let the in-flight write leave the
     * server holding the edit the user had just undone.
     */
    it('saves an edit that reverts to the previous baseline while a save is in flight', async () => {
      const { impl, pending } = deferredFetch();
      fetchMock.mockImplementation(impl);

      const baseline = makeDeck('baseline');
      const { result, rerender } = renderAutosave({ deck: null });
      act(() => result.current.markPersisted(baseline));
      rerender({ deck: baseline });

      // Edit → the debounce fires → PUT is in flight (held open).
      rerender({ deck: makeDeck('edit A') });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(putBodies()).toEqual(['edit A']);

      // Ctrl+Z inside the round trip: byte-identical to the baseline again.
      rerender({ deck: makeDeck('baseline') });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      // Still exactly one write — no second writer raced in.
      expect(putBodies()).toEqual(['edit A']);

      // The in-flight write lands.
      await act(async () => {
        pending[0](jsonResponse({ version: 5 }));
        await vi.advanceTimersByTimeAsync(1000);
      });

      // ...and the reverted state is written after it, so the server does not
      // keep the undone edit.
      expect(putBodies()).toEqual(['edit A', 'baseline']);
      expect(onConflict).not.toHaveBeenCalled();
      // The queued write carried the version the first one established.
      const [, secondInit] = fetchMock.mock.calls[1] as [string, RequestInit];
      expect((secondInit.headers as Record<string, string>)['X-Deck-Version']).toBe('5');
    });

    /**
     * An edit that lands DURING a save must be queued, not raced. Without the
     * single-writer mutex the debounce fires while the first PUT is still open
     * and a second one goes out concurrently — carrying the same
     * `X-Deck-Version`, so on a real server one of the two 409s, and which of
     * the two states survives depends on arrival order.
     */
    it('queues an edit made during an in-flight save instead of racing it', async () => {
      const { impl, pending } = deferredFetch();
      fetchMock.mockImplementation(impl);

      const baseline = makeDeck('baseline');
      const { result, rerender } = renderAutosave({ deck: null });
      act(() => result.current.markPersisted(baseline));
      rerender({ deck: baseline });

      rerender({ deck: makeDeck('edit A') });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(putBodies()).toEqual(['edit A']);

      // A genuinely different edit, and enough time for its debounce to fire
      // while the first write is still open.
      rerender({ deck: makeDeck('edit C') });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(putBodies()).toEqual(['edit A']);
      expect(pending).toHaveLength(1);

      await act(async () => {
        pending[0](jsonResponse({ version: 5 }));
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(putBodies()).toEqual(['edit A', 'edit C']);
      const [, secondInit] = fetchMock.mock.calls[1] as [string, RequestInit];
      expect((secondInit.headers as Record<string, string>)['X-Deck-Version']).toBe('5');
    });

    it('never runs two saves at once and does not duplicate an unchanged in-flight payload', async () => {
      const { impl, pending } = deferredFetch();
      fetchMock.mockImplementation(impl);

      const baseline = makeDeck('baseline');
      const { result, rerender } = renderAutosave({ deck: null });
      act(() => result.current.markPersisted(baseline));
      rerender({ deck: baseline });

      const edited = makeDeck('edit A');
      rerender({ deck: edited });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(putBodies()).toEqual(['edit A']);

      // Parent re-renders with the SAME content while the write is open — churn,
      // not an edit.
      rerender({ deck: makeDeck('edit A') });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(putBodies()).toEqual(['edit A']);

      await act(async () => {
        pending[0](jsonResponse({ version: 5 }));
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(putBodies()).toEqual(['edit A']);
      expect(serverVersionRef.current).toBe(5);
    });

    /**
     * A deck at version 7 — the case the deleted second loop got wrong by
     * construction, since its private token started at 1 and was never seeded
     * from the canonical load. Every write must carry the ONE token.
     */
    it('carries the loaded version on a deck whose server version is greater than 1', async () => {
      serverVersionRef.current = 7;
      fetchMock.mockImplementation(async () => jsonResponse({ version: 8 }));

      const baseline = makeDeck('baseline');
      const { result, rerender } = renderAutosave({ deck: null });
      act(() => result.current.markPersisted(baseline));
      rerender({ deck: baseline });

      rerender({ deck: makeDeck('edit A') });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      rerender({ deck: makeDeck('edit B') });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      const versions = fetchMock.mock.calls.map(
        (call: any[]) =>
          ((call[1] as RequestInit).headers as Record<string, string>)['X-Deck-Version']
      );
      expect(versions).toEqual(['7', '8']);
      expect(onConflict).not.toHaveBeenCalled();
    });

    it('leaves the baseline untouched when a save is rejected, and re-saves on the next edit', async () => {
      fetchMock.mockImplementation(async () => jsonResponse({ error: 'boom' }, 500));
      const onSaveStart = vi.fn();
      const onSaveSuccess = vi.fn();
      const onSaveError = vi.fn();

      const baseline = makeDeck('baseline');
      const { result, rerender } = renderHook(
        ({ deck }: HarnessProps) =>
          useDeckAutosave({
            deckId: DECK_ID,
            deck,
            hasLoadedInitialRef,
            serverVersionRef,
            paused: false,
            onConflict: onConflict as (c: DeckAutosaveConflict) => void,
            fetchLatestDeck: fetchLatestDeck as (id: string) => Promise<any>,
            onSaveStart,
            onSaveSuccess,
            onSaveError,
          }),
        { initialProps: { deck: null } as HarnessProps }
      );
      act(() => result.current.markPersisted(baseline));
      rerender({ deck: baseline });

      rerender({ deck: makeDeck('edit A') });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(onSaveStart).toHaveBeenCalledTimes(1);
      expect(onSaveError).toHaveBeenCalledTimes(1);
      expect(onSaveSuccess).not.toHaveBeenCalled();
      // The rejected write moved no version token...
      expect(serverVersionRef.current).toBe(4);

      // No retry storm: an untouched deck is left alone rather than re-PUT every
      // 800 ms until the tab closes.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(putBodies()).toEqual(['edit A']);

      // But the rejected payload did NOT become the baseline — the very same
      // content is written again as soon as the deck is touched.
      rerender({ deck: makeDeck('edit A') });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(putBodies()).toEqual(['edit A', 'edit A']);

      fetchMock.mockImplementation(async () => jsonResponse({ version: 5 }));
      rerender({ deck: makeDeck('edit B') });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(putBodies()).toEqual(['edit A', 'edit A', 'edit B']);
      expect(onSaveSuccess).toHaveBeenCalledTimes(1);
      expect(serverVersionRef.current).toBe(5);
    });

    /**
     * A restore (or an agent-edit accept) is an authoritative baseline that can
     * land while an ordinary save is still open. The stale response must not
     * un-baseline it — otherwise the very next render looks dirty and writes the
     * server's own freshly restored content straight back.
     */
    it('does not let a save that resolves after a restore write the restored deck back', async () => {
      const { impl, pending } = deferredFetch();
      fetchMock.mockImplementation(impl);

      const baseline = makeDeck('baseline');
      const { result, rerender } = renderAutosave({ deck: null });
      act(() => result.current.markPersisted(baseline));
      rerender({ deck: baseline });

      rerender({ deck: makeDeck('edit A') });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(putBodies()).toEqual(['edit A']);

      // The restore read-back arrives while the PUT is open.
      const restored = makeDeck('restored from history');
      act(() => result.current.markPersisted(restored));
      rerender({ deck: restored });

      await act(async () => {
        pending[0](jsonResponse({ version: 5 }));
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(putBodies()).toEqual(['edit A']);
      // The stale answer did not move the token the restore owns either.
      expect(serverVersionRef.current).toBe(4);
    });
  });
});
