/**
 * LLM Health Check API Routes
 * 
 * Provides endpoints for checking LLM provider health status.
 */

import express from 'express';
const router = express.Router();
const { llmHealthMonitor, HealthStatus, ErrorCategory, ErrorMessages } = import('ai/llmHealthMonitor.js');

// Get database - works with both SQLite and PostgreSQL
let db;
try {
    db = require('../database');
} catch (e) {
    console.error('[LLMHealth] Database not available:', e.message);
}

// Helper to promisify db.all
const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    if (!db) {
        resolve([]);
        return;
    }
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
    });
});

/**
 * GET /api/llm/health
 * Get health status of all LLM providers
 */
router.get('/health', async (req, res) => {
    try {
        // Get providers from database
        const providers = await dbAll(`
            SELECT id, name, provider, api_key, endpoint, model_id, is_active 
            FROM llm_providers 
            WHERE is_active = 1
        `);

        if (providers.length === 0) {
            return res.json({
                success: true,
                summary: { total: 0, healthy: 0, degraded: 0, unhealthy: 0 },
                providers: [],
                lastCheck: new Date().toISOString()
            });
        }

        // Check all providers
        const results = await llmHealthMonitor.checkAllProviders(providers);
        const summary = llmHealthMonitor.getSummary();

        res.json({
            success: true,
            summary,
            providers: results.map(r => ({
                id: r.id,
                name: r.provider,
                providerId: r.providerId,
                status: r.status,
                statusLabel: getStatusLabel(r.status),
                errorCategory: r.errorCategory,
                error: r.error,
                rawError: r.rawError,
                statusCode: r.statusCode,
                responseTime: r.responseTime,
                lastCheck: r.lastCheck
            })),
            lastCheck: summary.lastCheck
        });
    } catch (error) {
        console.error('[LLMHealth] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/llm/health/:providerId
 * Get health status of a specific provider
 */
router.get('/health/:providerId', async (req, res) => {
    try {
        const { providerId } = req.params;

        // Get provider from database
        const providers = await dbAll(`
            SELECT id, name, provider, api_key, endpoint, model_id, is_active 
            FROM llm_providers 
            WHERE id = ?
        `, [providerId]);

        if (providers.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Provider not found'
            });
        }

        const result = await llmHealthMonitor.testProvider(providers[0]);

        res.json({
            success: true,
            provider: {
                id: providerId,
                name: result.provider,
                providerId: result.providerId,
                status: result.status,
                statusLabel: getStatusLabel(result.status),
                errorCategory: result.errorCategory,
                error: result.error,
                rawError: result.rawError,
                statusCode: result.statusCode,
                responseTime: result.responseTime,
                lastCheck: result.lastCheck
            }
        });
    } catch (error) {
        console.error('[LLMHealth] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/llm/health/test
 * Test a specific provider connection
 */
router.post('/health/test', async (req, res) => {
    try {
        const { provider, api_key, endpoint, model_id, name } = req.body;

        if (!provider) {
            return res.status(400).json({
                success: false,
                error: 'Provider is required'
            });
        }

        const result = await llmHealthMonitor.testProvider({
            provider,
            api_key,
            endpoint,
            model_id,
            name
        });

        res.json({
            success: result.status === HealthStatus.HEALTHY || result.status === HealthStatus.DEGRADED,
            result: {
                status: result.status,
                statusLabel: getStatusLabel(result.status),
                errorCategory: result.errorCategory,
                error: result.error,
                rawError: result.rawError,
                statusCode: result.statusCode,
                responseTime: result.responseTime,
                lastCheck: result.lastCheck
            }
        });
    } catch (error) {
        console.error('[LLMHealth] Test error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/llm/health/summary
 * Get summary of all provider health statuses
 */
router.get('/health/summary', async (req, res) => {
    try {
        const summary = llmHealthMonitor.getSummary();
        const cachedStatuses = llmHealthMonitor.getAllCachedStatuses();

        // Group by error category
        const byCategory = {};
        cachedStatuses.forEach(s => {
            if (s.errorCategory) {
                if (!byCategory[s.errorCategory]) {
                    byCategory[s.errorCategory] = [];
                }
                byCategory[s.errorCategory].push(s.provider);
            }
        });

        res.json({
            success: true,
            summary: {
                ...summary,
                byCategory
            },
            alerts: cachedStatuses
                .filter(s => s.status === HealthStatus.UNHEALTHY)
                .map(s => ({
                    provider: s.provider,
                    category: s.errorCategory,
                    message: s.error?.title || 'Unknown error',
                    action: s.error?.action || 'Check configuration'
                }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/llm/health/errors
 * Get all error categories with descriptions
 */
router.get('/health/errors', (req, res) => {
    res.json({
        success: true,
        categories: Object.entries(ErrorMessages).map(([key, value]) => ({
            code: key,
            ...value
        }))
    });
});

// Helper function
function getStatusLabel(status) {
    switch (status) {
        case HealthStatus.HEALTHY:
            return { text: 'Zdrowy', color: 'green' };
        case HealthStatus.DEGRADED:
            return { text: 'Spowolniony', color: 'yellow' };
        case HealthStatus.UNHEALTHY:
            return { text: 'Niedostępny', color: 'red' };
        default:
            return { text: 'Nieznany', color: 'gray' };
    }
}

export default router;

