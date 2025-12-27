/**
 * Performance Metrics API Routes
 * 
 * FAZA 5: Monitoring - Provides performance metrics endpoints
 * 
 * Endpoints:
 * - GET /api/performance-metrics/summary - Get performance summary
 * - GET /api/performance-metrics/memory - Get memory usage
 * - GET /api/performance-metrics/health - Health check with metrics
 */

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { asyncHandler } = require('../utils/errorHandler');
const {
    getMetricsSummary,
    getMemoryMetrics
} = require('../middleware/performanceMetrics');

// GET /api/performance-metrics/summary
// REFACTORED: Uses asyncHandler
router.get('/summary', verifyToken, asyncHandler(async (req, res) => {
    const windowMinutes = parseInt(req.query.windowMinutes) || 60;
    const summary = getMetricsSummary(windowMinutes);
    
    res.json({
        success: true,
        summary,
        timestamp: new Date().toISOString()
    });
}));

// GET /api/performance-metrics/memory
// REFACTORED: Uses asyncHandler
router.get('/memory', verifyToken, asyncHandler(async (req, res) => {
    const memory = getMemoryMetrics();
    
    res.json({
        success: true,
        memory,
        timestamp: new Date().toISOString()
    });
}));

// GET /api/performance-metrics/health
// REFACTORED: Uses asyncHandler
router.get('/health', verifyToken, asyncHandler(async (req, res) => {
    const summary = getMetricsSummary(60); // Last hour
    const memory = getMemoryMetrics();
    
    // Determine health status
    let status = 'healthy';
    const warnings = [];
    
    if (summary.avgResponseTime > 2000) {
        status = 'degraded';
        warnings.push('High average response time');
    }
    
    if (summary.errorRate > 5) {
        status = 'degraded';
        warnings.push('High error rate');
    }
    
    if (memory.heapUsed > 500) { // > 500MB
        status = 'degraded';
        warnings.push('High memory usage');
    }
    
    if (summary.slowRequests > summary.totalRequests * 0.1) {
        status = 'degraded';
        warnings.push('High percentage of slow requests');
    }
    
    res.json({
        status,
        warnings,
        summary,
        memory,
        timestamp: new Date().toISOString()
    });
}));

module.exports = router;






