/**
 * API Route: User Organizations
 * Provides endpoint for fetching user's accessible organizations.
 */

const express = require('express');
const router = express.Router();
const orgContextMiddleware = require('../middleware/orgContextMiddleware');
const { authenticate } = require('../middleware/authMiddleware');

/**
 * GET /api/users/me/organizations
 * Returns list of organizations the authenticated user has access to.
 */
router.get('/me/organizations', authenticate, async (req, res) => {
    try {
        const organizations = await orgContextMiddleware.getUserOrganizations(req.user.id);
        res.json({ organizations });
    } catch (error) {
        console.error('[UserOrgs] Error:', error);
        res.status(500).json({ error: 'Failed to fetch organizations' });
    }
});

/**
 * PUT /api/users/me/current-org
 * Updates user's current/default organization.
 */
router.put('/me/current-org', authenticate, async (req, res) => {
    try {
        const { organizationId } = req.body;

        if (!organizationId) {
            return res.status(400).json({ error: 'organizationId required' });
        }

        // Verify user has access to this org
        const membership = await orgContextMiddleware.getMembership(req.user.id, organizationId);
        if (!membership) {
            return res.status(403).json({ error: 'You do not have access to this organization' });
        }

        // Update user's default org (optional - for backend state)
        // This could update users.organization_id or a separate preferences table
        // For now, just return success as frontend handles localStorage

        res.json({
            success: true,
            message: 'Current organization updated',
            organizationId
        });
    } catch (error) {
        console.error('[UserOrgs] Error updating current org:', error);
        res.status(500).json({ error: 'Failed to update current organization' });
    }
});

module.exports = router;
