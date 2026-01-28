/**
 * Ownership Routes
 * Organization ownership management - transfer, billing admin
 */
import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { authRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();

// Apply rate limiting and auth
router.use(authRateLimiter);
router.use(verifyToken);

/**
 * GET /api/organizations/:orgId/ownership
 * Get organization ownership information
 */
router.get(
    '/:orgId/ownership',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { orgId } = req.params;
        const userOrgId = req.user?.organizationId;

        // Verify user has access to this organization
        if (userOrgId !== orgId) {
            return res.status(403).json({ error: 'Access denied to this organization' });
        }

        try {
            // Get organization with owner info
            const org = await dbGet<{
                id: string;
                name: string;
                owner_id: string;
                created_at: string;
            }>(
                `SELECT id, name, owner_id, created_at FROM organizations WHERE id = ?`,
                [orgId]
            );

            if (!org) {
                return res.status(404).json({ error: 'Organization not found' });
            }

            // Get owner user details
            let owner = null;
            if (org.owner_id) {
                owner = await dbGet<{
                    id: string;
                    email: string;
                    first_name: string;
                    last_name: string;
                    created_at: string;
                }>(
                    `SELECT id, email, first_name, last_name, created_at 
                     FROM users WHERE id = ?`,
                    [org.owner_id]
                );
            }

            // If no owner set, get the first ADMIN
            if (!owner) {
                owner = await dbGet<{
                    id: string;
                    email: string;
                    first_name: string;
                    last_name: string;
                    created_at: string;
                }>(
                    `SELECT id, email, first_name, last_name, created_at 
                     FROM users WHERE organization_id = ? AND role = 'ADMIN' 
                     ORDER BY created_at ASC LIMIT 1`,
                    [orgId]
                );
            }

            // Check for pending transfer
            const pendingTransfer = await dbGet<{
                id: string;
                to_user_id: string;
                reason: string;
                created_at: string;
            }>(
                `SELECT id, to_user_id, reason, created_at 
                 FROM ownership_transfer_requests 
                 WHERE organization_id = ? AND status = 'pending'`,
                [orgId]
            );

            return res.json({
                ownership: {
                    organizationId: orgId,
                    ownerUserId: owner?.id || null,
                    createdAt: org.created_at,
                    hasPendingTransfer: !!pendingTransfer,
                },
                owner: owner ? {
                    id: owner.id,
                    email: owner.email,
                    firstName: owner.first_name,
                    lastName: owner.last_name,
                    createdAt: owner.created_at,
                } : null,
            });
        } catch (error: any) {
            logger.error('[ownership] Error fetching ownership:', error);
            return res.status(500).json({ error: 'Failed to fetch ownership information' });
        }
    })
);

/**
 * GET /api/organizations/:orgId/admins
 * Get list of admins who can become owners
 */
router.get(
    '/:orgId/admins',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { orgId } = req.params;
        const userOrgId = req.user?.organizationId;

        if (userOrgId !== orgId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        try {
            const admins = await dbAll<{
                id: string;
                email: string;
                first_name: string;
                last_name: string;
                role: string;
                created_at: string;
            }>(
                `SELECT id, email, first_name, last_name, role, created_at 
                 FROM users 
                 WHERE organization_id = ? AND role IN ('ADMIN', 'SUPERADMIN', 'SUPER_ADMIN')
                 ORDER BY first_name, last_name`,
                [orgId]
            );

            return res.json(admins.map(admin => ({
                id: admin.id,
                email: admin.email,
                firstName: admin.first_name,
                lastName: admin.last_name,
                role: admin.role,
                createdAt: admin.created_at,
            })));
        } catch (error: any) {
            logger.error('[ownership] Error fetching admins:', error);
            return res.status(500).json({ error: 'Failed to fetch admins' });
        }
    })
);

/**
 * GET /api/organizations/:orgId/ownership/pending-transfer
 * Check for pending ownership transfer
 */
router.get(
    '/:orgId/ownership/pending-transfer',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { orgId } = req.params;
        const userId = req.user?.id;
        const userOrgId = req.user?.organizationId;

        if (userOrgId !== orgId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        try {
            const transfer = await dbGet<{
                id: string;
                from_user_id: string;
                to_user_id: string;
                reason: string;
                created_at: string;
            }>(
                `SELECT id, from_user_id, to_user_id, reason, created_at 
                 FROM ownership_transfer_requests 
                 WHERE organization_id = ? AND status = 'pending'`,
                [orgId]
            );

            if (!transfer) {
                return res.json(null);
            }

            return res.json({
                id: transfer.id,
                fromUserId: transfer.from_user_id,
                toUserId: transfer.to_user_id,
                reason: transfer.reason,
                createdAt: transfer.created_at,
            });
        } catch (error: any) {
            // Table might not exist yet
            logger.warn('[ownership] Error fetching pending transfer:', error);
            return res.json(null);
        }
    })
);

