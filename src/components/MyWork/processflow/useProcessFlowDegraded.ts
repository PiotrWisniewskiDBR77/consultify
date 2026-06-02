import { useCallback, useEffect, useRef, useState } from 'react';

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

export function useProcessFlowDegraded({
  processId,
  pollIntervalMs = 30000,
}: UseProcessFlowDegradedOpts) {
  const [state, setState] = useState<DegradedState>({ isDegraded: false, scenarios: [] });
  const [isChecking, setIsChecking] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkHealth = useCallback(async () => {
    if (!processId) return;
    setIsChecking(true);
    try {
      const res = await fetch(`/api/v8/process-flow/${processId}/health`);
      if (res.ok) {
        const data = await res.json();
        setState({
          isDegraded: Boolean(data?.isDegraded),
          scenarios: Array.isArray(data?.scenarios) ? data.scenarios : [],
        });
      }
    } catch {
      setState({
        isDegraded: true,
        scenarios: [
          {
            scenario: 'network_error',
            active: true,
            posture: 'offline',
            recovery: 'Check network connection and retry',
          },
        ],
      });
    } finally {
      setIsChecking(false);
    }
  }, [processId]);

  useEffect(() => {
    if (!processId) return;
    checkHealth();
    intervalRef.current = setInterval(checkHealth, pollIntervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [processId, pollIntervalMs, checkHealth]);

  const activeScenarios = (state.scenarios ?? []).filter((s) => s.active);

  return { ...state, isChecking, checkHealth, activeScenarios };
}
