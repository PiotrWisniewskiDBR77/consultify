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
});
