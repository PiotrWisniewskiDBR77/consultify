/**
 * `useDeckAutosave` — THE deck's only autosave writer (MAT-006B).
 *
 * BUG 1 (fixed earlier) — write on read-only reopen
 * -------------------------------------------------
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
 * when the current deck serializes identically.
 *
 * BUG 2 (fixed here) — LOST UPDATE ACROSS AN IN-FLIGHT SAVE
 * ---------------------------------------------------------
 * `persistedRef` is only advanced when a PUT succeeds, so while a save is in
 * flight it still names the PREVIOUS state. That made an edit-and-revert inside
 * the round trip disappear:
 *
 *   baseline B → user edits to A → 800 ms → PUT(A) in flight
 *   → user presses Ctrl+Z (or drags back), deck is byte-identical to B again
 *   → the effect compares B with `persistedRef` (still B) and returns WITHOUT
 *     arming a timer
 *   → PUT(A) resolves 200; the server permanently holds A while the screen
 *     shows B, `hasUnsavedChanges` stays false and `beforeunload` says nothing.
 *
 * FIX: change detection compares against what the server will hold once the
 * in-flight write settles (`inFlightPayloadRef ?? persistedRef`), and every
 * completed save re-checks the live deck and re-arms itself if it moved. So:
 *   - at most ONE save is in flight at a time (`inFlightPayloadRef` is the
 *     mutex — a flush that finds it set returns and lets the completion re-arm);
 *   - the "queue" of pending changes is `deckRef`, i.e. the latest deck. Edits
 *     coalesce, none is dropped;
 *   - only a 2xx advances the baseline, the version token, or reports a save.
 *
 * BUG 3 (fixed by deletion, see `useVersionHistory`) — two writers
 * ----------------------------------------------------------------
 * `useVersionHistory` used to run a SECOND, independent 30 s `setInterval` PUT
 * to this same endpoint, with its own baseline and its own version token that
 * was never seeded from the canonical load (it started at 1, so on any deck
 * with `version > 1` it 409-ed by construction and dispatched a
 * `deck-version-conflict` event nobody listened for). That loop is gone; this
 * hook is now the single owner of the write path and of the CAS token, and it
 * reports save start / success / failure back so the version-history timeline
 * and the "Saving…/Saved" state stay driven by real writes.
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
  /**
   * THE version token for the compare-and-swap, owned by `DeckBuilder` and
   * seeded from the canonical load. Updated in place on a successful save.
   * There is deliberately no second token anywhere in the builder.
   */
  serverVersionRef: MutableRefObject<number>;
  /** True while an unresolved 409 banner is on screen — autosave pauses. */
  paused: boolean;
  onConflict: (conflict: DeckAutosaveConflict) => void;
  /** Fetch the latest canonical row so "Reload latest" is instant. */
  fetchLatestDeck: (deckId: string) => Promise<any>;
  debounceMs?: number;
  /** A write left the browser. Drives the "Saving…" indicator. */
  onSaveStart?: () => void;
  /** The server ACCEPTED this exact deck state. The only place baselines move. */
  onSaveSuccess?: (savedDeck: Deck, serverVersion: number | null) => void;
  /** The write failed (non-2xx, 409 or network). No baseline may move. */
  onSaveError?: () => void;
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
  onSaveStart,
  onSaveSuccess,
  onSaveError,
}: UseDeckAutosaveParams): { markPersisted: (deck: Deck | null) => void } {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** What the server is known to hold. Only a 2xx write moves this. */
  const persistedRef = useRef<string | null>(null);
  /** Payload of the single write currently in flight — also the write mutex. */
  const inFlightPayloadRef = useRef<string | null>(null);
  /**
   * Bumped whenever an AUTHORITATIVE baseline arrives (loader, restore read-back,
   * agent-edit accept, conflict reload) or the deck changes. A save that resolves
   * after such an event must not overwrite the newer baseline with its own, older
   * payload — doing so would make the next render look "dirty" and write the
   * server's own freshly restored content straight back.
   */
  const baselineEpochRef = useRef(0);

  // Live values for the async flush, which runs outside the render that armed it.
  const deckRef = useRef<Deck | null>(deck);
  const deckIdRef = useRef<string | undefined>(deckId);
  const pausedRef = useRef(paused);
  const debounceRef = useRef(debounceMs);
  const callbacksRef = useRef({
    onConflict,
    fetchLatestDeck,
    onSaveStart,
    onSaveSuccess,
    onSaveError,
  });
  deckRef.current = deck;
  deckIdRef.current = deckId;
  pausedRef.current = paused;
  debounceRef.current = debounceMs;
  callbacksRef.current = { onConflict, fetchLatestDeck, onSaveStart, onSaveSuccess, onSaveError };

  /**
   * Declare a deck state as already persisted, so it does not trigger a write.
   * Called by the loader after the canonical GET (initial open AND the
   * read-back that follows a version restore) and after a successful save.
   */
  const markPersisted = useCallback((next: Deck | null) => {
    persistedRef.current = serializeDeck(next);
    baselineEpochRef.current += 1;
  }, []);

  const flushRef = useRef<() => Promise<void>>(async () => {});

  const scheduleFlush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void flushRef.current();
    }, debounceRef.current);
  }, []);

  const flush = useCallback(async () => {
    const id = deckIdRef.current;
    const current = deckRef.current;
    if (!id || !current) return;
    if (!hasLoadedInitialRef.current) return;
    if (pausedRef.current) return;
    // ONE WRITER AT A TIME. A flush that lands mid-save does nothing: the
    // completion below re-reads the live deck and re-arms if it moved, so the
    // edit is queued rather than raced or dropped.
    if (inFlightPayloadRef.current !== null) return;

    const payload = serializeDeck(current);
    if (payload === null) return;
    if (payload === persistedRef.current) return;

    const epoch = baselineEpochRef.current;
    inFlightPayloadRef.current = payload;
    callbacksRef.current.onSaveStart?.();
    try {
      const res = await fetch(`/api/presentations/decks/${id}/autosave`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'X-Deck-Version': String(serverVersionRef.current),
        },
        body: payload,
      });
      if (res.status === 409) {
        // P3.1 — another session advanced the deck's version. DO NOT silently
        // clobber the local (unsaved) edits with the server copy. Fetch the
        // latest so we can offer an instant reload, then raise a visible
        // conflict banner and stop autosaving until the user resolves it.
        const conflictPayload = await res.json().catch(() => ({}));
        let serverVersion: number | null =
          typeof conflictPayload?.serverVersion === 'number' ? conflictPayload.serverVersion : null;
        let pendingServer: { deckJson: any; title: string } | null = null;
        try {
          const latest = await callbacksRef.current.fetchLatestDeck(id);
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
        // A rejected write is not a save: no baseline, no version token, and
        // `hasUnsavedChanges` stays true so `beforeunload` still warns.
        callbacksRef.current.onSaveError?.();
        callbacksRef.current.onConflict({ serverVersion, pendingServer });
        return;
      }

      if (!res.ok) {
        callbacksRef.current.onSaveError?.();
        return;
      }

      const responsePayload = await res.json().catch(() => ({}));
      const version =
        typeof responsePayload?.version === 'number' ? (responsePayload.version as number) : null;
      // A newer authoritative baseline (restore / accept / reload / deck switch)
      // landed while this write was in flight — its answer is now stale, so it
      // may inform nothing. Reporting the save would move the timeline and the
      // token backwards.
      if (baselineEpochRef.current !== epoch || deckIdRef.current !== id) return;
      if (version !== null) serverVersionRef.current = version;
      persistedRef.current = payload;
      callbacksRef.current.onSaveSuccess?.(current, version);
    } catch {
      // Non-blocking; builder remains usable offline-ish.
      callbacksRef.current.onSaveError?.();
    } finally {
      inFlightPayloadRef.current = null;
      // THE QUEUE: whatever the user did while this write was in flight is in
      // `deckRef`. Re-arm only if the deck actually MOVED since this write left
      // (`latest !== payload`) and still differs from what the server holds.
      //
      // That first clause is what keeps a failed save from becoming a retry
      // storm: after a 500 the baseline has not advanced, so "differs from the
      // server" stays true forever and an unconditional re-arm would PUT every
      // 800 ms until the tab closes. A deck nobody touched is left alone
      // (`hasUnsavedChanges` stays true; the next edit retries), while a queued
      // edit — the edit-then-revert lost update — is still saved.
      if (deckIdRef.current === id && !pausedRef.current) {
        const latest = serializeDeck(deckRef.current);
        if (latest !== null && latest !== payload && latest !== persistedRef.current) {
          scheduleFlush();
        }
      }
    }
  }, [hasLoadedInitialRef, serverVersionRef, scheduleFlush]);
  flushRef.current = flush;

  // A different deck means a different baseline; drop the previous one so a
  // coincidentally identical payload cannot suppress the first real save, and
  // disown any write still in flight for the deck we just left.
  useEffect(() => {
    persistedRef.current = null;
    baselineEpochRef.current += 1;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [deckId]);

  useEffect(() => {
    if (!deckId || !deck) return;
    if (!hasLoadedInitialRef.current) return;
    // P3.1 — pause autosave while an unresolved version conflict is on screen.
    // Autosaving again would just re-trigger the same 409 loop; the user must
    // pick "Reload latest" or "Keep my version" first.
    if (paused) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const payload = serializeDeck(deck);
    if (payload === null) return;
    // What the server will hold once everything in flight settles. Comparing
    // against `persistedRef` alone is what made the revert read as "nothing
    // changed"; the completion handler below closes the same hole from the other
    // side, so this line is belt-and-braces (reverting it alone does not fail a
    // test) — it keeps the decision correct HERE instead of depending on a
    // completion that a deck switch or an unmount can skip.
    const settled = inFlightPayloadRef.current ?? persistedRef.current;
    // MAT-006B — nothing changed since that state, so this render is a reopen or
    // a no-op re-render, not an edit. Do not write.
    if (payload === settled) return;

    scheduleFlush();
  }, [deckId, deck, paused, hasLoadedInitialRef, scheduleFlush]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  return { markPersisted };
}
