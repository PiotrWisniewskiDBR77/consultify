/**
 * W11 — two-way sync between context drafts and
 * the per-org backend store at /api/organization-context-store.
 *
 * Call once from OrganizationView. On mount it loads the server state and
 * hydrates the zustand store. On every store change it debounce-saves back.
 * localStorage remains an offline/fast-read cache for context drafts only.
 * Organization profile is deliberately excluded: its sole writer is
 * /api/organization-profiles/:orgId.
 */
import { useEffect, useRef } from 'react';

import { getHeaders } from '@/services/api';
import { useContextBuilderStore } from '@/store/useContextBuilderStore';

const API_URL = '/api/organization-context-store';
const DEBOUNCE_MS = 1500;

interface SyncResult {
  isSyncing: boolean;
}

export function useOrgContextSync(isAuthenticated: boolean): SyncResult {
  const isMounted = useRef(false);
  const isSyncing = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDone = useRef(false);

  // Load from server once on mount
  useEffect(() => {
    if (!isAuthenticated || initialLoadDone.current) return;
    initialLoadDone.current = true;

    fetch(API_URL, { headers: getHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const { goals, challenges, synthesis } = data;
        const store = useContextBuilderStore.getState();
        if (goals && Object.keys(goals).length) store.setGoals(goals);
        if (challenges && Object.keys(challenges).length) store.setChallenges(challenges);
        if (synthesis && Object.keys(synthesis).length) store.setSynthesis(synthesis);
      })
      .catch(() => {
        // Server unreachable — localStorage state is the fallback, no action needed
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
        isSyncing.current = true;
        fetch(API_URL, {
          method: 'PUT',
          headers: { ...getHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ goals, challenges, synthesis }),
        })
          .catch(() => {
            // Best-effort — localStorage is still the source of truth for offline
          })
          .finally(() => {
            isSyncing.current = false;
          });
      }, DEBOUNCE_MS);
    });

    return () => {
      isMounted.current = false;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      unsub();
    };
  }, [isAuthenticated]);

  return { isSyncing: isSyncing.current };
}
