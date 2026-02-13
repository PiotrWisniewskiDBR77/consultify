/**
 * ExecutionDetailPanel
 *
 * Detailed view for an initiative in execution phase.
 * Shows full information with status change actions.
 */

import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  TrendingUp,
  User,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import {
  getStatusActions,
  getStatusMeta,
  isValidTransition,
  StatusAction,
} from '@/services/initiativeLifecycle';

import { FullInitiative, InitiativeStatus, Task, TaskStatus } from '../../types';

interface ExecutionDetailPanelProps {
  initiative: FullInitiative;
  onBack: () => void;
  onUpdate: (updated: FullInitiative) => void;
}

// ============================================
// STATUS BADGE COMPONENT
// ============================================

const StatusBadge: React.FC<{ status: InitiativeStatus }> = ({ status }) => {
  const meta = getStatusMeta(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${meta.bgColor} ${meta.color}`}
    >
      <span className={`w-2 h-2 rounded-full ${meta.dotColor}`} />
      {meta.label}
    </span>
  );
};

// ============================================
// PROGRESS RING COMPONENT
// ============================================

const ProgressRing: React.FC<{ progress: number; size?: number }> = ({ progress, size = 80 }) => {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          className="text-navy-700"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className="text-cyan-500 transition-all duration-500"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-white">{progress}%</span>
      </div>
    </div>
  );
};

// ============================================
// TASK ITEM COMPONENT
// ============================================

const TaskItem: React.FC<{
  task: Task;
  onToggle: (taskId: string, done: boolean) => void;
}> = ({ task, onToggle }) => {
  const isDone = task.status === TaskStatus.DONE;

  return (
    <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-navy-800/50 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
      <button
        onClick={() => onToggle(task.id, !isDone)}
        className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          isDone ? 'bg-cyan-500 border-cyan-500' : 'border-slate-500 hover:border-cyan-500'
        }`}
      >
        {isDone && <CheckCircle2 size={12} className="text-white" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${isDone ? 'text-slate-500 line-through' : 'text-slate-900 dark:text-white'}`}>
          {task.title}
        </p>
        {task.dueDate && (
          <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
            <Clock size={12} />
            <span>{new Date(task.dueDate).toLocaleDateString()}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// STATUS CHANGE MODAL
// ============================================

interface StatusChangeModalProps {
  action: StatusAction;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}

const StatusChangeModal: React.FC<StatusChangeModalProps> = ({
  action,
  onConfirm,
  onCancel,
  isLoading,
}) => {
  const [reason, setReason] = useState('');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{action.label}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          {action.requiresReason
            ? 'Please provide a reason for this change.'
            : 'Are you sure you want to proceed?'}
        </p>

        {action.requiresReason && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter reason..."
            className="w-full p-3 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white text-sm resize-none focus:outline-none focus:border-cyan-500"
            rows={3}
          />
        )}

        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason || undefined)}
            disabled={isLoading || (action.requiresReason && !reason.trim())}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              action.variant === 'danger'
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : action.variant === 'primary'
                  ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                  : 'bg-slate-200 dark:bg-navy-700 hover:bg-slate-300 dark:hover:bg-navy-600 text-slate-900 dark:text-white'
            }`}
          >
            {isLoading && <Loader2 size={14} className="animate-spin" />}
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN DETAIL PANEL
// ============================================

export const ExecutionDetailPanel: React.FC<ExecutionDetailPanelProps> = ({
  initiative,
  onBack,
  onUpdate,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const { t } = useTranslation();
  const [selectedAction, setSelectedAction] = useState<StatusAction | null>(null);

  const progress = initiative.progress || 0;
  const tasks = initiative.tasks || [];
  const completedTasks = tasks.filter((t) => t.status === TaskStatus.DONE).length;

  // Get available status actions
  const statusActions = getStatusActions(initiative.status);

  // Handle status change
  const handleStatusChange = useCallback(
    async (action: StatusAction, reason?: string) => {
      if (!isValidTransition(initiative.status, action.targetStatus)) {
        toast.error(t('execution.toast.invalidTransition', 'Nieprawidłowa zmiana statusu'));
        return;
      }

      setIsUpdating(true);
      try {
        const updates: Partial<FullInitiative> = {
          status: action.targetStatus,
        };

        if (reason) {
          if (action.targetStatus === InitiativeStatus.BLOCKED) {
            updates.blockedReason = reason;
          }
        }

        await Api.updateInitiative(initiative.id, updates);

        onUpdate({
          ...initiative,
          ...updates,
        });

        toast.success(
          t('execution.toast.statusChanged', 'Status zmieniony na {{status}}', {
            status: getStatusMeta(action.targetStatus).label,
          })
        );
        setSelectedAction(null);
      } catch (error) {
        console.error('[ExecutionDetailPanel] Status change failed:', error);
        toast.error(t('execution.toast.statusUpdateError', 'Nie udało się zaktualizować statusu'));
      } finally {
        setIsUpdating(false);
      }
    },
    [initiative, onUpdate]
  );

  // Handle task toggle
  const handleTaskToggle = useCallback(
    async (taskId: string, done: boolean) => {
      try {
        const newStatus = done ? TaskStatus.DONE : TaskStatus.TODO;
        await Api.put(`/tasks/${taskId}`, { status: newStatus });

        const updatedTasks = tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t));

        // Recalculate progress
        const completed = updatedTasks.filter((t) => t.status === TaskStatus.DONE).length;
        const newProgress =
          updatedTasks.length > 0 ? Math.round((completed / updatedTasks.length) * 100) : 0;

        onUpdate({
          ...initiative,
          tasks: updatedTasks,
          progress: newProgress,
        });
      } catch (error) {
        console.error('[ExecutionDetailPanel] Task toggle failed:', error);
        toast.error(t('execution.toast.taskUpdateError', 'Nie udało się zaktualizować zadania'));
      }
    },
    [initiative, tasks, onUpdate]
  );

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-navy-950">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">{initiative.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <StatusBadge status={initiative.status} />
                {initiative.priority && (
                  <span
                    className={`text-xs font-medium ${
                      initiative.priority === 'Critical'
                        ? 'text-red-400'
                        : initiative.priority === 'High'
                          ? 'text-amber-400'
                          : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {initiative.priority} Priority
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* All status actions — primary first, then secondary, then danger */}
            {statusActions
              .sort((a, b) => {
                const order = { primary: 0, secondary: 1, danger: 2 };
                return (order[a.variant] ?? 1) - (order[b.variant] ?? 1);
              })
              .map((action) => (
              <button
                key={action.targetStatus}
                onClick={() =>
                  action.requiresReason ? setSelectedAction(action) : handleStatusChange(action)
                }
                disabled={isUpdating}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                  action.variant === 'danger'
                    ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
                    : action.variant === 'primary'
                      ? 'bg-cyan-600 text-white hover:bg-cyan-500'
                      : 'bg-slate-200 dark:bg-navy-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-navy-600'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-3 gap-6">
          {/* Left Column - Main Info */}
          <div className="col-span-2 space-y-6">
            {/* Description */}
            {initiative.description && (
              <div className="bg-white dark:bg-navy-900 rounded-xl p-5 border border-slate-200 dark:border-navy-700">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                  <FileText size={16} />
                  Description
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {initiative.description}
                </p>
              </div>
            )}

            {/* Blocked Reason */}
            {initiative.status === InitiativeStatus.BLOCKED && initiative.blockedReason && (
              <div className="bg-red-500/10 rounded-xl p-5 border border-red-500/30">
                <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  Blocked Reason
                </h3>
                <p className="text-sm text-red-300">{initiative.blockedReason}</p>
              </div>
            )}

            {/* Tasks */}
            <div className="bg-white dark:bg-navy-900 rounded-xl p-5 border border-slate-200 dark:border-navy-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  Tasks ({completedTasks}/{tasks.length})
                </h3>
              </div>

              {tasks.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">
                  No tasks defined for this initiative
                </p>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task as unknown as Task}
                      onToggle={handleTaskToggle}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Key Risks */}
            {initiative.keyRisks && initiative.keyRisks.length > 0 && (
              <div className="bg-white dark:bg-navy-900 rounded-xl p-5 border border-slate-200 dark:border-navy-700">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  Key Risks
                </h3>
                <div className="space-y-3">
                  {initiative.keyRisks.map((risk, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 dark:bg-navy-800 rounded-lg">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm text-slate-900 dark:text-white">{risk.risk}</p>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            risk.metric === 'High'
                              ? 'bg-red-500/20 text-red-400'
                              : risk.metric === 'Medium'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-green-500/20 text-green-400'
                          }`}
                        >
                          {risk.metric}
                        </span>
                      </div>
                      {risk.mitigation && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Mitigation: {risk.mitigation}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Stats & Info */}
          <div className="space-y-6">
            {/* Progress */}
            <div className="bg-white dark:bg-navy-900 rounded-xl p-5 border border-slate-200 dark:border-navy-700">
              <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4">Progress</h3>
              <div className="flex justify-center">
                <ProgressRing progress={progress} />
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white dark:bg-navy-900 rounded-xl p-5 border border-slate-200 dark:border-navy-700">
              <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
                <Calendar size={16} />
                Timeline
              </h3>
              <div className="space-y-3">
                {initiative.startDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Start</span>
                        <span className="text-sm text-slate-900 dark:text-white">
                      {new Date(initiative.startDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {initiative.plannedEndDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Planned End</span>
                    <span
                      className={`text-sm ${
                        new Date(initiative.plannedEndDate) < new Date() &&
                        initiative.status !== InitiativeStatus.DONE
                          ? 'text-red-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {new Date(initiative.plannedEndDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {initiative.actualEndDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{t('execution.detail.actualEnd')}</span>
                    <span className="text-sm text-green-400">
                      {new Date(initiative.actualEndDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Owners */}
            <div className="bg-white dark:bg-navy-900 rounded-xl p-5 border border-slate-200 dark:border-navy-700">
              <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
                <User size={16} />
                {t('execution.detail.owners')}
              </h3>
              <div className="space-y-3">
                {initiative.ownerBusiness && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <span className="text-xs text-purple-400">
                        {initiative.ownerBusiness.firstName?.[0]}
                        {initiative.ownerBusiness.lastName?.[0]}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-slate-900 dark:text-white">
                        {initiative.ownerBusiness.firstName} {initiative.ownerBusiness.lastName}
                      </p>
                      <p className="text-xs text-slate-500">{t('execution.detail.businessOwner')}</p>
                    </div>
                  </div>
                )}
                {initiative.ownerTechnical && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                      <span className="text-xs text-cyan-400">
                        {initiative.ownerTechnical.firstName?.[0]}
                        {initiative.ownerTechnical.lastName?.[0]}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-slate-900 dark:text-white">
                        {initiative.ownerTechnical.firstName} {initiative.ownerTechnical.lastName}
                      </p>
                      <p className="text-xs text-slate-500">{t('execution.detail.technicalOwner')}</p>
                    </div>
                  </div>
                )}
                {!initiative.ownerBusiness && !initiative.ownerTechnical && (
                  <p className="text-sm text-slate-500">{t('execution.detail.noOwners')}</p>
                )}
              </div>
            </div>

            {/* Economics */}
            {(initiative.costCapex || initiative.expectedRoi) && (
              <div className="bg-white dark:bg-navy-900 rounded-xl p-5 border border-slate-200 dark:border-navy-700">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
                  <TrendingUp size={16} />
                  {t('execution.detail.economics')}
                </h3>
                <div className="space-y-3">
                  {initiative.costCapex && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">{t('execution.detail.budgetCapex')}</span>
                        <span className="text-sm text-slate-900 dark:text-white">
                        {initiative.costCapex.toLocaleString()} PLN
                      </span>
                    </div>
                  )}
                  {initiative.expectedRoi && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">{t('execution.detail.expectedRoi')}</span>
                      <span className="text-sm text-green-400">{initiative.expectedRoi}x</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Change Modal */}
      {selectedAction && (
        <StatusChangeModal
          action={selectedAction}
          onConfirm={(reason) => handleStatusChange(selectedAction, reason)}
          onCancel={() => setSelectedAction(null)}
          isLoading={isUpdating}
        />
      )}
    </div>
  );
};

export default ExecutionDetailPanel;
