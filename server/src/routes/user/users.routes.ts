/**
 * Users Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * All user-related API endpoints with Zod validation
 */

import { Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import UserControllerRaw from '../../controllers/UserController.js';
const UserController = UserControllerRaw as any;
import { AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import { requireActiveMembership } from '../../services/legacyCutover/requireActiveMembership.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import { resolveStoredRelativePath, uploadsDir } from '../../utils/storagePaths.js';
import { UpdateUserRoleSchema, UpdateUserSchema } from '../../validators/user.validators.js';

const router = Router();

// Configure multer for avatar uploads
const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = uploadsDir('avatars');
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WebP are allowed.'));
    }
  },
});

// Apply rate limiting
router.use(apiAuthRateLimiter);

// Apply auth middleware to all routes
router.use(verifyToken);

// ==========================================
// USER CRUD
// ==========================================

/**
 * GET /api/users
 * Get all users for organization
 */
router.get('/', UserController.getUsers);

/**
 * GET /api/users/:id
 * Get single user by ID
 */
router.get('/:id', UserController.getUserById);

/**
 * PUT /api/users/:id
 * Update user
 */
router.put(
  '/:id',
  requireActiveMembership,
  validateBody(UpdateUserSchema),
  UserController.updateUser
);

/**
 * PATCH /api/users/:id/role
 * Update user role (Admin only)
 */
router.patch('/:id/role', validateBody(UpdateUserRoleSchema), UserController.updateUserRole);

/**
 * DELETE /api/users/:id
 * Delete user (Admin only)
 */
router.delete('/:id', UserController.deleteUser);

// ==========================================
// AVATAR MANAGEMENT
// ==========================================

/**
 * POST /api/users/:id/avatar
 * Upload user avatar
 */
router.post(
  '/:id/avatar',
  avatarUpload.single('avatar'),
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;
    const userId = req.user?.id;

    if (userId !== id && req.user?.role !== 'SUPERADMIN' && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized to update this avatar' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const oldUser = await dbGet<{ avatar_url: string }>(
        'SELECT avatar_url FROM users WHERE id = ?',
        [id]
      );

      const avatarUrl = `/uploads/avatars/${req.file.filename}`;

      const result = await dbRun(
        'UPDATE users SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [avatarUrl, id],
        { fallback: false }
      );
      if (!result.success) {
        throw new Error(result.error || 'Failed to persist avatar');
      }

      if (oldUser?.avatar_url && oldUser.avatar_url.startsWith('/uploads/')) {
        const oldPath = resolveStoredRelativePath(oldUser.avatar_url);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      logger.info(`[users] Avatar uploaded for user ${id}`);
      return res.json({ success: true, avatarUrl });
    } catch (err: any) {
      if (req.file) {
        const filePath = path.join(uploadsDir('avatars'), req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      logger.error('[users] Error uploading avatar', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Failed to upload avatar', code: 'USER_AVATAR_UPLOAD_FAILED' });
    }
  })
);

/**
 * DELETE /api/users/:id/avatar
 * Remove user avatar
 */
router.delete(
  '/:id/avatar',
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;
    const userId = req.user?.id;

    if (userId !== id && req.user?.role !== 'SUPERADMIN' && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized to remove this avatar' });
    }

    try {
      const user = await dbGet<{ avatar_url: string }>(
        'SELECT avatar_url FROM users WHERE id = ?',
        [id]
      );

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (user.avatar_url && user.avatar_url.startsWith('/uploads/')) {
        const filePath = resolveStoredRelativePath(user.avatar_url);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      const result = await dbRun(
        'UPDATE users SET avatar_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id],
        { fallback: false }
      );
      if (!result.success) {
        throw new Error(result.error || 'Failed to remove avatar');
      }

      logger.info(`[users] Avatar removed for user ${id}`);
      return res.json({ success: true });
    } catch (err: any) {
      logger.error('[users] Error removing avatar', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Failed to remove avatar', code: 'USER_AVATAR_REMOVE_FAILED' });
    }
  })
);

export default router;
