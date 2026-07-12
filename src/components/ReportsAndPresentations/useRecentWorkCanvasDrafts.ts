/**
 * useRecentWorkCanvasDrafts — #83e "From canvas" launcher step.
 *
 * Lists the user's recent Work Canvas drafts (GET /work-canvas/drafts, no
 * conversationId filter → server returns everything the caller can see:
 * created_by/owner_id + project-visible, ordered by updated_at DESC — see
 * server/src/routes/work-canvas.routes.ts router.get('/drafts', …)).
 *
 * Plain fetch (not services/api.ts) — mirrors duplicateArtifactToDraft.ts in
 * this same folder, which avoids the api.ts → @/i18n import chain that
 * OutputsLauncherModal.test.tsx explicitly mocks around.
 *
 * Fail-soft by construction (mirrors the backend route): a transient error
 * degrades to an empty list + error message, never throws into the UI.
 */

import { useCallback, useEffect, useState } from 'react';

export interface RecentCanvasDraft {
  id: string;
  title: string;
  kind: string;
  updatedAt: string;
}

/** Cap the launcher picker to the most recently touched canvases. */
const MAX_RECENT = 8;

function authToken(): string {
  return typeof window !== 'undefined' ? window.localStorage.getItem('token') || '' : '';
}

export function useRecentWorkCanvasDrafts(enabled: boolean) {
  const [drafts, setDrafts] = useState<RecentCanvasDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = authToken();
      const res = await fetch('/api/work-canvas/drafts', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json().catch(() => ({}));
      const rows: unknown[] = Array.isArray(json?.data) ? json.data : [];
      const mapped: RecentCanvasDraft[] = rows
        .map((raw) => {
          const d = raw as Record<string, unknown>;
          return {
            id: String(d.id ?? d.draftId ?? ''),
            title: String(d.title ?? '').trim() || 'Untitled canvas',
            kind: String(d.kind ?? 'markdown'),
            updatedAt: String(d.updatedAt ?? d.updated_at ?? ''),
          };
        })
        .filter((d) => d.id)
        .slice(0, MAX_RECENT);
      setDrafts(mapped);
    } catch {
      setDrafts([]);
      setError('Nie udało się załadować listy canvasów.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refetch();
  }, [enabled, refetch]);

  return { drafts, loading, error, refetch };
}
