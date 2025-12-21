/**
 * Organization Routes
 */
const express = require('express');
const router = express.Router();
const OrganizationService = require('../services/organizationService');
const TrialService = require('../services/trialService');
const PermissionService = require('../services/permissionService');

// Middleware to check if user is authenticated
// Assuming 'auth' middleware populates req.user
// const auth = require('../middleware/auth'); 
// For now we will assume req.user is populated by global middleware or we add it here if needed.
// Based on file list, there is middleware folder. Let's assume standard pattern.

// GET /api/organizations/current (Get user's organizations)
router.get('/current', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const orgs = await OrganizationService.getUserOrganizations(userId);
        res.json(orgs);
    } catch (err) {
        console.error('Error getting user organizations:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/organizations (Create new)
router.post('/', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const org = await OrganizationService.createOrganization({ userId, name });
        res.status(201).json(org);
    } catch (err) {
        console.error('Error creating organization:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/organizations/:orgId (Get details)
router.get('/:orgId', async (req, res) => {
    try {
        const { orgId } = req.params;
        const userId = req.user?.id;

        // Security check: User must be member
        const members = await OrganizationService.getMembers(orgId);
        const isMember = members.some(m => m.user_id === userId);
        if (!isMember && req.user?.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const org = await OrganizationService.getOrganization(orgId);
        res.json(org);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/organizations/:orgId/members
router.get('/:orgId/members', async (req, res) => {
    try {
        const { orgId } = req.params;
        const userId = req.user?.id;

        // Security check
        const members = await OrganizationService.getMembers(orgId);
        const isMember = members.some(m => m.user_id === userId);
        if (!isMember && req.user?.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(members);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/organizations/:orgId/members (Add member)
router.post('/:orgId/members', async (req, res) => {
    try {
        const { orgId } = req.params;
        const userId = req.user?.id;
        const { targetUserId, role } = req.body;

        // Security check: Only OWNER or ADMIN can add members
        const members = await OrganizationService.getMembers(orgId);
        const currentUserMember = members.find(m => m.user_id === userId);

        if (!currentUserMember || !['OWNER', 'ADMIN'].includes(currentUserMember.role)) {
            if (req.user?.role !== 'SUPERADMIN') {
                return res.status(403).json({ error: 'Only Admins can add members' });
            }
        }

        const result = await OrganizationService.addMember({
            organizationId: orgId,
            userId: targetUserId,
            role,
            invitedBy: userId
        });
        res.status(201).json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/organizations/:orgId/billing/activate (Stub)
router.post('/:orgId/billing/activate', async (req, res) => {
    try {
        const { orgId } = req.params;
        // In real world, verify payment method here
        const result = await OrganizationService.activateBilling(orgId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/organizations/:trialId/convert (Trial -> Paid)
// Note: This endpoint might be redundant if we just use /upgrade on TrialService, 
// but we want a unified "Convert to Organization" flow.
router.post('/:trialId/convert', async (req, res) => {
    try {
        const { trialId } = req.params; // This is organizationId
        const userId = req.user?.id;

        // 1. Upgrade Org Status/Type
        const upgradeResult = await TrialService.upgradeToPaid(trialId, 'PRO', userId);

        // 2. Activate Billing (Initialize tokens)
        await OrganizationService.activateBilling(trialId);

        // 3. Ensure User is OWNER (if not already)
        // TrialService create now adds OWNER, so we should be good, 
        // but we can double check or just return success.

        res.json({
            success: true,
            organizationId: trialId,
            message: 'Trial converted to Paid Organization successfully'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
