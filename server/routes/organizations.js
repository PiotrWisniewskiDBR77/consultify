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

// POST /api/organizations/:orgId/consultants (Link Consultant)
router.post('/:orgId/consultants', async (req, res) => {
    try {
        const { orgId } = req.params;
        const userId = req.user?.id;
        const { consultantId, permissions } = req.body;

        // Security check: Only OWNER or ADMIN
        const members = await OrganizationService.getMembers(orgId);
        const currentUserMember = members.find(m => m.user_id === userId);

        if (!currentUserMember || !['OWNER', 'ADMIN'].includes(currentUserMember.role)) {
            if (req.user?.role !== 'SUPERADMIN') {
                return res.status(403).json({ error: 'Only Admins can manage consultants' });
            }
        }

        // We need ConsultantService for linking
        const ConsultantService = require('../services/consultantService');
        const link = await ConsultantService.linkConsultantToOrg(consultantId, orgId, userId, permissions);
        res.status(201).json(link);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/organizations/:orgId/settings/ai (Update AI Settings)
router.patch('/:orgId/settings/ai', async (req, res) => {
    try {
        const { orgId } = req.params;
        const userId = req.user?.id;
        const { ai_assertiveness_level, ai_autonomy_level } = req.body;

        // Security check: Only OWNER or ADMIN
        const members = await OrganizationService.getMembers(orgId);
        const currentUserMember = members.find(m => m.user_id === userId);

        if (!currentUserMember || !['OWNER', 'ADMIN'].includes(currentUserMember.role)) {
            if (req.user?.role !== 'SUPERADMIN') {
                return res.status(403).json({ error: 'Only Admins can manage AI settings' });
            }
        }

        await OrganizationService.updateAISettings(orgId, {
            ai_assertiveness_level,
            ai_autonomy_level
        });

        res.json({ success: true, message: 'AI settings updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// TOKEN LEDGER ROUTES
// ==========================================

const TokenBillingService = require('../services/tokenBillingService');

// GET /api/organizations/:orgId/tokens/balance
router.get('/:orgId/tokens/balance', async (req, res) => {
    try {
        const { orgId } = req.params;
        const userId = req.user?.id;

        // Security check: User must be member
        const members = await OrganizationService.getMembers(orgId);
        const isMember = members.some(m => m.user_id === userId);
        if (!isMember && req.user?.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const balanceInfo = await TokenBillingService.getOrgBalance(orgId);
        const summary = await TokenBillingService.getLedgerSummary(orgId);

        // Trial budget config (TODO: move to org config table later)
        const TRIAL_BUDGET_TOTAL = 50000;

        const isTrial = balanceInfo.billingStatus === 'TRIAL' || balanceInfo.organizationType === 'TRIAL';

        res.json({
            success: true,
            balance: balanceInfo.balance,
            billingStatus: balanceInfo.billingStatus,
            organizationType: balanceInfo.organizationType,
            ledgerSummary: summary,
            // Trial-specific fields (null for non-trial)
            trialBudgetTotal: isTrial ? TRIAL_BUDGET_TOTAL : null,
            trialBudgetRemaining: isTrial ? balanceInfo.balance : null,
            // PAYGO status for UI gating
            paygoStatus: balanceInfo.billingStatus
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/organizations/:orgId/tokens/ledger
router.get('/:orgId/tokens/ledger', async (req, res) => {
    try {
        const { orgId } = req.params;
        const userId = req.user?.id;
        const { limit = 50, offset = 0 } = req.query;

        // Security check: User must be OWNER or ADMIN
        const members = await OrganizationService.getMembers(orgId);
        const currentUserMember = members.find(m => m.user_id === userId);

        if (!currentUserMember || !['OWNER', 'ADMIN'].includes(currentUserMember.role)) {
            if (req.user?.role !== 'SUPERADMIN') {
                return res.status(403).json({ error: 'Only Admins can view ledger' });
            }
        }

        const ledger = await TokenBillingService.getLedger(orgId, {
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({ success: true, ledger });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/organizations/:orgId/tokens/credit (Admin only - for manual credits)
router.post('/:orgId/tokens/credit', async (req, res) => {
    try {
        const { orgId } = req.params;
        const userId = req.user?.id;
        const { tokens, reason, refType } = req.body;

        // Security check: Only SUPERADMIN can manually credit
        if (req.user?.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Only SuperAdmin can credit tokens' });
        }

        if (!tokens || tokens <= 0) {
            return res.status(400).json({ error: 'Invalid token amount' });
        }

        const result = await TokenBillingService.creditOrganization(orgId, tokens, {
            userId,
            reason: reason || 'Manual Credit',
            refType: refType || 'GRANT'
        });

        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

