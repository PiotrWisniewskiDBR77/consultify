import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type FinanceDegradedEntry,
  type FinanceLaneRun,
  type FinanceMutationAudit,
  type FinanceVersionSnapshot,
  type FinanceVersionType,
  type KpiCoherenceResult,
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

export function useFinanceLane() {
  const [activeLaneRun, setActiveLaneRun] = useState<FinanceLaneRun | null>(null);
  const [laneHistory, setLaneHistory] = useState<FinanceLaneRun[]>([]);
  const [mutationAudits, setMutationAudits] = useState<FinanceMutationAudit[]>([]);
  const [kpiCoherence, setKpiCoherence] = useState<KpiCoherenceResult | null>(null);
  const [versionSnapshots, setVersionSnapshots] = useState<FinanceVersionSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshLane = useCallback(async () => {
    try {
      const res = await V8FinanceApi.getLaneRuns(20);
      const runs = res?.data || [];
      setLaneHistory(runs);

      const active = runs.find(
        (r) => r.currentStep !== 'readback' || !r.readbackConfirmed
      ) || null;
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
      setError(getFinanceErrorMessage(err));
    }
  }, []);

  const refreshCoherence = useCallback(async () => {
    if (!activeLaneRun) return;
    try {
      const res = await V8FinanceApi.checkKpiCoherence(activeLaneRun.runId);
      setKpiCoherence(res?.data || null);
    } catch {
      setKpiCoherence({ status: 'unavailable', detail: 'Failed to check KPI coherence' });
    }
  }, [activeLaneRun]);

  const startRun = useCallback(async (versionType?: FinanceVersionType) => {
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
  }, []);

  const advanceStep = useCallback(async (outcome: string, detail?: string) => {
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
  }, [activeLaneRun]);

  const degradedAlerts: DegradedAlert[] = activeLaneRun
    ? mapDegradedToAlerts(activeLaneRun.degraded)
    : [];

  const isRunInProgress = !!activeLaneRun && (
    activeLaneRun.currentStep !== 'readback' || !activeLaneRun.readbackConfirmed
  );

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
