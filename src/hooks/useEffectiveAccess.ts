import { useCallback, useEffect, useMemo, useState } from 'react';

import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

export interface EffectiveAccess {
  applicationRole?: string;
  platformRole?: string | null;
  projectId?: string | null;
  projectRole?: string | null;
  capabilities: string[];
  scope?: string[];
  warnings?: string[];
}

export function capabilityMatches(capabilities: string[], capability: string): boolean {
  const set = new Set(capabilities);
  if (set.has('*') || set.has(capability)) return true;
  return ['.scoped', '.own', '.assigned', '.delegated'].some((suffix) =>
    set.has(`${capability}${suffix}`)
  );
}

export function useEffectiveAccess(projectId?: string | null) {
  const { currentUser, currentOrganization } = useAppStore();
  const [effectiveAccess, setEffectiveAccess] = useState<EffectiveAccess | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchAccess = async () => {
      if (!currentUser?.id) {
        setEffectiveAccess(null);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
        const response = await Api.get(`/access/effective${query}`);
        const access = response?.effectiveAccess || response?.data?.effectiveAccess || null;
        if (!cancelled) {
          setEffectiveAccess({
            ...access,
            capabilities: Array.isArray(access?.capabilities)
              ? access.capabilities.map(String)
              : [],
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
          setEffectiveAccess(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchAccess();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, currentOrganization?.id, projectId]);

  const capabilities = useMemo(() => effectiveAccess?.capabilities || [], [effectiveAccess]);
  const hasCapability = useCallback(
    (capability: string) => capabilityMatches(capabilities, capability),
    [capabilities]
  );
  const hasAnyCapability = useCallback(
    (items: string[]) => items.some((capability) => hasCapability(capability)),
    [hasCapability]
  );

  return {
    effectiveAccess,
    capabilities,
    hasCapability,
    hasAnyCapability,
    isLoading,
    error,
  };
}

export default useEffectiveAccess;
