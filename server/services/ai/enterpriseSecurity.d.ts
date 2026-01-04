declare namespace _default {
    export { EnterpriseSecurityService };
    export { enterpriseSecurity };
    export { PII_PATTERNS };
    export { RISK_RULES };
    export { dbAll };
    export { dbGet };
    export { dbRun };
}
export default _default;
export class EnterpriseSecurityService {
    rateLimitCache: Map<any, any>;
    auditBuffer: any[];
    flushInterval: number;
    retentionInterval: number;
    lastRetentionRun: number;
    /**
     * Log AI audit entry
     */
    logAudit(entry: any): Promise<{
        level: string;
        flagged: boolean;
        reason: string;
    } | {
        level: string;
        flagged: boolean;
        reason: null;
    }>;
    /**
     * Assess risk level of request
     */
    assessRisk(request: any, response: any): {
        level: string;
        flagged: boolean;
        reason: string;
    } | {
        level: string;
        flagged: boolean;
        reason: null;
    };
    /**
     * Detect PII in content
     */
    detectPII(content: any): string[];
    /**
     * Sanitize PII from content
     */
    sanitizePII(content: any, truncate?: boolean): any;
    /**
     * Check rate limit for organization
     * RESILIENT: Uses fail-open pattern - if check fails, allow the request
     */
    checkRateLimit(organizationId: any, action?: string): Promise<{
        allowed: boolean;
        remaining: number;
        bypassed: boolean;
        resetAt?: undefined;
        limitType?: undefined;
        limit?: undefined;
        error?: undefined;
    } | {
        allowed: boolean;
        remaining: number;
        bypassed?: undefined;
        resetAt?: undefined;
        limitType?: undefined;
        limit?: undefined;
        error?: undefined;
    } | {
        allowed: boolean;
        remaining: number;
        resetAt: Date;
        limitType: any;
        limit: any;
        bypassed?: undefined;
        error?: undefined;
    } | {
        allowed: boolean;
        remaining: number;
        bypassed: boolean;
        error: any;
        resetAt?: undefined;
        limitType?: undefined;
        limit?: undefined;
    }>;
    /**
     * Get organization rate limits from database
     * Returns empty array on any failure (fail-open)
     */
    getOrganizationLimits(organizationId: any, action: any): Promise<any[]>;
    /**
     * Get usage count for rate limiting
     * Returns 0 on any failure (fail-open)
     */
    getUsage(organizationId: any, action: any, limitType: any): Promise<any>;
    /**
     * Get time window for limit type
     */
    getTimeWindow(limitType: any): "-1 minute" | "-1 hour" | "-1 day" | "-1 month";
    /**
     * Get reset time for limit type
     */
    getResetTime(limitType: any): Date;
    /**
     * Log data access (non-blocking)
     */
    logDataAccess(entry: any): Promise<void>;
    /**
     * Build filter query conditions
     * @private
     */
    private _buildAuditFilterQuery;
    /**
     * Get audit log entries
     * Returns empty array on any failure
     */
    getAuditLog(filters?: {}): Promise<any[]>;
    /**
     * Get total count of audit log entries matching filters
     */
    getAuditLogCount(filters?: {}): Promise<any>;
    /**
     * Flush audit buffer to database
     * Non-blocking with retry on failure
     */
    flushAuditBuffer(): Promise<void>;
    /**
     * Start buffer flush interval
     */
    startFlushInterval(): void;
    /**
     * Prune old audit logs based on retention policy (default 365 days)
     */
    runRetentionPolicy(days?: number): Promise<boolean>;
    /**
     * Get security summary for organization
     */
    getSecuritySummary(organizationId: any): Promise<{
        period: string;
        totalRequests: any;
        flaggedRequests: any;
        highRiskCount: any;
        mediumRiskCount: any;
        dataAccessCount: any;
        dataTypesAccessed: any;
        error?: undefined;
    } | {
        period: string;
        totalRequests: number;
        flaggedRequests: number;
        highRiskCount: number;
        mediumRiskCount: number;
        dataAccessCount: number;
        dataTypesAccessed: number;
        error: any;
    }>;
}
export const enterpriseSecurity: EnterpriseSecurityService;
export namespace PII_PATTERNS {
    let email: RegExp;
    let phone: RegExp;
    let pesel: RegExp;
    let nip: RegExp;
    let creditCard: RegExp;
    let iban: RegExp;
}
export namespace RISK_RULES {
    let HIGH: {
        pattern: RegExp;
        reason: string;
    }[];
    let MEDIUM: {
        pattern: RegExp;
        reason: string;
    }[];
}
/**
 * Promise wrapper for db.all() - returns array of rows
 * Works with both SQLite3 (callback-based) and PostgreSQL (hybrid Promise/callback)
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} - Array of rows (empty on error)
 */
export function dbAll(sql: string, params?: any[]): Promise<any[]>;
/**
 * Promise wrapper for db.get() - returns single row
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object|null>} - Single row or null
 */
export function dbGet(sql: string, params?: any[]): Promise<Object | null>;
/**
 * Promise wrapper for db.run() - executes INSERT/UPDATE/DELETE
 * @param {string} sql - SQL statement
 * @param {Array} params - Statement parameters
 * @returns {Promise<{success: boolean, lastID?: number, changes?: number}>}
 */
export function dbRun(sql: string, params?: any[]): Promise<{
    success: boolean;
    lastID?: number;
    changes?: number;
}>;
//# sourceMappingURL=enterpriseSecurity.d.ts.map