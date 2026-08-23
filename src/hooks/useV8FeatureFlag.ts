/**
 * useV8FeatureFlag Hook
 * React Query hook for checking V8 feature flag availability per module.
 */

import { useQuery } from '@tanstack/react-query';

import { V8AdminApi } from '@/services/api/v8';

const V8_FLAG_QUERY_KEY = ['v8', 'flags'] as const;

export function useV8FeatureFlag(module?: string, enabled = true) {
  const {
    data: flags,
    isLoading,
    error,
  } = useQuery({
    queryKey: V8_FLAG_QUERY_KEY,
    queryFn: async () => {
      try {
        const flags = await V8AdminApi.getFlags();

        // Keep the shell capability check aligned with the server's
        // `isV8Enabled()` contract. In non-production the backend deliberately
        // allows a tenant with no materialised flag rows when
        // ENABLE_V8_GLOBAL is on, so a freshly prepared local review tenant can
        // use V8 without an artificial per-org bootstrap step. Production stays
        // fail-closed and still requires explicit tenant flags.
        if (import.meta.env.DEV && Object.keys(flags).length === 0) {
          return { v8_enabled: true };
        }

        return flags;
      } catch {
        // V8 disabled globally (e.g. 404) or network failure — degrade without throwing
        return {} as Record<string, boolean>;
      }
    },
    enabled,
    staleTime: 60_000,
    retry: false,
  });

  const isEnabled = module ? flags?.[module] === true : Object.values(flags ?? {}).some(Boolean);

  return { isEnabled, isLoading, error, flags };
}
