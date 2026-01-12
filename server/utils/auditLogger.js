/**
 * Audit Logger
 * Step 9.5: Structured JSON logging for AI Actions observability.
 * Outputs logs in a consistent format for monitoring, debugging, and SOC2 compliance.
 */
export const LOG_LEVELS = {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR'
};
/**
 * Logs a structured JSON audit event.
 */
export function log(params) {
    const { level = LOG_LEVELS.INFO, event, correlation_id, organization_id, proposal_id, decision_id, execution_id, action_type, status, duration_ms, error_code, error_message, metadata } = params;
    const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        event,
        correlation_id: correlation_id || undefined,
        organization_id: organization_id || undefined,
        proposal_id: proposal_id || undefined,
        decision_id: decision_id || undefined,
        execution_id: execution_id || undefined,
        action_type: action_type || undefined,
        status: status || undefined,
        duration_ms: duration_ms !== undefined ? duration_ms : undefined,
        error_code: error_code || undefined,
        error_message: error_message || undefined,
        ...(metadata ? { metadata } : {})
    };
    // Clean undefined values for cleaner output
    const cleanEntry = Object.fromEntries(Object.entries(logEntry).filter(([_, v]) => v !== undefined && v !== null));
    const jsonLine = JSON.stringify(cleanEntry);
    // Output based on level
    switch (level) {
        case LOG_LEVELS.ERROR:
            console.error(`[AUDIT] ${jsonLine}`);
            break;
        case LOG_LEVELS.WARN:
            console.warn(`[AUDIT] ${jsonLine}`);
            break;
        case LOG_LEVELS.DEBUG:
            if (process.env.NODE_ENV !== 'production') {
                console.log(`[AUDIT] ${jsonLine}`);
            }
            break;
        default:
            console.log(`[AUDIT] ${jsonLine}`);
    }
    return cleanEntry;
}
// Convenience methods
export const info = (event, params = {}) => log({ ...params, level: LOG_LEVELS.INFO, event });
export const warn = (event, params = {}) => log({ ...params, level: LOG_LEVELS.WARN, event });
export const error = (event, params = {}) => log({ ...params, level: LOG_LEVELS.ERROR, event });
export const debug = (event, params = {}) => log({ ...params, level: LOG_LEVELS.DEBUG, event });
//# sourceMappingURL=auditLogger.js.map