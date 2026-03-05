/**
 * Task Workflow Service — V4-TASK-03
 * Status transitions + guards for task workflow engine
 */

const TASK_STATUSES = ['todo', 'in_progress', 'blocked', 'done', 'cancelled'] as const;

/** Canonical task statuses (normalized lowercase) */
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** V4-TASK-03: Allowed status transitions. Guard blocks invalid transitions. */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  todo: ['in_progress', 'blocked', 'cancelled'],
  in_progress: ['todo', 'blocked', 'done', 'cancelled'],
  blocked: ['todo', 'in_progress', 'cancelled'],
  done: ['todo'], // reopen
  cancelled: ['todo'], // reopen
};

function normalizeStatus(s: string | null | undefined): TaskStatus {
  const v = String(s || 'todo').toLowerCase().replace(/[\s-]/g, '_');
  if (TASK_STATUSES.includes(v as TaskStatus)) return v as TaskStatus;
  // Common aliases
  if (['completed', 'complete'].includes(v)) return 'done';
  if (['in progress', 'inprogress'].includes(v)) return 'in_progress';
  if (['to do', 'to_do'].includes(v)) return 'todo';
  return 'todo';
}

/**
 * Check if status transition is allowed. Returns error message or null if valid.
 */
export function validateTaskStatusTransition(
  from: string | null | undefined,
  to: string | null | undefined
): { allowed: true } | { allowed: false; rule: string; message: string } {
  const fromNorm = normalizeStatus(from);
  const toNorm = normalizeStatus(to);
  if (fromNorm === toNorm) return { allowed: true };
  const allowed = ALLOWED_TRANSITIONS[fromNorm];
  if (!allowed) return { allowed: true }; // unknown from → allow (backward compat)
  if (allowed.includes(toNorm)) return { allowed: true };
  return {
    allowed: false,
    rule: 'INVALID_TRANSITION',
    message: `Cannot transition from ${fromNorm} to ${toNorm}. Allowed: ${allowed.join(', ')}`,
  };
}

export { TASK_STATUSES };
