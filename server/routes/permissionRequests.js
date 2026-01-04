/**
 * Permission Requests Routes
 * 
 * Allows users to request:
 * - Role changes (USER -> ADMIN)
 * - Token limit increases
 * - Storage limit increases
 * - Feature access
 * 
 * Admins can approve/reject requests with notifications.
 */

import express from 'express';
const router = express.Router();
import { getDatabase } from '../src/database/index.js';
const db = getDatabase();

import { v4 as uuidv4 } from 'uuid';
import verifyToken from '../middleware/authMiddleware.js';
import * as NotificationServiceModule from '../services/notificationService.js';
const NotificationService = NotificationServiceModule.default || NotificationServiceModule;
import * as auditLogger from '../dist/utils/auditLogger.js';

// Request type definitions
const REQUEST_TYPES = {
    ROLE_CHANGE: 'ROLE_CHANGE',
    TOKEN_LIMIT: 'TOKEN_LIMIT',
    STORAGE_LIMIT: 'STORAGE_LIMIT',
    FEATURE_ACCESS: 'FEATURE_ACCESS'
};

const REQUEST_STATUSES = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED'
};

const REQUEST_PRIORITIES = {
    LOW: 'LOW',
    NORMAL: 'NORMAL',
    HIGH: 'HIGH',
    URGENT: 'URGENT'
};

// Helper to get user's requests
const getUserRequests = (userId, orgId) => {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT pr.*, 
                    u.first_name as user_first_name, u.last_name as user_last_name, u.email as user_email,
                    r.first_name as reviewer_first_name, r.last_name as reviewer_last_name
             FROM permission_requests pr
             LEFT JOIN users u ON pr.user_id = u.id
             LEFT JOIN users r ON pr.reviewed_by = r.id
             WHERE pr.user_id = ? AND pr.organization_id = ?
             ORDER BY pr.created_at DESC`,
            [userId, orgId],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            }
        );
    });
};

// Helper to get all org requests (for admins)
const getOrgRequests = (orgId, status = null) => {
    return new Promise((resolve, reject) => {
        let sql = `
            SELECT pr.*, 
                   u.first_name as user_first_name, u.last_name as user_last_name, u.email as user_email,
                   r.first_name as reviewer_first_name, r.last_name as reviewer_last_name
            FROM permission_requests pr
            LEFT JOIN users u ON pr.user_id = u.id
            LEFT JOIN users r ON pr.reviewed_by = r.id
            WHERE pr.organization_id = ?
        `;
        const params = [orgId];

        if (status) {
            sql += ` AND pr.status = ?`;
            params.push(status);
        }

        sql += ` ORDER BY pr.created_at DESC`;

        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
};

// Helper to get org admins for notifications
const getOrgAdmins = (orgId) => {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT id, email, first_name, last_name 
             FROM users 
             WHERE organization_id = ? AND role IN ('ADMIN', 'SUPERADMIN') AND status = 'active'`,
            [orgId],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            }
        );
    });
};

/**
 * GET /api/permission-requests
 * Get user's own permission requests
 */
router.get('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const orgId = req.user.organizationId || req.user.organization_id;

        const requests = await getUserRequests(userId, orgId);

        // Format for frontend
        const formatted = requests.map(r => ({
            id: r.id,
            organizationId: r.organization_id,
            userId: r.user_id,
            requestType: r.request_type,
            currentValue: r.current_value,
            requestedValue: r.requested_value,
            justification: r.justification,
            status: r.status,
            priority: r.priority,
            reviewedBy: r.reviewed_by,
            reviewedAt: r.reviewed_at,
            adminNotes: r.admin_notes,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            user: {
                firstName: r.user_first_name,
                lastName: r.user_last_name,
                email: r.user_email
            },
            reviewer: r.reviewer_first_name ? {
                firstName: r.reviewer_first_name,
                lastName: r.reviewer_last_name
            } : null
        }));

        res.json(formatted);
    } catch (error) {
        console.error('[PermissionRequests] Error fetching requests:', error);
        res.status(500).json({ error: 'Failed to fetch permission requests' });
    }
});

/**
 * GET /api/permission-requests/admin
 * Get all org permission requests (Admin only)
 */
