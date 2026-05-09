/**
 * Consultify Execution-module UI/UX Standard — React hook
 * (Slice FE-E1.1).
 *
 * Loads a single execution-module manifest from
 * `/api/execution-modules/manifests/:moduleId` and exposes a
 * `{ manifest, isLoading, error, refetch }` envelope.
 *
 * Module-level cache: subsequent mounts of the same `moduleId` are
 * served from the in-memory cache so the manifest is fetched once
 * per page lifecycle. Pass `forceRefetch: true` to bypass the cache
 * (used by `refetch()` and for CI-driven re-validation).
 *
 * The cache is intentionally module-scoped (not per-tenant) — the
 * backend manifests are governance metadata with no tenant boundary
 * (see `server/src/routes/execution-modules.routes.ts` header).
 */

import { useCallback, useEffect, useState } from 'react';

import {
  ExecutionModuleNotFoundError,
  fetchExecutionModuleManifest,
} from './api';
import type { ExecutionModuleId, ExecutionModuleManifest } from './types';

// =============================================================================
// Module-level cache
// =============================================================================

const MANIFEST_CACHE = new Map<ExecutionModuleId, ExecutionModuleManifest>();

/**
 * Test-only — clear the cache between specs. Production callers
 * should use `refetch()` (or remount the consumer with a fresh
 * moduleId) instead of touching this directly.
 */
export function __resetExecutionModuleManifestCacheForTests(): void {
  MANIFEST_CACHE.clear();
}

// =============================================================================
// Hook
// =============================================================================

export interface UseExecutionModuleManifestResult {
  manifest: ExecutionModuleManifest | null;
  isLoading: boolean;
  error: Error | null;
  /** Re-fetches the manifest, bypassing the cache. */
  refetch: () => Promise<void>;
}

export interface UseExecutionModuleManifestOptions {
  /** When true, bypasses the cache on initial load. */
  forceRefetch?: boolean;
  /**
   * When true (default), unmounts skip state updates so a stale
   * fetch resolving after unmount does not cause a React warning.
   */
  abortOnUnmount?: boolean;
}

/**
 * React hook that returns the system-owned reference manifest for
 * the given moduleId. Returns `manifest: null` while loading and on
 * fatal error; the consumer can render a graceful loading / empty
 * state without checking `isLoading` separately.
 *
 * The hook does NOT throw on `module_not_found` — instead it sets
 * `error` to an `ExecutionModuleNotFoundError` and returns
 * `manifest: null` so the consumer renders an empty governance
 * banner rather than crashing the workspace.
 */
export function useExecutionModuleManifest(
  moduleId: ExecutionModuleId,
  options: UseExecutionModuleManifestOptions = {}
): UseExecutionModuleManifestResult {
  const { forceRefetch = false, abortOnUnmount = true } = options;
  const [manifest, setManifest] = useState<ExecutionModuleManifest | null>(
    () => MANIFEST_CACHE.get(moduleId) ?? null
  );
  const [isLoading, setIsLoading] = useState<boolean>(
    () => !MANIFEST_CACHE.has(moduleId) || forceRefetch
  );
  const [error, setError] = useState<Error | null>(null);

  const fetchManifest = useCallback(
    async (signal: { cancelled: boolean }, bypassCache: boolean): Promise<void> => {
      try {
        if (!bypassCache) {
          const cached = MANIFEST_CACHE.get(moduleId);
          if (cached) {
            if (signal.cancelled) return;
            setManifest(cached);
            setError(null);
            setIsLoading(false);
            return;
          }
        }
        setIsLoading(true);
        setError(null);
        const next = await fetchExecutionModuleManifest(moduleId);
        if (signal.cancelled) return;
        MANIFEST_CACHE.set(moduleId, next);
        setManifest(next);
      } catch (err) {
        if (signal.cancelled) return;
        // Cache miss for not-found is intentional — leave the cache
        // empty so a follow-up refetch (after a server-side
        // remediation) can re-attempt the request.
        if (err instanceof ExecutionModuleNotFoundError) {
          setManifest(null);
        }
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!signal.cancelled) setIsLoading(false);
      }
    },
    [moduleId]
  );

  useEffect(() => {
    const signal = { cancelled: false };
    void fetchManifest(signal, forceRefetch);
    return () => {
      if (abortOnUnmount) signal.cancelled = true;
    };
  }, [fetchManifest, forceRefetch, abortOnUnmount]);

  const refetch = useCallback(async (): Promise<void> => {
    const signal = { cancelled: false };
    await fetchManifest(signal, true);
  }, [fetchManifest]);

  return { manifest, isLoading, error, refetch };
}
