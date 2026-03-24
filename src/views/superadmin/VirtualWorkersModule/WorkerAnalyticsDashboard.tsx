import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Clock,
  MessageSquare,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';

import { Api } from '../../../services/api';

interface AnalyticsData {
  totalConversations: number;
  totalMessages: number;
  avgDurationSeconds: number;
  avgMessagesPerConversation: number;
  outcomeDistribution: Record<string, number>;
  channelDistribution: Record<string, number>;
  conversationsPerDay: Array<{ date: string; count: number }>;
  topKnowledgeSources: Array<{ source: string; count: number }>;
}

interface WorkerAnalyticsDashboardProps {
  workerId: string;
}

const OUTCOME_LABELS: Record<string, string> = {
  demo_requested: 'Demo Requested',
  trial_started: 'Trial Started',
  question_answered: 'Question Answered',
  escalated: 'Escalated',
  abandoned: 'Abandoned',
  unknown: 'Unknown',
};

const OUTCOME_COLORS: Record<string, string> = {
  demo_requested: 'bg-emerald-500',
  trial_started: 'bg-blue-500',
  question_answered: 'bg-slate-400',
  escalated: 'bg-amber-500',
  abandoned: 'bg-red-400',
  unknown: 'bg-slate-300',
};

export const WorkerAnalyticsDashboard: React.FC<WorkerAnalyticsDashboardProps> = ({
  workerId,
}) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const response = await Api.get(`/api/virtual-workers/${workerId}/analytics`);
        const payload = response?.data?.data ?? response?.data;
        if (payload) {
          setData(payload);
        }
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [workerId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16 text-slate-500 dark:text-slate-400">
        No analytics data available.
      </div>
    );
  }

  const totalOutcomes = Object.values(data.outcomeDistribution).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<MessageSquare size={18} />}
          label="Total Conversations"
          value={data.totalConversations.toString()}
          color="text-indigo-500"
        />
        <KpiCard
          icon={<TrendingUp size={18} />}
          label="Total Messages"
          value={data.totalMessages.toString()}
          color="text-emerald-500"
        />
        <KpiCard
          icon={<Clock size={18} />}
          label="Avg Duration"
          value={formatDuration(data.avgDurationSeconds)}
          color="text-amber-500"
        />
        <KpiCard
          icon={<BarChart3 size={18} />}
          label="Avg Messages/Conv"
          value={data.avgMessagesPerConversation.toString()}
          color="text-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Outcome Distribution */}
        <section className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
            Outcome Distribution
          </h3>
          {totalOutcomes === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(data.outcomeDistribution)
                .sort(([, a], [, b]) => b - a)
                .map(([outcome, count]) => {
                  const pct = Math.round((count / totalOutcomes) * 100);
                  return (
                    <div key={outcome}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-700 dark:text-slate-300">
                          {OUTCOME_LABELS[outcome] || outcome}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${OUTCOME_COLORS[outcome] || 'bg-slate-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </section>

        {/* Channel Distribution */}
        <section className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
            Channel Distribution
          </h3>
          {Object.keys(data.channelDistribution).length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(data.channelDistribution).map(([channel, count]) => (
                <div key={channel} className="flex items-center justify-between">
                  <span className="text-sm text-slate-700 dark:text-slate-300 capitalize">
                    {channel.replace('_', ' ')}
                  </span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          )}

          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mt-6 mb-4">
            Top Knowledge Sources
          </h3>
          {data.topKnowledgeSources.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {data.topKnowledgeSources.map((src, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[200px]">
                    {src.source}
                  </span>
                  <span className="text-xs font-medium text-slate-900 dark:text-white">
                    {src.count}×
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Conversations per Day */}
      {data.conversationsPerDay.length > 0 && (
        <section className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
            Conversations per Day (last 30 days)
          </h3>
          <div className="flex items-end gap-1 h-32">
            {data.conversationsPerDay
              .slice()
              .reverse()
              .map((day, i) => {
                const maxCount = Math.max(...data.conversationsPerDay.map((d) => d.count), 1);
                const heightPct = (day.count / maxCount) * 100;
                return (
                  <div
                    key={i}
                    className="flex-1 group relative"
                    title={`${day.date}: ${day.count}`}
                  >
                    <div
                      className="bg-indigo-500 rounded-t transition-all hover:bg-indigo-600"
                      style={{ height: `${Math.max(heightPct, 4)}%` }}
                    />
                  </div>
                );
              })}
          </div>
        </section>
      )}
    </div>
  );
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

const KpiCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}> = ({ icon, label, value, color }) => (
  <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
    <div className={`${color} mb-2`}>{icon}</div>
    <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</p>
  </div>
);
