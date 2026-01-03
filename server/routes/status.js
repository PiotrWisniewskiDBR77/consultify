/**
 * Status API Routes
 * 
 * Public endpoints for system status, incidents, and health checks.
 */

const express = require('express');
const router = express.Router();
const statusService = require('../services/statusService');

/**
 * GET /api/status
 * Get overall system status
 */
router.get('/', async (req, res) => {
    try {
        const status = await statusService.getSystemStatus();
        res.json(status);
    } catch (error) {
        console.error('[Status] Error getting system status:', error);
        res.status(500).json({ error: 'Failed to get system status' });
    }
});

/**
 * GET /api/status/incidents
 * Get recent incidents
 */
router.get('/incidents', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const incidents = await statusService.getIncidents(parseInt(limit));
        res.json({ incidents });
    } catch (error) {
        console.error('[Status] Error getting incidents:', error);
        res.status(500).json({ error: 'Failed to get incidents' });
    }
});

/**
 * GET /api/status/maintenance
 * Get upcoming maintenance schedule
 */
router.get('/maintenance', async (req, res) => {
    try {
        const schedule = await statusService.getMaintenanceSchedule();
        res.json({ schedule });
    } catch (error) {
        console.error('[Status] Error getting maintenance schedule:', error);
        res.status(500).json({ error: 'Failed to get maintenance schedule' });
    }
});

/**
 * GET /api/status/uptime
 * Get uptime statistics
 */
router.get('/uptime', async (req, res) => {
    try {
        const { days = 90 } = req.query;
        const stats = await statusService.getUptimeStats(parseInt(days));
        res.json(stats);
    } catch (error) {
        console.error('[Status] Error getting uptime stats:', error);
        res.status(500).json({ error: 'Failed to get uptime stats' });
    }
});

/**
 * POST /api/status/subscribe
 * Subscribe to status updates
 */
router.post('/subscribe', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'Valid email required' });
        }
        
        const result = await statusService.subscribeToUpdates(email);
        res.json(result);
    } catch (error) {
        console.error('[Status] Error subscribing:', error);
        res.status(500).json({ error: 'Failed to subscribe' });
    }
});

/**
 * POST /api/status/incidents (admin only)
 * Create new incident
 */
router.post('/incidents', async (req, res) => {
    try {
        // In production, check admin role
        const incident = await statusService.createIncident(req.body);
        res.status(201).json(incident);
    } catch (error) {
        console.error('[Status] Error creating incident:', error);
        res.status(500).json({ error: 'Failed to create incident' });
    }
});

/**
 * PUT /api/status/incidents/:id (admin only)
 * Update incident
 */
router.put('/incidents/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await statusService.updateIncident(id, req.body);
        res.json(result);
    } catch (error) {
        console.error('[Status] Error updating incident:', error);
        res.status(500).json({ error: 'Failed to update incident' });
    }
});

/**
 * GET /api/status/health
 * Simple health check endpoint
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

module.exports = router;






