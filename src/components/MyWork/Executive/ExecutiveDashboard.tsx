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
import { AlertTriangle, ArrowRight, Calendar, Folder, Zap } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';
import { useAppStore } from '../../../store/useAppStore';
import { EmptyState, SaveStateIndicator, type SaveStatus } from '../../shared/states';
import { ActionRequiredStrip } from './ActionRequiredStrip';
import { AIOperatorOverviewCard } from './AIOperatorOverviewCard';
import { DecisionQueuePreview } from './DecisionQueuePreview';
import { dedupeActionItems } from './executiveData';
import { KPIGrid } from './KPIGrid';
import { ManagerScopeBar } from './ManagerScopeBar';
import { fetchManagerSnapshot, type ManagerSnapshot } from './managerSnapshot';
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
      // Only look clickable when there is somewhere to go (M02-011).
      className={`px-4 py-3 rounded-lg transition-colors duration-150 ${
        onClick ? 'hover:bg-slate-50/60 dark:hover:bg-white/[0.03] cursor-pointer' : ''
      }`}
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

  // M02-008: ONE snapshot drives every number on this surface. `null` means
  // "not loaded yet or refused" — never "zero".
  const [snapshot, setSnapshot] = useState<ManagerSnapshot | null>(null);
  const [coherenceFailures, setCoherenceFailures] = useState<string[]>([]);
  const [snapshotDenied, setSnapshotDenied] = useState(false);

  // M02-011: write outcomes for the operator approval queue. `saved` is set
  // only AFTER the post-commit refetch resolves — never optimistically.
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [lastFailedWrite, setLastFailedWrite] = useState<(() => void) | null>(null);

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
    ja: 'ja-JP',
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

        // M02-008 — THE RULE FOR THIS FUNCTION:
        // `fetchManagerSnapshot` is the ONLY source of numbers on this surface.
        // Every other request below fetches CONTENT (rows to render). None of
        // them may contribute a count, a ratio or a headline figure — that is
        // exactly how "Decisions pending 10" ended up being a page size and
        // "0% · 0/1" ended up next to "Overdue 71".
        const [
          snapshotRes,
          decisionsRes,
          teamRes,
          tasksRes,
          analyticsRes,
          signalsRes,
          operatorRes,
        ] = await Promise.allSettled([
          fetchManagerSnapshot('week'),
          Api.get('/my-work/decisions?limit=10&onlyPending=true'),
          Api.get('/my-work/team-workload'),
          Api.getTasks({ assigneeId: user?.id, status: 'todo,in_progress' } as any),
          Api.getExecutiveAnalytics(),
          Api.get('/my-work/signals?limit=5'),
          Api.getAIOperatorOverview(),
        ]);

        // --- Snapshot: every KPI, the health score and the risk level ---
        if (snapshotRes.status === 'fulfilled') {
          const result = snapshotRes.value;
          if (result.status === 'forbidden') {
            setSnapshot(null);
            setSnapshotDenied(true);
            setCoherenceFailures([]);
          } else if (result.status === 'error') {
            setSnapshot(null);
            setSnapshotDenied(false);
            setCoherenceFailures([]);
            setLoadError(
              t('executive.snapshotError', 'Could not read the manager snapshot for this period.')
            );
          } else {
            setSnapshot(result.snapshot);
            setSnapshotDenied(false);
            setCoherenceFailures(result.status === 'incoherent' ? result.failed : []);
          }
        } else {
          setSnapshot(null);
          setSnapshotDenied(false);
          setLoadError(
            t('executive.snapshotError', 'Could not read the manager snapshot for this period.')
          );
        }

        if (operatorRes.status === 'fulfilled' && operatorRes.value) {
          setOperatorOverview(operatorRes.value);
        }

        // --- Decisions: ROWS for the queue preview. The pending/critical
        //     counts shown in the KPI card come from the snapshot, so this
        //     list staying capped at 10 can no longer distort a headline. ---
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

        // --- Team: ROWS for the performance preview (capacity KPI: snapshot) ---
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
        }

        // --- Overdue tasks: ROWS for the action strip (the blocker COUNT
        //     shown on the Risk KPI comes from the snapshot) ---
        if (tasksRes.status === 'fulfilled' && Array.isArray(tasksRes.value)) {
          const overdueTasks = tasksRes.value.filter((task: any) => {
            if (!task.dueDate) return false;
            return new Date(task.dueDate) < new Date();
          });

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

        // --- Initiative progress: ROWS ---
        if (analyticsRes.status === 'fulfilled' && analyticsRes.value) {
          const analytics = analyticsRes.value as any;
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
        }

        // --- AI signals: ROWS ---
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

        try {
          const pRes = await Api.get('/my-work/work-patterns');
          if (pRes) setPatterns(pRes);
        } catch {
          /* ignore */
        }
      } catch {
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

  /**
   * M02-011 — every Manager write goes through here, so the surface reports the
   * same five outcomes everywhere:
   *
   *   saving  → the request is in flight and the button is disabled
   *   saved   → the mutation committed AND the post-commit refetch returned.
   *             `saved` is set after the read-back, never after the POST, so it
   *             cannot claim a write that the server did not keep.
   *   conflict (HTTP 409) → someone wrote first; the only exit is reload-latest
   *   forbidden (HTTP 403) → refused by policy; retry cannot help
   *   error   → anything else; the exact call is stored so Retry re-runs THAT
   *             action rather than a generic refresh
   */
  const runManagerWrite = useCallback(
    async (busyId: string, mutate: () => Promise<unknown>, failureCopy: string) => {
      const attempt = async () => {
        try {
          setOperatorActionBusyId(busyId);
          setSaveStatus('saving');
          await mutate();
          // Fresh read-back BEFORE claiming success.
          await fetchDashboardData(true);
          setSaveStatus('saved');
          setSavedAt(new Date());
          setLastFailedWrite(null);
        } catch (error) {
          const status = (error as { status?: number } | null)?.status;
          if (status === 409) {
            setSaveStatus('conflict');
          } else if (status === 403) {
            setSaveStatus('forbidden');
          } else {
            setSaveStatus('error');
            setLastFailedWrite(() => attempt);
          }
          toast.error(failureCopy);
        } finally {
          setOperatorActionBusyId(null);
        }
      };
      await attempt();
    },
    [fetchDashboardData]
  );

  const handleProposeOperatorIntervention = useCallback(
    (templateKey: string) =>
      runManagerWrite(
        templateKey,
        () => Api.proposeAIOperatorIntervention({ templateKey }),
        t('executive.operator.proposeFailed', 'Failed to propose intervention.')
      ),
    [runManagerWrite, t]
  );

  const handleAcceptOperatorIntervention = useCallback(
    (actionId: string) =>
      runManagerWrite(
        actionId,
        () => Api.acceptAIOperatorIntervention(actionId),
        t('executive.operator.acceptFailed', 'Failed to accept intervention.')
      ),
    [runManagerWrite, t]
  );

  const handleExecuteOperatorIntervention = useCallback(
    (actionId: string) =>
      runManagerWrite(
        actionId,
        () => Api.executeAIOperatorIntervention(actionId),
        t('executive.operator.executeFailed', 'Failed to execute intervention.')
      ),
    [runManagerWrite, t]
  );

  const handleRejectOperatorIntervention = useCallback(
    (actionId: string) =>
      runManagerWrite(
        actionId,
        () => Api.rejectAIOperatorIntervention(actionId),
        t('executive.operator.rejectFailed', 'Failed to reject intervention.')
      ),
    [runManagerWrite, t]
  );

  // The Manager surface is org-wide by nature; a 403 on the snapshot means the
  // viewer is not a manager. That is a permission answer, not a failure, so it
  // gets the `forbidden` state and no retry button.
  if (!loading && snapshotDenied) {
    return (
      <EmptyState
        variant="forbidden"
        title={t('executive.forbidden.title', 'Manager view is not available for your role')}
        description={t(
          'executive.forbidden.description',
          'Portfolio health, team capacity and the approval queue are limited to manager and admin roles.'
        )}
      />
    );
  }

  return (
    <div className="space-y-6">
      {loadError && (
        <div
          role="alert"
          className="rounded-xl border border-danger-200 bg-danger-50 dark:bg-danger-900/20 dark:border-danger-500/30 px-4 py-3 text-sm text-danger-700 dark:text-danger-300 flex flex-wrap items-center justify-between gap-3"
        >
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => fetchDashboardData(true)}
            className="rounded-token-md border border-danger-300 dark:border-danger-500/40 px-2.5 py-1 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            {t('common.retry', 'Try again')}
          </button>
        </div>
      )}

      {/* Header with Greeting */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between gap-4"
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

        <SaveStateIndicator
          status={saveStatus}
          savedAt={savedAt}
          onRetry={lastFailedWrite ?? undefined}
          onReload={() => {
            setSaveStatus('idle');
            fetchDashboardData(true);
          }}
        />
      </motion.div>

      {/* M02-008: one scope + one timestamp for everything below. */}
      <ManagerScopeBar
        snapshot={snapshot}
        coherenceFailures={coherenceFailures}
        refreshing={refreshing}
        onRefresh={() => fetchDashboardData(true)}
      />

      {/* Portfolio Health + KPI Grid Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1">
          <PortfolioHealthScore
            score={snapshot?.health.score ?? 0}
            previousScore={snapshot?.health.previousScore ?? 0}
            trend={snapshot?.health.trend ?? 'stable'}
            breakdown={
              snapshot?.health.breakdown ?? { execution: 0, decisions: 0, capacity: 0, risk: 0 }
            }
            loading={loading}
          />
        </div>

        <div className="xl:col-span-2">
          <KPIGrid snapshot={snapshot} loading={loading} onNavigate={onNavigate} />
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

        {/* M02-011 (no dead actions): `team` has no destination inside My Work,
            so this card is read-only rather than a click that does nothing. */}
        <TeamPerformancePreview members={teamMembers} loading={loading} />

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
            {/* M02-011 (no dead actions): "View all" used to call
                onNavigate('notifications'), which no host handles — and the
                only /notifications route is a SETTINGS page, not this feed. The
                five signals shown here are the whole list, so there is nothing
                to link to. */}
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-0.5">
            {!loading && signals.length > 0 ? (
              signals.map((signal) => <SignalCard key={signal.id} signal={signal} />)
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
