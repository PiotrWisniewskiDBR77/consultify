/**
 * AI Analytics and Cost Control API
 * 
 * Endpoints for monitoring AI usage, costs, and performance metrics.
 */

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const db = require('../database');
const { aiLogger } = require('../services/ai/logger');

// All routes require authentication
router.use(verifyToken);

/**
 * GET /api/ai-analytics/costs
 * Get AI cost breakdown
 */
router.get('/costs', async (req, res) => {
    try {
        const { period = '30d', groupBy = 'day' } = req.query;
        const organizationId = req.user.organizationId;

        // Parse period
        let daysBack = 30;
        if (period === '7d') daysBack = 7;
        else if (period === '90d') daysBack = 90;
        else if (period === '1y') daysBack = 365;

        // Get cost data from ai_audit_logs
        const costData = await new Promise((resolve) => {
            let sql = '';
            if (groupBy === 'day') {
                sql = `
                    SELECT 
                        DATE(timestamp) as date,
                        SUM(tokens_used) as total_tokens,
                        SUM(cost_usd) as total_cost,
                        COUNT(*) as request_count,
                        capability,
                        model
                    FROM ai_audit_logs
                    WHERE organization_id = ?
                    AND timestamp > datetime('now', '-${daysBack} days')
                    GROUP BY DATE(timestamp), capability
                    ORDER BY date DESC
                `;
            } else if (groupBy === 'capability') {
                sql = `
                    SELECT 
                        capability,
                        SUM(tokens_used) as total_tokens,
                        SUM(cost_usd) as total_cost,
                        COUNT(*) as request_count,
                        AVG(latency_ms) as avg_latency
                    FROM ai_audit_logs
                    WHERE organization_id = ?
                    AND timestamp > datetime('now', '-${daysBack} days')
                    GROUP BY capability
                    ORDER BY total_cost DESC
                `;
            } else if (groupBy === 'model') {
                sql = `
                    SELECT 
                        model,
                        SUM(tokens_used) as total_tokens,
                        SUM(cost_usd) as total_cost,
                        COUNT(*) as request_count,
                        AVG(latency_ms) as avg_latency
                    FROM ai_audit_logs
                    WHERE organization_id = ?
                    AND timestamp > datetime('now', '-${daysBack} days')
                    GROUP BY model
                    ORDER BY total_cost DESC
                `;
            }

            db.all(sql, [organizationId], (err, rows) => {
                resolve(err ? [] : rows);
            });
        });

        // Get totals
        const totals = await new Promise((resolve) => {
            db.get(`
                SELECT 
                    SUM(tokens_used) as total_tokens,
                    SUM(cost_usd) as total_cost,
                    COUNT(*) as total_requests,
                    AVG(latency_ms) as avg_latency,
                    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_requests
                FROM ai_audit_logs
                WHERE organization_id = ?
                AND timestamp > datetime('now', '-${daysBack} days')
            `, [organizationId], (err, row) => {
                resolve(err ? {} : row);
            });
        });

        // Get budget information
        const budget = await getOrganizationBudget(organizationId);

        res.json({
            success: true,
            period,
            groupBy,
            data: costData,
            totals: {
                ...totals,
                successRate: totals.total_requests > 0 
                    ? ((totals.successful_requests / totals.total_requests) * 100).toFixed(1)
                    : 0
            },
            budget: budget ? {
                monthly: budget.monthly_ai_budget,
                used: totals.total_cost || 0,
                remaining: budget.monthly_ai_budget - (totals.total_cost || 0),
                utilization: budget.monthly_ai_budget > 0 
                    ? ((totals.total_cost || 0) / budget.monthly_ai_budget * 100).toFixed(1)
                    : 0
            } : null
        });

    } catch (error) {
        aiLogger.error('AIAnalytics', `costs error: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch cost data' });
    }
});

/**
 * GET /api/ai-analytics/usage
 * Get AI usage metrics
 */
router.get('/usage', async (req, res) => {
    try {
        const { period = '30d' } = req.query;
        const organizationId = req.user.organizationId;

        let daysBack = 30;
        if (period === '7d') daysBack = 7;
        else if (period === '90d') daysBack = 90;

        // Get usage by user
        const userUsage = await new Promise((resolve) => {
            db.all(`
                SELECT 
                    u.full_name as user_name,
                    u.email,
                    COUNT(*) as request_count,
                    SUM(a.tokens_used) as total_tokens,
                    SUM(a.cost_usd) as total_cost
                FROM ai_audit_logs a
                LEFT JOIN users u ON a.user_id = u.id
                WHERE a.organization_id = ?
                AND a.timestamp > datetime('now', '-${daysBack} days')
                GROUP BY a.user_id
                ORDER BY total_tokens DESC
                LIMIT 20
            `, [organizationId], (err, rows) => {
                resolve(err ? [] : rows);
            });
        });

        // Get usage trends (daily)
        const dailyTrends = await new Promise((resolve) => {
            db.all(`
                SELECT 
                    DATE(timestamp) as date,
                    COUNT(*) as requests,
                    SUM(tokens_used) as tokens,
                    SUM(cost_usd) as cost
                FROM ai_audit_logs
                WHERE organization_id = ?
                AND timestamp > datetime('now', '-${daysBack} days')
                GROUP BY DATE(timestamp)
                ORDER BY date ASC
            `, [organizationId], (err, rows) => {
                resolve(err ? [] : rows);
            });
        });

        // Get capability distribution
        const capabilityDistribution = await new Promise((resolve) => {
            db.all(`
                SELECT 
                    capability,
                    COUNT(*) as count,
                    SUM(tokens_used) as tokens
                FROM ai_audit_logs
                WHERE organization_id = ?
                AND timestamp > datetime('now', '-${daysBack} days')
                GROUP BY capability
                ORDER BY count DESC
            `, [organizationId], (err, rows) => {
                resolve(err ? [] : rows);
            });
        });

        res.json({
            success: true,
            period,
            userUsage,
            dailyTrends,
            capabilityDistribution
        });

    } catch (error) {
        aiLogger.error('AIAnalytics', `usage error: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch usage data' });
    }
});

/**
 * GET /api/ai-analytics/quotas
 * Get quota status for the organization
 */
router.get('/quotas', async (req, res) => {
    try {
        const organizationId = req.user.organizationId;
        const userId = req.user.id;

        // Get user quota
        const userQuota = await new Promise((resolve) => {
            db.get(`
                SELECT * FROM ai_usage_quotas
                WHERE entity_type = 'user' AND entity_id = ?
            `, [userId], (err, row) => resolve(err ? null : row));
        });

        // Get org quota
        const orgQuota = await new Promise((resolve) => {
            db.get(`
                SELECT * FROM ai_usage_quotas
                WHERE entity_type = 'organization' AND entity_id = ?
            `, [organizationId], (err, row) => resolve(err ? null : row));
        });

        res.json({
            success: true,
            userQuota: userQuota ? {
                dailyLimit: userQuota.daily_token_limit,
                dailyUsed: userQuota.tokens_used_today,
                dailyRemaining: userQuota.daily_token_limit - userQuota.tokens_used_today,
                monthlyLimit: userQuota.monthly_token_limit,
                monthlyUsed: userQuota.tokens_used_month,
                monthlyRemaining: userQuota.monthly_token_limit - userQuota.tokens_used_month
            } : null,
            organizationQuota: orgQuota ? {
                dailyLimit: orgQuota.daily_token_limit,
                dailyUsed: orgQuota.tokens_used_today,
                dailyRemaining: orgQuota.daily_token_limit - orgQuota.tokens_used_today,
                monthlyLimit: orgQuota.monthly_token_limit,
                monthlyUsed: orgQuota.tokens_used_month,
                monthlyRemaining: orgQuota.monthly_token_limit - orgQuota.tokens_used_month
            } : null
        });

    } catch (error) {
        aiLogger.error('AIAnalytics', `quotas error: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch quota data' });
    }
});

/**
 * GET /api/ai-analytics/performance
 * Get AI performance metrics
 */
router.get('/performance', async (req, res) => {
    try {
        const { period = '7d' } = req.query;
        const organizationId = req.user.organizationId;

        let daysBack = 7;
        if (period === '30d') daysBack = 30;

        // Get latency percentiles
        const latencyStats = await new Promise((resolve) => {
            db.all(`
                SELECT 
                    model,
                    capability,
                    AVG(latency_ms) as avg_latency,
                    MIN(latency_ms) as min_latency,
                    MAX(latency_ms) as max_latency,
                    COUNT(*) as sample_count
                FROM ai_audit_logs
                WHERE organization_id = ?
                AND timestamp > datetime('now', '-${daysBack} days')
                AND success = 1
                GROUP BY model, capability
            `, [organizationId], (err, rows) => {
                resolve(err ? [] : rows);
            });
        });

        // Get error rates
        const errorRates = await new Promise((resolve) => {
            db.all(`
                SELECT 
                    model,
                    capability,
                    COUNT(*) as total,
                    SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as errors
                FROM ai_audit_logs
                WHERE organization_id = ?
                AND timestamp > datetime('now', '-${daysBack} days')
                GROUP BY model, capability
            `, [organizationId], (err, rows) => {
                resolve(err ? [] : rows);
            });
        });

        // Get cache hit rate
        const cacheStats = await new Promise((resolve) => {
            db.get(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN has_screen_context = 1 THEN 1 ELSE 0 END) as with_context
                FROM ai_audit_logs
                WHERE organization_id = ?
                AND timestamp > datetime('now', '-${daysBack} days')
            `, [organizationId], (err, row) => {
                resolve(err ? {} : row);
            });
        });

        res.json({
            success: true,
            period,
            latency: latencyStats.map(l => ({
                ...l,
                avg_latency: Math.round(l.avg_latency),
                min_latency: Math.round(l.min_latency),
                max_latency: Math.round(l.max_latency)
            })),
            errorRates: errorRates.map(e => ({
                ...e,
                errorRate: e.total > 0 ? ((e.errors / e.total) * 100).toFixed(2) : 0
            })),
            contextUtilization: cacheStats.total > 0 
                ? ((cacheStats.with_context / cacheStats.total) * 100).toFixed(1)
                : 0
        });

    } catch (error) {
        aiLogger.error('AIAnalytics', `performance error: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch performance data' });
    }
});

/**
 * POST /api/ai-analytics/alerts/configure
 * Configure cost alerts (admin only)
 */
router.post('/alerts/configure', async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { thresholds, emailNotifications, slackWebhook } = req.body;
        const organizationId = req.user.organizationId;

        // Store alert configuration
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT OR REPLACE INTO organization_settings 
                (organization_id, setting_key, setting_value, updated_at)
                VALUES (?, 'ai_cost_alerts', ?, datetime('now'))
            `, [organizationId, JSON.stringify({
                thresholds: thresholds || [70, 85, 95],
                emailNotifications: emailNotifications || [],
                slackWebhook: slackWebhook || null
            })], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({ success: true, message: 'Alert configuration saved' });

    } catch (error) {
        aiLogger.error('AIAnalytics', `alerts configure error: ${error.message}`);
        res.status(500).json({ error: 'Failed to configure alerts' });
    }
});

// Helper function
async function getOrganizationBudget(organizationId) {
    return new Promise((resolve) => {
        db.get(`
            SELECT monthly_ai_budget FROM organizations WHERE id = ?
        `, [organizationId], (err, row) => {
            resolve(err ? null : row);
        });
    });
}

module.exports = router;






