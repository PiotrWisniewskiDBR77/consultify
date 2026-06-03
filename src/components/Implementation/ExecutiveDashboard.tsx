/**
 * ExecutiveDashboard
 *
 * Executive-level overview for the Implementation module.
 * Shows KPI tiles, initiative progress, alerts, and milestones.
 *
 * PMO Standards Compliance:
 * - ISO 21500:2021 - Portfolio Performance (Clause 4.5)
 * - PMI PMBOK 7th Edition - Measurement Performance Domain
 * - PRINCE2 - Highlight Reporting
 *
 * PMO Domain: PERFORMANCE_MONITORING, GOVERNANCE_DECISION_MAKING
 */

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  FileCheck,
  Loader2,
  Pause,
  RefreshCw,
  Rocket,
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { Api } from '../../services/api';
import { getStatusesForModule } from '../../services/initiativeLifecycle';
import { Initiative, InitiativeStatus } from '../../types';

interface ExecutiveDashboardProps {
  onInitiativeClick?: (initiative: Initiative) => void;
  onViewAllClick?: () => void;
}

interface DashboardMetrics {
  totalActive: number;
  onTrack: number;
  atRisk: number;
  blocked: number;
  completedThisMonth: number;
  avgProgress: number;
  overdueTasks: number;
  pendingDecisions: number;
  highRiskItems: number;
  budgetHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'OVERRUN';
  portfolioBudgetConsumed: number;
}

interface Alert {
  type: 'blocked' | 'risk' | 'decision' | 'task' | 'budget';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  initiativeId?: string;
}

