/**
 * Enterprise Security Service for AI
 * 
 * Provides security, compliance, and audit features for enterprise deployments.
 * Features:
 * - Audit logging
 * - Data access tracking
 * - Rate limiting per organization
 * - Content filtering
 * - PII detection
 * 
 * RESILIENCE FEATURES:
 * - All DB calls wrapped in Promises (SQLite3 compatibility)
 * - Fail-open pattern: on errors, allow requests rather than block
 * - Defensive type checking to prevent "is not iterable" errors
 */

import { getDatabase } from '../../src/database/Database.ts';
const db = getDatabase();
import { aiLogger } from './logger.js';

// =============================================================================
// DATABASE PROMISE HELPERS (SQLite3 uses callbacks, not Promises!)
// =============================================================================

/**
 * Promise wrapper for db.all() - returns array of rows
 * Works with both SQLite3 (callback-based) and PostgreSQL (hybrid Promise/callback)
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} - Array of rows (empty on error)
 */
function dbAll(sql, params = []) {
    return new Promise((resolve) => {
        let resolved = false;

        // Timeout protection - don't hang forever
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                aiLogger.warn('EnterpriseSecurity', 'DB query timeout, returning empty');
                resolve([]);
            }
        }, 5000);

        const safeResolve = (result) => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                // Ensure we always return an array
                if (Array.isArray(result)) {
                    resolve(result);
                } else if (result === null || result === undefined) {
                    resolve([]);
                } else {
                    aiLogger.warn('EnterpriseSecurity', `Unexpected result type: ${typeof result}`);
                    resolve([]);
                }
            }
        };

        try {
            // Check if db.all exists
            if (typeof db.all !== 'function') {
                aiLogger.warn('EnterpriseSecurity', 'db.all is not a function');
                safeResolve([]);
                return;
            }

            db.all(sql, params, (err, rows) => {
                if (err) {
                    aiLogger.warn('EnterpriseSecurity', `DB all error: ${err.message}`);
                    safeResolve([]); // Fail-open: return empty array
                } else {
                    safeResolve(rows);
                }
            });
        } catch (error) {
            aiLogger.warn('EnterpriseSecurity', `DB all exception: ${error.message}`);
            safeResolve([]);
        }
    });
}

/**
 * Promise wrapper for db.get() - returns single row
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object|null>} - Single row or null
 */
function dbGet(sql, params = []) {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            aiLogger.warn('EnterpriseSecurity', 'DB get timeout, returning null');
            resolve(null);
        }, 5000);

        try {
            db.get(sql, params, (err, row) => {
                clearTimeout(timeout);
                if (err) {
                    aiLogger.warn('EnterpriseSecurity', `DB get error: ${err.message}`);
                    resolve(null);
                } else {
                    resolve(row || null);
                }
            });
        } catch (error) {
            clearTimeout(timeout);
            aiLogger.warn('EnterpriseSecurity', `DB get exception: ${error.message}`);
            resolve(null);
        }
    });
}

/**
 * Promise wrapper for db.run() - executes INSERT/UPDATE/DELETE
 * @param {string} sql - SQL statement
 * @param {Array} params - Statement parameters
 * @returns {Promise<{success: boolean, lastID?: number, changes?: number}>}
 */
function dbRun(sql, params = []) {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            aiLogger.warn('EnterpriseSecurity', 'DB run timeout');
            resolve({ success: false, error: 'timeout' });
        }, 5000);

        try {
            db.run(sql, params, function (err) {
                clearTimeout(timeout);
                if (err) {
                    aiLogger.warn('EnterpriseSecurity', `DB run error: ${err.message}`);
                    resolve({ success: false, error: err.message });
                } else {
                    resolve({ success: true, lastID: this.lastID, changes: this.changes });
                }
            });
        } catch (error) {
            clearTimeout(timeout);
            aiLogger.warn('EnterpriseSecurity', `DB run exception: ${error.message}`);
            resolve({ success: false, error: error.message });
        }
    });
}

// =============================================================================
// PII & RISK PATTERNS
// =============================================================================

// PII patterns for detection
const PII_PATTERNS = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    phone: /(?:\+?48[\s-]?)?(?:\d{3}[\s-]?\d{3}[\s-]?\d{3}|\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2})/g,
    pesel: /\b\d{11}\b/g,
    nip: /\b\d{10}\b|\b\d{3}[-]?\d{3}[-]?\d{2}[-]?\d{2}\b/g,
    creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    iban: /[A-Z]{2}\d{2}[\s]?\d{4}/g // Truncated pattern for IBAN detection
};

