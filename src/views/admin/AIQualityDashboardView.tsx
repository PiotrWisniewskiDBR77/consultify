/**
 * AI Quality Dashboard View
 * FLOW-AI-ADAPTIVE-001: Admin dashboard for AI quality monitoring
 *
 * Features:
 * - Quality metrics overview (satisfaction rate, feedback counts)
 * - Trend chart showing satisfaction over time
 * - Feedback management with filtering
 * - Learning patterns monitoring
 * - Context-based analytics
 *
 * @version 1.0.0
 */

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  CheckCircle,
  ChevronDown,
  Filter,
  MessageSquare,
  RefreshCw,
  Search,
  Settings,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

// ==========================================
// TYPES
// ==========================================

interface QualityMetrics {
  satisfactionRate: number | null;
  totalFeedback: number;
  positiveFeedback: number;
  negativeFeedback: number;
  avgActionability: number | null;
  avgAccuracy: number | null;
  activePatternsCount: number;
  userProfilesCount: number;
}

interface TrendPoint {
  date: string;
  total: number;
  positive: number;
  satisfactionRate: string | null;
}

interface FeedbackItem {
  id: string;
  user_name: string;
  user_email: string;
  feedback_type: string;
  rating: number;
  comment: string;
  actionability: number | null;
  accuracy: number | null;
  expected_format: string | null;
  missing_info: string | null;
  screen_context: string | null;
  created_at: string;
  reviewed_at: string | null;
}

interface LearningPattern {
  id: string;
  pattern_type: string;
  pattern_key: string;
  pattern_value: string;
  occurrence_count: number;
  confidence_score: number;
  user_name: string | null;
  status: string;
  created_at: string;
}

interface ContextAnalytics {
  context: string;
  total: number;
  positive: number;
  satisfactionRate: string | null;
  avgActionability: string | null;
  avgAccuracy: string | null;
}

// ==========================================
// COMPONENT
// ==========================================

