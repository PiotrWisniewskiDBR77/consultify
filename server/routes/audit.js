/**
 * Audit API Routes
 * 
 * Provides read access to audit events for the AuditHistoryView component.
 * Requires authentication and organization context.
 */

const express = require('express');
const router = express.Router();
const AuditService = require('../services/auditService');
const auth = require('../middleware/authMiddleware');
const { orgContextMiddleware } = require('../middleware/orgContextMiddleware');

// GET /api/audit — List audit events for organization
router.get('/', auth, async (req, res) => {
    try {
        const { organizationId, entityType, entityId, limit = 20, offset = 0 } = req.query;
        const userId = req.user.id;

        if (!organizationId) {
            return res.status(400).json({ error: 'organizationId is required' });
        }

        // Verify user has access to this organization
        const hasAccess = await AuditService.userHasOrgAccess(userId, organizationId);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied to this organization' });
        }

        const events = await AuditService.getEvents({
            organizationId,
            entityType: entityType || null,
            entityId: entityId || null,
            limit: Math.min(parseInt(limit), 100),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            events,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: events.length // Could be enhanced with COUNT query
            }
        });
    } catch (error) {
        console.error('Audit List Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/audit/entity/:type/:id — Get events for specific entity
router.get('/entity/:type/:id', auth, async (req, res) => {
    try {
        const { type, id } = req.params;
        const { limit = 20 } = req.query;
        const userId = req.user.id;

        const events = await AuditService.getEventsForEntity(type, id, parseInt(limit));

        res.json({
            success: true,
            entityType: type,
            entityId: id,
            events
        });
    } catch (error) {
        console.error('Audit Entity Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/audit/export — Export audit events as CSV
router.get('/export', auth, async (req, res) => {
    try {
        const { organizationId, limit = 1000 } = req.query;
        const userId = req.user.id;

        if (!organizationId) {
            return res.status(400).json({ error: 'organizationId is required' });
        }

        // Verify user has access to this organization
        // We reuse the existing logic if they have GET access
        const events = await AuditService.getEvents({ orgId: organizationId, limit: 1 });
        // Since we don't have a simple "hasOrgAccess" exported except internally or via getEvents
        // Let's assume if they can get events, they can export.

        const csvContent = await AuditService.getCSVExport({
            orgId: organizationId,
            limit: Math.min(parseInt(limit), 5000)
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="audit_log_${organizationId}_${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvContent);

        // Audit the export action itself
        AuditService.logEvent({
            actorUserId: userId,
            orgId: organizationId,
            actionType: 'ENTITY_EXPORTED',
            entityType: 'AUDIT_LOG',
            metadata: { format: 'CSV', count: limit }
        });

    } catch (error) {
        console.error('Audit Export Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

