/**
 * Analytics API Routes
 */

import express from 'express';
const router = express.Router();
import * as CohortServiceModule from '../services/cohortService.js';
const CohortService = CohortServiceModule.default || CohortServiceModule;
import * as ExperimentServiceModule from '../services/experimentService.js';
const ExperimentService = ExperimentServiceModule.default || ExperimentServiceModule;
import auth from '../middleware/authMiddleware.js';
import { verifyAdmin  } from '../middleware/adminMiddleware.js';
const requireAdmin = verifyAdmin;

// GET /api/analytics/cohorts — Cohort Matrix (Admin only)
router.get('/cohorts', auth, requireAdmin, async (req, res) => {
    try {
        const matrix = await CohortService.getRetentionMatrix();
        res.json({ success: true, matrix });
    } catch (error) {
        console.error('Cohort analysis error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/experiments/me — User's feature flags
router.get('/experiments/me', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const flags = await ExperimentService.getAllUserExperiments(userId);
        res.json({ success: true, flags });
    } catch (error) {
        console.error('Experiment assignment error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
