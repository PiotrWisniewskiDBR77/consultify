export function workCanvasActionErrorMessage(error: unknown, fallback: string): string {
  const record =
    error && typeof error === 'object' ? (error as { data?: { code?: string } }) : null;
  const code = record?.data?.code;

  if (code === 'CANVAS_DRAFT_CONFLICT') {
    return 'Canvas changed elsewhere. Your local edits are still visible. Reload latest or retry from the current draft before applying this action.';
  }
  if (code === 'CANVAS_PROPOSAL_IDEMPOTENCY_CONFLICT') {
    return 'This handoff retry no longer matches its original draft, target, or payload. No object was created. Start a new handoff from the current Canvas.';
  }
  if (code === 'CANVAS_WORKFLOW_REVIEW_REQUIRED') {
    return 'Workflow is still in review. Mark the workflow approved before generating a durable output.';
  }
  if (code === 'CANVAS_WORKFLOW_TERMINAL_STATE') {
    return 'Workflow is already completed or failed. Use the output ledger or resume the workflow before running another step.';
  }
  if (code === 'WORK_CANVAS_WORKFLOW_TEMPLATE_INVALID') {
    return 'Workflow template is invalid. Choose a supported template before starting this workflow.';
  }
  if (code === 'WORK_CANVAS_WORKFLOW_RUN_NOT_FOUND') {
    return 'Workflow run was not found. Refresh the Canvas workflow list and retry.';
  }
  if (code === 'WORK_CANVAS_WORKFLOW_PERSIST_FAILED') {
    return 'Workflow changes could not be persisted. Retry in a moment.';
  }
  if (code === 'WORK_CANVAS_WORKFLOW_LIFECYCLE_INVALID') {
    return 'Workflow lifecycle transition is invalid for the current step state.';
  }
  if (code === 'WORK_CANVAS_WORKFLOW_CONTEXT_MISMATCH') {
    return 'Workflow context changed. Refresh the draft and retry the workflow action.';
  }
  if (code === 'WORK_CANVAS_WORKFLOW_COMMENT_BODY_REQUIRED') {
    return 'Workflow comment body is required before submitting.';
  }

  return fallback;
}
