import { AlertTriangle, CheckCircle2, RefreshCw, Timer, TrendingUp, Users } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { OnboardingKpiDashboard, OnboardingKpiMetricKey, OnboardingKpiRow } from '@/models/onboarding/ActivationKpiDashboard';
import { OnboardingRuntimeApi } from '@/services/api/v10/onboardingRuntime';
import { cn } from '@/utils/cn';

const METRIC_LABELS: Record<OnboardingKpiMetricKey, string> = {
  activation_rate: 'Activation rate',
  median_time_to_first_artifact: 'Median time to first artifact',
  connector_attach_rate_at_aha: 'Connector attach rate at aha',
  first_artifact_approved_rate: 'First artifact approved rate',
};

function statusClasses(status: 'green' | 'amber' | 'red') {
  if (status === 'green') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200';
  if (status === 'amber') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200';
  return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200';
}

function formatMetricValue(key: OnboardingKpiMetricKey, value: number): string {
  if (key === 'median_time_to_first_artifact') return `${Math.round(value)}s`;
  return `${Math.round(value)}%`;
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>{title}</span>
        {icon}
      </div>
      <div className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">{value}</div>
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</div>
    </div>
  );
}

function PersonaRow({ row }: { row: OnboardingKpiRow }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-slate-900 dark:text-white">{row.persona}</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            started {row.startedSessions} · activated {row.activatedSessions} · resumed {row.resumedSessions}
            {' · '}
            abandoned {row.abandonedSessions}
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Object.entries(row.metrics).map(([key, metric]) => (
          <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black/20">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {METRIC_LABELS[key as OnboardingKpiMetricKey]}
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-900 dark:text-white">
                  {formatMetricValue(key as OnboardingKpiMetricKey, metric.actual)}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  target {formatMetricValue(key as OnboardingKpiMetricKey, metric.target)}
                </div>
              </div>
              <span className={cn('rounded-full px-2 py-1 text-[11px] font-semibold uppercase', statusClasses(metric.status))}>
                {metric.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const OnboardingKpiDashboardView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<OnboardingKpiDashboard | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const payload = await OnboardingRuntimeApi.getKpiSummary();
      setSummary(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load onboarding KPI summary');
    } finally {
      if (mode === 'refresh') setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load('initial');
  }, [load]);

  const totals = summary?.totals || null;
  const riskCount = useMemo(
    () =>
      totals
        ? Object.values(totals.metrics).filter((metric) => metric.status === 'red').length
        : 0,
    [totals]
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
          Loading onboarding KPI dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Onboarding KPI Dashboard</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Activation, speed, connector attach, approvals, and abandonment for the current tenant.
          </p>
          {summary?.generatedAt ? (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Generated at {new Date(summary.generatedAt).toLocaleString()}
            </p>
          ) : null}
        </div>
        <button
          onClick={() => void load('refresh')}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-black/20 dark:text-slate-200 dark:hover:bg-white/10"
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-900/15 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      {totals ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Activation"
            value={formatMetricValue('activation_rate', totals.metrics.activation_rate.actual)}
            subtitle={`Target ${formatMetricValue('activation_rate', totals.metrics.activation_rate.target)}`}
            icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
          />
          <MetricCard
            title="Median first artifact"
            value={formatMetricValue(
              'median_time_to_first_artifact',
              totals.metrics.median_time_to_first_artifact.actual
            )}
            subtitle={`Target ${formatMetricValue('median_time_to_first_artifact', totals.metrics.median_time_to_first_artifact.target)}`}
            icon={<Timer className="h-4 w-4 text-blue-500" />}
          />
          <MetricCard
            title="Sessions"
            value={String(totals.startedSessions)}
            subtitle={`${totals.resumedSessions} resumed · ${totals.abandonedSessions} abandoned`}
            icon={<Users className="h-4 w-4 text-violet-500" />}
          />
          <MetricCard
            title="Red metrics"
            value={String(riskCount)}
            subtitle={`${summary?.last24hEventCount || 0} telemetry events in last 24h`}
            icon={
              riskCount > 0 ? (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              )
            }
          />
        </div>
      ) : null}

      <div className="space-y-4">
        {(summary?.personas || []).length > 0 ? (
          summary?.personas.map((row) => <PersonaRow key={row.persona} row={row} />)
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
            No onboarding KPI data has been collected for this tenant yet.
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingKpiDashboardView;
