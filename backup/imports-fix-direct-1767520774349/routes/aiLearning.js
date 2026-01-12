/**
 * AI Learning System Routes
 * 
 * API endpoints for managing and monitoring the AI self-learning system.
 * Includes analytics, pattern management, and admin controls.
 */

import express from 'express';
const router = express.Router();
import { learningSystem  } from '../services/ai/learningSystem.js';
import verifyToken from '../middleware/authMiddleware.js';
import verifySuperAdmin from '../middleware/superAdminMiddleware.js';

/**
 * Helper middleware to require specific roles
 */
const requireRole = (allowedRoles) => {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    return (req, res, next) => {
        const userRole = req.user?.role;
        if (!userRole) {
            return res.status(403).json({ error: 'Role not found in token' });
        }
        
        // Normalize role checking
        const normalizedUserRole = userRole.toUpperCase().replace('_', '');
        const isAllowed = roles.some(role => {
            const normalizedAllowed = role.toUpperCase().replace('_', '');
            return normalizedUserRole === normalizedAllowed ||
                   normalizedUserRole === 'SUPERADMIN' || 
                   normalizedUserRole === 'SUPER_ADMIN';
        });
        
        if (!isAllowed) {
            return res.status(403).json({ 
                error: 'Insufficient permissions',
                required: roles,
                current: userRole
            });
        }
        next();
    };
};

// ============================================================================
// ANALYTICS ENDPOINTS
// ============================================================================

/**
 * GET /api/ai/learning/analytics
 * Get learning system analytics
 * Available to: authenticated users (scoped by organization)
 */
router.get('/analytics', verifyToken, async (req, res) => {
    try {
        const organizationId = req.user?.organizationId || req.query.organizationId;
        const analytics = await learningSystem.getAnalytics(organizationId);
        
        res.json({
            success: true,
            data: analytics
        });
    } catch (error) {
        console.error('[AI Learning] Analytics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch learning analytics',
            message: error.message
        });
    }
});

/**
 * GET /api/ai/learning/analytics/global
 * Get global learning analytics (all organizations)
 * Available to: SUPERADMIN only
 */
router.get('/analytics/global', verifySuperAdmin, async (req, res) => {
    try {
        const analytics = await learningSystem.getAnalytics(null);
        
        res.json({
            success: true,
            data: analytics
        });
    } catch (error) {
        console.error('[AI Learning] Global analytics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch global analytics',
            message: error.message
        });
    }
});

// ============================================================================
// PATTERN ENDPOINTS
// ============================================================================

/**
 * GET /api/ai/learning/patterns/:capability
 * Get learned patterns for a specific capability
 * Available to: authenticated users
 */
router.get('/patterns/:capability', verifyToken, async (req, res) => {
    try {
        const organizationId = req.user?.organizationId || req.query.organizationId;
        const { capability } = req.params;

        if (!organizationId) {
            return res.status(400).json({
                success: false,
                error: 'Organization ID required'
            });
        }

        const patterns = await learningSystem.getPatterns(organizationId, capability);
        
        res.json({
            success: true,
            data: patterns
        });
    } catch (error) {
        console.error('[AI Learning] Patterns fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch patterns',
            message: error.message
        });
    }
});

/**
 * GET /api/ai/learning/suggestions/:capability
 * Get prompt suggestions based on learned patterns
 * Available to: authenticated users
 */
router.get('/suggestions/:capability', verifyToken, async (req, res) => {
    try {
        const organizationId = req.user?.organizationId || req.query.organizationId;
        const { capability } = req.params;

        if (!organizationId) {
            return res.status(400).json({
                success: false,
                error: 'Organization ID required'
            });
        }

        const suggestions = await learningSystem.getPromptSuggestions(organizationId, capability);
        
        res.json({
            success: true,
            data: suggestions
        });
    } catch (error) {
        console.error('[AI Learning] Suggestions error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch suggestions',
            message: error.message
        });
    }
});

/**
 * GET /api/ai/learning/interactions
 * Get recent AI interactions
 * Available to: authenticated users
 */
