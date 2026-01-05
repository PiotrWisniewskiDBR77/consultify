/**
 * Audit Log Routes
 * 
 * API endpoints for audit log management and compliance reporting
 */

import express from 'express';
const router = express.Router();
import * as auditLogServiceModule from '../services/auditLogService.js';
const auditLogService = auditLogServiceModule.default || auditLogServiceModule;
import authMiddleware from '../middleware/authMiddleware.js';
import verifySuperAdmin from '../middleware/superAdminMiddleware.js';

/**
 * GET /api/audit-logs
 * Get audit logs with filtering and pagination
 */
router.get('/', verifySuperAdmin, async (req, res) => {
    try {
        const {
            search,
            riskLevel,
            flaggedOnly,
            startDate,
            endDate,
            userId,
            actionType,
            resourceType,
            resourceId,
            organizationId,
            complianceTag,
            page = 1,
            pageSize = 50
        } = req.query;

        const filters = {
            search,
            riskLevel,
            flaggedOnly: flaggedOnly === 'true',
            startDate,
            endDate,
            userId,
            actionType,
            resourceType,
            resourceId,
            organizationId,
            complianceTag
        };

        const pagination = {
            page: parseInt(page),
            pageSize: parseInt(pageSize)
        };

        const [logs, total] = await Promise.all([
            auditLogService.getLogs(filters, pagination),
            auditLogService.getLogsCount(filters)
        ]);

        res.json({
            logs,
            pagination: {
                page: pagination.page,
                pageSize: pagination.pageSize,
                total,
                totalPages: Math.ceil(total / pagination.pageSize)
            }
        });
    } catch (error) {
        console.error('[AuditLog] Error fetching logs:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

/**
 * GET /api/audit-logs/:id
 * Get audit log by ID
 */
router.get('/:id', verifySuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const log = await auditLogService.getLogById(id);

        if (!log) {
            return res.status(404).json({ error: 'Audit log not found' });
        }

        res.json(log);
    } catch (error) {
        console.error('[AuditLog] Error fetching log:', error);
        res.status(500).json({ error: 'Failed to fetch audit log' });
    }
});

/**
 * GET /api/audit-logs/stats
 * Get audit log statistics
 */
router.get('/stats/summary', verifySuperAdmin, async (req, res) => {
    try {
        const { startDate, endDate, organizationId } = req.query;

        const filters = { startDate, endDate, organizationId };
        const stats = await auditLogService.getStats(filters);

        res.json(stats);
    } catch (error) {
        console.error('[AuditLog] Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch audit log statistics' });
    }
});

/**
 * GET /api/audit-logs/export
 * Export audit logs to CSV
 */
router.get('/export/csv', verifySuperAdmin, async (req, res) => {
    try {
        const filters = req.query;
        const csv = await auditLogService.exportToCSV(filters);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
        res.send(csv);
    } catch (error) {
        console.error('[AuditLog] Error exporting logs:', error);
        res.status(500).json({ error: 'Failed to export audit logs' });
    }
});

/**
 * GET /api/audit-logs/compliance/:framework
 * Get compliance report for a specific framework
 */
router.get('/compliance/:framework', verifySuperAdmin, async (req, res) => {
    try {
        const { framework } = req.params;
        const { startDate, endDate, organizationId } = req.query;

        const filters = { startDate, endDate, organizationId };
        const logs = await auditLogService.getComplianceReport(framework, filters);

        res.json({
            framework,
            logs,
            count: logs.length
        });
    } catch (error) {
        console.error('[AuditLog] Error fetching compliance report:', error);
        res.status(500).json({ error: 'Failed to fetch compliance report' });
    }
});

/**
 * POST /api/audit-logs
 * Create an audit log entry (internal use)
 */
router.post('/', authMiddleware, async (req, res) => {
    try {
        const logData = {
            ...req.body,
            user_id: req.user?.id,
            user_email: req.user?.email,
            ip_address: req.ip,
            user_agent: req.get('user-agent'),
            request_id: req.headers['x-request-id']
        };

        const result = await auditLogService.createLog(logData);
        res.status(201).json(result);
    } catch (error) {
        console.error('[AuditLog] Error creating log:', error);
        res.status(500).json({ error: 'Failed to create audit log' });
    }
});

export default router;














