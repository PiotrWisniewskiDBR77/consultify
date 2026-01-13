/**
 * Action Error Codes Catalog
 * Step 9.5: Standardized error codes for AI Actions system.
 * Use these codes in action_executions.error_code and structured logs.
 */

export const ACTION_ERROR_CODES = {
  // Playbook & Step Errors
  STEP_NOT_FOUND: 'STEP_NOT_FOUND',
  PLAYBOOK_NOT_FOUND: 'PLAYBOOK_NOT_FOUND',
  STEP_EXECUTION_FAILED: 'STEP_EXECUTION_FAILED',
  CONDITION_EVALUATION_FAILED: 'CONDITION_EVALUATION_FAILED',

  // Decision & Action Errors
  DECISION_NOT_FOUND: 'DECISION_NOT_FOUND',
  ACTION_NOT_FOUND: 'ACTION_NOT_FOUND',
  ACTION_EXECUTION_FAILED: 'ACTION_EXECUTION_FAILED',
  INVALID_ACTION_TYPE: 'INVALID_ACTION_TYPE',
  MISSING_INPUTS: 'MISSING_INPUTS',
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  // Security & Access Errors
  RBAC_DENIED: 'RBAC_DENIED',
  JOB_ORG_MISMATCH: 'JOB_ORG_MISMATCH',
  UNAUTHORIZED_ACTION: 'UNAUTHORIZED_ACTION',

  // System Errors
  ALREADY_EXECUTED: 'ALREADY_EXECUTED',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  EXECUTION_ERROR: 'EXECUTION_ERROR',
  CONFLICT_409: 'CONFLICT_409',
  TIMEOUT: 'TIMEOUT',
  INTEGRATION_ERROR: 'INTEGRATION_ERROR',

  // Async Job Error Codes (from original, re-added)
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',
  JOB_INVALID_STATE: 'JOB_INVALID_STATE',
  JOB_MAX_RETRIES: 'JOB_MAX_RETRIES',
  PLAYBOOK_ADVANCE_FAILED: 'PLAYBOOK_ADVANCE_FAILED',
};

/**
 * Maps an error to a standardized error code.
 * @param {Error|string} error - The error object or message
 * @param {string} [defaultCode] - Fallback code if not determinable
 * @returns {string} Standardized error code
 */
function classifyError(error: any, defaultCode = ACTION_ERROR_CODES.EXECUTION_ERROR) {
  const message = (error?.message || String(error)).toLowerCase();

  if (
    message.includes('forbidden') ||
    message.includes('rbac') ||
    message.includes('unauthorized')
  ) {
    return ACTION_ERROR_CODES.RBAC_DENIED;
  }
  if (message.includes('not found') || message.includes('404')) {
    return ACTION_ERROR_CODES.NOT_FOUND;
  }
  if (
    message.includes('validation') ||
    message.includes('invalid') ||
    message.includes('required')
  ) {
    return ACTION_ERROR_CODES.VALIDATION_ERROR;
  }
  if (message.includes('conflict') || message.includes('409') || message.includes('already')) {
    return ACTION_ERROR_CODES.CONFLICT_409;
  }
  if (message.includes('timeout') || message.includes('timed out')) {
    return ACTION_ERROR_CODES.TIMEOUT;
  }
  if (message.includes('integration') || message.includes('external') || message.includes('api')) {
    return ACTION_ERROR_CODES.INTEGRATION_ERROR;
  }

  return defaultCode;
}

// Redundant export block removed

export default {
  ACTION_ERROR_CODES,
  classifyError,
};
