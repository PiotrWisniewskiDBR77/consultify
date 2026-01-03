/**
 * Security Policies Routes
 * 
 * API endpoints for managing organization security policies.
 * SuperAdmin can manage policies for all organizations.
 * Org Admins can manage their own organization's policy.
 */

import express from 'express';
const router = express.Router();
import authMiddleware from '../middleware/authMiddleware.js';
import verifySuperAdmin from '../middleware/superAdminMiddleware.js';
const SecurityPolicyService = import('securityPolicyService.js');

// ==========================================
// SUPERADMIN ROUTES
// ==========================================

/**
 * GET /api/security-policies/defaults
 * Get platform default security policy
 */
router.get('/defaults', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const policy = await SecurityPolicyService.getPolicy(null);
        res.json({ policy });
    } catch (error) {
        console.error('[SecurityPolicies] Get defaults error:', error);
        res.status(500).json({ error: 'Failed to get default policy' });
    }
});

/**
 * PUT /api/security-policies/defaults
 * Update platform default security policy
 */
router.put('/defaults', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        await SecurityPolicyService.upsertPolicy(null, req.body, req.user.id);
        res.json({ success: true });
    } catch (error) {
        console.error('[SecurityPolicies] Update defaults error:', error);
        res.status(500).json({ error: 'Failed to update default policy' });
    }
});

/**
 * GET /api/security-policies/all
 * List all organization policies (SuperAdmin)
 */
router.get('/all', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        import { getDatabase } from '../src/database/Database.js';
const db = getDatabase();
        
        const policies = await new Promise((resolve, reject) => {
            db.all(`
                SELECT sp.*, o.name as organization_name 
                FROM security_policies sp
                LEFT JOIN organizations o ON sp.organization_id = o.id
                ORDER BY sp.created_at DESC
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        // Also get orgs without policies
        const orgsWithoutPolicies = await new Promise((resolve, reject) => {
            db.all(`
                SELECT o.id, o.name 
                FROM organizations o
                LEFT JOIN security_policies sp ON o.id = sp.organization_id
                WHERE sp.id IS NULL
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        res.json({ 
            policies: policies.map(p => ({
                ...p,
                policy: JSON.parse(p.policy_json || '{}')
            })), 
            orgsWithoutPolicies 
        });
    } catch (error) {
        console.error('[SecurityPolicies] List all error:', error);
        res.status(500).json({ error: 'Failed to list policies' });
    }
});

/**
 * GET /api/security-policies/presets
 * Get available compliance presets
 */
router.get('/presets', authMiddleware, async (req, res) => {
    res.json({
        presets: [
            { id: 'none', name: 'Standard', description: 'Basic security settings' },
            { id: 'soc2', name: 'SOC 2', description: 'SOC 2 Type II compliance' },
            { id: 'hipaa', name: 'HIPAA', description: 'Healthcare compliance' },
            { id: 'gdpr', name: 'GDPR', description: 'EU data protection' },
        ]
    });
});

/**
 * POST /api/security-policies/:orgId/preset
 * Apply a compliance preset to organization
 */
router.post('/:orgId/preset', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { orgId } = req.params;
        const { preset } = req.body;
        
        if (!preset) {
            return res.status(400).json({ error: 'Preset name required' });
        }
        
        await SecurityPolicyService.applyPreset(orgId, preset, req.user.id);
        res.json({ success: true, message: `Applied ${preset} preset` });
    } catch (error) {
        console.error('[SecurityPolicies] Apply preset error:', error);
        res.status(400).json({ error: error.message });
    }
});

// ==========================================
// ORGANIZATION-LEVEL ROUTES
// ==========================================

/**
 * GET /api/security-policies/:orgId
 * Get security policy for specific organization
 */
