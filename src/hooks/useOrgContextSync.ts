/**
 * W11 — two-way sync between useContextBuilderStore (localStorage) and
 * the per-org backend store at /api/organization-context-store.
 *
 * Call once from OrganizationView. On mount it loads the server state and
 * hydrates the zustand store. On every store change it debounce-saves back.
 * localStorage remains as an offline/fast-read cache.
 *
 * FAZA 2 (DEC-2026-08-24-15, warunek a) — two bugs found and fixed on a real
 * live-runtime cold-readback proof (Docker Postgres), both root-caused by
 * instrumenting every write with call-site tracing and a mount/unmount
 * probe — neither was visible from code review alone:
 *
 * 1. Five redesign screens' „Zapisz zmiany" buttons used to run their OWN
 *    independent PUT+readback cycle against this same endpoint — a SECOND
 *    writer racing the debounced auto-save below. Fixed by making this hook
 *    the SINGLE writer: `saveNow()` cancels any pending debounce and runs
 *    through the same serialized queue as the auto-save. Screens call
 *    `saveNow()` instead of hitting the API directly (see
 *    `useOrgContextStoreSection`).
 *
 * 2. Even with a single writer, the bug still reproduced. Root cause: the
 *    "load from server once on mount" effect below calls `store.setGoals`/
 *    `setChallenges`/`setSynthesis` whenever the server envelope has ANY
 *    keys — which is virtually always true (the envelope is a fully-shaped
 *    object with e.g. `kpis: []`, not an empty `{}`, once ANYTHING has ever
 *    been saved for the org). That hydration write is itself a zustand
 *    mutation, so the debounced-autosave subscriber below reacted to it and
 *    scheduled a save-back of data that just came FROM the server — a
 *    redundant, purely-timing-driven write on every page load/reload. If a
 *    user (or a cold-readback test doing an edit shortly after load) saved
 *    within that window, the hydration-triggered auto-save and the user's
 *    explicit save both ended up queued, and even serialized, one of them
 *    could observe a readback whose version was already advanced by the
 *    other — tripping "readback did not match the persisted write" even
 *    though each individual write was internally consistent. Fixed with
 *    `hydratingRef`: the subscriber ignores store mutations that happen
 *    while the hydration effect is actively applying server data, so
 *    hydrating never itself schedules a save-back.
 *
 * 3. Even with #1 and #2 fixed and the network log showing exactly ONE
 *    clean PUT+GET pair per save, the banner STILL reproduced. Root cause:
 *    `stableContext` compared readback vs. intended with plain
 *    `JSON.stringify` — key-order-sensitive — but PostgreSQL JSONB storage
 *    does not guarantee an object's key order survives a write+read round
 *    trip. A content-identical readback with reordered object keys failed
 *    this check every time, with zero duplicate writers involved. Fixed by
 *    making `stableContext` canonical (sorts object keys recursively;
 *    arrays keep their order, which IS meaningful there).
 *
 * All three were verified by reproducing the failure on live Postgres
 * (banner visible, full network+console trace), then confirming each
 * cleared in turn after its fix — not by reasoning about the code alone
 * (CLAUDE.md golden rule: verify the real runtime).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { getHeaders } from '@/services/api';
import { useContextBuilderStore } from '@/store/useContextBuilderStore';

const API_URL = '/api/organization-context-store';
const DEBOUNCE_MS = 1500;

export interface SyncResult {
  isSyncing: boolean;
  isUnsynced: boolean;
  error: string | null;
  persistedVersion: string | null;
  /**
   * Cancels any pending debounced auto-save and immediately runs (or waits
   * for) one serialized PUT + readback cycle for the CURRENT store state.
   * Resolves `true` on a verified save, `false` on failure (state/error are
   * updated the same way as the auto-save path either way).
   */
  saveNow: () => Promise<boolean>;
}

interface ContextEnvelope {
  goals?: Record<string, unknown>;
  challenges?: Record<string, unknown>;
  synthesis?: Record<string, unknown>;
  version?: string | null;
}

