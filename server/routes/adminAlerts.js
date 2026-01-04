import express from 'express';
const router = express.Router();
import authMiddleware from '../middleware/authMiddleware.js';
import { requireOrgAccess  } from '../middleware/rbac.js';
import * as adminAlertServiceModule from '../services/adminAlertService.js';
const adminAlertService = adminAlertServiceModule.default || adminAlertServiceModule;

/**
 * GET /api/admin-alerts
 * Get all admin alerts for organization
 */
router.get('/', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const limit = parseInt(req.query.limit) || 50;

        const alerts = await adminAlertService.getAlertHistory(orgId, limit);
        res.json({ alerts });
    } catch (error) {
        console.error('[AdminAlerts] Get alerts error:', error);
        res.status(500).json({ error: 'Failed to get admin alerts' });
    }
});

/**
 * POST /api/admin-alerts
 * Create admin alert
 */
router.post('/', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const alertConfig = req.body;

        const alert = await adminAlertService.createAdminAlert(orgId, alertConfig);
        res.json({ success: true, alert });
    } catch (error) {
        console.error('[AdminAlerts] Create alert error:', error);
        res.status(500).json({ error: error.message || 'Failed to create admin alert' });
    }
});

/**
 * PUT /api/admin-alerts/:id
 * Update admin alert
 */
router.put('/:id', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        // For now, update is handled by creating a new alert
        // In a full implementation, we'd add an updateAdminAlert method
        res.status(501).json({ error: 'Update not yet implemented' });
    } catch (error) {
        console.error('[AdminAlerts] Update alert error:', error);
        res.status(500).json({ error: 'Failed to update admin alert' });
    }
});

/**
 * DELETE /api/admin-alerts/:id
 * Delete admin alert (deactivate)
 */
router.delete('/:id', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        // In a full implementation, we'd add a deleteAdminAlert method
        res.status(501).json({ error: 'Delete not yet implemented' });
    } catch (error) {
        console.error('[AdminAlerts] Delete alert error:', error);
        res.status(500).json({ error: 'Failed to delete admin alert' });
    }
});

/**
 * GET /api/admin-alerts/history
 * Get alert trigger history
 */
router.get('/history', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const limit = parseInt(req.query.limit) || 50;

        const alerts = await adminAlertService.getAlertHistory(orgId, limit);
        // Filter to only triggered alerts
        const triggered = alerts.filter(a => a.trigger_count > 0);
        res.json({ alerts: triggered });
    } catch (error) {
        console.error('[AdminAlerts] Get history error:', error);
        res.status(500).json({ error: 'Failed to get alert history' });
    }
});

/**
 * POST /api/admin-alerts/:id/test
 * Test trigger an alert
 */
router.post('/:id/test', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        // In a full implementation, we'd add a testAlert method
        res.status(501).json({ error: 'Test not yet implemented' });
    } catch (error) {
        console.error('[AdminAlerts] Test alert error:', error);
        res.status(500).json({ error: 'Failed to test alert' });
    }
});

export default router;







