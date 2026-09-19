const CLOSED = new Set(['COMPLETED', 'DONE', 'DECIDED', 'APPROVED', 'CANCELED', 'CANCELLED']);

export type RuntimeExecutionTaskRow = {
  aggregate_id: string;
  version: number;
  payload_json: Record<string, unknown>;
  initiative_id?: string | null;
  project_id?: string | null;
  project_title?: string | null;
};

export type WorkTabTaskRow = {
  aggregate_id: string;
  title: string | null;
  status: string | null;
  assignee_id: string | null;
  owner_id: string | null;
  due_date: string | Date | null;
  completed_at: string | Date | null;
  priority: string | null;
  initiative_id: string | null;
  project_id: string | null;
  project_title: string | null;
};

export type ExecutionWorkTaskItem = {
  id: string;
  taskId: string;
  kind: 'TASK';
  title: string;
  status: string;
  ownerId: string | null;
  assigneeId: string | null;
  dueAt: string | null;
  completedAt: string | null;
  priority: string;
  version: number;
  initiativeId: string | null;
  projectId: string | null;
  projectTitle: string | null;
  sourceType: 'runtime-v1' | 'tasks';
  [key: string]: unknown;
};

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function isoValue(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  return stringValue(value);
}

function runtimeTaskItem(row: RuntimeExecutionTaskRow): ExecutionWorkTaskItem {
  const value = row.payload_json;
  const taskId = row.aggregate_id;
  return {
    ...value,
    id: taskId,
    taskId,
    kind: 'TASK',
    title: stringValue(value.title) ?? taskId,
    status: stringValue(value.status) ?? 'UNKNOWN',
    ownerId: stringValue(value.assigneeId) ?? stringValue(value.ownerId),
    assigneeId: stringValue(value.assigneeId) ?? stringValue(value.ownerId),
    dueAt: stringValue(value.dueAt) ?? stringValue(value.targetAt),
    completedAt: stringValue(value.completedAt) ?? stringValue(value.decidedAt),
    priority: stringValue(value.priority) ?? 'UNKNOWN',
    version: row.version,
    initiativeId: row.initiative_id ?? null,
    projectId: row.project_id ?? null,
    projectTitle: row.project_title ?? null,
    sourceType: 'runtime-v1',
  };
}

function workTabTaskItem(row: WorkTabTaskRow): ExecutionWorkTaskItem {
  const taskId = row.aggregate_id;
  const ownerId = stringValue(row.assignee_id) ?? stringValue(row.owner_id);
  return {
    id: taskId,
    taskId,
    kind: 'TASK',
    title: stringValue(row.title) ?? taskId,
    status: stringValue(row.status) ?? 'UNKNOWN',
    ownerId,
    assigneeId: ownerId,
    dueAt: isoValue(row.due_date),
    completedAt: isoValue(row.completed_at),
    priority: stringValue(row.priority) ?? 'UNKNOWN',
    version: 1,
    initiativeId: row.initiative_id,
    projectId: row.project_id,
    projectTitle: row.project_title,
    sourceType: 'tasks',
  };
}

export function buildExecutionWorkTaskItems(args: {
  runtimeRows: RuntimeExecutionTaskRow[];
  taskRows: WorkTabTaskRow[];
}): ExecutionWorkTaskItem[] {
  const runtimeItems = args.runtimeRows.map(runtimeTaskItem);
  const runtimeTaskIds = new Set(runtimeItems.map((item) => item.taskId));
  const taskItems = args.taskRows
    .map(workTabTaskItem)
    .filter((item) => !runtimeTaskIds.has(item.taskId));
  return [...runtimeItems, ...taskItems];
}

export function countExecutionWorkTasks(items: Array<{ status: string; dueAt: string | null }>, now = Date.now()) {
  const isClosed = (status: string) => CLOSED.has(status.toUpperCase());
  return {
    total: items.length,
    overdue: items.filter((item) => !isClosed(item.status) && item.dueAt && Date.parse(item.dueAt) < now).length,
    blocked: items.filter((item) => item.status.toUpperCase() === 'BLOCKED').length,
  };
}

export function assertNonEmptyExecutionWorkSnapshot(args: {
  taskItems: ExecutionWorkTaskItem[];
  decisionItems: unknown[];
  sourceTaskCount: number;
  sourceDecisionCount: number;
}): void {
  if (
    args.taskItems.length === 0 &&
    args.decisionItems.length === 0 &&
    (args.sourceTaskCount > 0 || args.sourceDecisionCount > 0)
  ) {
    throw new Error('EXECUTION_WORK_ANALYSIS_EMPTY_SNAPSHOT');
  }
}