const AUTO_REFRESH_INTERVAL = 60000; // 60 seconds

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  onInitiativeClick,
  onViewAllClick,
}) => {
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalActive: 0,
    onTrack: 0,
    atRisk: 0,
    blocked: 0,
    completedThisMonth: 0,
    avgProgress: 0,
    overdueTasks: 0,
    pendingDecisions: 0,
    highRiskItems: 0,
    budgetHealth: 'HEALTHY',
    portfolioBudgetConsumed: 0,
  });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch all dashboard data
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setIsRefreshing(true);

    try {
      const executionStatuses = getStatusesForModule('execution');
      const statusParam = (
        executionStatuses.length
          ? executionStatuses
          : [InitiativeStatus.EXECUTING, InitiativeStatus.BLOCKED]
      ).join(',');

      // Fetch all data in parallel
      const [initiativesRes, decisionsRes, raidRes, budgetRes] = await Promise.all([
        Api.get(`/initiatives/by-status/${statusParam}`).catch(() => ({ initiatives: [] })),
        Api.get('/decisions').catch(() => []),
        Api.get('/raid/summary').catch(() => ({
          openCount: 0,
          highPriorityCount: 0,
          overdueCount: 0,
        })),
        Api.get('/budget/portfolio/summary').catch(() => ({ summary: null })),
      ]);

      const inits = initiativesRes.initiatives || [];
      setInitiatives(inits);

      // Calculate initiative metrics
      const blocked = inits.filter((i: Initiative) => i.status === 'BLOCKED');
      const executing = inits.filter((i: Initiative) => i.status === 'EXECUTING');
      const atRisk = executing.filter((i: Initiative) => {
        if (!i.plannedEndDate) return false;
        const daysToEnd = Math.floor(
          (new Date(i.plannedEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        return daysToEnd < 14 && (i.progress || 0) < 80;
      });
      const avgProgress =
        executing.length > 0
          ? Math.round(
              executing.reduce((sum: number, i: Initiative) => sum + (i.progress || 0), 0) /
                executing.length
            )
          : 0;

      // Process decisions
      const decisionsList = Array.isArray(decisionsRes) ? decisionsRes : [];
      const pendingDecisions = decisionsList.filter((d: any) =>
        ['PENDING', 'ESCALATED'].includes(d.status)
      ).length;
      const blockingDecisions = decisionsList.filter(
        (d: any) => d.priority === 'CRITICAL' || d.priority === 'HIGH'
      ).length;

      // Process RAID
      const raidSummary = raidRes;
      const highRiskItems = raidSummary.highPriorityCount || 0;

      // Process budget
      const budgetSummary = budgetRes.summary;
      let budgetHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'OVERRUN' = 'HEALTHY';
      let portfolioBudgetConsumed = 0;

      if (budgetSummary) {
        portfolioBudgetConsumed = budgetSummary.totals?.consumedPercent || 0;
        if (budgetSummary.healthCounts?.overrun > 0) budgetHealth = 'OVERRUN';
        else if (budgetSummary.healthCounts?.critical > 0) budgetHealth = 'CRITICAL';
        else if (budgetSummary.healthCounts?.warning > 0) budgetHealth = 'WARNING';
      }

      setMetrics({
        totalActive: inits.length,
        onTrack: executing.length - atRisk.length,
        atRisk: atRisk.length,
        blocked: blocked.length,
        completedThisMonth: 0,
        avgProgress,
        overdueTasks: raidSummary.overdueCount || 0,
        pendingDecisions,
        highRiskItems,
        budgetHealth,
        portfolioBudgetConsumed,
      });

      // Generate alerts
      const newAlerts: Alert[] = [];

      // Blocked initiatives - critical
      blocked.forEach((i: Initiative) => {
        newAlerts.push({
          type: 'blocked',
          severity: 'critical',
          message: `${i.name} is blocked: ${i.blockedReason || 'No reason specified'}`,
          initiativeId: i.id,
        });
      });

      // At-risk initiatives - warning
      atRisk.forEach((i: Initiative) => {
        newAlerts.push({
          type: 'risk',
          severity: 'warning',
          message: `${i.name} at risk - deadline approaching with ${i.progress}% progress`,
          initiativeId: i.id,
        });
      });

      // Blocking decisions - warning
      if (blockingDecisions > 0) {
        newAlerts.push({
          type: 'decision',
          severity: 'warning',
          message: `${blockingDecisions} high-priority decisions awaiting approval`,
        });
      }

      // Budget alerts - warning/critical
      if (budgetHealth === 'OVERRUN') {
        newAlerts.push({
          type: 'budget',
          severity: 'critical',
          message: 'Budget overrun detected in portfolio',
        });
      } else if (budgetHealth === 'CRITICAL') {
        newAlerts.push({
          type: 'budget',
          severity: 'warning',
          message: 'Portfolio budget approaching critical threshold',
        });
      }

      // High-risk RAID items
      if (highRiskItems > 0) {
        newAlerts.push({
          type: 'risk',
          severity: highRiskItems >= 3 ? 'critical' : 'warning',
          message: `${highRiskItems} high-priority risks/issues require attention`,
        });
      }

      // Sort alerts by severity
      newAlerts.sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });

      setAlerts(newAlerts);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('[ExecutiveDashboard] Error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(true); // Silent refresh
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchData]);

  // Group initiatives by status
  const executingInitiatives = initiatives.filter((i) => i.status === 'EXECUTING');
  const blockedInitiatives = initiatives.filter((i) => i.status === 'BLOCKED');

  const getBudgetHealthColor = (health: string) => {
    switch (health) {
      case 'HEALTHY':
        return 'text-green-600 dark:text-green-400';
      case 'WARNING':
        return 'text-amber-600 dark:text-amber-400';
      case 'CRITICAL':
        return 'text-amber-600 dark:text-amber-400';
      case 'OVERRUN':
        return 'text-rose-600 dark:text-rose-400';
      default:
        return 'text-slate-600 dark:text-slate-400';
    }
  };

  const getBudgetHealthBg = (health: string) => {
    switch (health) {
      case 'HEALTHY':
        return 'bg-green-100 dark:bg-green-900/30';
      case 'WARNING':
        return 'bg-amber-100 dark:bg-amber-900/30';
      case 'CRITICAL':
        return 'bg-amber-100 dark:bg-amber-900/30';
      case 'OVERRUN':
        return 'bg-rose-100 dark:bg-rose-900/30';
      default:
        return 'bg-slate-100 dark:bg-slate-800';
    }
  };

  const getAlertIcon = (alert: Alert) => {
    switch (alert.type) {
      case 'blocked':
        return <Pause size={16} />;
      case 'risk':
        return <AlertTriangle size={16} />;
      case 'decision':
        return <FileCheck size={16} />;
      case 'task':
        return <Clock size={16} />;
      case 'budget':
        return <DollarSign size={16} />;
      default:
        return <AlertCircle size={16} />;
    }
  };

  const getAlertColors = (alert: Alert) => {
    if (alert.severity === 'critical') {
      return {
        bg: 'bg-rose-100 dark:bg-rose-900/30 hover:bg-rose-200 dark:hover:bg-rose-900/50',
        icon: 'text-rose-600 dark:text-rose-400',
      };
    }
    return {
      bg: 'bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50',
      icon: 'text-amber-600 dark:text-amber-400',
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="text-primary-500" size={24} />
            Executive Dashboard
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Last updated: {lastRefresh.toLocaleTimeString('pl-PL')}
          </p>
        </div>
        <button
          onClick={() => fetchData()}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 rounded-lg text-sm transition-colors"
        >
          <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Primary KPI Tiles */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Active Initiatives
              </p>
              <p className="text-3xl font-bold text-navy-900 dark:text-white mt-1">
                {metrics.totalActive}
              </p>
            </div>
            <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
              <Rocket className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs">
            <span className="text-green-600 dark:text-green-400 font-medium">
              {metrics.onTrack} on track
            </span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              {metrics.atRisk} at risk
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Average Progress
              </p>
              <p className="text-3xl font-bold text-navy-900 dark:text-white mt-1">
                {metrics.avgProgress}%
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
              <Activity className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="mt-3">
            <div className="h-2 bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${metrics.avgProgress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Blocked
              </p>
              <p
                className={`text-3xl font-bold mt-1 ${
                  metrics.blocked > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-navy-900 dark:text-white'
                }`}
              >
                {metrics.blocked}
              </p>
            </div>
            <div
              className={`p-3 rounded-xl ${
                metrics.blocked > 0
                  ? 'bg-rose-100 dark:bg-rose-900/30 animate-pulse'
                  : 'bg-slate-100 dark:bg-slate-800'
              }`}
            >
              <Pause
                className={`w-6 h-6 ${
                  metrics.blocked > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
                }`}
              />
            </div>
          </div>
          {metrics.blocked > 0 && (
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-3">
              Requires immediate attention
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                At Risk
              </p>
              <p
                className={`text-3xl font-bold mt-1 ${
                  metrics.atRisk > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-navy-900 dark:text-white'
                }`}
              >
                {metrics.atRisk}
              </p>
            </div>
            <div
              className={`p-3 rounded-xl ${
                metrics.atRisk > 0
                  ? 'bg-amber-100 dark:bg-amber-900/30'
                  : 'bg-slate-100 dark:bg-slate-800'
              }`}
            >
              <AlertTriangle
                className={`w-6 h-6 ${
                  metrics.atRisk > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'
                }`}
              />
            </div>
          </div>
          {metrics.atRisk > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">Deadline approaching</p>
          )}
        </div>
      </div>

      {/* Secondary KPI Tiles */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Pending Decisions
              </p>
              <p
                className={`text-3xl font-bold mt-1 ${
                  metrics.pendingDecisions > 0
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-navy-900 dark:text-white'
                }`}
              >
                {metrics.pendingDecisions}
              </p>
            </div>
            <div
              className={`p-3 rounded-xl ${
                metrics.pendingDecisions > 0
                  ? 'bg-blue-100 dark:bg-blue-900/30'
                  : 'bg-slate-100 dark:bg-slate-800'
              }`}
            >
              <FileCheck
                className={`w-6 h-6 ${
                  metrics.pendingDecisions > 0
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-400'
                }`}
              />
            </div>
          </div>
          {metrics.pendingDecisions > 3 && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-3">
              Backlog growing - review needed
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                High-Risk Items
              </p>
              <p
                className={`text-3xl font-bold mt-1 ${
                  metrics.highRiskItems > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-navy-900 dark:text-white'
                }`}
              >
                {metrics.highRiskItems}
              </p>
            </div>
            <div
              className={`p-3 rounded-xl ${
                metrics.highRiskItems > 0
                  ? 'bg-amber-100 dark:bg-amber-900/30'
                  : 'bg-slate-100 dark:bg-slate-800'
              }`}
            >
              <Shield
                className={`w-6 h-6 ${
                  metrics.highRiskItems > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              />
            </div>
          </div>
          {metrics.highRiskItems > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
              Risks/issues need attention
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Budget Health
              </p>
              <p
                className={`text-3xl font-bold mt-1 ${getBudgetHealthColor(metrics.budgetHealth)}`}
              >
                {metrics.portfolioBudgetConsumed}%
              </p>
            </div>
            <div className={`p-3 rounded-xl ${getBudgetHealthBg(metrics.budgetHealth)}`}>
              <DollarSign className={`w-6 h-6 ${getBudgetHealthColor(metrics.budgetHealth)}`} />
            </div>
          </div>
          <p className={`text-xs mt-3 ${getBudgetHealthColor(metrics.budgetHealth)}`}>
            {metrics.budgetHealth === 'HEALTHY' && 'Portfolio on budget'}
            {metrics.budgetHealth === 'WARNING' && 'Approaching threshold'}
            {metrics.budgetHealth === 'CRITICAL' && 'Near budget limit'}
            {metrics.budgetHealth === 'OVERRUN' && 'Budget exceeded!'}
          </p>
        </div>

        <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Overdue Items
              </p>
              <p
                className={`text-3xl font-bold mt-1 ${
                  metrics.overdueTasks > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-navy-900 dark:text-white'
                }`}
              >
                {metrics.overdueTasks}
              </p>
            </div>
            <div
              className={`p-3 rounded-xl ${
                metrics.overdueTasks > 0
                  ? 'bg-rose-100 dark:bg-rose-900/30'
                  : 'bg-slate-100 dark:bg-slate-800'
              }`}
            >
              <Clock
                className={`w-6 h-6 ${
                  metrics.overdueTasks > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
                }`}
              />
            </div>
          </div>
          {metrics.overdueTasks > 0 && (
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-3">Past due date</p>
          )}
        </div>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="bg-rose-50 dark:bg-rose-900/20 rounded-xl p-4 border border-rose-200 dark:border-rose-500/20">
          <h3 className="font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-2 mb-3">
            <AlertCircle size={18} />
            Alerts ({alerts.length})
          </h3>
          <div className="space-y-2">
            {alerts.slice(0, 5).map((alert, idx) => {
              const colors = getAlertColors(alert);
              return (
                <div
                  key={idx}
                  onClick={() =>
                    alert.initiativeId &&
                    onInitiativeClick?.(initiatives.find((i) => i.id === alert.initiativeId)!)
                  }
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${colors.bg}`}
                >
                  <span className={colors.icon}>{getAlertIcon(alert)}</span>
                  <span className="text-sm text-slate-700 dark:text-slate-200 flex-1">
                    {alert.message}
                  </span>
                  {alert.initiativeId && (
                    <ArrowRight size={14} className="text-slate-400 dark:text-slate-500" />
                  )}
                </div>
              );
            })}
          </div>
          {alerts.length > 5 && (
            <button className="mt-3 text-sm text-rose-600 dark:text-rose-400 hover:underline">
              View all {alerts.length} alerts
            </button>
          )}
        </div>
      )}

      {/* Initiative Status Overview */}
      <div className="grid grid-cols-2 gap-6">
        {/* Executing */}
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <div className="px-4 py-3 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-200 dark:border-primary-500/20">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-primary-700 dark:text-primary-400 flex items-center gap-2">
                <Rocket size={18} />
                In Execution ({executingInitiatives.length})
              </h3>
              {onViewAllClick && (
                <button
                  onClick={onViewAllClick}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                >
                  View all
                </button>
              )}
            </div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-64 overflow-y-auto">
            {executingInitiatives.length === 0 ? (
              <div className="p-6 text-center text-slate-400 dark:text-slate-500">
                No initiatives in execution
              </div>
            ) : (
              executingInitiatives.map((init) => (
                <div
                  key={init.id}
                  onClick={() => onInitiativeClick?.(init)}
                  className="p-3 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-navy-900 dark:text-white text-sm truncate">
                      {init.name}
                    </span>
                    <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                      {init.progress || 0}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full transition-all"
                      style={{ width: `${init.progress || 0}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Blocked */}
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <div className="px-4 py-3 bg-rose-50 dark:bg-rose-900/20 border-b border-rose-200 dark:border-rose-500/20">
            <h3 className="font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-2">
              <Pause size={18} />
              Blocked ({blockedInitiatives.length})
            </h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-64 overflow-y-auto">
            {blockedInitiatives.length === 0 ? (
              <div className="p-6 text-center text-green-500 flex flex-col items-center">
                <CheckCircle2 size={24} className="mb-2" />
                <span>No blocked initiatives</span>
              </div>
            ) : (
              blockedInitiatives.map((init) => (
                <div
                  key={init.id}
                  onClick={() => onInitiativeClick?.(init)}
                  className="p-3 hover:bg-rose-50 dark:hover:bg-rose-900/20 cursor-pointer"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} className="text-rose-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-navy-900 dark:text-white text-sm">
                        {init.name}
                      </p>
                      <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                        {init.blockedReason || 'Reason not specified'}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveDashboard;
