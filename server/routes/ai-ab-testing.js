/**
 * AI A/B Testing API Routes
 * 
 * Endpoints for managing A/B test experiments.
 */

import express from 'express';
const router = express.Router();
import verifyToken from '../middleware/authMiddleware.js';
const { requireRole } = require('../middleware/rbac');
const { abTestingService } = import('ai/abTesting.js');

/**
 * GET /api/ai-ab-testing/experiments
 * List all experiments
 */
router.get('/experiments', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { status, promptId } = req.query;
        const experiments = await abTestingService.listExperiments({ status, promptId });
        
        res.json({
            success: true,
            data: experiments.map(e => ({
                ...e,
                variants: JSON.parse(e.variants || '[]'),
                traffic_split: JSON.parse(e.traffic_split || '[]')
            }))
        });
    } catch (error) {
        console.error('[AB Testing API] Error listing experiments:', error);
        res.status(500).json({ error: 'Failed to list experiments', details: error.message });
    }
});

/**
 * POST /api/ai-ab-testing/experiments
 * Create new experiment
 */
router.post('/experiments', verifyToken, requireRole(['super_admin']), async (req, res) => {
    try {
        const result = await abTestingService.createExperiment({
            ...req.body,
            createdBy: req.user.id
        });
        
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        console.error('[AB Testing API] Error creating experiment:', error);
        res.status(500).json({ error: 'Failed to create experiment', details: error.message });
    }
});

/**
 * GET /api/ai-ab-testing/experiments/:id
 * Get experiment details with statistics
 */
router.get('/experiments/:id', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const stats = await abTestingService.getExperimentStats(req.params.id);
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('[AB Testing API] Error getting experiment:', error);
        res.status(500).json({ error: 'Failed to get experiment', details: error.message });
    }
});

/**
 * POST /api/ai-ab-testing/experiments/:id/start
 * Start an experiment
 */
router.post('/experiments/:id/start', verifyToken, requireRole(['super_admin']), async (req, res) => {
    try {
        const result = await abTestingService.startExperiment(req.params.id, req.user.id);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[AB Testing API] Error starting experiment:', error);
        res.status(500).json({ error: 'Failed to start experiment', details: error.message });
    }
});

/**
 * POST /api/ai-ab-testing/experiments/:id/stop
 * Stop an experiment
 */
router.post('/experiments/:id/stop', verifyToken, requireRole(['super_admin']), async (req, res) => {
    try {
        const { reason = 'manual' } = req.body;
        const result = await abTestingService.stopExperiment(req.params.id, reason);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[AB Testing API] Error stopping experiment:', error);
        res.status(500).json({ error: 'Failed to stop experiment', details: error.message });
    }
});

/**
 * POST /api/ai-ab-testing/record-outcome
 * Record experiment outcome (called internally by AI pipeline)
 */
router.post('/record-outcome', verifyToken, async (req, res) => {
    try {
        const { experimentId, metric, value } = req.body;
        
        if (!experimentId || !metric || value === undefined) {
            return res.status(400).json({ error: 'experimentId, metric, and value are required' });
        }
        
        await abTestingService.recordOutcome(experimentId, req.user.id, metric, value);
        res.json({ success: true });
    } catch (error) {
        console.error('[AB Testing API] Error recording outcome:', error);
        res.status(500).json({ error: 'Failed to record outcome', details: error.message });
    }
});

export default router;