/**
 * POST /api/organizations/:orgId/ownership/transfer
 * Initiate ownership transfer
 */
router.post(
    '/:orgId/ownership/transfer',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { orgId } = req.params;
        const { toUserId, reason } = req.body;
        const fromUserId = req.user?.id;
        const userOrgId = req.user?.organizationId;

        if (userOrgId !== orgId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!toUserId) {
            return res.status(400).json({ error: 'Target user ID is required' });
        }

        try {
            // Verify current user is the owner
            const org = await dbGet<{ owner_id: string }>(
                `SELECT owner_id FROM organizations WHERE id = ?`,
                [orgId]
            );

            if (org?.owner_id !== fromUserId) {
                return res.status(403).json({ error: 'Only the owner can transfer ownership' });
            }

            // Verify target user is an admin in the org
            const targetUser = await dbGet<{ id: string; role: string }>(
                `SELECT id, role FROM users WHERE id = ? AND organization_id = ?`,
                [toUserId, orgId]
            );

            if (!targetUser || !['ADMIN', 'SUPERADMIN', 'SUPER_ADMIN'].includes(targetUser.role)) {
                return res.status(400).json({ error: 'Target user must be an admin in the organization' });
            }

            // Create transfer request
            const transferId = uuidv4();
            
            // First ensure the table exists
            await dbRun(`
                CREATE TABLE IF NOT EXISTS ownership_transfer_requests (
                    id TEXT PRIMARY KEY,
                    organization_id TEXT NOT NULL,
                    from_user_id TEXT NOT NULL,
                    to_user_id TEXT NOT NULL,
                    reason TEXT,
                    status TEXT DEFAULT 'pending',
                    created_at TEXT DEFAULT (datetime('now')),
                    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
                )
            `);

            // Cancel any existing pending transfers
            await dbRun(
                `UPDATE ownership_transfer_requests SET status = 'cancelled' 
                 WHERE organization_id = ? AND status = 'pending'`,
                [orgId]
            );

            // Create new transfer request
            await dbRun(
                `INSERT INTO ownership_transfer_requests (id, organization_id, from_user_id, to_user_id, reason, status)
                 VALUES (?, ?, ?, ?, ?, 'pending')`,
                [transferId, orgId, fromUserId, toUserId, reason || null]
            );

            logger.info(`[ownership] Transfer initiated: ${orgId} from ${fromUserId} to ${toUserId}`);

            return res.json({
                success: true,
                transferId,
                message: 'Ownership transfer request created. The new owner must accept.',
            });
        } catch (error: any) {
            logger.error('[ownership] Error creating transfer:', error);
            return res.status(500).json({ error: 'Failed to initiate transfer' });
        }
    })
);

/**
 * POST /api/organizations/:orgId/ownership/accept-transfer
 * Accept ownership transfer
 */
router.post(
    '/:orgId/ownership/accept-transfer',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { orgId } = req.params;
        const userId = req.user?.id;
        const userOrgId = req.user?.organizationId;

        if (userOrgId !== orgId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        try {
            // Get pending transfer for this user
            const transfer = await dbGet<{
                id: string;
                from_user_id: string;
                to_user_id: string;
            }>(
                `SELECT id, from_user_id, to_user_id 
                 FROM ownership_transfer_requests 
                 WHERE organization_id = ? AND to_user_id = ? AND status = 'pending'`,
                [orgId, userId]
            );

            if (!transfer) {
                return res.status(404).json({ error: 'No pending transfer found for you' });
            }

            // Execute transfer
            await dbRun(`UPDATE organizations SET owner_id = ? WHERE id = ?`, [userId, orgId]);
            await dbRun(`UPDATE users SET is_owner = 0 WHERE organization_id = ?`, [orgId]);
            await dbRun(`UPDATE users SET is_owner = 1 WHERE id = ?`, [userId]);
            await dbRun(
                `UPDATE ownership_transfer_requests SET status = 'completed' WHERE id = ?`,
                [transfer.id]
            );

            // Log to ownership_transfers audit table
            await dbRun(
                `INSERT INTO ownership_transfers (id, organization_id, from_user_id, to_user_id, transferred_by)
                 VALUES (?, ?, ?, ?, ?)`,
                [uuidv4(), orgId, transfer.from_user_id, userId, userId]
            );

            logger.info(`[ownership] Transfer accepted: ${orgId} new owner ${userId}`);

            return res.json({
                success: true,
                message: 'You are now the organization owner',
            });
        } catch (error: any) {
            logger.error('[ownership] Error accepting transfer:', error);
            return res.status(500).json({ error: 'Failed to accept transfer' });
        }
    })
);

