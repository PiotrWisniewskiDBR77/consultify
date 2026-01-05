/**
 * Organization Routes
 */
import express from 'express';
const router = express.Router();
import * as OrganizationServiceModule from '../services/organizationService.js';
const OrganizationService = OrganizationServiceModule.default || OrganizationServiceModule;
import * as TrialServiceModule from '../services/trialService.js';
const TrialService = TrialServiceModule.default || TrialServiceModule;
import * as PermissionServiceModule from '../services/permissionService.js';
const PermissionService = PermissionServiceModule.default || PermissionServiceModule;

// Middleware to check if user is authenticated
import verifyToken from '../middleware/authMiddleware.js';

router.use(verifyToken);

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
        const ConsultantService = await import('../services/consultantService.js').then(m => m.default || m);
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

const TokenBillingServiceModule = await import('../src/services/tokenBillingService.ts');

const TokenBillingService = TokenBillingServiceModule.default || TokenBillingServiceModule;

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

// ==========================================
// OWNERSHIP TRANSFER ROUTES
// ==========================================

const { getDatabase  } = await import('../src/database/Database.js');

import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/organizations/transfer-ownership
 * Transfer organization ownership to another admin
 * 
 * Body: { newOwnerId: string, reason?: string }
 * Only current Owner can perform this action
 */
router.post('/transfer-ownership', async (req, res) => {
    try {
        const userId = req.user?.id;
        const organizationId = req.user?.organizationId;
        const { newOwnerId, reason } = req.body;

        if (!userId || !organizationId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!newOwnerId) {
            return res.status(400).json({ error: 'New owner ID is required' });
        }

        if (newOwnerId === userId) {
            return res.status(400).json({ error: 'You are already the owner' });
        }

        // Verify current user is the Owner
        const currentUser = await new Promise((resolve, reject) => {
            db.get(
                'SELECT id, is_owner, role, first_name, last_name FROM users WHERE id = ? AND organization_id = ?',
                [userId, organizationId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isCurrentOwner = currentUser.is_owner === 1 || currentUser.is_owner === true || currentUser.role === 'OWNER';
        if (!isCurrentOwner) {
            return res.status(403).json({
                error: 'Only the current Account Owner can transfer ownership',
                code: 'NOT_OWNER'
            });
        }

        // Verify new owner exists and is an ADMIN in the same org
        const newOwner = await new Promise((resolve, reject) => {
            db.get(
                'SELECT id, role, first_name, last_name, email FROM users WHERE id = ? AND organization_id = ?',
                [newOwnerId, organizationId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!newOwner) {
            return res.status(404).json({ error: 'New owner not found in this organization' });
        }

        if (newOwner.role !== 'ADMIN' && newOwner.role !== 'OWNER') {
            return res.status(400).json({
                error: 'New owner must be an Admin. Please promote them to Admin first.',
                code: 'NEW_OWNER_NOT_ADMIN'
            });
        }

        // Perform the transfer in a transaction
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                // 1. Remove ownership from current owner
                db.run('UPDATE users SET is_owner = 0 WHERE id = ?', [userId]);

                // 2. Set new owner
                db.run('UPDATE users SET is_owner = 1, role = ? WHERE id = ?', ['OWNER', newOwnerId]);

                // 3. Update organization owner_id
                db.run('UPDATE organizations SET owner_id = ? WHERE id = ?', [newOwnerId, organizationId]);

                // 4. Record the transfer in audit table
                const transferId = uuidv4();
                db.run(
                    `INSERT INTO ownership_transfers (id, organization_id, from_user_id, to_user_id, reason, transferred_by)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [transferId, organizationId, userId, newOwnerId, reason || 'Ownership transfer', userId],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        });

        // Return success with new owner details
        res.json({
            success: true,
            message: `Ownership transferred to ${newOwner.first_name} ${newOwner.last_name}`,
            newOwner: {
                id: newOwner.id,
                firstName: newOwner.first_name,
                lastName: newOwner.last_name,
                email: newOwner.email
            },
            previousOwner: {
                id: currentUser.id,
                firstName: currentUser.first_name,
                lastName: currentUser.last_name
            }
        });

    } catch (err) {
        console.error('[Organizations] Transfer ownership error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/organizations/ownership-history
 * Get ownership transfer history for current organization
 */
router.get('/ownership-history', async (req, res) => {
    try {
        const userId = req.user?.id;
        const organizationId = req.user?.organizationId;

        if (!userId || !organizationId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Only Owner/Admin can view history
        const user = await new Promise((resolve, reject) => {
            db.get(
                'SELECT role, is_owner FROM users WHERE id = ? AND organization_id = ?',
                [userId, organizationId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!user || (!['ADMIN', 'OWNER'].includes(user.role) && !user.is_owner)) {
            return res.status(403).json({ error: 'Only Admins can view ownership history' });
        }

        const history = await new Promise((resolve, reject) => {
            db.all(
                `SELECT 
                    ot.id,
                    ot.reason,
                    ot.transferred_at,
                    fu.first_name || ' ' || fu.last_name as from_user_name,
                    fu.email as from_user_email,
                    tu.first_name || ' ' || tu.last_name as to_user_name,
                    tu.email as to_user_email,
                    tb.first_name || ' ' || tb.last_name as transferred_by_name
                FROM ownership_transfers ot
                LEFT JOIN users fu ON ot.from_user_id = fu.id
                LEFT JOIN users tu ON ot.to_user_id = tu.id
                LEFT JOIN users tb ON ot.transferred_by = tb.id
                WHERE ot.organization_id = ?
                ORDER BY ot.transferred_at DESC
                LIMIT 50`,
                [organizationId],
                (err, rows) => err ? reject(err) : resolve(rows || [])
            );
        });

        res.json({ success: true, history });

    } catch (err) {
        console.error('[Organizations] Ownership history error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/organizations/owner
 * Get current owner information
 */
router.get('/owner', async (req, res) => {
    try {
        const organizationId = req.user?.organizationId;

        if (!organizationId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const owner = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, first_name, last_name, email, role, avatar_url 
                 FROM users 
                 WHERE organization_id = ? AND (is_owner = 1 OR role = 'OWNER')
                 LIMIT 1`,
                [organizationId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!owner) {
            return res.status(404).json({ error: 'No owner found for this organization' });
        }

        res.json({
            success: true,
            owner: {
                id: owner.id,
                firstName: owner.first_name,
                lastName: owner.last_name,
                email: owner.email,
                role: owner.role,
                avatarUrl: owner.avatar_url
            }
        });

    } catch (err) {
        console.error('[Organizations] Get owner error:', err);
        res.status(500).json({ error: err.message });
    }
});

const roleServiceModule = await import('../services/pmoRoleService.js');

const roleService = roleServiceModule.default || roleServiceModule;

/**
 * GET /api/organizations/:orgId/roles
 * Get custom roles for an organization
 */
router.get('/:orgId/roles', async (req, res) => {
    try {
        const { orgId } = req.params;
        const roles = await roleService.getAllRoles({ organizationId: orgId, includeCustom: true });
        res.json(roles || []);
    } catch (err) {
        console.error('[Organizations] Error getting roles:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;

