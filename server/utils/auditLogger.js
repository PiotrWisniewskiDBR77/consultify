/**
 * Audit Logger
 * Step 9.5: Structured JSON logging for AI Actions observability.
 * Outputs logs in a consistent format for monitoring, debugging, and SOC2 compliance.
 */

const LOG_LEVELS = {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR'
};

/**
 * Logs a structured JSON audit event.
 * @param {Object} params - Log parameters
 * @param {string} params.level - Log level (INFO, WARN, ERROR, DEBUG)
 * @param {string} params.event - Event name (e.g., 'DECISION_RECORDED', 'EXECUTION_STARTED')
 * @param {string} [params.correlation_id] - Correlation ID for tracing
 * @param {string} [params.organization_id] - Organization ID
 * @param {string} [params.proposal_id] - Proposal ID
 * @param {string} [params.decision_id] - Decision ID
 * @param {string} [params.execution_id] - Execution ID
 * @param {string} [params.action_type] - Action type (TASK_CREATE, etc.)
 * @param {string} [params.status] - Status (SUCCESS, FAILED, etc.)
 * @param {number} [params.duration_ms] - Duration in milliseconds
 * @param {string} [params.error_code] - Error code from catalog
 * @param {string} [params.error_message] - Human-readable error message
 * @param {Object} [params.metadata] - Additional metadata
 */
function log(params) {
    const {
        level = LOG_LEVELS.INFO,
        event,
        correlation_id,
        organization_id,
        proposal_id,
        decision_id,
        execution_id,
        action_type,
        status,
        duration_ms,
        error_code,
        error_message,
        metadata
    } = params;

    const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        event,
        correlation_id: correlation_id || null,
        organization_id: organization_id || null,
        proposal_id: proposal_id || null,
        decision_id: decision_id || null,
        execution_id: execution_id || null,
        action_type: action_type || null,
        status: status || null,
        duration_ms: duration_ms !== undefined ? duration_ms : null,
        error_code: error_code || null,
        error_message: error_message || null,
        ...(metadata ? { metadata } : {})
    };

    // Clean null values for cleaner output
    const cleanEntry = Object.fromEntries(
        Object.entries(logEntry).filter(([_, v]) => v !== null)
    );

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
const info = (event, params = {}) => log({ ...params, level: LOG_LEVELS.INFO, event });
const warn = (event, params = {}) => log({ ...params, level: LOG_LEVELS.WARN, event });
const error = (event, params = {}) => log({ ...params, level: LOG_LEVELS.ERROR, event });
const debug = (event, params = {}) => log({ ...params, level: LOG_LEVELS.DEBUG, event });

module.exports = {
    LOG_LEVELS,
    log,
    info,
    warn,
    error,
    debug
};
