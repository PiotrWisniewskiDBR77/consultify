/**
 * Branding Routes
 * 
 * API endpoints for managing organization white-label and branding.
 * SuperAdmin can manage branding for all organizations.
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const verifySuperAdmin = require('../middleware/superAdminMiddleware');
const BrandingService = require('../services/brandingService');

// ==========================================
// SUPERADMIN ROUTES
// ==========================================

/**
 * GET /api/branding
 * List all organization brandings (SuperAdmin only)
 */
router.get('/', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const result = await BrandingService.listAll();
        res.json(result);
    } catch (error) {
        console.error('[Branding] List all error:', error);
        res.status(500).json({ error: 'Failed to list brandings' });
    }
});

/**
 * GET /api/branding/:orgId
 * Get branding for specific organization
 */
router.get('/:orgId', authMiddleware, async (req, res) => {
    try {
        const { orgId } = req.params;
        
        // Check authorization (SuperAdmin or same org)
        const isSuperAdmin = req.user.role === 'SUPERADMIN';
        const isSameOrg = req.user.organizationId === orgId;
        
        if (!isSuperAdmin && !isSameOrg) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const branding = await BrandingService.getByOrganization(orgId);
        
        if (!branding) {
            return res.json({ configured: false });
        }
        
        res.json({ configured: true, branding });
    } catch (error) {
        console.error('[Branding] Get error:', error);
        res.status(500).json({ error: 'Failed to get branding' });
    }
});

/**
 * POST /api/branding/:orgId
 * Create branding for organization (SuperAdmin only)
 */
router.post('/:orgId', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { orgId } = req.params;
        const result = await BrandingService.create(orgId, req.body, req.user.id);
        res.json(result);
    } catch (error) {
        console.error('[Branding] Create error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * PUT /api/branding/:orgId
 * Update branding for organization (SuperAdmin only)
 */
router.put('/:orgId', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { orgId } = req.params;
        const result = await BrandingService.update(orgId, req.body, req.user.id);
        res.json(result);
    } catch (error) {
        console.error('[Branding] Update error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * PATCH /api/branding/:orgId
 * Create or update branding (upsert)
 */
router.patch('/:orgId', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { orgId } = req.params;
        const result = await BrandingService.upsert(orgId, req.body, req.user.id);
        res.json(result);
    } catch (error) {
        console.error('[Branding] Upsert error:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * DELETE /api/branding/:orgId
 * Delete branding (reset to defaults) - SuperAdmin only
 */
router.delete('/:orgId', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { orgId } = req.params;
        const result = await BrandingService.delete(orgId);
        res.json(result);
    } catch (error) {
        console.error('[Branding] Delete error:', error);
        res.status(500).json({ error: 'Failed to delete branding' });
    }
});

/**
 * POST /api/branding/:orgId/clone
 * Clone branding from another organization
 */
router.post('/:orgId/clone', authMiddleware, verifySuperAdmin, async (req, res) => {
    try {
        const { orgId } = req.params;
        const { sourceOrgId } = req.body;
        
        if (!sourceOrgId) {
            return res.status(400).json({ error: 'sourceOrgId is required' });
        }
        
        const result = await BrandingService.clone(sourceOrgId, orgId, req.user.id);
        res.json(result);
    } catch (error) {
        console.error('[Branding] Clone error:', error);
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;

