// @ts-nocheck
/**
 * Admin Bulk Operations Routes
 * Enterprise bulk operations for user and data management
 *
 * Endpoints:
 * - POST /api/admin/users/bulk-import - Import users from CSV
 * - POST /api/admin/users/bulk-role - Bulk role assignment
 * - POST /api/admin/users/bulk-email - Mass email sending
 * - GET /api/admin/export/users - Export users CSV
 * - GET /api/admin/export/activity - Export activity log
 * - GET /api/admin/export/audit - Export audit log
 * - GET /api/admin/export/settings - Export organization settings
 */

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { verifyAdmin } from '../middleware/admin.middleware.js';
import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { withPgTransaction } from '../utils/queryHelpers.js';

const router = Router();

// Apply auth middleware
router.use(verifyToken);
router.use(verifyAdmin);

/**
 * POST /api/admin/users/bulk-import
 * Import users from CSV data
 */
router.post(
  '/users/bulk-import',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { users } = req.body;

    if (!users || !Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ error: 'No users provided' });
    }

    const results = {
      total: users.length,
      success: 0,
      failed: 0,
      errors: [] as { row: number; email: string; error: string }[],
    };

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const row = i + 1;

      try {
        // Validate required fields
        if (!user.email) {
          results.errors.push({ row, email: user.email || '', error: 'Email is required' });
          results.failed++;
          continue;
        }

        const userId = uuidv4();
        const now = new Date().toISOString();
        await withPgTransaction(async (tx) => {
          const existing = await tx.query<{ id: string }>(
            'SELECT id FROM users WHERE LOWER(email)=LOWER(?) AND organization_id=? FOR UPDATE',
            [user.email, orgId]
          );
          if (existing.rows.length > 0) throw new Error('BULK_EMAIL_EXISTS');
          const role = String(user.role || 'USER').toUpperCase();
          const membershipRole = role === 'ADMIN' ? 'ADMIN' : 'MEMBER';
          await tx.query(
            `INSERT INTO users (id,email,first_name,last_name,role,status,organization_id,created_at)
             VALUES (?,?,?,?,?,?,?,?)`,
            [userId,user.email.toLowerCase(),user.firstName || null,user.lastName || null,
             role,'active',orgId,now]
          );
          await tx.query(
            `INSERT INTO organization_members
             (id,organization_id,user_id,role,status,created_at)
             VALUES (?,?,?,?,?,?)`,
            [uuidv4(),orgId,userId,membershipRole,'ACTIVE',now]
          );
        });

        results.success++;
      } catch (err: any) {
        logger.error('[AdminBulk] Failed to import user row', { err, row });
        results.errors.push({
          row,
          email: user.email || '',
          error: 'Failed to import',
        });
        results.failed++;
      }
    }

    logger.info(`Bulk import completed: ${results.success}/${results.total} users imported`);
    return res.json(results);
  })
);

/**
 * POST /api/admin/users/bulk-role
 * Assign roles to multiple users
 */
router.post(
  '/users/bulk-role',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { userIds, role } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'No users selected' });
    }

    if (!role) {
      return res.status(400).json({ error: 'Role is required' });
    }

    const validRoles = ['USER', 'ADMIN', 'MANAGER', 'VIEWER', 'TEAM_LEAD'];
    if (!validRoles.includes(role)) {
      return res
        .status(400)
        .json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    // Update roles for all users
    const placeholders = userIds.map(() => '?').join(',');
    const now = new Date().toISOString();

    await dbRun(
      `UPDATE users SET role = ?, updated_at = ? WHERE id IN (${placeholders}) AND organization_id = ?`,
      [role, now, ...userIds, orgId]
    );

    logger.info(`Bulk role assignment: ${userIds.length} users assigned role ${role}`);
    return res.json({ success: true, updated: userIds.length });
  })
);

/**
 * POST /api/admin/users/bulk-email
 * Send mass email to users
 */
