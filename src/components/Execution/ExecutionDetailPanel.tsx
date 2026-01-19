/**
 * ExecutionDetailPanel
 * 
 * Full initiative detail view for execution phase.
 * Replaces placeholder with comprehensive initiative management.
 * 
 * Features:
 * - Full initiative info display
 * - Status change actions
 * - Task checklist with progress
 * - Risk & issue log
 * - Activity timeline
 * - Quick KPI entry
 */

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Flag,
  MessageSquare,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Target,
  TrendingUp,
  User,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import {
  getTransitionActions,
  getModuleForStatus,
  STATUS_METADATA,
} from '../../services/initiativeLifecycle';
import { FullInitiative, InitiativeStatus, TaskStatus } from '../../types';

// ============================================
// TYPES
// ============================================

interface ExecutionDetailPanelProps {
  initiative: FullInitiative;
  onClose: () => void;
  onStatusChange?: (newStatus: InitiativeStatus) => void;
  onRefresh?: () => void;
}

interface TaskItem {
  id: string;
  title: string;
  status: TaskStatus;
  assignee?: string;
  dueDate?: string;
}

interface RiskItem {
  id: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'MITIGATED' | 'CLOSED';
}

interface ActivityItem {
  id: string;
  type: 'status_change' | 'comment' | 'task_completed' | 'risk_added';
  description: string;
  user: string;
  timestamp: string;
}

// ============================================
// HELPER COMPONENTS
// ============================================

const StatusBadge: React.FC<{ status: InitiativeStatus }> = ({ status }) => {
  const metadata = STATUS_METADATA[status];
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${metadata.bgColor} ${metadata.color} border ${metadata.borderColor}`}>
      {metadata.label}
    </span>
  );
};

const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  const colors: Record<string, string> = {
    CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/30',
    HIGH: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    MEDIUM: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    LOW: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };
  
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${colors[priority] || colors.MEDIUM}`}>
      {priority}
    </span>
  );
};

