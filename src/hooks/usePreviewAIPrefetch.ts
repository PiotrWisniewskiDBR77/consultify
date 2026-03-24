import { useCallback, useEffect, useRef, useState } from 'react';

import Api from '@/services/api';

interface PrefetchResult {
  brief: string | null;
  loading: boolean;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const HOVER_DELAY_MS = 1500;

const cache = new Map<string, { brief: string; ts: number }>();

function cacheKey(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

export function usePreviewAIPrefetch(
  entityType: string | null,
  entityId: string | null,
  enabled = true
): PrefetchResult {
  const [brief, setBrief] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(() => {
    cancel();
    setBrief(null);
    setLoading(false);

    if (!enabled || !entityType || !entityId) return;

    const key = cacheKey(entityType, entityId);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      setBrief(cached.brief);
      return;
    }

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = (await Api.post('/preview-ai/hints', {
          entityType,
          entityId,
        })) as { hints?: string[]; suggestedAction?: { label: string } };

        if (!controller.signal.aborted && res.hints?.length) {
          const text = res.suggestedAction?.label ?? res.hints[0];
          cache.set(key, { brief: text, ts: Date.now() });
          setBrief(text);
        }
      } catch {
        // Silently fail — prefetch is best-effort
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, HOVER_DELAY_MS);

    return cancel;
  }, [entityType, entityId, enabled, cancel]);

  return { brief, loading };
}
