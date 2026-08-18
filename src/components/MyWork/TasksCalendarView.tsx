import { CalendarDays, Clock, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';
import { Api } from '@/services/api';
import { Task } from '@/types';

type TaskFilter = 'all' | 'overdue' | 'today' | 'week' | 'urgent';
type CalendarSource = 'all' | 'project' | 'personal';

interface TaskCounts {
  total: number;
  overdue: number;
  today: number;
  week: number;
  urgent: number;
}

interface TasksCalendarViewProps {
  activeFilter: TaskFilter;
  searchQuery: string;
  onTaskClick: (taskId: string, taskData?: Task) => void;
  onCreateTask: () => void;
  onCountsChange: (counts: TaskCounts) => void;
  refreshTrigger?: number;
}

const startOfWeekMonday = (d: Date) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  return date;
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const isTaskDone = (status?: string | null) => {
  const s = String(status || '').toLowerCase();
  return s === 'done' || s === 'completed' || s === 'validated';
};

const isOverdue = (dueDate?: string | Date | null, status?: string | null) => {
  if (!dueDate) return false;
  if (isTaskDone(status)) return false;
  const dd = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dd.setHours(0, 0, 0, 0);
  return dd.getTime() < today.getTime();
};

const isUrgent = (priority?: string | null) => {
  const p = String(priority || '').toLowerCase();
  return p === 'urgent' || p === 'critical' || p === 'high';
};

const fmtDayLabel = (d: Date, locale: string) =>
  d.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });

