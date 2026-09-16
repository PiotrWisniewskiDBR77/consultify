export type TaskHubFilter = 'all' | 'overdue' | 'today' | 'week' | 'urgent' | 'new';

export interface HubFilterTask {
  id?: string | null;
  title?: string | null;
  description?: string | null;
  dueDate?: string | Date | null;
  createdAt?: string | Date | null;
  status?: string | null;
  priority?: string | null;
}

export interface TaskHubFilterOptions<T extends HubFilterTask> {
  searchQuery?: string;
  now?: Date;
  triagedTaskIds?: ReadonlySet<string>;
}

export interface TaskHubFilterCounts {
  total: number;
  overdue: number;
  today: number;
  week: number;
  urgent: number;
  newUntriaged: number;
}

export const TASK_TRIAGED_STORAGE_KEY = 'consultify-triaged-task-ids';

const COMPLETED_STATUSES = new Set(['done', 'completed', 'validated']);
const URGENT_PRIORITIES = new Set(['urgent', 'critical', 'high']);

const startOfLocalDay = (value: Date): Date => {
  const day = new Date(value);
  day.setHours(0, 0, 0, 0);
  return day;
};

export const parseTaskHubDate = (value: string | Date): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value);
  }
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const taskHubLocalDateKey = (value: string | Date): string | null => {
  const date = parseTaskHubDate(value);
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const taskDueDay = (task: HubFilterTask): Date | null => {
  if (!task.dueDate) return null;
  const due = parseTaskHubDate(task.dueDate);
  if (!due) return null;
  return startOfLocalDay(due);
};

const startOfLocalWeek = (value: Date): Date => {
  const day = startOfLocalDay(value);
  const mondayOffset = (day.getDay() + 6) % 7;
  day.setDate(day.getDate() - mondayOffset);
  return day;
};

export const isHubTaskCompleted = (task: HubFilterTask): boolean =>
  COMPLETED_STATUSES.has(String(task.status || '').toLowerCase());

export const isHubTaskUrgent = (task: HubFilterTask): boolean =>
  URGENT_PRIORITIES.has(String(task.priority || '').toLowerCase());

export const readTriagedTaskIds = (
  storage: Storage | null = globalThis.localStorage
): Set<string> => {
  try {
    const saved = storage?.getItem(TASK_TRIAGED_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
};

export const writeTriagedTaskIds = (
  taskIds: ReadonlySet<string>,
  storage: Storage | null = globalThis.localStorage
): void => {
  try {
    storage?.setItem(TASK_TRIAGED_STORAGE_KEY, JSON.stringify([...taskIds]));
  } catch {
    // Triage remains usable in memory when browser storage is unavailable.
  }
};

export const isHubTaskNew = (
  task: HubFilterTask,
  triagedTaskIds: ReadonlySet<string>,
  now = new Date()
): boolean => {
  const id = String(task.id || '');
  if (!id || triagedTaskIds.has(id) || isHubTaskCompleted(task) || !task.createdAt) return false;
  const created = new Date(task.createdAt);
  if (Number.isNaN(created.getTime())) return false;
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  return created > threeDaysAgo;
};

export const isHubTaskOverdue = (task: HubFilterTask, now = new Date()): boolean => {
  const due = taskDueDay(task);
  return Boolean(due && !isHubTaskCompleted(task) && due < startOfLocalDay(now));
};

export type TaskHubTimeBucket = 'overdue' | 'today' | 'week' | 'later' | 'no-date';

export const getTaskHubTimeBucket = (task: HubFilterTask, now = new Date()): TaskHubTimeBucket => {
  if (isHubTaskCompleted(task)) return 'later';
  const due = taskDueDay(task);
  if (!due) return 'no-date';

  const today = startOfLocalDay(now);
  const weekStart = startOfLocalWeek(today);
  const nextWeek = new Date(weekStart);
  nextWeek.setDate(nextWeek.getDate() + 7);

  if (due < today) return 'overdue';
  if (due.getTime() === today.getTime()) return 'today';
  if (due >= weekStart && due < nextWeek) return 'week';
  return 'later';
};

export const matchesTaskHubFilter = <T extends HubFilterTask>(
  task: T,
  filter: TaskHubFilter,
  options: Pick<TaskHubFilterOptions<T>, 'now' | 'triagedTaskIds'> = {}
): boolean => {
  const now = options.now ?? new Date();
  if (filter === 'all') return true;
  if (filter === 'urgent') return isHubTaskUrgent(task);
  if (filter === 'new') return isHubTaskNew(task, options.triagedTaskIds ?? new Set(), now);
  return getTaskHubTimeBucket(task, now) === filter;
};

export const filterTasksForHub = <T extends HubFilterTask>(
  tasks: readonly T[],
  filter: TaskHubFilter,
  options: TaskHubFilterOptions<T> = {}
): T[] => {
  const query = options.searchQuery?.trim().toLowerCase() || '';
  return tasks.filter((task) => {
    if (
      query &&
      !String(task.title || '')
        .toLowerCase()
        .includes(query) &&
      !String(task.description || '')
        .toLowerCase()
        .includes(query)
    ) {
      return false;
    }
    return matchesTaskHubFilter(task, filter, options);
  });
};

export const countTaskHubFilters = <T extends HubFilterTask>(
  tasks: readonly T[],
  options: TaskHubFilterOptions<T> = {}
): TaskHubFilterCounts => {
  const searchable = filterTasksForHub(tasks, 'all', options);
  return {
    total: searchable.length,
    overdue: filterTasksForHub(searchable, 'overdue', options).length,
    today: filterTasksForHub(searchable, 'today', options).length,
    week: filterTasksForHub(searchable, 'week', options).length,
    urgent: filterTasksForHub(searchable, 'urgent', options).length,
    newUntriaged: filterTasksForHub(searchable, 'new', options).length,
  };
};