/**
 * Canonical (key-order-independent) stringify. `JSON.stringify` alone is
 * key-order-sensitive, and PostgreSQL JSONB storage does NOT guarantee that
 * an object's key order survives a write+read round trip — a THIRD bug
 * found on the same live-runtime proof as the two documented in the header:
 * `stableContext` used to be a plain `JSON.stringify`, so a readback whose
 * JSONB columns came back with reordered (but content-identical) keys
 * failed this check and tripped the same "readback did not match" error,
 * with ZERO duplicate writers involved — reproduced with a single, isolated
 * PUT+GET pair. Arrays keep their order (it's semantically meaningful
 * there); only object key order is normalized.
 */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function stableContext(value: { goals?: unknown; challenges?: unknown; synthesis?: unknown }) {
  return stableStringify({
    goals: value.goals ?? {},
    challenges: value.challenges ?? {},
    synthesis: value.synthesis ?? {},
  });
}

/**
 * Module-level (not per-hook-instance) serialization lock for every PUT+GET
 * pair. Deliberately outside the hook so that even an unexpected extra
 * mounted instance (e.g. a stray remount) can never race a write against
 * one started by another instance — belt-and-suspenders on top of fix #1
 * above, which already makes screens funnel through a single `saveNow`.
 */
let globalSyncQueue: Promise<boolean> = Promise.resolve(true);

export function useOrgContextSync(isAuthenticated: boolean): SyncResult {
  const isMounted = useRef(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUnsynced, setIsUnsynced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [persistedVersion, setPersistedVersion] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDone = useRef(false);
  // True while the hydration effect below is applying server data to the
  // store — see fix #2 in the header comment.
  const hydratingRef = useRef(false);

  // Load from server once on mount
  useEffect(() => {
    if (!isAuthenticated || initialLoadDone.current) return;
    initialLoadDone.current = true;

    fetch(API_URL, { headers: getHeaders() })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Organization context load failed (${r.status})`);
        return (await r.json()) as ContextEnvelope;
      })
      .then((data) => {
        const { goals, challenges, synthesis } = data;
        hydratingRef.current = true;
        try {
          const store = useContextBuilderStore.getState();
          if (goals && Object.keys(goals).length) store.setGoals(goals);
          if (challenges && Object.keys(challenges).length) store.setChallenges(challenges);
          if (synthesis && Object.keys(synthesis).length) store.setSynthesis(synthesis);
        } finally {
          hydratingRef.current = false;
        }
        setPersistedVersion(data.version ?? null);
        setError(null);
      })
      .catch((cause: unknown) => {
        setIsUnsynced(true);
        setError(cause instanceof Error ? cause.message : 'Organization context load failed');
      });
  }, [isAuthenticated]);

  const performSync = useCallback(async (): Promise<boolean> => {
    const { goals, challenges, synthesis } = useContextBuilderStore.getState();
    const intended = { goals, challenges, synthesis };
    setIsSyncing(true);
    setIsUnsynced(true);
    setError(null);
    try {
      const put = await fetch(API_URL, {
        method: 'PUT',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(intended),
      });
      if (!put.ok) throw new Error(`Organization context save failed (${put.status})`);
      const receipt = (await put.json()) as { version?: string | null };
      if (!receipt.version) throw new Error('Organization context save returned no version');

      const readbackResponse = await fetch(API_URL, { headers: getHeaders() });
      if (!readbackResponse.ok)
        throw new Error(`Organization context readback failed (${readbackResponse.status})`);
      const readback = (await readbackResponse.json()) as ContextEnvelope;
      if (readback.version !== receipt.version || stableContext(readback) !== stableContext(intended))
        throw new Error('Organization context readback did not match the persisted write');
      setPersistedVersion(receipt.version);
      setIsUnsynced(false);
      return true;
    } catch (cause: unknown) {
      setIsUnsynced(true);
      setError(cause instanceof Error ? cause.message : 'Organization context save failed');
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const enqueueSync = useCallback((): Promise<boolean> => {
    const next = globalSyncQueue.then(performSync, performSync);
    globalSyncQueue = next;
    return next;
  }, [performSync]);

  const saveNow = useCallback((): Promise<boolean> => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    return enqueueSync();
  }, [enqueueSync]);

  // Subscribe to store changes and debounce-save to server
  useEffect(() => {
    if (!isAuthenticated) return;
    isMounted.current = true;

    const unsub = useContextBuilderStore.subscribe(() => {
      if (!isMounted.current || !initialLoadDone.current || hydratingRef.current) return;

      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        debounceTimer.current = null;
        void enqueueSync();
      }, DEBOUNCE_MS);
    });

    return () => {
      isMounted.current = false;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      unsub();
    };
  }, [isAuthenticated, enqueueSync]);

  return { isSyncing, isUnsynced, error, persistedVersion, saveNow };
}
