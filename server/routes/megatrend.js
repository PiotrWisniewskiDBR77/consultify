// server/routes/megatrend.js
// API endpoints for the Megatrend Scanner module

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const MegatrendService = require('../models/megatrend');

// All routes require authentication
router.use(verifyToken);

// GET /api/megatrends/baseline?industry=...
router.get('/baseline', async (req, res) => {
    try {
        const industry = req.query.industry;
        const data = await MegatrendService.getBaselineTrends(industry);
        res.json(data);
    } catch (err) {
        console.error('[Megatrend] baseline error', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/megatrends/radar?industry=...
router.get('/radar', async (req, res) => {
    try {
        const industry = req.query.industry;
        const data = await MegatrendService.getRadarData(industry);
        res.json(data);
    } catch (err) {
        console.error('[Megatrend] radar error', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/megatrends/:id
router.get('/:id', async (req, res) => {
    try {
        const detail = await MegatrendService.getTrendDetail(req.params.id);
        if (!detail) return res.status(404).json({ error: 'Trend not found' });
        res.json(detail);
    } catch (err) {
        console.error('[Megatrend] detail error', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/megatrends/custom
router.post('/custom', async (req, res) => {
    try {
        const companyId = req.user.companyId || req.user.organizationId; // adjust as needed
        const created = await MegatrendService.createCustomTrend(req.body, companyId);
        res.status(201).json(created);
    } catch (err) {
        console.error('[Megatrend] create custom error', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/megatrends/custom/:id
router.put('/custom/:id', async (req, res) => {
    try {
        const companyId = req.user.companyId || req.user.organizationId;
        const updated = await MegatrendService.updateCustomTrend(req.params.id, req.body, companyId);
        if (!updated) return res.status(404).json({ error: 'Custom trend not found' });
        res.json(updated);
    } catch (err) {
        console.error('[Megatrend] update custom error', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
