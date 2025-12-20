/**
 * Help API Routes
 * 
 * Endpoints for In-App Help + Training + Playbooks system.
 * Provides contextual help based on AccessPolicy and user role.
 * 
 * Step 6: Enterprise+ Ready
 */

const express = require('express');
const router = express.Router();
const HelpService = require('../services/helpService');
const PlaybookResolver = require('../services/playbookResolver');
const AccessPolicyService = require('../services/accessPolicyService');
const requireAuth = require('../middleware/authMiddleware');
const isSuperAdmin = (req, res, next) => {
    if (req.user && (req.user.role === 'SUPERADMIN' || req.user.role === 'SUPER_ADMIN')) {
        return next();
    }
    res.status(403).json({ error: 'Requires Super Admin privileges' });
};

// ==========================================
// AUTHENTICATED ENDPOINTS (All Users)
// ==========================================

/**
 * GET /api/help/playbooks
 * Get available playbooks for current user context
 * Filtered by org type, role, and completion status
 */
router.get('/playbooks', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const organizationId = req.user.organizationId || req.user.organization_id;
        const role = req.user.role;
        const route = req.query.route || '/';

        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID required' });
        }

        // Get org type from AccessPolicy
        const orgInfo = await AccessPolicyService.getOrganizationType(organizationId);
        const orgType = orgInfo?.organizationType || 'TRIAL';

        // Build policy snapshot for additional context
        const policySnapshot = await AccessPolicyService.buildPolicySnapshot(organizationId);

        // Build context
        const context = {
            orgType,
            role,
            userId,
            organizationId,
            blockedActions: policySnapshot.blockedActions || [],
            blockedFeatures: policySnapshot.blockedFeatures || [],
            isTrialExpired: policySnapshot.isTrialExpired,
            trialDaysLeft: policySnapshot.trialDaysLeft,
            currentRoute: route
        };

        // Get all available playbooks
        const allPlaybooks = await HelpService.getAvailablePlaybooks(context);

        // Get recommended playbooks (filtered by priority, conflicts resolved)
        const playbooks = await PlaybookResolver.getRecommendedPlaybooks(context);

        // Resolve single recommended key using deterministic rules
        const recommendedKey = PlaybookResolver.resolveRecommended(
            allPlaybooks,
            policySnapshot,
            route
        );

        res.json({
            playbooks,
            recommendedKey,
            total: allPlaybooks.length,
            context: {
                orgType,
                role,
                trialDaysLeft: policySnapshot.trialDaysLeft,
                isTrialExpired: policySnapshot.isTrialExpired,
                route
            }
        });
    } catch (error) {
        console.error('[Help API] Error fetching playbooks:', error);
        res.status(500).json({ error: 'Failed to fetch playbooks' });
    }
});

/**
 * GET /api/help/playbooks/all
 * Get all playbooks with their current status (for panel)
 */
router.get('/playbooks/all', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const organizationId = req.user.organizationId || req.user.organization_id;
        const role = req.user.role;

        const orgInfo = await AccessPolicyService.getOrganizationType(organizationId);
        const orgType = orgInfo?.organizationType || 'TRIAL';

        const context = {
            orgType,
            role,
            userId,
            organizationId
        };

        const playbooks = await HelpService.getAvailablePlaybooks(context);

        res.json({ playbooks });
    } catch (error) {
        console.error('[Help API] Error fetching all playbooks:', error);
        res.status(500).json({ error: 'Failed to fetch playbooks' });
    }
});

/**
 * GET /api/help/playbooks/:key
 * Get a specific playbook with all its steps
 */
router.get('/playbooks/:key', requireAuth, async (req, res) => {
    try {
        const { key } = req.params;
        const playbook = await HelpService.getPlaybook(key);

        if (!playbook) {
            return res.status(404).json({ error: 'Playbook not found' });
        }

        // Check if user should see this playbook (org type, role)
        const userId = req.user.id;
        const organizationId = req.user.organizationId || req.user.organization_id;

        const progress = await HelpService.getUserProgress(userId, organizationId, key);

        res.json({
            ...playbook,
            progress
        });
    } catch (error) {
        console.error('[Help API] Error fetching playbook:', error);
        res.status(500).json({ error: 'Failed to fetch playbook' });
    }
});

/**
 * POST /api/help/events
 * Log a help event (VIEWED, STARTED, COMPLETED, DISMISSED)
 * Append-only - no updates or deletes
 */
