/**
 * AI Operations Routes
 * 
 * Module 3: AI Operations & Analytics
 * Routes for mission control, performance, costs, SLA, and analytics
 * 
 * This module provides unified API endpoints for AI operations monitoring
 * while aggregating data from various existing services.
 */

import express from 'express';
const router = express.Router();
import verifyToken from '../middleware/authMiddleware.js';
import { requireRole  } from '../middleware/rbac.js';
import { getDatabase } from '../src/database/index.js';
const db = getDatabase();

// ==========================================
// MISSION CONTROL ENDPOINTS
// ==========================================

/**
 * GET /api/ai-operations/mission-control/status
 * Get overall AI system status
 */
router.get('/mission-control/status', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        // Get active requests count
        const activeRequests = await db.get(`
            SELECT COUNT(*) as count FROM ai_request_log 
            WHERE created_at > datetime('now', '-5 minutes')
        `).catch(() => ({ count: 0 }));
        
        // Get error rate last hour
        const errorRate = await db.get(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
            FROM ai_request_log 
            WHERE created_at > datetime('now', '-1 hour')
        `).catch(() => ({ total: 0, errors: 0 }));
        
        // Get queue status
        const queueStatus = await db.get(`
            SELECT COUNT(*) as pending FROM ai_async_jobs 
            WHERE status = 'pending'
        `).catch(() => ({ pending: 0 }));
        
        const errorRatePercent = errorRate.total > 0 
            ? ((errorRate.errors / errorRate.total) * 100).toFixed(2) 
            : 0;
        
        res.json({
            success: true,
            data: {
                status: errorRatePercent < 5 ? 'healthy' : errorRatePercent < 15 ? 'degraded' : 'critical',
                activeRequests: activeRequests.count || 0,
                errorRate: parseFloat(errorRatePercent),
                queuedJobs: queueStatus.pending || 0,
                lastUpdated: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('[AI Operations] Error getting mission control status:', error);
        res.status(500).json({ error: 'Failed to get status', details: error.message });
    }
});

/**
 * GET /api/ai-operations/mission-control/providers
 * Get provider status overview
 */
router.get('/mission-control/providers', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const providers = await db.all(`
            SELECT 
                name,
                is_active,
                last_health_check,
                health_status,
                avg_latency_ms
            FROM llm_providers
            ORDER BY name
        `).catch(() => []);
        
        res.json({
            success: true,
            data: providers.map(p => ({
                ...p,
                is_active: Boolean(p.is_active),
                health_status: p.health_status || 'unknown'
            }))
        });
    } catch (error) {
        console.error('[AI Operations] Error getting providers:', error);
        res.status(500).json({ error: 'Failed to get providers', details: error.message });
    }
});

/**
 * GET /api/ai-operations/mission-control/alerts
 * Get active alerts
 */
router.get('/mission-control/alerts', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const alerts = await db.all(`
            SELECT * FROM ai_health_alerts 
            WHERE resolved_at IS NULL
            ORDER BY created_at DESC
            LIMIT 50
        `).catch(() => []);
        
        res.json({ success: true, data: alerts });
    } catch (error) {
        console.error('[AI Operations] Error getting alerts:', error);
        res.status(500).json({ error: 'Failed to get alerts', details: error.message });
    }
});

/**
 * POST /api/ai-operations/mission-control/alerts/:id/resolve
 * Resolve an alert
 */
router.post('/mission-control/alerts/:id/resolve', verifyToken, requireRole(['super_admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { resolution } = req.body;
        
        await db.run(`
            UPDATE ai_health_alerts 
            SET resolved_at = datetime('now'), resolution = ?, resolved_by = ?
            WHERE id = ?
        `, [resolution || 'Manual resolution', req.user.id, id]);
        
        res.json({ success: true, message: 'Alert resolved' });
    } catch (error) {
        console.error('[AI Operations] Error resolving alert:', error);
        res.status(500).json({ error: 'Failed to resolve alert', details: error.message });
    }
});

// ==========================================
// PERFORMANCE ENDPOINTS
// ==========================================

/**
 * GET /api/ai-operations/performance/metrics
 * Get performance metrics
 */
router.get('/performance/metrics', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { period = '24h' } = req.query;
        
        let timeFilter;
        switch (period) {
            case '1h': timeFilter = "datetime('now', '-1 hour')"; break;
            case '24h': timeFilter = "datetime('now', '-24 hours')"; break;
            case '7d': timeFilter = "datetime('now', '-7 days')"; break;
            case '30d': timeFilter = "datetime('now', '-30 days')"; break;
            default: timeFilter = "datetime('now', '-24 hours')";
        }
        
        const metrics = await db.get(`
            SELECT 
                COUNT(*) as total_requests,
                AVG(latency_ms) as avg_latency,
                MIN(latency_ms) as min_latency,
                MAX(latency_ms) as max_latency,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed,
                AVG(tokens_used) as avg_tokens
            FROM ai_request_log 
            WHERE created_at > ${timeFilter}
        `).catch(() => ({
            total_requests: 0,
            avg_latency: 0,
            min_latency: 0,
            max_latency: 0,
            successful: 0,
            failed: 0,
            avg_tokens: 0
        }));
        
        res.json({
            success: true,
            data: {
                period,
                totalRequests: metrics.total_requests || 0,
                avgLatency: Math.round(metrics.avg_latency || 0),
                minLatency: metrics.min_latency || 0,
                maxLatency: metrics.max_latency || 0,
                successRate: metrics.total_requests > 0 
                    ? ((metrics.successful / metrics.total_requests) * 100).toFixed(2)
                    : 100,
                avgTokens: Math.round(metrics.avg_tokens || 0)
            }
        });
    } catch (error) {
        console.error('[AI Operations] Error getting performance metrics:', error);
        res.status(500).json({ error: 'Failed to get metrics', details: error.message });
    }
});

/**
 * GET /api/ai-operations/performance/trends
 * Get performance trends over time
 */
router.get('/performance/trends', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { period = '24h', granularity = 'hour' } = req.query;
        
        let timeFilter, groupBy;
        switch (period) {
            case '24h':
                timeFilter = "datetime('now', '-24 hours')";
                groupBy = "strftime('%Y-%m-%d %H:00', created_at)";
                break;
            case '7d':
                timeFilter = "datetime('now', '-7 days')";
                groupBy = "strftime('%Y-%m-%d', created_at)";
                break;
            case '30d':
                timeFilter = "datetime('now', '-30 days')";
                groupBy = "strftime('%Y-%m-%d', created_at)";
                break;
            default:
                timeFilter = "datetime('now', '-24 hours')";
                groupBy = "strftime('%Y-%m-%d %H:00', created_at)";
        }
        
        const trends = await db.all(`
            SELECT 
                ${groupBy} as timestamp,
                COUNT(*) as requests,
                AVG(latency_ms) as avg_latency,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful
            FROM ai_request_log 
            WHERE created_at > ${timeFilter}
            GROUP BY ${groupBy}
            ORDER BY timestamp ASC
        `).catch(() => []);
        
        res.json({
            success: true,
            data: trends.map(t => ({
                timestamp: t.timestamp,
                requests: t.requests,
                avgLatency: Math.round(t.avg_latency || 0),
                successRate: t.requests > 0 
                    ? ((t.successful / t.requests) * 100).toFixed(2)
                    : 100
            }))
        });
    } catch (error) {
        console.error('[AI Operations] Error getting performance trends:', error);
        res.status(500).json({ error: 'Failed to get trends', details: error.message });
    }
});

// ==========================================
// COSTS ENDPOINTS
// ==========================================

/**
 * GET /api/ai-operations/costs/summary
 * Get cost summary
 */
router.get('/costs/summary', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        
        let timeFilter;
        switch (period) {
            case 'day': timeFilter = "datetime('now', '-1 day')"; break;
            case 'week': timeFilter = "datetime('now', '-7 days')"; break;
            case 'month': timeFilter = "datetime('now', '-30 days')"; break;
            default: timeFilter = "datetime('now', '-30 days')";
        }
        
        const costs = await db.get(`
            SELECT 
                SUM(tokens_used) as total_tokens,
                SUM(cost_usd) as total_cost,
                COUNT(DISTINCT user_id) as unique_users,
                COUNT(*) as total_requests
            FROM ai_request_log 
            WHERE created_at > ${timeFilter}
        `).catch(() => ({
            total_tokens: 0,
            total_cost: 0,
            unique_users: 0,
            total_requests: 0
        }));
        
        const byProvider = await db.all(`
            SELECT 
                provider,
                SUM(tokens_used) as tokens,
                SUM(cost_usd) as cost,
                COUNT(*) as requests
            FROM ai_request_log 
            WHERE created_at > ${timeFilter}
            GROUP BY provider
            ORDER BY cost DESC
        `).catch(() => []);
        
        res.json({
            success: true,
            data: {
                period,
                totalTokens: costs.total_tokens || 0,
                totalCost: parseFloat((costs.total_cost || 0).toFixed(4)),
                uniqueUsers: costs.unique_users || 0,
                totalRequests: costs.total_requests || 0,
                byProvider: byProvider.map(p => ({
                    provider: p.provider,
                    tokens: p.tokens || 0,
                    cost: parseFloat((p.cost || 0).toFixed(4)),
                    requests: p.requests
                }))
            }
        });
    } catch (error) {
        console.error('[AI Operations] Error getting cost summary:', error);
        res.status(500).json({ error: 'Failed to get costs', details: error.message });
    }
});

/**
 * GET /api/ai-operations/costs/trends
 * Get cost trends over time
 */
router.get('/costs/trends', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        
        let timeFilter;
        switch (period) {
            case 'week': timeFilter = "datetime('now', '-7 days')"; break;
            case 'month': timeFilter = "datetime('now', '-30 days')"; break;
            case 'quarter': timeFilter = "datetime('now', '-90 days')"; break;
            default: timeFilter = "datetime('now', '-30 days')";
        }
        
        const trends = await db.all(`
            SELECT 
                strftime('%Y-%m-%d', created_at) as date,
                SUM(tokens_used) as tokens,
                SUM(cost_usd) as cost,
                COUNT(*) as requests
            FROM ai_request_log 
            WHERE created_at > ${timeFilter}
            GROUP BY strftime('%Y-%m-%d', created_at)
            ORDER BY date ASC
        `).catch(() => []);
        
        res.json({
            success: true,
            data: trends.map(t => ({
                date: t.date,
                tokens: t.tokens || 0,
                cost: parseFloat((t.cost || 0).toFixed(4)),
                requests: t.requests
            }))
        });
    } catch (error) {
        console.error('[AI Operations] Error getting cost trends:', error);
        res.status(500).json({ error: 'Failed to get trends', details: error.message });
    }
});

/**
 * GET /api/ai-operations/costs/by-user
 * Get costs by user (top consumers)
 */
router.get('/costs/by-user', verifyToken, requireRole(['super_admin']), async (req, res) => {
    try {
        const { period = 'month', limit = 20 } = req.query;
        
        let timeFilter;
        switch (period) {
            case 'week': timeFilter = "datetime('now', '-7 days')"; break;
            case 'month': timeFilter = "datetime('now', '-30 days')"; break;
            default: timeFilter = "datetime('now', '-30 days')";
        }
        
        const topUsers = await db.all(`
            SELECT 
                l.user_id,
                u.name as user_name,
                u.email,
                SUM(l.tokens_used) as tokens,
                SUM(l.cost_usd) as cost,
                COUNT(*) as requests
            FROM ai_request_log l
            LEFT JOIN users u ON l.user_id = u.id
            WHERE l.created_at > ${timeFilter}
            GROUP BY l.user_id
            ORDER BY cost DESC
            LIMIT ?
        `, [parseInt(limit)]).catch(() => []);
        
        res.json({
            success: true,
            data: topUsers.map(u => ({
                userId: u.user_id,
                userName: u.user_name || 'Unknown',
                email: u.email,
                tokens: u.tokens || 0,
                cost: parseFloat((u.cost || 0).toFixed(4)),
                requests: u.requests
            }))
        });
    } catch (error) {
        console.error('[AI Operations] Error getting costs by user:', error);
        res.status(500).json({ error: 'Failed to get user costs', details: error.message });
    }
});

// ==========================================
// SLA ENDPOINTS
// ==========================================

/**
 * GET /api/ai-operations/sla/status
 * Get SLA compliance status
 */
router.get('/sla/status', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        // SLA targets (could be configurable)
        const slaTargets = {
            availability: 99.9,
            avgLatency: 2000, // ms
            errorRate: 1, // %
            p95Latency: 5000 // ms
        };
        
        const metrics = await db.get(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
                AVG(latency_ms) as avg_latency
            FROM ai_request_log 
            WHERE created_at > datetime('now', '-24 hours')
        `).catch(() => ({ total: 0, successful: 0, avg_latency: 0 }));
        
        const p95Latency = await db.get(`
            SELECT latency_ms FROM (
                SELECT latency_ms, 
                       ROW_NUMBER() OVER (ORDER BY latency_ms) as row_num,
                       COUNT(*) OVER () as total
                FROM ai_request_log 
                WHERE created_at > datetime('now', '-24 hours')
            ) WHERE row_num >= total * 0.95
            LIMIT 1
        `).catch(() => ({ latency_ms: 0 }));
        
        const availability = metrics.total > 0 
            ? (metrics.successful / metrics.total) * 100 
            : 100;
        const errorRate = metrics.total > 0 
            ? ((metrics.total - metrics.successful) / metrics.total) * 100 
            : 0;
        
        res.json({
            success: true,
            data: {
                targets: slaTargets,
                current: {
                    availability: parseFloat(availability.toFixed(2)),
                    avgLatency: Math.round(metrics.avg_latency || 0),
                    errorRate: parseFloat(errorRate.toFixed(2)),
                    p95Latency: p95Latency.latency_ms || 0
                },
                compliance: {
                    availability: availability >= slaTargets.availability,
                    avgLatency: (metrics.avg_latency || 0) <= slaTargets.avgLatency,
                    errorRate: errorRate <= slaTargets.errorRate,
                    p95Latency: (p95Latency.latency_ms || 0) <= slaTargets.p95Latency
                },
                overallCompliant: availability >= slaTargets.availability && 
                                 (metrics.avg_latency || 0) <= slaTargets.avgLatency &&
                                 errorRate <= slaTargets.errorRate
            }
        });
    } catch (error) {
        console.error('[AI Operations] Error getting SLA status:', error);
        res.status(500).json({ error: 'Failed to get SLA status', details: error.message });
    }
});