const ProgressBar: React.FC<{ value: number; status: InitiativeStatus }> = ({ value, status }) => {
  const color = status === InitiativeStatus.BLOCKED ? 'bg-red-500' : 'bg-cyan-500';
  
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-navy-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-sm font-medium text-white w-12 text-right">{value}%</span>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const ExecutionDetailPanel: React.FC<ExecutionDetailPanelProps> = ({
  initiative,
  onClose,
  onStatusChange,
  onRefresh,
}) => {
  const { t } = useTranslation();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'risks' | 'activity'>('overview');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  // Mock data - in production, these would come from the API
  const [tasks] = useState<TaskItem[]>([
    { id: '1', title: 'Define requirements', status: TaskStatus.DONE, assignee: 'John D.' },
    { id: '2', title: 'Technical design', status: TaskStatus.DONE, assignee: 'Sarah M.' },
    { id: '3', title: 'Implementation phase 1', status: TaskStatus.IN_PROGRESS, assignee: 'Mike R.', dueDate: '2025-02-15' },
    { id: '4', title: 'Implementation phase 2', status: TaskStatus.TODO, assignee: 'Mike R.', dueDate: '2025-03-01' },
    { id: '5', title: 'Testing & validation', status: TaskStatus.TODO, dueDate: '2025-03-15' },
  ]);

  const [risks] = useState<RiskItem[]>([
    { id: '1', description: 'Resource availability during Q1', severity: 'MEDIUM', status: 'OPEN' },
    { id: '2', description: 'Integration complexity with legacy system', severity: 'HIGH', status: 'MITIGATED' },
  ]);

  const [activities] = useState<ActivityItem[]>([
    { id: '1', type: 'status_change', description: 'Status changed to Executing', user: 'John D.', timestamp: '2025-01-15T10:30:00Z' },
    { id: '2', type: 'task_completed', description: 'Technical design completed', user: 'Sarah M.', timestamp: '2025-01-14T16:45:00Z' },
    { id: '3', type: 'comment', description: 'Added implementation notes', user: 'Mike R.', timestamp: '2025-01-13T09:15:00Z' },
  ]);

  // Get available transitions
  const transitionActions = useMemo(() => {
    return getTransitionActions(initiative.status);
  }, [initiative.status]);

  // Task stats
  const taskStats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === TaskStatus.DONE).length;
    const inProgress = tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length;
    const blocked = tasks.filter((t) => t.status === TaskStatus.BLOCKED).length;
    return { total, completed, inProgress, blocked, percentage: Math.round((completed / total) * 100) };
  }, [tasks]);

  // Handle status change
  const handleStatusChange = useCallback(async (newStatus: InitiativeStatus, reason?: string) => {
    setIsUpdating(true);
    try {
      await Api.patch(`/initiatives/${initiative.id}`, {
        status: newStatus,
        statusChangeReason: reason,
      });
      
      toast.success(`Status changed to ${STATUS_METADATA[newStatus].label}`);
      onStatusChange?.(newStatus);
      onRefresh?.();
    } catch (error) {
      console.error('[ExecutionDetailPanel] Status change failed:', error);
      toast.error('Failed to update status');
    } finally {
      setIsUpdating(false);
      setShowStatusMenu(false);
    }
  }, [initiative.id, onStatusChange, onRefresh]);

  // Render owner info
  const renderOwner = (owner: { firstName?: string; lastName?: string } | undefined, label: string) => {
    if (!owner) return null;
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-navy-700 flex items-center justify-center text-xs text-white">
          {owner.firstName?.[0]}{owner.lastName?.[0]}
        </div>
        <div>
          <div className="text-xs text-slate-500">{label}</div>
          <div className="text-sm text-white">{owner.firstName} {owner.lastName}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-navy-900">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-navy-700 bg-navy-950">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-white truncate">{initiative.name}</h2>
            <p className="text-sm text-slate-400 mt-1 line-clamp-2">{initiative.summary || initiative.description}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-2 text-slate-400 hover:text-white hover:bg-navy-800 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <StatusBadge status={initiative.status} />
          <PriorityBadge priority={initiative.priority} />
          
          {initiative.isCriticalPath && (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
              <Flag size={12} />
              Critical Path
            </span>
          )}

          <div className="ml-auto relative">
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              disabled={isUpdating || transitionActions.length === 0}
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-50 flex items-center gap-2"
            >
              <ArrowRight size={14} />
              Change Status
            </button>

            {showStatusMenu && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-navy-800 border border-navy-700 rounded-lg shadow-xl z-20">
                {transitionActions.map((action) => (
                  <button
                    key={action.toStatus}
                    onClick={() => handleStatusChange(action.toStatus)}
                    className={`w-full px-4 py-2 text-sm text-left hover:bg-navy-700 first:rounded-t-lg last:rounded-b-lg ${
                      action.variant === 'danger' ? 'text-red-400' :
                      action.variant === 'warning' ? 'text-amber-400' :
                      'text-white'
                    }`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 px-6 border-b border-navy-700 flex gap-1">
        {[
          { id: 'overview', label: 'Overview', icon: Target },
          { id: 'tasks', label: 'Tasks', icon: CheckCircle2, count: taskStats.total },
          { id: 'risks', label: 'Risks', icon: AlertTriangle, count: risks.filter((r) => r.status === 'OPEN').length },
          { id: 'activity', label: 'Activity', icon: Activity },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 ${
              activeTab === tab.id
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="px-1.5 py-0.5 text-xs rounded bg-navy-700">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Progress */}
            <div className="bg-navy-800 rounded-xl p-4 border border-navy-700">
              <h3 className="text-sm font-semibold text-white mb-3">Progress</h3>
              <ProgressBar value={initiative.progress || taskStats.percentage} status={initiative.status} />
              <div className="mt-3 grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-white">{taskStats.total}</div>
                  <div className="text-xs text-slate-500">Total Tasks</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">{taskStats.completed}</div>
                  <div className="text-xs text-slate-500">Completed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-cyan-400">{taskStats.inProgress}</div>
                  <div className="text-xs text-slate-500">In Progress</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-400">{taskStats.blocked}</div>
                  <div className="text-xs text-slate-500">Blocked</div>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-navy-800 rounded-xl p-4 border border-navy-700">
              <h3 className="text-sm font-semibold text-white mb-3">Timeline</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Calendar size={16} className="text-slate-500" />
                  <div>
                    <div className="text-xs text-slate-500">Start Date</div>
                    <div className="text-sm text-white">
                      {initiative.plannedStartDate 
                        ? new Date(initiative.plannedStartDate).toLocaleDateString()
                        : 'Not set'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Flag size={16} className="text-slate-500" />
                  <div>
                    <div className="text-xs text-slate-500">End Date</div>
                    <div className="text-sm text-white">
                      {initiative.plannedEndDate 
                        ? new Date(initiative.plannedEndDate).toLocaleDateString()
                        : 'Not set'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Team */}
            <div className="bg-navy-800 rounded-xl p-4 border border-navy-700">
              <h3 className="text-sm font-semibold text-white mb-3">Team</h3>
              <div className="grid grid-cols-2 gap-4">
                {renderOwner(initiative.ownerBusiness, 'Business Owner')}
                {renderOwner(initiative.ownerTechnical, 'Technical Owner')}
                {renderOwner(initiative.ownerExecution, 'Execution Lead')}
              </div>
            </div>

            {/* Budget & ROI */}
            {(initiative.costCapex || initiative.expectedRoi) && (
              <div className="bg-navy-800 rounded-xl p-4 border border-navy-700">
                <h3 className="text-sm font-semibold text-white mb-3">Financials</h3>
                <div className="grid grid-cols-2 gap-4">
                  {initiative.costCapex && (
                    <div>
                      <div className="text-xs text-slate-500">Budget (CAPEX)</div>
                      <div className="text-lg font-bold text-white">
                        {(initiative.costCapex / 1000).toFixed(0)}k PLN
                      </div>
                    </div>
                  )}
                  {initiative.expectedRoi && (
                    <div>
                      <div className="text-xs text-slate-500">Expected ROI</div>
                      <div className="text-lg font-bold text-green-400">
                        {initiative.expectedRoi}x
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Task Checklist</h3>
              <button className="px-3 py-1.5 text-sm font-medium rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 flex items-center gap-1">
                <Plus size={14} />
                Add Task
              </button>
            </div>
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 p-3 bg-navy-800 rounded-lg border border-navy-700 hover:border-navy-600"
              >
                <div className={`w-5 h-5 rounded flex items-center justify-center ${
                  task.status === TaskStatus.DONE ? 'bg-green-500/20' :
                  task.status === TaskStatus.IN_PROGRESS ? 'bg-cyan-500/20' :
                  task.status === TaskStatus.BLOCKED ? 'bg-red-500/20' :
                  'bg-navy-700'
                }`}>
                  {task.status === TaskStatus.DONE && <CheckCircle2 size={14} className="text-green-400" />}
                  {task.status === TaskStatus.IN_PROGRESS && <Play size={12} className="text-cyan-400" />}
                  {task.status === TaskStatus.BLOCKED && <Pause size={12} className="text-red-400" />}
                </div>
                <span className={`flex-1 text-sm ${task.status === TaskStatus.DONE ? 'text-slate-500 line-through' : 'text-white'}`}>
                  {task.title}
                </span>
                {task.assignee && (
                  <span className="text-xs text-slate-500">{task.assignee}</span>
                )}
                {task.dueDate && (
                  <span className="text-xs text-slate-500">
                    {new Date(task.dueDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'risks' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Risks & Issues</h3>
              <button className="px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 flex items-center gap-1">
                <Plus size={14} />
                Add Risk
              </button>
            </div>
            {risks.map((risk) => (
              <div
                key={risk.id}
                className={`p-3 rounded-lg border ${
                  risk.status === 'OPEN' ? 'bg-red-500/10 border-red-500/30' :
                  risk.status === 'MITIGATED' ? 'bg-amber-500/10 border-amber-500/30' :
                  'bg-navy-800 border-navy-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className={
                      risk.severity === 'CRITICAL' ? 'text-red-400' :
                      risk.severity === 'HIGH' ? 'text-orange-400' :
                      risk.severity === 'MEDIUM' ? 'text-amber-400' :
                      'text-slate-400'
                    } />
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      risk.status === 'OPEN' ? 'bg-red-500/20 text-red-400' :
                      risk.status === 'MITIGATED' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-green-500/20 text-green-400'
                    }`}>
                      {risk.status}
                    </span>
                  </div>
                  <span className={`text-xs font-medium ${
                    risk.severity === 'CRITICAL' ? 'text-red-400' :
                    risk.severity === 'HIGH' ? 'text-orange-400' :
                    risk.severity === 'MEDIUM' ? 'text-amber-400' :
                    'text-slate-400'
                  }`}>
                    {risk.severity}
                  </span>
                </div>
                <p className="mt-2 text-sm text-white">{risk.description}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white mb-4">Activity Timeline</h3>
            {activities.map((activity, idx) => (
              <div key={activity.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    activity.type === 'status_change' ? 'bg-purple-500/20' :
                    activity.type === 'task_completed' ? 'bg-green-500/20' :
                    activity.type === 'risk_added' ? 'bg-red-500/20' :
                    'bg-navy-700'
                  }`}>
                    {activity.type === 'status_change' && <ArrowRight size={14} className="text-purple-400" />}
                    {activity.type === 'task_completed' && <CheckCircle2 size={14} className="text-green-400" />}
                    {activity.type === 'risk_added' && <AlertTriangle size={14} className="text-red-400" />}
                    {activity.type === 'comment' && <MessageSquare size={14} className="text-slate-400" />}
                  </div>
                  {idx < activities.length - 1 && (
                    <div className="w-px h-full bg-navy-700 my-1" />
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <p className="text-sm text-white">{activity.description}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                    <span>{activity.user}</span>
                    <span>•</span>
                    <span>{new Date(activity.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExecutionDetailPanel;
