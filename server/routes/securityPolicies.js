/**
 * Security Policies Routes
 * 
 * API endpoints for managing organization security policies.
 * SuperAdmin can manage policies for all organizations.
 * Org Admins can manage their own organization's policy.
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const verifySuperAdmin = require('../middleware/superAdminMiddleware');
const SecurityPolicyService = require('../services/securityPolicyService');

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
        const db = require('../database');
        
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
        const db = require('../database');
        
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

module.exports = router;