router.get('/:orgId', authMiddleware, async (req, res) => {
    try {
        const { orgId } = req.params;
        
        // Check authorization (SuperAdmin or Org Admin)
        const isSuperAdmin = req.user.role === 'SUPERADMIN';
        const isOrgAdmin = req.user.organizationId === orgId && ['ADMIN', 'OWNER'].includes(req.user.role);
        
        if (!isSuperAdmin && !isOrgAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const policy = await SecurityPolicyService.getPolicy(orgId);
        res.json({ policy });
    } catch (error) {
        console.error('[SecurityPolicies] Get policy error:', error);
        res.status(500).json({ error: 'Failed to get policy' });
    }
});

/**
 * PUT /api/security-policies/:orgId
 * Update security policy for organization
 */
router.put('/:orgId', authMiddleware, async (req, res) => {
    try {
        const { orgId } = req.params;
        
        // Check authorization (SuperAdmin or Org Admin)
        const isSuperAdmin = req.user.role === 'SUPERADMIN';
        const isOrgAdmin = req.user.organizationId === orgId && ['ADMIN', 'OWNER'].includes(req.user.role);
        
        if (!isSuperAdmin && !isOrgAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        await SecurityPolicyService.upsertPolicy(orgId, req.body, req.user.id);
        res.json({ success: true });
    } catch (error) {
        console.error('[SecurityPolicies] Update policy error:', error);
        res.status(500).json({ error: 'Failed to update policy' });
    }
});

/**
 * DELETE /api/security-policies/:orgId
 * Reset organization policy to defaults (delete custom policy)
 */
router.delete('/:orgId', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { orgId } = req.params;
        import { getDatabase } from '../src/database/Database.js';
const db = getDatabase();
        
        await new Promise((resolve, reject) => {
            db.run(`DELETE FROM security_policies WHERE organization_id = ?`, [orgId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        res.json({ success: true, message: 'Policy reset to defaults' });
    } catch (error) {
        console.error('[SecurityPolicies] Delete policy error:', error);
        res.status(500).json({ error: 'Failed to reset policy' });
    }
});

// ==========================================
// VALIDATION ENDPOINTS
// ==========================================

/**
 * POST /api/security-policies/validate-password
 * Validate password against organization's policy
 */
router.post('/validate-password', authMiddleware, async (req, res) => {
    try {
        const { password, organizationId } = req.body;
        
        if (!password) {
            return res.status(400).json({ error: 'Password required' });
        }
        
        const result = await SecurityPolicyService.validatePassword(
            password, 
            organizationId || req.user.organizationId
        );
        
        res.json(result);
    } catch (error) {
        console.error('[SecurityPolicies] Validate password error:', error);
        res.status(500).json({ error: 'Validation failed' });
    }
});

/**
 * GET /api/security-policies/:orgId/login-attempts
 * Get recent login attempts for organization
 */
router.get('/:orgId/login-attempts', authMiddleware, async (req, res) => {
    try {
        const { orgId } = req.params;
        const { limit, success } = req.query;
        
        // Check authorization
        const isSuperAdmin = req.user.role === 'SUPERADMIN';
        const isOrgAdmin = req.user.organizationId === orgId && ['ADMIN', 'OWNER'].includes(req.user.role);
        
        if (!isSuperAdmin && !isOrgAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const attempts = await SecurityPolicyService.getLoginAttempts({
            organizationId: orgId,
            limit: parseInt(limit) || 50,
            success: success !== undefined ? success === 'true' : undefined
        });
        
        res.json({ attempts });
    } catch (error) {
        console.error('[SecurityPolicies] Get login attempts error:', error);
        res.status(500).json({ error: 'Failed to get login attempts' });
    }
});

/**
 * POST /api/security-policies/unlock-account
 * Unlock a locked user account
 */
router.post('/unlock-account', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email required' });
        }
        
        await SecurityPolicyService.unlockAccount(email, req.user.id);
        res.json({ success: true, message: `Account ${email} unlocked` });
    } catch (error) {
        console.error('[SecurityPolicies] Unlock account error:', error);
        res.status(500).json({ error: 'Failed to unlock account' });
    }
});

// ==========================================
// SESSION MANAGEMENT ROUTES
// ==========================================

import { getDatabase } from '../src/database/Database.js';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';

// Helper functions
function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

/**
 * GET /api/security-policies/sessions/all
 * Get all active sessions across all organizations (SuperAdmin)
 */
router.get('/sessions/all', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { page = 1, pageSize = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(pageSize);
        
        const sessions = await dbAll(`
            SELECT 
                us.*,
                u.email as user_email,
                u.firstName as user_first_name,
                u.lastName as user_last_name,
                o.name as organization_name
            FROM user_sessions us
            LEFT JOIN users u ON us.user_id = u.id
            LEFT JOIN organizations o ON us.organization_id = o.id
            WHERE us.is_active = 1
            ORDER BY us.last_activity DESC
            LIMIT ? OFFSET ?
        `, [parseInt(pageSize), offset]);
        
        const total = await dbGet(`
            SELECT COUNT(*) as count FROM user_sessions WHERE is_active = 1
        `);
        
        res.json({ 
            sessions,
            total: total?.count || 0,
            page: parseInt(page),
            pageSize: parseInt(pageSize)
        });
    } catch (error) {
        console.error('[SecurityPolicies] Get all sessions error:', error);
        res.status(500).json({ error: 'Failed to get sessions' });
    }
});

/**
 * GET /api/security-policies/:orgId/sessions
 * Get active sessions for organization
 */
router.get('/:orgId/sessions', authMiddleware, async (req, res) => {
    try {
        const { orgId } = req.params;
        
        // Check authorization
        const isSuperAdmin = req.user.role === 'SUPERADMIN';
        const isOrgAdmin = req.user.organizationId === orgId && ['ADMIN', 'OWNER'].includes(req.user.role);
        
        if (!isSuperAdmin && !isOrgAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const sessions = await dbAll(`
            SELECT 
                us.*,
                u.email as user_email,
                u.firstName as user_first_name,
                u.lastName as user_last_name
            FROM user_sessions us
            LEFT JOIN users u ON us.user_id = u.id
            WHERE us.organization_id = ? AND us.is_active = 1
            ORDER BY us.last_activity DESC
        `, [orgId]);
        
        res.json({ sessions });
    } catch (error) {
        console.error('[SecurityPolicies] Get sessions error:', error);
        res.status(500).json({ error: 'Failed to get sessions' });
    }
});

/**
 * POST /api/security-policies/sessions/:sessionId/terminate
 * Terminate a specific session
 */
router.post('/sessions/:sessionId/terminate', authMiddleware, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { reason = 'admin_action' } = req.body;
        
        // Get session info to check authorization
        const session = await dbGet(`SELECT * FROM user_sessions WHERE id = ?`, [sessionId]);
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        // Check authorization
        const isSuperAdmin = req.user.role === 'SUPERADMIN';
        const isOrgAdmin = req.user.organizationId === session.organization_id && ['ADMIN', 'OWNER'].includes(req.user.role);
        const isOwnSession = session.user_id === req.user.id;
        
        if (!isSuperAdmin && !isOrgAdmin && !isOwnSession) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        await SecurityPolicyService.terminateSession(sessionId, reason);
        
        res.json({ success: true, message: 'Session terminated' });
    } catch (error) {
        console.error('[SecurityPolicies] Terminate session error:', error);
        res.status(500).json({ error: 'Failed to terminate session' });
    }
});

