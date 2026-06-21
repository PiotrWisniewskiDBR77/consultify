import { useCallback } from 'react';

export interface DegradedScenario {
  scenario: string;
  active: boolean;
  posture: string;
  recovery: string;
}

export interface DegradedState {
  isDegraded: boolean;
  scenarios: DegradedScenario[];
}

interface UseProcessFlowDegradedOpts {
  processId: string | null;
  pollIntervalMs?: number;
}

/**
 * Process-flow degraded-mode probe — NEUTRALIZED after the V8 mirror was cut
 * (DP-7, 2026-06-17). The canonical persistence path is now blob-sync
 * (my_idea_maps), so there is no V8 server mirror to be "degraded" from.
 *
 * Previously this polled `GET /api/v8/process-flow/:id/health` every 30s. That
 * route is gone, so every poll 404'd — and the v8 org-gate ran ~18 DB queries
 * (~11s) before returning 404, once per open process flow, forever. Now a no-op
 * that always reports healthy. Kept as a hook (stable contract) so the consumer
 * and its degradation banner need no changes. (M07 live-debug 2026-06-20)
 */
export function useProcessFlowDegraded(_opts: UseProcessFlowDegradedOpts) {
  const checkHealth = useCallback(async () => {
    /* no-op: V8 mirror cut; blob-sync is canonical */
  }, []);

  return {
    isDegraded: false,
    scenarios: [] as DegradedScenario[],
    isChecking: false,
    checkHealth,
    activeScenarios: [] as DegradedScenario[],
  };
}
