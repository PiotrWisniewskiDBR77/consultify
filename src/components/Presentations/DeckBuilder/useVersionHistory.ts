/**
 * useVersionHistory — version snapshot management for decks. Creates named
 * in-session checkpoints every 5 min and provides undo to any previous version
 * with diff highlighting.
 *
 * ★ THIS HOOK IS NOT A WRITER (MAT-006B / P1)
 * -------------------------------------------
 * It used to run a second, independent autosave: a 30 s `setInterval` PUT to
 * `/autosave` — the SAME endpoint as `useDeckAutosave` — with its own baseline
 * (`lastSavedDeckRef`) and its own version token (`serverVersionRef`, hardcoded
 * to start at 1 and never seeded from the canonical load). Consequences:
 *
 *   - on any deck whose server `version` was > 1 (i.e. every deck that has ever
 *     been edited) that PUT sent `X-Deck-Version: 1` and 409-ed BY CONSTRUCTION,
 *     then dispatched a `deck-version-conflict` window event for which no
 *     listener exists anywhere in `src/` — a dead writer manufacturing false
 *     conflicts and, on the way, an audit row per attempt;
 *   - two writers meant two baselines and two in-flight windows for the same
 *     document, so "did this deck already save?" had no single answer.
 *
 * The loop is deleted. `useDeckAutosave` is the ONE writer and the ONE owner of
 * the compare-and-swap token; it calls `noteSaveStarted` / `notePersistedSave` /
 * `noteSaveFailed` here so the timeline, `lastSavedAt`, `isSaving` and
 * `hasUnsavedChanges` keep being driven by real, accepted writes.
 *
 * Server-side persistence (Module 12 audit gap #3)
 * ------------------------------------------------
 * Server-side snapshots (rows in `presentation_deck_versions`, written on
 * every autosave / agent-edit) are the durable source of truth — they
 * survive page refresh. On mount the hook fetches them from
 * `GET /presentations/decks/:deckId/versions` and merges them with the
 * ephemeral in-session snapshots (manual checkpoints + auto-saves) so the
 * panel shows a complete timeline. Restore of a server snapshot is
 * performed server-side via
 * `POST /presentations/decks/:deckId/versions/:versionId/restore`, then the
 * canonical deck is re-fetched and returned to the editor. Ephemeral
 * in-session snapshots still restore instantly from their cached JSON.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { Deck } from '../wizard/types';

/**
 * Outcome of {@link useVersionHistory}'s `restoreVersion`.
 *
 * `source` is what the caller needs in order to decide whether the deck it is
 * about to put into state is ALREADY the server's state:
 *   - `'server'` — the restore was performed server-side and the deck below is
 *     the canonical read-back. The caller MUST baseline it (`markPersisted`)
 *     so the debounced autosave does not write the server's own content back
 *     (version bump + an empty history snapshot + `updated_at` reorder).
 *   - `'session'` — an ephemeral in-session checkpoint restored from cached
 *     JSON. The server does NOT hold this content, so it must still autosave.
 */
export interface VersionRestoreResult {
  deck: Deck;
  source: 'server' | 'session';
  /** Server deck version after the restore; only ever set for `source: 'server'`. */
  serverVersion?: number;
}

export interface VersionSnapshot {
  id: string;
  timestamp: number;
  label: string;
  type: 'auto' | 'manual' | 'checkpoint';
  cardCount: number;
  summary: string;
  /** Cached deck JSON for instant local restore. Empty for server-only snapshots. */
  deckData: string;
  /** True when the snapshot lives in `presentation_deck_versions` and survives refresh. */
  persisted?: boolean;
}

interface VersionHistoryState {
  versions: VersionSnapshot[];
  historyStatus: 'loading' | 'available' | 'unavailable';
  isSaving: boolean;
  lastSavedAt: number | null;
  hasUnsavedChanges: boolean;
}

interface ServerVersionRow {
  id: string;
  deck_id?: string;
  version: number;
  slide_count?: number;
  created_by?: string;
  created_at?: string;
}

const SNAPSHOT_INTERVAL_MS = 300_000;
const MAX_VERSIONS = 50;
/**
 * A successful autosave writes a `presentation_deck_versions` row, so the
 * timeline needs re-reading — but the debounced writer can fire every second of
 * typing, and this GET is pure overhead when the history panel is closed. The
 * deleted 30 s loop refreshed at most twice a minute; keep that ceiling.
 */
const TIMELINE_REFRESH_THROTTLE_MS = 30_000;

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* localStorage unavailable (SSR / sandboxed) — proceed without auth header */
  }
  return headers;
}

function parseTimestamp(value?: string): number {
  if (!value) return Date.now();
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : Date.now();
}

/**
 * Parse a builder-native `deck_json` payload (the shape autosave stores) into a
 * {@link Deck}. Returns null when the payload is not a recognizable deck.
 */