router.get('/interactions', verifyToken, async (req, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const limit = parseInt(req.query.limit) || 10;
        const range = req.query.range || '7d';
        
        // Calculate date range
        const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - days);
        
        const { getDatabase } = await import('../src/database/Database.js');

        const interactions = await new Promise((resolve, reject) => {
            const sql = organizationId 
                ? `SELECT * FROM ai_logs WHERE user_id IN (SELECT id FROM users WHERE organization_id = ?) AND created_at >= ? ORDER BY created_at DESC LIMIT ?`
                : `SELECT * FROM ai_logs WHERE created_at >= ? ORDER BY created_at DESC LIMIT ?`;
            const params = organizationId 
                ? [organizationId, sinceDate.toISOString(), limit]
                : [sinceDate.toISOString(), limit];
            
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        res.json({
            success: true,
            interactions: interactions.map(i => ({
                id: i.id,
                action: i.action,
                model: i.model,
                tokens: (i.input_tokens || 0) + (i.output_tokens || 0),
                latency: i.latency_ms,
                topic: i.topic,
                createdAt: i.created_at
            }))
        });
    } catch (error) {
        console.error('[AI Learning] Interactions error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch interactions',
            message: error.message
        });
    }
});

/**
 * GET /api/ai/learning/metrics
 * Get learning metrics
 * Available to: authenticated users
 */
router.get('/metrics', verifyToken, async (req, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const range = req.query.range || '7d';
        
        // Calculate date range
        const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - days);
        
        const { getDatabase } = await import('../src/database/Database.js');

        const analytics = await learningSystem.getAnalytics(organizationId);
        
        // Get quality trends
        const qualityTrends = await new Promise((resolve, reject) => {
            const sql = organizationId
                ? `SELECT DATE(created_at) as date, AVG(1.0) as score FROM ai_logs WHERE user_id IN (SELECT id FROM users WHERE organization_id = ?) AND created_at >= ? GROUP BY DATE(created_at) ORDER BY date`
                : `SELECT DATE(created_at) as date, AVG(1.0) as score FROM ai_logs WHERE created_at >= ? GROUP BY DATE(created_at) ORDER BY date`;
            const params = organizationId
                ? [organizationId, sinceDate.toISOString()]
                : [sinceDate.toISOString()];
            
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else {
                    // Fill missing dates with default score
                    const trends = [];
                    for (let i = 0; i < days; i++) {
                        const date = new Date(sinceDate);
                        date.setDate(date.getDate() + i);
                        const existing = rows.find(r => r.date === date.toISOString().split('T')[0]);
                        trends.push({
                            date: date.toISOString().split('T')[0],
                            score: existing ? existing.score : 0.75
                        });
                    }
                    resolve(trends);
                }
            });
        });
        
        res.json({
            success: true,
            metrics: {
                totalInteractions: analytics.totalInteractions || 0,
                successRate: analytics.successRate || 0,
                avgQualityScore: analytics.averageAutoFeedback || 0.75,
                avgResponseTime: analytics.avgResponseTime || 1.2,
                patternsLearned: analytics.patterns?.total || 0,
                activeModels: analytics.activeModels || 0
            },
            qualityTrends
        });
    } catch (error) {
        console.error('[AI Learning] Metrics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch metrics',
            message: error.message
        });
    }
});

// ============================================================================
// ADMIN ENDPOINTS
// ============================================================================

/**
 * POST /api/ai/learning/extract
 * Manually trigger pattern extraction
 * Available to: ADMIN, SUPERADMIN
 */
router.post('/extract', verifyToken, requireRole(['ADMIN', 'SUPERADMIN', 'OWNER']), async (req, res) => {
    try {
        const { organizationId, capability } = req.body;
        const targetOrgId = organizationId || req.user?.organizationId;

        let result;
        if (capability && targetOrgId) {
            // Extract for specific org/capability
            result = await learningSystem.extractPatternsForCapability(targetOrgId, capability);
        } else {
            // Extract all patterns
            result = await learningSystem.extractAllPatterns();
        }
        
        res.json({
            success: true,
            message: 'Pattern extraction completed',
            data: result
        });
    } catch (error) {
        console.error('[AI Learning] Extraction error:', error);
        res.status(500).json({
            success: false,
            error: 'Pattern extraction failed',
            message: error.message
        });
    }
});