router.post(
  '/users/bulk-email',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { recipientType, subject, message, userIds } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }

    // Get recipients based on type
    let recipients: { email: string; firstName: string }[] = [];

    if (recipientType === 'selected' && userIds?.length > 0) {
      const placeholders = userIds.map(() => '?').join(',');
      recipients = await dbAll<{ email: string; first_name: string }>(
        `SELECT email, first_name FROM users WHERE id IN (${placeholders}) AND organization_id = ?`,
        [...userIds, orgId]
      );
    } else if (recipientType === 'all') {
      recipients = await dbAll<{ email: string; first_name: string }>(
        'SELECT email, first_name FROM users WHERE organization_id = ? AND status = ?',
        [orgId, 'active']
      );
    } else if (recipientType === 'admins') {
      recipients = await dbAll<{ email: string; first_name: string }>(
        'SELECT email, first_name FROM users WHERE organization_id = ? AND role = ? AND status = ?',
        [orgId, 'ADMIN', 'active']
      );
    }

    // In production, queue emails for sending
    // For now, we just log the operation
    logger.info(`Mass email queued: ${recipients.length} recipients, subject: ${subject}`);

    return res.json({
      success: true,
      queued: recipients.length,
      message: 'Emails queued for delivery',
    });
  })
);

/**
 * GET /api/admin/users
 * Get all users (for bulk operations UI)
 */
router.get(
  '/users',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const users = await dbAll<{
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      role: string;
      status: string;
    }>(
      'SELECT id, email, first_name, last_name, role, status FROM users WHERE organization_id = ? ORDER BY first_name, last_name',
      [orgId]
    );

    const formattedUsers = users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.first_name,
      lastName: u.last_name,
      role: u.role,
      status: u.status,
    }));

    return res.json({ users: formattedUsers, total: formattedUsers.length });
  })
);

/**
 * GET /api/admin/export/users
 * Export users as CSV
 */
router.get(
  '/export/users',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const users = await dbAll<{
      email: string;
      first_name: string;
      last_name: string;
      role: string;
      status: string;
      created_at: string;
      last_login: string | null;
    }>(
      'SELECT email, first_name, last_name, role, status, created_at, last_login FROM users WHERE organization_id = ? ORDER BY email',
      [orgId]
    );

    // Generate CSV
    const csvHeader = 'email,firstName,lastName,role,status,createdAt,lastLogin\n';
    const csvBody = users
      .map(
        (u) =>
          `${u.email},${u.first_name || ''},${u.last_name || ''},${u.role},${u.status},${u.created_at},${u.last_login || ''}`
      )
      .join('\n');

    const csv = csvHeader + csvBody;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="users_export_${Date.now()}.csv"`);
    return res.send(csv);
  })
);

/**
 * GET /api/admin/export/activity
 * Export activity log
 */
router.get(
  '/export/activity',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get activity logs for organization
    const activities = await dbAll<{
      id: string;
      user_id: string;
      action: string;
      entity_type: string;
      entity_id: string;
      metadata: string;
      created_at: string;
    }>(
      `SELECT al.* FROM activity_logs al 
             JOIN users u ON al.user_id = u.id 
             WHERE u.organization_id = ? 
             ORDER BY al.created_at DESC 
             LIMIT 10000`,
      [orgId]
    );

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="activity_log_${Date.now()}.json"`);
    return res.json(activities);
  })
);

/**
 * GET /api/admin/export/audit
 * Export audit log
 */
router.get(
  '/export/audit',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get audit logs for organization
    const audits = await dbAll<{
      id: string;
      user_id: string;
      event_type: string;
      resource_type: string;
      resource_id: string;
      details: string;
      ip_address: string;
      created_at: string;
    }>(
      `SELECT al.* FROM audit_log al 
             JOIN users u ON al.user_id = u.id 
             WHERE u.organization_id = ? 
             ORDER BY al.created_at DESC 
             LIMIT 10000`,
      [orgId]
    );

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="audit_log_${Date.now()}.json"`);
    return res.json(audits);
  })
);

/**
 * GET /api/admin/export/settings
 * Export organization settings
 */
router.get(
  '/export/settings',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get organization settings
    const org = await dbAll<any>('SELECT * FROM organizations WHERE id = ?', [orgId]);
    const settings = await dbAll<any>(
      'SELECT * FROM organization_settings WHERE organization_id = ?',
      [orgId]
    );

    const exportData = {
      organization: org[0] || {},
      settings: settings,
      exportedAt: new Date().toISOString(),
      exportedBy: req.user?.email,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="settings_export_${Date.now()}.json"`
    );
    return res.json(exportData);
  })
);

export default router;