// Risk assessment rules
const RISK_RULES = {
    HIGH: [
        { pattern: /password|hasło|tajne|secret|credential/i, reason: 'Sensitive keyword detected' },
        { pattern: /delete|usuń|kasuj|wymaż/i, reason: 'Destructive action requested' },
        { pattern: /admin|root|superuser/i, reason: 'Admin access mentioned' }
    ],
    MEDIUM: [
        { pattern: /export|eksport|download|pobierz/i, reason: 'Data export requested' },
        { pattern: /share|udostępnij|send|wyślij/i, reason: 'Data sharing action' }
    ]
};

// =============================================================================
// ENTERPRISE SECURITY SERVICE
// =============================================================================

class EnterpriseSecurityService {
    constructor() {
        this.rateLimitCache = new Map();
        this.auditBuffer = [];
        this.flushInterval = 5000; // 5 seconds
        this.retentionInterval = 24 * 60 * 60 * 1000; // 24 hours
        this.lastRetentionRun = Date.now();

        // Start buffer flush interval
        this.startFlushInterval();
    }

    /**
     * Log AI audit entry
     */
    async logAudit(entry) {
        try {
            const {
                userId,
                organizationId,
                action,
                resourceType,
                resourceId,
                requestSummary,
                responseSummary,
                modelUsed,
                tokensUsed,
                costUsd,
                ipAddress,
                userAgent
            } = entry;

            // Assess risk level
            const riskAssessment = this.assessRisk(requestSummary, responseSummary);

            const auditEntry = {
                id: require('crypto').randomUUID(),
                timestamp: new Date().toISOString(),
                user_id: userId,
                organization_id: organizationId,
                action,
                resource_type: resourceType,
                resource_id: resourceId,
                request_summary: this.sanitizePII(requestSummary),
                response_summary: this.sanitizePII(responseSummary, true),
                model_used: modelUsed,
                tokens_used: tokensUsed,
                cost_usd: costUsd,
                ip_address: ipAddress,
                user_agent: userAgent,
                risk_level: riskAssessment.level,
                flagged: riskAssessment.flagged,
                flag_reason: riskAssessment.reason
            };

            // Add to buffer for batch insert
            this.auditBuffer.push(auditEntry);

            // Alert on high risk
            if (riskAssessment.flagged) {
                aiLogger.warn('EnterpriseSecurity',
                    `Flagged AI request: ${riskAssessment.reason} (user: ${userId})`);
            }

            return riskAssessment;
        } catch (error) {
            // Don't let audit logging break the main flow
            aiLogger.error('EnterpriseSecurity', `logAudit failed: ${error.message}`);
            return { level: 'LOW', flagged: false, reason: null };
        }
    }

    /**
     * Assess risk level of request
     */
    assessRisk(request, response) {
        try {
            const content = `${request || ''} ${response || ''}`.toLowerCase();

            // Check high risk patterns
            for (const rule of RISK_RULES.HIGH) {
                if (rule.pattern.test(content)) {
                    return {
                        level: 'HIGH',
                        flagged: true,
                        reason: rule.reason
                    };
                }
            }

            // Check medium risk patterns
            for (const rule of RISK_RULES.MEDIUM) {
                if (rule.pattern.test(content)) {
                    return {
                        level: 'MEDIUM',
                        flagged: false,
                        reason: rule.reason
                    };
                }
            }

            // Check for PII
            const piiFound = this.detectPII(content);
            if (piiFound.length > 0) {
                return {
                    level: 'MEDIUM',
                    flagged: piiFound.length > 3,
                    reason: `PII detected: ${piiFound.join(', ')}`
                };
            }

            return {
                level: 'LOW',
                flagged: false,
                reason: null
            };
        } catch (error) {
            aiLogger.warn('EnterpriseSecurity', `assessRisk error: ${error.message}`);
            return { level: 'LOW', flagged: false, reason: null };
        }
    }

    /**
     * Detect PII in content
     */
    detectPII(content) {
        const found = [];

        try {
            for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
                // Reset regex lastIndex for global patterns
                pattern.lastIndex = 0;
                if (pattern.test(content)) {
                    found.push(type);
                }
            }
        } catch (error) {
            aiLogger.warn('EnterpriseSecurity', `detectPII error: ${error.message}`);
        }

