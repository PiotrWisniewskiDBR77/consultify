/**
 * Audit Logger
 * Step 9.5: Structured JSON logging for AI Actions observability.
 * Outputs logs in a consistent format for monitoring, debugging, and SOC2 compliance.
 */
export declare const LOG_LEVELS: {
    readonly DEBUG: "DEBUG";
    readonly INFO: "INFO";
    readonly WARN: "WARN";
    readonly ERROR: "ERROR";
};
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
export declare function log(params: AuditLogParams): AuditLogEntry;
export declare const info: (event: string, params?: Omit<AuditLogParams, "event" | "level">) => AuditLogEntry;
export declare const warn: (event: string, params?: Omit<AuditLogParams, "event" | "level">) => AuditLogEntry;
export declare const error: (event: string, params?: Omit<AuditLogParams, "event" | "level">) => AuditLogEntry;
export declare const debug: (event: string, params?: Omit<AuditLogParams, "event" | "level">) => AuditLogEntry;
//# sourceMappingURL=auditLogger.d.ts.map