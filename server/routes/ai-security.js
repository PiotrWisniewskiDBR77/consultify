/**
 * AI Security API Routes
 * 
 * Endpoints for enterprise security features, audit logs, and data access tracking.
 */

import express from 'express';
const router = express.Router();
import verifyToken from '../middleware/authMiddleware.js';
const { requireRole } = require('../middleware/rbac');
const { enterpriseSecurity } = import('ai/enterpriseSecurity.js');
import { getDatabase } from '../database/Database.js';
const db = getDatabase();

/**
 * GET /api/ai-security/audit-log OR /api/ai-security/audit-logs
 * Get audit log entries with pagination, filtering, and search
 */
const auditLogHandler = async (req, res) => {
    try {
        const { 
            userId, 
            action, 
            riskLevel, 
            flagged, 
            limit = 100, 
            offset = 0,
            page = 1,
            search,
            startDate,
            endDate
        } = req.query;
        
        // Calculate offset from page if provided
        const pageSize = parseInt(limit);
        const calculatedOffset = page > 1 ? (parseInt(page) - 1) * pageSize : parseInt(offset);
        
        const entries = await enterpriseSecurity.getAuditLog({
            organizationId: req.user.organization_id,
            userId,
            action,
            riskLevel,
            flagged: flagged === 'true' ? true : flagged === 'false' ? false : undefined,
            search,
            startDate,
            endDate,
            limit: pageSize,
            offset: calculatedOffset
        });

        // Get total count for pagination
        const total = await enterpriseSecurity.getAuditLogCount({
            organizationId: req.user.organization_id,
            userId,
            action,
            riskLevel,
            flagged: flagged === 'true' ? true : flagged === 'false' ? false : undefined,
            search,
            startDate,
            endDate
        });
        
        res.json({
            success: true,
            logs: entries,
            data: entries, // Keep for backward compatibility
            total,
            count: entries.length,
            pagination: {
                page: parseInt(page),
                limit: pageSize,
                total,
                totalPages: Math.ceil(total / pageSize)
            }
        });
    } catch (error) {
        console.error('[AI Security API] Error getting audit log:', error);
        res.status(500).json({ success: false, error: 'Failed to get audit log', details: error.message });
    }
};

router.get('/audit-log', verifyToken, requireRole(['super_admin', 'admin']), auditLogHandler);
router.get('/audit-logs', verifyToken, requireRole(['super_admin', 'admin']), auditLogHandler);

/**
 * GET /api/ai-security/summary
 * Get security summary for organization
 */
router.get('/summary', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const summary = await enterpriseSecurity.getSecuritySummary(req.user.organization_id);
        // Also return in the shape expected by the frontend
        res.json({ 
            success: true, 
            data: summary,
            // Frontend expects these fields directly
            total_requests: summary.totalRequests || 0,
            flagged_requests: summary.flaggedRequests || 0,
            high_risk: summary.highRiskCount || 0,
            medium_risk: summary.mediumRiskCount || 0,
            low_risk: (summary.totalRequests || 0) - (summary.highRiskCount || 0) - (summary.mediumRiskCount || 0),
            period: summary.period || 'last_24h'
        });
    } catch (error) {
        console.error('[AI Security API] Error getting summary:', error);
        res.status(500).json({ error: 'Failed to get summary', details: error.message });
    }
});

/**
 * GET /api/ai-security/audit-logs/export
 * Export audit log entries as CSV
 */
