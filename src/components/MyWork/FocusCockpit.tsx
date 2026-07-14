/**
 * FocusCockpit — V3-C04
 *
 * Lightweight cockpit for My Work Focus. In 10–30 seconds user sees the plan
 * (My list + Today + This Week) and can: add task, drag between lanes,
 * check off, open preview/full detail.
 *
 * Design: DBR77 "Tech Sexy" — monochromatic, navy-900 dark bg, invisible borders,
 * rounded-xl cards. No central AI Coach feed.
 */

import { Calendar, Check, GripVertical, Plus } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

// ============================================================================
// TYPES
// ============================================================================

export type FocusLane = 'my_list' | 'today' | 'this_week';

export interface FocusTask {
  id: string;
  title: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dueDate?: string;
  lane: FocusLane;
  isDone: boolean;
}

export interface FocusCockpitProps {
  tasks: FocusTask[];
  onTaskClick: (taskId: string) => void;
  onTaskToggle: (taskId: string) => void;
  onCreateTask: (lane: 'my_list' | 'today' | 'this_week') => void;
  onMoveTask: (taskId: string, toLane: 'my_list' | 'today' | 'this_week') => void;
  /** Optional: render preview content when a task is selected */
  renderPreview?: (task: FocusTask) => React.ReactNode;
  /** Optional: render right 3-tools strip content */
  renderToolsStrip?: () => React.ReactNode;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const LANES: FocusLane[] = ['my_list', 'today', 'this_week'];

const PRIORITY_STYLES: Record<FocusTask['priority'], string> = {
  LOW: 'bg-slate-500/20 text-slate-600 dark:text-slate-500',
  MEDIUM: 'bg-slate-400/20 text-slate-600 dark:text-slate-400',
  HIGH: 'bg-amber-500/20 text-amber-500 dark:text-amber-400',
  CRITICAL: 'bg-rose-500/20 text-rose-500 dark:text-rose-400',
};

const STATUS_DOT_STYLES: Record<FocusTask['status'], string> = {
  TODO: 'bg-slate-400 dark:bg-slate-500',
  IN_PROGRESS: 'bg-primary-500',
  DONE: 'bg-green-500',
};

// ============================================================================
// COMPACT TASK CARD
// ============================================================================

interface FocusTaskCardProps {
  task: FocusTask;
  onToggle: (taskId: string) => void;
  onClick: (taskId: string) => void;
  onMove: (taskId: string, toLane: FocusLane) => void;
}

const FocusTaskCard: React.FC<FocusTaskCardProps> = ({ task, onToggle, onClick, onMove }) => {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData('text/plain', task.id);
      e.dataTransfer.effectAllowed = 'move';
      setIsDragging(true);
    },
    [task.id]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const formatDueDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dNorm = new Date(d);
    dNorm.setHours(0, 0, 0, 0);

