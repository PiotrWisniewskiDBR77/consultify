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
import { useVersionHistory } from '../useVersionHistory';

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

    let restored: Deck | null = null;
    await act(async () => {
      restored = await result.current.restoreVersion('ver-1');
    });

    expect(restored).not.toBeNull();
    expect((restored as unknown as Deck).title).toBe('Restored Deck');
    expect((restored as unknown as Deck).deck_id).toBe(DECK_ID);
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
    let restored: Deck | null = makeDeck();
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
    let restored: Deck | null = null;
    await act(async () => {
      restored = await result.current.restoreVersion(checkpoint!.id);
    });

    // Local restore returns the cached deck JSON and makes no extra fetch.
    expect(restored).not.toBeNull();
    expect((restored as unknown as Deck).deck_id).toBe(DECK_ID);
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });
});
