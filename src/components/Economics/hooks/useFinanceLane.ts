import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type FinanceDegradedEntry,
  type FinanceLaneRun,
  type FinanceMutationAudit,
  type FinanceVersionSnapshot,
  type FinanceVersionType,
  type KpiCoherenceResult,
  shouldFallbackToLegacyFinance,
  V8FinanceApi,
} from '../../../services/api/v8/finance';
import { getFinanceErrorMessage } from '../financeErrorMap';

export type DegradedSeverity = 'destructive' | 'warning' | 'info';

export interface DegradedAlert {
  reason: string;
  severity: DegradedSeverity;
  title: string;
  description: string;
  nextAction: string;
  at?: string;
}

const SEVERITY_MAP: Record<string, DegradedSeverity> = {
  import_failed: 'destructive',
  mutation_failed: 'destructive',
  mutation_conflict: 'destructive',
  schema_drift: 'warning',
  import_mapping_missing: 'warning',
  switchover_misconfigured: 'warning',
  import_completed_with_warnings: 'warning',
  permission_denied: 'warning',
  stale_model: 'info',
  stale_linkage: 'info',
  reconciliation_mismatch: 'info',
};

const REASON_TITLES: Record<string, string> = {
  import_failed: 'Import failed',
  import_completed_with_warnings: 'Import completed with warnings',
  import_mapping_missing: 'Import mapping missing',
  schema_drift: 'Source schema drift detected',
  stale_model: 'Finance model is stale',
  stale_linkage: 'KPI linkage is stale',
  mutation_conflict: 'Mutation conflict',
  mutation_failed: 'Mutation failed',
  permission_denied: 'Permission denied',
  switchover_misconfigured: 'Switchover misconfigured',
  reconciliation_mismatch: 'Reconciliation mismatch',
};

function mapDegradedToAlerts(entries: FinanceDegradedEntry[]): DegradedAlert[] {
  return entries.map((e) => ({
    reason: e.reason,
    severity: SEVERITY_MAP[e.reason] || 'info',
    title: REASON_TITLES[e.reason] || e.reason.replace(/_/g, ' '),
    description: e.detail,
    nextAction: e.nextAction,
    at: e.at,
  }));
}

const POLL_INTERVAL_MS = 30_000;

interface UseFinanceLaneOptions {
  enabled?: boolean;
  onUnavailable?: () => void;
}

function normalizeLaneRun(run: FinanceLaneRun): FinanceLaneRun {
  return {
    ...run,
    currentStep: run?.currentStep || 'import',
    importOutcome: run?.importOutcome ?? null,
    analysisCompleted: Boolean(run?.analysisCompleted),
    mutationOutcome: run?.mutationOutcome ?? null,
    readbackConfirmed: Boolean(run?.readbackConfirmed),
    degraded: Array.isArray(run?.degraded) ? run.degraded : [],
    auditTrail: Array.isArray(run?.auditTrail) ? run.auditTrail : [],
    versionType: run?.versionType || 'current',
    kpiLinkageStatus: run?.kpiLinkageStatus || 'unavailable',
    createdAt: run?.createdAt || new Date(0).toISOString(),
    updatedAt: run?.updatedAt || new Date(0).toISOString(),
  };
}