/**
 * GET /api/ai-operations/sla/history
 * Get SLA compliance history
 */
router.get('/sla/history', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const history = await db.all(`
            SELECT 
                strftime('%Y-%m-%d', created_at) as date,
                COUNT(*) as total,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
                AVG(latency_ms) as avg_latency
            FROM ai_request_log 
            WHERE created_at > datetime('now', '-30 days')
            GROUP BY strftime('%Y-%m-%d', created_at)
            ORDER BY date ASC
        `).catch(() => []);
        
        res.json({
            success: true,
            data: history.map(h => ({
                date: h.date,
                availability: h.total > 0 
                    ? parseFloat(((h.successful / h.total) * 100).toFixed(2))
                    : 100,
                avgLatency: Math.round(h.avg_latency || 0),
                requests: h.total
            }))
        });
    } catch (error) {
        console.error('[AI Operations] Error getting SLA history:', error);
        res.status(500).json({ error: 'Failed to get SLA history', details: error.message });
    }
});

// ==========================================
// ANALYTICS ENDPOINTS
// ==========================================

/**
 * GET /api/ai-operations/analytics/usage
 * Get usage analytics
 */
router.get('/analytics/usage', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        
        let timeFilter;
        switch (period) {
            case 'week': timeFilter = "datetime('now', '-7 days')"; break;
            case 'month': timeFilter = "datetime('now', '-30 days')"; break;
            case 'quarter': timeFilter = "datetime('now', '-90 days')"; break;
            default: timeFilter = "datetime('now', '-30 days')";
        }
        
        const [byFeature, byModel, byTimeOfDay] = await Promise.all([
            db.all(`
                SELECT 
                    feature,
                    COUNT(*) as requests,
                    AVG(latency_ms) as avg_latency
                FROM ai_request_log 
                WHERE created_at > ${timeFilter}
                GROUP BY feature
                ORDER BY requests DESC
            `).catch(() => []),
            
            db.all(`
                SELECT 
                    model,
                    COUNT(*) as requests,
                    SUM(tokens_used) as tokens
                FROM ai_request_log 
                WHERE created_at > ${timeFilter}
                GROUP BY model
                ORDER BY requests DESC
            `).catch(() => []),
            
            db.all(`
                SELECT 
                    strftime('%H', created_at) as hour,
                    COUNT(*) as requests
                FROM ai_request_log 
                WHERE created_at > ${timeFilter}
                GROUP BY strftime('%H', created_at)
                ORDER BY hour
            `).catch(() => [])
        ]);
        
        res.json({
            success: true,
            data: {
                period,
                byFeature,
                byModel,
                byTimeOfDay: byTimeOfDay.map(t => ({
                    hour: parseInt(t.hour),
                    requests: t.requests
                }))
            }
        });
    } catch (error) {
        console.error('[AI Operations] Error getting usage analytics:', error);
        res.status(500).json({ error: 'Failed to get analytics', details: error.message });
    }
});

