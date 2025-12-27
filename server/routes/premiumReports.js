/**
 * Premium Report API Routes
 * 
 * API endpoints for premium report generation, PDF export,
 * and AI-powered content.
 */

const express = require('express');
const router = express.Router();
const premiumPdfService = require('../services/premiumPdfService');
const premiumReportAIService = require('../services/premiumReportAIService');
const verifyToken = require('../middleware/authMiddleware');

/**
 * Generate PDF for a report
 * POST /api/reports/premium/:reportId/pdf
 */
router.post('/:reportId/pdf', verifyToken, async (req, res) => {
    try {
        const { reportId } = req.params;
        const options = req.body;

        const result = await premiumPdfService.generatePDF(reportId, options);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${result.filename}"`,
            'Content-Length': result.size
        });

        res.send(result.pdf);

    } catch (error) {
        console.error('PDF generation error:', error);
        res.status(500).json({
            error: 'Failed to generate PDF',
            message: error.message
        });
    }
});

/**
 * Generate Executive Summary with AI
 * POST /api/reports/premium/ai/executive-summary
 */
router.post('/ai/executive-summary', verifyToken, async (req, res) => {
    try {
        const { assessmentId } = req.body;

        if (!assessmentId) {
            return res.status(400).json({ error: 'assessmentId is required' });
        }

        const result = await premiumReportAIService.generateExecutiveSummary(assessmentId);

        res.json(result);

    } catch (error) {
        console.error('AI generation error:', error);
        res.status(500).json({
            error: 'Failed to generate executive summary',
            message: error.message
        });
    }
});

/**
 * Generate Gap Analysis with AI
 * POST /api/reports/premium/ai/gap-analysis
 */
router.post('/ai/gap-analysis', verifyToken, async (req, res) => {
    try {
        const { assessmentId } = req.body;

        if (!assessmentId) {
            return res.status(400).json({ error: 'assessmentId is required' });
        }

        const result = await premiumReportAIService.generateGapAnalysis(assessmentId);

        res.json(result);

    } catch (error) {
        console.error('AI generation error:', error);
        res.status(500).json({
            error: 'Failed to generate gap analysis',
            message: error.message
        });
    }
});

/**
 * Generate Strategic Recommendations with AI
 * POST /api/reports/premium/ai/recommendations
 */
router.post('/ai/recommendations', verifyToken, async (req, res) => {
    try {
        const { assessmentId, maxRecommendations } = req.body;

        if (!assessmentId) {
            return res.status(400).json({ error: 'assessmentId is required' });
        }

        const result = await premiumReportAIService.generateRecommendations(
            assessmentId,
            { maxRecommendations: maxRecommendations || 10 }
        );

        res.json(result);

    } catch (error) {
        console.error('AI generation error:', error);
        res.status(500).json({
            error: 'Failed to generate recommendations',
            message: error.message
        });
    }
});

/**
 * Generate Transformation Roadmap with AI
 * POST /api/reports/premium/ai/roadmap
 */
router.post('/ai/roadmap', verifyToken, async (req, res) => {
    try {
        const { assessmentId, horizonMonths } = req.body;

        if (!assessmentId) {
            return res.status(400).json({ error: 'assessmentId is required' });
        }

        const result = await premiumReportAIService.generateRoadmap(
            assessmentId,
            { horizonMonths: horizonMonths || 18 }
        );

        res.json(result);

    } catch (error) {
        console.error('AI generation error:', error);
        res.status(500).json({
            error: 'Failed to generate roadmap',
            message: error.message
        });
    }
});

/**
 * Generate ROI Analysis with AI
 * POST /api/reports/premium/ai/roi
 */
router.post('/ai/roi', verifyToken, async (req, res) => {
    try {
        const { assessmentId } = req.body;

        if (!assessmentId) {
            return res.status(400).json({ error: 'assessmentId is required' });
        }

        const result = await premiumReportAIService.generateROIAnalysis(assessmentId);

        res.json(result);

    } catch (error) {
        console.error('AI generation error:', error);
        res.status(500).json({
            error: 'Failed to generate ROI analysis',
            message: error.message
        });
    }
});

/**
 * Generate custom section with AI
 * POST /api/reports/premium/ai/custom
 */
router.post('/ai/custom', verifyToken, async (req, res) => {
    try {
        const { assessmentId, prompt } = req.body;

        if (!assessmentId) {
            return res.status(400).json({ error: 'assessmentId is required' });
        }

        if (!prompt) {
            return res.status(400).json({ error: 'prompt is required' });
        }

        const result = await premiumReportAIService.generateCustomSection(
            assessmentId,
            prompt
        );

        res.json(result);

    } catch (error) {
        console.error('AI generation error:', error);
        res.status(500).json({
            error: 'Failed to generate custom section',
            message: error.message
        });
    }
});

/**
 * Get assessment data for report context
 * GET /api/reports/premium/assessment/:assessmentId/data
 */
router.get('/assessment/:assessmentId/data', verifyToken, async (req, res) => {
    try {
        const { assessmentId } = req.params;

        const data = await premiumReportAIService.getAssessmentData(assessmentId);

        res.json(data);

    } catch (error) {
        console.error('Error fetching assessment data:', error);
        res.status(500).json({
            error: 'Failed to fetch assessment data',
            message: error.message
        });
    }
});

module.exports = router;
