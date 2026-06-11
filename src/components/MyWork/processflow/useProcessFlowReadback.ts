import { useCallback, useState } from 'react';

import { getHeaders } from '@/services/api';

export interface ReadbackStep {
  type: 'step' | 'decision' | 'parallel_split' | 'parallel_join' | 'start' | 'end';
  label: string;
  object_id: string;
  branches?: ReadbackStep[][];
}

export interface ReadbackResult {
  paths: ReadbackStep[];
  warnings: string[];
}

interface UseProcessFlowReadbackOpts {
  processId: string | null;
}

export function useProcessFlowReadback({ processId }: UseProcessFlowReadbackOpts) {
  const [result, setResult] = useState<ReadbackResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchReadback = useCallback(async () => {
    if (!processId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v8/process-flow/${processId}/readback`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    } catch {
      // keep last result
    } finally {
      setIsLoading(false);
    }
  }, [processId]);

  return { result, isLoading, fetchReadback };
}
