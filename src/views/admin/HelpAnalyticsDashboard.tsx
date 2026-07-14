/**
 * Help Analytics Dashboard
 *
 * Admin view for monitoring help system performance.
 * Route: Admin Panel > Help Analytics
 */

import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  BarChart2,
  BookOpen,
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  MessageSquare,
  MousePointer,
  RefreshCw,
  Search,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  Video,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '../../components/ui/primitives';
import Api from '../../services/api';

interface ContentPerformanceData {
  viewsByContent: {
    content_type: string;
    content_id: string;
    views: number;
    unique_viewers: number;
    avg_duration_ms: number;
  }[];
  videoCompletion: {
    content_id: string;
    starts: number;
    completions: number;
    completion_rate: number;
  }[];
  avgEngagement: { avg_duration: number; max_duration: number; min_duration: number };
}

interface SearchAnalyticsData {
  topQueries: { query: string; count: number; avg_results: number }[];
  zeroResults: { query: string; count: number }[];
  searchConversion: {
    total_searches: number;
    searches_with_click: number;
    conversion_rate: number;
  };
  searchVolume: { date: string; searches: number }[];
}

interface FeedbackData {
  overall: {
    total_feedback: number;
    helpful: number;
    not_helpful: number;
    helpfulness_rate: number;
    avg_rating: number;
  };
  byType: { content_type: string; count: number; helpfulness_rate: number; avg_rating: number }[];
  needsImprovement: {
    content_type: string;
    content_id: string;
    feedback_count: number;
    helpfulness_rate: number;
  }[];
  recentComments: {
    id: string;
    content_type: string;
    content_id: string;
    is_helpful: boolean;
    rating: number;
    comment: string;
    created_at: string;
  }[];
}

interface UserEngagementData {
  activeUsers: { active_users: number; sessions: number; total_events: number };
  dauTrend: { date: string; users: number; events: number }[];
}

interface DashboardData {
  contentPerformance: ContentPerformanceData;
  searchAnalytics: SearchAnalyticsData;
  feedbackSummary: FeedbackData;
  userEngagement: UserEngagementData;
  generatedAt: string;
  period: string;
}

