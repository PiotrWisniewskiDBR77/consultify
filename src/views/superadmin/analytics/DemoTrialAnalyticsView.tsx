/**
 * Demo & Trial Conversion Analytics View
 * SuperAdmin view for funnel metrics: DEMO → TRIAL_START → PAID
 */
import {
  AlertTriangle,
  BarChart3,
  CreditCard,
  FlaskConical,
  Loader2,
  RefreshCw,
  Rocket,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import Api from '../../../services/api';

interface Summary {
  last7Days: { demo: number; trialStart: number; paid: number };
  last30Days: Record<string, number>;
  trialWarningsShown: number;
}

interface RecentEvent {
  id: string;
  eventType: string;
  organizationId?: string;
  userId?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

const DemoTrialAnalyticsView: React.FC = () => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await Api.getDemoTrialAnalytics();
      setSummary(data.summary);
      setRecentEvents(data.recentEvents || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load demo-trial analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-amber-800 dark:text-amber-200">{error}</p>
          <button
            onClick={fetchData}
            className="mt-2 text-sm text-amber-600 dark:text-amber-400 hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const s = summary!;
  const last7 = s.last7Days;
  const last30 = s.last30Days;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Demo & Trial Funnel
        </h2>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-navy-600 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900/50 p-4">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
            <FlaskConical className="w-4 h-4" />
            Demo starts (7d)
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{last7.demo}</p>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900/50 p-4">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
            <Rocket className="w-4 h-4" />
            Trial starts (7d)
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {last7.trialStart}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900/50 p-4">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
            <CreditCard className="w-4 h-4" />
            Converted to paid (7d)
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {last7.paid}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900/50 p-4">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
            <BarChart3 className="w-4 h-4" />
            Trial warnings shown (30d)
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {s.trialWarningsShown}
          </p>
        </div>
      </div>

      {/* 30-day breakdown */}
      {Object.keys(last30).length > 0 && (
        <div className="rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900/50 p-4">
          <h3 className="font-medium text-slate-900 dark:text-white mb-3">
            Event counts (30 days)
          </h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(last30).map(([type, count]) => (
              <span
                key={type}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-navy-800 text-sm"
              >
                <span className="font-medium text-slate-700 dark:text-slate-300">{type}</span>
                <span className="text-slate-500 dark:text-slate-400">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent events */}
      <div className="rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900/50 overflow-hidden">
        <h3 className="font-medium text-slate-900 dark:text-white px-4 py-3 border-b border-slate-200 dark:border-navy-700">
          Recent events (last 50)
        </h3>
        <div className="overflow-x-auto">
          <table /* §27-exempt: render danych nie-listowy, nie spelnia definicji 1 (przegladana kolekcja encji z akcjami) */ className="w-full text-sm"
          >
            <thead>
              <tr className="bg-slate-50 dark:bg-navy-800/50">
                <th className="text-left px-4 py-2 font-medium text-slate-600 dark:text-slate-400">
                  Time
                </th>
                <th className="text-left px-4 py-2 font-medium text-slate-600 dark:text-slate-400">
                  Event
                </th>
                <th className="text-left px-4 py-2 font-medium text-slate-600 dark:text-slate-400">
                  Source
                </th>
                <th className="text-left px-4 py-2 font-medium text-slate-600 dark:text-slate-400">
                  Org
                </th>
                <th className="text-left px-4 py-2 font-medium text-slate-600 dark:text-slate-400">
                  Metadata
                </th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No events in the last 30 days
                  </td>
                </tr>
              ) : (
                recentEvents.map((e) => (
                  <tr
                    key={e.id}
                    className="border-t border-slate-200 dark:border-navy-800 hover:bg-slate-50 dark:hover:bg-navy-800/30"
                  >
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                      {e.createdAt ? new Date(e.createdAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          e.eventType === 'PAID'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                            : e.eventType === 'TRIAL_START'
                              ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
                              : e.eventType === 'DEMO'
                                ? 'bg-slate-500/15 text-slate-700 dark:text-slate-300'
                                : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {e.eventType}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                      {e.source || '—'}
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400 font-mono text-xs">
                      {e.organizationId ? e.organizationId.slice(0, 8) + '…' : '—'}
                    </td>
                    <td className="px-4 py-2 text-slate-500 text-xs max-w-[200px] truncate">
                      {e.metadata
                        ? JSON.stringify(e.metadata).slice(0, 80) +
                          (JSON.stringify(e.metadata).length > 80 ? '…' : '')
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DemoTrialAnalyticsView;
