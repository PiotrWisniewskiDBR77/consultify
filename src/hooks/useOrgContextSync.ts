/**
 * W11 — two-way sync between useContextBuilderStore (localStorage) and
 * the per-org backend store at /api/organization-context-store.
 *
 * Call once from OrganizationView. On mount it loads the server state and
 * hydrates the zustand store. On every store change it debounce-saves back.
 * localStorage remains as an offline/fast-read cache.
 */
import { useEffect, useRef, useState } from 'react';

import { getHeaders } from '@/services/api';
import { useContextBuilderStore } from '@/store/useContextBuilderStore';

const API_URL = '/api/organization-context-store';
const DEBOUNCE_MS = 1500;

interface SyncResult {
  isSyncing: boolean;
  isUnsynced: boolean;
  error: string | null;
  persistedVersion: string | null;
}

interface ContextEnvelope {
  goals?: Record<string, unknown>;
  challenges?: Record<string, unknown>;
  synthesis?: Record<string, unknown>;
  version?: string | null;
}

function stableContext(value: { goals?: unknown; challenges?: unknown; synthesis?: unknown }) {
  return JSON.stringify({
    goals: value.goals ?? {},
    challenges: value.challenges ?? {},
    synthesis: value.synthesis ?? {},
  });
}

export function useOrgContextSync(isAuthenticated: boolean): SyncResult {
  const isMounted = useRef(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUnsynced, setIsUnsynced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [persistedVersion, setPersistedVersion] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDone = useRef(false);

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
        const store = useContextBuilderStore.getState();
        if (goals && Object.keys(goals).length) store.setGoals(goals);
        if (challenges && Object.keys(challenges).length) store.setChallenges(challenges);
        if (synthesis && Object.keys(synthesis).length) store.setSynthesis(synthesis);
        setPersistedVersion(data.version ?? null);
        setError(null);
      })
      .catch((cause: unknown) => {
        setIsUnsynced(true);
        setError(cause instanceof Error ? cause.message : 'Organization context load failed');
      });
  }, [isAuthenticated]);

  // Subscribe to store changes and debounce-save to server
  useEffect(() => {
    if (!isAuthenticated) return;
    isMounted.current = true;

    const unsub = useContextBuilderStore.subscribe((state) => {
      if (!isMounted.current || !initialLoadDone.current) return;

      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        const { goals, challenges, synthesis } = useContextBuilderStore.getState();
        const intended = { goals, challenges, synthesis };
        setIsSyncing(true);
        setIsUnsynced(true);
        setError(null);
        void (async () => {
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
            if (
              readback.version !== receipt.version ||
              stableContext(readback) !== stableContext(intended)
            )
              throw new Error('Organization context readback did not match the persisted write');
            setPersistedVersion(receipt.version);
            setIsUnsynced(false);
          } catch (cause: unknown) {
            setIsUnsynced(true);
            setError(cause instanceof Error ? cause.message : 'Organization context save failed');
          } finally {
            setIsSyncing(false);
          }
        })();
      }, DEBOUNCE_MS);
    });

    return () => {
      isMounted.current = false;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      unsub();
    };
  }, [isAuthenticated]);

  return { isSyncing, isUnsynced, error, persistedVersion };
}
