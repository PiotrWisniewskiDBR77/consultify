/**
 * Help Analytics Routes
 * 
 * Admin-only routes for viewing help system analytics.
 */

const express = require('express');
const router = express.Router();
const helpAnalyticsService = require('../services/helpAnalyticsService');
const { requireRole } = require('../middleware/rbac');

/**
 * GET /api/help-analytics/dashboard
 * Get full dashboard data (Admin/SuperAdmin only)
 */
router.get('/dashboard', requireRole(['ADMIN', 'SUPERADMIN']), async (req, res) => {
    try {
        const { days = 30, organizationId } = req.query;
        
        const data = await helpAnalyticsService.getDashboardData({
            days: parseInt(days),
            organizationId: req.user.role === 'SUPERADMIN' ? organizationId : req.user.organizationId
        });
        
        res.json(data);
    } catch (error) {
        console.error('Error fetching help analytics dashboard:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

/**
 * GET /api/help-analytics/content
 * Get content performance metrics
 */
router.get('/content', requireRole(['ADMIN', 'SUPERADMIN']), async (req, res) => {
    try {
        const { days = 30, contentType, organizationId } = req.query;
        
        const data = await helpAnalyticsService.getContentPerformance({
            days: parseInt(days),
            contentType,
            organizationId: req.user.role === 'SUPERADMIN' ? organizationId : req.user.organizationId
        });
        
        res.json(data);
    } catch (error) {
        console.error('Error fetching content performance:', error);
        res.status(500).json({ error: 'Failed to fetch content analytics' });
    }
});

/**
 * GET /api/help-analytics/search
 * Get search analytics
 */
router.get('/search', requireRole(['ADMIN', 'SUPERADMIN']), async (req, res) => {
    try {
        const { days = 30, organizationId } = req.query;
        
        const data = await helpAnalyticsService.getSearchAnalytics({
            days: parseInt(days),
            organizationId: req.user.role === 'SUPERADMIN' ? organizationId : req.user.organizationId
        });
        
        res.json(data);
    } catch (error) {
        console.error('Error fetching search analytics:', error);
        res.status(500).json({ error: 'Failed to fetch search analytics' });
    }
});

/**
 * GET /api/help-analytics/feedback
 * Get feedback summary
 */
router.get('/feedback', requireRole(['ADMIN', 'SUPERADMIN']), async (req, res) => {
    try {
        const { days = 30, organizationId } = req.query;
        
        const data = await helpAnalyticsService.getFeedbackSummary({
            days: parseInt(days),
            organizationId: req.user.role === 'SUPERADMIN' ? organizationId : req.user.organizationId
        });
        
        res.json(data);
    } catch (error) {
        console.error('Error fetching feedback summary:', error);
        res.status(500).json({ error: 'Failed to fetch feedback analytics' });
    }
});

/**
 * GET /api/help-analytics/tours
 * Get tour analytics
 */
router.get('/tours', requireRole(['ADMIN', 'SUPERADMIN']), async (req, res) => {
    try {
        const { days = 30 } = req.query;
        
        const data = await helpAnalyticsService.getTourAnalytics({
            days: parseInt(days)
        });
        
        res.json(data);
    } catch (error) {
        console.error('Error fetching tour analytics:', error);
        res.status(500).json({ error: 'Failed to fetch tour analytics' });
    }
});

/**
 * GET /api/help-analytics/engagement
 * Get user engagement metrics
 */
router.get('/engagement', requireRole(['ADMIN', 'SUPERADMIN']), async (req, res) => {
    try {
        const { days = 30, organizationId } = req.query;
        
        const data = await helpAnalyticsService.getUserEngagement({
            days: parseInt(days),
            organizationId: req.user.role === 'SUPERADMIN' ? organizationId : req.user.organizationId
        });
        
        res.json(data);
    } catch (error) {
        console.error('Error fetching engagement metrics:', error);
        res.status(500).json({ error: 'Failed to fetch engagement analytics' });
    }
});

module.exports = router;