    if (dNorm.getTime() === today.getTime()) {
      return t('myWork.focusCockpit.dueToday', 'Today');
    }
    if (dNorm.getTime() === tomorrow.getTime()) {
      return t('myWork.focusCockpit.dueTomorrow', 'Tomorrow');
    }
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onClick(task.id)}
      className={`
        group flex items-center gap-2.5 px-3 py-2 rounded-xl
        bg-c-surface-raised
        hover:bg-c-surface-raised/70
        transition-colors cursor-pointer
        ${isDragging ? 'opacity-50' : ''}
      `}
    >
      <div
        className="shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity p-0.5 -ml-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={14} className="text-slate-600 dark:text-slate-500" />
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(task.id);
        }}
        className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center
          transition-colors
          ${
            task.isDone
              ? 'bg-green-500/20 border border-green-500/50'
              : 'border border-slate-400 dark:border-slate-500 hover:border-primary-500 dark:hover:border-primary-400'
          }`}
        aria-label={t('myWork.focusCockpit.toggleTask', 'Toggle task')}
      >
        {task.isDone ? <Check size={12} className="text-green-500" strokeWidth={3} /> : null}
      </button>

      <div
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT_STYLES[task.status]}`}
        title={task.status}
      />

      <div className="flex-1 min-w-0">
        <span
          className={`text-sm truncate block ${
            task.isDone ? 'text-c-text-muted line-through' : 'text-c-text'
          }`}
        >
          {task.title}
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <span
          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${PRIORITY_STYLES[task.priority]}`}
        >
          {t(`myWork.focusCockpit.priority.${task.priority.toLowerCase()}`, task.priority)}
        </span>
        {task.dueDate && (
          <span className="flex items-center gap-0.5 text-[10px] text-slate-600 dark:text-slate-500">
            <Calendar size={10} />
            {formatDueDate(task.dueDate)}
          </span>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// DROPPABLE LANE
// ============================================================================

interface FocusLaneColumnProps {
  lane: FocusLane;
  tasks: FocusTask[];
  onTaskToggle: (taskId: string) => void;
  onTaskClick: (taskId: string) => void;
  onMoveTask: (taskId: string, toLane: FocusLane) => void;
  onCreateTask: (lane: FocusLane) => void;
}

const FocusLaneColumn: React.FC<FocusLaneColumnProps> = ({
  lane,
  tasks,
  onTaskToggle,
  onTaskClick,
  onMoveTask,
  onCreateTask,
}) => {
  const { t } = useTranslation();
  const [dragOver, setDragOver] = useState(false);

  const laneLabels: Record<FocusLane, string> = {
    my_list: t('myWork.focusCockpit.lanes.myList', 'My list (capture)'),
    today: t('myWork.focusCockpit.lanes.today', 'Today'),
    this_week: t('myWork.focusCockpit.lanes.thisWeek', 'This Week'),
  };

  const showQuickAdd = lane === 'my_list' || lane === 'today';

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const taskId = e.dataTransfer.getData('text/plain');
      if (taskId && lane) {
        onMoveTask(taskId, lane);
      }
    },
    [lane, onMoveTask]
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        flex flex-col min-w-0 flex-1 rounded-xl
        bg-c-surface
        min-h-[200px]
        ${dragOver ? 'ring-1 ring-primary-500/50 ring-inset' : ''}
      `}
    >
      {/* Lane Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 h-9 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500 truncate">
            {laneLabels[lane]}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-c-surface-raised text-slate-600 dark:text-slate-500 shrink-0">
            {tasks.length}
          </span>
        </div>
        {showQuickAdd && (
          <button
            onClick={() => onCreateTask(lane)}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium
              bg-c-surface-raised text-slate-600 dark:text-slate-500
              hover:bg-c-surface-raised/70 hover:text-slate-300 dark:hover:text-slate-300
              transition-colors shrink-0"
          >
            <Plus size={12} />
            {t('myWork.focusCockpit.addTask', 'Task')}
          </button>
        )}
      </div>

      {/* Lane Content */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5">
        {tasks.map((task) => (
          <FocusTaskCard
            key={task.id}
            task={task}
            onToggle={onTaskToggle}
            onClick={onTaskClick}
            onMove={onMoveTask}
          />
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const FocusCockpit: React.FC<FocusCockpitProps> = ({
  tasks,
  onTaskClick,
  onTaskToggle,
  onCreateTask,
  onMoveTask,
  renderPreview,
  renderToolsStrip,
}) => {
  const { t } = useTranslation();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [toolsStripOpen, setToolsStripOpen] = useState(false);

  const tasksByLane = React.useMemo(() => {
    const byLane: Record<FocusLane, FocusTask[]> = {
      my_list: [],
      today: [],
      this_week: [],
    };
    for (const task of tasks) {
      byLane[task.lane].push(task);
    }
    return byLane;
  }, [tasks]);

  const selectedTask = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) : null;

  const handleTaskClick = useCallback(
    (taskId: string) => {
      setSelectedTaskId(taskId);
      if (renderPreview) {
        setPreviewOpen(true);
      }
      onTaskClick(taskId);
    },
    [onTaskClick, renderPreview]
  );

  return (
    <div className="flex h-full min-h-0 bg-c-bg">
      {/* Main: 3 Lanes */}
      <div className="flex-1 flex gap-3 p-4 min-w-0 overflow-x-auto">
        {LANES.map((lane) => (
          <FocusLaneColumn
            key={lane}
            lane={lane}
            tasks={tasksByLane[lane]}
            onTaskToggle={onTaskToggle}
            onTaskClick={handleTaskClick}
            onMoveTask={onMoveTask}
            onCreateTask={onCreateTask}
          />
        ))}
      </div>

      {/* Optional: Preview Pane */}
      {renderPreview && selectedTask && (
        <div
          className={`
            w-72 shrink-0 border-l border-c-border-subtle
            flex flex-col overflow-hidden
            ${previewOpen ? '' : 'hidden'}
          `}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-c-border-subtle">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
              {t('myWork.focusCockpit.preview', 'Preview')}
            </span>
            <button
              onClick={() => setPreviewOpen(false)}
              className="text-slate-600 hover:text-slate-300 dark:text-slate-500 dark:hover:text-slate-400 text-xs"
            >
              ×
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">{renderPreview(selectedTask)}</div>
        </div>
      )}

      {/* Optional: Right 3-Tools Strip */}
      {renderToolsStrip && (
        <div
          className={`
            w-16 shrink-0 border-l border-c-border-subtle
            flex flex-col items-center py-2 gap-1
            ${toolsStripOpen ? '' : ''}
          `}
        >
          {renderToolsStrip()}
        </div>
      )}
    </div>
  );
};

export default FocusCockpit;
