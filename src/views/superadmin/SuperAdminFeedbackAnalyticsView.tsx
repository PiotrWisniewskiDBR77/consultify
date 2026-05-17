/**
 * SuperAdminFeedbackAnalyticsView
 *
 * KPI dashboard for the feedback triage queue. Surfaces:
 *  - open / resolved / aging NEW tickets
 *  - MTTR + p90 resolution time (last 30d)
 *  - re-open rate (last 30d)
 *  - volume breakdown by type / severity / env
 *
 * Read-only. Source: GET /api/feedback/analytics/overview.
 */

import { AlertTriangle, BarChart3, Clock, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Api } from '../../services/api';

interface AnalyticsOverview {
  sampleSize: number;
  openCount: number;
  totals: {
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    byEnv: Record<string, number>;
  };
  aging: { under24h: number; h24_48: number; d2_7: number; over7d: number };
  mttrLast30d: { medianHours: number | null; p90Hours: number | null; sampleSize: number };
  last30d: { created: number; reopened: number; reopenRatePct: number };
  generatedAt: string;
}

const FEEDBACK_ANALYTICS_UNAVAILABLE_COPY = 'Feedback analytics is temporarily unavailable.';

function isValidCountRecord(value: unknown): value is Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every((entry) => typeof entry === 'number' && Number.isFinite(entry));
}

function isValidAnalyticsOverview(payload: unknown): payload is AnalyticsOverview {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const value = payload as Partial<AnalyticsOverview>;
  return (
    typeof value.sampleSize === 'number' &&
    Number.isFinite(value.sampleSize) &&
    typeof value.openCount === 'number' &&
    Number.isFinite(value.openCount) &&
    !!value.totals &&
    isValidCountRecord(value.totals.byStatus) &&
    isValidCountRecord(value.totals.byType) &&
    isValidCountRecord(value.totals.bySeverity) &&
    isValidCountRecord(value.totals.byEnv) &&
    !!value.aging &&
    typeof value.aging.under24h === 'number' &&
    typeof value.aging.h24_48 === 'number' &&
    typeof value.aging.d2_7 === 'number' &&
    typeof value.aging.over7d === 'number' &&
    !!value.mttrLast30d &&
    (value.mttrLast30d.medianHours == null || typeof value.mttrLast30d.medianHours === 'number') &&
    (value.mttrLast30d.p90Hours == null || typeof value.mttrLast30d.p90Hours === 'number') &&
    typeof value.mttrLast30d.sampleSize === 'number' &&
    !!value.last30d &&
    typeof value.last30d.created === 'number' &&
    typeof value.last30d.reopened === 'number' &&
    typeof value.last30d.reopenRatePct === 'number' &&
    typeof value.generatedAt === 'string'
  );
}

function formatHours(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value < 1) return `${Math.round(value * 60)}m`;
  if (value < 24) return `${value.toFixed(1)}h`;
  const days = value / 24;
  return `${days.toFixed(1)}d`;
}

