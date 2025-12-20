/**
 * Action Error Codes Catalog
 * Step 9.5: Standardized error codes for AI Actions system.
 * Use these codes in action_executions.error_code and structured logs.
 */

const ACTION_ERROR_CODES = {
    // RBAC / Authorization
    RBAC_DENIED: 'RBAC_DENIED',

    // Resource Not Found
    NOT_FOUND: 'NOT_FOUND',

    // Validation Failures
    VALIDATION_ERROR: 'VALIDATION_ERROR',

    // Conflict (e.g., double approval)
    CONFLICT_409: 'CONFLICT_409',

    // Execution Errors (internal)
    EXECUTION_ERROR: 'EXECUTION_ERROR',

    // External Integration Errors
    INTEGRATION_ERROR: 'INTEGRATION_ERROR',

    // Timeout
    TIMEOUT: 'TIMEOUT',

    // Already Executed (idempotency)
    ALREADY_EXECUTED: 'ALREADY_EXECUTED',

    // Missing required inputs
    MISSING_INPUTS: 'MISSING_INPUTS',

    // Step 11: Async Job Error Codes
    JOB_NOT_FOUND: 'JOB_NOT_FOUND',
    JOB_INVALID_STATE: 'JOB_INVALID_STATE',
    JOB_MAX_RETRIES: 'JOB_MAX_RETRIES',
    JOB_ORG_MISMATCH: 'JOB_ORG_MISMATCH',
    PLAYBOOK_ADVANCE_FAILED: 'PLAYBOOK_ADVANCE_FAILED'
};

/**
 * Maps an error to a standardized error code.
 * @param {Error|string} error - The error object or message
 * @param {string} [defaultCode] - Fallback code if not determinable
 * @returns {string} Standardized error code
 */
function classifyError(error, defaultCode = ACTION_ERROR_CODES.EXECUTION_ERROR) {
    const message = (error?.message || String(error)).toLowerCase();

    if (message.includes('forbidden') || message.includes('rbac') || message.includes('unauthorized')) {
        return ACTION_ERROR_CODES.RBAC_DENIED;
    }
    if (message.includes('not found') || message.includes('404')) {
        return ACTION_ERROR_CODES.NOT_FOUND;
    }
    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
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

module.exports = {
    ACTION_ERROR_CODES,
    classifyError
};
