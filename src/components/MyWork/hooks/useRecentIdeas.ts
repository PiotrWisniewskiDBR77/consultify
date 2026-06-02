/**
 * useRecentIdeas — tracks the most recently opened ideas (per device) so the
 * My Work / Ideas home can surface a "Recently opened" rail, matching the
 * enterprise SaaS home-shell pattern (Miro/FigJam recents).
 *
 * v1 is localStorage-backed (no server round-trip / migration). A server-backed
 * `last_opened_at` can supersede this later for cross-device recents.
 */

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'consultify.mywork.ideas.recents';
export const MAX_RECENT_IDEAS = 8;

/**
 * Pure reducer: prepend `id`, drop any earlier occurrence (dedupe), cap to
 * `max`. Most-recent-first. Exported for unit testing.
 */
export function computeNextRecents(prev: string[], id: string, max = MAX_RECENT_IDEAS): string[] {
  if (!id) return prev;
  return [id, ...prev.filter((x) => x !== id)].slice(0, max);
}

function readRecents(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENT_IDEAS);
  } catch {
    return [];
  }
}

function writeRecents(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore quota / serialization errors */
  }
}

export interface UseRecentIdeasReturn {
  /** Recently opened idea IDs, most-recent-first (max MAX_RECENT_IDEAS). */
  recentIds: string[];
  /** Record an idea as just-opened. */
  record: (id: string) => void;
}

export function useRecentIdeas(): UseRecentIdeasReturn {
  const [recentIds, setRecentIds] = useState<string[]>(() => readRecents());

  // Keep multiple mounted instances / tabs roughly in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setRecentIds(readRecents());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const record = useCallback((id: string) => {
    if (!id) return;
    setRecentIds((prev) => {
      const next = computeNextRecents(prev, id);
      writeRecents(next);
      return next;
    });
  }, []);

  return { recentIds, record };
}

export default useRecentIdeas;