const AIQualityDashboardView: React.FC = () => {
  const { t } = useTranslation();

  // State
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [metrics, setMetrics] = useState<QualityMetrics | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [patterns, setPatterns] = useState<LearningPattern[]>([]);
  const [contextAnalytics, setContextAnalytics] = useState<ContextAnalytics[]>([]);

  // Filters
  const [feedbackStatus, setFeedbackStatus] = useState<'all' | 'pending' | 'reviewed'>('all');
  const [feedbackRating, setFeedbackRating] = useState<'all' | 'positive' | 'negative'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Active tab
  const [activeTab, setActiveTab] = useState<'overview' | 'feedback' | 'patterns' | 'analytics'>(
    'overview'
  );

  // ==========================================
  // DATA FETCHING
  // ==========================================

  const fetchMetrics = async () => {
    try {
      const response = await Api.get(`/api/admin/ai-quality/metrics?period=${period}`);
      if (response.success) {
        setMetrics(response.metrics);
        setTrend(response.trend || []);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  };

  const fetchFeedback = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
      });
      if (feedbackStatus !== 'all') params.append('status', feedbackStatus);
      if (feedbackRating !== 'all') params.append('rating', feedbackRating);

      const response = await Api.get(`/api/admin/ai-quality/feedback?${params}`);
      if (response.success) {
        setFeedback(response.feedback || []);
        setTotalPages(response.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error('Failed to fetch feedback:', error);
    }
  };

  const fetchPatterns = async () => {
    try {
      const response = await Api.get('/api/admin/ai-quality/patterns');
      if (response.success) {
        setPatterns(response.patterns || []);
      }
    } catch (error) {
      console.error('Failed to fetch patterns:', error);
    }
  };

  const fetchContextAnalytics = async () => {
    try {
      const response = await Api.get(`/api/admin/ai-quality/analytics/contexts?period=${period}`);
      if (response.success) {
        setContextAnalytics(response.contexts || []);
      }
    } catch (error) {
      console.error('Failed to fetch context analytics:', error);
    }
  };

  const refreshData = async () => {
    setLoading(true);
    await Promise.all([fetchMetrics(), fetchFeedback(), fetchPatterns(), fetchContextAnalytics()]);
    setLoading(false);
  };

  useEffect(() => {
    refreshData();
  }, [period]);

  useEffect(() => {
    if (activeTab === 'feedback') {
      fetchFeedback();
    }
  }, [feedbackStatus, feedbackRating, currentPage]);

  // ==========================================
  // ACTIONS
  // ==========================================

  const reviewFeedback = async (id: string, actionTaken: string) => {
    try {
      await Api.post(`/api/admin/ai-quality/feedback/${id}/review`, { actionTaken });
      fetchFeedback();
    } catch (error) {
      console.error('Failed to review feedback:', error);
    }
  };

  const updatePatternStatus = async (id: string, status: string) => {
    try {
      await Api.post(`/api/admin/ai-quality/patterns/${id}/status`, { status });
      fetchPatterns();
    } catch (error) {
      console.error('Failed to update pattern:', error);
    }
  };

  // ==========================================
  // RENDER HELPERS
  // ==========================================

  const renderMetricCard = (
    title: string,
    value: string | number | null,
    icon: React.ReactNode,
    trend?: 'up' | 'down' | 'neutral',
    subtitle?: string
  ) => (
    <div className="bg-c-surface rounded-xl p-4 border border-c-border-subtle">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-c-text-muted">{title}</span>
        {icon}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-c-text">{value ?? '-'}</span>
        {trend && (
          <span
            className={`text-xs ${
              trend === 'up'
                ? 'text-green-500'
                : trend === 'down'
                  ? 'text-danger-500'
                  : 'text-c-text-muted'
            }`}
          >
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-c-text-muted mt-1">{subtitle}</p>}
    </div>
  );

  const renderTrendChart = () => {
    if (trend.length === 0) {
      return (
        <div className="h-48 flex items-center justify-center text-c-text-muted">
          {t('admin.aiQuality.noTrendData', 'Brak danych trendu')}
        </div>
      );
    }

    const maxValue = Math.max(...trend.map((t) => t.total), 1);

    return (
      <div className="h-48 flex items-end gap-1">
        {trend.map((point, idx) => {
          const height = (point.total / maxValue) * 100;
          const positiveHeight = point.total > 0 ? (point.positive / point.total) * height : 0;

          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full relative" style={{ height: `${height}%`, minHeight: '4px' }}>
                <div
                  className="absolute bottom-0 w-full bg-green-500 rounded-t"
                  style={{ height: `${positiveHeight}%` }}
                />
                <div
                  className="absolute bottom-0 w-full bg-slate-300 dark:bg-slate-600 rounded-t"
                  style={{ height: '100%', zIndex: -1 }}
                />
              </div>
              <span className="text-[8px] text-c-text-muted truncate w-full text-center">
                {point.date.split('-').slice(1).join('/')}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-c-text flex items-center gap-2">
            <Brain className="text-primary-500" />
            {t('admin.aiQuality.title', 'AI Quality Dashboard')}
          </h1>
          <p className="text-sm text-c-text-muted mt-1">
            {t('admin.aiQuality.subtitle', 'Monitorowanie jakości i uczenia AI')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period selector */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="px-3 py-2 text-sm bg-c-surface border border-c-border-subtle rounded-lg"
          >
            <option value="7d">7 dni</option>
            <option value="30d">30 dni</option>
            <option value="90d">90 dni</option>
          </select>

          {/* Refresh button */}
          <button
            onClick={refreshData}
            disabled={loading}
            className="p-2 text-c-text-muted hover:text-primary-500 hover:bg-c-surface-raised rounded-lg transition-colors"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-c-surface-raised p-1 rounded-lg w-fit">
        {[
          {
            id: 'overview',
            label: t('admin.aiQuality.tabs.overview', 'Przegląd'),
            icon: BarChart3,
          },
          {
            id: 'feedback',
            label: t('admin.aiQuality.tabs.feedback', 'Feedback'),
            icon: MessageSquare,
          },
          { id: 'patterns', label: t('admin.aiQuality.tabs.patterns', 'Wzorce'), icon: Brain },
          {
            id: 'analytics',
            label: t('admin.aiQuality.tabs.analytics', 'Analityka'),
            icon: Activity,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.id
                ? 'bg-c-surface text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-c-text-secondary hover:text-c-text dark:hover:text-white'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {renderMetricCard(
              t('admin.aiQuality.metrics.satisfaction', 'Satysfakcja'),
              metrics?.satisfactionRate ? `${metrics.satisfactionRate}%` : null,
              <ThumbsUp size={18} className="text-green-500" />,
              'neutral',
              t('admin.aiQuality.metrics.satisfactionDesc', 'Pozytywne / wszystkie')
            )}
            {renderMetricCard(
              t('admin.aiQuality.metrics.totalFeedback', 'Feedback'),
              metrics?.totalFeedback ?? 0,
              <MessageSquare size={18} className="text-blue-500" />,
              'neutral'
            )}
            {renderMetricCard(
              t('admin.aiQuality.metrics.avgActionability', 'Przydatność'),
              metrics?.avgActionability ? `${metrics.avgActionability}/5` : null,
              <CheckCircle size={18} className="text-emerald-500" />
            )}
            {renderMetricCard(
              t('admin.aiQuality.metrics.avgAccuracy', 'Trafność'),
              metrics?.avgAccuracy ? `${metrics.avgAccuracy}/5` : null,
              <TrendingUp size={18} className="text-primary-500" />
            )}
          </div>

          {/* Trend Chart */}
          <div className="bg-c-surface rounded-xl p-6 border border-c-border-subtle">
            <h3 className="text-sm font-medium text-c-text mb-4">
              {t('admin.aiQuality.trendChart', 'Trend satysfakcji')}
            </h3>
            {renderTrendChart()}
            <div className="flex items-center gap-4 mt-4 text-xs text-c-text-muted">
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded" /> Pozytywne
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-slate-300 dark:bg-slate-600 rounded" /> Wszystkie
              </span>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-c-surface rounded-xl p-4 border border-c-border-subtle">
              <h3 className="text-sm font-medium text-c-text mb-3">
                {t('admin.aiQuality.learningStatus', 'Status uczenia')}
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-c-text-muted">Aktywne wzorce</span>
                  <span className="font-medium">{metrics?.activePatternsCount ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-c-text-muted">Profile użytkowników</span>
                  <span className="font-medium">{metrics?.userProfilesCount ?? 0}</span>
                </div>
              </div>
            </div>

            <div className="bg-c-surface rounded-xl p-4 border border-c-border-subtle">
              <h3 className="text-sm font-medium text-c-text mb-3">
                {t('admin.aiQuality.feedbackBreakdown', 'Rozkład feedbacku')}
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-green-500 flex items-center gap-1">
                    <ThumbsUp size={14} /> Pozytywne
                  </span>
                  <span className="font-medium">{metrics?.positiveFeedback ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-danger-500 flex items-center gap-1">
                    <ThumbsDown size={14} /> Negatywne
                  </span>
                  <span className="font-medium">{metrics?.negativeFeedback ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Tab */}
      {activeTab === 'feedback' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4 bg-c-surface p-4 rounded-xl border border-c-border-subtle">
            <Filter size={18} className="text-c-text-muted" />
            <select
              value={feedbackStatus}
              onChange={(e) => {
                setFeedbackStatus(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 text-sm bg-c-surface-raised border border-c-border-subtle rounded-lg"
            >
              <option value="all">Wszystkie</option>
              <option value="pending">Oczekujące</option>
              <option value="reviewed">Przejrzane</option>
            </select>
            <select
              value={feedbackRating}
              onChange={(e) => {
                setFeedbackRating(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 text-sm bg-c-surface-raised border border-c-border-subtle rounded-lg"
            >
              <option value="all">Wszystkie oceny</option>
              <option value="positive">Pozytywne</option>
              <option value="negative">Negatywne</option>
            </select>
          </div>

          {/* Feedback List */}
          <div className="bg-c-surface rounded-xl border border-c-border-subtle overflow-hidden">
            <table
              /* §27-exempt: data-viz/render analityczny read-only, nie lista encji */ className="w-full"
            >
              <thead className="bg-c-surface-raised/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted">
                    Użytkownik
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted">
                    Ocena
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted">
                    Kontekst
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted">
                    Komentarz
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted">
                    Data
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted">
                    Akcje
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {feedback.map((item) => (
                  <tr key={item.id} className="hover:bg-c-surface-raised/50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-c-text">
                        {item.user_name || 'Nieznany'}
                      </div>
                      <div className="text-xs text-c-text-muted">{item.user_email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                          item.rating > 0 || item.feedback_type === 'HELPFUL'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                            : 'bg-danger-100 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400'
                        }`}
                      >
                        {item.rating > 0 || item.feedback_type === 'HELPFUL' ? (
                          <ThumbsUp size={12} />
                        ) : (
                          <ThumbsDown size={12} />
                        )}
                        {item.rating > 0 || item.feedback_type === 'HELPFUL'
                          ? 'Pozytywna'
                          : 'Negatywna'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-c-text-secondary">
                      {item.screen_context || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-c-text-secondary max-w-xs truncate">
                      {item.missing_info || item.comment || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-c-text-muted">
                      {new Date(item.created_at).toLocaleDateString('pl-PL')}
                    </td>
                    <td className="px-4 py-3">
                      {!item.reviewed_at ? (
                        <button
                          onClick={() => reviewFeedback(item.id, 'reviewed')}
                          className="text-xs text-primary-600 hover:text-primary-500"
                        >
                          Oznacz jako przejrzane
                        </button>
                      ) : (
                        <span className="text-xs text-green-500 flex items-center gap-1">
                          <CheckCircle size={12} /> Przejrzane
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {feedback.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-c-text-muted">
                      Brak feedbacku do wyświetlenia
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm bg-c-surface-raised rounded-lg disabled:opacity-50"
              >
                Poprzednia
              </button>
              <span className="px-3 py-1.5 text-sm text-c-text-secondary">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm bg-c-surface-raised rounded-lg disabled:opacity-50"
              >
                Następna
              </button>
            </div>
          )}
        </div>
      )}

      {/* Patterns Tab */}
      {activeTab === 'patterns' && (
        <div className="space-y-4">
          <div className="bg-c-surface rounded-xl border border-c-border-subtle overflow-hidden">
            <div className="p-4 border-b border-c-border-subtle">
              <h3 className="font-medium text-c-text">Wykryte wzorce uczenia</h3>
              <p className="text-sm text-c-text-muted mt-1">
                Wzorce preferencji wykryte na podstawie feedbacku użytkowników
              </p>
            </div>
            <table className="w-full">
              <thead className="bg-c-surface-raised/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted">Typ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted">
                    Wartość
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted">
                    Wystąpienia
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted">
                    Pewność
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted">
                    Akcje
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {patterns.map((pattern) => (
                  <tr key={pattern.id} className="hover:bg-c-surface-raised/50">
                    <td className="px-4 py-3 text-sm font-medium text-c-text">
                      {pattern.pattern_type.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3 text-sm text-c-text-secondary">
                      {pattern.pattern_value}
                    </td>
                    <td className="px-4 py-3 text-sm text-c-text-secondary">
                      {pattern.occurrence_count}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              pattern.confidence_score >= 0.8
                                ? 'bg-green-500'
                                : pattern.confidence_score >= 0.5
                                  ? 'bg-yellow-500'
                                  : 'bg-danger-500'
                            }`}
                            style={{ width: `${pattern.confidence_score * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-c-text-muted">
                          {(pattern.confidence_score * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          pattern.status === 'active'
                            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                            : pattern.status === 'applied'
                              ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-c-surface-raised text-c-text-secondary dark:bg-slate-700 dark:text-c-text-muted'
                        }`}
                      >
                        {pattern.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {pattern.status === 'active' && (
                          <>
                            <button
                              onClick={() => updatePatternStatus(pattern.id, 'applied')}
                              className="text-xs text-green-600 hover:text-green-500"
                            >
                              Zastosuj
                            </button>
                            <button
                              onClick={() => updatePatternStatus(pattern.id, 'rejected')}
                              className="text-xs text-danger-600 hover:text-danger-500"
                            >
                              Odrzuć
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {patterns.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-c-text-muted">
                      Brak wykrytych wzorców
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Context Analytics */}
          <div className="bg-c-surface rounded-xl border border-c-border-subtle overflow-hidden">
            <div className="p-4 border-b border-c-border-subtle">
              <h3 className="font-medium text-c-text">Analiza według kontekstu</h3>
              <p className="text-sm text-c-text-muted mt-1">
                Satysfakcja i jakość odpowiedzi w różnych kontekstach ekranu
              </p>
            </div>
            <table className="w-full">
              <thead className="bg-c-surface-raised/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted">
                    Kontekst
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted">
                    Feedback
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted">
                    Satysfakcja
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted">
                    Przydatność
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted">
                    Trafność
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {contextAnalytics.map((ctx) => (
                  <tr key={ctx.context} className="hover:bg-c-surface-raised/50">
                    <td className="px-4 py-3 text-sm font-medium text-c-text">{ctx.context}</td>
                    <td className="px-4 py-3 text-sm text-c-text-secondary">{ctx.total}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          parseFloat(ctx.satisfactionRate || '0') >= 70
                            ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                            : parseFloat(ctx.satisfactionRate || '0') >= 50
                              ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : 'bg-danger-100 text-danger-600 dark:bg-danger-900/30 dark:text-danger-400'
                        }`}
                      >
                        {ctx.satisfactionRate ? `${ctx.satisfactionRate}%` : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-c-text-secondary">
                      {ctx.avgActionability ? `${ctx.avgActionability}/5` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-c-text-secondary">
                      {ctx.avgAccuracy ? `${ctx.avgAccuracy}/5` : '-'}
                    </td>
                  </tr>
                ))}
                {contextAnalytics.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-c-text-muted">
                      Brak danych analitycznych
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIQualityDashboardView;
