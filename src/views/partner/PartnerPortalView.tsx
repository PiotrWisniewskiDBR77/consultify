// @ts-nocheck
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
  Plus,
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
  loadPartnerRuntimeSummary,
  type PartnerRuntimeSummary,
  PartnerRuntimeSummaryStrip,
} from '../../components/Partner/PartnerRuntimeSummaryStrip';
import { PartnerSection } from '../../components/Partner/PartnerSidebar';
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

const LEGACY_PARTNER_PATH_TO_SECTION: Array<{ path: string; section: PartnerSection }> = [
  { path: ROUTES.PARTNER.DASHBOARD, section: 'dashboard' },
  { path: ROUTES.PARTNER.CLIENTS, section: 'client-access' },
  { path: ROUTES.PARTNER.COMMISSION, section: 'earnings' },
  { path: ROUTES.PARTNER.DIRECTORY, section: 'public-listing' },
  { path: ROUTES.PARTNER.RESOURCES, section: 'documentation' },
];

function isPartnerSection(value: string | null): value is PartnerSection {
  return Boolean(value && PARTNER_SECTIONS.has(value as PartnerSection));
}

function getLegacyPartnerSection(pathname: string): PartnerSection | null {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  const match = LEGACY_PARTNER_PATH_TO_SECTION.find(({ path }) => normalized === path);
  return match?.section ?? null;
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
    void fetchOnboardingStatus();
  }, [fetchDashboard, fetchOnboardingStatus, fetchV8RuntimeSummary]);

  const quickActions = [
    { label: 'Add New Client', icon: Plus, action: 'add-client' },
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
            <div
              key={i}
              className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4"
            >
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
      <div className="bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={fetchDashboard}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
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

  return (
    <div className="space-y-6">
      {v8RuntimeSummary && <PartnerRuntimeSummaryStrip summary={v8RuntimeSummary} />}

      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
            {t('partner.dashboard.welcome', 'Welcome back, Partner')}
          </h2>
          <p className="text-slate-400">
            {t('partner.dashboard.subtitle', "Here's your partnership overview")}
          </p>
        </div>
        <button
          onClick={fetchDashboard}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-400 hover:text-navy-900 dark:hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          {t('common.refresh', 'Refresh')}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                <stat.icon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <span className="text-sm text-slate-400">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
            <p
              className={cn(
                'text-sm mt-1',
                stat.changeType === 'positive' && 'text-emerald-600 dark:text-emerald-400',
                stat.changeType === 'negative' && 'text-red-400',
                stat.changeType === 'neutral' && 'text-slate-400'
              )}
            >
              {stat.change}
            </p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          {t('partner.dashboard.quickActions', 'Quick Actions')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((action, index) => (
            <button
              key={index}
              className="flex flex-col items-center gap-2 p-4 rounded-lg bg-slate-100 dark:bg-navy-700/50 hover:bg-violet-900/20 transition-colors group"
            >
              <action.icon className="w-6 h-6 text-slate-400 group-hover:text-violet-600 dark:group-hover:text-violet-400" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300 group-hover:text-violet-600 dark:group-hover:text-violet-400">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-500" />
              {t('partner.dashboard.recentActivity', 'Recent Activity')}
            </h3>
            <button className="text-sm text-violet-600 dark:text-violet-400 hover:underline">
              {t('common.viewAll', 'View All')}
            </button>
          </div>
          <div className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg bg-slate-100/50 dark:bg-navy-700/30"
                >
                  <div className="w-2 h-2 rounded-full bg-violet-500" />
                  <div className="flex-1">
                    <p className="text-sm text-slate-900 dark:text-white">{activity.text}</p>
                    <p className="text-xs text-slate-400">{activity.time}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">
                {t('partner.dashboard.noActivity', 'No recent activity')}
              </p>
            )}
          </div>
        </div>

        {/* Certification Progress */}
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-slate-500" />
              {t('partner.dashboard.certificationProgress', 'Certification Progress')}
            </h3>
            <span className="text-sm text-violet-600 dark:text-violet-400 font-medium">
              {dashboardData?.certificationProgress?.completed || 0}/
              {dashboardData?.certificationProgress?.total || 0} Complete
            </span>
          </div>
          <div className="space-y-3">
            {certificationCourses.length > 0 ? (
              certificationCourses.map((cert, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg bg-slate-100/50 dark:bg-navy-700/30"
                >
                  {cert.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : cert.status === 'in-progress' ? (
                    <div className="w-5 h-5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                  )}
                  <span
                    className={cn(
                      'text-sm flex-1',
                      cert.status === 'completed' && 'text-slate-900 dark:text-white',
                      cert.status === 'in-progress' && 'text-violet-600 dark:text-violet-400',
                      cert.status === 'locked' && 'text-slate-500'
                    )}
                  >
                    {cert.name}
                  </span>
                  {cert.status === 'in-progress' && cert.progress !== undefined && (
                    <span className="text-xs text-violet-600 dark:text-violet-400">
                      {cert.progress}%
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">
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
            <div
              key={i}
              className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4"
            >
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
      <div className="bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={fetchMetrics}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
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

  const performanceBreakdown = metricsData?.performance?.breakdown || {};

  return (
    <div className="space-y-6">
      {v8RuntimeSummary && <PartnerRuntimeSummaryStrip summary={v8RuntimeSummary} />}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {t('partner.metrics.title', 'Partnership Metrics')}
          </h2>
          <p className="text-slate-400">
            {t('partner.metrics.subtitle', 'Key performance indicators for your partnership')}
          </p>
        </div>
        <button
          onClick={fetchMetrics}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-400 hover:text-navy-900 dark:hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          {t('common.refresh', 'Refresh')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <div
            key={index}
            className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4"
          >
            <p className="text-sm text-slate-400 mb-2">{metric.label}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{metric.value}</p>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={cn(
                  'text-sm',
                  metric.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-400'
                )}
              >
                {metric.change}
              </span>
              <span className="text-xs text-slate-500">{metric.period}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Performance Score and Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Score */}
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
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
                  className="fill-none stroke-violet-500"
                  strokeWidth="12"
                  strokeDasharray={`${(metricsData?.performance?.score || 0) * 4.4} 440`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">
                  {metricsData?.performance?.score || 0}
                </span>
                <span className="text-sm text-slate-400">/ 100</span>
              </div>
            </div>
          </div>
          <p className="text-center text-sm text-slate-400 mt-4">
            {metricsData?.performance?.ranking || 'Calculating...'}
          </p>
        </div>

        {/* Performance Breakdown */}
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            {t('partner.metrics.scoreBreakdown', 'Score Breakdown')}
          </h3>
          <div className="space-y-4">
            {[
              {
                label: 'Client Acquisition',
                score: performanceBreakdown.clientAcquisition || 0,
                color: 'bg-violet-500',
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
                  <span className="text-slate-400">{item.label}</span>
                  <span className="font-medium text-slate-900 dark:text-white">{item.score}%</span>
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
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
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
                  className="flex-1 bg-violet-500 rounded-t transition-all duration-300 hover:bg-violet-600"
                  style={{ height: `${height}%` }}
                  title={`€${value.toLocaleString()}`}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-40">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">
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
// PERFORMANCE SECTION
// ============================================================================

const PerformanceSection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {t('partner.performance.title', 'Performance Analytics')}
        </h2>
        <p className="text-slate-400">
          {t('partner.performance.subtitle', 'Detailed performance analysis and reports')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Score */}
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Partner Performance Score
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
                  className="fill-none stroke-violet-500"
                  strokeWidth="12"
                  strokeDasharray={`${85 * 4.4} 440`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">85</span>
                <span className="text-sm text-slate-400">/ 100</span>
              </div>
            </div>
          </div>
          <p className="text-center text-sm text-slate-400 mt-4">
            Excellent performance! Top 15% of partners.
          </p>
        </div>

        {/* Performance Breakdown */}
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Score Breakdown
          </h3>
          <div className="space-y-4">
            {[
              { label: 'Client Acquisition', score: 90, color: 'bg-violet-500' },
              { label: 'Project Delivery', score: 88, color: 'bg-emerald-500' },
              { label: 'Customer Satisfaction', score: 92, color: 'bg-blue-500' },
              { label: 'Certification Progress', score: 70, color: 'bg-amber-500' },
            ].map((item, index) => (
              <div key={index}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-400">{item.label}</span>
                  <span className="font-medium text-slate-900 dark:text-white">{item.score}%</span>
                </div>
                <div className="w-full h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', item.color)}
                    style={{ width: `${item.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
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

function normalizeClientOrganization(
  client: Partial<V8PartnerClient> | Record<string, any>
): ClientOrganization {
  return {
    id: String(client.id || client.organizationId || client.name || 'client'),
    name: String(client.name || client.organizationName || client.clientName || 'Organization'),
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
  project: Partial<V8PartnerProject> | Record<string, any>
): ClientProject {
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
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <div className="bg-slate-100 dark:bg-navy-700/50 h-12" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4 p-4 border-t border-slate-200 dark:border-navy-700">
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
    <div className="bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
      <p className="text-red-400 mb-4">{error}</p>
      <button
        onClick={fetchData}
        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
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
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {t('partner.clients.organizations', 'Client Organizations')}
            </h2>
            <p className="text-slate-400">
              {t(
                'partner.clients.organizationsDesc',
                'Manage organizations under your partnership'
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-400 hover:text-navy-900 dark:hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" />
              {t('partner.clients.addOrganization', 'Add Organization')}
            </button>
          </div>
        </div>

        {organizations.length === 0 ? (
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-8 text-center">
            <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">
              {t('partner.clients.noOrganizations', 'No client organizations yet')}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-100 dark:bg-navy-700/50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Industry
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Users
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Projects
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Assessment
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-navy-700">
                {organizations.map((org) => (
                  <tr key={org.id} className="hover:bg-slate-100/50 dark:hover:bg-navy-700/30">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {org.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-400">{org.industry}</td>
                    <td className="px-4 py-4 text-sm text-center text-slate-400">{org.users}</td>
                    <td className="px-4 py-4 text-sm text-center text-slate-400">{org.projects}</td>
                    <td className="px-4 py-4 text-center">
                      <span className="px-2 py-1 text-sm font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded">
                        {org.assessmentScore}/5
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span
                        className={cn(
                          'px-2 py-1 text-xs font-medium rounded-full',
                          org.status === 'active' &&
                            'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
                          org.status === 'onboarding' && 'bg-amber-900/30 text-amber-400',
                          org.status === 'inactive' && 'bg-slate-900/30 text-slate-400'
                        )}
                      >
                        {org.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button className="text-slate-500 hover:text-violet-600 dark:hover:text-violet-400">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {t('partner.clients.projects', 'Active Projects')}
            </h2>
            <p className="text-slate-400">
              {t('partner.clients.projectsDesc', 'Transformation projects in progress')}
            </p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-400 hover:text-navy-900 dark:hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            {t('common.refresh', 'Refresh')}
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-8 text-center">
            <FolderKanban className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">
              {t('partner.clients.noProjects', 'No active projects yet')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4 hover:border-violet-700 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-white">{project.name}</h4>
                    <p className="text-sm text-slate-400">{project.clientName}</p>
                  </div>
                  <span className="px-2 py-1 text-xs font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded">
                    {project.framework}
                  </span>
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-slate-400">Progress</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {project.progress}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-600 rounded-full transition-all duration-500"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>
                {project.targetEndDate && (
                  <p className="text-xs text-slate-500 mt-3">
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
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {t('partner.clients.users', 'User Management')}
          </h2>
          <p className="text-slate-400">
            {t('partner.clients.usersDesc', 'Manage users across client organizations')}
          </p>
        </div>
      </div>
      {organizations.length === 0 ? (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-8 text-center">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">
            {t('partner.clients.usersEmpty', 'Select an organization to manage users')}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {organizations.map((org) => (
            <div
              key={org.id}
              className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4 flex items-center justify-between hover:border-violet-700 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <span className="font-medium text-slate-900 dark:text-white">{org.name}</span>
                  <p className="text-sm text-slate-400">{org.users} users</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500" />
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
        <div
          key={i}
          className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4"
        >
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
    <div className="bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
      <p className="text-red-400 mb-4">{error}</p>
      <button
        onClick={fetchCertifications}
        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
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
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {t('partner.certification.learningPath', 'Learning Path')}
            </h2>
            <p className="text-slate-400">
              {t(
                'partner.certification.learningPathDesc',
                'Complete courses to earn certifications'
              )}
            </p>
          </div>
          <button
            onClick={fetchCertifications}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-400 hover:text-navy-900 dark:hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            {t('common.refresh', 'Refresh')}
          </button>
        </div>

        {certifications.length === 0 ? (
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-8 text-center">
            <GraduationCap className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">
              {t('partner.certification.noCourses', 'No courses available yet')}
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
                    'bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-5',
                    status === 'locked'
                      ? 'border-slate-200 dark:border-navy-700 opacity-60'
                      : 'border-slate-200 dark:border-navy-700'
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold',
                        status === 'completed' &&
                          'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600',
                        status === 'in-progress' &&
                          'bg-violet-100 dark:bg-violet-900/30 text-violet-600',
                        status === 'locked' && 'bg-slate-200 dark:bg-navy-700 text-slate-500'
                      )}
                    >
                      {status === 'completed' ? <CheckCircle2 className="w-6 h-6" /> : index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-slate-900 dark:text-white">
                          {course.name}
                        </h4>
                        <span
                          className={cn(
                            'px-2 py-1 text-xs font-medium rounded-full',
                            status === 'completed' &&
                              'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600',
                            status === 'in-progress' &&
                              'bg-violet-100 dark:bg-violet-900/30 text-violet-600',
                            status === 'locked' && 'bg-slate-200 dark:bg-navy-700 text-slate-500'
                          )}
                        >
                          {getDisplayStatus(course.status)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 mt-1">
                        {course.track} / {course.level}{' '}
                        {course.targetTier ? `• ${course.targetTier}` : ''}
                      </p>
                      <div className="flex items-center gap-4 mt-3 text-sm text-slate-400">
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
                          <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-navy-700 text-slate-500">
                            {course.examMode === 'review' ? 'Operator review' : 'Exam-based'}
                          </span>
                        )}
                        {course.reviewState && (
                          <span className="px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">
                            {course.reviewState}
                          </span>
                        )}
                        {course.blockedReason && (
                          <span className="px-2 py-1 rounded-full bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300">
                            {course.blockedReason}
                          </span>
                        )}
                      </div>
                      {status !== 'locked' && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-slate-400">Progress</span>
                            <span className="font-medium text-slate-900 dark:text-white">
                              {course.progress}%
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-500',
                                status === 'completed' ? 'bg-emerald-500' : 'bg-violet-600'
                              )}
                              style={{ width: `${course.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => void toggleCertificationDetails(course.id)}
                          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          {isExpanded ? 'Hide modules' : 'View modules'}
                        </button>
                        {docHref && (
                          <button
                            onClick={() => navigate(docHref)}
                            className="px-4 py-2 border border-slate-300 dark:border-navy-600 text-sm font-medium rounded-lg text-slate-700 dark:text-slate-200 hover:border-violet-500 hover:text-violet-600 transition-colors"
                          >
                            Open guide
                          </button>
                        )}
                      </div>
                      {isExpanded && modules.length > 0 && (
                        <div className="mt-4 space-y-3 border-t border-slate-200 dark:border-navy-700 pt-4">
                          {modules.map((module) => {
                            const moduleDocHref =
                              (module.articleSlug &&
                                PARTNER_DOC_HREF_BY_SLUG[module.articleSlug]) ||
                              docHref;
                            return (
                              <div
                                key={module.id}
                                className="rounded-lg bg-slate-50 dark:bg-navy-900/40 border border-slate-200 dark:border-navy-700 p-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="font-medium text-slate-900 dark:text-white">
                                      {module.order}. {module.name}
                                    </div>
                                    {module.description && (
                                      <p className="mt-1 text-sm text-slate-500">
                                        {module.description}
                                      </p>
                                    )}
                                  </div>
                                  <span className="text-xs text-slate-400">
                                    {module.minutes ? `${module.minutes} min` : module.moduleKind}
                                  </span>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <span className="px-2 py-1 rounded-full bg-slate-200 dark:bg-navy-700 text-xs text-slate-600 dark:text-slate-300">
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
                                      className="inline-flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400"
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
                        <p className="mt-3 text-xs text-slate-500">
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
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {t('partner.certification.exams', 'Certification Exams')}
          </h2>
          <p className="text-slate-400">
            {t('partner.certification.examsDesc', 'Take exams to earn official certifications')}
          </p>
        </div>
        {hasExamsAvailable ? (
          <div className="space-y-4">
            {examCourses.map((course) => (
              <div
                key={course.id}
                className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-900 dark:text-white">
                        {course.name} Exam
                      </h4>
                      <p className="text-sm text-slate-400">
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
                    <span className="px-3 py-1 bg-slate-200 dark:bg-navy-700 text-slate-500 text-sm font-medium rounded-full">
                      Locked
                    </span>
                  ) : (
                    <button
                      onClick={() => startExam(course.id)}
                      className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Take Exam
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-8 text-center">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">
              {t('partner.certification.examsEmpty', 'Complete learning path to unlock exams')}
            </p>
          </div>
        )}

        {examOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-3xl bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4 md:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Sales Certification Exam
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {examDeadlineAt
                      ? `Deadline: ${new Date(examDeadlineAt).toLocaleTimeString()}`
                      : 'Loading...'}
                  </p>
                </div>
                <button
                  onClick={closeExam}
                  className="px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  {t('common.close', 'Close')}
                </button>
              </div>

              {examQuestions.length === 0 ? (
                <div className="mt-4 text-sm text-slate-500">Loading...</div>
              ) : (
                <div className="mt-4 space-y-4 max-h-[60vh] overflow-auto pr-1">
                  {examQuestions.map((q: any, idx: number) => (
                    <div
                      key={q.id}
                      className="rounded-lg border border-slate-200 dark:border-navy-700 p-3"
                    >
                      <div className="font-medium text-slate-900 dark:text-white">
                        {idx + 1}. {q.text}
                      </div>
                      <div className="mt-2 space-y-2">
                        {(q.options || []).map((opt: any) => (
                          <label
                            key={opt.id}
                            className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer"
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
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  )}
                >
                  {examResult.passed ? 'Passed' : 'Failed'} • Score: {examResult.scorePercent}%
                </div>
              )}

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={submitExam}
                  disabled={examSubmitting || examQuestions.length === 0}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-60"
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
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {t('partner.certification.certificates', 'Your Certificates')}
          </h2>
          <p className="text-slate-400">
            {t('partner.certification.certificatesDesc', 'Download and share your certifications')}
          </p>
        </div>
        <button
          onClick={fetchCertifications}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-400 hover:text-navy-900 dark:hover:text-white transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      {completedWithCerts.length === 0 ? (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-8 text-center">
          <Award className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">
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
              className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4 hover:border-violet-700 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center">
                  <Award className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-slate-900 dark:text-white">{cert.name}</h4>
                  <p className="text-sm text-slate-400">
                    Issued:{' '}
                    {cert.completedAt ? new Date(cert.completedAt).toLocaleDateString() : 'N/A'}
                  </p>
                  {cert.validUntil && (
                    <p className="text-xs text-slate-500 mt-1">
                      Valid until: {new Date(cert.validUntil).toLocaleDateString()}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">ID: {cert.certificateId}</p>
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
                  className="p-2 text-slate-500 hover:text-violet-600 dark:hover:text-violet-400"
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
}

const ResourcesSection: React.FC<{
  subsection: 'documentation' | 'marketing' | 'case-studies' | 'templates';
}> = ({ subsection }) => {
  const { t } = useTranslation();
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

  const handleDownload = async (resourceId: string, title: string) => {
    try {
      setDownloading(resourceId);
      // Backend streams the file directly (no JSON wrapper)
      window.open(`/api/partners/resources/${resourceId}/download`, '_blank');
      toast.success(`Downloading ${title}`);
    } catch (err: any) {
      console.error('Error downloading resource:', err);
      toast.error('Failed to download resource');
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
              className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4 flex items-center gap-4"
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
      <div className="bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={fetchResources}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
        >
          {t('common.retry', 'Retry')}
        </button>
      </div>
    );
  }

  // Map subsection to data key
  const dataKey = subsection === 'case-studies' ? 'caseStudies' : subsection;
  const items = resources?.[dataKey as keyof ResourcesData] || [];
  const docsBridge = subsection === 'documentation' ? resources?.docsBridge || [] : [];
  const academyHighlights =
    subsection === 'documentation' ? resources?.academyHighlights || [] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {titles[subsection]}
          </h2>
          <p className="text-slate-400">
            {t('partner.resources.desc', 'Download resources for your partnership')}
          </p>
        </div>
        <button
          onClick={fetchResources}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-400 hover:text-navy-900 dark:hover:text-white transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {subsection === 'documentation' &&
        (docsBridge.length > 0 || academyHighlights.length > 0) && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Canonical partner docs
              </h3>
              <div className="mt-3 space-y-3">
                {docsBridge.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => navigate(doc.href)}
                    className="w-full flex items-center justify-between rounded-lg border border-slate-200 dark:border-navy-700 px-3 py-3 text-left hover:border-violet-500 transition-colors"
                  >
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {doc.title}
                    </span>
                    <ExternalLink className="w-4 h-4 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Academy status bridge
              </h3>
              <div className="mt-3 space-y-3">
                {academyHighlights.slice(0, 4).map((item) => {
                  const href =
                    (item.articleSlug && PARTNER_DOC_HREF_BY_SLUG[item.articleSlug]) ||
                    PARTNER_CERTIFICATION_DOC_BY_TYPE[item.type];
                  return (
                    <div
                      key={item.id}
                      className="rounded-lg border border-slate-200 dark:border-navy-700 px-3 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          {item.track} / {item.level}
                        </div>
                        <div className="text-xs text-slate-400">{item.progress}%</div>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.status}
                        {item.reviewState ? ` • ${item.reviewState}` : ''}
                      </div>
                      {href && (
                        <button
                          onClick={() => navigate(href)}
                          className="mt-3 inline-flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400"
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

      {items.length === 0 ? (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-8 text-center">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">
            {t('partner.resources.empty', 'No resources available in this category')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => handleDownload(item.id, item.title)}
              className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4 flex items-center gap-4 hover:border-violet-700 transition-colors cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-navy-700 flex items-center justify-center">
                <FileText className="w-6 h-6 text-slate-500" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400">
                  {item.title}
                </h4>
                <p className="text-sm text-slate-400">
                  {item.type} • {item.size}
                </p>
              </div>
              {downloading === item.id ? (
                <RefreshCw className="w-5 h-5 text-violet-600 animate-spin" />
              ) : (
                <Download className="w-5 h-5 text-slate-500 group-hover:text-violet-600 dark:group-hover:text-violet-400" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// BILLING SECTION
// ============================================================================

const BillingSection: React.FC<{
  subsection: 'licenses' | 'invoices' | 'discounts' | 'commissions';
}> = ({ subsection }) => {
  const { t } = useTranslation();

  if (subsection === 'licenses') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {t('partner.billing.licenses', 'License Management')}
          </h2>
          <p className="text-slate-400">
            {t('partner.billing.licensesDesc', 'Manage licenses for your clients')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
            <div className="text-sm text-slate-400 mb-2">Total Licenses</div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">150</div>
            <div className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
              +20 this month
            </div>
          </div>
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
            <div className="text-sm text-slate-400 mb-2">Active</div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">142</div>
            <div className="text-sm text-slate-400 mt-1">95% utilization</div>
          </div>
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
            <div className="text-sm text-slate-400 mb-2">Available</div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">8</div>
            <button className="text-sm text-violet-600 dark:text-violet-400 mt-1 hover:underline">
              Order more →
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (subsection === 'invoices') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {t('partner.billing.invoices', 'Invoices')}
          </h2>
          <p className="text-slate-400">
            {t('partner.billing.invoicesDesc', 'View and download your invoices')}
          </p>
        </div>

        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-100 dark:bg-navy-700/50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">
                  Invoice
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">
                  Date
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase">
                  Amount
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase">
                  Status
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-navy-700">
              {[
                { id: 'INV-2026-003', date: 'Jan 1, 2026', amount: '€8,500', status: 'pending' },
                { id: 'INV-2025-012', date: 'Dec 1, 2025', amount: '€7,200', status: 'paid' },
                { id: 'INV-2025-011', date: 'Nov 1, 2025', amount: '€6,800', status: 'paid' },
              ].map((invoice, index) => (
                <tr key={index} className="hover:bg-slate-100/50 dark:hover:bg-navy-700/30">
                  <td className="px-4 py-4 font-medium text-slate-900 dark:text-white">
                    {invoice.id}
                  </td>
                  <td className="px-4 py-4 text-slate-400">{invoice.date}</td>
                  <td className="px-4 py-4 text-right font-medium text-slate-900 dark:text-white">
                    {invoice.amount}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span
                      className={cn(
                        'px-2 py-1 text-xs font-medium rounded-full',
                        invoice.status === 'paid' &&
                          'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600',
                        invoice.status === 'pending' && 'bg-amber-900/30 text-amber-600'
                      )}
                    >
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <button className="text-violet-600 dark:text-violet-400 hover:underline text-sm">
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (subsection === 'commissions') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {t('partner.billing.commissions', 'Commission Earnings')}
          </h2>
          <p className="text-slate-400">
            {t('partner.billing.commissionsDesc', 'Track your commission earnings')}
          </p>
        </div>

        {/* Commission Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-sm text-slate-400">Total Earned (YTD)</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">€18,450</p>
            <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">+32% vs last year</p>
          </div>
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                <TrendingUp className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <span className="text-sm text-slate-400">This Month</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">€2,340</p>
            <p className="text-sm text-slate-400 mt-1">From 8 referrals</p>
          </div>
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm text-slate-400">Pending</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">€1,200</p>
            <p className="text-sm text-slate-400 mt-1">Next payout: Jan 15</p>
          </div>
        </div>

        {/* Commission Table */}
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-100 dark:bg-navy-700/50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">
                  Client
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">
                  Type
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase">
                  Amount
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-navy-700">
              {[
                {
                  client: 'Nordic Manufacturing AB',
                  type: 'Referral',
                  amount: '€850',
                  status: 'paid',
                  date: 'Jan 5, 2026',
                },
                {
                  client: 'Baltic Energy Group',
                  type: 'Renewal',
                  amount: '€1,200',
                  status: 'pending',
                  date: 'Jan 8, 2026',
                },
                {
                  client: 'TechVentures Sp. z o.o.',
                  type: 'New License',
                  amount: '€290',
                  status: 'pending',
                  date: 'Jan 7, 2026',
                },
              ].map((commission, index) => (
                <tr key={index} className="hover:bg-slate-100/50 dark:hover:bg-navy-700/30">
                  <td className="px-4 py-4 font-medium text-slate-900 dark:text-white">
                    {commission.client}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-400">{commission.type}</td>
                  <td className="px-4 py-4 text-right font-medium text-slate-900 dark:text-white">
                    {commission.amount}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span
                      className={cn(
                        'px-2 py-1 text-xs font-medium rounded-full',
                        commission.status === 'paid' &&
                          'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600',
                        commission.status === 'pending' && 'bg-amber-900/30 text-amber-600'
                      )}
                    >
                      {commission.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-400">{commission.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Discounts
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {t('partner.billing.discounts', 'Partner Discounts')}
        </h2>
        <p className="text-slate-400">
          {t('partner.billing.discountsDesc', 'Your current discount tier and benefits')}
        </p>
      </div>

      <div className="bg-gradient-to-br from-violet-600 to-violet-700 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <Award className="w-8 h-8" />
          <div>
            <h3 className="text-xl font-bold">Certified Partner</h3>
            <p className="text-violet-200">12% discount on all licenses</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-white/10 rounded-lg p-3">
            <div className="text-2xl font-bold">12%</div>
            <div className="text-sm text-violet-200">License Discount</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <div className="text-2xl font-bold">Priority</div>
            <div className="text-sm text-violet-200">Support Level</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <div className="text-2xl font-bold">Co-marketing</div>
            <div className="text-sm text-violet-200">Included</div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
        <h4 className="font-medium text-slate-900 dark:text-white mb-4">
          Next Tier: Premier Partner
        </h4>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span className="text-slate-400">10+ active projects (8/10)</span>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span className="text-slate-400">Published case study (1/1)</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600" />
            <span className="text-slate-400">All certifications complete (2/4)</span>
          </div>
        </div>
      </div>
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
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
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
    <div className="bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
      <p className="text-red-400 mb-4">{error}</p>
      <button
        onClick={fetchOrganization}
        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
      >
        {t('common.retry', 'Retry')}
      </button>
    </div>
  );

  const allFrameworks = [
    'DRD',
    'SIRI',
    'ADMA',
    'CMMI',
    'Lean 4.0',
    'ISO 21500',
    'PMBOK',
    'PRINCE2',
  ];
  const allRegions = [
    'DACH',
    'Nordics',
    'Benelux',
    'UK & Ireland',
    'France',
    'Southern Europe',
    'CEE',
    'Baltics',
  ];

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorDisplay />;

  if (subsection === 'company-info') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {t('partner.profile.companyInfo', 'Company Information')}
            </h2>
            <p className="text-slate-400">
              {t('partner.profile.companyInfoDesc', 'Manage your company details')}
            </p>
          </div>
          <button
            onClick={fetchOrganization}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-400 hover:text-navy-900 dark:hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                Company Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                Tax ID / VAT
              </label>
              <input
                type="text"
                value={formData.taxId}
                onChange={(e) => setFormData((prev) => ({ ...prev, taxId: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                Contact Email
              </label>
              <input
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData((prev) => ({ ...prev, contactEmail: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                Phone
              </label>
              <input
                type="tel"
                value={formData.contactPhone}
                onChange={(e) => setFormData((prev) => ({ ...prev, contactPhone: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                Website
              </label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => setFormData((prev) => ({ ...prev, website: e.target.value }))}
                placeholder="https://"
                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSaveCompanyInfo}
              disabled={saving}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
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
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {t('partner.profile.specializations', 'Specializations')}
          </h2>
          <p className="text-slate-400">
            {t('partner.profile.specializationsDesc', 'Select frameworks you specialize in')}
          </p>
        </div>

        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
            {allFrameworks.map((fw) => (
              <button
                key={fw}
                onClick={() => toggleSpecialization(fw)}
                className={cn(
                  'p-4 rounded-xl border-2 text-center transition-all',
                  selectedSpecializations.includes(fw)
                    ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                    : 'border-slate-200 dark:border-navy-700 hover:border-violet-300'
                )}
              >
                <Target
                  className={cn(
                    'w-8 h-8 mx-auto mb-2',
                    selectedSpecializations.includes(fw) ? 'text-violet-600' : 'text-slate-500'
                  )}
                />
                <span
                  className={cn(
                    'font-medium',
                    selectedSpecializations.includes(fw) ? 'text-violet-600' : 'text-slate-400'
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
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
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
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {t('partner.profile.regions', 'Operating Regions')}
          </h2>
          <p className="text-slate-400">
            {t('partner.profile.regionsDesc', 'Select regions where you operate')}
          </p>
        </div>

        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {allRegions.map((region) => (
              <label
                key={region}
                className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-navy-700 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-navy-700/30"
              >
                <input
                  type="checkbox"
                  checked={selectedRegions.includes(region)}
                  onChange={() => toggleRegion(region)}
                  className="rounded text-violet-600 focus:ring-violet-500"
                />
                <span className="text-slate-600 dark:text-slate-300">{region}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSaveRegions}
              disabled={saving}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
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
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {t('partner.profile.publicListing', 'Public Listing')}
        </h2>
        <p className="text-slate-400">
          {t('partner.profile.publicListingDesc', 'Manage your visibility in partner directory')}
        </p>
      </div>

      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h4 className="font-medium text-slate-900 dark:text-white">Directory Visibility</h4>
            <p className="text-sm text-slate-400">
              Show your profile in the public partner directory
            </p>
          </div>
          <button
            onClick={handleToggleListing}
            disabled={saving}
            aria-label="Toggle public listing"
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              publicListingEnabled ? 'bg-violet-600' : 'bg-slate-300 dark:bg-navy-600'
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-slate-50 dark:bg-navy-900 transition',
                publicListingEnabled ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>

        <div className="border-t border-slate-200 dark:border-navy-700 pt-6">
          <h4 className="font-medium text-slate-900 dark:text-white mb-4">Preview</h4>
          <div className="bg-slate-100/50 dark:bg-navy-700/30 rounded-xl p-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <Building2 className="w-8 h-8 text-violet-600" />
              </div>
              <div>
                <h5 className="font-semibold text-slate-900 dark:text-white">
                  {organization?.name || 'Your Company'}
                </h5>
                <p className="text-sm text-slate-400">
                  {organization?.tier || 'Partner'} •{' '}
                  {selectedRegions.join(', ') || 'No regions selected'}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {selectedSpecializations.length > 0 ? (
                    selectedSpecializations.map((spec) => (
                      <span
                        key={spec}
                        className="px-2 py-0.5 text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-600 rounded"
                      >
                        {spec}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500">No specializations selected</span>
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

  const fetchConnection = useCallback(async () => {
    try {
      setConnectionLoading(true);
      setConnectError(null);
      const response = await Api.get('/api/partners/connection');
      const payload = response?.data;
      const data = payload?.data;
      if (response?.success && data && typeof data.connected === 'boolean') {
        setIsConnected(Boolean(data.connected));
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
      setConnectError(
        t(
          'partner.connect.unavailable',
          'Partner Portal is not configured yet. Please run partner portal migrations in the database.'
        )
      );
    } catch (err: any) {
      setIsConnected(false);
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
            'Najpierw podłącz profil partnera, aby przejść do innych sekcji.'
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
        return <ProviderHomeView />;
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
  }, [activeSection]);

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
          <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !isConnected ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-6 dark:border-violet-700/50 dark:bg-violet-900/20">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {t('partner.connect.title', 'Podłącz profil partnera')}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {t(
                'partner.connect.desc',
                'Aby korzystać z katalogu i ustawień profilu, podłącz swój profil partnerski do konta.'
              )}
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('partner.connect.companyName', 'Nazwa firmy')}
                </span>
                <input
                  type="text"
                  value={connectName}
                  onChange={(e) => setConnectName(e.target.value)}
                  placeholder={t('partner.connect.companyNamePlaceholder', 'np. DBR77 Consulting')}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all dark:border-navy-700 dark:bg-navy-900 dark:text-white"
                />
              </label>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleConnectPartnerProfile}
                  disabled={connecting}
                  className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
                >
                  {connecting
                    ? t('partner.connect.connecting', 'Łączenie…')
                    : t('partner.connect.cta', 'Utwórz i podłącz profil')}
                </button>
              </div>
            </div>

            {connectError && (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-900/10 dark:text-rose-300">
                {connectError}
              </div>
            )}
          </div>
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
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
