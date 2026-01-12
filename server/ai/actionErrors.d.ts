declare namespace _default {
    export { ACTION_ERROR_CODES };
    export { classifyError };
}
export default _default;
declare namespace ACTION_ERROR_CODES {
    let RBAC_DENIED: string;
    let NOT_FOUND: string;
    let VALIDATION_ERROR: string;
    let CONFLICT_409: string;
    let EXECUTION_ERROR: string;
    let INTEGRATION_ERROR: string;
    let TIMEOUT: string;
    let ALREADY_EXECUTED: string;
    let MISSING_INPUTS: string;
    let JOB_NOT_FOUND: string;
    let JOB_INVALID_STATE: string;
    let JOB_MAX_RETRIES: string;
    let JOB_ORG_MISMATCH: string;
    let PLAYBOOK_ADVANCE_FAILED: string;
}
/**
 * Maps an error to a standardized error code.
 * @param {Error|string} error - The error object or message
 * @param {string} [defaultCode] - Fallback code if not determinable
 * @returns {string} Standardized error code
 */
declare function classifyError(error: Error | string, defaultCode?: string): string;
//# sourceMappingURL=actionErrors.d.ts.map