// Economics Routes - Value hypotheses and financial assumptions
// Step 6: Stabilization, Reporting & Economics

const express = require('express');
const router = express.Router();
const EconomicsService = require('../services/economicsService');
const verifyToken = require('../middleware/authMiddleware');

// GET /api/economics/:projectId/value-hypotheses
router.get('/:projectId/value-hypotheses', verifyToken, async (req, res) => {
    const { initiativeId } = req.query;
    try {
        const hypotheses = await EconomicsService.getValueHypotheses(req.params.projectId, initiativeId);
        res.json(hypotheses);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/economics/:projectId/value-hypotheses
router.post('/:projectId/value-hypotheses', verifyToken, async (req, res) => {
    const { initiativeId, description, type, confidenceLevel, relatedInitiativeIds } = req.body;

    if (!initiativeId || !description || !type) {
        return res.status(400).json({ error: 'initiativeId, description, and type required' });
    }

    try {
        const hypothesis = await EconomicsService.createValueHypothesis({
            initiativeId,
            projectId: req.params.projectId,
            description,
            type,
            confidenceLevel,
            ownerId: req.userId,
            relatedInitiativeIds
        });
        res.status(201).json(hypothesis);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/economics/value-hypotheses/:id/validate
router.patch('/value-hypotheses/:id/validate', verifyToken, async (req, res) => {
    try {
        const result = await EconomicsService.validateHypothesis(req.params.id, req.userId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/economics/value-hypotheses/:id/financial-assumption
router.post('/value-hypotheses/:id/financial-assumption', verifyToken, async (req, res) => {
    const { lowEstimate, expectedEstimate, highEstimate, currency, timeframe, notes } = req.body;

    try {
        const assumption = await EconomicsService.addFinancialAssumption({
            valueHypothesisId: req.params.id,
            lowEstimate,
            expectedEstimate,
            highEstimate,
            currency,
            timeframe,
            notes
        });
        res.status(201).json(assumption);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/economics/:projectId/summary
router.get('/:projectId/summary', verifyToken, async (req, res) => {
    try {
        const summary = await EconomicsService.getValueSummary(req.params.projectId);
        res.json(summary);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/economics/:projectId/missing-value
router.get('/:projectId/missing-value', verifyToken, async (req, res) => {
    try {
        const missing = await EconomicsService.detectMissingValueHypotheses(req.params.projectId);
        res.json(missing);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
