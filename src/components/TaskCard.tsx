import { AlertCircle, Calendar, User } from 'lucide-react';
import React from 'react';

import { Task } from '../types';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

const getStatusColor = (status: string) => {
  const normalizedStatus = status?.toLowerCase?.() || status;
  switch (normalizedStatus) {
    case 'todo':
    case 'backlog':
      return 'border-slate-500 text-slate-500 dark:text-slate-400';
    case 'in_progress':
    case 'review':
      return 'border-blue-500 text-blue-500';
    case 'blocked':
      return 'border-danger-500 text-danger-500';
    case 'done':
      return 'border-green-500 text-green-500';
    case 'cancelled':
      return 'border-slate-400 text-slate-600 dark:text-slate-500';
    default:
      return 'border-slate-500';
  }
};

const getStatusLabel = (status: string) => {
  return String(status || '')
    .replace('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export const TaskCard: React.FC<TaskCardProps> = ({ task, onClick }) => {
  const completedChecks = task.checklist?.filter((c) => c.completed).length || 0;
  const totalChecks = task.checklist?.length || 0;

  return (
    <div
      onClick={onClick}
      className={`
        bg-white dark:bg-navy-900 border rounded-lg p-4 cursor-pointer hover:shadow-lg transition-all group shadow-sm dark:shadow-none
        ${getStatusColor(task.status).split(' ')[0]} border-opacity-30 hover:border-opacity-100
      `}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${getStatusColor(task.status)} bg-opacity-10`}
          >
            {getStatusLabel(task.status)}
          </span>
          {/* Priority Badge */}
          <span
            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
              task.priority === 'urgent'
                ? 'border-danger-500 text-danger-500 bg-danger-500/10'
                : task.priority === 'high'
                  ? 'border-amber-500 text-amber-500 bg-amber-500/10'
                  : task.priority === 'medium'
                    ? 'border-blue-500 text-blue-500 bg-blue-500/10'
                    : 'border-slate-500 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-navy-800/300/10'
            }`}
          >
            {task.priority || 'Normal'}
          </span>
        </div>
        {task.priority === 'urgent' && <AlertCircle size={14} className="text-danger-500" />}
      </div>

      <h4 className="text-navy-900 dark:text-white text-sm font-medium mb-1 line-clamp-2">
        {task.title}
      </h4>

      {task.why && (
        <p className="text-xs text-slate-500 dark:text-slate-400 italic mb-3 line-clamp-2">
          "{task.why}"
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-500 mt-3">
        <div className="flex items-center gap-2">
          {task.assignee ? (
            <div
              className="flex items-center gap-1 text-blue-600 dark:text-blue-300"
              title={`${task.assignee.firstName} ${task.assignee.lastName}`}
            >
              {task.assignee.avatarUrl ? (
                <img src={task.assignee.avatarUrl} alt="Avatar" className="w-4 h-4 rounded-full" />
              ) : (
                <User size={12} />
              )}
              <span className="max-w-[60px] truncate">{task.assignee.lastName}</span>
            </div>
          ) : (
            <span className="text-slate-600 dark:text-slate-500 flex items-center gap-1">
              <User size={12} /> Unassigned
            </span>
          )}
        </div>

        {task.dueDate && (
          <div
            className={`flex items-center gap-1 ${new Date(task.dueDate) < new Date() && task.status !== 'done' ? 'text-danger-500 dark:text-danger-400' : ''}`}
          >
            <Calendar size={12} />
            <span>
              {new Date(task.dueDate).toLocaleDateString(undefined, {
                month: 'numeric',
                day: 'numeric',
              })}
            </span>
          </div>
        )}
      </div>

      {(totalChecks > 0 || (task.progress || 0) > 0) && (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-1 bg-slate-100 dark:bg-navy-950 rounded-full overflow-hidden">
            <div
              className={`h-full ${task.status === 'blocked' ? 'bg-danger-500' : 'bg-blue-500'}`}
              style={{ width: `${task.progress || (completedChecks / (totalChecks || 1)) * 100}%` }}
            ></div>
          </div>
          {totalChecks > 0 ? (
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              {completedChecks}/{totalChecks}
            </span>
          ) : (
            <span className="text-[10px] text-slate-500 dark:text-slate-400">{task.progress}%</span>
          )}
        </div>
      )}
    </div>
  );
};