/**
 * GET /api/ai-operations/analytics/insights
 * Get AI usage insights
 */
router.get('/analytics/insights', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        // Generate insights based on current data
        const insights = [];
        
        // Check for error rate spikes
        const errorRate = await db.get(`
            SELECT 
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as rate
            FROM ai_request_log 
            WHERE created_at > datetime('now', '-1 hour')
        `).catch(() => ({ rate: 0 }));
        
        if ((errorRate.rate || 0) > 5) {
            insights.push({
                type: 'warning',
                title: 'High Error Rate Detected',
                message: `Error rate is ${errorRate.rate.toFixed(1)}% in the last hour`,
                recommendation: 'Review recent error logs and check provider health'
            });
        }
        
        // Check for latency increases
        const latencyComparison = await db.get(`
            SELECT 
                (SELECT AVG(latency_ms) FROM ai_request_log WHERE created_at > datetime('now', '-1 hour')) as recent,
                (SELECT AVG(latency_ms) FROM ai_request_log WHERE created_at BETWEEN datetime('now', '-24 hours') AND datetime('now', '-1 hour')) as baseline
        `).catch(() => ({ recent: 0, baseline: 0 }));
        
        if (latencyComparison.baseline > 0 && latencyComparison.recent > latencyComparison.baseline * 1.5) {
            insights.push({
                type: 'warning',
                title: 'Latency Increase Detected',
                message: `Average latency increased by ${((latencyComparison.recent / latencyComparison.baseline - 1) * 100).toFixed(0)}%`,
                recommendation: 'Consider scaling resources or investigating bottlenecks'
            });
        }
        
        // Cost optimization opportunity
        const costOptimization = await db.get(`
            SELECT 
                model,
                COUNT(*) as requests,
                SUM(cost_usd) as cost
            FROM ai_request_log 
            WHERE created_at > datetime('now', '-7 days')
            GROUP BY model
            ORDER BY cost DESC
            LIMIT 1
        `).catch(() => null);
        
        if (costOptimization && costOptimization.cost > 100) {
            insights.push({
                type: 'info',
                title: 'Cost Optimization Opportunity',
                message: `Model "${costOptimization.model}" accounts for $${costOptimization.cost.toFixed(2)} this week`,
                recommendation: 'Consider using smaller models for simpler tasks'
            });
        }
        
        res.json({
            success: true,
            data: insights.length > 0 ? insights : [{
                type: 'success',
                title: 'All Systems Nominal',
                message: 'No issues or optimization opportunities detected',
                recommendation: 'Continue monitoring'
            }]
        });
    } catch (error) {
        console.error('[AI Operations] Error getting insights:', error);
        res.status(500).json({ error: 'Failed to get insights', details: error.message });
    }
});

