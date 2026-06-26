/**
 * useBundleList — W3.6 hook: lista bundli AI wygenerowanych dla bieżącej org.
 * Odpytuje GET /bundles przy każdym montaży i po `refetch()`.
 */
import { useCallback, useEffect, useState } from 'react';
import { listBundles, type BundleListItem } from '../../services/deliverablesBundle';

export interface UseBundleListResult {
  bundles: BundleListItem[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useBundleList(): UseBundleListResult {
  const [bundles, setBundles] = useState<BundleListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listBundles()
      .then((data) => { if (!cancelled) { setBundles(data); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError('Failed to load bundles'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [tick]);

  return { bundles, loading, error, refetch };
}