/**
 * POST /api/security-policies/:orgId/sessions/terminate-all
 * Terminate all sessions for a user in organization
 */
router.post('/:orgId/sessions/terminate-all', authMiddleware, async (req, res) => {
    try {
        const { orgId } = req.params;
        const { userId, reason = 'admin_action' } = req.body;
        
        // Check authorization
        const isSuperAdmin = req.user.role === 'SUPERADMIN';
        const isOrgAdmin = req.user.organizationId === orgId && ['ADMIN', 'OWNER'].includes(req.user.role);
        
        if (!isSuperAdmin && !isOrgAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
        }
        
        await SecurityPolicyService.terminateAllSessions(userId, reason);
        
        res.json({ success: true, message: 'All sessions terminated' });
    } catch (error) {
        console.error('[SecurityPolicies] Terminate all sessions error:', error);
        res.status(500).json({ error: 'Failed to terminate sessions' });
    }
});

// ==========================================
// IP ACCESS RULES ROUTES
// ==========================================

/**
 * GET /api/security-policies/:orgId/ip-rules
 * Get IP access rules for organization
 */
router.get('/:orgId/ip-rules', authMiddleware, async (req, res) => {
    try {
        const { orgId } = req.params;
        
        // Check authorization
        const isSuperAdmin = req.user.role === 'SUPERADMIN';
        const isOrgAdmin = req.user.organizationId === orgId && ['ADMIN', 'OWNER'].includes(req.user.role);
        
        if (!isSuperAdmin && !isOrgAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const rules = await dbAll(`
            SELECT iar.*, u.email as created_by_email
            FROM ip_access_rules iar
            LEFT JOIN users u ON iar.created_by = u.id
            WHERE iar.organization_id = ?
            ORDER BY iar.created_at DESC
        `, [orgId]);
        
        res.json({ rules });
    } catch (error) {
        console.error('[SecurityPolicies] Get IP rules error:', error);
        res.status(500).json({ error: 'Failed to get IP rules' });
    }
});

/**
 * POST /api/security-policies/:orgId/ip-rules
 * Add IP access rule
 */
router.post('/:orgId/ip-rules', authMiddleware, async (req, res) => {
    try {
        const { orgId } = req.params;
        const { ipAddress, ruleType, description, expiresAt } = req.body;
        
        // Check authorization
        const isSuperAdmin = req.user.role === 'SUPERADMIN';
        const isOrgAdmin = req.user.organizationId === orgId && ['ADMIN', 'OWNER'].includes(req.user.role);
        
        if (!isSuperAdmin && !isOrgAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        if (!ipAddress) {
            return res.status(400).json({ error: 'IP address required' });
        }
        
        if (!['allow', 'block'].includes(ruleType)) {
            return res.status(400).json({ error: 'Rule type must be "allow" or "block"' });
        }
        
        const id = uuidv4();
        await dbRun(`
            INSERT INTO ip_access_rules (id, organization_id, ip_address, rule_type, description, expires_at, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [id, orgId, ipAddress, ruleType, description, expiresAt, req.user.id]);
        
        res.json({ success: true, id });
    } catch (error) {
        console.error('[SecurityPolicies] Add IP rule error:', error);
        res.status(500).json({ error: 'Failed to add IP rule' });
    }
});

/**
 * DELETE /api/security-policies/:orgId/ip-rules/:ruleId
 * Delete IP access rule
 */
router.delete('/:orgId/ip-rules/:ruleId', authMiddleware, async (req, res) => {
    try {
        const { orgId, ruleId } = req.params;
        
        // Check authorization
        const isSuperAdmin = req.user.role === 'SUPERADMIN';
        const isOrgAdmin = req.user.organizationId === orgId && ['ADMIN', 'OWNER'].includes(req.user.role);
        
        if (!isSuperAdmin && !isOrgAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        await dbRun(`DELETE FROM ip_access_rules WHERE id = ? AND organization_id = ?`, [ruleId, orgId]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('[SecurityPolicies] Delete IP rule error:', error);
        res.status(500).json({ error: 'Failed to delete IP rule' });
    }
});

/**
 * PUT /api/security-policies/:orgId/ip-rules/:ruleId
 * Update IP access rule
 */
router.put('/:orgId/ip-rules/:ruleId', authMiddleware, async (req, res) => {
    try {
        const { orgId, ruleId } = req.params;
        const { ipAddress, ruleType, description, isActive, expiresAt } = req.body;
        
        // Check authorization
        const isSuperAdmin = req.user.role === 'SUPERADMIN';
        const isOrgAdmin = req.user.organizationId === orgId && ['ADMIN', 'OWNER'].includes(req.user.role);
        
        if (!isSuperAdmin && !isOrgAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const updates = [];
        const params = [];
        
        if (ipAddress !== undefined) { updates.push('ip_address = ?'); params.push(ipAddress); }
        if (ruleType !== undefined) { updates.push('rule_type = ?'); params.push(ruleType); }
        if (description !== undefined) { updates.push('description = ?'); params.push(description); }
        if (isActive !== undefined) { updates.push('is_active = ?'); params.push(isActive ? 1 : 0); }
        if (expiresAt !== undefined) { updates.push('expires_at = ?'); params.push(expiresAt); }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }
        
        params.push(ruleId, orgId);
        await dbRun(`UPDATE ip_access_rules SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`, params);
        
        res.json({ success: true });
    } catch (error) {
        console.error('[SecurityPolicies] Update IP rule error:', error);
        res.status(500).json({ error: 'Failed to update IP rule' });
    }
});

// ==========================================
// ACCOUNT LOCKOUTS ROUTES
// ==========================================

/**
 * GET /api/security-policies/lockouts/all
 * Get all account lockouts (SuperAdmin)
 */
router.get('/lockouts/all', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { active = 'true', limit = 100 } = req.query;
        
        let query = `
            SELECT al.*, u.firstName, u.lastName
            FROM account_lockouts al
            LEFT JOIN users u ON al.user_id = u.id
        `;
        
        if (active === 'true') {
            query += ` WHERE al.unlocked_at IS NULL AND (al.expires_at IS NULL OR al.expires_at > datetime('now'))`;
        }
        
        query += ` ORDER BY al.locked_at DESC LIMIT ?`;
        
        const lockouts = await dbAll(query, [parseInt(limit)]);
        
        res.json({ lockouts });
    } catch (error) {
        console.error('[SecurityPolicies] Get lockouts error:', error);
        res.status(500).json({ error: 'Failed to get lockouts' });
    }
});

/**
 * GET /api/security-policies/:orgId/lockouts
 * Get account lockouts for organization
 */
router.get('/:orgId/lockouts', authMiddleware, async (req, res) => {
    try {
        const { orgId } = req.params;
        const { active = 'true' } = req.query;
        
        // Check authorization
        const isSuperAdmin = req.user.role === 'SUPERADMIN';
        const isOrgAdmin = req.user.organizationId === orgId && ['ADMIN', 'OWNER'].includes(req.user.role);
        
        if (!isSuperAdmin && !isOrgAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        let query = `
            SELECT al.*, u.firstName, u.lastName, u.email
            FROM account_lockouts al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE u.organizationId = ?
        `;
        
        if (active === 'true') {
            query += ` AND al.unlocked_at IS NULL AND (al.expires_at IS NULL OR al.expires_at > datetime('now'))`;
        }
        
        query += ` ORDER BY al.locked_at DESC`;
        
        const lockouts = await dbAll(query, [orgId]);
        
        res.json({ lockouts });
    } catch (error) {
        console.error('[SecurityPolicies] Get org lockouts error:', error);
        res.status(500).json({ error: 'Failed to get lockouts' });
    }
});

// ==========================================
// SECURITY STATS ROUTES
// ==========================================

/**
 * GET /api/security-policies/stats
 * Get security statistics (SuperAdmin)
 */
router.get('/stats', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { days = 7 } = req.query;
        const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000).toISOString();
        
        // Active sessions count
        const sessionsCount = await dbGet(`
            SELECT COUNT(*) as count FROM user_sessions WHERE is_active = 1
        `);
        
        // Login attempts stats
        const loginStats = await dbGet(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
                SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed
            FROM login_attempts
            WHERE created_at >= ?
        `, [startDate]);
        
        // Active lockouts
        const lockoutsCount = await dbGet(`
            SELECT COUNT(*) as count FROM account_lockouts 
            WHERE unlocked_at IS NULL AND (expires_at IS NULL OR expires_at > datetime('now'))
        `);
        
        // Organizations with custom policies
        const policiesCount = await dbGet(`
            SELECT COUNT(*) as count FROM security_policies WHERE organization_id IS NOT NULL
        `);
        
        // Login attempts over time
        const loginTrend = await dbAll(`
            SELECT 
                DATE(created_at) as date,
                SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
                SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed
            FROM login_attempts
            WHERE created_at >= ?
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `, [startDate]);
        
        res.json({
            activeSessions: sessionsCount?.count || 0,
            loginAttempts: {
                total: loginStats?.total || 0,
                successful: loginStats?.successful || 0,
                failed: loginStats?.failed || 0,
                successRate: loginStats?.total > 0 
                    ? Math.round((loginStats.successful / loginStats.total) * 100) 
                    : 100
            },
            activeLockouts: lockoutsCount?.count || 0,
            customPolicies: policiesCount?.count || 0,
            loginTrend
        });
    } catch (error) {
        console.error('[SecurityPolicies] Get stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

export default router;

