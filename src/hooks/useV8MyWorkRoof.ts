import { useQuery } from '@tanstack/react-query';

import { V8MyWorkApi, type V8MyWorkRoofSummary } from '@/services/api/v8/my-work';

export type { V8MyWorkRoofSummary } from '@/services/api/v8/my-work';

export const V8_MY_WORK_KEYS = {
  roofSummary: ['v8', 'my-work', 'roof', 'summary'] as const,
};

export function useV8MyWorkRoofSummary(enabled = true) {
  return useQuery<V8MyWorkRoofSummary>({
    queryKey: V8_MY_WORK_KEYS.roofSummary,
    queryFn: () => V8MyWorkApi.getRoofSummary(),
    enabled,
    staleTime: 60_000,
  });
}
