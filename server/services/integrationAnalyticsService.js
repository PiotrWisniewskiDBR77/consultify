/**
 * Integration Analytics Service
 * 
 * Provides analytics and monitoring for integrations:
 * - Usage statistics
 * - Error logs
 * - Performance metrics
 * - Health checks
 * - Aggregated analytics
 */

import { getDatabase } from '../src/database/Database.ts';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';


const deps = {
    db,
    uuidv4,
};

const IntegrationAnalyticsService = {
    // For testing: allow overriding dependencies
    setDependencies: (newDeps = {}) => {
        Object.assign(deps, newDeps);
    },

    /**
     * Log API usage
     */
    logApiUsage: async ({
        userId,
        integrationId,
        apiKeyId,
        endpoint,
        method = 'GET',
        statusCode,
        responseTimeMs,
        tokensUsed = 0,
        cost = 0,
        requestBody = null,
        responseBody = null,
        errorMessage = null
    }) => {
        const id = deps.uuidv4();
        
        return new Promise((resolve, reject) => {
            deps.db.run(`
                INSERT INTO api_usage_logs 
                (id, user_id, integration_id, api_key_id, endpoint, method, status_code, 
                 response_time_ms, tokens_used, cost, request_body, response_body, error_message)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id, userId, integrationId, apiKeyId, endpoint, method, statusCode,
                responseTimeMs, tokensUsed, cost, 
                requestBody ? JSON.stringify(requestBody) : null,
                responseBody ? JSON.stringify(responseBody) : null,
                errorMessage
            ], function (err) {
                if (err) reject(err);
                else resolve({ id, changes: this.changes });
            });
        });
    },

    /**
     * Get usage statistics for an integration
     */
    getUsageStats: async (integrationId, period = '7d') => {
        const periodMap = {
            '1d': 1,
            '7d': 7,
            '30d': 30,
            '90d': 90
        };
        const days = periodMap[period] || 7;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        return new Promise((resolve, reject) => {
            deps.db.all(`
                SELECT 
                    COUNT(*) as total_requests,
                    SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as successful_requests,
                    SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as failed_requests,
                    SUM(tokens_used) as total_tokens,
                    SUM(cost) as total_cost,
                    AVG(response_time_ms) as avg_response_time_ms,
                    MAX(response_time_ms) as max_response_time_ms,
                    MIN(response_time_ms) as min_response_time_ms
                FROM api_usage_logs
                WHERE integration_id = ? AND created_at >= ?
            `, [integrationId, startDate.toISOString()], (err, rows) => {
                if (err) reject(err);
                else {
                    const stats = rows[0] || {
                        total_requests: 0,
                        successful_requests: 0,
                        failed_requests: 0,
                        total_tokens: 0,
                        total_cost: 0,
                        avg_response_time_ms: 0,
                        max_response_time_ms: 0,
                        min_response_time_ms: 0
                    };
                    resolve({
                        ...stats,
                        success_rate: stats.total_requests > 0 
                            ? (stats.successful_requests / stats.total_requests * 100).toFixed(2)
                            : 0
                    });
                }
            });
        });
    },

    /**
     * Get error logs for an integration
     */
    getErrorLogs: async (integrationId, limit = 50) => {
        return new Promise((resolve, reject) => {
            deps.db.all(`
                SELECT 
                    id,
                    endpoint,
                    method,
                    status_code,
                    error_message,
                    response_time_ms,
                    created_at
                FROM api_usage_logs
                WHERE integration_id = ? 
                    AND (status_code >= 400 OR error_message IS NOT NULL)
                ORDER BY created_at DESC
                LIMIT ?
            `, [integrationId, limit], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    },

    /**
     * Get performance metrics
     */
    getPerformanceMetrics: async (integrationId, period = '7d') => {
        const periodMap = {
            '1d': 1,
            '7d': 7,
            '30d': 30,
            '90d': 90
        };
        const days = periodMap[period] || 7;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        return new Promise((resolve, reject) => {
            deps.db.all(`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as requests,
                    AVG(response_time_ms) as avg_latency,
                    MAX(response_time_ms) as max_latency,
                    SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as successes,
                    SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as failures
                FROM api_usage_logs
                WHERE integration_id = ? AND created_at >= ?
                GROUP BY DATE(created_at)
                ORDER BY date ASC
            `, [integrationId, startDate.toISOString()], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    },

    /**
     * Aggregate daily stats (for caching/performance)
     */
    aggregateDailyStats: async (integrationId, days = 30) => {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        return new Promise((resolve, reject) => {
            deps.db.run(`
                INSERT OR REPLACE INTO integration_analytics
                (id, integration_id, period_type, period_start, period_end,
                 total_requests, successful_requests, failed_requests,
                 total_tokens, total_cost, avg_response_time_ms, error_count)
                SELECT 
                    ? || '_' || DATE(created_at) as id,
                    integration_id,
                    'daily' as period_type,
                    DATE(created_at) as period_start,
                    DATE(created_at, '+1 day') as period_end,
                    COUNT(*) as total_requests,
                    SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as successful_requests,
                    SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as failed_requests,
                    SUM(tokens_used) as total_tokens,
                    SUM(cost) as total_cost,
                    AVG(response_time_ms) as avg_response_time_ms,
                    SUM(CASE WHEN status_code >= 400 OR error_message IS NOT NULL THEN 1 ELSE 0 END) as error_count
                FROM api_usage_logs
                WHERE integration_id = ? AND created_at >= ?
                GROUP BY DATE(created_at)
            `, [integrationId, integrationId, startDate.toISOString()], function (err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });
    },

    /**
     * Log webhook delivery
     */
    logWebhookDelivery: async ({
        webhookId,
        eventType,
        status = 'pending',
        responseCode = null,
        responseTimeMs = null,
        retryCount = 0,
        errorMessage = null,
        payload = null,
        responseBody = null,
        deliveredAt = null
    }) => {
        const id = deps.uuidv4();
        
        return new Promise((resolve, reject) => {
            deps.db.run(`
                INSERT INTO webhook_delivery_logs
                (id, webhook_id, event_type, status, response_code, response_time_ms,
                 retry_count, error_message, payload, response_body, delivered_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id, webhookId, eventType, status, responseCode, responseTimeMs,
                retryCount, errorMessage,
                payload ? JSON.stringify(payload) : null,
                responseBody ? JSON.stringify(responseBody) : null,
                deliveredAt || new Date().toISOString()
            ], function (err) {
                if (err) reject(err);
                else resolve({ id, changes: this.changes });
            });
        });
    },

    /**
     * Get webhook delivery logs
     */
    getWebhookDeliveries: async (webhookId, limit = 50) => {
        return new Promise((resolve, reject) => {
            deps.db.all(`
                SELECT 
                    id,
                    event_type,
                    status,
                    response_code,
                    response_time_ms,
                    retry_count,
                    error_message,
                    delivered_at,
                    created_at
                FROM webhook_delivery_logs
                WHERE webhook_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            `, [webhookId, limit], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    },

    /**
     * Record health check
     */
    recordHealthCheck: async ({
        integrationId,
        status = 'healthy',
        latencyMs = null,
        errorMessage = null,
        checkType = 'ping'
    }) => {
        const id = deps.uuidv4();
        
        return new Promise((resolve, reject) => {
            deps.db.run(`
                INSERT INTO integration_health_checks
                (id, integration_id, status, latency_ms, error_message, check_type)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [id, integrationId, status, latencyMs, errorMessage, checkType], function (err) {
                if (err) reject(err);
                else resolve({ id, changes: this.changes });
            });
        });
    },

    /**
     * Get health status for an integration
     */
    getHealthStatus: async (integrationId) => {
        return new Promise((resolve, reject) => {
            deps.db.get(`
                SELECT 
                    status,
                    latency_ms,
                    error_message,
                    check_type,
                    checked_at
                FROM integration_health_checks
                WHERE integration_id = ?
                ORDER BY checked_at DESC
                LIMIT 1
            `, [integrationId], (err, row) => {
                if (err) reject(err);
                else resolve(row || { status: 'unknown', checked_at: null });
            });
        });
    },

    /**
     * Get health check history
     */
    getHealthCheckHistory: async (integrationId, limit = 100) => {
        return new Promise((resolve, reject) => {
            deps.db.all(`
                SELECT 
                    id,
                    status,
                    latency_ms,
                    error_message,
                    check_type,
                    checked_at
                FROM integration_health_checks
                WHERE integration_id = ?
                ORDER BY checked_at DESC
                LIMIT ?
            `, [integrationId, limit], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    },

    /**
     * Get aggregated analytics
     */
    getAggregatedAnalytics: async (integrationId, periodType = 'daily', days = 30) => {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        return new Promise((resolve, reject) => {
            deps.db.all(`
                SELECT 
                    period_start,
                    period_end,
                    total_requests,
                    successful_requests,
                    failed_requests,
                    total_tokens,
                    total_cost,
                    avg_response_time_ms,
                    error_count
                FROM integration_analytics
                WHERE integration_id = ? 
                    AND period_type = ?
                    AND period_start >= ?
                ORDER BY period_start ASC
            `, [integrationId, periodType, startDate.toISOString()], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }
};

export default IntegrationAnalyticsService;