// ==========================================
// SUMMARY ENDPOINT
// ==========================================

/**
 * GET /api/ai-operations/summary
 * Get operations module summary
 */
router.get('/summary', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const [status, costs, performance] = await Promise.all([
            db.get(`
                SELECT 
                    COUNT(*) as requests_today,
                    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors_today
                FROM ai_request_log 
                WHERE created_at > datetime('now', 'start of day')
            `).catch(() => ({ requests_today: 0, errors_today: 0 })),
            
            db.get(`
                SELECT SUM(cost_usd) as cost_today
                FROM ai_request_log 
                WHERE created_at > datetime('now', 'start of day')
            `).catch(() => ({ cost_today: 0 })),
            
            db.get(`
                SELECT AVG(latency_ms) as avg_latency
                FROM ai_request_log 
                WHERE created_at > datetime('now', '-1 hour')
            `).catch(() => ({ avg_latency: 0 }))
        ]);
        
        const availability = status.requests_today > 0 
            ? ((status.requests_today - status.errors_today) / status.requests_today) * 100 
            : 100;
        
        res.json({
            success: true,
            data: {
                missionControl: {
                    status: availability >= 99 ? 'healthy' : availability >= 95 ? 'degraded' : 'critical',
                    requestsToday: status.requests_today || 0,
                    errorsToday: status.errors_today || 0
                },
                performance: {
                    avgLatency: Math.round(performance.avg_latency || 0),
                    availability: parseFloat(availability.toFixed(2))
                },
                costs: {
                    today: parseFloat((costs.cost_today || 0).toFixed(4))
                }
            }
        });
    } catch (error) {
        console.error('[AI Operations] Error getting summary:', error);
        res.status(500).json({ error: 'Failed to get summary', details: error.message });
    }
});

export default router;