router.post('/events', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const organizationId = req.user.organizationId || req.user.organization_id;
        const { playbookKey, eventType, context = {} } = req.body;

        if (!playbookKey || !eventType) {
            return res.status(400).json({ error: 'playbookKey and eventType are required' });
        }

        // Validate event type
        if (!Object.values(HelpService.EVENT_TYPES).includes(eventType)) {
            return res.status(400).json({
                error: `Invalid eventType. Must be one of: ${Object.values(HelpService.EVENT_TYPES).join(', ')}`
            });
        }

        // Add request metadata to context
        const enrichedContext = {
            ...context,
            userAgent: req.headers['user-agent'],
            timestamp: new Date().toISOString()
        };

        const event = await HelpService.markEvent(
            userId,
            organizationId,
            playbookKey,
            eventType,
            enrichedContext
        );

        res.status(201).json({ event });
    } catch (error) {
        console.error('[Help API] Error logging event:', error);
        res.status(500).json({ error: 'Failed to log event' });
    }
});

/**
 * GET /api/help/hint/:featureKey
 * Get contextual help hint for a specific feature
 */
router.get('/hint/:featureKey', requireAuth, async (req, res) => {
    try {
        const { featureKey } = req.params;
        const userId = req.user.id;
        const organizationId = req.user.organizationId || req.user.organization_id;
        const role = req.user.role;

        const orgInfo = await AccessPolicyService.getOrganizationType(organizationId);
        const orgType = orgInfo?.organizationType || 'TRIAL';

        const policySnapshot = await AccessPolicyService.buildPolicySnapshot(organizationId);

        const context = {
            orgType,
            role,
            userId,
            organizationId,
            blockedActions: policySnapshot.blockedActions || [],
            blockedFeatures: policySnapshot.blockedFeatures || [],
            isTrialExpired: policySnapshot.isTrialExpired
        };

        const hint = await PlaybookResolver.getHelpHintForFeature(featureKey, context);

        if (!hint) {
            return res.json({ hint: null });
        }

        res.json({ hint });
    } catch (error) {
        console.error('[Help API] Error fetching hint:', error);
        res.status(500).json({ error: 'Failed to fetch hint' });
    }
});

// ==========================================
// SUPERADMIN ENDPOINTS (Manage Playbooks)
// ==========================================

/**
 * GET /api/help/admin/playbooks
 * List all playbooks with metadata (SuperAdmin)
 */
router.get('/admin/playbooks', requireAuth, isSuperAdmin, async (req, res) => {
    try {
        const playbooks = await HelpService.listAllPlaybooks();
        res.json({ playbooks });
    } catch (error) {
        console.error('[Help API] Error listing playbooks:', error);
        res.status(500).json({ error: 'Failed to list playbooks' });
    }
});

/**
 * POST /api/help/admin/playbooks
 * Create a new playbook (SuperAdmin)
 */
router.post('/admin/playbooks', requireAuth, isSuperAdmin, async (req, res) => {
    try {
        const { key, title, description, targetRole, targetOrgType, priority } = req.body;

        if (!key || !title) {
            return res.status(400).json({ error: 'key and title are required' });
        }

        const playbook = await HelpService.createPlaybook({
            key,
            title,
            description,
            targetRole,
            targetOrgType,
            priority
        });

        res.status(201).json({ playbook });
    } catch (error) {
        console.error('[Help API] Error creating playbook:', error);
        if (error.message.includes('already exists')) {
            return res.status(409).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to create playbook' });
    }
});

/**
 * PUT /api/help/admin/playbooks/:id
 * Update an existing playbook (SuperAdmin)
 */
router.put('/admin/playbooks/:id', requireAuth, isSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const playbook = await HelpService.updatePlaybook(id, updates);

        res.json({ playbook });
    } catch (error) {
        console.error('[Help API] Error updating playbook:', error);
        if (error.message === 'Playbook not found') {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to update playbook' });
    }
});

/**
 * POST /api/help/admin/steps
 * Add a step to a playbook (SuperAdmin)
 */
router.post('/admin/steps', requireAuth, isSuperAdmin, async (req, res) => {
    try {
        const { playbookId, stepOrder, title, contentMd, uiTarget, actionType, actionPayload } = req.body;

        if (!playbookId || !title || !contentMd) {
            return res.status(400).json({ error: 'playbookId, title, and contentMd are required' });
        }

        const step = await HelpService.createStep({
            playbookId,
            stepOrder: stepOrder || 1,
            title,
            contentMd,
            uiTarget,
            actionType,
            actionPayload
        });

        res.status(201).json({ step });
    } catch (error) {
        console.error('[Help API] Error creating step:', error);
        res.status(500).json({ error: 'Failed to create step' });
    }
});

/**
 * GET /api/help/admin/analytics
 * Get playbook analytics (SuperAdmin)
 */
router.get('/admin/analytics', requireAuth, isSuperAdmin, async (req, res) => {
    try {
        const { playbookKey, days = 30 } = req.query;

        const stats = await HelpService.getPlaybookStats(playbookKey, { days: parseInt(days, 10) });

        res.json({ stats });
    } catch (error) {
        console.error('[Help API] Error fetching analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

module.exports = router;