router.get('/admin', verifyToken, async (req, res) => {
    try {
        const { role } = req.user;
        const orgId = req.user.organizationId || req.user.organization_id;

        if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { status } = req.query;
        const requests = await getOrgRequests(orgId, status);

        // Format for frontend
        const formatted = requests.map(r => ({
            id: r.id,
            organizationId: r.organization_id,
            userId: r.user_id,
            requestType: r.request_type,
            currentValue: r.current_value,
            requestedValue: r.requested_value,
            justification: r.justification,
            status: r.status,
            priority: r.priority,
            reviewedBy: r.reviewed_by,
            reviewedAt: r.reviewed_at,
            adminNotes: r.admin_notes,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            user: {
                firstName: r.user_first_name,
                lastName: r.user_last_name,
                email: r.user_email
            },
            reviewer: r.reviewer_first_name ? {
                firstName: r.reviewer_first_name,
                lastName: r.reviewer_last_name
            } : null
        }));

        res.json(formatted);
    } catch (error) {
        console.error('[PermissionRequests] Error fetching admin requests:', error);
        res.status(500).json({ error: 'Failed to fetch permission requests' });
    }
});

/**
 * POST /api/permission-requests
 * Create a new permission request
 */
router.post('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const orgId = req.user.organizationId || req.user.organization_id;
        const { requestType, currentValue, requestedValue, justification, priority } = req.body;

        // Validate request type
        if (!REQUEST_TYPES[requestType]) {
            return res.status(400).json({ error: 'Invalid request type' });
        }

        // Check for existing pending request of same type
        const existingPending = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id FROM permission_requests 
                 WHERE user_id = ? AND organization_id = ? AND request_type = ? AND status = 'PENDING'`,
                [userId, orgId, requestType],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (existingPending) {
            return res.status(400).json({
                error: 'You already have a pending request of this type',
                existingRequestId: existingPending.id
            });
        }

        const requestId = uuidv4();
        const requestPriority = REQUEST_PRIORITIES[priority] || 'NORMAL';

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO permission_requests 
                 (id, organization_id, user_id, request_type, current_value, requested_value, justification, priority, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
                [requestId, orgId, userId, requestType, currentValue, requestedValue, justification, requestPriority],
                function (err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });

        // Notify org admins
        try {
            const admins = await getOrgAdmins(orgId);
            for (const admin of admins) {
                await NotificationService.createNotification({
                    userId: admin.id,
                    orgId,
                    type: 'PERMISSION_REQUEST_SUBMITTED',
                    title: 'New Permission Request',
                    message: `${req.user.firstName || 'A user'} has requested ${requestType.replace('_', ' ').toLowerCase()}`,
                    metadata: { requestId, requestType, requestedValue },
                    severity: requestPriority === 'URGENT' ? 'WARNING' : 'INFO'
                });
            }
        } catch (notifErr) {
            console.error('[PermissionRequests] Failed to send notifications:', notifErr);
            // Don't fail the request if notification fails
        }

        // Audit log
        auditLogger.info('PERMISSION_REQUEST_CREATED', {
            request_id: requestId,
            user_id: userId,
            org_id: orgId,
            request_type: requestType,
            requested_value: requestedValue
        });

        res.status(201).json({
            success: true,
            requestId,
            message: 'Permission request submitted successfully'
        });
    } catch (error) {
        console.error('[PermissionRequests] Error creating request:', error);
        res.status(500).json({ error: 'Failed to create permission request' });
    }
});

/**
 * PUT /api/permission-requests/:id/approve
 * Approve a permission request (Admin only)
 */
router.put('/:id/approve', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { role, id: adminId } = req.user;
        const orgId = req.user.organizationId || req.user.organization_id;
        const { adminNotes } = req.body;

        if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Get the request
        const request = await new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM permission_requests WHERE id = ? AND organization_id = ?`,
                [id, orgId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        if (request.status !== 'PENDING') {
            return res.status(400).json({ error: 'Request is not pending' });
        }

        // Update request status
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE permission_requests 
                 SET status = 'APPROVED', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [adminId, adminNotes, id],
                function (err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // Apply the change based on request type
        if (request.request_type === 'ROLE_CHANGE') {
            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE users SET role = ? WHERE id = ?`,
                    [request.requested_value, request.user_id],
                    function (err) {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        } else if (request.request_type === 'TOKEN_LIMIT') {
            // Update token limit in organization_limits or user table
            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE users SET token_limit = ? WHERE id = ?`,
                    [parseInt(request.requested_value), request.user_id],
                    function (err) {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }
        // Add more handlers for other request types as needed

        // Notify the user
        try {
            await NotificationService.createNotification({
                userId: request.user_id,
                orgId,
                type: 'PERMISSION_REQUEST_APPROVED',
                title: 'Permission Request Approved',
                message: `Your ${request.request_type.replace('_', ' ').toLowerCase()} request has been approved`,
                metadata: { requestId: id, requestType: request.request_type },
                severity: 'INFO'
            });
        } catch (notifErr) {
            console.error('[PermissionRequests] Failed to send notification:', notifErr);
        }

        // Audit log
        auditLogger.info('PERMISSION_REQUEST_APPROVED', {
            request_id: id,
            admin_id: adminId,
            org_id: orgId,
            request_type: request.request_type
        });

        res.json({
            success: true,
            message: 'Permission request approved'
        });
    } catch (error) {
        console.error('[PermissionRequests] Error approving request:', error);
        res.status(500).json({ error: 'Failed to approve permission request' });
    }
});

/**
 * PUT /api/permission-requests/:id/reject
 * Reject a permission request (Admin only)
 */
router.put('/:id/reject', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { role, id: adminId } = req.user;
        const orgId = req.user.organizationId || req.user.organization_id;
        const { adminNotes } = req.body;

        if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Get the request
        const request = await new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM permission_requests WHERE id = ? AND organization_id = ?`,
                [id, orgId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        if (request.status !== 'PENDING') {
            return res.status(400).json({ error: 'Request is not pending' });
        }

        // Update request status
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE permission_requests 
                 SET status = 'REJECTED', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [adminId, adminNotes, id],
                function (err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // Notify the user
        try {
            await NotificationService.createNotification({
                userId: request.user_id,
                orgId,
                type: 'PERMISSION_REQUEST_REJECTED',
                title: 'Permission Request Rejected',
                message: `Your ${request.request_type.replace('_', ' ').toLowerCase()} request has been rejected`,
                metadata: { requestId: id, requestType: request.request_type, reason: adminNotes },
                severity: 'WARNING'
            });
        } catch (notifErr) {
            console.error('[PermissionRequests] Failed to send notification:', notifErr);
        }

        // Audit log
        auditLogger.info('PERMISSION_REQUEST_REJECTED', {
            request_id: id,
            admin_id: adminId,
            org_id: orgId,
            request_type: request.request_type,
            reason: adminNotes
        });

        res.json({
            success: true,
            message: 'Permission request rejected'
        });
    } catch (error) {
        console.error('[PermissionRequests] Error rejecting request:', error);
        res.status(500).json({ error: 'Failed to reject permission request' });
    }
});

/**
 * DELETE /api/permission-requests/:id
 * Cancel a pending permission request (own request only)
 */
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const orgId = req.user.organizationId || req.user.organization_id;

        // Get the request
        const request = await new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM permission_requests WHERE id = ? AND user_id = ? AND organization_id = ?`,
                [id, userId, orgId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        if (request.status !== 'PENDING') {
            return res.status(400).json({ error: 'Only pending requests can be cancelled' });
        }

        // Update status to cancelled
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE permission_requests SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [id],
                function (err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // Audit log
        auditLogger.info('PERMISSION_REQUEST_CANCELLED', {
            request_id: id,
            user_id: userId,
            org_id: orgId
        });

        res.json({
            success: true,
            message: 'Permission request cancelled'
        });
    } catch (error) {
        console.error('[PermissionRequests] Error cancelling request:', error);
        res.status(500).json({ error: 'Failed to cancel permission request' });
    }
});

/**
 * GET /api/permission-requests/stats
 * Get permission request statistics (Admin only)
 */
router.get('/stats', verifyToken, async (req, res) => {
    try {
        const { role } = req.user;
        const orgId = req.user.organizationId || req.user.organization_id;

        if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const stats = await new Promise((resolve, reject) => {
            db.all(
                `SELECT status, COUNT(*) as count FROM permission_requests WHERE organization_id = ? GROUP BY status`,
                [orgId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        const formattedStats = {
            pending: 0,
            approved: 0,
            rejected: 0,
            cancelled: 0,
            total: 0
        };

        stats.forEach(s => {
            const key = s.status.toLowerCase();
            if (formattedStats.hasOwnProperty(key)) {
                formattedStats[key] = s.count;
            }
            formattedStats.total += s.count;
        });

        res.json(formattedStats);
    } catch (error) {
        console.error('[PermissionRequests] Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

export default router;









