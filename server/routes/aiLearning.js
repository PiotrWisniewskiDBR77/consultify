/**
 * AI Learning System Routes
 * 
 * API endpoints for managing and monitoring the AI self-learning system.
 * Includes analytics, pattern management, and admin controls.
 */

const express = require('express');
const router = express.Router();
const { learningSystem } = require('../services/ai/learningSystem');
const verifyToken = require('../middleware/authMiddleware');
const verifySuperAdmin = require('../middleware/superAdminMiddleware');

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
        const { CONFIG } = require('../services/ai/learningSystem');
        
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

module.exports = router;
