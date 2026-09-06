/**
 * Users Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * All user-related API endpoints with Zod validation
 */

import { NextFunction, Response, Router } from 'express';
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

const requireMembershipForDelegatedUserUpdate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (String(req.user?.id || '') === String(req.params.id || '')) return next();
  return requireActiveMembership(req, res, next);
};

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
  requireMembershipForDelegatedUserUpdate,
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

/**
 * ETAT OSOBY — jedna liczba, ktora czyni oblozenie policzalnym (1.12-R2).
 *
 * DLACZEGO TUTAJ, A NIE W /api/execution-control:
 * `/api/execution-control` jest zamontowane za `requireCanonicalExecutionWriter`
 * (decyzja 26A) — kazdy zapis inny niz GET dostaje 409, bo pisarzem pracy
 * realizacyjnej ma byc Runtime-v1. Etat NIE JEST praca realizacyjna, tylko
 * atrybutem PROFILU OSOBY (plan 1.12 C5 pyt. 2: „etat z profilu, jedna
 * edytowalna liczba na osobe”), wiec pisze sie go tam, gdzie mieszka profil.
 *
 * Kontrakt: 0–80 h/tydz. i 0–100 % dostepnosci; `null` kasuje ustawienie
 * i przywraca polityke domyslna (40 h x 100 %) — dzieki temu „ustawione recznie
 * 40" nadal rozni sie od „nikt nie pytal".
 */
router.patch(
  '/:id/capacity',
  verifyToken,
  requireMembershipForDelegatedUserUpdate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;
    const actorRole = String(req.user?.role || '').toUpperCase();
    if (
      String(req.user?.id || '') !== String(id) &&
      !['ADMIN', 'SUPERADMIN', 'OWNER'].includes(actorRole)
    )
      return res.status(403).json({ error: 'Not authorized to change capacity for this user' });

    const rawHours = (req.body ?? {}).weeklyCapacityHours;
    const rawPercent = (req.body ?? {}).availabilityPercent;
    const parseOptional = (value: unknown, max: number) => {
      if (value === null) return { ok: true as const, value: null };
      if (value === undefined) return { ok: true as const, value: undefined };
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > max)
        return { ok: false as const, value: undefined };
      return { ok: true as const, value: parsed };
    };
    const hours = parseOptional(rawHours, 80);
    const percent = parseOptional(rawPercent, 100);
    if (!hours.ok || !percent.ok)
      return res.status(400).json({
        error: 'weeklyCapacityHours must be 0–80, availabilityPercent must be 0–100',
        code: 'USER_CAPACITY_OUT_OF_RANGE',
      });
    if (hours.value === undefined && percent.value === undefined)
      return res.status(400).json({ error: 'Nothing to update', code: 'USER_CAPACITY_EMPTY' });

    const owner = await dbGet<{ id: string; organization_id: string }>(
      'SELECT id, organization_id FROM users WHERE id = ?',
      [id]
    );
    if (!owner) return res.status(404).json({ error: 'User not found' });
    // Granica najemcy: nie wolno ustawiac etatu osobie z innej organizacji.
    if (
      actorRole !== 'SUPERADMIN' &&
      String(owner.organization_id || '') !== String(req.user?.organizationId || '')
    )
      return res.status(403).json({ error: 'Not authorized to change capacity for this user' });

    const sets: string[] = [];
    const params: unknown[] = [];
    if (hours.value !== undefined) {
      sets.push('weekly_capacity_hours = ?');
      params.push(hours.value);
    }
    if (percent.value !== undefined) {
      sets.push('availability_percent = ?');
      params.push(percent.value);
    }
    const result = await dbRun(
      `UPDATE users SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...params, id],
      { fallback: false }
    );
    if (!result.success)
      return res
        .status(500)
        .json({ error: result.error || 'Failed to update capacity', code: 'USER_CAPACITY_FAILED' });

    // Odczyt zwrotny z bazy — nie odsylamy tego, co przyszlo w zadaniu.
    const saved = await dbGet<{
      weekly_capacity_hours: number | string | null;
      availability_percent: number | null;
    }>('SELECT weekly_capacity_hours, availability_percent FROM users WHERE id = ?', [id]);
    return res.json({
      userId: id,
      weeklyCapacityHours:
        saved?.weekly_capacity_hours === null || saved?.weekly_capacity_hours === undefined
          ? null
          : Number(saved.weekly_capacity_hours),
      availabilityPercent: saved?.availability_percent ?? null,
    });
  })
);

export default router;
