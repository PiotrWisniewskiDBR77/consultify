const P05_ERROR_MESSAGES: Record<string, string> = {
  P05_RUN_NOT_FOUND: 'Lane run not found. Start a new finance lane.',
  P05_RUN_ID_REQUIRED: 'Run ID is required.',
  P05_OUTCOME_REQUIRED: 'Outcome is required to advance the lane step.',
  P05_INVALID_OUTCOME: 'Invalid step outcome. Check allowed actions for current step.',
  P05_PERMISSION_DENIED: 'Permission denied. Contact your organization admin.',
  P05_CONCURRENT_RUN_EXISTS: 'An active lane run already exists. Complete or cancel it first.',
  P05_SWITCHOVER_MISCONFIGURED:
    'Cannot finalize: version must be "actual" and not already finalized.',
  P05_SNAPSHOT_NOT_FOUND: 'Version snapshot not found.',
  P05_SNAPSHOT_ID_REQUIRED: 'Snapshot ID is required.',
  P05_VERSION_PARAMS_REQUIRED: 'Version type and snapshot data are required.',
  P05_AUDIT_PARAMS_REQUIRED: 'Mutation type, target entity, new value, and outcome are required.',
};

export function getFinanceErrorMessage(error: any): string {
  const code = error?.response?.data?.code || error?.code;
  if (code && P05_ERROR_MESSAGES[code]) {
    return P05_ERROR_MESSAGES[code];
  }
  const serverMessage = error?.response?.data?.error;
  if (serverMessage && typeof serverMessage === 'string') {
    return serverMessage;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'An unexpected error occurred.';
}
