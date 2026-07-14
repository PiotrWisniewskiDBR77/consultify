/**
 * ExecutiveDashboard - Main executive command center
 * BCG/McKinsey style: Data-dense, scannable, actionable
 *
 * Layout:
 * - Personalized greeting with date
 * - Portfolio Health Score (prominent) + KPI Grid (4 quadrants)
 * - Action Required Strip
 * - Two-column: Decision Queue + Team Performance
 * - Initiative/Project Progress Overview
 * - Bottleneck Alerts + AI Signals
 */

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Folder,
  Lightbulb,
  RefreshCw,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';
import { useAppStore } from '../../../store/useAppStore';
import { ActionRequiredStrip } from './ActionRequiredStrip';
import { AIOperatorOverviewCard } from './AIOperatorOverviewCard';
import { DecisionQueuePreview } from './DecisionQueuePreview';
import { dedupeActionItems } from './executiveData';
import { KPIGrid } from './KPIGrid';
import { PortfolioHealthScore } from './PortfolioHealthScore';
import { TeamPerformancePreview } from './TeamPerformancePreview';

interface ExecutiveDashboardProps {
  onNavigate?: (section: string, options?: { filter?: string }) => void;
  onDecisionApprove?: (id: string) => void;
  onDecisionReject?: (id: string) => void;
  refreshTrigger?: number;
}

interface InitiativeProgress {
  id: string;
  name: string;
  status: string;
  priority: string;
  tasksDone: number;
  tasksTotal: number;
  completionPct: number;
  overdueCount: number;
}

interface AISignal {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: string;
  entityType?: string;
  entityId?: string;
  createdAt: string;
}

const getGreetingText = (t: (key: string, fallback: string) => string): string => {
  const hour = new Date().getHours();
  if (hour < 12) return t('executive.greeting.morning', 'Good morning');
  if (hour < 18) return t('executive.greeting.afternoon', 'Good afternoon');
  return t('executive.greeting.evening', 'Good evening');
};

