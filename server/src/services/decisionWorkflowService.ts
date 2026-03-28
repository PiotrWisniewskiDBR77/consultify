/**
 * V4-EXEC-06: Decision workflow
 * propose → review → approve → publish; auto-create tasks on publish
 */

const WORKFLOW_STATUSES = ['proposed', 'review', 'approve', 'published'] as const;
export type DecisionWorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

const ALLOWED_WORKFLOW_TRANSITIONS: Record<string, DecisionWorkflowStatus[]> = {
  proposed: ['review'],
  review: ['approve', 'proposed'],
  approve: ['published', 'review'],
  published: [], // terminal
};

function normalizeWorkflowStatus(s: string | null | undefined): DecisionWorkflowStatus {
  const v = String(s || 'proposed')
    .toLowerCase()
    .replace(/[\s-]/g, '_');
  if (v === 'publish') return 'published';
  if (WORKFLOW_STATUSES.includes(v as DecisionWorkflowStatus)) return v as DecisionWorkflowStatus;
  return 'proposed';
}

export function validateDecisionWorkflowTransition(
  from: string | null | undefined,
  to: string | null | undefined
): { allowed: true } | { allowed: false; message: string } {
  const fromNorm = normalizeWorkflowStatus(from);
  const toNorm = normalizeWorkflowStatus(to);
  if (fromNorm === toNorm) return { allowed: true };
  const allowed = ALLOWED_WORKFLOW_TRANSITIONS[fromNorm];
  if (!allowed || allowed.length === 0) {
    return { allowed: false, message: `Cannot transition from ${fromNorm}` };
  }
  if (allowed.includes(toNorm)) return { allowed: true };
  return {
    allowed: false,
    message: `Cannot transition from ${fromNorm} to ${toNorm}. Allowed: ${allowed.join(', ')}`,
  };
}

export { WORKFLOW_STATUSES };
