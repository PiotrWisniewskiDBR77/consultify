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

export function parseTaskStatus(s: string | null | undefined): TaskStatus | null {
  const raw = String(s ?? '').trim();
  if (!raw) return null;
  const v = raw.toLowerCase().replace(/[\s-]/g, '_');
  if (TASK_STATUSES.includes(v as TaskStatus)) return v as TaskStatus;
  // Common aliases
  if (['completed', 'complete'].includes(v)) return 'done';
  if (['inprogress', 'active'].includes(v)) return 'in_progress';
  if (v === 'in_review') return 'review';
  if (['to_do', 'pending', 'new', 'open', 'not_started'].includes(v)) return 'todo';
  if (['paused', 'hold', 'waiting'].includes(v)) return 'on_hold';
  if (v === 'validated') return 'done';
  return null;
}

export function normalizeTaskStatus(s: string | null | undefined): TaskStatus {
  return parseTaskStatus(s) ?? 'todo';
}

export function getAllowedTaskTransitions(from: string | null | undefined): TaskStatus[] {
  const fromNorm = parseTaskStatus(from);
  return fromNorm ? [...ALLOWED_TRANSITIONS[fromNorm]] : [];
}

/**
 * Check if status transition is allowed. Returns error message or null if valid.
 */
export function validateTaskStatusTransition(
  from: string | null | undefined,
  to: string | null | undefined
): { allowed: true } | { allowed: false; rule: string; message: string } {
  const fromNorm = parseTaskStatus(from);
  if (!fromNorm) {
    return {
      allowed: false,
      rule: 'INVALID_CURRENT_STATUS',
      message: `Unknown current task status: ${String(from ?? '')}`,
    };
  }
  const toNorm = parseTaskStatus(to);
  if (!toNorm) {
    return {
      allowed: false,
      rule: 'INVALID_STATUS',
      message: `Unknown task status: ${String(to ?? '')}`,
    };
  }
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