        return found;
    }

    /**
     * Sanitize PII from content
     */
    sanitizePII(content, truncate = false) {
        if (!content) return content;

        try {
            let sanitized = content;

            for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
                sanitized = sanitized.replace(pattern, `[${type.toUpperCase()}_REDACTED]`);
            }

            if (truncate && sanitized.length > 500) {
                sanitized = sanitized.substring(0, 500) + '... [TRUNCATED]';
            }

            return sanitized;
        } catch (error) {
            return content?.substring(0, 500) || '';
        }
    }

    /**
     * Check rate limit for organization
     * RESILIENT: Uses fail-open pattern - if check fails, allow the request
     */
    async checkRateLimit(organizationId, action = 'all') {
        try {
            // Get limits from database
            let limits;
            try {
                limits = await this.getOrganizationLimits(organizationId, action);
            } catch (fetchError) {
                aiLogger.warn('EnterpriseSecurity', `Failed to fetch limits (allowing): ${fetchError.message}`);
                return { allowed: true, remaining: Infinity, bypassed: true };
            }

            // ULTRA-DEFENSIVE: Triple-check limits is iterable
            if (limits === null || limits === undefined) {
                aiLogger.debug('EnterpriseSecurity', 'Limits is null/undefined, allowing request');
                return { allowed: true, remaining: Infinity };
            }

            if (!Array.isArray(limits)) {
                aiLogger.warn('EnterpriseSecurity', `Limits is not an array (${typeof limits}), allowing request`);
                return { allowed: true, remaining: Infinity, bypassed: true };
            }

            if (limits.length === 0) {
                // No limits configured - allow request
                return { allowed: true, remaining: Infinity };
            }

            // Safe iteration with try-catch
            try {
                for (const limit of limits) {
                    if (!limit || typeof limit !== 'object') continue;

                    const usage = await this.getUsage(organizationId, action, limit.limit_type);

                    if (usage >= limit.limit_value) {
                        return {
                            allowed: false,
                            remaining: 0,
                            resetAt: this.getResetTime(limit.limit_type),
                            limitType: limit.limit_type,
                            limit: limit.limit_value
                        };
                    }
                }
            } catch (iterError) {
                aiLogger.error('EnterpriseSecurity', `Iteration error (allowing): ${iterError.message}`);
                return { allowed: true, remaining: Infinity, bypassed: true, error: iterError.message };
            }

            return { allowed: true, remaining: limits[0]?.limit_value - 1 || Infinity };
        } catch (error) {
            // FAIL-OPEN: On any error, allow the request to proceed
            aiLogger.error('EnterpriseSecurity', `Rate limit check failed (allowing): ${error.message}`);
            return { allowed: true, remaining: Infinity, bypassed: true, error: error.message };
        }
    }

    /**
     * Get organization rate limits from database
     * Returns empty array on any failure (fail-open)
     */
    async getOrganizationLimits(organizationId, action) {
        try {
            const rows = await dbAll(`
                SELECT * FROM ai_rate_limits
                WHERE organization_id = ? AND (applies_to = 'all' OR applies_to = ?)
            `, [organizationId, action]);

            return Array.isArray(rows) ? rows : [];
        } catch (error) {
            aiLogger.debug('EnterpriseSecurity', `Limit fetch failed: ${error.message}`);
            return [];
        }
    }

    /**
     * Get usage count for rate limiting
     * Returns 0 on any failure (fail-open)
     */
    async getUsage(organizationId, action, limitType) {
        try {
            const timeWindow = this.getTimeWindow(limitType);

            const result = await dbGet(`
                SELECT COUNT(*) as count FROM ai_audit_log
                WHERE organization_id = ? 
                  AND timestamp > datetime('now', ?)
                  AND (? = 'all' OR action = ?)
            `, [organizationId, timeWindow, action, action]);

            return result?.count || 0;
        } catch (error) {
            aiLogger.debug('EnterpriseSecurity', `Usage fetch failed: ${error.message}`);
            return 0;
        }
    }

    /**
     * Get time window for limit type
     */
    getTimeWindow(limitType) {
        switch (limitType) {
            case 'per_minute': return '-1 minute';
            case 'per_hour': return '-1 hour';
            case 'per_day': return '-1 day';
            case 'per_month': return '-1 month';
            default: return '-1 day';
        }
    }

    /**
     * Get reset time for limit type
     */
    getResetTime(limitType) {
        const now = new Date();
        switch (limitType) {
            case 'per_minute':
                return new Date(now.getTime() + 60000);
            case 'per_hour':
                return new Date(now.getTime() + 3600000);
            case 'per_day':
                return new Date(now.setHours(24, 0, 0, 0));
            case 'per_month':
                return new Date(now.getFullYear(), now.getMonth() + 1, 1);
            default:
                return new Date(now.getTime() + 3600000);
        }
    }

    /**
     * Log data access (non-blocking)
     */
    async logDataAccess(entry) {
        try {
            const { userId, organizationId, dataType, dataId, accessType, purpose, aiRequestId } = entry;

            await dbRun(`
                INSERT INTO ai_data_access_log 
                (id, user_id, organization_id, data_type, data_id, access_type, purpose, ai_request_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                require('crypto').randomUUID(),
                userId, organizationId, dataType, dataId,
                accessType, purpose, aiRequestId
            ]);
        } catch (error) {
            aiLogger.debug('EnterpriseSecurity', `Data access log failed: ${error.message}`);
            // Non-blocking - don't throw
        }
    }

    /**
     * Build filter query conditions
     * @private
     */
    _buildAuditFilterQuery(filters, params) {
        const { organizationId, userId, action, riskLevel, flagged, search, startDate, endDate } = filters;
        let whereClause = ' WHERE 1=1';

        if (organizationId) {
            whereClause += ` AND organization_id = ?`;
            params.push(organizationId);
        }
        if (userId) {
            whereClause += ` AND user_id = ?`;
            params.push(userId);
        }
        if (action) {
            whereClause += ` AND action = ?`;
            params.push(action);
        }
        if (riskLevel) {
            whereClause += ` AND risk_level = ?`;
            params.push(riskLevel);
        }
        if (flagged !== undefined) {
            whereClause += ` AND flagged = ?`;
            params.push(flagged ? 1 : 0);
        }
        if (search) {
            whereClause += ` AND (request_summary LIKE ? OR response_summary LIKE ? OR action LIKE ? OR user_id LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }
        if (startDate) {
            whereClause += ` AND timestamp >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            whereClause += ` AND timestamp <= ?`;
            params.push(endDate + ' 23:59:59');
        }

        return whereClause;
    }

    /**
     * Get audit log entries
     * Returns empty array on any failure
     */
    async getAuditLog(filters = {}) {
        try {
            const { limit = 100, offset = 0 } = filters;
            const params = [];

            let query = `SELECT * FROM ai_audit_log`;
            query += this._buildAuditFilterQuery(filters, params);
            query += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
            params.push(limit, offset);

            const rows = await dbAll(query, params);
            return Array.isArray(rows) ? rows : [];
        } catch (error) {
            aiLogger.debug('EnterpriseSecurity', `Audit log fetch failed: ${error.message}`);
            return [];
        }
    }

    /**
     * Get total count of audit log entries matching filters
     */
    async getAuditLogCount(filters = {}) {
        try {
            const params = [];
            let query = `SELECT COUNT(*) as total FROM ai_audit_log`;
            query += this._buildAuditFilterQuery(filters, params);

            const result = await dbGet(query, params);
            return result?.total || 0;
        } catch (error) {
            aiLogger.debug('EnterpriseSecurity', `Audit log count failed: ${error.message}`);
            return 0;
        }
    }

    /**
     * Flush audit buffer to database
     * Non-blocking with retry on failure
     */
    async flushAuditBuffer() {
        if (this.auditBuffer.length === 0) return;

        const entries = [...this.auditBuffer];
        this.auditBuffer = [];

        for (const entry of entries) {
            try {
                await dbRun(`
                    INSERT INTO ai_audit_log 
                    (id, timestamp, user_id, organization_id, action, resource_type, resource_id,
                     request_summary, response_summary, model_used, tokens_used, cost_usd,
                     ip_address, user_agent, risk_level, flagged, flag_reason)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    entry.id, entry.timestamp, entry.user_id, entry.organization_id,
                    entry.action, entry.resource_type, entry.resource_id,
                    entry.request_summary, entry.response_summary, entry.model_used,
                    entry.tokens_used, entry.cost_usd, entry.ip_address, entry.user_agent,
                    entry.risk_level, entry.flagged ? 1 : 0, entry.flag_reason
                ]);
            } catch (error) {
                aiLogger.warn('EnterpriseSecurity', `Audit entry insert failed: ${error.message}`);
                // Re-add failed entry to buffer for retry (max once)
                if (!entry._retried) {
                    entry._retried = true;
                    this.auditBuffer.push(entry);
                }
            }
        }
    }

    /**
     * Start buffer flush interval
     */
    startFlushInterval() {
        setInterval(() => {
            this.flushAuditBuffer().catch(err => {
                aiLogger.warn('EnterpriseSecurity', `Flush interval error: ${err.message}`);
            });

            // Run retention policy if it's been more than 24 hours
            if (Date.now() - this.lastRetentionRun > this.retentionInterval) {
                this.runRetentionPolicy().catch(err => {
                    aiLogger.warn('EnterpriseSecurity', `Retention policy error: ${err.message}`);
                });
            }
        }, this.flushInterval);
    }

    /**
     * Prune old audit logs based on retention policy (default 365 days)
     */
    async runRetentionPolicy(days = 365) {
        aiLogger.info('EnterpriseSecurity', `Running audit log retention policy (${days} days)`);
        this.lastRetentionRun = Date.now();

        try {
            const retentionDate = new Date();
            retentionDate.setDate(retentionDate.getDate() - days);
            const dateStr = retentionDate.toISOString();

            // Prune audit logs
            const auditResult = await dbRun(
                `DELETE FROM ai_audit_log WHERE timestamp < ?`,
                [dateStr]
            );
            if (auditResult.success) {
                aiLogger.info('EnterpriseSecurity', `Pruned ${auditResult.changes || 0} old audit logs`);
            }

            // Prune data access logs
            const accessResult = await dbRun(
                `DELETE FROM ai_data_access_log WHERE timestamp < ?`,
                [dateStr]
            );
            if (accessResult.success) {
                aiLogger.info('EnterpriseSecurity', `Pruned ${accessResult.changes || 0} old data access logs`);
            }

            return true;
        } catch (error) {
            aiLogger.error('EnterpriseSecurity', `Retention policy failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Get security summary for organization
     */
    async getSecuritySummary(organizationId) {
        try {
            const today = await dbGet(`
                SELECT 
                    COUNT(*) as total_requests,
                    SUM(CASE WHEN flagged = 1 THEN 1 ELSE 0 END) as flagged_requests,
                    SUM(CASE WHEN risk_level = 'HIGH' THEN 1 ELSE 0 END) as high_risk,
                    SUM(CASE WHEN risk_level = 'MEDIUM' THEN 1 ELSE 0 END) as medium_risk
                FROM ai_audit_log
                WHERE organization_id = ? AND timestamp > datetime('now', '-1 day')
            `, [organizationId]);

            const dataAccess = await dbGet(`
                SELECT COUNT(*) as count, COUNT(DISTINCT data_type) as types
                FROM ai_data_access_log
                WHERE organization_id = ? AND timestamp > datetime('now', '-1 day')
            `, [organizationId]);

            return {
                period: 'last_24h',
                totalRequests: today?.total_requests || 0,
                flaggedRequests: today?.flagged_requests || 0,
                highRiskCount: today?.high_risk || 0,
                mediumRiskCount: today?.medium_risk || 0,
                dataAccessCount: dataAccess?.count || 0,
                dataTypesAccessed: dataAccess?.types || 0
            };
        } catch (error) {
            aiLogger.debug('EnterpriseSecurity', `Summary failed: ${error.message}`);
            return {
                period: 'last_24h',
                totalRequests: 0,
                flaggedRequests: 0,
                highRiskCount: 0,
                mediumRiskCount: 0,
                dataAccessCount: 0,
                dataTypesAccessed: 0,
                error: error.message
            };
        }
    }
}

// Singleton instance
const enterpriseSecurity = new EnterpriseSecurityService();

export {
EnterpriseSecurityService,
    enterpriseSecurity,
    PII_PATTERNS,
    RISK_RULES,
    // Export helpers for use by other modules
    dbAll,
    dbGet,
    dbRun
};

export default {
    EnterpriseSecurityService,
    enterpriseSecurity,
    PII_PATTERNS,
    RISK_RULES,
    // Export helpers for use by other modules
    dbAll,
    dbGet,
    dbRun
};
