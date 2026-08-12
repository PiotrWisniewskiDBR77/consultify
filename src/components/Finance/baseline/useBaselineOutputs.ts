/**
 * Pakiet F — odczyt `GET .../baseline/:id/outputs` dla `CalculationsView`.
 * Read-only (zapis dzieje się przez compute, nie przez ten hook).
 */
import { useCallback, useEffect, useState } from 'react';

import { listBaselineOutputs, type ListBaselineOutputsParams } from '@/services/api/financeV2.api';
import type { BaselineOutputDto } from '@/services/api/financeV2.types';

export interface UseBaselineOutputsResult {
  outputs: BaselineOutputDto[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useBaselineOutputs(
  businessVersionId: string,
  params: ListBaselineOutputsParams = {},
  opts: { autoLoad?: boolean } = {}
): UseBaselineOutputsResult {
  const [outputs, setOutputs] = useState<BaselineOutputDto[]>([]);
  const [loading, setLoading] = useState(opts.autoLoad !== false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listBaselineOutputs(businessVersionId, params);
      setOutputs(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessVersionId, JSON.stringify(params)]);

  useEffect(() => {
    if (opts.autoLoad === false) return;
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  return { outputs, loading, error, reload };
}

export default useBaselineOutputs;