export const HelpAnalyticsDashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'pl' ? 'pl' : 'en';

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState(30);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await Api.get(`/help-analytics/dashboard?days=${selectedPeriod}`);
      setData(response.data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError(
        t('admin.aiControlCenter.helpAnalytics.errors.fetch', 'Failed to fetch analytics data')
      );
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Stat Card Component
  const StatCard: React.FC<{
    title: string;
    value: string | number;
    change?: number;
    icon: React.ReactNode;
    color: string;
  }> = ({ title, value, change, icon, color }) => (
    <div className="bg-c-surface rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`}>
          {icon}
        </div>
        {change !== undefined && (
          <div
            className={`flex items-center gap-1 text-sm ${change >= 0 ? 'text-green-500' : 'text-danger-500'}`}
          >
            {change >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-c-text">{value}</p>
      <p className="text-sm text-c-text-muted">{title}</p>
    </div>
  );

  if (loading) {
    return (
      <LoadingState
        variant="spinner"
        className="h-96"
        label={t('admin.aiControlCenter.helpAnalytics.loading', 'Loading analytics...')}
      />
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-danger-500 mx-auto mb-4" />
          <p className="text-c-text-secondary">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-c-text text-c-bg rounded-lg hover:bg-c-text-secondary"
          >
            {t('admin.aiControlCenter.helpAnalytics.refresh', 'Refresh')}
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-c-text-muted">
          {t('admin.aiControlCenter.helpAnalytics.noData', 'No analytics data available')}
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-c-text flex items-center gap-3">
            <BarChart2 className="text-primary-500" />
            {t('admin.aiControlCenter.helpAnalytics.title', 'Help Analytics')}
          </h1>
          <p className="text-c-text-muted mt-1">
            {t(
              'admin.aiControlCenter.helpAnalytics.subtitle',
              'Monitor help system performance and user engagement'
            )}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Period selector */}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(Number(e.target.value))}
            className="px-3 py-2 bg-c-surface border border-c-border-subtle rounded-lg text-sm"
          >
            <option value={7}>7 {t('admin.aiControlCenter.helpAnalytics.days', 'days')}</option>
            <option value={30}>30 {t('admin.aiControlCenter.helpAnalytics.days', 'days')}</option>
            <option value={90}>90 {t('admin.aiControlCenter.helpAnalytics.days', 'days')}</option>
          </select>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-c-text text-c-bg rounded-lg hover:bg-c-text-secondary"
          >
            <RefreshCw size={16} />
            {t('admin.aiControlCenter.helpAnalytics.refresh', 'Refresh')}
          </button>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('admin.aiControlCenter.helpAnalytics.activeUsers', 'Active Users')}
          value={data.userEngagement?.activeUsers?.active_users || 0}
          icon={<Users className="text-c-text" size={24} />}
          color="bg-blue-500"
        />
        <StatCard
          title={t('admin.aiControlCenter.helpAnalytics.totalEvents', 'Total Events')}
          value={(data.userEngagement?.activeUsers?.total_events || 0).toLocaleString()}
          icon={<MousePointer className="text-c-text" size={24} />}
          color="bg-green-500"
        />
        <StatCard
          title={t('admin.aiControlCenter.helpAnalytics.helpfulnessRate', 'Helpfulness Rate')}
          value={`${data.feedbackSummary?.overall?.helpfulness_rate || 0}%`}
          icon={<ThumbsUp className="text-c-text" size={24} />}
          color="bg-c-surface"
        />
        <StatCard
          title={t('admin.aiControlCenter.helpAnalytics.avgRating', 'Avg Rating')}
          value={(data.feedbackSummary?.overall?.avg_rating || 0).toFixed(1)}
          icon={<TrendingUp className="text-c-text" size={24} />}
          color="bg-amber-500"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Viewed Content */}
        <div className="bg-c-surface rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
            <Eye size={20} className="text-blue-500" />
            {t('admin.aiControlCenter.helpAnalytics.topContent', 'Top Viewed Content')}
          </h3>
          <div className="space-y-3">
            {data.contentPerformance?.viewsByContent?.slice(0, 10).map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-c-border-subtle last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-c-surface-raised flex items-center justify-center text-xs font-medium">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-c-text">{item.content_id}</p>
                    <p className="text-xs text-c-text-muted">{item.content_type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-c-text">{item.views}</p>
                  <p className="text-xs text-c-text-muted">
                    {item.unique_viewers}{' '}
                    {t('admin.aiControlCenter.helpAnalytics.viewers', 'viewers')}
                  </p>
                </div>
              </div>
            ))}
            {(!data.contentPerformance?.viewsByContent ||
              data.contentPerformance.viewsByContent.length === 0) && (
              <p className="text-center text-c-text-secondary py-4">
                {t('admin.aiControlCenter.helpAnalytics.noData', 'No analytics data available')}
              </p>
            )}
          </div>
        </div>

        {/* Search Analytics */}
        <div className="bg-c-surface rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
            <Search size={20} className="text-green-500" />
            {t('admin.aiControlCenter.helpAnalytics.topSearches', 'Top Searches')}
          </h3>
          <div className="space-y-3">
            {data.searchAnalytics?.topQueries?.slice(0, 10).map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-c-border-subtle last:border-0"
              >
                <span className="text-sm text-c-text truncate mr-4">{item.query}</span>
                <div className="text-right flex-shrink-0">
                  <span className="text-sm font-medium">{item.count}</span>
                  <span className="text-xs text-c-text-muted ml-1">
                    {t('admin.aiControlCenter.helpAnalytics.searches', 'searches')}
                  </span>
                </div>
              </div>
            ))}
            {(!data.searchAnalytics?.topQueries ||
              data.searchAnalytics.topQueries.length === 0) && (
              <p className="text-center text-c-text-secondary py-4">
                {t('admin.aiControlCenter.helpAnalytics.noData', 'No analytics data available')}
              </p>
            )}
          </div>

          {/* Search conversion rate */}
          {data.searchAnalytics?.searchConversion && (
            <div className="mt-4 pt-4 border-t border-c-border-subtle">
              <div className="flex items-center justify-between">
                <span className="text-sm text-c-text-muted">
                  {t('admin.aiControlCenter.helpAnalytics.conversionRate', 'conversion rate')}
                </span>
                <span className="text-lg font-bold text-green-500">
                  {data.searchAnalytics.searchConversion.conversion_rate || 0}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Zero-Result Searches */}
        <div className="bg-c-surface rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
            <AlertCircle size={20} className="text-yellow-500" />
            {t('admin.aiControlCenter.helpAnalytics.zeroResults', 'Zero-Result Searches')}
          </h3>
          <p className="text-sm text-c-text-muted mb-4">
            {t(
              'admin.aiControlCenter.helpAnalytics.zeroResultsDescription',
              'Searches that returned no results - opportunities to add content'
            )}
          </p>
          <div className="space-y-2">
            {data.searchAnalytics?.zeroResults?.slice(0, 8).map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 px-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg"
              >
                <span className="text-sm text-c-text-secondary truncate mr-4">{item.query}</span>
                <span className="text-sm font-medium text-yellow-600">{item.count}x</span>
              </div>
            ))}
            {(!data.searchAnalytics?.zeroResults ||
              data.searchAnalytics.zeroResults.length === 0) && (
              <p className="text-center text-green-500 py-4 flex items-center justify-center gap-2">
                <CheckCircle size={18} />
                {t('admin.aiControlCenter.helpAnalytics.noZeroResults', 'No zero-result searches')}
              </p>
            )}
          </div>
        </div>

        {/* Needs Improvement */}
        <div className="bg-c-surface rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
            <ThumbsDown size={20} className="text-danger-500" />
            {t('admin.aiControlCenter.helpAnalytics.needsImprovement', 'Needs Improvement')}
          </h3>
          <p className="text-sm text-c-text-muted mb-4">
            {t(
              'admin.aiControlCenter.helpAnalytics.needsImprovementDescription',
              'Content with low helpfulness rate (<70%)'
            )}
          </p>
          <div className="space-y-2">
            {data.feedbackSummary?.needsImprovement?.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 px-3 bg-danger-50 dark:bg-danger-900/20 rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium text-c-text-secondary">{item.content_id}</p>
                  <p className="text-xs text-c-text-muted">{item.content_type}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-danger-600">{item.helpfulness_rate}%</p>
                  <p className="text-xs text-c-text-muted">
                    {t('admin.aiControlCenter.helpAnalytics.feedbackCount', '{{count}} feedback', {
                      count: item.feedback_count,
                    })}
                  </p>
                </div>
              </div>
            ))}
            {(!data.feedbackSummary?.needsImprovement ||
              data.feedbackSummary.needsImprovement.length === 0) && (
              <p className="text-center text-green-500 py-4 flex items-center justify-center gap-2">
                <CheckCircle size={18} />
                {t(
                  'admin.aiControlCenter.helpAnalytics.allContentHighlyRated',
                  'All content is highly rated'
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Video Completion Rates */}
      <div className="bg-c-surface rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
          <Video size={20} className="text-primary-500" />
          {t('admin.aiControlCenter.helpAnalytics.videoCompletion', 'Video Completion')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {data.contentPerformance?.videoCompletion?.slice(0, 8).map((video, i) => (
            <div key={i} className="p-4 bg-c-surface-raised/50 rounded-lg">
              <p className="text-sm font-medium text-c-text truncate mb-2">{video.content_id}</p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold text-primary-500">{video.completion_rate}%</p>
                  <p className="text-xs text-c-text-muted">
                    {t('admin.aiControlCenter.helpAnalytics.completionRate', 'completion rate')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-c-text-secondary">
                    {video.completions}/{video.starts}
                  </p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-2 h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                <div
                  className="h-full bg-c-surface rounded-full"
                  style={{ width: `${video.completion_rate}%` }}
                />
              </div>
            </div>
          ))}
          {(!data.contentPerformance?.videoCompletion ||
            data.contentPerformance.videoCompletion.length === 0) && (
            <p className="col-span-full text-center text-c-text-secondary py-4">
              {t('admin.aiControlCenter.helpAnalytics.noData', 'No analytics data available')}
            </p>
          )}
        </div>
      </div>

      {/* Recent Feedback */}
      <div className="bg-c-surface rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
          <MessageSquare size={20} className="text-blue-500" />
          {t('admin.aiControlCenter.helpAnalytics.recentFeedback', 'Recent Feedback')}
        </h3>
        <div className="space-y-4">
          {data.feedbackSummary?.recentComments?.slice(0, 5).map((comment) => (
            <div
              key={comment.id}
              className="flex items-start gap-4 p-4 bg-c-surface-raised/50 rounded-lg"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  comment.is_helpful
                    ? 'bg-green-100 text-green-600'
                    : 'bg-danger-100 text-danger-600'
                }`}
              >
                {comment.is_helpful ? <ThumbsUp size={16} /> : <ThumbsDown size={16} />}
              </div>
              <div className="flex-grow">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-c-text">{comment.content_id}</span>
                  <span className="text-xs text-c-text-muted">{comment.content_type}</span>
                  {comment.rating && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                      ★ {comment.rating}
                    </span>
                  )}
                </div>
                <p className="text-sm text-c-text-secondary">{comment.comment}</p>
                <p className="text-xs text-c-text-secondary mt-1">
                  {new Date(comment.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
          {(!data.feedbackSummary?.recentComments ||
            data.feedbackSummary.recentComments.length === 0) && (
            <p className="text-center text-c-text-secondary py-4">
              {t('admin.aiControlCenter.helpAnalytics.noData', 'No analytics data available')}
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-c-text-muted">
        <p>
          {t('admin.aiControlCenter.helpAnalytics.lastUpdated', 'Last updated')}:{' '}
          {new Date(data.generatedAt).toLocaleString(lang === 'pl' ? 'pl-PL' : 'en-US')}
        </p>
      </div>
    </div>
  );
};

export default HelpAnalyticsDashboard;
