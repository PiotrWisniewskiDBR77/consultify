/**
 * CorrectiveActions Component
 *
 * PMO Corrective Actions Management
 *
 * Standards Compliance:
 * - ISO 21500:2021 - Corrective Action (Clause 4.5.4)
 * - PMI PMBOK 7th Edition - Corrective Action / Variance Response
 * - PRINCE2 - Issue Resolution
 *
 * PMO Domain: PERFORMANCE_MONITORING
 */

import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Plus,
  Target,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { EmptyState } from '@/components/ui/composed/EmptyState';
import { LoadingState } from '@/components/ui/primitives';

export type ActionStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type ActionPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface CorrectiveAction {
  id: string;
  title: string;
  description: string;
  status: ActionStatus;
  priority: ActionPriority;
  linkedKPIId?: string;
  linkedKPIName?: string;
  assignee?: {
    id: string;
    name: string;
  };
  dueDate: string;
  createdDate: string;
  completedDate?: string;
  expectedImpact: string;
  actualImpact?: string;
  rootCause?: string;
  steps?: string[];
}

interface CorrectiveActionsProps {
  // CB-03 Codex pass 2: NOT guessed by callers — a real project/initiative id
  // (e.g. the URL's `?initiativeId=`) or omitted entirely. This component
  // never fabricates one (no org id, no 'all' sentinel): without a real id it
  // renders an honest "no project context" unavailable state instead of
  // calling the service with a made-up identity.
  projectId?: string;
  actions?: CorrectiveAction[];
  onCreateAction?: () => void;
  onUpdateAction?: (actionId: string, updates: Partial<CorrectiveAction>) => void;
}

type LoadState = 'loading' | 'no-context' | 'error' | 'loaded';

const STATUS_CONFIG: Record<
  ActionStatus,
  { color: string; bgColor: string; icon: React.ReactNode; label: string }
> = {
  OPEN: {
    color: 'text-amber-600',
    bgColor: 'bg-amber-100 dark:bg-amber-900/20',
    icon: <AlertTriangle size={14} />,
    label: 'Open',
  },
  IN_PROGRESS: {
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/20',
    icon: <Clock size={14} />,
    label: 'In Progress',
  },
  COMPLETED: {
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/20',
    icon: <CheckCircle2 size={14} />,
    label: 'Completed',
  },
  CANCELLED: {
    color: 'text-slate-500 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
    icon: <X size={14} />,
    label: 'Cancelled',
  },
};

const PRIORITY_COLORS: Record<ActionPriority, string> = {
  CRITICAL: 'bg-danger-500 text-white',
  HIGH: 'bg-amber-500 text-white',
  MEDIUM: 'bg-amber-400 text-amber-900',
  LOW: 'bg-green-400 text-green-900',
};

