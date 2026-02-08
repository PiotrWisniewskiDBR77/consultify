/**
 * TasksMilestonesSection
 *
 * Displays initiative tasks with milestone tracking and progress bar.
 * Extracted from InitiativeDocumentView.
 */

import { motion } from 'framer-motion';
import { CheckSquare, ExternalLink, Loader2, Milestone, Plus, Sparkles } from 'lucide-react';
import React from 'react';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const TasksMilestonesSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const {
    tasks,
    tasksDone,
    milestones,
    isPolish,
    isGeneratingAI,
    handleGenerateAI,
    isMutating,
    showCreateTask,
    setShowCreateTask,
    newTaskTitle,
    setNewTaskTitle,
    newTaskIsMilestone,
    setNewTaskIsMilestone,
    newTaskMilestoneDate,
    setNewTaskMilestoneDate,
    handleCreateTask,
    onOpenTask,
  } = useInitiativeContext();

  return (
    <CollapsibleSection
      id="tasks"
      title={isPolish ? 'Zadania i kamienie milowe' : 'Tasks & Milestones'}
      icon={<CheckSquare size={18} className="text-emerald-500 dark:text-emerald-400" />}
      iconBg="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20"
      expanded={expanded}
      onToggle={onToggle}
      badge={
        <div className="flex items-center gap-2">
          {milestones.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 flex items-center gap-1">
              <Milestone size={10} />
              {milestones.length}
            </span>
          )}
          <span className="text-xs text-slate-400">
            {tasksDone}/{tasks.length}
          </span>
        </div>
      }
      actions={
        <div className="flex items-center gap-2">
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              setShowCreateTask(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-medium transition-all"
          >
            <Plus size={14} />
            <span>{isPolish ? 'Nowe' : 'New'}</span>
          </motion.button>
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              handleGenerateAI('tasks');
            }}
            disabled={isGeneratingAI === 'tasks'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 text-xs font-medium transition-all disabled:opacity-50"
            title={isPolish ? 'AI zasugeruje zadania' : 'AI will suggest tasks'}
          >
            {isGeneratingAI === 'tasks' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            <span>AI</span>
          </motion.button>
        </div>
      }
    >
      {/* Create Task Form */}
      {showCreateTask && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 rounded-xl border-2 border-emerald-300 dark:border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-500/5 space-y-3"
        >
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder={isPolish ? 'Tytuł zadania...' : 'Task title...'}
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
            autoFocus
          />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newTaskIsMilestone}
                onChange={(e) => setNewTaskIsMilestone(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-purple-500 focus:ring-purple-500"
              />
              <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <Milestone size={14} />
                {isPolish ? 'Kamień milowy' : 'Milestone'}
              </span>
            </label>
            {newTaskIsMilestone && (
              <input
                type="date"
                value={newTaskMilestoneDate}
                onChange={(e) => setNewTaskMilestoneDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
              />
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCreateTask(false)}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
            >
              {isPolish ? 'Anuluj' : 'Cancel'}
            </button>
            <button
              onClick={handleCreateTask}
              disabled={isMutating || !newTaskTitle.trim()}
              className="px-3 py-1.5 text-xs bg-emerald-500 text-white rounded-lg disabled:opacity-50"
            >
              {isPolish ? 'Utwórz' : 'Create'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Milestones Timeline */}
      {milestones.length > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-purple-50/50 dark:bg-purple-500/5 border border-purple-200/50 dark:border-purple-500/20">
          <div className="flex items-center gap-2 mb-3">
            <Milestone size={14} className="text-purple-500" />
            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase">
              {isPolish ? 'Kamienie milowe' : 'Milestones'}
            </span>
          </div>
          <div className="space-y-2">
            {milestones.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between p-2 rounded-lg bg-white/50 dark:bg-navy-800/50 cursor-pointer hover:bg-white/80 dark:hover:bg-navy-800/80 transition-colors"
                onClick={() => onOpenTask?.(m.id)}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${m.status === 'done' || m.status === 'DONE' ? 'bg-emerald-500' : 'bg-purple-500'}`}
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">{m.title}</span>
                </div>
                {m.milestoneDate && (
                  <span className="text-xs text-slate-400">
                    {new Date(m.milestoneDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task Filter Tabs */}
      {tasks.length > 0 && (
        <div className="flex items-center gap-1 mb-3 p-1 bg-slate-100/50 dark:bg-navy-800/50 rounded-lg">
          {[
            {
              key: 'all',
              label: isPolish ? 'Wszystkie' : 'All',
              count: tasks.filter((t) => !t.isMilestone).length,
            },
            {
              key: 'open',
              label: isPolish ? 'Otwarte' : 'Open',
              count: tasks.filter((t) => !t.isMilestone && !['done', 'DONE'].includes(t.status))
                .length,
            },
            {
              key: 'blocked',
              label: isPolish ? 'Zablokowane' : 'Blocked',
              count: tasks.filter((t) => ['blocked', 'BLOCKED'].includes(t.status)).length,
            },
            {
              key: 'done',
              label: isPolish ? 'Ukończone' : 'Done',
              count: tasks.filter((t) => ['done', 'DONE'].includes(t.status)).length,
            },
          ].map((tab) => (
            <button
              key={tab.key}
              className={`flex-1 px-2 py-1.5 rounded-md text-[10px] font-medium transition-all ${
                tab.count > 0 || tab.key === 'all'
                  ? 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-navy-700'
                  : 'text-slate-300 dark:text-slate-600 cursor-default'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1 text-[9px] text-slate-400">({tab.count})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Tasks List */}
      {tasks.length === 0 && !showCreateTask ? (
        <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-navy-700 rounded-xl">
          <CheckSquare size={24} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-400">{isPolish ? 'Brak zadań' : 'No tasks yet'}</p>
          <p className="text-xs text-slate-400 mt-1">
            {isPolish
              ? 'Dodaj zadanie ręcznie lub pozwól AI zasugerować'
              : 'Add tasks manually or let AI suggest them'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks
            .filter((t) => !t.isMilestone)
            .map((task) => {
              const isDone = task.status === 'done' || task.status === 'DONE';
              const isBlocked = task.status === 'blocked' || task.status === 'BLOCKED';
              const isInProgress = task.status === 'in_progress' || task.status === 'IN_PROGRESS';
              const isOverdue = task.dueDate && !isDone && new Date(task.dueDate) < new Date();
              const priorityColor =
                task.priority === 'CRITICAL' || task.priority === 'critical'
                  ? 'text-red-500'
                  : task.priority === 'HIGH' || task.priority === 'high'
                    ? 'text-orange-500'
                    : '';

              return (
                <div
                  key={task.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer group ${
                    isBlocked
                      ? 'bg-red-50/50 dark:bg-red-500/5 border-red-200/50 dark:border-red-500/20'
                      : isDone
                        ? 'bg-emerald-50/30 dark:bg-emerald-500/5 border-emerald-200/50 dark:border-emerald-500/20'
                        : 'bg-slate-50/50 dark:bg-navy-800/50 border-slate-200/50 dark:border-navy-700/50 hover:border-emerald-500/30'
                  }`}
                  onClick={() => onOpenTask?.(task.id)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        isDone
                          ? 'bg-emerald-500'
                          : isInProgress
                            ? 'bg-blue-500 animate-pulse'
                            : isBlocked
                              ? 'bg-red-500'
                              : 'bg-slate-400'
                      }`}
                    />
                    <span
                      className={`text-sm truncate ${
                        isDone
                          ? 'text-slate-400 line-through'
                          : 'text-slate-700 dark:text-slate-300'
                      } ${priorityColor}`}
                    >
                      {task.title}
                    </span>
                    {isBlocked && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-medium flex-shrink-0">
                        {isPolish ? 'ZABLOK.' : 'BLOCKED'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {task.assigneeName && (
                      <span className="text-xs text-slate-400 hidden sm:inline">
                        {task.assigneeName}
                      </span>
                    )}
                    {task.dueDate && (
                      <span
                        className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-slate-400'}`}
                      >
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                    <ExternalLink
                      size={14}
                      className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Progress Bar */}
      {tasks.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">{isPolish ? 'Postęp' : 'Progress'}</span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {Math.round((tasksDone / tasks.length) * 100)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(tasksDone / tasks.length) * 100}%` }}
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
            />
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
};
