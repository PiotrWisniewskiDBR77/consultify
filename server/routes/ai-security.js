/**
 * AI Security API Routes
 * 
 * Endpoints for enterprise security features, audit logs, and data access tracking.
 */

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbac');
const { enterpriseSecurity } = require('../services/ai/enterpriseSecurity');
const db = require('../database');

/**
 * GET /api/ai-security/audit-log
 * Get audit log entries
 */
router.get('/audit-log', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { userId, action, riskLevel, flagged, limit = 100, offset = 0 } = req.query;
        
        const entries = await enterpriseSecurity.getAuditLog({
            organizationId: req.user.organization_id,
            userId,
            action,
            riskLevel,
            flagged: flagged === 'true' ? true : flagged === 'false' ? false : undefined,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        res.json({
            success: true,
            data: entries,
            count: entries.length
        });
    } catch (error) {
        console.error('[AI Security API] Error getting audit log:', error);
        res.status(500).json({ error: 'Failed to get audit log', details: error.message });
    }
});

/**
 * GET /api/ai-security/summary
 * Get security summary for organization
 */
router.get('/summary', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const summary = await enterpriseSecurity.getSecuritySummary(req.user.organization_id);
        res.json({ success: true, data: summary });
    } catch (error) {
        console.error('[AI Security API] Error getting summary:', error);
        res.status(500).json({ error: 'Failed to get summary', details: error.message });
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

module.exports = router;

