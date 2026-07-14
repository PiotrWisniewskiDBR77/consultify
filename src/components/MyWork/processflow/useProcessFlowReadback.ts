import { useCallback, useState } from 'react';
import type { Edge, Node } from 'reactflow';

import { generateReadback, type LaneLike } from './generateReadback';

export type { ReadbackResult, ReadbackStep } from './generateReadback';
import type { ReadbackResult } from './generateReadback';

interface UseProcessFlowReadbackOpts {
  processId: string | null;
  nodes: Node[];
  edges: Edge[];
  lanes?: LaneLike[];
  isPl?: boolean;
}

/**
 * Process-flow readback — client-side (DP-7). The V8 mirror
 * (`GET /api/v8/process-flow/:id/readback`) was cut, so this hook now
 * traverses the in-memory graph via `generateReadback()` instead of
 * fetching. The public API (result/isLoading/fetchReadback) is unchanged so
 * ReadbackPanel and callers need no changes.
 */
export function useProcessFlowReadback({
  processId,
  nodes,
  edges,
  lanes = [],
  isPl = false,
}: UseProcessFlowReadbackOpts) {
  const [result, setResult] = useState<ReadbackResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchReadback = useCallback(async () => {
    if (!processId) return;
    setIsLoading(true);
    try {
      const readback = generateReadback(nodes, edges, lanes, isPl);
      setResult(readback);
    } finally {
      setIsLoading(false);
    }
  }, [processId, nodes, edges, lanes, isPl]);

  return { result, isLoading, fetchReadback };
}
