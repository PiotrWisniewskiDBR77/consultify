/**
 * Security Routes
 * 
 * API endpoints for security events and compliance management
 */

import express from 'express';
const router = express.Router();
import * as securityServiceModule from '../services/securityService.js';
const securityService = securityServiceModule.default || securityServiceModule;
import * as complianceServiceModule from '../services/complianceService.js';
const complianceService = complianceServiceModule.default || complianceServiceModule;
import verifySuperAdmin from '../middleware/superAdminMiddleware.js';

/**
 * GET /api/security/events
 * Get security events
 */
router.get('/events', verifySuperAdmin, async (req, res) => {
    try {
        const {
            severity,
            resolved,
            eventType,
            userId,
            startDate,
            endDate,
            page = 1,
            pageSize = 50
        } = req.query;

        const filters = {
            severity,
            resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
            eventType,
            userId,
            startDate,
            endDate
        };

        const pagination = { page: parseInt(page), pageSize: parseInt(pageSize) };
        const events = await securityService.getEvents(filters, pagination);
        res.json(events);
    } catch (error) {
        console.error('[Security] Error fetching events:', error);
        res.status(500).json({ error: 'Failed to fetch security events' });
    }
});

/**
 * POST /api/security/events
 * Create a security event
 */
router.post('/events', verifySuperAdmin, async (req, res) => {
    try {
        const event = await securityService.createEvent(req.body);
        res.status(201).json(event);
    } catch (error) {
        console.error('[Security] Error creating event:', error);
        res.status(500).json({ error: 'Failed to create security event' });
    }
});

/**
 * PUT /api/security/events/:id/resolve
 * Resolve a security event
 */
router.put('/events/:id/resolve', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await securityService.resolveEvent(id, req.user.id);
        res.json(result);
    } catch (error) {
        console.error('[Security] Error resolving event:', error);
        res.status(500).json({ error: 'Failed to resolve security event' });
    }
});

/**
 * GET /api/security/events/stats
 * Get security event statistics
 */
router.get('/events/stats', verifySuperAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const filters = { startDate, endDate };
        const stats = await securityService.getStats(filters);
        res.json(stats);
    } catch (error) {
        console.error('[Security] Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch security statistics' });
    }
});

/**
 * GET /api/security/compliance
 * Get compliance records
 */
router.get('/compliance', verifySuperAdmin, async (req, res) => {
    try {
        const { framework, status, controlId } = req.query;
        const filters = { framework, status, controlId };
        const records = await complianceService.getRecords(filters);
        res.json(records);
    } catch (error) {
        console.error('[Security] Error fetching compliance records:', error);
        res.status(500).json({ error: 'Failed to fetch compliance records' });
    }
});

/**
 * POST /api/security/compliance
 * Create a compliance record
 */
router.post('/compliance', verifySuperAdmin, async (req, res) => {
    try {
        const record = await complianceService.createRecord(req.body);
        res.status(201).json(record);
    } catch (error) {
        console.error('[Security] Error creating compliance record:', error);
        res.status(500).json({ error: 'Failed to create compliance record' });
    }
});

/**
 * GET /api/security/compliance/:framework/report
 * Get compliance report for a framework
 */
router.get('/compliance/:framework/report', verifySuperAdmin, async (req, res) => {
    try {
        const { framework } = req.params;
        const report = await complianceService.getFrameworkReport(framework);
        res.json(report);
    } catch (error) {
        console.error('[Security] Error fetching compliance report:', error);
        res.status(500).json({ error: 'Failed to fetch compliance report' });
    }
});

/**
 * GET /api/security/compliance/frameworks
 * Get supported compliance frameworks
 */
router.get('/compliance/frameworks', verifySuperAdmin, async (req, res) => {
    try {
        const frameworks = complianceService.getSupportedFrameworks();
        res.json(frameworks);
    } catch (error) {
        console.error('[Security] Error fetching frameworks:', error);
        res.status(500).json({ error: 'Failed to fetch compliance frameworks' });
    }
});

export default router;
