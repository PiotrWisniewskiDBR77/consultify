/**
 * Task Workflow Service — V4-TASK-03
 * Status transitions + guards for task workflow engine
 */

const TASK_STATUSES = [
  'backlog',
  'todo',
  'in_progress',
  'review',
  'blocked',
  'on_hold',
  'done',
  'cancelled',
] as const;

/** Canonical task statuses (normalized lowercase) */
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** V4-TASK-03: Allowed status transitions. Guard blocks invalid transitions. */
const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  backlog: ['todo', 'in_progress', 'cancelled'],
  todo: ['backlog', 'in_progress', 'review', 'blocked', 'cancelled'],
  in_progress: ['backlog', 'todo', 'review', 'blocked', 'on_hold', 'done', 'cancelled'],
  review: ['todo', 'in_progress', 'blocked', 'on_hold', 'done', 'cancelled'],
  blocked: ['todo', 'in_progress', 'review', 'on_hold', 'cancelled'],
  on_hold: ['todo', 'in_progress', 'review', 'blocked', 'cancelled'],
  done: ['todo', 'in_progress'], // reopen
  cancelled: ['backlog', 'todo'], // reopen
};

export function normalizeTaskStatus(s: string | null | undefined): TaskStatus {
  const v = String(s || 'todo')
    .toLowerCase()
    .replace(/[\s-]/g, '_');
  if (TASK_STATUSES.includes(v as TaskStatus)) return v as TaskStatus;
  // Common aliases
  if (['completed', 'complete'].includes(v)) return 'done';
  if (['in progress', 'inprogress'].includes(v)) return 'in_progress';
  if (['to do', 'to_do'].includes(v)) return 'todo';
  if (['paused', 'hold'].includes(v)) return 'on_hold';
  return 'todo';
}

export function getAllowedTaskTransitions(from: string | null | undefined): TaskStatus[] {
  return [...ALLOWED_TRANSITIONS[normalizeTaskStatus(from)]];
}

/**
 * Check if status transition is allowed. Returns error message or null if valid.
 */
export function validateTaskStatusTransition(
  from: string | null | undefined,
  to: string | null | undefined
): { allowed: true } | { allowed: false; rule: string; message: string } {
  const fromNorm = normalizeTaskStatus(from);
  const toNorm = normalizeTaskStatus(to);
  if (fromNorm === toNorm) return { allowed: true };
  const allowed = ALLOWED_TRANSITIONS[fromNorm];
  if (allowed.includes(toNorm)) return { allowed: true };
  return {
    allowed: false,
    rule: 'INVALID_TRANSITION',
    message: `Cannot transition from ${fromNorm} to ${toNorm}. Allowed: ${allowed.join(', ')}`,
  };
}

export { TASK_STATUSES };
