export function syncWorkflowPolicyErrorMessage(error: unknown, fallback: string): string {
  const record = error && typeof error === 'object' ? (error as { data?: { code?: string } }) : null;
  const code = record?.data?.code;

  if (code === 'SYNC_WORKFLOW_POLICY_INTEGRATION_NOT_FOUND') {
    return 'Integration no longer exists in the governed sync lane. Refresh integrations and retry.';
  }
  if (code === 'SYNC_WORKFLOW_POLICY_INVALID') {
    return 'Workflow policy is invalid. Choose one of: active, paused, blocked, safety_gate.';
  }
  if (code === 'SYNC_WORKFLOW_POLICY_READ_FAILED') {
    return 'Workflow policy could not be read from the sync substrate. Retry in a moment.';
  }
  if (code === 'SYNC_WORKFLOW_POLICY_UPDATE_FAILED') {
    return 'Workflow policy update failed on the governed substrate. Retry in a moment.';
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}
