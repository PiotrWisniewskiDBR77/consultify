/**
 * Benchmark Routes
 * 
 * API endpoints for framework benchmark comparisons.
 */

const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { FrameworkBenchmarkService } = require('../services/frameworkBenchmarkService');

/**
 * GET /api/benchmark/compare
 * 
 * Compare assessment score to industry benchmark
 */
router.get('/compare', authenticateToken, async (req, res) => {
    try {
        const { framework, score, industry, region, size, categories } = req.query;

        if (!framework || !score) {
            return res.status(400).json({ error: 'Framework and score are required' });
        }

        const scoreResult = {
            overall: parseFloat(score),
            categories: categories ? JSON.parse(categories) : {},
        };

        const comparison = FrameworkBenchmarkService.compareToIndustry(
            framework,
            scoreResult,
            industry || '_global',
            { region, companySize: size }
        );

        res.json(comparison);
    } catch (error) {
        console.error('[Benchmark] Compare error:', error);
        res.status(500).json({ error: 'Failed to compare to benchmark' });
    }
});

/**
 * GET /api/benchmark/percentile
 * 
 * Calculate percentile rank for a score
 */
router.get('/percentile', authenticateToken, (req, res) => {
    try {
        const { framework, score, industry, region, size } = req.query;

        if (!framework || !score) {
            return res.status(400).json({ error: 'Framework and score are required' });
        }

        const percentile = FrameworkBenchmarkService.calculatePercentile(
            framework,
            parseFloat(score),
            industry || '_global',
            { region, companySize: size }
        );

        res.json(percentile);
    } catch (error) {
        console.error('[Benchmark] Percentile error:', error);
        res.status(500).json({ error: 'Failed to calculate percentile' });
    }
});

/**
 * GET /api/benchmark/industries/:framework
 * 
 * Get available industries for a framework
 */
router.get('/industries/:framework', authenticateToken, (req, res) => {
    const { framework } = req.params;
    const industries = FrameworkBenchmarkService.getAvailableIndustries(framework);
    res.json({ framework, industries });
});

/**
 * GET /api/benchmark/regional/:framework
 * 
 * Get regional comparison
 */
router.get('/regional/:framework', authenticateToken, (req, res) => {
    try {
        const { framework } = req.params;
        const { score, industry } = req.query;

        if (!score) {
            return res.status(400).json({ error: 'Score is required' });
        }

        const comparison = FrameworkBenchmarkService.getRegionalComparison(
            framework,
            parseFloat(score),
            industry || '_global'
        );

        res.json({ framework, comparison });
    } catch (error) {
        console.error('[Benchmark] Regional comparison error:', error);
        res.status(500).json({ error: 'Failed to get regional comparison' });
    }
});

/**
 * GET /api/benchmark/data/:framework
 * 
 * Get raw benchmark data for a framework (admin only)
 */
router.get('/data/:framework', authenticateToken, (req, res) => {
    // Only admins can access raw benchmark data
    if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Admin access required' });
    }

    const { framework } = req.params;
    const { industry, region, size } = req.query;

    const data = FrameworkBenchmarkService.getBenchmark(
        framework,
        industry || '_global',
        { region, companySize: size }
    );

    res.json({ framework, data });
});

module.exports = router;