/**
 * POST /api/organizations/:orgId/ownership/cancel-transfer
 * Cancel pending ownership transfer
 */
router.post(
    '/:orgId/ownership/cancel-transfer',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { orgId } = req.params;
        const userId = req.user?.id;
        const userOrgId = req.user?.organizationId;

        if (userOrgId !== orgId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        try {
            // Only owner or target user can cancel
            const transfer = await dbGet<{
                id: string;
                from_user_id: string;
                to_user_id: string;
            }>(
                `SELECT id, from_user_id, to_user_id 
                 FROM ownership_transfer_requests 
                 WHERE organization_id = ? AND status = 'pending'`,
                [orgId]
            );

            if (!transfer) {
                return res.status(404).json({ error: 'No pending transfer found' });
            }

            if (transfer.from_user_id !== userId && transfer.to_user_id !== userId) {
                return res.status(403).json({ error: 'Only the owner or target user can cancel' });
            }

            await dbRun(
                `UPDATE ownership_transfer_requests SET status = 'cancelled' WHERE id = ?`,
                [transfer.id]
            );

            logger.info(`[ownership] Transfer cancelled: ${transfer.id} by ${userId}`);

            return res.json({
                success: true,
                message: 'Transfer cancelled',
            });
        } catch (error: any) {
            logger.error('[ownership] Error cancelling transfer:', error);
            return res.status(500).json({ error: 'Failed to cancel transfer' });
        }
    })
);

/**
 * POST /api/organizations/:orgId/schedule-deletion
 * Schedule organization for deletion (30-day grace period)
 */
router.post(
    '/:orgId/schedule-deletion',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { orgId } = req.params;
        const userId = req.user?.id;
        const userOrgId = req.user?.organizationId;

        if (userOrgId !== orgId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        try {
            // Verify user is the owner
            const org = await dbGet<{ owner_id: string; name: string }>(
                `SELECT owner_id, name FROM organizations WHERE id = ?`,
                [orgId]
            );

            if (org?.owner_id !== userId) {
                return res.status(403).json({ error: 'Only the owner can delete the organization' });
            }

            // Schedule deletion (30 days from now)
            const deletionDate = new Date();
            deletionDate.setDate(deletionDate.getDate() + 30);

            await dbRun(
                `UPDATE organizations SET 
                    scheduled_deletion_at = ?,
                    deletion_scheduled_by = ?,
                    updated_at = datetime('now')
                 WHERE id = ?`,
                [deletionDate.toISOString(), userId, orgId]
            );

            logger.warn(`[ownership] Organization ${orgId} scheduled for deletion on ${deletionDate.toISOString()}`);

            return res.json({
                success: true,
                deletionDate: deletionDate.toISOString(),
                message: `Organization "${org.name}" scheduled for deletion on ${deletionDate.toLocaleDateString()}. You can cancel this within 30 days.`,
            });
        } catch (error: any) {
            logger.error('[ownership] Error scheduling deletion:', error);
            return res.status(500).json({ error: 'Failed to schedule deletion' });
        }
    })
);

/**
 * POST /api/organizations/:orgId/cancel-deletion
 * Cancel scheduled deletion
 */
router.post(
    '/:orgId/cancel-deletion',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { orgId } = req.params;
        const userId = req.user?.id;
        const userOrgId = req.user?.organizationId;

        if (userOrgId !== orgId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        try {
            // Verify user is the owner
            const org = await dbGet<{ owner_id: string }>(
                `SELECT owner_id FROM organizations WHERE id = ?`,
                [orgId]
            );

            if (org?.owner_id !== userId) {
                return res.status(403).json({ error: 'Only the owner can cancel deletion' });
            }

            await dbRun(
                `UPDATE organizations SET 
                    scheduled_deletion_at = NULL,
                    deletion_scheduled_by = NULL,
                    updated_at = datetime('now')
                 WHERE id = ?`,
                [orgId]
            );

            logger.info(`[ownership] Organization ${orgId} deletion cancelled`);

            return res.json({
                success: true,
                message: 'Organization deletion cancelled',
            });
        } catch (error: any) {
            logger.error('[ownership] Error cancelling deletion:', error);
            return res.status(500).json({ error: 'Failed to cancel deletion' });
        }
    })
);

export default router;
