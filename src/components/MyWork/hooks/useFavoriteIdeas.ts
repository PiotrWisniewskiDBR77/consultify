/**
 * useFavoriteIdeas — per-device "starred" ideas for the My Work / Ideas home,
 * matching the enterprise SaaS favorites pattern.
 *
 * v1 is localStorage-backed (no server round-trip / migration). A server-backed
 * `is_favorite` can supersede this later for cross-device favorites.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'consultify.mywork.ideas.favorites';

/** Pure toggle: add `id` if absent, remove if present. Exported for testing. */
export function toggleFavoriteId(ids: string[], id: string): string[] {
  if (!id) return ids;
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

function readFavorites(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}

function writeFavorites(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore quota / serialization errors */
  }
}

export interface UseFavoriteIdeasReturn {
  /** Set of starred idea IDs (for O(1) lookups). */
  favoriteIds: Set<string>;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
}

export function useFavoriteIdeas(): UseFavoriteIdeasReturn {
  const [ids, setIds] = useState<string[]>(() => readFavorites());

  // Keep multiple mounted instances / tabs roughly in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setIds(readFavorites());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const favoriteIds = useMemo(() => new Set(ids), [ids]);

  const isFavorite = useCallback((id: string) => favoriteIds.has(id), [favoriteIds]);

  const toggleFavorite = useCallback((id: string) => {
    if (!id) return;
    setIds((prev) => {
      const next = toggleFavoriteId(prev, id);
      writeFavorites(next);
      return next;
    });
  }, []);

  return { favoriteIds, isFavorite, toggleFavorite };
}

export default useFavoriteIdeas;
