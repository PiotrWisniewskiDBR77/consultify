import {
  Activity,
  AlertCircle,
  BarChart2,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit,
  Eye,
  Play,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import type { ContentAnalyticsEvent, PlaybookTemplateStats } from '../../types';

interface PlaybookTemplateAnalyticsProps {
  templateId: string;
}

export const PlaybookTemplateAnalytics: React.FC<PlaybookTemplateAnalyticsProps> = ({
  templateId,
}) => {
  const token = localStorage.getItem('token');

  const [stats, setStats] = useState<PlaybookTemplateStats | null>(null);
  const [events, setEvents] = useState<ContentAnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/content/playbooks/templates/${templateId}/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [token, templateId]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const getEventIcon = (eventType: string) => {
    const icons: Record<string, React.ReactNode> = {
      VIEW: <Eye size={14} className="text-blue-400" />,
      EDIT: <Edit size={14} className="text-amber-400" />,
      USE: <Play size={14} className="text-emerald-400" />,
      EXPORT: <Download size={14} className="text-primary-400" />,
      CLONE: <Copy size={14} className="text-pink-400" />,
      PUBLISH: <CheckCircle2 size={14} className="text-emerald-400" />,
      DEPRECATE: <AlertCircle size={14} className="text-slate-600 dark:text-slate-500" />,
      RESTORE: <RefreshCw size={14} className="text-amber-400" />,
    };
    return (
      icons[eventType] || <Activity size={14} className="text-slate-600 dark:text-slate-500" />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 text-slate-600 dark:text-slate-500 animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-8">
        <BarChart2 className="w-10 h-10 text-slate-600 dark:text-slate-400 mx-auto mb-3" />
        <p className="text-slate-600 dark:text-slate-500">No analytics data available</p>
      </div>
    );
  }

  const totalRuns = stats.totalRuns || 0;
  const completedRuns = stats.completedRuns || 0;
  const failedRuns = stats.failedRuns || 0;
  const cancelledRuns = stats.cancelledRuns || 0;
  const inProgressRuns = totalRuns - completedRuns - failedRuns - cancelledRuns;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-primary-400" />
          <h3 className="font-semibold text-c-text">Analytics</h3>
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-3 py-1.5 bg-c-surface-raised border border-c-border rounded-lg text-c-text text-sm focus:outline-none focus:ring-2 focus:ring-c-focus"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Runs */}
        <div className="bg-c-surface-raised/50 border border-c-border/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Play size={16} className="text-blue-400" />
            <span className="text-sm text-slate-600 dark:text-slate-500">Total Runs</span>
          </div>
          <div className="text-2xl font-bold text-c-text">{totalRuns}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Playbook executions</div>
        </div>

        {/* Success Rate */}
        <div className="bg-c-surface-raised/50 border border-c-border/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            {stats.successRate && stats.successRate >= 70 ? (
              <TrendingUp size={16} className="text-emerald-400" />
            ) : (
              <TrendingDown size={16} className="text-danger-400" />
            )}
            <span className="text-sm text-slate-600 dark:text-slate-500">Success Rate</span>
          </div>
          <div
            className={`text-2xl font-bold ${
              stats.successRate && stats.successRate >= 70
                ? 'text-emerald-400'
                : stats.successRate && stats.successRate >= 40
                  ? 'text-amber-400'
                  : 'text-danger-400'
            }`}
          >
            {stats.successRate !== null ? `${stats.successRate}%` : 'N/A'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Completed successfully
          </div>
        </div>

        {/* Avg Duration */}
        <div className="bg-c-surface-raised/50 border border-c-border/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-amber-400" />
            <span className="text-sm text-slate-600 dark:text-slate-500">Avg. Duration</span>
          </div>
          <div className="text-2xl font-bold text-c-text">
            {stats.avgExecutionTimeMins ? `${stats.avgExecutionTimeMins}m` : 'N/A'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Average execution time
          </div>
        </div>

        {/* Usage Count */}
        <div className="bg-c-surface-raised/50 border border-c-border/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} className="text-primary-400" />
            <span className="text-sm text-slate-600 dark:text-slate-500">Usage Count</span>
          </div>
          <div className="text-2xl font-bold text-c-text">{stats.usageCount}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Times template used</div>
        </div>
      </div>

      {/* Run Status Breakdown */}
      <div className="bg-c-surface-raised/50 border border-c-border/50 rounded-xl p-4">
        <h4 className="font-medium text-c-text mb-4">Run Status Breakdown</h4>

        {totalRuns === 0 ? (
          <div className="text-center py-4 text-slate-600 dark:text-slate-500">
            No runs recorded yet
          </div>
        ) : (
          <>
            {/* Progress bar */}
            <div className="flex h-4 rounded-full overflow-hidden bg-c-surface mb-4">
              {completedRuns > 0 && (
                <div
                  className="bg-emerald-500"
                  style={{ width: `${(completedRuns / totalRuns) * 100}%` }}
                  title={`Completed: ${completedRuns}`}
                />
              )}
              {inProgressRuns > 0 && (
                <div
                  className="bg-blue-500"
                  style={{ width: `${(inProgressRuns / totalRuns) * 100}%` }}
                  title={`In Progress: ${inProgressRuns}`}
                />
              )}
              {failedRuns > 0 && (
                <div
                  className="bg-danger-500"
                  style={{ width: `${(failedRuns / totalRuns) * 100}%` }}
                  title={`Failed: ${failedRuns}`}
                />
              )}
              {cancelledRuns > 0 && (
                <div
                  className="bg-slate-50 dark:bg-navy-800/300"
                  style={{ width: `${(cancelledRuns / totalRuns) * 100}%` }}
                  title={`Cancelled: ${cancelledRuns}`}
                />
              )}
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-sm text-slate-600">Completed ({completedRuns})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-sm text-slate-600">In Progress ({inProgressRuns})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-danger-500" />
                <span className="text-sm text-slate-600">Failed ({failedRuns})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-50 dark:bg-navy-800/300" />
                <span className="text-sm text-slate-600">Cancelled ({cancelledRuns})</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-c-surface-raised/50 border border-c-border/50 rounded-xl p-4">
        <h4 className="font-medium text-c-text mb-4">Recent Activity</h4>

        {events.length === 0 ? (
          <div className="text-center py-4 text-slate-600 dark:text-slate-500">
            No recent activity
          </div>
        ) : (
          <div className="space-y-3">
            {events.slice(0, 10).map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between py-2 border-b border-c-border/30 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-c-surface flex items-center justify-center">
                    {getEventIcon(event.eventType)}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-c-text">
                      {String(event.eventType ?? 'Unknown').replaceAll('_', ' ')}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {event.userId ? `User ID: ${event.userId.slice(0, 8)}...` : 'System'}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {new Date(event.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="bg-c-surface-raised/30 rounded-lg p-3">
          <div className="text-lg font-semibold text-c-text">{stats.version}</div>
          <div className="text-xs text-slate-600 dark:text-slate-500">Current Version</div>
        </div>
        <div className="bg-c-surface-raised/30 rounded-lg p-3">
          <div className="text-lg font-semibold text-c-text">{stats.status}</div>
          <div className="text-xs text-slate-600 dark:text-slate-500">Status</div>
        </div>
        <div className="bg-c-surface-raised/30 rounded-lg p-3">
          <div className="text-lg font-semibold text-c-text">{events.length}</div>
          <div className="text-xs text-slate-600 dark:text-slate-500">Total Events</div>
        </div>
      </div>
    </div>
  );
};

export default PlaybookTemplateAnalytics;
