/**
 * Initiative Side Panel
 *
 * Slide-in panel with tabbed initiative details.
 * Includes Tasks and Decisions tabs with hierarchical navigation.
 */

import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Clock,
  DollarSign,
  Edit2,
  ExternalLink,
  FileText,
  Loader2,
  Scale,
  Target,
  TrendingUp,
  User,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { getAxisColor, getPriorityClasses, getStatusClasses } from '../../config/portfolioColors';
import { Api } from '../../services/api';
import { InitiativeStatus, PortfolioInitiative, Task, User as UserType } from '../../types';
import { DecisionDetailModal } from '../MyWork/DecisionDetailModal';
import { TaskDetailModal } from '../TaskDetailModal';

// Decision type for this component
interface Decision {
  id: string;
  title: string;
  description?: string;
  decisionType: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DEFERRED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdAt: string;
  dueDate?: string;
  ownerName?: string;
  relatedObjectType?: string;
  relatedObjectId?: string;
  relatedObjectName?: string;
}

interface InitiativeSidePanelProps {
  initiative: PortfolioInitiative | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updated: PortfolioInitiative) => void;
  onOpenFullDetail?: (initiative: PortfolioInitiative) => void;
  users?: UserType[];
  currentUser?: UserType | null;
}

type TabId = 'overview' | 'tasks' | 'decisions' | 'financials' | 'stakeholders' | 'risks';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <FileText size={16} /> },
  { id: 'tasks', label: 'Tasks', icon: <CheckSquare size={16} /> },
  { id: 'decisions', label: 'Decisions', icon: <Scale size={16} /> },
  { id: 'financials', label: 'Financials', icon: <DollarSign size={16} /> },
  { id: 'stakeholders', label: 'Stakeholders', icon: <Users size={16} /> },
  { id: 'risks', label: 'Risks', icon: <AlertTriangle size={16} /> },
];

