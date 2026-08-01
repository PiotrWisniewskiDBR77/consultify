/**
 * Debounced deck autosave, extracted from `DeckBuilder` (MAT-006B).
 *
 * BUG THIS FIXES — write on read-only reopen
 * ------------------------------------------
 * The original effect fired on every change of the memoized `{deckId, deck}`
 * pair once `hasLoadedInitialRef` was set. Loading a deck sets that ref AND
 * replaces `deck` in the same commit, so simply OPENING a deck scheduled a PUT
 * `/autosave` 800 ms later, with no user edit. That write is not free:
 *
 *   - it bumps `presentation_decks.version`, invalidating any other session's
 *     expected-version token (the CAS that MAT-006A introduced);
 *   - it inserts a `presentation_deck_versions` snapshot, so version history
 *     fills with rows that record no change;
 *   - it moves `updated_at`, which reorders the Materials list on mere viewing;
 *   - on the `unified_json`-only path it PERSISTS the converted `deck_json` —
 *     a silent content mutation caused by opening a deck read-only;
 *   - it fires again after every restore read-back, immediately re-bumping the
 *     version the restore just synchronized.
 *
 * FIX: the hook keeps the deck state it last knows to be persisted (the loaded
 * document, or the payload of the last successful save) and skips the write
 * when the current deck serializes identically. Editing still saves — the
 * serialization differs the moment any card, block or title changes.
 */
import { type MutableRefObject, useCallback, useEffect, useRef } from 'react';

import type { Deck } from '../wizard/types';

export interface DeckAutosaveConflict {
  serverVersion: number | null;
  pendingServer: { deckJson: any; title: string } | null;
}

export interface UseDeckAutosaveParams {
  deckId: string | undefined;
  deck: Deck | null;
  /** Set once the initial canonical load has populated `deck`. */
  hasLoadedInitialRef: MutableRefObject<boolean>;
  /** Version token for the compare-and-swap; updated in place on success. */
  serverVersionRef: MutableRefObject<number>;
  /** True while an unresolved 409 banner is on screen — autosave pauses. */
  paused: boolean;
  onConflict: (conflict: DeckAutosaveConflict) => void;
  /** Fetch the latest canonical row so "Reload latest" is instant. */
  fetchLatestDeck: (deckId: string) => Promise<any>;
  debounceMs?: number;
}

/**
 * Stable serialization of the deck for change detection. `JSON.stringify` is
 * sufficient here because both sides of the comparison are produced by the same
 * code paths (the loader's object literal, or a structural update of it), so key
 * order is stable; an edit always changes at least one value.
 */
export function serializeDeck(deck: Deck | null): string | null {
  if (!deck) return null;
  try {
    return JSON.stringify(deck);
  } catch {
    return null;
  }
}

export function useDeckAutosave({
  deckId,
  deck,
  hasLoadedInitialRef,
  serverVersionRef,
  paused,
  onConflict,
  fetchLatestDeck,
  debounceMs = 800,
}: UseDeckAutosaveParams): { markPersisted: (deck: Deck | null) => void } {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistedRef = useRef<string | null>(null);

  /**
   * Declare a deck state as already persisted, so it does not trigger a write.
   * Called by the loader after the canonical GET (initial open AND the
   * read-back that follows a version restore) and after a successful save.
   */
  const markPersisted = useCallback((next: Deck | null) => {
    persistedRef.current = serializeDeck(next);
  }, []);

  // A different deck means a different baseline; drop the previous one so a
  // coincidentally identical payload cannot suppress the first real save.
  useEffect(() => {
    persistedRef.current = null;
  }, [deckId]);

  useEffect(() => {
    if (!deckId || !deck) return;
    if (!hasLoadedInitialRef.current) return;
    // P3.1 — pause autosave while an unresolved version conflict is on screen.
    // Autosaving again would just re-trigger the same 409 loop; the user must
    // pick "Reload latest" or "Keep my version" first.
    if (paused) return;

    const payload = serializeDeck(deck);
    // MAT-006B — nothing changed since the last known-persisted state, so this
    // render is a reopen or a no-op re-render, not an edit. Do not write.
    if (payload !== null && payload === persistedRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/presentations/decks/${deckId}/autosave`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'X-Deck-Version': String(serverVersionRef.current),
          },
          body: JSON.stringify(deck),
        });
        if (res.status === 409) {
          // P3.1 — another session advanced the deck's version. DO NOT silently
          // clobber the local (unsaved) edits with the server copy. Fetch the
          // latest so we can offer an instant reload, then raise a visible
          // conflict banner and stop autosaving until the user resolves it.
          const conflictPayload = await res.json().catch(() => ({}));
          let serverVersion: number | null =
            typeof conflictPayload?.serverVersion === 'number'
              ? conflictPayload.serverVersion
              : null;
          let pendingServer: { deckJson: any; title: string } | null = null;
          try {
            const latest = await fetchLatestDeck(deckId);
            const latestPayload =
              latest?.data && typeof latest.data === 'object' && 'data' in latest.data
                ? latest.data.data
                : latest?.data;
            if (typeof latestPayload?.version === 'number') {
              serverVersion = latestPayload.version;
            }
            const rawDeckJson = latestPayload?.deck_json;
            const latestDeckJson =
              typeof rawDeckJson === 'string'
                ? (() => {
                    try {
                      return JSON.parse(rawDeckJson);
                    } catch {
                      return null;
                    }
                  })()
                : rawDeckJson && typeof rawDeckJson === 'object'
                  ? rawDeckJson
                  : null;
            if (latestDeckJson && Array.isArray(latestDeckJson.cards)) {
              pendingServer = {
                deckJson: latestDeckJson,
                title: String(latestPayload?.title || latestDeckJson.title || 'Untitled'),
              };
            }
          } catch {
            /* keep whatever the 409 body told us */
          }
          onConflict({ serverVersion, pendingServer });
          return;
        }
        const responsePayload = await res.json().catch(() => ({}));
        if (typeof responsePayload?.version === 'number') {
          serverVersionRef.current = responsePayload.version;
        }
        // Only a write the server accepted may become the new baseline.
        if (res.ok) persistedRef.current = payload;
      } catch {
        // Non-blocking; builder remains usable offline-ish.
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [
    deckId,
    deck,
    paused,
    debounceMs,
    hasLoadedInitialRef,
    serverVersionRef,
    onConflict,
    fetchLatestDeck,
  ]);

  return { markPersisted };
}
