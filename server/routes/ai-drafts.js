/**
 * AI Drafts API Routes
 * 
 * Endpoints for managing AI-generated drafts in the Draft-Review-Approve pattern.
 */

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { draftService, DRAFT_TYPES } = require('../services/ai/draftService');
const { aiLogger } = require('../services/ai/logger');

// All routes require authentication
router.use(verifyToken);

/**
 * GET /api/ai-drafts
 * Get pending drafts for the current user
 */
router.get('/', async (req, res) => {
    try {
        const { projectId, draftType, limit } = req.query;
        
        const drafts = await draftService.getPendingDrafts(req.user.id, {
            organizationId: req.user.organizationId,
            projectId,
            draftType,
            limit: limit ? parseInt(limit) : 20
        });

        res.json({
            success: true,
            drafts,
            count: drafts.length
        });
    } catch (error) {
        aiLogger.error('DraftsAPI', `GET / error: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch drafts' });
    }
});

/**
 * GET /api/ai-drafts/:id
 * Get a specific draft
 */
router.get('/:id', async (req, res) => {
    try {
        const draft = await draftService.getDraft(req.params.id);
        
        if (!draft) {
            return res.status(404).json({ error: 'Draft not found' });
        }

        // Verify access
        if (draft.user_id !== req.user.id && draft.organization_id !== req.user.organizationId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({ success: true, draft });
    } catch (error) {
        aiLogger.error('DraftsAPI', `GET /:id error: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch draft' });
    }
});

/**
 * GET /api/ai-drafts/entity/:type/:id
 * Get drafts for a specific entity (e.g., task, initiative)
 */
router.get('/entity/:type/:id', async (req, res) => {
    try {
        const drafts = await draftService.getDraftsForEntity(
            req.params.type,
            req.params.id
        );

        res.json({
            success: true,
            drafts,
            count: drafts.length
        });
    } catch (error) {
        aiLogger.error('DraftsAPI', `GET /entity error: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch entity drafts' });
    }
});

/**
 * POST /api/ai-drafts
 * Create a new draft (typically called by AI services)
 */
router.post('/', async (req, res) => {
    try {
        const {
            draftType,
            targetEntityType,
            targetEntityId,
            targetField,
            originalContent,
            suggestedContent,
            confidence,
            reasoning,
            modelUsed,
            tokensUsed
        } = req.body;

        if (!draftType || !suggestedContent) {
            return res.status(400).json({ 
                error: 'Missing required fields: draftType, suggestedContent' 
            });
        }

        if (!DRAFT_TYPES[draftType]) {
            return res.status(400).json({ 
                error: `Invalid draft type. Valid types: ${Object.keys(DRAFT_TYPES).join(', ')}` 
            });
        }

        const result = await draftService.createDraft({
            organizationId: req.user.organizationId,
            projectId: req.body.projectId,
            userId: req.user.id,
            draftType,
            targetEntityType,
            targetEntityId,
            targetField,
            originalContent,
            suggestedContent,
            confidence,
            reasoning,
            modelUsed,
            tokensUsed
        });

        res.status(201).json({
            success: true,
            draft: result
        });
    } catch (error) {
        aiLogger.error('DraftsAPI', `POST / error: ${error.message}`);
        res.status(500).json({ error: 'Failed to create draft' });
    }
});

/**
 * PATCH /api/ai-drafts/:id/approve
 * Approve a draft (optionally with modifications)
 */
router.patch('/:id/approve', async (req, res) => {
    try {
        const { notes, modifications } = req.body;
        
        const result = await draftService.approveDraft(req.params.id, {
            reviewedBy: req.user.id,
            notes,
            modifications
        });

        if (!result.success) {
            return res.status(404).json({ error: result.reason });
        }

        // Fetch the updated draft to return full details
        const draft = await draftService.getDraft(req.params.id);

        res.json({
            success: true,
            status: result.status,
            draft
        });
    } catch (error) {
        aiLogger.error('DraftsAPI', `PATCH /approve error: ${error.message}`);
        res.status(500).json({ error: 'Failed to approve draft' });
    }
});

/**
 * PATCH /api/ai-drafts/:id/reject
 * Reject a draft
 */
router.patch('/:id/reject', async (req, res) => {
    try {
        const { notes } = req.body;
        
        const result = await draftService.rejectDraft(req.params.id, {
            reviewedBy: req.user.id,
            notes
        });

        if (!result.success) {
            return res.status(404).json({ error: result.reason });
        }

        res.json({
            success: true,
            status: result.status
        });
    } catch (error) {
        aiLogger.error('DraftsAPI', `PATCH /reject error: ${error.message}`);
        res.status(500).json({ error: 'Failed to reject draft' });
    }
});

/**
 * GET /api/ai-drafts/stats
 * Get draft statistics for the current user
 */
router.get('/user/stats', async (req, res) => {
    try {
        const stats = await draftService.getDraftStats(
            req.user.id,
            req.user.organizationId
        );

        res.json({
            success: true,
            stats: {
                ...stats,
                acceptanceRate: stats.total > 0 
                    ? Math.round(((stats.approved || 0) + (stats.modified || 0)) / stats.total * 100)
                    : null
            }
        });
    } catch (error) {
        aiLogger.error('DraftsAPI', `GET /stats error: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

/**
 * DELETE /api/ai-drafts/expired
 * Clean up expired drafts (admin only)
 */
router.delete('/expired', async (req, res) => {
    try {
        // Check if user has admin role
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const result = await draftService.expireOldDrafts();
        
        res.json({
            success: true,
            expiredCount: result.expired
        });
    } catch (error) {
        aiLogger.error('DraftsAPI', `DELETE /expired error: ${error.message}`);
        res.status(500).json({ error: 'Failed to expire drafts' });
    }
});

module.exports = router;