/**
 * POST /api/ai/learning/consolidate
 * Manually trigger learning consolidation
 * Available to: SUPERADMIN only
 */
router.post('/consolidate', verifySuperAdmin, async (req, res) => {
    try {
        const result = await learningSystem.consolidateLearnings();
        
        res.json({
            success: true,
            message: 'Learning consolidation completed',
            data: result
        });
    } catch (error) {
        console.error('[AI Learning] Consolidation error:', error);
        res.status(500).json({
            success: false,
            error: 'Learning consolidation failed',
            message: error.message
        });
    }
});

/**
 * POST /api/ai/learning/cleanup
 * Manually trigger data cleanup
 * Available to: SUPERADMIN only
 */
router.post('/cleanup', verifySuperAdmin, async (req, res) => {
    try {
        const result = await learningSystem.cleanupOldData();
        
        res.json({
            success: true,
            message: 'Data cleanup completed',
            data: result
        });
    } catch (error) {
        console.error('[AI Learning] Cleanup error:', error);
        res.status(500).json({
            success: false,
            error: 'Data cleanup failed',
            message: error.message
        });
    }
});

// ============================================================================
// JOB HISTORY ENDPOINTS
// ============================================================================

/**
 * GET /api/ai/learning/jobs
 * Get learning job history
 * Available to: ADMIN, SUPERADMIN
 */
router.get('/jobs', verifyToken, requireRole(['ADMIN', 'SUPERADMIN', 'OWNER']), async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const jobs = await learningSystem.getJobHistory(limit);
        
        res.json({
            success: true,
            data: jobs
        });
    } catch (error) {
        console.error('[AI Learning] Jobs fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch job history',
            message: error.message
        });
    }
});

// ============================================================================
// CONFIGURATION ENDPOINTS
// ============================================================================

/**
 * GET /api/ai/learning/config
 * Get learning system configuration
 * Available to: SUPERADMIN only
 */
router.get('/config', verifySuperAdmin, async (req, res) => {
    try {
        const { CONFIG   } = await import('../ai/learningSystem.js');
        
        res.json({
            success: true,
            data: {
                successThreshold: CONFIG.successThreshold,
                failureThreshold: CONFIG.failureThreshold,
                minSamplesForPatterns: CONFIG.minSamplesForPatterns,
                minConfidenceForInjection: CONFIG.minConfidenceForInjection,
                extractionInterval: CONFIG.extractionInterval,
                insightInterval: CONFIG.insightInterval,
                interactionRetentionDays: CONFIG.interactionRetentionDays,
                patternRetentionDays: CONFIG.patternRetentionDays
            }
        });
    } catch (error) {
        console.error('[AI Learning] Config fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch configuration',
            message: error.message
        });
    }
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * GET /api/ai/learning/health
 * Check learning system health
 * Available to: all authenticated users
 */
router.get('/health', verifyToken, async (req, res) => {
    try {
        const analytics = await learningSystem.getAnalytics(req.user?.organizationId);
        
        const health = {
            status: 'healthy',
            totalInteractions: analytics.totalInteractions,
            patternsAvailable: analytics.patterns?.total || 0,
            avgQuality: analytics.averageAutoFeedback,
            lastJobStatus: analytics.recentJobs?.[0]?.status || 'unknown'
        };

        // Determine health status
        if (analytics.error) {
            health.status = 'degraded';
            health.error = analytics.error;
        } else if (analytics.recentJobs?.[0]?.status === 'FAILED') {
            health.status = 'warning';
            health.warning = 'Last scheduled job failed';
        }
        
        res.json({
            success: true,
            data: health
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            data: {
                status: 'unhealthy',
                error: error.message
            }
        });
    }
});

export default router;
