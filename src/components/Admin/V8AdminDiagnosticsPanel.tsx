import { Activity, AlertTriangle, CheckCircle2, RefreshCw, Shield } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { V8AdminApi } from '@/services/api/v8';

type AdminDiagnosticsState = {
  health: any | null;
  metrics: any | null;
  shadowStats: any | null;
  shadowReadiness: any | null;
  shadowComparisons: any[];
};

function normalizeShadowComparisons(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const candidate = payload as {
    comparisons?: unknown;
    items?: unknown;
  };

  if (Array.isArray(candidate.comparisons)) return candidate.comparisons;
  if (Array.isArray(candidate.items)) return candidate.items;
  return [];
}

const emptyState: AdminDiagnosticsState = {
  health: null,
  metrics: null,
  shadowStats: null,
  shadowReadiness: null,
  shadowComparisons: [],
};

export const V8AdminDiagnosticsPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<AdminDiagnosticsState>(emptyState);

  const loadDiagnostics = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [health, metrics, shadowStats, shadowReadiness, shadowComparisons] = await Promise.all([
        V8AdminApi.getHealth(),
        V8AdminApi.getMetrics(),
        V8AdminApi.getShadowStats(),
        V8AdminApi.getShadowPromotionReadiness(),
        V8AdminApi.getShadowComparisons(5),
      ]);

      setState({
        health,
        metrics,
        shadowStats,
        shadowReadiness,
        shadowComparisons: normalizeShadowComparisons(shadowComparisons),
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load V8 admin diagnostics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDiagnostics();
  }, [loadDiagnostics]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            V8 Superadmin Diagnostics
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Read-only governed diagnostics for health, metrics, and shadow readiness.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadDiagnostics(true)}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-navy-600 dark:text-slate-200 dark:hover:bg-navy-800"
          disabled={loading || refreshing}
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="mt-4 inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <RefreshCw size={14} className="animate-spin" />
          Loading V8 diagnostics...
        </div>
      ) : error ? (
        <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle size={14} />
            Diagnostics unavailable
          </div>
          <div className="mt-1 text-xs opacity-80">{error}</div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-navy-800">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                <CheckCircle2 size={14} />
                Platform health
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                {state.health?.health?.overall || state.health?.overall || 'unknown'}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-navy-800">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                <Activity size={14} />
                Requests
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                {state.metrics?.requests ?? 0}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-navy-800">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                <Shield size={14} />
                Shadow mismatch rate
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                {state.shadowStats?.mismatchRate ?? 0}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-navy-800">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                <Shield size={14} />
                Promotion readiness
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                {state.shadowReadiness?.ready ? 'ready' : 'not ready'}
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-navy-800">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Integrity and domain readiness
              </div>
              <div className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                <div>Drift count: {state.health?.integrity?.driftCount ?? 0}</div>
                <div>Readiness rows: {state.health?.domainReadiness?.length ?? 0}</div>
                <div>Avg latency: {state.metrics?.avgLatencyMs ?? 0} ms</div>
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-navy-800">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Recent shadow comparisons
              </div>
              <div className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                {state.shadowComparisons.length > 0 ? (
                  state.shadowComparisons.map((comparison: any) => (
                    <div key={comparison.comparisonId || comparison.id}>
                      {comparison.comparisonId || comparison.id}
                    </div>
                  ))
                ) : (
                  <div>No recent shadow comparisons returned.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default V8AdminDiagnosticsPanel;