export const CorrectiveActions: React.FC<CorrectiveActionsProps> = ({
  projectId,
  actions = [],
  onCreateAction,
  onUpdateAction,
}) => {
  const [filter, setFilter] = useState<'all' | ActionStatus>('all');
  const [selectedAction, setSelectedAction] = useState<CorrectiveAction | null>(null);
  const [localActions, setLocalActions] = useState<CorrectiveAction[]>(actions);
  // CB-03 Codex pass 2: a service failure (non-2xx, network error) is a
  // distinct `error` state, never silently folded into `[]` + the "on track"
  // empty-state copy — that previously made an outage indistinguishable from
  // a genuinely healthy queue. `no-context` fires only when no real project
  // id was supplied at all (nothing to even call).
  const [loadState, setLoadState] = useState<LoadState>(
    actions.length > 0 ? 'loaded' : projectId ? 'loading' : 'no-context'
  );
  const [retryNonce, setRetryNonce] = useState(0);

  const fetchActions = useCallback(async (pid: string) => {
    setLoadState('loading');
    try {
      const response = await fetch(`/api/pmo/projects/${pid}/corrective-actions`);
      if (!response.ok) {
        setLoadState('error');
        return;
      }
      const data = await response.json();
      setLocalActions(Array.isArray(data) ? data : data?.actions || []);
      setLoadState('loaded');
    } catch {
      console.warn('[CorrectiveActions] Failed to reach the corrective-action service');
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    if (actions.length > 0) {
      setLocalActions(actions);
      setLoadState('loaded');
      return;
    }
    if (!projectId) {
      setLoadState('no-context');
      return;
    }
    void fetchActions(projectId);
    // `actions.length` (not `actions`) — the `actions = []` default parameter
    // is a NEW array reference on every render, which would otherwise re-run
    // this effect (and re-fetch) on every state update this component makes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, actions.length, fetchActions, retryNonce]);

  const filteredActions =
    filter === 'all' ? localActions : localActions.filter((a) => a.status === filter);

  // Summary stats
  const stats = {
    total: localActions.length,
    open: localActions.filter((a) => a.status === 'OPEN').length,
    inProgress: localActions.filter((a) => a.status === 'IN_PROGRESS').length,
    completed: localActions.filter((a) => a.status === 'COMPLETED').length,
    overdue: localActions.filter(
      (a) => (a.status === 'OPEN' || a.status === 'IN_PROGRESS') && new Date(a.dueDate) < new Date()
    ).length,
  };

  const isOverdue = (action: CorrectiveAction) => {
    return (
      (action.status === 'OPEN' || action.status === 'IN_PROGRESS') &&
      new Date(action.dueDate) < new Date()
    );
  };

  if (loadState === 'loading') {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
            <Target className="text-danger-500" size={24} />
            Corrective Actions
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Loading actions...</p>
        </div>
        <LoadingState variant="spinner" label="Loading actions..." />
      </div>
    );
  }

  // CB-03 Codex pass 2: no real project/initiative id was supplied — do not
  // guess one (no org id, no 'all'). Distinct from both the loading and the
  // "on track" empty state: this tells the user WHY nothing loaded instead of
  // implying their KPIs are healthy.
  if (loadState === 'no-context') {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
            <Target className="text-danger-500" size={24} />
            Corrective Actions
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track and manage remediation activities for off-target KPIs
          </p>
        </div>
        <EmptyState
          icon={<AlertTriangle />}
          title="No project context"
          description="Corrective Action needs a specific initiative or project. Open it from an initiative to use this tool."
        />
      </div>
    );
  }

  // CB-03 Codex pass 2: the request failed (non-2xx or network error) — a
  // distinct, retryable unavailable state, never silently mapped to the
  // healthy-empty copy below.
  if (loadState === 'error') {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
            <Target className="text-danger-500" size={24} />
            Corrective Actions
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track and manage remediation activities for off-target KPIs
          </p>
        </div>
        <EmptyState
          icon={<AlertTriangle />}
          title="Corrective Action is unavailable"
          description="The corrective-action service could not be reached. Your KPI status is unaffected — try again."
          action={{
            label: 'Retry',
            onClick: () => setRetryNonce((n) => n + 1),
          }}
        />
      </div>
    );
  }

  if (localActions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
              <Target className="text-danger-500" size={24} />
              Corrective Actions
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Track and manage remediation activities for off-target KPIs
            </p>
          </div>
          <button
            onClick={onCreateAction}
            disabled={!onCreateAction}
            title={
              onCreateAction
                ? undefined
                : 'Not available yet — no corrective-action service is connected'
            }
            className="flex items-center gap-2 px-4 py-2 bg-danger-600 hover:bg-danger-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
            New Action
          </button>
        </div>
        <EmptyState
          icon={<CheckCircle2 />}
          title="No corrective actions"
          description="All KPIs are on track. Actions will appear here when needed."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
            <Target className="text-danger-500" size={24} />
            Corrective Actions
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track and manage remediation activities for off-target KPIs
          </p>
        </div>
        <button
          onClick={onCreateAction}
          disabled={!onCreateAction}
          title={
            onCreateAction
              ? undefined
              : 'Not available yet — no corrective-action service is connected'
          }
          className="flex items-center gap-2 px-4 py-2 bg-danger-600 hover:bg-danger-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={16} />
          New Action
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Actions</div>
          <div className="text-2xl font-bold text-navy-900 dark:text-white">{stats.total}</div>
        </div>
        <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Open</div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.open}</div>
        </div>
        <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">In Progress</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {stats.inProgress}
          </div>
        </div>
        <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Completed</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {stats.completed}
          </div>
        </div>
        <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Overdue</div>
          <div
            className={`text-2xl font-bold ${stats.overdue > 0 ? 'text-danger-600' : 'text-green-600'}`}
          >
            {stats.overdue}
          </div>
        </div>
      </div>

      {/* Overdue Alert */}
      {stats.overdue > 0 && (
        <div className="flex items-start gap-3 p-4 bg-danger-50 dark:bg-danger-900/10 border border-danger-200 dark:border-danger-500/20 rounded-xl">
          <AlertTriangle size={20} className="text-danger-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-danger-700 dark:text-danger-300">
              {stats.overdue} corrective action{stats.overdue > 1 ? 's are' : ' is'} overdue
            </p>
            <p className="text-xs text-danger-600/70 dark:text-danger-400/70 mt-1">
              Escalation may be required. Review priority and reassign if needed.
            </p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-navy-700 pb-2">
        {(['all', 'OPEN', 'IN_PROGRESS', 'COMPLETED'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === status
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800'
            }`}
          >
            {status === 'all' ? 'All' : STATUS_CONFIG[status].label}
          </button>
        ))}
      </div>

      {/* Actions List */}
      <div className="space-y-3">
        {filteredActions.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400 dark:text-slate-500">
            <Target size={48} className="mx-auto mb-4 opacity-50" />
            <p>No corrective actions found</p>
          </div>
        ) : (
          filteredActions.map((action) => {
            const statusConfig = STATUS_CONFIG[action.status];
            const overdue = isOverdue(action);

            return (
              <div
                key={action.id}
                className={`bg-white dark:bg-navy-900 rounded-xl border-2 p-4 transition-all cursor-pointer hover:border-primary-300 dark:hover:border-primary-500/30 ${
                  overdue
                    ? 'border-danger-300 dark:border-danger-500/30'
                    : 'border-slate-200 dark:border-navy-700'
                }`}
                onClick={() => setSelectedAction(selectedAction?.id === action.id ? null : action)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${PRIORITY_COLORS[action.priority]}`}
                      >
                        {action.priority}
                      </span>
                      <span
                        className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
                      >
                        {statusConfig.icon}
                        {statusConfig.label}
                      </span>
                      {overdue && (
                        <span className="px-2 py-0.5 bg-danger-100 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 rounded text-xs font-bold">
                          OVERDUE
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-navy-900 dark:text-white">{action.title}</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {action.description}
                    </p>

                    {/* Meta Info */}
                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 dark:text-slate-400">
                      {action.assignee && (
                        <span className="flex items-center gap-1">
                          <User size={12} />
                          {action.assignee.name}
                        </span>
                      )}
                      <span
                        className={`flex items-center gap-1 ${overdue ? 'text-danger-500' : ''}`}
                      >
                        <Calendar size={12} />
                        Due: {new Date(action.dueDate).toLocaleDateString()}
                      </span>
                      {action.linkedKPIName && (
                        <span className="flex items-center gap-1">
                          <TrendingUp size={12} className="text-primary-500" />
                          {action.linkedKPIName}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight
                    size={20}
                    className={`text-slate-500 dark:text-slate-400 dark:text-slate-500 transition-transform ${
                      selectedAction?.id === action.id ? 'rotate-90' : ''
                    }`}
                  />
                </div>

                {/* Expanded Details */}
                {selectedAction?.id === action.id && (
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-navy-700 space-y-4">
                    {action.rootCause && (
                      <div>
                        <h5 className="text-sm font-medium text-navy-900 dark:text-white mb-1">
                          Root Cause
                        </h5>
                        <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-navy-950 p-3 rounded-lg">
                          {action.rootCause}
                        </p>
                      </div>
                    )}

                    <div>
                      <h5 className="text-sm font-medium text-navy-900 dark:text-white mb-1">
                        Expected Impact
                      </h5>
                      <p className="text-sm text-slate-600 dark:text-slate-300 bg-green-50 dark:bg-green-900/10 p-3 rounded-lg">
                        {action.expectedImpact}
                      </p>
                    </div>

                    {action.actualImpact && (
                      <div>
                        <h5 className="text-sm font-medium text-navy-900 dark:text-white mb-1">
                          Actual Impact
                        </h5>
                        <p className="text-sm text-slate-600 dark:text-slate-300 bg-primary-50 dark:bg-primary-900/10 p-3 rounded-lg">
                          {action.actualImpact}
                        </p>
                      </div>
                    )}

                    {action.steps && action.steps.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-navy-900 dark:text-white mb-2">
                          Action Steps
                        </h5>
                        <ul className="space-y-2">
                          {action.steps.map((step, i) => (
                            <li
                              key={i}
                              className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
                            >
                              <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-navy-800 flex items-center justify-center text-xs font-bold">
                                {i + 1}
                              </span>
                              {step}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {action.status !== 'COMPLETED' && action.status !== 'CANCELLED' && (
                      <div className="flex gap-2 justify-end">
                        {action.status === 'OPEN' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateAction?.(action.id, { status: 'IN_PROGRESS' });
                            }}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                          >
                            Start Action
                          </button>
                        )}
                        {action.status === 'IN_PROGRESS' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateAction?.(action.id, {
                                status: 'COMPLETED',
                                completedDate: new Date().toISOString(),
                              });
                            }}
                            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors"
                          >
                            Mark Complete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