const formatDate = (locale: string = 'en-US'): string => {
  return new Date().toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// --- Initiative Progress Card ---
const InitiativeCard: React.FC<{
  initiative: InitiativeProgress;
  onClick?: () => void;
}> = ({ initiative, onClick }) => {
  const { t } = useTranslation();
  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    PLANNING: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    AT_RISK: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    BLOCKED: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
    DRAFT: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400',
    COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  };

  const barColor =
    initiative.completionPct >= 75
      ? 'bg-emerald-500'
      : initiative.completionPct >= 50
        ? 'bg-blue-500'
        : initiative.completionPct >= 25
          ? 'bg-amber-500'
          : 'bg-slate-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="p-4 rounded-xl bg-slate-50/80 dark:bg-white/[0.03] hover:bg-slate-100/80 dark:hover:bg-white/[0.06] cursor-pointer transition-colors duration-150"
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-1 flex-1">
          {initiative.name}
        </h4>
        <span
          className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
            statusColors[initiative.status?.toUpperCase()] || statusColors.DRAFT
          }`}
        >
          {initiative.status?.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${initiative.completionPct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`h-full rounded-full ${barColor}`}
          />
        </div>
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 tabular-nums w-10 text-right">
          {initiative.completionPct}%
        </span>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <span>
          {initiative.tasksDone}/{initiative.tasksTotal} {t('executive.initiatives.tasks', 'tasks')}
        </span>
        {initiative.overdueCount > 0 && (
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
            <AlertTriangle size={10} />
            {initiative.overdueCount} {t('executive.actions.overdue', 'overdue')}
          </span>
        )}
      </div>
    </motion.div>
  );
};

// --- AI Signal Card ---
const SignalCard: React.FC<{ signal: AISignal; onClick?: () => void }> = ({ signal, onClick }) => {
  const severityConfig: Record<string, { border: string; icon: string }> = {
    CRITICAL: { border: 'border-l-danger-500', icon: 'text-danger-500' },
    WARNING: { border: 'border-l-amber-500', icon: 'text-amber-500' },
    INFO: { border: 'border-l-blue-500', icon: 'text-blue-500' },
  };
  const cfg = severityConfig[signal.severity?.toUpperCase()] || severityConfig.INFO;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="px-4 py-3 rounded-lg hover:bg-slate-50/60 dark:hover:bg-white/[0.03] cursor-pointer transition-colors duration-150"
    >
      <div className="flex items-start gap-2.5">
        <span
          className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
            signal.severity?.toUpperCase() === 'CRITICAL'
              ? 'bg-danger-500'
              : signal.severity?.toUpperCase() === 'WARNING'
                ? 'bg-amber-500'
                : 'bg-slate-400 dark:bg-slate-500'
          }`}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 line-clamp-1">
            {signal.title}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
            {signal.message}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  onNavigate,
  onDecisionApprove,
  onDecisionReject,
  refreshTrigger,
}) => {
  const { t, i18n } = useTranslation();
  const user = useAppStore((state) => state.currentUser);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const [healthScore, setHealthScore] = useState({
    score: 0,
    previousScore: 0,
    trend: 'stable' as 'up' | 'down' | 'stable',
    breakdown: {
      execution: 0,
      decisions: 0,
      capacity: 0,
      risk: 0,
    },
  });

  type TrendDir = 'up' | 'down' | 'stable';
  type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
  const [kpiData, setKpiData] = useState<{
    tasks: {
      completed: number;
      total: number;
      overdueCount: number;
      onTimeRate: number;
      trend: TrendDir;
    } | null;
    decisions: { pending: number; avgWaitDays: number; critical: number; trend: TrendDir } | null;
    team: {
      avgCapacity: number;
      overloaded: number;
      available: number;
      trend: TrendDir;
      memberCount: number;
    } | null;
    risk: { level: RiskLevel; blockers: number; escalations: number; trend: TrendDir } | null;
  }>({
    tasks: null,
    decisions: null,
    team: null,
    risk: null,
  });

  const [actionItems, setActionItems] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [initiatives, setInitiatives] = useState<InitiativeProgress[]>([]);
  const [signals, setSignals] = useState<AISignal[]>([]);
  const [patterns, setPatterns] = useState<any>(null);
  const [operatorOverview, setOperatorOverview] = useState<any>(null);
  const [operatorActionBusyId, setOperatorActionBusyId] = useState<string | null>(null);

  const currentLang = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0];

  const dateLocaleMap: Record<string, string> = {
    en: 'en-US',
    pl: 'pl-PL',
    de: 'de-DE',
    es: 'es-ES',
    ar: 'ar-SA',
    jp: 'ja-JP',
  };
  const dateLocale = dateLocaleMap[currentLang] || 'en-US';

  const greetingText = getGreetingText(t);
  const userName =
    user?.firstName ||
    (user as any)?.displayName?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    '';

  const fetchDashboardData = useCallback(
    async (isRefresh = false) => {
      try {
        setLoadError(null);
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const [statsRes, decisionsRes, teamRes, tasksRes, analyticsRes, signalsRes, operatorRes] =
          await Promise.allSettled([
            Api.get('/my-work/stats?period=week'),
            Api.get('/my-work/decisions?limit=10&onlyPending=true'),
            Api.get('/my-work/team-workload'),
            Api.getTasks({ assigneeId: user?.id, status: 'todo,in_progress' } as any),
            Api.getExecutiveAnalytics(),
            Api.get('/my-work/signals?limit=5'),
            Api.getAIOperatorOverview(),
          ]);

        if (operatorRes.status === 'fulfilled' && operatorRes.value) {
          setOperatorOverview(operatorRes.value);
        }

        // --- Process stats (with real previous period data) ---
        if (statsRes.status === 'fulfilled' && statsRes.value) {
          const stats = statsRes.value;
          const completionRate =
            stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
          const onTimeRate = stats.onTimeRate || 0;

          const prevCompletionRate =
            stats.previous?.total > 0
              ? Math.round((stats.previous.completed / stats.previous.total) * 100)
              : 0;
          const prevOnTimeRate = stats.previous?.onTimeRate || 0;

          const executionScore = completionRate;

          let decisionsScore = 50;
          if (decisionsRes.status === 'fulfilled' && Array.isArray(decisionsRes.value)) {
            const pendingCount = decisionsRes.value.length;
            decisionsScore =
              pendingCount === 0 ? 100 : Math.round(Math.max(20, 100 - pendingCount * 10));
          }

          let capacityScore = 0;
          if (teamRes.status === 'fulfilled' && Array.isArray(teamRes.value)) {
            const team = teamRes.value || [];
            if (team.length > 0) {
              const avgUtil =
                team.reduce((sum: number, m: any) => sum + (m.capacity || 0), 0) / team.length;
              capacityScore = Math.round(Math.min(100, avgUtil));
            }
          }

          const blockedCount = stats.byStatus?.blocked || 0;
          const riskScore =
            stats.total > 0
              ? Math.round(Math.max(0, 100 - (blockedCount / Math.max(1, stats.total)) * 100))
              : 80;

          const currentHealthScore = Math.round(
            executionScore * 0.4 + decisionsScore * 0.2 + capacityScore * 0.2 + riskScore * 0.2
          );
          const previousHealthScore = Math.round(
            prevCompletionRate * 0.4 + 50 * 0.2 + 0 * 0.2 + 80 * 0.2
          );

          setHealthScore({
            score: currentHealthScore,
            previousScore: previousHealthScore,
            trend: stats.trend || 'stable',
            breakdown: {
              execution: executionScore,
              decisions: decisionsScore,
              capacity: capacityScore,
              risk: riskScore,
            },
          });

          setKpiData((prev) => ({
            ...prev,
            tasks: {
              completed: stats.completed || 0,
              total: stats.total || 0,
              overdueCount: stats.byStatus?.overdue || 0,
              onTimeRate: stats.onTimeRate || 0,
              trend: stats.trend || 'stable',
            },
          }));
        }

        // --- Process decisions (using /my-work/decisions which returns flat array) ---
        if (decisionsRes.status === 'fulfilled' && decisionsRes.value) {
          const decisionList = Array.isArray(decisionsRes.value) ? decisionsRes.value : [];
          const pendingDecisions = decisionList.filter((d: any) =>
            ['PENDING', 'ESCALATED', 'pending', 'escalated'].includes(d.status)
          );

          setDecisions(
            pendingDecisions.map((d: any) => ({
              id: d.id,
              title: d.title,
              type: d.decisionType || 'GENERAL',
              priority: (d.priority || 'medium').toLowerCase(),
              daysWaiting:
                d.daysWaiting ??
                Math.floor((Date.now() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
              requestedBy: d.requestedByName,
              projectName: d.projectName,
            }))
          );

          const criticalCount = pendingDecisions.filter(
            (d: any) => (d.priority || '').toUpperCase() === 'CRITICAL'
          ).length;

          const avgWaitDays =
            pendingDecisions.length > 0
              ? Math.round(
                  (pendingDecisions.reduce((sum: number, d: any) => {
                    const days =
                      d.daysWaiting ??
                      Math.floor(
                        (Date.now() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24)
                      );
                    return sum + days;
                  }, 0) /
                    pendingDecisions.length) *
                    10
                ) / 10
              : 0;

          setKpiData((prev) => ({
            ...prev,
            decisions: {
              pending: pendingDecisions.length,
              avgWaitDays,
              critical: criticalCount,
              trend: pendingDecisions.length > 5 ? 'down' : 'stable',
            },
          }));

          const urgentItems = pendingDecisions
            .filter(
              (d: any) =>
                (d.priority || '').toUpperCase() === 'CRITICAL' ||
                (d.priority || '').toUpperCase() === 'HIGH'
            )
            .map((d: any) => ({
              id: d.id,
              type: 'decision' as const,
              title: d.title,
              urgency: (d.priority || '').toUpperCase() === 'CRITICAL' ? 'critical' : 'high',
              projectName: d.projectName,
              owner: d.requestedByName,
              daysOverdue: Math.max(0, (d.daysWaiting || 0) - 7),
            }));

          setActionItems(dedupeActionItems(urgentItems).slice(0, 3));
        }

        // --- Process team data ---
        if (
          teamRes.status === 'fulfilled' &&
          Array.isArray(teamRes.value) &&
          teamRes.value.length > 0
        ) {
          setTeamMembers(
            teamRes.value.map((m: any) => ({
              id: m.id,
              name: m.name || 'Unknown',
              initials:
                m.initials ||
                (m.name || 'U')
                  .split(' ')
                  .map((n: string) => n[0])
                  .join('')
                  .slice(0, 2),
              capacity: m.capacity || 0,
              tasksCompleted: m.tasksCompleted || 0,
              tasksTotal: m.tasksAssigned || 0,
              trend: 'stable' as const,
            }))
          );

          const avgCapacity = Math.round(
            teamRes.value.reduce((sum: number, m: any) => sum + (m.capacity || 0), 0) /
              teamRes.value.length
          );
          const overloadedCount = teamRes.value.filter((m: any) => (m.capacity || 0) > 100).length;
          const availableCount = teamRes.value.filter((m: any) => (m.capacity || 0) < 50).length;

          setKpiData((prev) => ({
            ...prev,
            team: {
              avgCapacity,
              overloaded: overloadedCount,
              available: availableCount,
              trend: overloadedCount > 2 ? 'down' : 'stable',
              memberCount: teamRes.value.length,
            },
          }));
        }

        // --- Process tasks for risk assessment ---
        if (tasksRes.status === 'fulfilled' && Array.isArray(tasksRes.value)) {
          const overdueTasks = tasksRes.value.filter((task: any) => {
            if (!task.dueDate) return false;
            return new Date(task.dueDate) < new Date();
          });

          const escalationsCount =
            statsRes.status === 'fulfilled' ? (statsRes.value as any)?.byStatus?.escalated || 0 : 0;

          const riskLevel: RiskLevel =
            overdueTasks.length > 5 || escalationsCount > 3
              ? 'high'
              : overdueTasks.length > 2 || escalationsCount > 1
                ? 'medium'
                : 'low';

          setKpiData((prev) => ({
            ...prev,
            risk: {
              level: riskLevel,
              blockers: overdueTasks.length,
              escalations: escalationsCount,
              trend: overdueTasks.length > 5 ? 'down' : overdueTasks.length === 0 ? 'up' : 'stable',
            },
          }));

          const overdueTaskItems = overdueTasks.map((task: any) => {
            const daysOverdue = Math.floor(
              (Date.now() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24)
            );
            return {
              id: task.id,
              type: 'task' as const,
              title: task.title,
              urgency: daysOverdue > 7 ? 'critical' : daysOverdue > 3 ? 'high' : 'medium',
              projectName: task.projectName || task.initiativeName,
              initiativeName: task.initiativeName,
              owner: task.assigneeName,
              daysOverdue,
            };
          });

          setActionItems((prev) => {
            const decisionItems = prev.filter((i) => i.type === 'decision');
            // A3: de-duplicate by title+initiative so the same recurring action
            // (e.g. "Submit Compliance Documentation") is not shown 3× as
            // separate cards. Dedup BEFORE slicing so distinct actions survive.
            return dedupeActionItems([...decisionItems, ...overdueTaskItems]).slice(0, 5);
          });
        }

        // --- Process initiative + capacity analytics ---
        if (analyticsRes.status === 'fulfilled' && analyticsRes.value) {
          const analytics = analyticsRes.value as any;
          const availableCount =
            teamRes.status === 'fulfilled' && Array.isArray(teamRes.value)
              ? teamRes.value.filter((m: any) => (m.capacity || 0) < 50).length
              : 0;
          const progressItems: InitiativeProgress[] = Array.isArray(analytics?.initiativeBreakdown)
            ? analytics.initiativeBreakdown.slice(0, 6).map((i: any) => ({
                id: i.id,
                name: i.name || i.title || t('executive.initiatives.untitled', 'Untitled'),
                status: i.status || 'DRAFT',
                priority: i.priority || 'MEDIUM',
                tasksDone: Math.max(0, Number(i.tasksTotal || 0) - Number(i.tasksOpen || 0)),
                tasksTotal: Number(i.tasksTotal || 0),
                completionPct: Number(i.completionPct || 0),
                overdueCount: Number(i.overdueCount || 0),
              }))
            : [];

          setInitiatives(progressItems);

          if (analytics?.capacity?.avgUtilization != null) {
            const analyticsMemberCount =
              teamRes.status === 'fulfilled' && Array.isArray(teamRes.value)
                ? teamRes.value.length
                : Array.isArray(analytics.overloads)
                  ? analytics.overloads.length
                  : 0;
            setKpiData((prev) => ({
              ...prev,
              team: {
                avgCapacity: Number(analytics.capacity.avgUtilization || 0),
                overloaded: Array.isArray(analytics.overloads)
                  ? analytics.overloads.length
                  : (prev.team?.overloaded ?? 0),
                available: availableCount,
                trend:
                  Number(analytics.capacity.shortfallHours || 0) > 0 ||
                  (Array.isArray(analytics.overloads) && analytics.overloads.length > 0)
                    ? 'down'
                    : 'stable',
                memberCount: prev.team?.memberCount ?? analyticsMemberCount,
              },
            }));
          }
        }

        // --- Process AI signals ---
        if (signalsRes.status === 'fulfilled' && signalsRes.value) {
          const signalData = signalsRes.value?.signals || signalsRes.value || [];
          if (Array.isArray(signalData)) {
            setSignals(
              signalData.slice(0, 5).map((s: any) => ({
                id: s.id || s.key || s.notificationId,
                type: s.type || 'INFO',
                title: s.title || '',
                message: s.message || s.body || '',
                severity: s.severity || 'INFO',
                entityType: s.entityType,
                entityId: s.entityId,
                createdAt: s.createdAt || '',
              }))
            );
          }
        }

        setLastUpdated(new Date());

        try {
          const pRes = await Api.get('/my-work/work-patterns');
          if (pRes) setPatterns(pRes);
        } catch {
          /* ignore */
        }
      } catch (error) {
        setLoadError(t('executive.loadError', 'Failed to load dashboard data'));
        toast.error(t('executive.loadError', 'Failed to load dashboard data'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [t, user?.id]
  );

  useEffect(() => {
    fetchDashboardData();

    const interval = setInterval(
      () => {
        fetchDashboardData(true);
      },
      5 * 60 * 1000
    );

    return () => clearInterval(interval);
  }, [fetchDashboardData, refreshTrigger]);

  const handleApprove = async (id: string) => {
    try {
      await Api.decideDecision(id, 'approved');
      toast.success(t('executive.decisions.approved', 'Decision approved'));
      onDecisionApprove?.(id);
      fetchDashboardData(true);
    } catch {
      toast.error(t('executive.decisions.error', 'Failed to approve'));
    }
  };

  const handleReject = async (id: string) => {
    try {
      await Api.decideDecision(id, 'rejected');
      toast.success(t('executive.decisions.rejected', 'Decision rejected'));
      onDecisionReject?.(id);
      fetchDashboardData(true);
    } catch {
      toast.error(t('executive.decisions.error', 'Failed to reject'));
    }
  };

  const handleProposeOperatorIntervention = useCallback(
    async (templateKey: string) => {
      try {
        setOperatorActionBusyId(templateKey);
        await Api.proposeAIOperatorIntervention({ templateKey });
        toast.success(t('executive.operator.proposed', 'Operator intervention proposed.'));
        await fetchDashboardData(true);
      } catch {
        toast.error(t('executive.operator.proposeFailed', 'Failed to propose intervention.'));
      } finally {
        setOperatorActionBusyId(null);
      }
    },
    [fetchDashboardData, t]
  );

  const handleAcceptOperatorIntervention = useCallback(
    async (actionId: string) => {
      try {
        setOperatorActionBusyId(actionId);
        await Api.acceptAIOperatorIntervention(actionId);
        toast.success(t('executive.operator.accepted', 'Intervention accepted.'));
        await fetchDashboardData(true);
      } catch {
        toast.error(t('executive.operator.acceptFailed', 'Failed to accept intervention.'));
      } finally {
        setOperatorActionBusyId(null);
      }
    },
    [fetchDashboardData, t]
  );

  const handleExecuteOperatorIntervention = useCallback(
    async (actionId: string) => {
      try {
        setOperatorActionBusyId(actionId);
        await Api.executeAIOperatorIntervention(actionId);
        toast.success(t('executive.operator.executed', 'Intervention executed.'));
        await fetchDashboardData(true);
      } catch {
        toast.error(t('executive.operator.executeFailed', 'Failed to execute intervention.'));
      } finally {
        setOperatorActionBusyId(null);
      }
    },
    [fetchDashboardData, t]
  );

  const handleRejectOperatorIntervention = useCallback(
    async (actionId: string) => {
      try {
        setOperatorActionBusyId(actionId);
        await Api.rejectAIOperatorIntervention(actionId);
        toast.success(t('executive.operator.rejected', 'Intervention rejected.'));
        await fetchDashboardData(true);
      } catch {
        toast.error(t('executive.operator.rejectFailed', 'Failed to reject intervention.'));
      } finally {
        setOperatorActionBusyId(null);
      }
    },
    [fetchDashboardData, t]
  );

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 dark:bg-danger-900/20 dark:border-danger-500/30 px-4 py-3 text-sm text-danger-700 dark:text-danger-300">
          {loadError}
        </div>
      )}

      {/* Header with Greeting */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-navy-900 dark:text-white">
            {greetingText}
            {userName ? `, ${userName}` : ''}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
            <Calendar size={14} />
            {formatDate(dateLocale)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 dark:text-slate-500 mr-2">
            {t('executive.lastUpdated', 'Updated')}:{' '}
            {lastUpdated.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
          </span>

          <button
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors disabled:opacity-50"
            title={t('executive.refresh', 'Refresh')}
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </motion.div>

      {/* Portfolio Health + KPI Grid Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1">
          <PortfolioHealthScore
            score={healthScore.score}
            previousScore={healthScore.previousScore}
            trend={healthScore.trend}
            breakdown={healthScore.breakdown}
            loading={loading}
          />
        </div>

        <div className="xl:col-span-2">
          <KPIGrid data={kpiData} loading={loading} onNavigate={onNavigate} />
        </div>
      </div>

      {/* Action Required Strip */}
      <ActionRequiredStrip
        items={actionItems}
        loading={loading}
        onApprove={handleApprove}
        onReject={handleReject}
        onViewAll={() => onNavigate?.('inbox')}
        onItemClick={(item) => {
          if (item.type === 'decision') {
            onNavigate?.('decisions');
          } else {
            onNavigate?.('tasks');
          }
        }}
      />

      <AIOperatorOverviewCard
        overview={operatorOverview}
        loading={loading}
        onOpenSection={(section) => onNavigate?.(section)}
        onProposeIntervention={handleProposeOperatorIntervention}
        onAcceptIntervention={handleAcceptOperatorIntervention}
        onExecuteIntervention={handleExecuteOperatorIntervention}
        onRejectIntervention={handleRejectOperatorIntervention}
        busyActionId={operatorActionBusyId}
      />

      {/* L3: Work Patterns */}
      {patterns && (
        <div className="mt-4 p-4 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900">
          <h3 className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-200">
            {t('executive.patterns.title', 'Work Patterns')}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            {patterns.avgVelocity != null && (
              <div className="text-center">
                <div className="text-lg font-bold text-primary-600">{patterns.avgVelocity}</div>
                <div className="text-[10px] text-slate-500">
                  {t('executive.patterns.tasksPerWeek', 'tasks/week')}
                </div>
              </div>
            )}
            {patterns.avgCompletionDays != null && (
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600">{patterns.avgCompletionDays}d</div>
                <div className="text-[10px] text-slate-500">
                  {t('executive.patterns.avgTaskTime', 'avg task time')}
                </div>
              </div>
            )}
            {patterns.avgDecisionDays != null && (
              <div className="text-center">
                <div className="text-lg font-bold text-amber-600">{patterns.avgDecisionDays}d</div>
                <div className="text-[10px] text-slate-500">
                  {t('executive.patterns.avgDecisionTime', 'avg decision time')}
                </div>
              </div>
            )}
            {patterns.overdueRate != null && (
              <div className="text-center">
                <div className="text-lg font-bold text-danger-600">{patterns.overdueRate}%</div>
                <div className="text-[10px] text-slate-500">
                  {t('executive.patterns.overdueRate', 'overdue rate')}
                </div>
              </div>
            )}
          </div>
          {patterns.insights?.length > 0 && (
            <div className="space-y-1">
              {patterns.insights.map((insight: any, i: number) => {
                const text =
                  typeof insight === 'string'
                    ? insight
                    : t(`executive.patterns.insight.${insight.key}`, insight.key, insight.params);
                const renderedText =
                  typeof text === 'string' || typeof text === 'number'
                    ? text
                    : JSON.stringify(text);
                return (
                  <p key={i} className="text-xs text-slate-600 dark:text-slate-400">
                    💡 {renderedText}
                  </p>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Three-Column: Decisions + Team Performance + AI Signals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <DecisionQueuePreview
          decisions={decisions}
          loading={loading}
          onApprove={handleApprove}
          onReject={handleReject}
          onViewAll={() => onNavigate?.('decisions')}
          onDecisionClick={(id) => onNavigate?.('decisions')}
        />

        <TeamPerformancePreview
          members={teamMembers}
          loading={loading}
          onViewAll={() => onNavigate?.('team')}
          onMemberClick={(id) => onNavigate?.('team')}
        />

        {/* AI Signals & Insights */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="rounded-xl bg-white dark:bg-navy-900/50 h-full flex flex-col"
        >
          <div className="flex items-center justify-between px-5 py-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Zap size={16} className="text-amber-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {t('executive.signals.title', 'AI Signals & Insights')}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('executive.signals.subtitle', 'Intelligent alerts from your portfolio')}
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate?.('notifications')}
              className="text-xs font-medium text-slate-600 dark:text-slate-500 hover:text-primary-500 dark:hover:text-primary-400 flex items-center gap-1 transition-colors duration-150"
            >
              {t('executive.signals.viewAll', 'View all')}
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-0.5">
            {!loading && signals.length > 0 ? (
              signals.map((signal) => (
                <SignalCard
                  key={signal.id}
                  signal={signal}
                  onClick={() => onNavigate?.('notifications')}
                />
              ))
            ) : !loading ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Zap size={20} className="text-slate-600 dark:text-slate-400 mb-2" />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('executive.signals.empty', 'No signals')}
                </p>
              </div>
            ) : (
              <div className="space-y-3 animate-pulse">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-10 bg-slate-100 dark:bg-white/[0.03] rounded-lg" />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Initiative Progress Overview */}
      {!loading && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="rounded-xl bg-white dark:bg-navy-900/50"
        >
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <Folder size={16} className="text-indigo-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {t('executive.initiatives.title', 'Initiative Progress')}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {initiatives.length} {t('executive.initiatives.active', 'active initiatives')}
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate?.('initiatives')}
              className="text-xs font-medium text-slate-600 dark:text-slate-500 hover:text-primary-500 dark:hover:text-primary-400 flex items-center gap-1 transition-colors duration-150"
            >
              {t('executive.initiatives.viewAll', 'View all')}
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="px-5 pb-5">
            {initiatives.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {initiatives.map((init) => (
                  <InitiativeCard
                    key={init.id}
                    initiative={init}
                    onClick={() => onNavigate?.('initiatives')}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Folder size={24} className="text-slate-600 dark:text-slate-400 mb-2" />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('executive.initiatives.empty', 'No active initiatives')}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ExecutiveDashboard;