export function useFinanceLane(options: UseFinanceLaneOptions = {}) {
  const { enabled = true, onUnavailable } = options;
  const [activeLaneRun, setActiveLaneRun] = useState<FinanceLaneRun | null>(null);
  const [laneHistory, setLaneHistory] = useState<FinanceLaneRun[]>([]);
  const [mutationAudits, setMutationAudits] = useState<FinanceMutationAudit[]>([]);
  const [kpiCoherence, setKpiCoherence] = useState<KpiCoherenceResult | null>(null);
  const [versionSnapshots, setVersionSnapshots] = useState<FinanceVersionSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stabilize onUnavailable via ref so it never becomes a dep of refreshLane/refreshCoherence.
  // Without this, an inline arrow passed from FinanceHub.tsx would cause a new reference on every
  // render → refreshLane recreated → useEffect fires → setState → re-render → loop (~1 req/s).
  const onUnavailableRef = useRef(onUnavailable);
  useEffect(() => {
    onUnavailableRef.current = onUnavailable;
  }, [onUnavailable]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshLane = useCallback(async () => {
    if (!enabled) {
      setActiveLaneRun(null);
      setLaneHistory([]);
      setMutationAudits([]);
      setVersionSnapshots([]);
      setKpiCoherence(null);
      setError(null);
      return;
    }
    try {
      const res = await V8FinanceApi.getLaneRuns(20);
      const runs = Array.isArray(res?.data) ? res.data.map((run) => normalizeLaneRun(run)) : [];
      setLaneHistory(runs);

      const active = runs.find((r) => r.currentStep !== 'readback' || !r.readbackConfirmed) || null;
      setActiveLaneRun(active);

      if (active) {
        const [auditsRes, versionsRes] = await Promise.all([
          V8FinanceApi.getMutationAudits(active.runId).catch(() => ({ data: [] })),
          V8FinanceApi.getVersionSnapshots().catch(() => ({ data: [] })),
        ]);
        setMutationAudits(auditsRes?.data || []);
        setVersionSnapshots(versionsRes?.data || []);
      }
    } catch (err) {
      if (shouldFallbackToLegacyFinance(err)) {
        setActiveLaneRun(null);
        setLaneHistory([]);
        setMutationAudits([]);
        setVersionSnapshots([]);
        setKpiCoherence(null);
        setError(null);
        onUnavailableRef.current?.();
        return;
      }
      setError(getFinanceErrorMessage(err));
    }
  }, [enabled]);

  const refreshCoherence = useCallback(async () => {
    if (!enabled || !activeLaneRun) return;
    try {
      const res = await V8FinanceApi.checkKpiCoherence(activeLaneRun.runId);
      setKpiCoherence(res?.data || null);
    } catch (err) {
      if (shouldFallbackToLegacyFinance(err)) {
        setKpiCoherence(null);
        setError(null);
        onUnavailableRef.current?.();
        return;
      }
      setKpiCoherence({ status: 'unavailable', detail: 'Failed to check KPI coherence' });
    }
  }, [activeLaneRun, enabled]);

  const startRun = useCallback(
    async (versionType?: FinanceVersionType) => {
      if (!enabled) {
        throw new Error('Finance lane is unavailable for the current organization.');
      }
      setLoading(true);
      setError(null);
      try {
        const res = await V8FinanceApi.startLaneRun(versionType);
        const run = res?.data;
        if (run) {
          setActiveLaneRun(run);
          setLaneHistory((prev) => [run, ...prev]);
        }
        return run;
      } catch (err: any) {
        setError(getFinanceErrorMessage(err));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [enabled]
  );

  const advanceStep = useCallback(
    async (outcome: string, detail?: string) => {
      if (!enabled) {
        throw new Error('Finance lane is unavailable for the current organization.');
      }
      if (!activeLaneRun) throw new Error('No active lane run');
      setLoading(true);
      setError(null);
      try {
        const res = await V8FinanceApi.advanceLaneStep(activeLaneRun.runId, outcome, detail);
        const run = res?.data;
        if (run) {
          setActiveLaneRun(run);
          setLaneHistory((prev) => prev.map((r) => (r.runId === run.runId ? run : r)));
        }
        return run;
      } catch (err: any) {
        setError(getFinanceErrorMessage(err));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [activeLaneRun, enabled]
  );

  const degradedAlerts: DegradedAlert[] = activeLaneRun
    ? mapDegradedToAlerts(activeLaneRun.degraded || [])
    : [];

  const isRunInProgress =
    !!activeLaneRun &&
    (activeLaneRun.currentStep !== 'readback' || !activeLaneRun.readbackConfirmed);

  useEffect(() => {
    refreshLane();
  }, [refreshLane]);

  useEffect(() => {
    if (isRunInProgress) {
      pollRef.current = setInterval(refreshLane, POLL_INTERVAL_MS);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isRunInProgress, refreshLane]);

  return {
    activeLaneRun,
    laneHistory,
    mutationAudits,
    kpiCoherence,
    versionSnapshots,
    degradedAlerts,
    isRunInProgress,
    loading,
    error,
    startRun,
    advanceStep,
    refreshLane,
    refreshCoherence,
  };
}
