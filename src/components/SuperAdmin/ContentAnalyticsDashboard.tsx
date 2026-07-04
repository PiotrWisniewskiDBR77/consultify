import {
  Activity,
  BarChart2,
  Calendar,
  CheckCircle2,
  Eye,
  FolderOpen,
  Mail,
  Play,
  RefreshCw,
  Send,
  Tag,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import type { ContentAnalyticsDashboard as DashboardData } from '../../types';

interface ContentAnalyticsDashboardProps {
  organizationId?: string;
}

export const ContentAnalyticsDashboard: React.FC<ContentAnalyticsDashboardProps> = ({
  organizationId,
}) => {
  const token = localStorage.getItem('token');

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (organizationId) {
        params.append('organizationId', organizationId);
      }

      const res = await fetch(`/api/content/analytics/dashboard?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [token, organizationId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-slate-400 dark:text-slate-500 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <BarChart2 className="w-12 h-12 text-slate-600 dark:text-slate-400 mx-auto mb-4" />
        <p className="text-slate-400 dark:text-slate-500">Failed to load analytics data</p>
        <button
          onClick={loadDashboard}
          className="mt-4 px-4 py-2 text-primary-400 hover:text-primary-300"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary-500/20 to-primary-600/20 border border-primary-500/20">
            <BarChart2 className="w-6 h-6 text-primary-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-c-text">Content Analytics</h2>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Overview of your content module performance
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-c-text text-sm focus:outline-none focus:ring-2 focus:ring-c-focus"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <button
            onClick={loadDashboard}
            className="p-2 text-slate-400 dark:text-slate-500 hover:text-white bg-c-surface-raised border border-c-border rounded-lg"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Top Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Playbook Templates */}
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Play size={18} className="text-blue-400" />
            <span className="text-sm font-medium text-blue-300">Playbooks</span>
          </div>
          <div className="text-3xl font-bold text-c-text mb-1">{data.totalPlaybookTemplates}</div>
          <div className="text-sm text-slate-400 dark:text-slate-500">
            <span className="text-emerald-400">{data.publishedPlaybooks}</span> published
          </div>
        </div>

        {/* Email Templates */}
        <div className="bg-gradient-to-br from-pink-500/10 to-pink-600/5 border border-pink-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Mail size={18} className="text-pink-400" />
            <span className="text-sm font-medium text-pink-300">Email Templates</span>
          </div>
          <div className="text-3xl font-bold text-c-text mb-1">{data.totalEmailTemplates}</div>
          <div className="text-sm text-slate-400 dark:text-slate-500">
            <span className="text-emerald-400">{data.publishedEmails}</span> published
          </div>
        </div>

        {/* Categories */}
        <div className="bg-gradient-to-br from-primary-500/10 to-primary-600/5 border border-primary-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <FolderOpen size={18} className="text-primary-400" />
            <span className="text-sm font-medium text-primary-300">Categories</span>
          </div>
          <div className="text-3xl font-bold text-c-text mb-1">{data.totalCategories}</div>
          <div className="text-sm text-slate-400 dark:text-slate-500">Content organization</div>
        </div>

        {/* Tags */}
        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Tag size={18} className="text-emerald-400" />
            <span className="text-sm font-medium text-emerald-300">Tags</span>
          </div>
          <div className="text-3xl font-bold text-c-text mb-1">{data.totalTags}</div>
          <div className="text-sm text-slate-400 dark:text-slate-500">Content labels</div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Playbook Runs */}
        <div className="bg-c-surface-raised/50 border border-c-border/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-blue-400" />
              <h3 className="font-semibold text-c-text">Playbook Runs</h3>
            </div>
            <span className="text-2xl font-bold text-c-text">{data.totalPlaybookRuns}</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400 dark:text-slate-500">Success Rate</span>
              <span
                className={`font-medium ${
                  data.avgPlaybookSuccessRate >= 70
                    ? 'text-emerald-400'
                    : data.avgPlaybookSuccessRate >= 40
                      ? 'text-amber-400'
                      : 'text-danger-400'
                }`}
              >
                {data.avgPlaybookSuccessRate}%
              </span>
            </div>
            <div className="h-2 bg-c-surface rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  data.avgPlaybookSuccessRate >= 70
                    ? 'bg-emerald-500'
                    : data.avgPlaybookSuccessRate >= 40
                      ? 'bg-amber-500'
                      : 'bg-danger-500'
                }`}
                style={{ width: `${data.avgPlaybookSuccessRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Email Stats */}
        <div className="bg-c-surface-raised/50 border border-c-border/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Send size={18} className="text-pink-400" />
              <h3 className="font-semibold text-c-text">Emails Sent</h3>
            </div>
            <span className="text-2xl font-bold text-c-text">{data.totalEmailsSent}</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-slate-400 dark:text-slate-500 mb-1">Open Rate</div>
              <div className="text-lg font-semibold text-emerald-400">{data.avgEmailOpenRate}%</div>
            </div>
            <div>
              <div className="text-sm text-slate-400 dark:text-slate-500 mb-1">Click Rate</div>
              <div className="text-lg font-semibold text-blue-400">{data.avgEmailClickRate}%</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-c-surface-raised/50 border border-c-border/50 rounded-xl p-4">
          <h3 className="font-semibold text-c-text mb-4 flex items-center gap-2">
            <Zap size={18} className="text-amber-400" />
            Quick Actions
          </h3>
          <div className="space-y-2">
            <a
              href="/superadmin/playbook-templates"
              className="flex items-center justify-between p-2 rounded-lg hover:bg-c-surface-raised/50 transition-colors group"
            >
              <span className="text-slate-300 group-hover:text-white">Manage Playbooks</span>
              <TrendingUp
                size={14}
                className="text-slate-500 dark:text-slate-400 group-hover:text-primary-400"
              />
            </a>
            <a
              href="/superadmin/email-templates"
              className="flex items-center justify-between p-2 rounded-lg hover:bg-c-surface-raised/50 transition-colors group"
            >
              <span className="text-slate-300 group-hover:text-white">Email Templates</span>
              <TrendingUp
                size={14}
                className="text-slate-500 dark:text-slate-400 group-hover:text-pink-400"
              />
            </a>
            <a
              href="/superadmin/content/categories"
              className="flex items-center justify-between p-2 rounded-lg hover:bg-c-surface-raised/50 transition-colors group"
            >
              <span className="text-slate-300 group-hover:text-white">Manage Categories</span>
              <TrendingUp
                size={14}
                className="text-slate-500 dark:text-slate-400 group-hover:text-emerald-400"
              />
            </a>
          </div>
        </div>
      </div>

      {/* Top Content Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Playbooks */}
        <div className="bg-c-surface-raised/50 border border-c-border/50 rounded-xl p-4">
          <h3 className="font-semibold text-c-text mb-4 flex items-center gap-2">
            <Play size={18} className="text-blue-400" />
            Top Playbooks
          </h3>
          {data.topPlaybooks && data.topPlaybooks.length > 0 ? (
            <div className="space-y-3">
              {data.topPlaybooks.slice(0, 5).map((playbook, index: number) => (
                <div
                  key={playbook.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-c-surface-raised/30 transition-colors"
                >
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400 w-5">
                    #{index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-c-text truncate">{playbook.title}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {playbook.totalRuns} runs • {playbook.successRate}% success
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full">
                    {playbook.usageCount} uses
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-slate-500 dark:text-slate-400">
              No playbook data available
            </div>
          )}
        </div>

        {/* Top Emails */}
        <div className="bg-c-surface-raised/50 border border-c-border/50 rounded-xl p-4">
          <h3 className="font-semibold text-c-text mb-4 flex items-center gap-2">
            <Mail size={18} className="text-pink-400" />
            Top Email Templates
          </h3>
          {data.topEmails && data.topEmails.length > 0 ? (
            <div className="space-y-3">
              {data.topEmails.slice(0, 5).map((email, index: number) => (
                <div
                  key={email.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-c-surface-raised/30 transition-colors"
                >
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400 w-5">
                    #{index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-c-text truncate">{email.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {email.totalSends} sent • {email.openRate}% open rate
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 bg-pink-500/10 text-pink-400 rounded-full">
                    {email.clickRate}% CTR
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-slate-500 dark:text-slate-400">
              No email data available
            </div>
          )}
        </div>
      </div>

      {/* Usage by Category */}
      {data.usageByCategory && data.usageByCategory.length > 0 && (
        <div className="bg-c-surface-raised/50 border border-c-border/50 rounded-xl p-4">
          <h3 className="font-semibold text-c-text mb-4 flex items-center gap-2">
            <FolderOpen size={18} className="text-primary-400" />
            Usage by Category
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.usageByCategory.map((cat) => (
              <div key={cat.categoryId} className="bg-c-surface/50 rounded-lg p-3">
                <div className="text-sm font-medium text-c-text mb-2">{cat.categoryName}</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Playbooks:</span>
                    <span className="text-blue-400 ml-1">{cat.playbookCount}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Emails:</span>
                    <span className="text-pink-400 ml-1">{cat.emailCount}</span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                  {cat.usageCount} total uses
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {data.recentActivity && data.recentActivity.length > 0 && (
        <div className="bg-c-surface-raised/50 border border-c-border/50 rounded-xl p-4">
          <h3 className="font-semibold text-c-text mb-4 flex items-center gap-2">
            <Activity size={18} className="text-emerald-400" />
            Recent Activity
          </h3>
          <div className="space-y-2">
            {data.recentActivity.slice(0, 10).map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between py-2 border-b border-c-border/30 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-c-surface flex items-center justify-center">
                    {event.contentType === 'EMAIL_TEMPLATE' ? (
                      <Mail size={14} className="text-pink-400" />
                    ) : (
                      <Play size={14} className="text-blue-400" />
                    )}
                  </div>
                  <div>
                    <span className="text-sm text-c-text">
                      {String(event.eventType ?? 'Unknown').replaceAll('_', ' ')}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400 ml-2">
                      {String(event.contentType ?? 'Unknown').replaceAll('_', ' ')}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {new Date(event.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentAnalyticsDashboard;
