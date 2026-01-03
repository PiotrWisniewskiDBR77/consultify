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
} as const;

export type LogLevel = typeof LOG_LEVELS[keyof typeof LOG_LEVELS];

export interface AuditLogParams {
    level?: LogLevel;
    event: string;
    correlation_id?: string;
    organization_id?: string;
    proposal_id?: string;
    decision_id?: string;
    execution_id?: string;
    action_type?: string;
    status?: string;
    duration_ms?: number;
    error_code?: string;
    error_message?: string;
    metadata?: Record<string, unknown>;
}

export interface AuditLogEntry {
    timestamp: string;
    level: LogLevel;
    event: string;
    correlation_id?: string;
    organization_id?: string;
    proposal_id?: string;
    decision_id?: string;
    execution_id?: string;
    action_type?: string;
    status?: string;
    duration_ms?: number;
    error_code?: string;
    error_message?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Logs a structured JSON audit event.
 */
export function log(params: AuditLogParams): AuditLogEntry {
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

    const logEntry: AuditLogEntry = {
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
    const cleanEntry = Object.fromEntries(
        Object.entries(logEntry).filter(([_, v]) => v !== undefined && v !== null)
    ) as AuditLogEntry;

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
export const info = (event: string, params: Omit<AuditLogParams, 'event' | 'level'> = {}): AuditLogEntry => 
    log({ ...params, level: LOG_LEVELS.INFO, event });

export const warn = (event: string, params: Omit<AuditLogParams, 'event' | 'level'> = {}): AuditLogEntry => 
    log({ ...params, level: LOG_LEVELS.WARN, event });

export const error = (event: string, params: Omit<AuditLogParams, 'event' | 'level'> = {}): AuditLogEntry => 
    log({ ...params, level: LOG_LEVELS.ERROR, event });

export const debug = (event: string, params: Omit<AuditLogParams, 'event' | 'level'> = {}): AuditLogEntry => 
    log({ ...params, level: LOG_LEVELS.DEBUG, event });

