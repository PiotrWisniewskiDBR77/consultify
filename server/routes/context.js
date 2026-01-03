/**
 * Context API Routes
 * 
 * Manages project context data and readiness validation for assessments.
 * Implements BCG/McKinsey-level context requirements.
 */

import express from 'express';
const router = express.Router();
const ContextService = import('contextService.js');
import verifyToken from '../middleware/authMiddleware.js';

/**
 * GET /api/context/:projectId
 * Get project context with readiness analysis
 */
router.get('/:projectId', verifyToken, async (req, res) => {
    try {
        const organizationId = req.user?.organizationId;
        const projectId = req.params.projectId;

        // Get full context (project + organization profile)
        const fullContext = await ContextService.getFullContext(projectId, organizationId);
        
        if (!fullContext) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Calculate readiness with new weighted system
        const readiness = ContextService.calculateReadiness(fullContext);

        res.json({
            ...fullContext,
            // Legacy fields for backward compatibility
            contextReadinessScore: readiness.score,
            contextGaps: readiness.gaps.map(g => g.label),
            isContextComplete: readiness.level.label === 'Complete',
            // New enhanced readiness data
            readiness: {
                score: readiness.score,
                level: readiness.level.label,
                levelDescription: readiness.level.description,
                canFinalize: readiness.canFinalize,
                canGenerateReport: readiness.canGenerateReport,
                gaps: readiness.gaps,
                optionalGaps: readiness.optionalGaps,
                filledFields: readiness.filledFields,
                byCategory: readiness.byCategory,
                recommendations: readiness.recommendations,
                requiredThreshold: ContextService.FINALIZATION_THRESHOLD
            }
        });
    } catch (err) {
        console.error('[Context API] GET error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /api/context/:projectId
 * Update project context
 */
router.put('/:projectId', verifyToken, async (req, res) => {
    if (req.can && !req.can('edit_project_settings')) {
        return res.status(403).json({ error: 'Permission denied' });
    }

    try {
        const projectId = req.params.projectId;
        const organizationId = req.user?.organizationId;

        // Save context
        const result = await ContextService.saveContext(projectId, req.body);

        // Get full context for readiness calculation
        const fullContext = await ContextService.getFullContext(projectId, organizationId);
        const readiness = ContextService.calculateReadiness(fullContext);

        res.json({
            ...result,
            // Legacy fields
            contextReadinessScore: readiness.score,
            contextGaps: readiness.gaps.map(g => g.label),
            isContextComplete: readiness.level.label === 'Complete',
            // New readiness data
            readiness: {
                score: readiness.score,
                level: readiness.level.label,
                canFinalize: readiness.canFinalize,
                canGenerateReport: readiness.canGenerateReport,
                gaps: readiness.gaps,
                recommendations: readiness.recommendations
            }
        });
    } catch (err) {
        console.error('[Context API] PUT error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/context/:projectId/finalization-check
 * Check if assessment can be finalized based on context readiness
 */
router.get('/:projectId/finalization-check', verifyToken, async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const organizationId = req.user?.organizationId;

        const result = await ContextService.checkFinalizationReadiness(projectId, organizationId);

        res.json(result);
    } catch (err) {
        console.error('[Context API] Finalization check error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/context/:projectId/analyze
 * AI-powered context analysis and recommendations
 */
router.post('/:projectId/analyze', verifyToken, async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const organizationId = req.user?.organizationId;

        const fullContext = await ContextService.getFullContext(projectId, organizationId);
        const readiness = ContextService.calculateReadiness(fullContext);

        // Generate AI recommendations based on gaps
        const aiRecommendations = [];
        
        if (readiness.gaps.length > 0) {
            const criticalGaps = readiness.gaps.filter(g => g.weight >= 15);
            const importantGaps = readiness.gaps.filter(g => g.weight >= 10 && g.weight < 15);
            
            if (criticalGaps.length > 0) {
                aiRecommendations.push({
                    priority: 'CRITICAL',
                    message: `Critical context missing: ${criticalGaps.map(g => g.label).join(', ')}`,
                    impact: 'Report quality will be significantly reduced'
                });
            }
            
            if (importantGaps.length > 0) {
                aiRecommendations.push({
                    priority: 'HIGH',
                    message: `Important context needed: ${importantGaps.map(g => g.label).join(', ')}`,
                    impact: 'Recommendations may be less specific'
                });
            }
        }

        if (!readiness.canFinalize) {
            aiRecommendations.push({
                priority: 'BLOCKING',
                message: `Score ${readiness.score}% is below required ${ContextService.FINALIZATION_THRESHOLD}%`,
                action: 'Complete required fields before finalizing assessment'
            });
        }

        if (readiness.level.label === 'Standard') {
            aiRecommendations.push({
                priority: 'MEDIUM',
                message: 'Consider adding optional context for richer reports',
                fields: readiness.optionalGaps?.slice(0, 3).map(g => g.label) || []
            });
        }

        if (readiness.level.label === 'Complete') {
            aiRecommendations.push({
                priority: 'INFO',
                message: 'Context is complete. Ready for BCG/McKinsey-level report generation.',
                action: 'You may proceed to finalize the assessment'
            });
        }

        res.json({
            score: readiness.score,
            level: readiness.level.label,
            canFinalize: readiness.canFinalize,
            canGenerateReport: readiness.canGenerateReport,
            gaps: readiness.gaps,
            byCategory: readiness.byCategory,
            aiRecommendations,
            contextSummary: await ContextService.getContextSummaryForAI(projectId, organizationId)
        });
    } catch (err) {
        console.error('[Context API] Analyze error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/context/levels
 * Get available context readiness levels (for UI)
 */
router.get('/meta/levels', verifyToken, (req, res) => {
    res.json({
        levels: Object.entries(ContextService.CONTEXT_LEVELS).map(([key, value]) => ({
            key,
            ...value
        })),
        requiredFields: ContextService.REQUIRED_FIELDS,
        finalizationThreshold: ContextService.FINALIZATION_THRESHOLD
    });
});

export default router;