export const InitiativeSidePanel: React.FC<InitiativeSidePanelProps> = ({
  initiative,
  isOpen,
  onClose,
  onUpdate,
  onOpenFullDetail,
  users = [],
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Tasks state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskFilter, setTaskFilter] = useState<'all' | 'todo' | 'in_progress' | 'completed'>('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Decisions state
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [decisionsLoading, setDecisionsLoading] = useState(false);
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);

  // Reset tab when initiative changes
  useEffect(() => {
    if (initiative) {
      setActiveTab('overview');
      setTasks([]);
      setDecisions([]);
    }
  }, [initiative?.id]);

  // Fetch tasks when Tasks tab is active
  const fetchTasks = useCallback(async () => {
    if (!initiative?.id) return;
    setTasksLoading(true);
    try {
      const data = await Api.getTasks({ initiativeId: initiative.id });
      setTasks(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('[InitiativeSidePanel] Failed to fetch tasks:', error);
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, [initiative?.id]);

  // Fetch decisions when Decisions tab is active
  const fetchDecisions = useCallback(async () => {
    if (!initiative?.id) return;
    setDecisionsLoading(true);
    try {
      const response = await Api.get(
        `/decisions?relatedObjectId=${initiative.id}&relatedObjectType=INITIATIVE`
      );
      setDecisions(Array.isArray(response) ? response : response?.decisions || []);
    } catch (error: any) {
      console.error('[InitiativeSidePanel] Failed to fetch decisions:', error);
      setDecisions([]);
    } finally {
      setDecisionsLoading(false);
    }
  }, [initiative?.id]);

  // Fetch data when tab changes
  useEffect(() => {
    if (activeTab === 'tasks' && tasks.length === 0) {
      fetchTasks();
    } else if (activeTab === 'decisions' && decisions.length === 0) {
      fetchDecisions();
    }
  }, [activeTab, fetchTasks, fetchDecisions, tasks.length, decisions.length]);

  // Handle task save
  const handleTaskSave = useCallback(
    async (updatedTask: Task) => {
      try {
        await Api.updateTask(updatedTask.id, updatedTask);
        fetchTasks();
        setIsTaskModalOpen(false);
        setSelectedTask(null);
      } catch (error: any) {
        console.error('[InitiativeSidePanel] Failed to save task:', error);
      }
    },
    [fetchTasks]
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // ============================================
  // TAB CONTENT RENDERERS
  // ============================================

  const renderOverview = () => {
    if (!initiative) return null;

    return (
      <div className="space-y-6">
        {/* Summary */}
        <div>
          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
            Summary
          </h4>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {initiative.summary || 'No summary provided.'}
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-slate-50 dark:bg-navy-950 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <Target size={14} />
              Progress
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{ width: `${initiative.progress}%` }}
                />
              </div>
              <span className="text-sm font-medium text-navy-900 dark:text-white">
                {initiative.progress}%
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-navy-950 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <TrendingUp size={14} />
              Expected ROI
            </div>
            <div className="text-lg font-semibold text-green-600 dark:text-green-400">
              {initiative.expectedRoi ? `${initiative.expectedRoi.toFixed(1)}x` : '-'}
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-navy-950 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <AlertTriangle size={14} />
              Risk Score
            </div>
            <div
              className={`text-lg font-semibold ${
                (initiative.riskScore || 0) > 70
                  ? 'text-red-600 dark:text-red-400'
                  : (initiative.riskScore || 0) > 40
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-green-600 dark:text-green-400'
              }`}
            >
              {initiative.riskScore || 0}/100
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-navy-950 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <CheckCircle2 size={14} />
              Value Score
            </div>
            <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
              {initiative.valueScore || 0}/100
            </div>
          </div>
        </div>

        {/* Details */}
        <div>
          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">
            Details
          </h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-navy-700">
              <span className="text-sm text-slate-500 dark:text-slate-400">Axis</span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getAxisColor(initiative.axis)}`} />
                <span className="text-sm font-medium text-navy-900 dark:text-white capitalize">
                  {initiative.axis.replace(/([A-Z])/g, ' $1').trim()}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-navy-700">
              <span className="text-sm text-slate-500 dark:text-slate-400">Target Quarter</span>
              <span className="text-sm font-medium text-navy-900 dark:text-white">
                {initiative.targetQuarter || '-'}
              </span>
            </div>

            {initiative.waveName && (
              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-navy-700">
                <span className="text-sm text-slate-500 dark:text-slate-400">Wave</span>
                <span className="text-sm font-medium text-navy-900 dark:text-white">
                  {initiative.waveName}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">Dependencies</span>
              <span className="text-sm font-medium text-navy-900 dark:text-white">
                {initiative.dependencies?.length || 0} initiatives
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderFinancials = () => {
    if (!initiative) return null;

    return (
      <div className="space-y-6">
        {/* Budget Overview */}
        <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl">
          <div className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">
            Total Budget
          </div>
          <div className="text-3xl font-bold text-green-700 dark:text-green-300">
            {formatCurrency(initiative.budget)}
          </div>
        </div>

        {/* Budget Breakdown */}
        <div>
          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">
            Budget Breakdown
          </h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-navy-700">
              <span className="text-sm text-slate-500 dark:text-slate-400">CapEx</span>
              <span className="text-sm font-medium text-navy-900 dark:text-white">
                {formatCurrency(initiative.budget)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-navy-700">
              <span className="text-sm text-slate-500 dark:text-slate-400">OpEx (Annual)</span>
              <span className="text-sm font-medium text-navy-900 dark:text-white">-</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">Expected ROI</span>
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                {initiative.expectedRoi ? `${initiative.expectedRoi.toFixed(1)}x` : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Placeholder for budget tracking */}
        <div className="p-4 bg-slate-50 dark:bg-navy-950 rounded-lg text-center text-sm text-slate-500 dark:text-slate-400">
          Detailed budget tracking coming soon
        </div>
      </div>
    );
  };

  const renderStakeholders = () => {
    if (!initiative) return null;

    return (
      <div className="space-y-6">
        {/* Business Owner */}
        <div>
          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">
            Business Owner
          </h4>
          {initiative.ownerBusiness ? (
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-navy-950 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-sm font-medium text-purple-700 dark:text-purple-300 overflow-hidden">
                {initiative.ownerBusiness.avatarUrl ? (
                  <img
                    src={initiative.ownerBusiness.avatarUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  `${initiative.ownerBusiness.firstName[0]}${initiative.ownerBusiness.lastName[0]}`
                )}
              </div>
              <div>
                <div className="font-medium text-navy-900 dark:text-white">
                  {initiative.ownerBusiness.firstName} {initiative.ownerBusiness.lastName}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Business Owner</div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 dark:bg-navy-950 rounded-lg text-sm text-slate-500 dark:text-slate-400 italic">
              No business owner assigned
            </div>
          )}
        </div>

        {/* Execution Owner */}
        <div>
          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">
            Execution Owner
          </h4>
          {initiative.ownerExecution ? (
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-navy-950 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-medium text-blue-700 dark:text-blue-300 overflow-hidden">
                {initiative.ownerExecution.avatarUrl ? (
                  <img
                    src={initiative.ownerExecution.avatarUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  `${initiative.ownerExecution.firstName[0]}${initiative.ownerExecution.lastName[0]}`
                )}
              </div>
              <div>
                <div className="font-medium text-navy-900 dark:text-white">
                  {initiative.ownerExecution.firstName} {initiative.ownerExecution.lastName}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Execution Owner</div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 dark:bg-navy-950 rounded-lg text-sm text-slate-500 dark:text-slate-400 italic">
              No execution owner assigned
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderRisks = () => {
    return (
      <div className="space-y-6">
        {/* Risk Score */}
        <div className="p-4 bg-slate-50 dark:bg-navy-950 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">Overall Risk Score</span>
            <span
              className={`text-lg font-bold ${
                (initiative?.riskScore || 0) > 70
                  ? 'text-red-600 dark:text-red-400'
                  : (initiative?.riskScore || 0) > 40
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-green-600 dark:text-green-400'
              }`}
            >
              {initiative?.riskScore || 0}/100
            </span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                (initiative?.riskScore || 0) > 70
                  ? 'bg-red-500'
                  : (initiative?.riskScore || 0) > 40
                    ? 'bg-amber-500'
                    : 'bg-green-500'
              }`}
              style={{ width: `${initiative?.riskScore || 0}%` }}
            />
          </div>
        </div>

        {/* Placeholder for RAID items */}
        <div className="p-4 bg-slate-50 dark:bg-navy-950 rounded-lg text-center text-sm text-slate-500 dark:text-slate-400">
          RAID log integration coming soon
        </div>
      </div>
    );
  };

  // ============================================
  // TASKS TAB
  // ============================================

  const getTaskStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'done':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'in_progress':
      case 'in-progress':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
      case 'blocked':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
    }
  };

  const getTaskPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
      case 'critical':
        return 'text-red-600 dark:text-red-400';
      case 'high':
        return 'text-orange-600 dark:text-orange-400';
      case 'medium':
        return 'text-amber-600 dark:text-amber-400';
      default:
        return 'text-slate-500 dark:text-slate-400';
    }
  };

  const filteredTasks = tasks.filter((task) => {
    if (taskFilter === 'all') return true;
    const status = task.status?.toLowerCase();
    if (taskFilter === 'todo') return status === 'todo' || status === 'backlog';
    if (taskFilter === 'in_progress') return status === 'in_progress' || status === 'in-progress';
    if (taskFilter === 'completed') return status === 'completed' || status === 'done';
    return true;
  });

  const renderTasks = () => {
    if (!initiative) return null;

    return (
      <div className="space-y-4">
        {/* Filter buttons */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'todo', 'in_progress', 'completed'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setTaskFilter(filter)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                taskFilter === filter
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700'
              }`}
            >
              {filter === 'all'
                ? 'All'
                : filter === 'todo'
                  ? 'To Do'
                  : filter === 'in_progress'
                    ? 'In Progress'
                    : 'Completed'}
            </button>
          ))}
        </div>

        {/* Tasks count */}
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
          {taskFilter !== 'all' && ` (${tasks.length} total)`}
        </div>

        {/* Task list */}
        {tasksLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-8 text-slate-400 dark:text-slate-500">
            <CheckSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No tasks found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => {
                  setSelectedTask(task);
                  setIsTaskModalOpen(true);
                }}
                className="p-3 bg-slate-50 dark:bg-navy-950 rounded-lg border border-slate-100 dark:border-navy-700 hover:border-purple-300 dark:hover:border-purple-500/30 cursor-pointer transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-navy-900 dark:text-white line-clamp-1 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                      {task.title}
                    </h4>
                    {task.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                        {task.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-medium rounded ${getTaskStatusColor(task.status)}`}
                      >
                        {task.status}
                      </span>
                      <span
                        className={`text-[10px] font-medium ${getTaskPriorityColor(task.priority)}`}
                      >
                        {task.priority}
                      </span>
                      {task.dueDate && (
                        <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                          <Clock size={10} />
                          {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight
                    size={16}
                    className="text-slate-400 dark:text-slate-500 group-hover:text-purple-500 shrink-0 mt-1"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Task Detail Modal */}
        {selectedTask && (
          <TaskDetailModal
            task={selectedTask}
            isOpen={isTaskModalOpen}
            onClose={() => {
              setIsTaskModalOpen(false);
              setSelectedTask(null);
            }}
            onSave={handleTaskSave}
            currentUser={currentUser as any}
            users={users as any[]}
          />
        )}
      </div>
    );
  };

  // ============================================
  // DECISIONS TAB
  // ============================================

  const getDecisionStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'APPROVED':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'REJECTED':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
      case 'DEFERRED':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
      default:
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
    }
  };

  const getDecisionPriorityColor = (priority?: string) => {
    switch (priority?.toUpperCase()) {
      case 'CRITICAL':
        return 'border-l-red-500';
      case 'HIGH':
        return 'border-l-orange-500';
      case 'MEDIUM':
        return 'border-l-amber-500';
      default:
        return 'border-l-slate-300 dark:border-l-slate-600';
    }
  };

  const getDecisionTypeLabel = (type: string): string => {
    const types: Record<string, string> = {
      INITIATIVE_APPROVAL: 'Initiative Approval',
      PHASE_TRANSITION: 'Phase Transition',
      TASK_UNBLOCK: 'Unblock Task',
      UNBLOCK: 'Unblock',
      BUDGET: 'Budget',
      SCOPE_CHANGE: 'Scope Change',
      RESOURCE_ALLOCATION: 'Resource',
      EXCEPTION: 'Exception',
      GENERAL: 'General',
    };
    return types[type] || type?.replace(/_/g, ' ') || 'Decision';
  };

  const renderDecisions = () => {
    if (!initiative) return null;

    return (
      <div className="space-y-4">
        {/* Decisions count */}
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {decisions.length} decision{decisions.length !== 1 ? 's' : ''}
        </div>

        {/* Decision list */}
        {decisionsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
          </div>
        ) : decisions.length === 0 ? (
          <div className="text-center py-8 text-slate-400 dark:text-slate-500">
            <Scale className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No decisions found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {decisions.map((decision) => (
              <div
                key={decision.id}
                onClick={() => setSelectedDecisionId(decision.id)}
                className={`p-3 bg-slate-50 dark:bg-navy-950 rounded-lg border-l-4 border border-slate-100 dark:border-navy-700 hover:border-purple-300 dark:hover:border-purple-500/30 cursor-pointer transition-all group ${getDecisionPriorityColor(decision.priority)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">
                        {getDecisionTypeLabel(decision.decisionType)}
                      </span>
                    </div>
                    <h4 className="text-sm font-medium text-navy-900 dark:text-white line-clamp-2 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                      {decision.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-medium rounded ${getDecisionStatusColor(decision.status)}`}
                      >
                        {decision.status}
                      </span>
                      {decision.ownerName && (
                        <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                          <User size={10} />
                          {decision.ownerName}
                        </span>
                      )}
                      {decision.dueDate && (
                        <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                          <Clock size={10} />
                          {new Date(decision.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight
                    size={16}
                    className="text-slate-400 dark:text-slate-500 group-hover:text-purple-500 shrink-0 mt-1"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Decision Detail Modal */}
        {selectedDecisionId && (
          <DecisionDetailModal
            decisionId={selectedDecisionId}
            onClose={() => setSelectedDecisionId(null)}
            onDecisionMade={() => {
              fetchDecisions();
              setSelectedDecisionId(null);
            }}
          />
        )}
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'tasks':
        return renderTasks();
      case 'decisions':
        return renderDecisions();
      case 'financials':
        return renderFinancials();
      case 'stakeholders':
        return renderStakeholders();
      case 'risks':
        return renderRisks();
      default:
        return null;
    }
  };

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-lg bg-white dark:bg-navy-900 shadow-2xl z-50 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {initiative && (
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-navy-700">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${getAxisColor(initiative.axis)}`} />
                    <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">
                      {initiative.axis.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-navy-900 dark:text-white line-clamp-2">
                    {initiative.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-lg ${getStatusClasses(initiative.status)}`}
                    >
                      {initiative.status}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${getPriorityClasses(initiative.priority)}`}
                    >
                      {initiative.priority}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {onOpenFullDetail && (
                    <button
                      onClick={() => onOpenFullDetail(initiative)}
                      className="p-2 text-slate-400 dark:text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                      title="Open full details"
                    >
                      <ExternalLink size={18} />
                    </button>
                  )}
                  <button className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg">
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={onClose}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="shrink-0 px-6 py-2 border-b border-slate-200 dark:border-navy-700 overflow-x-auto">
              <div className="flex items-center gap-1">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                      activeTab === tab.id
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">{renderTabContent()}</div>
          </div>
        )}
      </div>
    </>
  );
};

export default InitiativeSidePanel;
