// @ts-nocheck
/**
 * Users Routes - User management endpoints
 *
 * Includes:
 * - Basic CRUD operations
 * - Avatar upload/delete
 * - User search (for team management)
 */

import { Response, Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();

// Configure multer for avatar uploads
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WebP are allowed.'));
    }
  },
});

// ===========================================
// USER SEARCH (for team management)
// ===========================================

/**
 * GET /api/users/search
 * Search users in the same organization by name or email
 * Used by TeamManagementPanel to add members to assessments
 */
router.get(
  '/search',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = req.user?.organizationId;
    const query = String(req.query.q || '').trim();
    const limit = Math.min(parseInt(String(req.query.limit || '10')), 50);

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization context required' });
    }

    if (query.length < 2) {
      return res.json({ users: [] });
    }

    try {
      const searchPattern = `%${query}%`;
      const users = await dbAll<{
        id: string;
        email: string;
        first_name: string;
        last_name: string;
        avatar_url: string;
      }>(
        `SELECT id, email, first_name, last_name, avatar_url
         FROM users 
         WHERE organization_id = ?
           AND status = 'active'
           AND (
             email LIKE ? 
             OR first_name LIKE ? 
             OR last_name LIKE ?
             OR (first_name || ' ' || last_name) LIKE ?
           )
         ORDER BY first_name, last_name
         LIMIT ?`,
        [organizationId, searchPattern, searchPattern, searchPattern, searchPattern, limit]
      );

      // Map to expected format for TeamManagementPanel
      const mappedUsers = (users || []).map((u) => ({
        id: u.id,
        email: u.email,
        name: u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.email,
        avatarUrl: u.avatar_url,
      }));

      logger.info(
        `[users] Search for "${query}" in org ${organizationId} returned ${mappedUsers.length} results`
      );
      return res.json({ users: mappedUsers });
    } catch (err: any) {
      logger.error('[users] Error searching users:', err);
      return res.status(500).json({ error: err.message });
    }
  })
);

// ===========================================
// BASIC USER OPERATIONS
// ===========================================

/**
 * GET /api/users
 * Get all users (admin only or filtered by organization)
 */
router.get(
  '/',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = req.user?.organizationId;

    try {
      const users = await dbAll(
        `SELECT id, email, first_name, last_name, role, avatar_url, status, created_at
             FROM users 
             WHERE organization_id = ?
             ORDER BY created_at DESC`,
        [organizationId]
      );

      return res.json({ success: true, data: users || [] });
    } catch (err: any) {
      logger.error('[users] Error fetching users:', err);
      return res.status(500).json({ error: err.message });
    }
  })
);

/**
 * GET /api/users/:id
 * Get user by ID
 */
router.get(
  '/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
      const user = await dbGet(
        `SELECT id, email, first_name, last_name, role, avatar_url, status, created_at
             FROM users WHERE id = ?`,
        [id]
      );

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({ success: true, data: user });
    } catch (err: any) {
      logger.error('[users] Error fetching user:', err);
      return res.status(500).json({ error: err.message });
    }
  })
);

/**
 * PUT /api/users/:id
 * Update user
 */
router.put(
  '/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const updates = req.body;

    try {
      // Build dynamic update query
      const allowedFields = ['first_name', 'last_name', 'avatar_url', 'status'];
      const setClause: string[] = [];
      const values: any[] = [];

      for (const [key, value] of Object.entries(updates)) {
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (allowedFields.includes(snakeKey)) {
          setClause.push(`${snakeKey} = ?`);
          values.push(value);
        }
      }

      if (setClause.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      setClause.push('updated_at = datetime("now")');
      values.push(id);

      await dbRun(`UPDATE users SET ${setClause.join(', ')} WHERE id = ?`, values);

      logger.info(`[users] User ${id} updated`);
      return res.json({ success: true, data: updates });
    } catch (err: any) {
      logger.error('[users] Error updating user:', err);
      return res.status(500).json({ error: err.message });
    }
  })
);

// ===========================================
// AVATAR MANAGEMENT
// ===========================================

/**
 * POST /api/users/:id/avatar
 * Upload user avatar
 */
router.post(
  '/:id/avatar',
  verifyToken,
  avatarUpload.single('avatar'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id;

    // Check authorization (user can only update own avatar or admin)
    if (userId !== id && req.user?.role !== 'SUPERADMIN' && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized to update this avatar' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      // Get old avatar to delete
      const oldUser = await dbGet<{ avatar_url: string }>(
        'SELECT avatar_url FROM users WHERE id = ?',
        [id]
      );

      // Build avatar URL
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;

      // Update user with new avatar
      await dbRun('UPDATE users SET avatar_url = ?, updated_at = datetime("now") WHERE id = ?', [
        avatarUrl,
        id,
      ]);

      // Delete old avatar file if exists and is local
      if (oldUser?.avatar_url && oldUser.avatar_url.startsWith('/uploads/')) {
        const oldPath = path.join(process.cwd(), oldUser.avatar_url);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      logger.info(`[users] Avatar uploaded for user ${id}`);
      return res.json({ success: true, avatarUrl });
    } catch (err: any) {
      // Clean up uploaded file on error
      if (req.file) {
        const filePath = path.join(process.cwd(), 'uploads', 'avatars', req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      logger.error('[users] Error uploading avatar:', err);
      return res.status(500).json({ error: err.message });
    }
  })
);

/**
 * DELETE /api/users/:id/avatar
 * Remove user avatar
 */
router.delete(
  '/:id/avatar',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id;

    // Check authorization
    if (userId !== id && req.user?.role !== 'SUPERADMIN' && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized to remove this avatar' });
    }

    try {
      // Get current avatar
      const user = await dbGet<{ avatar_url: string }>(
        'SELECT avatar_url FROM users WHERE id = ?',
        [id]
      );

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Delete avatar file if it's a local file
      if (user.avatar_url && user.avatar_url.startsWith('/uploads/')) {
        const filePath = path.join(process.cwd(), user.avatar_url);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      // Update user to remove avatar
      await dbRun('UPDATE users SET avatar_url = NULL, updated_at = datetime("now") WHERE id = ?', [
        id,
      ]);

      logger.info(`[users] Avatar removed for user ${id}`);
      return res.json({ success: true });
    } catch (err: any) {
      logger.error('[users] Error removing avatar:', err);
      return res.status(500).json({ error: err.message });
    }
  })
);

/**
 * DELETE /api/users/:id
 * Delete user (admin only)
 */
router.delete(
  '/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    // Only admins can delete users
    if (req.user?.role !== 'SUPERADMIN' && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    try {
      // Get user avatar to delete
      const user = await dbGet<{ avatar_url: string }>(
        'SELECT avatar_url FROM users WHERE id = ?',
        [id]
      );

      // Delete avatar file if exists
      if (user?.avatar_url && user.avatar_url.startsWith('/uploads/')) {
        const filePath = path.join(process.cwd(), user.avatar_url);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      await dbRun('DELETE FROM users WHERE id = ?', [id]);

      logger.info(`[users] User ${id} deleted`);
      return res.json({ success: true });
    } catch (err: any) {
      logger.error('[users] Error deleting user:', err);
      return res.status(500).json({ error: err.message });
    }
  })
);

export default router;