function parseRestoredDeck(deckJsonRaw: unknown, deckId: string): Deck | null {
  let parsed: unknown = deckJsonRaw;
  if (typeof deckJsonRaw === 'string') {
    try {
      parsed = JSON.parse(deckJsonRaw);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const candidate = parsed as Record<string, unknown>;
  if (!Array.isArray(candidate.cards)) return null;
  return { ...(candidate as unknown as Deck), deck_id: deckId };
}

export function useVersionHistory(
  deck: Deck | null,
  deckId?: string | null,
  getExpectedVersion?: () => number | null,
  onServerVersion?: (version: number) => void
) {
  const resolvedDeckId = deckId ?? deck?.deck_id ?? null;
  const [state, setState] = useState<VersionHistoryState>({
    versions: [],
    historyStatus: resolvedDeckId ? 'loading' : 'available',
    isSaving: false,
    lastSavedAt: null,
    hasUnsavedChanges: false,
  });

  /** The deck state the SERVER is known to hold (loaded, restored, or saved). */
  const lastSavedDeckRef = useRef<string>('');
  /**
   * The deck currently on screen, serialized. Needed because a save reports back
   * asynchronously: when the user edited again while the write was in flight,
   * the accepted payload is NOT the current deck and `hasUnsavedChanges` must
   * stay true (otherwise `beforeunload` goes quiet over unsaved work).
   */
  const currentDeckRef = useRef<string>('');
  /** True between "a write left the browser" and its verdict. */
  const savePendingRef = useRef<boolean>(false);
  const snapshotTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const lastTimelineRefreshRef = useRef<number>(0);

  /** Merge persisted server snapshots into the timeline, de-duped by id. */
  const mergeServerVersions = useCallback((rows: ServerVersionRow[]) => {
    setState((prev) => {
      const localOnly = prev.versions.filter((v) => !v.persisted);
      const serverSnapshots: VersionSnapshot[] = rows
        .filter((row) => row && row.id != null)
        .map((row) => ({
          id: String(row.id),
          timestamp: parseTimestamp(row.created_at),
          label: `Version ${row.version}`,
          type: 'auto' as const,
          cardCount: Number(row.slide_count) || 0,
          summary: `${Number(row.slide_count) || 0} slides`,
          deckData: '',
          persisted: true,
        }));
      const merged = [...localOnly, ...serverSnapshots]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_VERSIONS);
      return { ...prev, versions: merged };
    });
  }, []);

  const fetchServerVersions = useCallback(async () => {
    if (!resolvedDeckId) return;
    setState((prev) => ({ ...prev, historyStatus: 'loading' }));
    try {
      const res = await fetch(`/api/presentations/decks/${resolvedDeckId}/versions`, {
        method: 'GET',
        headers: authHeaders(),
      });
      if (!res.ok) {
        setState((prev) => ({ ...prev, historyStatus: 'unavailable' }));
        return;
      }
      const body = (await res.json().catch(() => null)) as
        | { data?: ServerVersionRow[] }
        | ServerVersionRow[]
        | null;
      const rows = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
      mergeServerVersions(rows);
      setState((prev) => ({ ...prev, historyStatus: 'available' }));
    } catch {
      setState((prev) => ({ ...prev, historyStatus: 'unavailable' }));
    }
  }, [resolvedDeckId, mergeServerVersions]);

  // Hydrate persisted version history on mount / deck change so it survives refresh.
  useEffect(() => {
    void fetchServerVersions();
  }, [fetchServerVersions]);

  const createSnapshot = useCallback(
    (type: 'auto' | 'manual' | 'checkpoint', label?: string): VersionSnapshot | null => {
      if (!deck) return null;

      const serialized = JSON.stringify(deck);
      if (serialized === lastSavedDeckRef.current && type === 'auto') return null;

      const snapshot: VersionSnapshot = {
        id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        label: label || generateLabel(type, deck),
        type,
        cardCount: deck.cards.length,
        summary: generateSummary(deck),
        deckData: serialized,
      };

      setState((prev) => {
        const versions = [snapshot, ...prev.versions].slice(0, MAX_VERSIONS);
        return {
          ...prev,
          versions,
          lastSavedAt: Date.now(),
          hasUnsavedChanges: false,
          isSaving: false,
        };
      });

      lastSavedDeckRef.current = serialized;
      return snapshot;
    },
    [deck]
  );

  /** A write left the browser (reported by the ONE writer, `useDeckAutosave`). */
  const noteSaveStarted = useCallback(() => {
    savePendingRef.current = true;
    setState((prev) =>
      prev.isSaving ? prev : { ...prev, isSaving: true, hasUnsavedChanges: true }
    );
  }, []);

  /**
   * A write came back rejected (409, non-2xx or network). ★ NOTHING may move:
   * not `lastSavedDeckRef`, not `lastSavedAt`, not `hasUnsavedChanges`. An older
   * version of this file advanced all three on a 500 or a 403 — it showed
   * "Saved just now" and disarmed the `beforeunload` warning, so the user closed
   * the tab believing the work was safe.
   */
  const noteSaveFailed = useCallback(() => {
    savePendingRef.current = false;
    setState((prev) => ({
      ...prev,
      isSaving: false,
      hasUnsavedChanges: currentDeckRef.current !== lastSavedDeckRef.current,
    }));
  }, []);

  /**
   * The server ACCEPTED exactly this deck state. This is the only path that both
   * moves the persisted baseline and claims a save in the UI.
   */
  const notePersistedSave = useCallback(
    (persisted: Deck | null) => {
      if (!persisted) return;
      const serialized = JSON.stringify(persisted);
      lastSavedDeckRef.current = serialized;
      savePendingRef.current = false;
      setState((prev) => ({
        ...prev,
        isSaving: false,
        lastSavedAt: Date.now(),
        // The accepted payload is not necessarily what is on screen: the user
        // may have edited again while the PUT was in flight. Only the deck that
        // actually matches the server counts as saved.
        hasUnsavedChanges: currentDeckRef.current !== serialized,
      }));
      // Each accepted autosave writes a `presentation_deck_versions` row, so the
      // durable timeline moved — but re-read it at most twice a minute.
      const now = Date.now();
      if (now - lastTimelineRefreshRef.current >= TIMELINE_REFRESH_THROTTLE_MS) {
        lastTimelineRefreshRef.current = now;
        void fetchServerVersions();
      }
    },
    [fetchServerVersions]
  );

  const restoreVersion = useCallback(
    async (versionId: string): Promise<VersionRestoreResult | null> => {
      const version = state.versions.find((v) => v.id === versionId);
      if (!version) return null;

      // Ephemeral in-session snapshot — restore instantly from cached JSON.
      // The server does NOT hold this content, so the caller must let autosave
      // persist it; that is why `source` is 'session'.
      if (!version.persisted) {
        try {
          return { deck: JSON.parse(version.deckData) as Deck, source: 'session' };
        } catch {
          return null;
        }
      }

      // Persisted server snapshot — restore server-side, then re-fetch the
      // canonical deck so the editor reflects exactly what was written.
      if (!resolvedDeckId) return null;
      // ★ ONE TOKEN. The expected version is owned by `DeckBuilder` (seeded from
      // the canonical load, advanced by the single writer) and read through
      // `getExpectedVersion`. This hook keeps NO token of its own: the previous
      // fallback ref started at 1 and turned every restore on an edited deck
      // into a fabricated conflict. With no token available there is nothing
      // honest to compare and swap against, so we do not guess and do not write.
      const expectedVersion = getExpectedVersion?.();
      if (typeof expectedVersion !== 'number' || !Number.isFinite(expectedVersion)) return null;
      try {
        const restoreRes = await fetch(
          `/api/presentations/decks/${resolvedDeckId}/versions/${versionId}/restore`,
          {
            method: 'POST',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ expectedVersion }),
          }
        );
        if (!restoreRes.ok) return null;
        const restoreBody = (await restoreRes.json().catch(() => ({}))) as { version?: number };
        let serverVersion: number | undefined;
        if (restoreBody?.version) {
          serverVersion = restoreBody.version;
          onServerVersion?.(restoreBody.version);
        }

        const deckRes = await fetch(`/api/presentations/decks/${resolvedDeckId}`, {
          method: 'GET',
          headers: authHeaders(),
        });
        if (!deckRes.ok) return null;
        const deckBody = (await deckRes.json().catch(() => null)) as
          | { data?: Record<string, unknown> }
          | Record<string, unknown>
          | null;
        const row =
          deckBody && typeof deckBody === 'object' && 'data' in deckBody
            ? (deckBody.data as Record<string, unknown>)
            : (deckBody as Record<string, unknown> | null);
        // MAT-006B — the canonical read-back carries the deck's CURRENT version.
        // It outranks the restore response: it is what the next compare-and-swap
        // will be checked against. Without this the token can lag (older servers
        // answer the restore without a `version`) and the user's first real edit
        // after a restore 409s into the conflict banner for no reason.
        const canonicalVersion = row?.version;
        if (typeof canonicalVersion === 'number' && Number.isFinite(canonicalVersion)) {
          serverVersion = canonicalVersion;
          onServerVersion?.(canonicalVersion);
        }
        const restored = parseRestoredDeck(row?.deck_json, resolvedDeckId);
        // Refresh the timeline — restore also writes a new snapshot row.
        lastTimelineRefreshRef.current = Date.now();
        void fetchServerVersions();
        if (!restored) return null;
        // MAT-006B — this deck is the server's own state, freshly read back, so
        // it is already persisted: baseline it here and — via the returned
        // `source: 'server'` — in the writer too. Writing the restored content
        // straight back would bump the version the restore just synchronized,
        // append a version-history row recording no change, and reorder the
        // Materials list by `updated_at`.
        lastSavedDeckRef.current = JSON.stringify(restored);
        setState((prev) => ({
          ...prev,
          hasUnsavedChanges: false,
          lastSavedAt: Date.now(),
        }));
        return { deck: restored, source: 'server', serverVersion };
      } catch {
        return null;
      }
    },
    [state.versions, resolvedDeckId, fetchServerVersions, getExpectedVersion, onServerVersion]
  );

  /**
   * MAT-006B — declare a deck state as already persisted on the SERVER, WITHOUT
   * claiming that a save just happened. Used by every site that puts server
   * truth into state: the loader, the restore read-back, the agent-edit accept,
   * "Reload latest".
   *
   * Deliberately does NOT touch `lastSavedAt`: on open there is nothing to
   * report as "just saved", and writing it would make the builder claim a save
   * that never happened. For an accepted write of our own use
   * {@link notePersistedSave} instead.
   */
  const markSaved = useCallback((persisted: Deck | null) => {
    if (!persisted) return;
    lastSavedDeckRef.current = JSON.stringify(persisted);
    setState((prev) => (prev.hasUnsavedChanges ? { ...prev, hasUnsavedChanges: false } : prev));
  }, []);

  const saveManualCheckpoint = useCallback(
    (label: string) => {
      createSnapshot('manual', label);
    },
    [createSnapshot]
  );

  // Track unsaved changes. Also records the on-screen deck so a save that
  // resolves after further edits cannot report them as saved.
  useEffect(() => {
    if (!deck) return;
    const serialized = JSON.stringify(deck);
    currentDeckRef.current = serialized;
    // ★ `savePendingRef` is why this is not just a string compare. Undo (or a
    // drag back) DURING an in-flight write makes the deck byte-identical to the
    // baseline again while the server is about to hold the OTHER state — calling
    // that "saved" would silence the `beforeunload` warning over work the writer
    // has not confirmed yet.
    const unsaved = serialized !== lastSavedDeckRef.current || savePendingRef.current;
    setState((prev) =>
      prev.hasUnsavedChanges === unsaved ? prev : { ...prev, hasUnsavedChanges: unsaved }
    );
  }, [deck]);

  // Snapshot timer (every 5 min)
  useEffect(() => {
    snapshotTimerRef.current = setInterval(() => {
      createSnapshot('checkpoint');
    }, SNAPSHOT_INTERVAL_MS);
    return () => clearInterval(snapshotTimerRef.current);
  }, [createSnapshot]);

  // Warn before unload if unsaved
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (state.hasUnsavedChanges) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state.hasUnsavedChanges]);

  return {
    ...state,
    createSnapshot,
    restoreVersion,
    saveManualCheckpoint,
    markSaved,
    // Reported BY the single writer (`useDeckAutosave`) — this hook no longer
    // writes anything itself.
    noteSaveStarted,
    notePersistedSave,
    noteSaveFailed,
    refreshVersions: fetchServerVersions,
  };
}