function renderBreakdown(
  title: string,
  entries: Record<string, number>,
  filterKey: 'status' | 'type' | 'severity' | 'env',
  onSelect: (key: 'status' | 'type' | 'severity' | 'env', value: string) => void,
  max = 6
): React.ReactElement {
  const sorted = Object.entries(entries)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max);
  const total = sorted.reduce((s, [, v]) => s + v, 0) || 1;
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">{title}</h4>
      {sorted.length === 0 ? (
        <p className="text-xs text-slate-500">No data</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map(([label, count]) => {
            const pct = Math.round((count / total) * 100);
            return (
              <li key={label} className="text-xs">
                <button
                  type="button"
                  onClick={() => onSelect(filterKey, label)}
                  className="w-full rounded-md p-1 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:hover:bg-slate-800"
                  title={`Filter feedback by ${title.toLowerCase()}: ${label}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-slate-700 dark:text-slate-300 truncate pr-2">
                      {label}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400 tabular-nums">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500"
                      style={{ width: `${Math.max(2, pct)}%` }}
                    />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export const SuperAdminFeedbackAnalyticsView: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await Api.getFeedbackAnalyticsOverview();
      if (!isValidAnalyticsOverview(res)) {
        throw new Error('FEEDBACK_ANALYTICS_OVERVIEW_INVALID_PAYLOAD');
      }
      setData(res);
    } catch (e: unknown) {
      console.error('[FeedbackAnalyticsView] load failed', e);
      setData(null);
      setError(FEEDBACK_ANALYTICS_UNAVAILABLE_COPY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openFeedbackFilter = useCallback(
    (key: 'status' | 'type' | 'severity' | 'env', value: string) => {
      const params = new URLSearchParams({ [key]: value });
      navigate(`/superadmin/feedback?${params.toString()}`);
    },
    [navigate]
  );

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <Loader2 className="animate-spin mr-2" size={16} /> Loading analytics…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div
        role="alert"
        className="p-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded"
      >
        {error}
      </div>
    );
  }

  if (!data) return null;

  const kpiCards: Array<{
    label: string;
    value: string;
    hint?: string;
    icon: React.ReactElement;
    tone: 'emerald' | 'indigo' | 'amber' | 'rose';
  }> = [
    {
      label: 'Open tickets',
      value: String(data.openCount),
      hint: `${data.sampleSize} sampled`,
      icon: <AlertTriangle size={16} />,
      tone: 'amber',
    },
    {
      label: 'MTTR (median, 30d)',
      value: formatHours(data.mttrLast30d.medianHours),
      hint: `p90 ${formatHours(data.mttrLast30d.p90Hours)} · n=${data.mttrLast30d.sampleSize}`,
      icon: <Clock size={16} />,
      tone: 'indigo',
    },
    {
      label: 'Created (30d)',
      value: String(data.last30d.created),
      hint: `Re-opened ${data.last30d.reopened} (${data.last30d.reopenRatePct}%)`,
      icon: <TrendingUp size={16} />,
      tone: 'emerald',
    },
    {
      label: 'Aging NEW',
      value: String(data.aging.under24h + data.aging.h24_48 + data.aging.d2_7 + data.aging.over7d),
      hint: `${data.aging.over7d} > 7d · ${data.aging.d2_7} 2–7d`,
      icon: <BarChart3 size={16} />,
      tone: 'rose',
    },
  ];

  const toneMap: Record<string, string> = {
    emerald:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
    indigo:
      'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800',
    amber:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
    rose: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Feedback Analytics
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Generated {new Date(data.generatedAt).toLocaleString()}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiCards.map((card) => (
          <div key={card.label} className={`border rounded-lg p-4 ${toneMap[card.tone]}`}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-80">
              {card.icon}
              {card.label}
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{card.value}</div>
            {card.hint && <div className="mt-1 text-[11px] opacity-80">{card.hint}</div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">
            NEW age distribution
          </h4>
          <ul className="space-y-2 text-xs">
            {[
              { label: '< 24h', value: data.aging.under24h, color: 'bg-emerald-500' },
              { label: '24–48h', value: data.aging.h24_48, color: 'bg-amber-500' },
              { label: '2–7d', value: data.aging.d2_7, color: 'bg-amber-500' },
              { label: '> 7d', value: data.aging.over7d, color: 'bg-rose-500' },
            ].map((bucket) => {
              const total =
                data.aging.under24h + data.aging.h24_48 + data.aging.d2_7 + data.aging.over7d || 1;
              const pct = Math.round((bucket.value / total) * 100);
              return (
                <li key={bucket.label}>
                  <button
                    type="button"
                    onClick={() => openFeedbackFilter('status', 'NEW')}
                    className="w-full rounded-md p-1 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:hover:bg-slate-800"
                    title="Filter feedback by NEW status"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-700 dark:text-slate-300">{bucket.label}</span>
                      <span className="text-slate-600 dark:text-slate-400 tabular-nums">
                        {bucket.value} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${bucket.color}`}
                        style={{ width: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {renderBreakdown('By status', data.totals.byStatus, 'status', openFeedbackFilter)}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {renderBreakdown('By type', data.totals.byType, 'type', openFeedbackFilter)}
        {renderBreakdown('By severity', data.totals.bySeverity, 'severity', openFeedbackFilter)}
        {renderBreakdown('By environment', data.totals.byEnv, 'env', openFeedbackFilter)}
      </div>

      <p className="text-[11px] text-slate-500 dark:text-slate-500">
        Sample size is capped at 5 000 most recent tickets. MTTR is measured as the time between{' '}
        <code>created_at</code> and <code>updated_at</code> for tickets that reached
        <code> RESOLVED</code> in the last 30 days.
      </p>
    </div>
  );
};

export default SuperAdminFeedbackAnalyticsView;
