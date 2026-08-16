/**
 * PartnerPortalView - Main Partner Portal with Two-Column Layout
 *
 * Modules: Dashboard | Clients | Certification | Resources | Billing | Profile
 *
 * Features:
 * - Sidebar navigation with grouped sections (always expanded)
 * - Search functionality with Cmd+K
 * - Badge support for pending items
 * - Responsive two-column layout
 * - Consistent styling with Admin module (violet accents)
 *
 * Designed for DBR77 Consultify Partner Program
 */

import {
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  ExternalLink,
  FileText,
  FolderKanban,
  GraduationCap,
  MapPin,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { type Breadcrumb, PartnerLayout } from '../../components/Partner/PartnerLayout';
import {
  loadPartnerCanonicalRuntime,
  PartnerCanonicalRuntimePanel,
  type PartnerCanonicalRuntimeSnapshot,
} from '../../components/Partner/PartnerCanonicalRuntimePanel';
import {
  loadPartnerRuntimeSummary,
  type PartnerRuntimeSummary,
  PartnerRuntimeSummaryStrip,
} from '../../components/Partner/PartnerRuntimeSummaryStrip';
import { PartnerSection } from '../../components/Partner/PartnerSidebar';
import { FilterableTable, type FilterChip } from '../../components/shared/ModuleHub';
import { EntityStatusChip } from '../../components/ui/primitives/chips';
import {
  PARTNER_CERTIFICATION_DOC_BY_TYPE,
  PARTNER_DOC_HREF_BY_SLUG,
} from '../../config/partnerKnowledge';
import { ROUTES } from '../../routes/routeConfig';
import { Api } from '../../services/api';
import {
  shouldFallbackToLegacyPartner,
  V8PartnerApi,
  type V8PartnerClient,
  type V8PartnerEarningsSummary,
  type V8PartnerOnboardingStatus,
  type V8PartnerProject,
  type V8PartnerReferralAnalytics,
} from '../../services/api/v8';
import { cn } from '../../utils/cn';
import { getLegacyPartnerSection } from './partnerLegacyRoutes';
import { PartnerStartRouter } from './PartnerStartRouter';

const PARTNER_SECTIONS = new Set<PartnerSection>([
  'partner-home',
  'dashboard',
  'metrics',
  'referral-tools',
  'referral-analytics',
  'referred-organizations',
  'earnings',
  'statements',
  'payouts',
  'payout-settings',
  'client-access',
  'organizations',
  'projects',
  'users',
  'learning-path',
  'exams',
  'certificates',
  'documentation',
  'marketing',
  'case-studies',
  'templates',
  'company-info',
  'specializations',
  'regions',
  'public-listing',
]);

function isPartnerSection(value: string | null): value is PartnerSection {
  return Boolean(value && PARTNER_SECTIONS.has(value as PartnerSection));
}

// Lazy load new sections
const ReferralToolsSection = React.lazy(() => import('./sections/ReferralToolsSection'));
const EarningsSection = React.lazy(() => import('./sections/EarningsSection'));
const ProviderHomeView = React.lazy(() => import('./ProviderHomeView'));
const ClientAccessView = React.lazy(() => import('./ClientAccessView'));

// ============================================================================
// DASHBOARD SECTION - Connected to API
// ============================================================================

interface DashboardData {
  stats: {
    activeClients: number;
    activeProjects: number;
    certificationLevel: string;
    monthlyRevenue: number;
    revenueChange: number;
    totalLicenses: number;
    activeLicenses: number;
    availableLicenses: number;
  };
  recentActivity: Array<{
    type: string;
    text: string;
    time: string;
  }>;
  certificationProgress: {
    completed: number;
    total: number;
    courses: Array<{
      name: string;
      status: string;
      progress?: number;
    }>;
  };
}

const DashboardSection: React.FC = () => {
  const { t } = useTranslation();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [v8RuntimeSummary, setV8RuntimeSummary] = useState<PartnerRuntimeSummary | null>(null);
  const [canonicalRuntime, setCanonicalRuntime] =
    useState<PartnerCanonicalRuntimeSnapshot | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<V8PartnerOnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await Api.get('/api/partners/dashboard');
      const payload = response?.data;
      const data = payload?.data;
      if (response?.success && data) {
        const DEFAULT_DASHBOARD: DashboardData = {
          stats: {
            activeClients: 0,
            activeProjects: 0,
            certificationLevel: 'Registered',
            monthlyRevenue: 0,
            revenueChange: 0,
            totalLicenses: 0,
            activeLicenses: 0,
            availableLicenses: 0,
          },
          recentActivity: [],
          certificationProgress: { completed: 0, total: 0, courses: [] },
        };

        const merged: DashboardData = {
          ...DEFAULT_DASHBOARD,
          ...(data as any),
          stats: {
            ...DEFAULT_DASHBOARD.stats,
            ...((data as any)?.stats || {}),
          },
          recentActivity: Array.isArray((data as any)?.recentActivity)
            ? (data as any).recentActivity
            : DEFAULT_DASHBOARD.recentActivity,
          certificationProgress: {
            ...DEFAULT_DASHBOARD.certificationProgress,
            ...((data as any)?.certificationProgress || {}),
            courses: Array.isArray((data as any)?.certificationProgress?.courses)
              ? (data as any).certificationProgress.courses
              : DEFAULT_DASHBOARD.certificationProgress.courses,
          },
        };

        setDashboardData(merged);
      } else {
        throw new Error('Invalid response');
      }
    } catch (err: any) {
      console.error('Error fetching dashboard:', err);
      setError(err?.message || 'Failed to load dashboard');
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchV8RuntimeSummary = useCallback(async () => {
    try {
      const summary = await loadPartnerRuntimeSummary();
      setV8RuntimeSummary(summary);
    } catch {
      setV8RuntimeSummary(null);
    }
  }, []);

  const fetchCanonicalRuntime = useCallback(async () => {
    const snapshot = await loadPartnerCanonicalRuntime();
    setCanonicalRuntime(snapshot);
  }, []);

  const fetchOnboardingStatus = useCallback(async () => {
    try {
      const response = await V8PartnerApi.getOnboardingStatus();
      setOnboardingStatus(response?.status || null);
    } catch (error) {
      if (!shouldFallbackToLegacyPartner(error)) {
        setOnboardingStatus(null);
        return;
      }
      try {
        const legacy = await Api.get('/onboarding/status');
        const payload = legacy?.data?.status ?? legacy?.status ?? legacy?.data ?? legacy;
        setOnboardingStatus(payload || null);
      } catch {
        setOnboardingStatus(null);
      }
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    void fetchV8RuntimeSummary();
    void fetchCanonicalRuntime();
    void fetchOnboardingStatus();
  }, [fetchCanonicalRuntime, fetchDashboard, fetchOnboardingStatus, fetchV8RuntimeSummary]);

  // DP-5 (M26 L-10): "Add New Client" dropped — client creation is a
  // FEATURE_NOT_AVAILABLE stub (503), so we don't surface a dead create action.
  // Client management lands in v1.1.
  const quickActions = [
    { label: 'Start Project', icon: FolderKanban, action: 'start-project' },
    { label: 'View Resources', icon: BookOpen, action: 'resources' },
    { label: 'Download Materials', icon: Download, action: 'download' },
  ];

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 dark:bg-navy-700 rounded w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-c-surface rounded-xl border border-c-border-subtle p-4">
              <div className="h-4 bg-slate-200 dark:bg-navy-700 rounded w-2/3 mb-3" />
              <div className="h-8 bg-slate-200 dark:bg-navy-700 rounded w-1/2 mb-2" />
              <div className="h-3 bg-slate-200 dark:bg-navy-700 rounded w-1/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl p-6 text-center">
        <p className="text-danger-400 mb-4">{error}</p>
        <button
          onClick={fetchDashboard}
          className="px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg text-sm font-medium"
        >
          {t('common.retry', 'Retry')}
        </button>
      </div>
    );
  }

  const s = dashboardData?.stats;
  const stats = s
    ? [
        {
          label: t('partner.dashboard.activeClients', 'Active Clients'),
          value: String(s.activeClients ?? 0),
          change: `${(s.activeClients ?? 0) > 0 ? '+' : ''}${s.activeClients ?? 0}`,
          changeType: 'positive' as const,
          icon: Building2,
        },
        {
          label: t('partner.dashboard.activeProjects', 'Active Projects'),
          value: String(s.activeProjects ?? 0),
          change: `${(s.activeProjects ?? 0) > 0 ? '+' : ''}${s.activeProjects ?? 0}`,
          changeType: 'positive' as const,
          icon: FolderKanban,
        },
        {
          label: t('partner.dashboard.certificationLevel', 'Certification Level'),
          value: s.certificationLevel || 'Registered',
          change: `${dashboardData?.certificationProgress?.completed ?? 0}/${dashboardData?.certificationProgress?.total ?? 0} completed`,
          changeType: 'neutral' as const,
          icon: GraduationCap,
        },
        {
          label: t('partner.dashboard.monthlyRevenue', 'Monthly Revenue'),
          value: `€${(s.monthlyRevenue || 0).toLocaleString()}`,
          change: `${(s.revenueChange ?? 0) > 0 ? '+' : ''}${s.revenueChange ?? 0}%`,
          changeType: (s.revenueChange ?? 0) >= 0 ? ('positive' as const) : ('negative' as const),
          icon: TrendingUp,
        },
      ]
    : [];

  const recentActivity = dashboardData?.recentActivity || [];
  const certificationCourses = dashboardData?.certificationProgress?.courses || [];

  // Honest empty-state: a freshly-connected partner has all-zero core metrics.
  const isFreshPartner =
    !!s &&
    (s.activeClients ?? 0) === 0 &&
    (s.activeProjects ?? 0) === 0 &&
    (s.monthlyRevenue ?? 0) === 0 &&
    recentActivity.length === 0;

  return (
    <div className="space-y-6">
      {v8RuntimeSummary && <PartnerRuntimeSummaryStrip summary={v8RuntimeSummary} />}
      {canonicalRuntime && <PartnerCanonicalRuntimePanel snapshot={canonicalRuntime} />}

      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-c-text">
            {t('partner.dashboard.welcome', 'Welcome back, Partner')}
          </h2>
          <p className="text-c-text-secondary">
            {t('partner.dashboard.subtitle', "Here's your partnership overview")}
          </p>
        </div>
        <button
          onClick={fetchDashboard}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-c-text-secondary hover:text-navy-900 dark:hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          {t('common.refresh', 'Refresh')}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="bg-c-surface rounded-xl border border-c-border-subtle p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
                <stat.icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <span className="text-sm text-c-text-secondary">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold text-c-text">{stat.value}</p>
            <p
              className={cn(
                'text-sm mt-1',
                stat.changeType === 'positive' && 'text-emerald-600 dark:text-emerald-400',
                stat.changeType === 'negative' && 'text-danger-400',
                stat.changeType === 'neutral' && 'text-c-text-secondary'
              )}
            >
              {stat.change}
            </p>
          </div>
        ))}
      </div>

      {isFreshPartner && (
        <div className="rounded-xl border border-primary-200 bg-primary-50 p-4 text-sm text-primary-800 dark:border-primary-700/50 dark:bg-primary-900/20 dark:text-primary-200">
          {t(
            'partner.dashboard.freshHint',
            'Twoje dane pojawią się tutaj po pierwszych poleceniach i transakcjach prowizyjnych.'
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-c-surface rounded-xl border border-c-border-subtle p-4">
        <h3 className="text-lg font-semibold text-c-text mb-4">
          {t('partner.dashboard.quickActions', 'Quick Actions')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((action, index) => (
            <button
              key={index}
              className="flex flex-col items-center gap-2 p-4 rounded-lg bg-c-surface-raised/50 hover:bg-primary-900/20 transition-colors group"
            >
              <action.icon className="w-6 h-6 text-c-text-secondary group-hover:text-primary-600 dark:group-hover:text-primary-400" />
              <span className="text-sm font-medium text-c-text-secondary group-hover:text-primary-600 dark:group-hover:text-primary-400">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-c-surface rounded-xl border border-c-border-subtle p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
              <Clock className="w-5 h-5 text-c-text-muted" />
              {t('partner.dashboard.recentActivity', 'Recent Activity')}
            </h3>
            <button className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
              {t('common.viewAll', 'View All')}
            </button>
          </div>
          <div className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg bg-c-surface-raised/50 dark:bg-navy-700/30"
                >
                  <div className="w-2 h-2 rounded-full bg-navy-900 dark:bg-c-surface" />
                  <div className="flex-1">
                    <p className="text-sm text-c-text">{activity.text}</p>
                    <p className="text-xs text-c-text-secondary">{activity.time}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-c-text-secondary text-center py-4">
                {t('partner.dashboard.noActivity', 'No recent activity')}
              </p>
            )}
          </div>
        </div>

        {/* Certification Progress */}
        <div className="bg-c-surface rounded-xl border border-c-border-subtle p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-c-text-muted" />
              {t('partner.dashboard.certificationProgress', 'Certification Progress')}
            </h3>
            <span className="text-sm text-primary-600 dark:text-primary-400 font-medium">
              {dashboardData?.certificationProgress?.completed || 0}/
              {dashboardData?.certificationProgress?.total || 0} Complete
            </span>
          </div>
          <div className="space-y-3">
            {certificationCourses.length > 0 ? (
              certificationCourses.map((cert, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg bg-c-surface-raised/50 dark:bg-navy-700/30"
                >
                  {cert.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : cert.status === 'in-progress' ? (
                    <div className="w-5 h-5 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-c-border" />
                  )}
                  <span
                    className={cn(
                      'text-sm flex-1',
                      cert.status === 'completed' && 'text-c-text',
                      cert.status === 'in-progress' && 'text-primary-600 dark:text-primary-400',
                      cert.status === 'locked' && 'text-c-text-muted'
                    )}
                  >
                    {cert.name}
                  </span>
                  {cert.status === 'in-progress' && cert.progress !== undefined && (
                    <span className="text-xs text-primary-600 dark:text-primary-400">
                      {cert.progress}%
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-c-text-secondary text-center py-4">
                {t('partner.dashboard.noCertifications', 'No certifications available')}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// METRICS SECTION - Connected to API
// ============================================================================

interface MetricsData {
  revenue: {
    totalYTD: number;
    change: number;
    byMonth: number[];
  };
  clients: {
    retention: number;
    newThisQuarter: number;
    churned: number;
    avgProjectDuration: number;
  };
  performance: {
    score: number;
    breakdown: {
      clientAcquisition: number;
      projectDelivery: number;
      customerSatisfaction: number;
      certificationProgress: number;
    };
    ranking: string;
  };
  satisfaction: {
    score: number;
    responses: number;
    trend: string;
  };
}

const buildFallbackMetricsData = (
  referralAnalytics: V8PartnerReferralAnalytics,
  earningsSummary: V8PartnerEarningsSummary
): MetricsData => {
  const toNumber = (value: unknown): number => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const totalEarned = toNumber(earningsSummary.totalEarned);
  const thisMonth = toNumber(earningsSummary.thisMonth);
  const lastMonth = toNumber(earningsSummary.lastMonth);
  const revenueChange =
    lastMonth > 0
      ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100)
      : thisMonth > 0
        ? 100
        : 0;

  const clientAcquisition = Math.min(100, referralAnalytics.signups * 10);
  const projectDelivery = Math.min(100, referralAnalytics.paidCustomers * 20);
  const customerSatisfaction = Math.min(100, Math.round(referralAnalytics.conversionRate));
  const certificationProgress = 0;
  const performanceScore = Math.round(
    (clientAcquisition + projectDelivery + customerSatisfaction + certificationProgress) / 4
  );

  return {
    revenue: {
      totalYTD: totalEarned,
      change: revenueChange,
      byMonth: [0, 0, 0, 0, lastMonth, thisMonth],
    },
    clients: {
      retention:
        referralAnalytics.signups > 0
          ? Math.round((referralAnalytics.paidCustomers / referralAnalytics.signups) * 100)
          : 0,
      newThisQuarter: referralAnalytics.signups || 0,
      churned: 0,
      avgProjectDuration: 0,
    },
    performance: {
      score: performanceScore,
      breakdown: {
        clientAcquisition,
        projectDelivery,
        customerSatisfaction,
        certificationProgress,
      },
      ranking: 'Governed runtime snapshot',
    },
    satisfaction: {
      score: Number(Math.min(5, referralAnalytics.conversionRate / 20 || 0).toFixed(1)),
      responses: referralAnalytics.paidCustomers || 0,
      trend: 'governed runtime',
    },
  };
};

const normalizeMetricsPayload = (payload: any): MetricsData | null => {
  const asNumber = (value: unknown): number => {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return 0;
      const parsed = Number(trimmed.replace(/,/g, '.'));
      if (Number.isFinite(parsed)) return parsed;
      const tokens = trimmed.match(/-?\d+(?:[.,]\d+)?/g);
      if (!tokens?.length) return 0;
      const summed = tokens.reduce((sum, token) => {
        const tokenNumber = Number(token.replace(/,/g, '.'));
        return Number.isFinite(tokenNumber) ? sum + tokenNumber : sum;
      }, 0);
      return Number.isFinite(summed) ? summed : 0;
    }
    if (Array.isArray(value)) {
      return value.reduce((sum, item) => sum + asNumber(item), 0);
    }
    return 0;
  };

  const asNumberArray = (value: unknown): number[] => {
    if (!Array.isArray(value)) return [];
    return value.map((item) => asNumber(item)).filter((item) => Number.isFinite(item));
  };

  const data = payload?.data && payload?.data !== payload ? payload.data : payload;
  if (!data) return null;
  if (data.revenue && data.clients && data.performance && data.satisfaction) {
    const monthlyRevenue = asNumberArray(data.revenue.byMonth);
    const totalYTD = asNumber(data.revenue.totalYTD);
    const sanitizedTotalYTD =
      totalYTD > 0 ? totalYTD : monthlyRevenue.reduce((sum, monthValue) => sum + monthValue, 0);

    return {
      revenue: {
        totalYTD: sanitizedTotalYTD,
        change: asNumber(data.revenue.change),
        byMonth: monthlyRevenue,
      },
      clients: {
        retention: asNumber(data.clients.retention),
        newThisQuarter: asNumber(data.clients.newThisQuarter),
        churned: asNumber(data.clients.churned),
        avgProjectDuration: asNumber(data.clients.avgProjectDuration),
      },
      performance: {
        score: asNumber(data.performance.score),
        breakdown: {
          clientAcquisition: asNumber(data.performance.breakdown?.clientAcquisition),
          projectDelivery: asNumber(data.performance.breakdown?.projectDelivery),
          customerSatisfaction: asNumber(data.performance.breakdown?.customerSatisfaction),
          certificationProgress: asNumber(data.performance.breakdown?.certificationProgress),
        },
        ranking:
          typeof data.performance.ranking === 'string' && data.performance.ranking.trim()
            ? data.performance.ranking
            : 'Governed runtime snapshot',
      },
      satisfaction: {
        score: asNumber(data.satisfaction.score),
        responses: asNumber(data.satisfaction.responses),
        trend:
          typeof data.satisfaction.trend === 'string' && data.satisfaction.trend.trim()
            ? data.satisfaction.trend
            : 'stable',
      },
    };
  }
  if (data.referralAnalytics && data.earningsSummary) {
    return buildFallbackMetricsData(data.referralAnalytics, data.earningsSummary);
  }
  return null;
};

const MetricsSection: React.FC = () => {
  const { t } = useTranslation();
  const formatEuro = useCallback((value: number) => {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
      currencyDisplay: 'code',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0);
  }, []);
  const [metricsData, setMetricsData] = useState<MetricsData | null>(null);
  const [v8RuntimeSummary, setV8RuntimeSummary] = useState<PartnerRuntimeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await Api.get('/api/partners/metrics');
      const metrics = normalizeMetricsPayload(response?.data);
      if (response?.success && metrics) {
        setMetricsData(metrics);
      } else {
        throw new Error('Invalid response');
      }
    } catch (err: any) {
      console.error('Error fetching metrics:', err);
      setError(err?.message || 'Failed to load metrics');
      toast.error('Failed to load metrics data');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchV8RuntimeSummary = useCallback(async () => {
    try {
      const summary = await loadPartnerRuntimeSummary();
      setV8RuntimeSummary(summary);
    } catch {
      setV8RuntimeSummary(null);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    void fetchV8RuntimeSummary();
  }, [fetchMetrics, fetchV8RuntimeSummary]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 dark:bg-navy-700 rounded w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-c-surface rounded-xl border border-c-border-subtle p-4">
              <div className="h-4 bg-slate-200 dark:bg-navy-700 rounded w-2/3 mb-3" />
              <div className="h-8 bg-slate-200 dark:bg-navy-700 rounded w-1/2 mb-2" />
              <div className="h-3 bg-slate-200 dark:bg-navy-700 rounded w-1/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl p-6 text-center">
        <p className="text-danger-400 mb-4">{error}</p>
        <button
          onClick={fetchMetrics}
          className="px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg text-sm font-medium"
        >
          {t('common.retry', 'Retry')}
        </button>
      </div>
    );
  }

  const metrics = metricsData
    ? [
        {
          label: t('partner.metrics.totalRevenue', 'Total Revenue'),
          value: formatEuro(metricsData.revenue.totalYTD || 0),
          change: `${metricsData.revenue.change > 0 ? '+' : ''}${metricsData.revenue.change}%`,
          period: 'vs last quarter',
          isPositive: metricsData.revenue.change >= 0,
        },
        {
          label: t('partner.metrics.clientRetention', 'Client Retention'),
          value: `${metricsData.clients.retention || 0}%`,
          change: `+${metricsData.clients.newThisQuarter || 0} new`,
          period: 'this quarter',
          isPositive: true,
        },
        {
          label: t('partner.metrics.avgProjectDuration', 'Avg Project Duration'),
          value: `${metricsData.clients.avgProjectDuration || 0} months`,
          change: metricsData.clients.avgProjectDuration < 5 ? 'Good' : 'Slow',
          period: 'average',
          isPositive: metricsData.clients.avgProjectDuration < 5,
        },
        {
          label: t('partner.metrics.customerSatisfaction', 'Customer Satisfaction'),
          value: `${metricsData.satisfaction.score || 0}/5`,
          change: `${metricsData.satisfaction.responses || 0} responses`,
          period: metricsData.satisfaction.trend || 'stable',
          isPositive: metricsData.satisfaction.score >= 4,
        },
      ]
    : [];

  // Honest empty-state for a freshly-connected partner with no activity yet.
  const isFreshMetrics =
    !!metricsData &&
    (metricsData.revenue?.totalYTD || 0) === 0 &&
    (metricsData.clients?.newThisQuarter || 0) === 0 &&
    (metricsData.satisfaction?.responses || 0) === 0;

  const performanceBreakdown: MetricsData['performance']['breakdown'] = metricsData?.performance
    ?.breakdown || {
    clientAcquisition: 0,
    projectDelivery: 0,
    customerSatisfaction: 0,
    certificationProgress: 0,
  };

  return (
    <div className="space-y-6">
      {v8RuntimeSummary && <PartnerRuntimeSummaryStrip summary={v8RuntimeSummary} />}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-c-text">
            {t('partner.metrics.title', 'Partnership Metrics')}
          </h2>
          <p className="text-c-text-secondary">
            {t('partner.metrics.subtitle', 'Key performance indicators for your partnership')}
          </p>
        </div>
        <button
          onClick={fetchMetrics}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-c-text-secondary hover:text-navy-900 dark:hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          {t('common.refresh', 'Refresh')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <div key={index} className="bg-c-surface rounded-xl border border-c-border-subtle p-4">
            <p className="text-sm text-c-text-secondary mb-2">{metric.label}</p>
            <p className="text-2xl font-bold text-c-text">{metric.value}</p>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={cn(
                  'text-sm',
                  metric.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-400'
                )}
              >
                {metric.change}
              </span>
              <span className="text-xs text-c-text-muted">{metric.period}</span>
            </div>
          </div>
        ))}
      </div>

      {isFreshMetrics && (
        <div className="rounded-xl border border-primary-200 bg-primary-50 p-4 text-sm text-primary-800 dark:border-primary-700/50 dark:bg-primary-900/20 dark:text-primary-200">
          {t(
            'partner.metrics.freshHint',
            'Twoje dane pojawią się tutaj po pierwszych poleceniach i transakcjach prowizyjnych.'
          )}
        </div>
      )}

      {/* Performance Score and Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Score */}
        <div className="bg-c-surface rounded-xl border border-c-border-subtle p-6">
          <h3 className="text-lg font-semibold text-c-text mb-4">
            {t('partner.metrics.performanceScore', 'Partner Performance Score')}
          </h3>
          <div className="flex items-center justify-center">
            <div className="relative w-40 h-40">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  className="fill-none stroke-slate-200 dark:stroke-navy-700"
                  strokeWidth="12"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  className="fill-none stroke-primary-500"
                  strokeWidth="12"
                  strokeDasharray={`${(metricsData?.performance?.score || 0) * 4.4} 440`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-c-text">
                  {metricsData?.performance?.score || 0}
                </span>
                <span className="text-sm text-c-text-secondary">/ 100</span>
              </div>
            </div>
          </div>
          <p className="text-center text-sm text-c-text-secondary mt-4">
            {metricsData?.performance?.ranking || 'Calculating...'}
          </p>
        </div>

        {/* Performance Breakdown */}
        <div className="bg-c-surface rounded-xl border border-c-border-subtle p-6">
          <h3 className="text-lg font-semibold text-c-text mb-4">
            {t('partner.metrics.scoreBreakdown', 'Score Breakdown')}
          </h3>
          <div className="space-y-4">
            {[
              {
                label: 'Client Acquisition',
                score: performanceBreakdown.clientAcquisition || 0,
                color: 'bg-sky-500',
              },
              {
                label: 'Project Delivery',
                score: performanceBreakdown.projectDelivery || 0,
                color: 'bg-emerald-500',
              },
              {
                label: 'Customer Satisfaction',
                score: performanceBreakdown.customerSatisfaction || 0,
                color: 'bg-blue-500',
              },
              {
                label: 'Certification Progress',
                score: performanceBreakdown.certificationProgress || 0,
                color: 'bg-amber-500',
              },
            ].map((item, index) => (
              <div key={index}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-c-text-secondary">{item.label}</span>
                  <span className="font-medium text-c-text">{item.score}%</span>
                </div>
                <div className="w-full h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', item.color)}
                    style={{ width: `${item.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Revenue Chart Placeholder */}
      <div className="bg-c-surface rounded-xl border border-c-border-subtle p-6">
        <h3 className="text-lg font-semibold text-c-text mb-4">
          {t('partner.metrics.revenueOverTime', 'Revenue Over Time')}
        </h3>
        {metricsData?.revenue?.byMonth && metricsData.revenue.byMonth.length > 0 ? (
          <div className="flex items-end gap-2 h-40">
            {metricsData.revenue.byMonth.map((value, index) => {
              const maxValue = Math.max(...metricsData.revenue.byMonth);
              const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
              return (
                <div
                  key={index}
                  className="flex-1 bg-primary-500 rounded-t transition-all duration-300 hover:bg-primary-600"
                  style={{ height: `${height}%` }}
                  title={`€${value.toLocaleString()}`}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-40">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 text-c-text-secondary mx-auto mb-4" />
              <p className="text-c-text-secondary">
                {t('partner.metrics.noRevenueData', 'No revenue data available yet')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// CLIENTS SECTION - Connected to API
// ============================================================================

interface ClientOrganization {
  id: string;
  name: string;
  industry: string;
  users: number;
  projects: number;
  assessmentScore: number;
  status: string;
  onboardedAt?: string;
  contractValue?: number;
}

interface ClientProject {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  framework: string;
  progress: number;
  status: string;
  startDate?: string;
  targetEndDate?: string;
}

/**
 * Localized stand-in for a client whose name could not be resolved. Never a
 * fabricated name ("Organization") and never a raw UUID — the identifier stays
 * available as technical detail only.
 */
export function resolveClientDisplayName(
  raw: unknown,
  t: (key: string, fallback: string) => string
): { label: string; resolved: boolean } {
  const name = String(raw ?? '').trim();
  const isPlaceholder = !name || name.toLowerCase() === 'organization';
  const isRawUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name);
  if (isPlaceholder || isRawUuid) {
    return { label: t('partner.clients.unavailable', 'Klient niedostępny'), resolved: false };
  }
  return { label: name, resolved: true };
}

function normalizeClientOrganization(
  client: Partial<V8PartnerClient> | Record<string, any>
): ClientOrganization {
  const rawName = client.name || client.organizationName || client.clientName;
  const resolved =
    (client as any).nameResolution === 'UNRESOLVED'
      ? null
      : String(rawName ?? '').trim() || null;
  return {
    id: String(client.id || client.organizationId || 'client'),
    // Empty string marks "unresolved"; the table cell renders the localized
    // stand-in. Keeping it out of the data layer avoids baking a UI string in.
    name: resolved && resolved.toLowerCase() !== 'organization' ? resolved : '',
    industry:
      typeof client.industry === 'string' && client.industry.trim().length > 0
        ? client.industry
        : 'Unspecified',
    users:
      typeof client.users === 'number'
        ? client.users
        : typeof client.userCount === 'number'
          ? client.userCount
          : 0,
    projects: typeof client.projects === 'number' ? client.projects : 0,
    assessmentScore: typeof client.assessmentScore === 'number' ? client.assessmentScore : 0,
    status: typeof client.status === 'string' ? client.status : 'inactive',
    onboardedAt: typeof client.onboardedAt === 'string' ? client.onboardedAt : undefined,
    contractValue: typeof client.contractValue === 'number' ? client.contractValue : undefined,
  };
}

function normalizeClientProject(
  projectInput: Partial<V8PartnerProject> | Record<string, any>
): ClientProject {
  const project = projectInput as Record<string, any>;
  return {
    id: String(project.id || 'project'),
    name: String(project.name || 'Project'),
    clientId: String(project.clientId || project.organizationId || ''),
    clientName: String(project.clientName || project.organizationName || 'Organization'),
    framework: String(project.framework || 'PMBOK').toUpperCase(),
    progress: typeof project.progress === 'number' ? project.progress : 0,
    status: typeof project.status === 'string' ? project.status : 'active',
    startDate: typeof project.startDate === 'string' ? project.startDate : undefined,
    targetEndDate: typeof project.targetEndDate === 'string' ? project.targetEndDate : undefined,
  };
}

const ClientsSection: React.FC<{ subsection: 'organizations' | 'projects' | 'users' }> = ({
  subsection,
}) => {
  const { t } = useTranslation();
  const [organizations, setOrganizations] = useState<ClientOrganization[]>([]);
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Canon §5 — per-column filters (status). Source data unchanged.
  const [orgFilters, setOrgFilters] = useState<FilterChip[]>([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (subsection === 'organizations' || subsection === 'users') {
        try {
          const response = await V8PartnerApi.getClients();
          setOrganizations((response?.clients || []).map(normalizeClientOrganization));
        } catch (error) {
          if (!shouldFallbackToLegacyPartner(error)) {
            throw error;
          }
          const response = await Api.get('/api/partners/clients');
          const payload = response?.data;
          if (response?.success && Array.isArray(payload?.data)) {
            setOrganizations(payload.data.map(normalizeClientOrganization));
          }
        }
      }

      if (subsection === 'projects') {
        try {
          const response = await V8PartnerApi.getProjects();
          setProjects((response?.projects || []).map(normalizeClientProject));
        } catch (error) {
          if (!shouldFallbackToLegacyPartner(error)) {
            throw error;
          }
          const response = await Api.get('/api/partners/projects');
          const payload = response?.data;
          if (response?.success && Array.isArray(payload?.data)) {
            setProjects(payload.data.map(normalizeClientProject));
          }
        }
      }
    } catch (err: any) {
      console.error('Error fetching clients data:', err);
      setError(err?.message || 'Failed to load data');
      toast.error('Failed to load client data');
    } finally {
      setLoading(false);
    }
  }, [subsection]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Loading skeleton for table
  const TableSkeleton = () => (
    <div className="animate-pulse">
      <div className="bg-c-surface rounded-xl border border-c-border-subtle overflow-hidden">
        <div className="bg-c-surface-raised/50 h-12" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4 p-4 border-t border-c-border-subtle">
            <div className="w-10 h-10 bg-slate-200 dark:bg-navy-700 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 dark:bg-navy-700 rounded w-1/3" />
              <div className="h-3 bg-slate-200 dark:bg-navy-700 rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Error component
  const ErrorDisplay = () => (
    <div className="bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl p-6 text-center">
      <p className="text-danger-400 mb-4">{error}</p>
      <button
        onClick={fetchData}
        className="px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg text-sm font-medium"
      >
        {t('common.retry', 'Retry')}
      </button>
    </div>
  );

  if (subsection === 'organizations') {
    if (loading) return <TableSkeleton />;
    if (error) return <ErrorDisplay />;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-c-text">
              {t('partner.clients.organizations', 'Client Organizations')}
            </h2>
            <p className="text-c-text-secondary">
              {t(
                'partner.clients.organizationsDesc',
                'Manage organizations under your partnership'
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-c-text-secondary hover:text-navy-900 dark:hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {/* DP-5 (M26 L-10): client-creation is a FEATURE_NOT_AVAILABLE stub (server
                returns 503). Surface it honestly as a disabled "coming soon" affordance
                rather than a dead button. Self-connect/client-mgmt lands in v1.1. */}
            <button
              disabled
              title={t('partner.clientAccess.featureSoon', 'Wkrótce dostępne')}
              className="inline-flex h-9 cursor-not-allowed items-center gap-2 rounded-lg bg-slate-200 px-4 text-sm font-medium text-c-text-muted dark:bg-navy-800 dark:text-c-text-muted"
            >
              {t('partner.clients.addOrganization', 'Add Organization')}
              <span className="rounded bg-slate-300/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-c-text-secondary dark:bg-navy-700 dark:text-slate-300">
                {t('partner.common.comingSoon', 'Wkrótce')}
              </span>
            </button>
          </div>
        </div>

        <FilterableTable
          canvasClassName="p-0"
          persistKey="partner.clients.organizations"
          columns={[
            {
              id: 'name',
              label: t('partner.clients.col.organization', 'Organization'),
              render: (org) => {
                const display = resolveClientDisplayName(org.name, t);
                return (
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 shrink-0 rounded-lg bg-c-surface-subtle flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-c-text-muted" />
                    </div>
                    <span
                      className={cn(
                        'font-medium truncate',
                        display.resolved ? 'text-c-text' : 'text-c-text-muted italic'
                      )}
                      // Raw identifier stays reachable as technical detail, never as the title.
                      title={display.resolved ? display.label : `ID: ${org.id}`}
                    >
                      {display.label}
                    </span>
                  </div>
                );
              },
            },
            {
              id: 'industry',
              label: t('partner.clients.col.industry', 'Industry'),
              width: '160px',
              render: (org) => (
                <span className="text-sm text-c-text-secondary">{org.industry}</span>
              ),
            },
            {
              id: 'users',
              label: t('partner.clients.col.users', 'Users'),
              width: '90px',
              align: 'right',
              render: (org) => <span className="text-sm text-c-text-secondary">{org.users}</span>,
            },
            {
              id: 'projects',
              label: t('partner.clients.col.projects', 'Projects'),
              width: '90px',
              align: 'right',
              render: (org) => (
                <span className="text-sm text-c-text-secondary">{org.projects}</span>
              ),
            },
            {
              id: 'assessmentScore',
              label: t('partner.clients.col.assessment', 'Assessment'),
              width: '110px',
              align: 'right',
              render: (org) => (
                <span className="text-sm text-c-text-secondary">{org.assessmentScore}/5</span>
              ),
            },
            {
              id: 'status',
              label: t('partner.clients.col.status', 'Status'),
              width: '130px',
              filterable: true,
              filterOptions: [
                { value: 'active', label: t('partner.clients.status.active', 'Active') },
                {
                  value: 'onboarding',
                  label: t('partner.clients.status.onboarding', 'Onboarding'),
                },
                { value: 'inactive', label: t('partner.clients.status.inactive', 'Inactive') },
              ],
              render: (org) => <EntityStatusChip status={String(org.status)} />,
            },
          ]}
          data={organizations.map((org) => ({ ...org, id: org.id }))}
          activeFilters={orgFilters}
          onFilterChange={setOrgFilters}
          hideRowActions
          emptyMessage={t('partner.clients.noOrganizations', 'No client organizations yet')}
        />
      </div>
    );
  }

  if (subsection === 'projects') {
    if (loading) return <TableSkeleton />;
    if (error) return <ErrorDisplay />;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-c-text">
              {t('partner.clients.projects', 'Active Projects')}
            </h2>
            <p className="text-c-text-secondary">
              {t('partner.clients.projectsDesc', 'Transformation projects in progress')}
            </p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-c-text-secondary hover:text-navy-900 dark:hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            {t('common.refresh', 'Refresh')}
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="bg-c-surface rounded-xl border border-c-border-subtle p-8 text-center">
            <FolderKanban className="w-12 h-12 text-c-text-secondary mx-auto mb-4" />
            <p className="text-c-text-secondary">
              {t('partner.clients.noProjects', 'No active projects yet')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-c-surface rounded-xl border border-c-border-subtle p-4 hover:border-primary-700 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-c-text">{project.name}</h4>
                    <p className="text-sm text-c-text-secondary">{project.clientName}</p>
                  </div>
                  <span className="px-2 py-1 text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded">
                    {project.framework}
                  </span>
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-c-text-secondary">Progress</span>
                    <span className="font-medium text-c-text">{project.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-navy-900 rounded-full transition-all duration-500"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>
                {project.targetEndDate && (
                  <p className="text-xs text-c-text-muted mt-3">
                    Target: {new Date(project.targetEndDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Users subsection
  if (loading) return <TableSkeleton />;
  if (error) return <ErrorDisplay />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-c-text">
            {t('partner.clients.users', 'User Management')}
          </h2>
          <p className="text-c-text-secondary">
            {t('partner.clients.usersDesc', 'Manage users across client organizations')}
          </p>
        </div>
      </div>
      {organizations.length === 0 ? (
        <div className="bg-c-surface rounded-xl border border-c-border-subtle p-8 text-center">
          <Users className="w-12 h-12 text-c-text-secondary mx-auto mb-4" />
          <p className="text-c-text-secondary">
            {t('partner.clients.usersEmpty', 'Select an organization to manage users')}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {organizations.map((org) => (
            <div
              key={org.id}
              className="bg-c-surface rounded-xl border border-c-border-subtle p-4 flex items-center justify-between hover:border-primary-700 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <span className="font-medium text-c-text">{org.name}</span>
                  <p className="text-sm text-c-text-secondary">{org.users} users</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-c-text-muted" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// CERTIFICATION SECTION - Connected to API
// ============================================================================

interface Certification {
  id: string;
  name: string;
  type: string;
  track?: string;
  level?: string;
  status: string;
  progress: number;
  duration: string;
  modules: number;
  completedModules?: number;
  targetTier?: string;
  examMode?: string;
  examEligible?: boolean;
  reviewState?: string;
  needsReview?: boolean;
  validUntil?: string;
  publicArticleSlug?: string;
  lifecycleStep?: string;
  prerequisiteTypes?: string[];
  blockedReason?: string | null;
  completedAt?: string;
  certificateId?: string;
  certificateUrl?: string;
  startedAt?: string;
}

interface CertificationModule {
  id: string;
  name: string;
  description?: string | null;
  order: number;
  minutes?: number | null;
  contentType?: string | null;
  moduleKind?: string;
  articleSlug?: string | null;
  articleLabel?: string | null;
  lifecycleStep?: string | null;
  ownerRole?: string | null;
  reviewRequired?: boolean;
  status: string;
  progress: number;
  startedAt?: string | null;
  completedAt?: string | null;
}

const CertificationSection: React.FC<{
  subsection: 'learning-path' | 'exams' | 'certificates';
}> = ({ subsection }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examOpen, setExamOpen] = useState(false);
  const [examCertId, setExamCertId] = useState<string | null>(null);
  const [examAttemptId, setExamAttemptId] = useState<string | null>(null);
  const [examDeadlineAt, setExamDeadlineAt] = useState<string | null>(null);
  const [examQuestions, setExamQuestions] = useState<any[]>([]);
  const [examAnswers, setExamAnswers] = useState<Record<string, string>>({});
  const [examSubmitting, setExamSubmitting] = useState(false);
  const [examResult, setExamResult] = useState<{ passed: boolean; scorePercent: number } | null>(
    null
  );
  const [expandedCertificationId, setExpandedCertificationId] = useState<string | null>(null);
  const [certificationModules, setCertificationModules] = useState<
    Record<string, CertificationModule[]>
  >({});

  const fetchCertifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await Api.get('/api/partners/certifications');
      const payload = response?.data;
      if (response?.success && payload?.data) {
        setCertifications(payload.data);
      } else {
        throw new Error('Invalid response');
      }
    } catch (err: any) {
      console.error('Error fetching certifications:', err);
      setError(err?.message || 'Failed to load certifications');
      toast.error('Failed to load certification data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCertifications();
  }, [fetchCertifications]);

  const closeExam = () => {
    setExamOpen(false);
    setExamCertId(null);
    setExamAttemptId(null);
    setExamDeadlineAt(null);
    setExamQuestions([]);
    setExamAnswers({});
    setExamResult(null);
    setExamSubmitting(false);
  };

  const loadModules = async (certId: string) => {
    if (certificationModules[certId]) return;
    try {
      const response = await Api.get(`/api/partners/certifications/${certId}/modules`);
      const payload = response?.data;
      if (response?.success && payload?.data) {
        setCertificationModules((prev) => ({ ...prev, [certId]: payload.data }));
      }
    } catch (err) {
      console.error('Error fetching certification modules:', err);
    }
  };

  const toggleCertificationDetails = async (certId: string) => {
    if (expandedCertificationId === certId) {
      setExpandedCertificationId(null);
      return;
    }
    setExpandedCertificationId(certId);
    await loadModules(certId);
  };

  const startExam = async (certId: string) => {
    try {
      setExamResult(null);
      setExamAnswers({});
      setExamSubmitting(false);
      setExamCertId(certId);
      setExamOpen(true);

      const lang = navigator.language?.toLowerCase().includes('pl') ? 'pl' : 'en';
      const resp = await Api.post(`/api/partners/certifications/${certId}/exam/start`, {
        language: lang,
      });
      if (!resp?.success) throw new Error(resp?.error || 'Failed to start exam');

      const payload = resp?.data;
      const data = payload?.data;
      setExamAttemptId(data?.attemptId || null);
      setExamDeadlineAt(data?.deadlineAt || null);
      setExamQuestions(data?.questions || []);
    } catch (e: any) {
      console.error('Error starting exam:', e);
      toast.error(e?.message || 'Failed to start exam');
      closeExam();
    }
  };

  const submitExam = async () => {
    try {
      if (!examCertId || !examAttemptId) {
        toast.error('Exam not started');
        return;
      }
      setExamSubmitting(true);
      const resp = await Api.post(`/api/partners/certifications/${examCertId}/exam/submit`, {
        attemptId: examAttemptId,
        answers: examAnswers,
      });
      if (!resp?.success) throw new Error(resp?.error || 'Submit failed');
      const payload = resp?.data;
      const data = payload?.data;
      setExamResult({ passed: Boolean(data?.passed), scorePercent: data?.scorePercent || 0 });
      if (data?.passed) {
        toast.success('Exam passed');
        await fetchCertifications();
      } else {
        toast.error('Exam failed');
      }
    } catch (e: any) {
      console.error('Error submitting exam:', e);
      toast.error(e?.message || 'Failed to submit exam');
    } finally {
      setExamSubmitting(false);
    }
  };

  // Loading skeleton
  const LoadingSkeleton = () => (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-c-surface rounded-xl border border-c-border-subtle p-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-slate-200 dark:bg-navy-700 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="h-5 bg-slate-200 dark:bg-navy-700 rounded w-1/3" />
              <div className="h-4 bg-slate-200 dark:bg-navy-700 rounded w-1/2" />
              <div className="h-2 bg-slate-200 dark:bg-navy-700 rounded w-full mt-4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  // Error component
  const ErrorDisplay = () => (
    <div className="bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl p-6 text-center">
      <p className="text-danger-400 mb-4">{error}</p>
      <button
        onClick={fetchCertifications}
        className="px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg text-sm font-medium"
      >
        {t('common.retry', 'Retry')}
      </button>
    </div>
  );

  // Map API status to display status
  const getDisplayStatus = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in_progress':
      case 'in-progress':
        return 'In Progress';
      case 'not_started':
      case 'locked':
        return 'Locked';
      default:
        return status;
    }
  };

  const normalizeStatus = (status: string) => {
    if (status === 'in_progress') return 'in-progress';
    if (status === 'not_started') return 'locked';
    return status;
  };

  if (subsection === 'learning-path') {
    if (loading) return <LoadingSkeleton />;
    if (error) return <ErrorDisplay />;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-c-text">
              {t('partner.certification.learningPath', 'Ścieżka nauki')}
            </h2>
            <p className="text-c-text-secondary">
              {t(
                'partner.certification.learningPathDesc',
                'Complete courses to earn certifications'
              )}
            </p>
          </div>
          <button
            onClick={fetchCertifications}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-c-text-secondary hover:text-navy-900 dark:hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            {t('common.refresh', 'Refresh')}
          </button>
        </div>

        {certifications.length === 0 ? (
          <div className="bg-c-surface rounded-xl border border-c-border-subtle p-8 text-center">
            <GraduationCap className="w-12 h-12 text-c-text-secondary mx-auto mb-4" />
            <p className="text-c-text-secondary">
              {t('partner.certification.noCourses', 'Brak dostępnych kursów')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {certifications.map((course, index) => {
              const status = normalizeStatus(course.status);
              const docHref =
                (course.publicArticleSlug && PARTNER_DOC_HREF_BY_SLUG[course.publicArticleSlug]) ||
                PARTNER_CERTIFICATION_DOC_BY_TYPE[course.type];
              const modules = certificationModules[course.id] || [];
              const isExpanded = expandedCertificationId === course.id;
              return (
                <div
                  key={course.id}
                  className={cn(
                    'bg-c-surface rounded-xl border border-c-border-subtle p-5',
                    status === 'locked'
                      ? 'border-c-border-subtle opacity-60'
                      : 'border-c-border-subtle'
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold',
                        status === 'completed' &&
                          'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600',
                        status === 'in-progress' &&
                          'bg-primary-100 dark:bg-primary-900/30 text-primary-600',
                        status === 'locked' && 'bg-slate-200 dark:bg-navy-700 text-c-text-muted'
                      )}
                    >
                      {status === 'completed' ? <CheckCircle2 className="w-6 h-6" /> : index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-c-text">{course.name}</h4>
                        <span
                          className={cn(
                            'px-2 py-1 text-xs font-medium rounded-full',
                            status === 'completed' &&
                              'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600',
                            status === 'in-progress' &&
                              'bg-primary-100 dark:bg-primary-900/30 text-primary-600',
                            status === 'locked' && 'bg-slate-200 dark:bg-navy-700 text-c-text-muted'
                          )}
                        >
                          {getDisplayStatus(course.status)}
                        </span>
                      </div>
                      <p className="text-sm text-c-text-secondary mt-1">
                        {course.track} / {course.level}{' '}
                        {course.targetTier ? `• ${course.targetTier}` : ''}
                      </p>
                      <div className="flex items-center gap-4 mt-3 text-sm text-c-text-secondary">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {course.duration}
                        </span>
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-4 h-4" />
                          {course.completedModules || 0}/{course.modules} modules
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {course.examMode && (
                          <span className="px-2 py-1 rounded-full bg-c-surface-raised text-c-text-muted">
                            {course.examMode === 'review' ? 'Operator review' : 'Exam-based'}
                          </span>
                        )}
                        {course.reviewState && (
                          <span className="px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">
                            {course.reviewState}
                          </span>
                        )}
                        {course.blockedReason && (
                          <span className="px-2 py-1 rounded-full bg-danger-100 dark:bg-danger-900/20 text-danger-700 dark:text-danger-300">
                            {course.blockedReason}
                          </span>
                        )}
                      </div>
                      {status !== 'locked' && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-c-text-secondary">Progress</span>
                            <span className="font-medium text-c-text">{course.progress}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-500',
                                status === 'completed' ? 'bg-emerald-500' : 'bg-navy-900'
                              )}
                              style={{ width: `${course.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => void toggleCertificationDetails(course.id)}
                          className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-sm font-medium rounded-lg transition-colors"
                        >
                          {isExpanded ? 'Hide modules' : 'View modules'}
                        </button>
                        {docHref && (
                          <button
                            onClick={() => navigate(docHref)}
                            className="px-4 py-2 border border-c-border text-sm font-medium rounded-lg text-c-text-secondary hover:border-primary-500 hover:text-primary-600 transition-colors"
                          >
                            Open guide
                          </button>
                        )}
                      </div>
                      {isExpanded && modules.length > 0 && (
                        <div className="mt-4 space-y-3 border-t border-c-border-subtle pt-4">
                          {modules.map((module) => {
                            const moduleDocHref =
                              (module.articleSlug &&
                                PARTNER_DOC_HREF_BY_SLUG[module.articleSlug]) ||
                              docHref;
                            return (
                              <div
                                key={module.id}
                                className="rounded-lg bg-c-surface-raised/40 border border-c-border-subtle p-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="font-medium text-c-text">
                                      {module.order}. {module.name}
                                    </div>
                                    {module.description && (
                                      <p className="mt-1 text-sm text-c-text-muted">
                                        {module.description}
                                      </p>
                                    )}
                                  </div>
                                  <span className="text-xs text-c-text-secondary">
                                    {module.minutes ? `${module.minutes} min` : module.moduleKind}
                                  </span>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <span className="px-2 py-1 rounded-full bg-slate-200 dark:bg-navy-700 text-xs text-c-text-secondary">
                                    {module.status}
                                  </span>
                                  {module.reviewRequired && (
                                    <span className="px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/20 text-xs text-amber-700 dark:text-amber-300">
                                      review required
                                    </span>
                                  )}
                                  {moduleDocHref && (
                                    <button
                                      onClick={() => navigate(moduleDocHref)}
                                      className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      {module.articleLabel || 'Open article'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {status === 'locked' && (
                        <p className="mt-3 text-xs text-c-text-muted">
                          Complete previous courses to unlock
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (subsection === 'exams') {
    if (loading) return <LoadingSkeleton />;
    if (error) return <ErrorDisplay />;

    const examCourses = certifications.filter((c) => c.examMode === 'exam');
    const hasExamsAvailable = examCourses.length > 0;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-c-text">
            {t('partner.certification.exams', 'Egzaminy certyfikacyjne')}
          </h2>
          <p className="text-c-text-secondary">
            {t(
              'partner.certification.examsDesc',
              'Zdaj egzaminy, aby zdobyć oficjalne certyfikaty'
            )}
          </p>
        </div>
        {hasExamsAvailable ? (
          <div className="space-y-4">
            {examCourses.map((course) => (
              <div
                key={course.id}
                className="bg-c-surface rounded-xl border border-c-border-subtle p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-c-text">{course.name} Exam</h4>
                      <p className="text-sm text-c-text-secondary">
                        {course.certificateId
                          ? 'Passed'
                          : course.examEligible
                            ? 'Available to take'
                            : course.blockedReason || 'Complete academy first'}
                      </p>
                    </div>
                  </div>
                  {course.certificateId ? (
                    <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-sm font-medium rounded-full">
                      Passed
                    </span>
                  ) : !course.examEligible ? (
                    <span className="px-3 py-1 bg-slate-200 dark:bg-navy-700 text-c-text-muted text-sm font-medium rounded-full">
                      Locked
                    </span>
                  ) : (
                    <button
                      onClick={() => startExam(course.id)}
                      className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-sm font-medium rounded-lg transition-colors"
                    >
                      Take Exam
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-c-surface rounded-xl border border-c-border-subtle p-8 text-center">
            <FileText className="w-12 h-12 text-c-text-secondary mx-auto mb-4" />
            <p className="text-c-text-secondary">
              {t(
                'partner.certification.examsEmpty',
                'Ukończ ścieżkę nauki, aby odblokować egzaminy'
              )}
            </p>
          </div>
        )}

        {examOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-3xl bg-c-surface rounded-xl border border-c-border-subtle p-4 md:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-c-text">
                    {(() => {
                      const certName = certifications.find((c) => c.id === examCertId)?.name;
                      return certName
                        ? `${certName} — ${t('partner.certification.examTitle', 'Egzamin certyfikacyjny')}`
                        : t('partner.certification.examTitle', 'Egzamin certyfikacyjny');
                    })()}
                  </h3>
                  <p className="text-sm text-c-text-muted">
                    {examDeadlineAt
                      ? `${t('partner.certification.deadline', 'Termin')}: ${new Date(examDeadlineAt).toLocaleTimeString()}`
                      : t('common.loading', 'Ładowanie…')}
                  </p>
                </div>
                <button
                  onClick={closeExam}
                  className="px-3 py-2 rounded-lg text-sm text-c-text-muted hover:text-c-text dark:hover:text-white"
                >
                  {t('common.close', 'Close')}
                </button>
              </div>

              {examQuestions.length === 0 ? (
                <div className="mt-4 text-sm text-c-text-muted">Loading...</div>
              ) : (
                <div className="mt-4 space-y-4 max-h-[60vh] overflow-auto pr-1">
                  {examQuestions.map((q: any, idx: number) => (
                    <div key={q.id} className="rounded-lg border border-c-border-subtle p-3">
                      <div className="font-medium text-c-text">
                        {idx + 1}. {q.text}
                      </div>
                      <div className="mt-2 space-y-2">
                        {(q.options || []).map((opt: any) => (
                          <label
                            key={opt.id}
                            className="flex items-start gap-2 text-sm text-c-text-secondary cursor-pointer"
                          >
                            <input
                              type="radio"
                              name={`q-${q.id}`}
                              value={opt.id}
                              checked={examAnswers[q.id] === opt.id}
                              onChange={() =>
                                setExamAnswers((prev) => ({ ...prev, [q.id]: String(opt.id) }))
                              }
                              className="mt-1"
                            />
                            <span>{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {examResult && (
                <div
                  className={cn(
                    'mt-4 rounded-lg p-3 text-sm',
                    examResult.passed
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                      : 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300'
                  )}
                >
                  {examResult.passed ? 'Passed' : 'Failed'} • Score: {examResult.scorePercent}%
                </div>
              )}

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={submitExam}
                  disabled={examSubmitting || examQuestions.length === 0}
                  className="px-4 py-2 rounded-lg bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-sm font-medium disabled:opacity-60"
                >
                  {examSubmitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Certificates
  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorDisplay />;

  const completedWithCerts = certifications.filter(
    (c) => normalizeStatus(c.status) === 'completed' && c.certificateId
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-c-text">
            {t('partner.certification.certificates', 'Twoje certyfikaty')}
          </h2>
          <p className="text-c-text-secondary">
            {t(
              'partner.certification.certificatesDesc',
              'Pobieraj i udostępniaj swoje certyfikaty'
            )}
          </p>
        </div>
        <button
          onClick={fetchCertifications}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-c-text-secondary hover:text-navy-900 dark:hover:text-white transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      {completedWithCerts.length === 0 ? (
        <div className="bg-c-surface rounded-xl border border-c-border-subtle p-8 text-center">
          <Award className="w-12 h-12 text-c-text-secondary mx-auto mb-4" />
          <p className="text-c-text-secondary">
            {t(
              'partner.certification.noCertificates',
              'Complete courses and pass exams to earn certificates'
            )}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {completedWithCerts.map((cert) => (
            <div
              key={cert.id}
              className="bg-c-surface rounded-xl border border-c-border-subtle p-4 hover:border-primary-700 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-crimson-600 dark:bg-crimson-700 flex items-center justify-center">
                  <Award className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-c-text">{cert.name}</h4>
                  <p className="text-sm text-c-text-secondary">
                    Issued:{' '}
                    {cert.completedAt ? new Date(cert.completedAt).toLocaleDateString() : 'N/A'}
                  </p>
                  {cert.validUntil && (
                    <p className="text-xs text-c-text-muted mt-1">
                      Valid until: {new Date(cert.validUntil).toLocaleDateString()}
                    </p>
                  )}
                  <p className="text-xs text-c-text-muted mt-1">ID: {cert.certificateId}</p>
                </div>
                <button
                  onClick={() => {
                    const url =
                      cert.certificateUrl ||
                      (cert.certificateId
                        ? `/api/partners/certificates/${cert.certificateId}/download`
                        : null);
                    if (!url) {
                      toast.error('Certificate not available');
                      return;
                    }
                    window.open(url, '_blank');
                  }}
                  className="p-2 text-c-text-muted hover:text-primary-600 dark:hover:text-primary-400"
                >
                  <Download className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// RESOURCES SECTION - Connected to API
// ============================================================================

interface Resource {
  id: string;
  title: string;
  type: string;
  size: string;
  category?: string;
}

interface ResourcesData {
  documentation: Resource[];
  marketing: Resource[];
  caseStudies: Resource[];
  templates: Resource[];
  docsBridge?: Array<{
    id: string;
    title: string;
    href: string;
    kind: string;
  }>;
  academyHighlights?: Array<{
    id: string;
    type: string;
    track: string;
    level: string;
    status: string;
    progress: number;
    reviewState?: string | null;
    articleSlug?: string | null;
  }>;
  /**
   * Read capability reported by the backend. Lets the UI tell an honestly empty
   * catalogue from one it could not read — the two used to look identical.
   */
  capability?: 'FULL' | 'DEGRADED_SCHEMA' | 'DEGRADED_UNAVAILABLE';
  capabilityCode?: string | null;
  resourcesReadable?: boolean;
}

const ResourcesSection: React.FC<{
  subsection: 'documentation' | 'marketing' | 'case-studies' | 'templates';
}> = ({ subsection }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [resources, setResources] = useState<ResourcesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchResources = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await Api.get('/api/partners/resources');
      const payload = response?.data;
      if (response?.success && payload?.data) {
        setResources(payload.data);
      } else {
        throw new Error('Invalid response');
      }
    } catch (err: any) {
      console.error('Error fetching resources:', err);
      setError(err?.message || 'Failed to load resources');
      toast.error('Failed to load resources');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const handleDownload = async (resourceId: string, _title: string) => {
    try {
      setDownloading(resourceId);
      // Backend streams the file directly (no JSON wrapper). Opening a new tab is
      // fire-and-forget — we cannot observe the HTTP status, so do NOT show a
      // success toast (it would lie on a 404). Errors here are only synchronous.
      window.open(`/api/partners/resources/${resourceId}/download`, '_blank');
    } catch (err: any) {
      console.error('Error downloading resource:', err);
      toast.error(t('partner.resources.downloadError', 'Nie udało się pobrać zasobu.'));
    } finally {
      setDownloading(null);
    }
  };

  const titles: Record<string, string> = {
    documentation: 'Documentation',
    marketing: 'Marketing Materials',
    'case-studies': 'Case Studies',
    templates: 'PMO Templates',
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 dark:bg-navy-700 rounded w-1/4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-c-surface rounded-xl border border-c-border-subtle p-4 flex items-center gap-4"
            >
              <div className="w-12 h-12 bg-slate-200 dark:bg-navy-700 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-5 bg-slate-200 dark:bg-navy-700 rounded w-2/3" />
                <div className="h-4 bg-slate-200 dark:bg-navy-700 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl p-6 text-center">
        <p className="text-danger-400 mb-4">{error}</p>
        <button
          onClick={fetchResources}
          className="px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg text-sm font-medium"
        >
          {t('common.retry', 'Retry')}
        </button>
      </div>
    );
  }

  // Map subsection to data key (always one of the Resource[] collections)
  const dataKey: 'documentation' | 'marketing' | 'caseStudies' | 'templates' =
    subsection === 'case-studies' ? 'caseStudies' : subsection;
  const items: Resource[] = resources?.[dataKey] || [];
  const docsBridge = subsection === 'documentation' ? resources?.docsBridge || [] : [];
  const academyHighlights =
    subsection === 'documentation' ? resources?.academyHighlights || [] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-c-text">{titles[subsection]}</h2>
          <p className="text-c-text-secondary">
            {t('partner.resources.desc', 'Pobierz materiały dla swojego partnerstwa')}
          </p>
        </div>
        <button
          onClick={fetchResources}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-c-text-secondary hover:text-navy-900 dark:hover:text-white transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {subsection === 'documentation' &&
        (docsBridge.length > 0 || academyHighlights.length > 0) && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-c-surface rounded-xl border border-c-border-subtle p-4">
              <h3 className="text-base font-semibold text-c-text">Canonical partner docs</h3>
              <div className="mt-3 space-y-3">
                {docsBridge.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => navigate(doc.href)}
                    className="w-full flex items-center justify-between rounded-lg border border-c-border-subtle px-3 py-3 text-left hover:border-primary-500 transition-colors"
                  >
                    <span className="text-sm font-medium text-c-text">{doc.title}</span>
                    <ExternalLink className="w-4 h-4 text-c-text-secondary" />
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-c-surface rounded-xl border border-c-border-subtle p-4">
              <h3 className="text-base font-semibold text-c-text">Academy status bridge</h3>
              <div className="mt-3 space-y-3">
                {academyHighlights.slice(0, 4).map((item) => {
                  const href =
                    (item.articleSlug && PARTNER_DOC_HREF_BY_SLUG[item.articleSlug]) ||
                    PARTNER_CERTIFICATION_DOC_BY_TYPE[item.type];
                  return (
                    <div
                      key={item.id}
                      className="rounded-lg border border-c-border-subtle px-3 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-c-text">
                          {item.track} / {item.level}
                        </div>
                        <div className="text-xs text-c-text-secondary">{item.progress}%</div>
                      </div>
                      <div className="mt-1 text-xs text-c-text-muted">
                        {item.status}
                        {item.reviewState ? ` • ${item.reviewState}` : ''}
                      </div>
                      {href && (
                        <button
                          onClick={() => navigate(href)}
                          className="mt-3 inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Open supporting guide
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      {items.length === 0 && resources?.capability === 'DEGRADED_UNAVAILABLE' ? (
        // DEGRADED_UNAVAILABLE ≠ EMPTY. The catalogue could not be read, so we
        // must not claim there is nothing here. Amber (warning), not crimson —
        // this is a degraded read, not an error or a destructive state.
        <div
          className="bg-c-surface rounded-xl border border-amber-300 dark:border-amber-700/60 p-8 text-center"
          data-testid="partner-resources-degraded"
        >
          <AlertTriangle className="w-12 h-12 text-amber-600 dark:text-amber-400 mx-auto mb-4" />
          <p className="text-c-text font-medium">
            {t(
              'partner.resources.degradedTitle',
              'Biblioteka materiałów jest chwilowo niedostępna'
            )}
          </p>
          <p className="text-c-text-secondary text-sm mt-1">
            {t(
              'partner.resources.degradedDescription',
              'Nie udało się odczytać katalogu, więc nie wiemy, ile materiałów tu jest. To nie znaczy, że jest pusty.'
            )}
          </p>
          {resources?.capabilityCode && (
            <p className="text-c-text-muted text-xs mt-3 font-mono">{resources.capabilityCode}</p>
          )}
          <button
            type="button"
            onClick={fetchResources}
            className="mt-4 px-4 py-2 rounded-lg border border-c-border text-c-text text-sm hover:bg-c-surface-hover"
          >
            {t('partner.resources.retry', 'Spróbuj ponownie')}
          </button>
        </div>
      ) : items.length === 0 ? (
        <div
          className="bg-c-surface rounded-xl border border-c-border-subtle p-8 text-center"
          data-testid="partner-resources-empty"
        >
          <FileText className="w-12 h-12 text-c-text-secondary mx-auto mb-4" />
          <p className="text-c-text-secondary">
            {t('partner.resources.empty', 'Brak materiałów w tej kategorii')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => handleDownload(item.id, item.title)}
              className="bg-c-surface rounded-xl border border-c-border-subtle p-4 flex items-center gap-4 hover:border-primary-700 transition-colors cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-navy-700 flex items-center justify-center">
                <FileText className="w-6 h-6 text-c-text-muted" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-c-text group-hover:text-primary-600 dark:group-hover:text-primary-400">
                  {item.title}
                </h4>
                <p className="text-sm text-c-text-secondary">
                  {item.type} • {item.size}
                </p>
              </div>
              {downloading === item.id ? (
                <RefreshCw className="w-5 h-5 text-primary-600 animate-spin" />
              ) : (
                <Download className="w-5 h-5 text-c-text-muted group-hover:text-primary-600 dark:group-hover:text-primary-400" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// PROFILE SECTION - Connected to API
// ============================================================================

interface PartnerOrganization {
  id: string;
  name: string;
  legalName?: string;
  taxId?: string;
  contactEmail: string;
  contactPhone?: string;
  website?: string;
  tier: string;
  status: string;
  partnerSince?: string;
  licenseDiscountPercent?: number;
  commissionRatePercent?: number;
  performanceScore?: number;
  publicListingEnabled?: boolean;
  specializations?: string[];
  regions?: string[];
}

// Fallback catalogs used when GET /api/partners/catalog is unavailable/empty.
const FALLBACK_FRAMEWORKS = [
  'DRD',
  'SIRI',
  'ADMA',
  'CMMI',
  'Lean 4.0',
  'ISO 21500',
  'PMBOK',
  'PRINCE2',
];
const FALLBACK_REGIONS = [
  'DACH',
  'Nordics',
  'Benelux',
  'UK & Ireland',
  'France',
  'Southern Europe',
  'CEE',
  'Baltics',
];

const ProfileSection: React.FC<{
  subsection: 'company-info' | 'specializations' | 'regions' | 'public-listing';
}> = ({ subsection }) => {
  const { t } = useTranslation();
  const [organization, setOrganization] = useState<PartnerOrganization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    taxId: '',
    contactEmail: '',
    contactPhone: '',
    website: '',
  });
  const [selectedSpecializations, setSelectedSpecializations] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [publicListingEnabled, setPublicListingEnabled] = useState(false);
  const [allFrameworks, setAllFrameworks] = useState<string[]>(FALLBACK_FRAMEWORKS);
  const [allRegions, setAllRegions] = useState<string[]>(FALLBACK_REGIONS);

  // Dynamic catalogs; gracefully fall back to hardcoded lists on error/empty.
  const fetchCatalog = useCallback(async () => {
    try {
      const response = await Api.get('/api/partners/catalog');
      const data = response?.data?.data ?? response?.data;
      const frameworks = data?.frameworks;
      const regions = data?.regions;
      if (Array.isArray(frameworks) && frameworks.length > 0) {
        setAllFrameworks(frameworks);
      }
      if (Array.isArray(regions) && regions.length > 0) {
        setAllRegions(regions);
      }
    } catch {
      // Keep fallback catalogs; never block the Profile UI.
    }
  }, []);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const fetchOrganization = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await Api.get('/api/partners/organization');
      const payload = response?.data;
      if (response?.success && payload?.data) {
        const org = payload.data;
        setOrganization(org);
        setFormData({
          name: org.name || '',
          taxId: org.taxId || '',
          contactEmail: org.contactEmail || '',
          contactPhone: org.contactPhone || '',
          website: org.website || '',
        });
        setSelectedSpecializations(org.specializations || []);
        setSelectedRegions(org.regions || []);
        setPublicListingEnabled(org.publicListingEnabled || false);
      } else {
        throw new Error('Invalid response');
      }
    } catch (err: any) {
      console.error('Error fetching organization:', err);
      setError(err?.message || 'Failed to load organization');
      toast.error('Failed to load organization data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrganization();
  }, [fetchOrganization]);

  const handleSaveCompanyInfo = async () => {
    try {
      setSaving(true);
      let response: any;
      try {
        response = await V8PartnerApi.updateOrganization(formData);
      } catch (error) {
        if (!shouldFallbackToLegacyPartner(error)) {
          throw error;
        }
        response = await Api.put('/api/partners/organization', formData);
      }
      if (response?.success) {
        toast.success('Company information updated');
        fetchOrganization();
      } else {
        throw new Error('Failed to save');
      }
    } catch (err: any) {
      console.error('Error saving organization:', err);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSpecializations = async () => {
    try {
      setSaving(true);
      let response: any;
      try {
        response = await V8PartnerApi.updateOrganizationSpecializations({
          specializations: selectedSpecializations,
        });
      } catch (error) {
        if (!shouldFallbackToLegacyPartner(error)) {
          throw error;
        }
        response = await Api.put('/api/partners/organization/specializations', {
          specializations: selectedSpecializations,
        });
      }
      if (response?.success) {
        toast.success('Specializations updated');
      } else {
        throw new Error('Failed to save');
      }
    } catch (err: any) {
      console.error('Error saving specializations:', err);
      toast.error('Failed to save specializations');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRegions = async () => {
    try {
      setSaving(true);
      let response: any;
      try {
        response = await V8PartnerApi.updateOrganizationRegions({
          regions: selectedRegions,
        });
      } catch (error) {
        if (!shouldFallbackToLegacyPartner(error)) {
          throw error;
        }
        response = await Api.put('/api/partners/organization/regions', {
          regions: selectedRegions,
        });
      }
      if (response?.success) {
        toast.success('Regions updated');
      } else {
        throw new Error('Failed to save');
      }
    } catch (err: any) {
      console.error('Error saving regions:', err);
      toast.error('Failed to save regions');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleListing = async () => {
    try {
      setSaving(true);
      const newValue = !publicListingEnabled;
      let response: any;
      try {
        response = await V8PartnerApi.updateOrganizationListing({
          publicListingEnabled: newValue,
        });
      } catch (error) {
        if (!shouldFallbackToLegacyPartner(error)) {
          throw error;
        }
        response = await Api.put('/api/partners/organization/listing', {
          publicListingEnabled: newValue,
        });
      }
      if (response?.success || typeof response?.publicListingEnabled === 'boolean') {
        setPublicListingEnabled(newValue);
        toast.success(newValue ? 'Public listing enabled' : 'Public listing disabled');
      } else {
        throw new Error('Failed to save');
      }
    } catch (err: any) {
      console.error('Error toggling listing:', err);
      toast.error('Failed to update listing settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleSpecialization = (fw: string) => {
    setSelectedSpecializations((prev) =>
      prev.includes(fw) ? prev.filter((s) => s !== fw) : [...prev, fw]
    );
  };

  const toggleRegion = (region: string) => {
    setSelectedRegions((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region]
    );
  };

  // Loading skeleton
  const LoadingSkeleton = () => (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-slate-200 dark:bg-navy-700 rounded w-1/4" />
      <div className="bg-c-surface rounded-xl border border-c-border-subtle p-6">
        <div className="grid grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="h-4 bg-slate-200 dark:bg-navy-700 rounded w-1/3 mb-2" />
              <div className="h-10 bg-slate-200 dark:bg-navy-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Error component
  const ErrorDisplay = () => (
    <div className="bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl p-6 text-center">
      <p className="text-danger-400 mb-4">{error}</p>
      <button
        onClick={fetchOrganization}
        className="px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg text-sm font-medium"
      >
        {t('common.retry', 'Retry')}
      </button>
    </div>
  );

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorDisplay />;

  if (subsection === 'company-info') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-c-text">
              {t('partner.profile.companyInfo', 'Informacje o firmie')}
            </h2>
            <p className="text-c-text-secondary">
              {t('partner.profile.companyInfoDesc', 'Zarządzaj danymi swojej firmy')}
            </p>
          </div>
          <button
            onClick={fetchOrganization}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-c-text-secondary hover:text-navy-900 dark:hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-c-surface rounded-xl border border-c-border-subtle p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-c-text-secondary mb-2">
                Company Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-c-border-subtle bg-c-surface text-c-text focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-c-text-secondary mb-2">
                Tax ID / VAT
              </label>
              <input
                type="text"
                value={formData.taxId}
                onChange={(e) => setFormData((prev) => ({ ...prev, taxId: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-c-border-subtle bg-c-surface text-c-text focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-c-text-secondary mb-2">
                Contact Email
              </label>
              <input
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData((prev) => ({ ...prev, contactEmail: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-c-border-subtle bg-c-surface text-c-text focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-c-text-secondary mb-2">Phone</label>
              <input
                type="tel"
                value={formData.contactPhone}
                onChange={(e) => setFormData((prev) => ({ ...prev, contactPhone: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-c-border-subtle bg-c-surface text-c-text focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-c-text-secondary mb-2">
                Website
              </label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => setFormData((prev) => ({ ...prev, website: e.target.value }))}
                placeholder="https://"
                className="w-full px-4 py-2 rounded-lg border border-c-border-subtle bg-c-surface text-c-text focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSaveCompanyInfo}
              disabled={saving}
              className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (subsection === 'specializations') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-c-text">
            {t('partner.profile.specializations', 'Specjalizacje')}
          </h2>
          <p className="text-c-text-secondary">
            {t(
              'partner.profile.specializationsDesc',
              'Wybierz frameworki, w których się specjalizujesz'
            )}
          </p>
        </div>

        <div className="bg-c-surface rounded-xl border border-c-border-subtle p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
            {allFrameworks.map((fw) => (
              <button
                key={fw}
                onClick={() => toggleSpecialization(fw)}
                className={cn(
                  'p-4 rounded-xl border-2 text-center transition-all',
                  selectedSpecializations.includes(fw)
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-c-border-subtle hover:border-primary-300'
                )}
              >
                <Target
                  className={cn(
                    'w-8 h-8 mx-auto mb-2',
                    selectedSpecializations.includes(fw) ? 'text-primary-600' : 'text-c-text-muted'
                  )}
                />
                <span
                  className={cn(
                    'font-medium',
                    selectedSpecializations.includes(fw)
                      ? 'text-primary-600'
                      : 'text-c-text-secondary'
                  )}
                >
                  {fw}
                </span>
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSaveSpecializations}
              disabled={saving}
              className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
              Save Specializations
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (subsection === 'regions') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-c-text">
            {t('partner.profile.regions', 'Regiony działalności')}
          </h2>
          <p className="text-c-text-secondary">
            {t('partner.profile.regionsDesc', 'Wybierz regiony, w których działasz')}
          </p>
        </div>

        <div className="bg-c-surface rounded-xl border border-c-border-subtle p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {allRegions.map((region) => (
              <label
                key={region}
                className="flex items-center gap-3 p-3 rounded-lg border border-c-border-subtle cursor-pointer hover:bg-c-surface-raised/50 dark:hover:bg-navy-700/30"
              >
                <input
                  type="checkbox"
                  checked={selectedRegions.includes(region)}
                  onChange={() => toggleRegion(region)}
                  className="rounded text-primary-600 focus:ring-primary-500"
                />
                <span className="text-c-text-secondary">{region}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSaveRegions}
              disabled={saving}
              className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
              Save Regions
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Public listing
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-c-text">
          {t('partner.profile.publicListing', 'Publiczna wizytówka')}
        </h2>
        <p className="text-c-text-secondary">
          {t(
            'partner.profile.publicListingDesc',
            'Zarządzaj swoją widocznością w katalogu partnerów'
          )}
        </p>
      </div>

      <div className="bg-c-surface rounded-xl border border-c-border-subtle p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h4 className="font-medium text-c-text">Directory Visibility</h4>
            <p className="text-sm text-c-text-secondary">
              Show your profile in the public partner directory
            </p>
          </div>
          <button
            onClick={handleToggleListing}
            disabled={saving}
            aria-label="Toggle public listing"
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              publicListingEnabled ? 'bg-navy-900' : 'bg-slate-300 dark:bg-navy-600'
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-c-surface-raised transition',
                publicListingEnabled ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>

        <div className="border-t border-c-border-subtle pt-6">
          <h4 className="font-medium text-c-text mb-4">Preview</h4>
          <div className="bg-c-surface-raised/50 dark:bg-navy-700/30 rounded-xl p-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <Building2 className="w-8 h-8 text-primary-600" />
              </div>
              <div>
                <h5 className="font-semibold text-c-text">
                  {organization?.name || 'Your Company'}
                </h5>
                <p className="text-sm text-c-text-secondary">
                  {organization?.tier || 'Partner'} •{' '}
                  {selectedRegions.join(', ') || 'No regions selected'}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {selectedSpecializations.length > 0 ? (
                    selectedSpecializations.map((spec) => (
                      <span
                        key={spec}
                        className="px-2 py-0.5 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded"
                      >
                        {spec}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-c-text-muted">No specializations selected</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN VIEW
// ============================================================================

interface PartnerPortalViewNewProps {
  currentUser?: any;
  onNavigate?: (view: string) => void;
}

export const PartnerPortalViewNew: React.FC<PartnerPortalViewNewProps> = ({
  currentUser,
  onNavigate,
}) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const [connectionLoading, setConnectionLoading] = useState(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectName, setConnectName] = useState<string>('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  // Default to FALSE: self-provisioning of a partner org is gated server-side.
  // Only enable when the backend explicitly returns selfConnectEnabled === true.
  const [selfConnectEnabled, setSelfConnectEnabled] = useState<boolean>(false);

  const fetchConnection = useCallback(async () => {
    try {
      setConnectionLoading(true);
      setConnectError(null);
      const response = await Api.get('/api/partners/connection');
      const payload = response?.data;
      const data = payload?.data;
      if (response?.success && data && typeof data.connected === 'boolean') {
        setIsConnected(Boolean(data.connected));
        // Gate self-provisioning: only when backend explicitly allows it.
        setSelfConnectEnabled(data.selfConnectEnabled === true);
        if (!connectName) {
          const seeded =
            String(data.organization?.name || '').trim() ||
            String(currentUser?.organizationName || '').trim() ||
            String(currentUser?.name || '').trim();
          if (seeded) setConnectName(seeded);
        }
        return;
      }
      setIsConnected(false);
      setSelfConnectEnabled(false);
      setConnectError(
        t(
          'partner.connect.unavailable',
          'Partner Portal is not configured yet. Please run partner portal migrations in the database.'
        )
      );
    } catch (err: any) {
      setIsConnected(false);
      setSelfConnectEnabled(false);
      setConnectError(
        String(
          err?.message ||
            t(
              'partner.connect.unavailable',
              'Partner Portal is not configured yet. Please run partner portal migrations in the database.'
            )
        )
      );
    } finally {
      setConnectionLoading(false);
    }
  }, [connectName, currentUser?.name, currentUser?.organizationName]);

  useEffect(() => {
    fetchConnection();
  }, [fetchConnection]);

  const activeSection = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get('tab');

    // When partner profile is not connected, lock navigation to the onboarding screen.
    if (!isConnected) return 'partner-home';

    if (isPartnerSection(section)) return section;

    const legacySection = getLegacyPartnerSection(location.pathname);
    return legacySection ?? 'dashboard';
  }, [location.pathname, location.search, isConnected]);

  useEffect(() => {
    if (connectionLoading || !isConnected) return;

    const legacySection = getLegacyPartnerSection(location.pathname);
    if (!legacySection) return;

    const params = new URLSearchParams(location.search);
    if (params.get('tab') === legacySection && location.pathname === ROUTES.PARTNER.LANDING) return;

    params.set('tab', legacySection);
    navigate({ pathname: ROUTES.PARTNER.LANDING, search: params.toString() }, { replace: true });
  }, [connectionLoading, isConnected, location.pathname, location.search, navigate]);

  const handleSectionChange = useCallback(
    (section: PartnerSection) => {
      if (!isConnected && section !== 'partner-home') {
        toast(
          t(
            'partner.connect.requiredToNavigate',
            'Connect your partner profile first to access other sections.'
          )
        );

        const params = new URLSearchParams(location.search);
        params.set('tab', 'partner-home');
        navigate(
          { pathname: ROUTES.PARTNER.LANDING, search: params.toString() },
          { replace: true }
        );
        return;
      }

      const params = new URLSearchParams(location.search);
      params.set('tab', section);
      navigate({ pathname: ROUTES.PARTNER.LANDING, search: params.toString() });
    },
    [isConnected, location.search, navigate, t]
  );

  // Ensure URL stays consistent with locked navigation.
  useEffect(() => {
    if (connectionLoading) return;
    if (isConnected) return;
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'partner-home') return;
    params.set('tab', 'partner-home');
    navigate({ pathname: ROUTES.PARTNER.LANDING, search: params.toString() }, { replace: true });
  }, [connectionLoading, isConnected, location.search, navigate]);

  // Get breadcrumbs based on active section
  const breadcrumbs = useMemo((): Breadcrumb[] => {
    const sectionLabels: Record<PartnerSection, string> = {
      'partner-home': 'Home',
      dashboard: 'Dashboard',
      metrics: 'Metrics',
      // Referrals
      'referral-tools': 'My Links & Codes',
      'referral-analytics': 'Click Analytics',
      'referred-organizations': 'Referred Customers',
      // Earnings
      earnings: 'Commission Earnings',
      statements: 'Statements',
      payouts: 'Payout History',
      'payout-settings': 'Payout Settings',
      // Clients
      'client-access': 'Client Access Manager',
      organizations: 'Organizations',
      projects: 'Projects',
      users: 'Team Members',
      // Academy
      'learning-path': 'Learning Path',
      exams: 'Exams',
      certificates: 'Certificates',
      // Resources
      documentation: 'Documentation',
      marketing: 'Marketing Materials',
      'case-studies': 'Case Studies',
      templates: 'PMO Templates',
      // Profile
      'company-info': 'Company Info',
      specializations: 'Specializations',
      regions: 'Regions',
      'public-listing': 'Public Listing',
    };

    const parentLabels: Partial<
      Record<PartnerSection, { label: string; section: PartnerSection }>
    > = {
      // Home
      dashboard: { label: 'Home', section: 'partner-home' },
      metrics: { label: 'Home', section: 'partner-home' },
      // Referrals
      'referral-tools': { label: 'Referrals', section: 'referral-tools' },
      'referral-analytics': { label: 'Referrals', section: 'referral-tools' },
      'referred-organizations': { label: 'Referrals', section: 'referral-tools' },
      // Earnings
      earnings: { label: 'Earnings', section: 'earnings' },
      statements: { label: 'Earnings', section: 'earnings' },
      payouts: { label: 'Earnings', section: 'earnings' },
      'payout-settings': { label: 'Earnings', section: 'earnings' },
      // Clients
      'client-access': { label: 'Clients', section: 'client-access' },
      organizations: { label: 'Clients', section: 'client-access' },
      projects: { label: 'Clients', section: 'client-access' },
      users: { label: 'Clients', section: 'client-access' },
      // Academy
      'learning-path': { label: 'Academy', section: 'learning-path' },
      exams: { label: 'Academy', section: 'learning-path' },
      certificates: { label: 'Academy', section: 'learning-path' },
      // Resources
      documentation: { label: 'Resources', section: 'documentation' },
      marketing: { label: 'Resources', section: 'documentation' },
      'case-studies': { label: 'Resources', section: 'documentation' },
      templates: { label: 'Resources', section: 'documentation' },
      // Profile
      'company-info': { label: 'Profile', section: 'company-info' },
      specializations: { label: 'Profile', section: 'company-info' },
      regions: { label: 'Profile', section: 'company-info' },
      'public-listing': { label: 'Profile', section: 'company-info' },
    };

    const crumbs: Breadcrumb[] = [{ label: 'Partner', section: 'partner-home' }];

    const parent = parentLabels[activeSection];
    if (parent && parent.section !== activeSection) {
      crumbs.push({ label: parent.label, section: parent.section });
    }

    if (activeSection !== 'partner-home') {
      crumbs.push({ label: sectionLabels[activeSection] || activeSection });
    }

    return crumbs;
  }, [activeSection]);

  // Render content based on active section
  const renderContent = useCallback(() => {
    switch (activeSection) {
      // Home
      case 'partner-home':
        // Owner decision 2026-08-05: an active (earn/payout) partner must not be
        // shown the acquisition landing. The variant is chosen from the server's
        // persisted lifecycle phase; unknown/error never falls back to acquisition.
        return (
          <PartnerStartRouter
            onboardingSurface={<ProviderHomeView />}
            onNavigateSection={handleSectionChange}
          />
        );
      // Overview
      case 'dashboard':
        return <DashboardSection />;
      case 'metrics':
        return <MetricsSection />;
      // Referrals
      case 'referral-tools':
      case 'referral-analytics':
      case 'referred-organizations':
        return <ReferralToolsSection subsection={activeSection} />;
      // Earnings
      case 'earnings':
      case 'statements':
      case 'payouts':
      case 'payout-settings':
        return <EarningsSection subsection={activeSection} />;
      // Clients
      case 'client-access':
        return <ClientAccessView />;
      case 'organizations':
      case 'projects':
      case 'users':
        return <ClientsSection subsection={activeSection} />;
      // Academy
      case 'learning-path':
      case 'exams':
      case 'certificates':
        return <CertificationSection subsection={activeSection} />;
      // Resources
      case 'documentation':
      case 'marketing':
      case 'case-studies':
      case 'templates':
        return <ResourcesSection subsection={activeSection} />;
      // Profile
      case 'company-info':
      case 'specializations':
      case 'regions':
      case 'public-listing':
        return <ProfileSection subsection={activeSection} />;
      default:
        return <ProviderHomeView />;
    }
  }, [activeSection, handleSectionChange]);

  const handleConnectPartnerProfile = useCallback(async () => {
    try {
      setConnecting(true);
      setConnectError(null);

      const name = String(connectName || '').trim();
      const payload = await Api.post('/api/partners/connect', { name: name || undefined });
      const respPayload = payload?.data;
      const data = respPayload?.data;

      if (!payload?.success || !data?.connected) {
        throw new Error(respPayload?.error || 'Failed to connect partner profile');
      }

      toast.success(
        t(
          'partner.connect.success',
          'Partner profile connected. You can now complete your company profile.'
        )
      );
      setIsConnected(true);
      await fetchConnection();

      const params = new URLSearchParams(location.search);
      params.set('tab', 'company-info');
      navigate({ pathname: ROUTES.PARTNER.LANDING, search: params.toString() });
    } catch (err: any) {
      const msg = String(err?.message || 'Failed to connect partner profile');
      setConnectError(msg);
      toast.error(msg);
    } finally {
      setConnecting(false);
    }
  }, [connectName, fetchConnection, location.search, navigate, t]);

  return (
    <PartnerLayout
      activeSection={activeSection}
      onSectionChange={handleSectionChange}
      breadcrumbs={breadcrumbs}
    >
      {connectionLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !isConnected ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-primary-200 bg-primary-50 p-6 dark:border-primary-700/50 dark:bg-primary-900/20">
            <h2 className="text-xl font-semibold text-c-text">
              {t('partner.connect.title', 'Connect your partner profile')}
            </h2>
            <p className="mt-2 text-sm text-c-text-secondary">
              {t(
                'partner.connect.desc',
                'Connect your partner profile to your account to access the directory and profile settings.'
              )}
            </p>

            {selfConnectEnabled ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-c-text-muted">
                    {t('partner.connect.companyName', 'Nazwa firmy')}
                  </span>
                  <input
                    type="text"
                    value={connectName}
                    onChange={(e) => setConnectName(e.target.value)}
                    placeholder={t(
                      'partner.connect.companyNamePlaceholder',
                      'np. DBR77 Consulting'
                    )}
                    className="mt-2 w-full rounded-lg border border-c-border-subtle bg-c-surface px-4 py-2 text-sm text-c-text focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all dark:border-navy-700 dark:bg-navy-900 dark:text-white"
                  />
                </label>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleConnectPartnerProfile}
                    disabled={connecting}
                    className="w-full rounded-lg bg-c-text px-4 py-2.5 text-sm font-semibold text-c-bg transition hover:bg-c-text-secondary disabled:opacity-60"
                  >
                    {connecting
                      ? t('partner.connect.connecting', 'Łączenie…')
                      : t('partner.connect.cta', 'Utwórz i połącz profil')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200">
                {t(
                  'partner.connect.contactAdmin',
                  'Aby dołączyć do programu partnerskiego, skontaktuj się z administratorem lub poproś o zaproszenie.'
                )}
              </div>
            )}

            {connectError && (
              <div className="mt-4 rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700 dark:border-danger-900/40 dark:bg-danger-900/10 dark:text-danger-300">
                {connectError}
              </div>
            )}
          </div>
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          {renderContent()}
        </Suspense>
      )}
    </PartnerLayout>
  );
};

export default PartnerPortalViewNew;