export const TasksCalendarView: React.FC<TasksCalendarViewProps> = ({
  activeFilter,
  searchQuery,
  onTaskClick,
  onCountsChange,
  refreshTrigger,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || 'en';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const [updatingDueDate, setUpdatingDueDate] = useState<Record<string, boolean>>({});
  const [source, setSource] = useState<CalendarSource>('all');

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('source', source);
      params.set('includeDone', 'false');
      params.set('limit', '500');
      const [res, personalTasks] = await Promise.all([
        Api.get(`/my-work/calendar?${params.toString()}`) as Promise<any>,
        Api.getPersonalTasks({ limit: 500 }),
      ]);
      const list = Array.isArray(res) ? res : res?.tasks || [];
      const personalTokens = new Map(
        (personalTasks || []).map((task: any) => [String(task.id), String(task.versionToken || '')])
      );
      setTasks(
        (list || []).map((task: Task) => ({
          ...task,
          versionToken: personalTokens.get(String(task.id)) || (task as any).versionToken,
        }))
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch tasks (calendar view):', e);
      toast.error(t('myWork.errors.fetchFailed', 'Failed to load tasks'));
    } finally {
      setLoading(false);
    }
  }, [t, source]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks, refreshTrigger]);

  const filteredTasks = useMemo(() => {
    let list = tasks;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (x) => x.title?.toLowerCase().includes(q) || x.description?.toLowerCase().includes(q)
      );
    }
    if (activeFilter === 'urgent') {
      list = list.filter((x) => isUrgent(x.priority));
    }
    if (activeFilter === 'overdue') {
      list = list.filter((x) => isOverdue(x.dueDate, x.status));
    }
    if (activeFilter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      list = list.filter((x) => x.dueDate && sameDay(new Date(x.dueDate), today));
    }
    if (activeFilter === 'week') {
      const start = new Date(weekStart);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      list = list.filter((x) => {
        if (!x.dueDate) return false;
        const dd = new Date(x.dueDate);
        return dd >= start && dd < end;
      });
    }
    return list;
  }, [tasks, searchQuery, activeFilter, weekStart]);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const counts: TaskCounts = {
      total: tasks.length,
      overdue: tasks.filter((x) => isOverdue(x.dueDate, x.status)).length,
      today: tasks.filter((x) => x.dueDate && sameDay(new Date(x.dueDate), today)).length,
      week: tasks.filter(
        (x) => x.dueDate && new Date(x.dueDate) >= start && new Date(x.dueDate) < end
      ).length,
      urgent: tasks.filter((x) => isUrgent(x.priority)).length,
    };
    onCountsChange(counts);
  }, [tasks, onCountsChange, weekStart]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + idx);
      return d;
    });
  }, [weekStart]);

  const backlog = useMemo(() => {
    return filteredTasks.filter((x) => !x.dueDate && !isTaskDone(x.status));
  }, [filteredTasks]);

  const overdue = useMemo(() => {
    return filteredTasks.filter((x) => isOverdue(x.dueDate, x.status));
  }, [filteredTasks]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const d of weekDays) map.set(d.toISOString().slice(0, 10), []);
    for (const task of filteredTasks) {
      if (!task.dueDate) continue;
      const dd = new Date(task.dueDate);
      dd.setHours(0, 0, 0, 0);
      const key = dd.toISOString().slice(0, 10);
      if (!map.has(key)) continue;
      map.get(key)!.push(task);
    }
    // stable sort: priority (urgent/high first) then title
    for (const [key, arr] of map.entries()) {
      arr.sort((a, b) => {
        const ap = isUrgent(a.priority) ? 0 : 1;
        const bp = isUrgent(b.priority) ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return String(a.title || '').localeCompare(String(b.title || ''));
      });
      map.set(key, arr);
    }
    return map;
  }, [filteredTasks, weekDays]);

  const handleDueDateChange = useCallback(
    async (task: Task, dueDate: string) => {
      setUpdatingDueDate((prev) => ({ ...prev, [task.id]: true }));
      try {
        const taskType = String((task as any)?.taskType || '').toLowerCase();
        if (taskType === 'personal') {
          await Api.updatePersonalTask(task.id, {
            dueDate: dueDate || null,
            expectedVersionToken: String((task as any).versionToken || ''),
          });
        } else {
          await Api.updateTask(task.id, { dueDate: dueDate || null });
        }
        await fetchTasks();
        toast.success(t('myWork.tasks.dueDateUpdated', 'Due date updated'));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to update due date:', e);
        toast.error(t('myWork.errors.updateFailed', 'Failed to update'));
      } finally {
        setUpdatingDueDate((prev) => ({ ...prev, [task.id]: false }));
      }
    },
    [fetchTasks, t]
  );

  const todayKey = new Date().toISOString().slice(0, 10);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingState variant="spinner" label={t('common.loading', 'Loading...')} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
          <CalendarDays size={16} />
          <span>{t('myWork.calendar.title', 'Calendar')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center rounded-md border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 overflow-hidden">
            {(
              [
                { id: 'all' as const, label: t('myWork.calendar.source.all', 'All') },
                { id: 'project' as const, label: t('myWork.calendar.source.project', 'Project') },
                {
                  id: 'personal' as const,
                  label: t('myWork.calendar.source.personal', 'Personal'),
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                className={`px-2 py-1 text-xs transition-colors ${
                  source === opt.id
                    ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white font-medium'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                }`}
                onClick={() => setSource(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            className="rounded-md border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-2 py-1 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800"
            onClick={() =>
              setWeekStart((d) => {
                const next = new Date(d);
                next.setDate(next.getDate() - 7);
                return next;
              })
            }
          >
            {t('common.prev', 'Prev')}
          </button>
          <button
            className="rounded-md border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-2 py-1 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800"
            onClick={() => setWeekStart(startOfWeekMonday(new Date()))}
          >
            {t('common.today', 'Today')}
          </button>
          <button
            className="rounded-md border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-2 py-1 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800"
            onClick={() =>
              setWeekStart((d) => {
                const next = new Date(d);
                next.setDate(next.getDate() + 7);
                return next;
              })
            }
          >
            {t('common.next', 'Next')}
          </button>
        </div>
      </div>

      {overdue.length > 0 && activeFilter !== 'overdue' && (
        <div className="rounded-lg border border-danger-200 dark:border-danger-900/40 bg-danger-50/70 dark:bg-danger-500/10 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-danger-700 dark:text-danger-300">
            <Clock size={14} />
            <span>{t('myWork.calendar.overdue', 'Overdue')}</span>
            <span className="ml-1 rounded-full bg-danger-100 dark:bg-danger-500/20 px-2 py-0.5 text-[10px]">
              {overdue.length}
            </span>
          </div>
          <div className="mt-2 grid gap-1">
            {overdue.slice(0, 6).map((task) => (
              <button
                key={task.id}
                className="text-left rounded-md px-2 py-1 text-xs text-danger-800 dark:text-danger-200 hover:bg-danger-100/70 dark:hover:bg-danger-500/10"
                onClick={() => onTaskClick(task.id, task)}
              >
                {task.title || t('myWork.tasks.untitled', 'Untitled task')}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {/* Backlog */}
        <div className="rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-navy-700 px-3 py-2">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('myWork.calendar.backlog', 'Backlog (no due date)')}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">{backlog.length}</div>
          </div>
          <div className="max-h-[520px] overflow-auto p-2">
            {backlog.length === 0 ? (
              <div className="p-2 text-xs text-slate-500 dark:text-slate-400">
                {t('myWork.calendar.backlogEmpty', 'No backlog tasks')}
              </div>
            ) : (
              <div className="grid gap-2">
                {backlog.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-md border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 px-2 py-2"
                  >
                    <button
                      className="w-full text-left text-xs font-medium text-slate-800 dark:text-slate-200 hover:underline"
                      onClick={() => onTaskClick(task.id, task)}
                    >
                      {task.title || t('myWork.tasks.untitled', 'Untitled task')}
                    </button>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="date"
                        className="w-full rounded-md border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-2 py-1 text-[11px] text-slate-700 dark:text-slate-200"
                        value=""
                        onChange={(e) => handleDueDateChange(task, e.target.value)}
                        disabled={Boolean(updatingDueDate[task.id])}
                        aria-label={t('myWork.calendar.setDueDate', 'Set due date')}
                      />
                      {updatingDueDate[task.id] && (
                        <Loader2
                          size={14}
                          className="animate-spin text-slate-500 dark:text-slate-400"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Week view */}
        <div className="lg:col-span-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900">
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-navy-700">
            {weekDays.map((d) => {
              const key = d.toISOString().slice(0, 10);
              const isToday = key === todayKey;
              return (
                <div
                  key={key}
                  className={`px-2 py-2 text-center text-[11px] font-semibold ${
                    isToday
                      ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {fmtDayLabel(d, locale)}
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-7">
            {weekDays.map((d) => {
              const key = d.toISOString().slice(0, 10);
              const list = tasksByDay.get(key) || [];
              const isToday = key === todayKey;
              return (
                <div
                  key={key}
                  className={`min-h-[520px] border-r last:border-r-0 border-slate-200 dark:border-navy-700 ${
                    isToday ? 'bg-blue-50/50 dark:bg-blue-500/5' : ''
                  }`}
                >
                  <div className="p-2">
                    {list.length === 0 ? (
                      <div className="text-[11px] text-slate-600 dark:text-slate-500">
                        {t('myWork.calendar.noTasks', 'No tasks')}
                      </div>
                    ) : (
                      <div className="grid gap-1">
                        {list.map((task) => (
                          <button
                            key={task.id}
                            className={`rounded-md px-2 py-1 text-left text-[11px] transition-colors ${
                              isUrgent(task.priority)
                                ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-500/15'
                                : 'bg-slate-50 dark:bg-navy-950 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800'
                            }`}
                            onClick={() => onTaskClick(task.id, task)}
                            title={task.title}
                          >
                            {task.title || t('myWork.tasks.untitled', 'Untitled task')}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
