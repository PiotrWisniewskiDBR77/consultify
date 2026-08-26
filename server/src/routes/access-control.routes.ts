/**
 * Access Control Routes
 * API endpoints for access requests and access codes
 *
 * Fully migrated to TypeScript ES modules
 */

import bcrypt from 'bcryptjs';
import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { verifyAdmin } from '../middleware/admin.middleware.js';
import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { verifySuperAdmin as requireSuperAdmin } from '../middleware/superAdmin.middleware.js';
import AccessCodeService from '../services/accessCodeService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

// Apply rate limiting
const router = Router();

/**
 * Helper function to generate random access code
 */
function generateAccessCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * POST /api/access-control/requests
 * Submit access request
 */
router.post(
  '/requests',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { email, firstName, lastName, phone, organizationName, requestType } = req.body;

    // Check if request already exists
    const existing = await dbGet<{ id: string }>(
      'SELECT id FROM access_requests WHERE email = ? AND status = ?',
      [email, 'pending']
    );

    if (existing) {
      return res.status(400).json({ error: 'Access request already pending' });
    }

    const requestId = uuidv4();
    const metadata = JSON.stringify({ userAgent: req.headers['user-agent'] });

    const runResult = await dbRun(
      `INSERT INTO access_requests 
        (id, email, first_name, last_name, phone, organization_name, request_type, metadata, requested_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        requestId,
        email,
        firstName,
        lastName,
        phone,
        organizationName,
        requestType || 'new_user',
        metadata,
      ]
    );

    if (!runResult.success) {
      throw new Error(runResult.error || 'Failed to create access request');
    }

    return res.json({
      success: true,
      message: 'Access request submitted successfully',
      requestId,
    });
  })
);

/**
 * GET /api/access-control/requests
 * Get all access requests (Super Admin only)
 */
router.get(
  '/requests',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const status = (req.query.status as string) || 'pending';

    const query =
      status === 'all'
        ? 'SELECT * FROM access_requests ORDER BY requested_at DESC'
        : 'SELECT * FROM access_requests WHERE status = ? ORDER BY requested_at DESC';

    const params = status === 'all' ? [] : [status];

    const requests = await dbAll<{
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      phone: string | null;
      organization_name: string | null;
      request_type: string;
      status: string;
      metadata: string | null;
      requested_at: string;
      reviewed_by: string | null;
      reviewed_at: string | null;
      rejection_reason: string | null;
      organization_id: string | null;
    }>(query, params);

    return res.json(requests);
  })
);

/**
 * GET /api/access-control/requests/organization
 * Get access requests for the authenticated admin's organization.
 */
router.get(
  '/requests/organization',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = req.user?.organizationId;
    if (!organizationId) return res.status(401).json({ error: 'Unauthorized' });

    const status = (req.query.status as string) || 'pending';
    const params: unknown[] = [organizationId];
    let where = 'organization_id = ?';
    if (status !== 'all') {
      where += ' AND status = ?';
      params.push(status);
    }

    const requests = await dbAll(
      `SELECT * FROM access_requests WHERE ${where} ORDER BY requested_at DESC`,
      params
    );
    return res.json(requests);
  })
);

/**
 * PUT /api/access-control/requests/:id/approve
 * Approve access request (Super Admin only)
 */
router.put(
  '/requests/:id/approve',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { password, role } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const request = await dbGet<{
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      organization_name: string | null;
      status: string;
      requested_role: string | null;
    }>('SELECT * FROM access_requests WHERE id = ?', [id]);

    if (!request) {
      return res.status(404).json({ error: 'Access request not found' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request already processed' });
    }

    // Create organization and user
    const orgId = uuidv4();
    const newUserId = uuidv4();
    const hashedPassword = bcrypt.hashSync(password || 'temporary123', 8);

    // Create organization
    const orgResult = await dbRun(
      `INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
      [orgId, request.organization_name || 'New Organization', 'free', 'active']
    );
    if (!orgResult.success) {
      throw new Error(orgResult.error || 'Failed to create organization');
    }

    // Create user
    const userResult = await dbRun(
      `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newUserId,
        orgId,
        request.email,
        hashedPassword,
        request.first_name,
        request.last_name,
        role || request.requested_role || 'ADMIN',
        'active',
      ]
    );
    if (!userResult.success) {
      throw new Error(userResult.error || 'Failed to create user');
    }

    // Update request status
    const updateResult = await dbRun(
      `UPDATE access_requests 
        SET status = ?, reviewed_by = ?, reviewed_at = datetime('now'), organization_id = ?
        WHERE id = ?`,
      ['approved', userId, orgId, id]
    );
    if (!updateResult.success) {
      throw new Error(updateResult.error || 'Failed to update request');
    }

    return res.json({
      success: true,
      message: 'Access request approved',
      organizationId: orgId,
      userId: newUserId,
    });
  })
);

/**
 * PUT /api/access-control/requests/:id/reject
 * Reject access request (Super Admin only)
 */
router.put(
  '/requests/:id/reject',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const request = await dbGet<{
      id: string;
      status: string;
    }>('SELECT * FROM access_requests WHERE id = ?', [id]);

    if (!request) {
      return res.status(404).json({ error: 'Access request not found' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request already processed' });
    }

    const runResult = await dbRun(
      `UPDATE access_requests 
        SET status = ?, reviewed_by = ?, reviewed_at = datetime('now'), rejection_reason = ?
        WHERE id = ?`,
      ['rejected', userId, reason || 'No reason provided', id]
    );

    if (!runResult.success) {
      throw new Error(runResult.error || 'Failed to reject access request');
    }

    return res.json({ success: true, message: 'Access request rejected' });
  })
);

/**
 * POST /api/access-control/codes
 * Generate access code (Admin only)
 */
router.post(
  '/codes',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, role, maxUses, expiresInDays } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify user has access to this organization
    if (req.user?.role !== 'SUPERADMIN' && req.user?.organizationId !== organizationId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Dual-model reconciliation (CTO decision, 2026-07-20): create via
    // AccessCodeService.createLegacyCompatCode() instead of a raw INSERT, so
    // the row also gets code_hash/uses_count/status populated and is
    // immediately valid through accessCodeService's hash-lookup validate/
    // accept paths — no change to this endpoint's response shape or to the
    // code format (generateAccessCode() is passed through unchanged).
    const created = await AccessCodeService.createLegacyCompatCode({
      code: generateAccessCode(),
      organizationId,
      createdByUserId: userId,
      role: role || 'USER',
      maxUses: maxUses || 1,
      expiresAt,
    });

    return res.json({
      success: true,
      code: {
        id: created.id,
        code: created.code,
        role: role || 'USER',
        maxUses: maxUses || 1,
        expiresAt: expiresAt,
      },
    });
  })
);

/**
 * GET /api/access-control/codes
 * Get organization's access codes (Admin only)
 */
router.get(
  '/codes',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = req.query;

    // Verify user has access to this organization
    if (req.user?.role !== 'SUPERADMIN' && req.user?.organizationId !== organizationId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const codes = await dbAll<any>(
      `SELECT ac.*, u.first_name, u.last_name, u.email as created_by_email
            FROM access_codes ac
            LEFT JOIN users u ON ac.created_by = u.id
            WHERE ac.organization_id = ?
            ORDER BY ac.created_at DESC`,
      [organizationId]
    );

    return res.json(codes);
  })
);

/**
 * GET /api/access-control/codes/:code/info
 * Get code info (public - for verification)
 */
router.get(
  '/codes/:code/info',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { code } = req.params;

    const codeInfo = await dbGet<{
      id: string;
      role: string;
      max_uses: number;
      current_uses: number;
      expires_at: string | null;
      is_active: number;
      organization_name: string;
    }>(
      `SELECT ac.id, ac.role, ac.max_uses, ac.current_uses, ac.expires_at, ac.is_active, o.name as organization_name
        FROM access_codes ac
        JOIN organizations o ON ac.organization_id = o.id
        WHERE ac.code = ?`,
      [code]
    );

    if (!codeInfo) {
      return res.status(404).json({ error: 'Invalid code' });
    }

    // Check if code is expired
    const isExpired = codeInfo.expires_at && new Date(codeInfo.expires_at) < new Date();
    const isMaxedOut = codeInfo.max_uses !== -1 && codeInfo.current_uses >= codeInfo.max_uses;

    return res.json({
      valid: codeInfo.is_active !== 0 && !isExpired && !isMaxedOut,
      organizationName: codeInfo.organization_name,
      role: codeInfo.role,
      reason:
        codeInfo.is_active === 0
          ? 'Code deactivated'
          : isExpired
            ? 'Code expired'
            : isMaxedOut
              ? 'Code usage limit reached'
              : null,
    });
  })
);

/**
 * POST /api/access-control/codes/register
 * Verify and register with access code
 */
router.post(
  '/codes/register',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { code, email, password, firstName, lastName, _phone } = req.body;

    const accessCode = await dbGet<{
      id: string;
      organization_id: string;
      role: string;
      max_uses: number;
      current_uses: number;
      expires_at: string | null;
      is_active: number;
      org_id: string;
      org_name: string;
    }>(
      `SELECT ac.*, o.id as org_id, o.name as org_name
        FROM access_codes ac
        JOIN organizations o ON ac.organization_id = o.id
        WHERE ac.code = ?`,
      [code]
    );

    if (!accessCode) {
      return res.status(404).json({ error: 'Invalid access code' });
    }

    // Validate code
    const isExpired = accessCode.expires_at && new Date(accessCode.expires_at) < new Date();
    const isMaxedOut = accessCode.max_uses !== -1 && accessCode.current_uses >= accessCode.max_uses;

    if (accessCode.is_active === 0) {
      return res.status(400).json({ error: 'This access code has been deactivated' });
    }
    if (isExpired) {
      return res.status(400).json({ error: 'This access code has expired' });
    }
    if (isMaxedOut) {
      return res.status(400).json({ error: 'This access code has reached its usage limit' });
    }

    // Check if user already exists
    const existingUser = await dbGet<{ id: string }>('SELECT id FROM users WHERE email = ?', [
      email,
    ]);

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const newUserId = uuidv4();
    const hashedPassword = bcrypt.hashSync(password, 8);

    // Create user
    const userResult = await dbRun(
      `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newUserId,
        accessCode.org_id,
        email,
        hashedPassword,
        firstName,
        lastName,
        accessCode.role,
        'active',
      ]
    );

    if (!userResult.success) {
      throw new Error(userResult.error || 'Failed to create user');
    }

    // Update code usage
    const usageResult = await dbRun(
      `UPDATE access_codes SET current_uses = current_uses + 1 WHERE id = ?`,
      [accessCode.id]
    );

    if (!usageResult.success) {
      throw new Error(usageResult.error || 'Failed to update code usage');
    }

    // Track code usage
    const trackResult = await dbRun(
      `INSERT INTO access_code_usage (id, code_id, user_id, used_at)
            VALUES (?, ?, ?, datetime('now'))`,
      [uuidv4(), accessCode.id, newUserId]
    );

    if (!trackResult.success) {
      throw new Error(trackResult.error || 'Failed to track code usage');
    }

    return res.json({
      success: true,
      user: {
        id: newUserId,
        email: email,
        firstName: firstName,
        lastName: lastName,
        role: accessCode.role,
        organizationId: accessCode.org_id,
        companyName: accessCode.org_name,
      },
      message: 'Registration successful',
    });
  })
);

/**
 * DELETE /api/access-control/codes/:id
 * Deactivate access code (Admin only)
 */
router.delete(
  '/codes/:id',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const code = await dbGet<{ organization_id: string }>(
      'SELECT organization_id FROM access_codes WHERE id = ?',
      [id]
    );

    if (!code) {
      return res.status(404).json({ error: 'Access code not found' });
    }

    // Verify user has access to this organization
    if (req.user?.role !== 'SUPERADMIN' && req.user?.organizationId !== code.organization_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Dual-model reconciliation (CTO decision, 2026-07-20): revoke via
    // AccessCodeService.revokeCode(), which sets BOTH is_active AND the
    // hash-model `status`, instead of a raw UPDATE that only touched
    // is_active (leaving the code valid through accessCodeService's
    // hash-lookup validate/accept paths).
    const { changes } = await AccessCodeService.revokeCode(id);

    if (!changes) {
      throw new Error('Failed to deactivate access code');
    }

    return res.json({ success: true, message: 'Access code deactivated' });
  })
);

export default router;
