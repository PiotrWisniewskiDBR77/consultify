/**
 * useGateAi — lazy hook around the Initiative Gate AI client (M13 Depth · Fala 1, G5).
 * SSOT spec: docs/product/INITIATIVE_GATE_AI_SPEC.md §5.
 *
 * Lazy by design: the AI check is slow/expensive, so it runs ONLY when
 * `check(gate)` is called — never on mount. Fail-open is handled inside the
 * client, so this hook will receive a safe disabled response rather than throw.
 */

import { useCallback, useState } from 'react';

import { checkGateAi } from '@/services/api/gateAi';
import type { GateAiCheckResponse } from '@/types/gateAi';
import { gateAiSoftBlocks } from '@/types/gateAi';

export interface UseGateAiResult {
  /** Run the gate readiness check; stores the result. Returns the response. */
  check: (gate: string) => Promise<GateAiCheckResponse>;
  /** Last check result, or null before the first check. */
  data: GateAiCheckResponse | null;
  /** True while a check is in flight. */
  loading: boolean;
  /** Last error message, if any (client fails open, so usually null). */
  error: string | null;
  /** Whether the last result constitutes a soft block (derived). */
  softBlocks: boolean;
}

export function useGateAi(initiativeId: string): UseGateAiResult {
  const [data, setData] = useState<GateAiCheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(
    async (gate: string): Promise<GateAiCheckResponse> => {
      setLoading(true);
      setError(null);
      try {
        const result = await checkGateAi(initiativeId, gate);
        setData(result);
        return result;
      } catch (err) {
        // Client is fail-open, but guard defensively so the hook never throws.
        setError(err instanceof Error ? err.message : 'Gate AI check failed');
        const fallback: GateAiCheckResponse = {
          enabled: false,
          gate,
          aiReadiness: null,
          timeline: null,
        };
        setData(fallback);
        return fallback;
      } finally {
        setLoading(false);
      }
    },
    [initiativeId]
  );

  const softBlocks = data ? gateAiSoftBlocks(data) : false;

  return { check, data, loading, error, softBlocks };
}

export default useGateAi;