function generateLabel(type: string, deck: Deck): string {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  switch (type) {
    case 'auto':
      return `Auto-save ${time}`;
    case 'checkpoint':
      return `Checkpoint ${time}`;
    default:
      return `Saved ${time}`;
  }
}

function generateSummary(deck: Deck): string {
  const totalBlocks = deck.cards.reduce((sum, c) => sum + c.blocks.length, 0);
  return `${deck.cards.length} cards, ${totalBlocks} blocks`;
}

/**
 * Compute a simple diff between two deck versions for UI highlighting.
 */
export function computeVersionDiff(
  oldDeck: Deck,
  newDeck: Deck
): {
  addedCards: string[];
  removedCards: string[];
  modifiedCards: string[];
} {
  const oldCardIds = new Set(oldDeck.cards.map((c) => c.card_id));
  const newCardIds = new Set(newDeck.cards.map((c) => c.card_id));

  const addedCards = newDeck.cards.filter((c) => !oldCardIds.has(c.card_id)).map((c) => c.card_id);
  const removedCards = oldDeck.cards
    .filter((c) => !newCardIds.has(c.card_id))
    .map((c) => c.card_id);

  const modifiedCards: string[] = [];
  for (const newCard of newDeck.cards) {
    if (!oldCardIds.has(newCard.card_id)) continue;
    const oldCard = oldDeck.cards.find((c) => c.card_id === newCard.card_id);
    if (oldCard && JSON.stringify(oldCard) !== JSON.stringify(newCard)) {
      modifiedCards.push(newCard.card_id);
    }
  }

  return { addedCards, removedCards, modifiedCards };
}