router.get('/audit-logs/export', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { 
            riskLevel, 
            flagged,
            startDate,
            endDate,
            format = 'csv'
        } = req.query;
        
        const entries = await enterpriseSecurity.getAuditLog({
            organizationId: req.user.organization_id,
            riskLevel,
            flagged: flagged === 'true' ? true : flagged === 'false' ? false : undefined,
            startDate,
            endDate,
            limit: 10000 // Max export limit
        });

        if (format === 'json') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.json"`);
            return res.json(entries);
        }

        // Generate CSV
        const headers = [
            'Timestamp', 'User ID', 'Action', 'Resource Type', 'Resource ID',
            'Model Used', 'Tokens Used', 'Cost USD', 'Risk Level', 'Flagged',
            'Flag Reason', 'IP Address', 'Request Summary'
        ];
        
        const csvRows = [headers.join(',')];
        
        for (const entry of entries) {
            const row = [
                entry.timestamp || '',
                entry.user_id || '',
                entry.action || '',
                entry.resource_type || '',
                entry.resource_id || '',
                entry.model_used || '',
                entry.tokens_used || 0,
                entry.cost_usd || 0,
                entry.risk_level || 'LOW',
                entry.flagged ? 'Yes' : 'No',
                (entry.flag_reason || '').replace(/,/g, ';').replace(/\n/g, ' '),
                entry.ip_address || '',
                (entry.request_summary || '').replace(/,/g, ';').replace(/\n/g, ' ').substring(0, 200)
            ];
            csvRows.push(row.map(v => `"${v}"`).join(','));
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`);
        res.send(csvRows.join('\n'));

    } catch (error) {
        console.error('[AI Security API] Error exporting audit log:', error);
        res.status(500).json({ error: 'Failed to export audit log', details: error.message });
    }
});

/**
 * GET /api/ai-security/rate-limits
 * Get rate limits for organization
 */
router.get('/rate-limits', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const limits = await db.all(`
            SELECT * FROM ai_rate_limits WHERE organization_id = ?
        `, [req.user.organization_id]);
        
        res.json({ success: true, data: limits });
    } catch (error) {
        console.error('[AI Security API] Error getting rate limits:', error);
        res.status(500).json({ error: 'Failed to get rate limits', details: error.message });
    }
});

/**
 * POST /api/ai-security/rate-limits
 * Create or update rate limit
 */
router.post('/rate-limits', verifyToken, requireRole(['super_admin']), async (req, res) => {
    try {
        const { ruleName, limitType, limitValue, appliesTo = 'all' } = req.body;
        
        if (!ruleName || !limitType || !limitValue) {
            return res.status(400).json({ error: 'ruleName, limitType, and limitValue are required' });
        }
        
        await db.run(`
            INSERT OR REPLACE INTO ai_rate_limits 
            (id, organization_id, rule_name, limit_type, limit_value, applies_to, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `, [
            `${req.user.organization_id}:${ruleName}`,
            req.user.organization_id,
            ruleName, limitType, limitValue, appliesTo
        ]);
        
        res.json({ success: true, message: 'Rate limit configured' });
    } catch (error) {
        console.error('[AI Security API] Error setting rate limit:', error);
        res.status(500).json({ error: 'Failed to set rate limit', details: error.message });
    }
});

/**
 * DELETE /api/ai-security/rate-limits/:id
 * Delete rate limit
 */
router.delete('/rate-limits/:id', verifyToken, requireRole(['super_admin']), async (req, res) => {
    try {
        await db.run(`
            DELETE FROM ai_rate_limits 
            WHERE id = ? AND organization_id = ?
        `, [req.params.id, req.user.organization_id]);
        
        res.json({ success: true, message: 'Rate limit deleted' });
    } catch (error) {
        console.error('[AI Security API] Error deleting rate limit:', error);
        res.status(500).json({ error: 'Failed to delete rate limit', details: error.message });
    }
});

/**
 * GET /api/ai-security/organization-settings
 * Get AI settings for organization
 */
router.get('/organization-settings', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        let settings = await db.get(`
            SELECT * FROM ai_organization_settings WHERE organization_id = ?
        `, [req.user.organization_id]);
        
        if (!settings) {
            // Return defaults
            settings = {
                organization_id: req.user.organization_id,
                enabled_features: JSON.stringify(['chat', 'reports', 'initiatives', 'magic_wand']),
                disabled_models: JSON.stringify([]),
                max_tokens_per_request: 4000,
                allow_web_research: true,
                allow_tool_calling: true,
                data_retention_days: 90,
                require_approval_for: JSON.stringify([]),
                custom_system_prompt: null
            };
        }
        
        res.json({
            success: true,
            data: {
                ...settings,
                enabled_features: JSON.parse(settings.enabled_features || '[]'),
                disabled_models: JSON.parse(settings.disabled_models || '[]'),
                require_approval_for: JSON.parse(settings.require_approval_for || '[]')
            }
        });
    } catch (error) {
        console.error('[AI Security API] Error getting settings:', error);
        res.status(500).json({ error: 'Failed to get settings', details: error.message });
    }
});

/**
 * PUT /api/ai-security/organization-settings
 * Update AI settings for organization
 */
router.put('/organization-settings', verifyToken, requireRole(['super_admin']), async (req, res) => {
    try {
        const {
            enabledFeatures,
            disabledModels,
            maxTokensPerRequest,
            allowWebResearch,
            allowToolCalling,
            dataRetentionDays,
            requireApprovalFor,
            customSystemPrompt
        } = req.body;
        
        await db.run(`
            INSERT OR REPLACE INTO ai_organization_settings 
            (organization_id, enabled_features, disabled_models, max_tokens_per_request,
             allow_web_research, allow_tool_calling, data_retention_days,
             require_approval_for, custom_system_prompt, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `, [
            req.user.organization_id,
            JSON.stringify(enabledFeatures || []),
            JSON.stringify(disabledModels || []),
            maxTokensPerRequest || 4000,
            allowWebResearch !== false ? 1 : 0,
            allowToolCalling !== false ? 1 : 0,
            dataRetentionDays || 90,
            JSON.stringify(requireApprovalFor || []),
            customSystemPrompt || null
        ]);
        
        res.json({ success: true, message: 'Settings updated' });
    } catch (error) {
        console.error('[AI Security API] Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings', details: error.message });
    }
});

/**
 * GET /api/ai-security/data-access-log
 * Get data access log entries
 */
router.get('/data-access-log', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { dataType, limit = 100, offset = 0 } = req.query;
        
        let query = `
            SELECT * FROM ai_data_access_log 
            WHERE organization_id = ?
        `;
        const params = [req.user.organization_id];
        
        if (dataType) {
            query += ` AND data_type = ?`;
            params.push(dataType);
        }
        
        query += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));
        
        const entries = await db.all(query, params);
        
        res.json({
            success: true,
            data: entries,
            count: entries.length
        });
    } catch (error) {
        console.error('[AI Security API] Error getting data access log:', error);
        res.status(500).json({ error: 'Failed to get data access log', details: error.message });
    }
});

/**
 * POST /api/ai-security/check-rate-limit
 * Check if action is allowed by rate limits
 */
router.post('/check-rate-limit', verifyToken, async (req, res) => {
    try {
        const { action = 'all' } = req.body;
        const result = await enterpriseSecurity.checkRateLimit(req.user.organization_id, action);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[AI Security API] Error checking rate limit:', error);
        res.status(500).json({ error: 'Failed to check rate limit', details: error.message });
    }
});

export default router;

