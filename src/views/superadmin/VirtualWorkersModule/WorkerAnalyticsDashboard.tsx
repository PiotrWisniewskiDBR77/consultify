import { BarChart3, Clock, MessageSquare, RefreshCw, TrendingUp } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Api } from '../../../services/api';

interface AnalyticsData {
  totalConversations: number;
  totalMessages: number;
  avgDurationSeconds: number;
  avgMessagesPerConversation: number;
  outcomeDistribution: Record<string, number>;
  channelDistribution: Record<string, number>;
  intentDistribution: Record<string, number>;
  topicDistribution: Record<string, number>;
  fallbackReasons: Record<string, number>;
  qualityFlagDistribution: Record<string, number>;
  conversationsPerDay: Array<{ date: string; count: number }>;
  topKnowledgeSources: Array<{ source: string; count: number }>;
  topKnowledgePills: Array<{ pillId: string; count: number }>;
  topProducts: Array<{ product: string; count: number }>;
}

interface AnnaFunnelSummaryData {
  summary: {
    totalEvents: number;
    byEvent: Record<string, number>;
    localeDistribution: Record<string, number>;
    fallbackReasons: Record<string, number>;
    handoffTargets: Record<string, number>;
  };
  recentEvents: Array<{
    id: string;
    eventType: string;
    source: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
}

interface WorkerAnalyticsDashboardProps {
  workerId: string;
  workerSlug?: string;
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
  workerSlug,
}) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [annaFunnel, setAnnaFunnel] = useState<AnnaFunnelSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const [workerResponse, annaResponse] = await Promise.all([
          Api.get(`/api/virtual-workers/${workerId}/analytics`),
          workerSlug === 'anna'
            ? Api.get('/api/superadmin/analytics/anna-funnel')
            : Promise.resolve(null),
        ]);

        const payload = workerResponse?.data?.data ?? workerResponse?.data;
        if (payload) {
          setData(payload);
        }

        if (workerSlug === 'anna' && annaResponse) {
          const annaPayload = annaResponse?.data?.data ?? annaResponse?.data;
          if (annaPayload) {
            setAnnaFunnel(annaPayload);
          }
        }
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [workerId, workerSlug]);

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
  const annaByEvent = annaFunnel?.summary.byEvent || {};
  const annaRecentEvents = annaFunnel?.recentEvents || [];

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

      {workerSlug === 'anna' && annaFunnel && (
        <section className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Public Anna Funnel
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Backend-backed summary for the current public landing Anna funnel.
              </p>
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {annaFunnel.summary.totalEvents} total events
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              icon={<BarChart3 size={18} />}
              label="Widget Opens"
              value={String(annaByEvent.landing_anna_widget_opened || 0)}
              color="text-cyan-500"
            />
            <KpiCard
              icon={<MessageSquare size={18} />}
              label="Messages Sent"
              value={String(annaByEvent.landing_anna_message_sent || 0)}
              color="text-violet-500"
            />
            <KpiCard
              icon={<TrendingUp size={18} />}
              label="Handoffs"
              value={String(annaByEvent.landing_anna_handoff_clicked || 0)}
              color="text-emerald-500"
            />
            <KpiCard
              icon={<Clock size={18} />}
              label="Fallbacks"
              value={String(annaByEvent.landing_anna_fallback_shown || 0)}
              color="text-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <SummaryList
              title="Locales"
              emptyLabel="No locale distribution yet."
              items={annaFunnel.summary.localeDistribution}
            />
            <SummaryList
              title="Handoff Targets"
              emptyLabel="No handoff targets yet."
              items={annaFunnel.summary.handoffTargets}
            />
            <SummaryList
              title="Fallback Reasons"
              emptyLabel="No fallback reasons yet."
              items={annaFunnel.summary.fallbackReasons}
            />
          </div>

          <div className="mt-6">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
              Recent Public Anna Events
            </h4>
            {annaRecentEvents.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No public Anna events yet.
              </p>
            ) : (
              <div className="space-y-2">
                {annaRecentEvents.slice(0, 5).map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 dark:border-navy-700 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {event.eventType}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {formatEventMetadata(event.metadata)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                      {formatTimestamp(event.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SummaryList
          title="Top Topics"
          emptyLabel="No topics yet."
          items={data.topicDistribution}
          className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6"
        />
        <SummaryList
          title="Intent Distribution"
          emptyLabel="No intents yet."
          items={data.intentDistribution}
          className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryList
          title="Fallback Reasons"
          emptyLabel="No fallback usage yet."
          items={data.fallbackReasons}
          className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6"
        />
        <SummaryList
          title="Quality Flags"
          emptyLabel="No quality flags yet."
          items={data.qualityFlagDistribution}
          className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6"
        />
        <section className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
            Top Products
          </h4>
          {data.topProducts.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No product data yet.</p>
          ) : (
            <div className="space-y-2">
              {data.topProducts.map((item) => (
                <div key={item.product} className="flex items-center justify-between">
                  <span className="text-sm text-slate-700 dark:text-slate-300">{item.product}</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
          Top Knowledge Pills
        </h4>
        {data.topKnowledgePills.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No pill usage yet.</p>
        ) : (
          <div className="space-y-2">
            {data.topKnowledgePills.map((item) => (
              <div key={item.pillId} className="flex items-center justify-between">
                <span className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[300px]">
                  {item.pillId}
                </span>
                <span className="text-xs font-medium text-slate-900 dark:text-white">
                  {item.count}×
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

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

const SummaryList: React.FC<{
  title: string;
  emptyLabel: string;
  items: Record<string, number>;
  className?: string;
}> = ({ title, emptyLabel, items, className }) => {
  const entries = Object.entries(items).sort(([, a], [, b]) => b - a);

  return (
    <div className={className}>
      <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{title}</h4>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{emptyLabel}</p>
      ) : (
        <div className="space-y-2">
          {entries.map(([label, count]) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
              <span className="text-sm font-medium text-slate-900 dark:text-white">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function formatEventMetadata(metadata: Record<string, unknown>): string {
  return Object.entries(metadata)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ');
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
