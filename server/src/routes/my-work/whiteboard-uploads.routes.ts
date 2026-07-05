/**
 * Whiteboard image uploads sub-router — A6 "Whiteboard finish".
 *
 * Mounted under /api/my-work by the parent router (my-work.routes.ts), which
 * already applies apiAuthRateLimiter + verifyToken + demoContextMiddleware
 * ahead of this router, so every request here is authenticated.
 *
 * Problem: whiteboard images were stored as inline base64 data URIs inside
 * nodes_json, bloating the map row and making every autosave (/map/sync) ship
 * the full image payload again. This endpoint lets the FE upload the raw file
 * once and reference it by URL instead. Old base64 nodes keep rendering
 * unchanged (ImageNode reads `data.imageUrl || data.src`) — no migration.
 *
 * Storage: local disk under uploads/whiteboard/<orgId>/, served by the
 * existing `/uploads` express.static mount (server/src/index.ts). This
 * mirrors the avatar (users.routes.ts) and branding (branding.routes.ts)
 * upload patterns already used in this codebase — no new cloud dependency.
 */
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { Router } from 'express';
import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { sanitizeOrgIdForUploadPath } from '../../middleware/fileUpload.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/Logger.js';
import { requireUser } from './_helpers.js';

const router = Router();

// 10MB — matches the FE's existing inline-base64 cap (MAX_WHITEBOARD_IMAGE_BYTES
// in IdeaWhiteboardTool.tsx) so the fallback-to-base64 path never has to handle
// a file the server would reject anyway.
const MAX_WHITEBOARD_IMAGE_BYTES = 10 * 1024 * 1024;

// Deliberately excludes image/svg+xml: SVGs can carry <script>/on* handlers
// and would be served same-origin from /uploads, which is an XSS vector
// (see the SVG-sanitization comment in branding.routes.ts for the same
// concern). Whiteboard images don't need SVG support, so the simplest safe
// choice is to leave it off the allow-list entirely rather than add a DOMPurify
// pass just for this endpoint.
export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

/** Exported for direct unit testing (see tests/unit/backend/routes/whiteboard-uploads.fileFilter.test.ts). */
export const whiteboardImageFileFilter: (
  req: unknown,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void
) => void = (_req, file, cb) => {
  if (ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type. Only PNG, JPEG, GIF and WebP are allowed.'), false);
  }
};

const WHITEBOARD_UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'whiteboard');

const whiteboardImageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const orgId = sanitizeOrgIdForUploadPath(String((req as AuthRequest).user?.organizationId || 'unknown'));
      const uploadDir = path.join(WHITEBOARD_UPLOAD_ROOT, orgId);
      try {
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
      } catch (err) {
        cb(err as Error, WHITEBOARD_UPLOAD_ROOT);
      }
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
      cb(null, `${uuidv4()}${ext}`);
    },
  }),
  limits: { fileSize: MAX_WHITEBOARD_IMAGE_BYTES, files: 1 },
  fileFilter: whiteboardImageFileFilter as any,
});

/**
 * POST /api/my-work/whiteboard/images
 * multipart/form-data field name: "image"
 * Response: { url, id } on success (shape matches POST /api/branding/:orgId/upload).
 */
router.post(
  '/whiteboard/images',
  (req, res, next) => {
    whiteboardImageUpload.single('image')(req, res, (err: unknown) => {
      if (!err) return next();
      const message =
        err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
          ? 'Image too large (max 10MB)'
          : err instanceof Error
            ? err.message
            : 'Upload failed';
      const status =
        err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ error: message });
    });
  },
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Defense in depth: re-check mime + size here too. multer's `limits` /
    // `fileFilter` already enforce this on the real diskStorage path, but this
    // guard keeps the contract true even against alternate storage engines
    // (e.g. memoryStorage-based test doubles) that don't run those hooks.
    if (!ALLOWED_IMAGE_MIME_TYPES.has(req.file.mimetype)) {
      return res
        .status(400)
        .json({ error: 'Unsupported file type. Only PNG, JPEG, GIF and WebP are allowed.' });
    }
    if (req.file.size > MAX_WHITEBOARD_IMAGE_BYTES) {
      return res.status(413).json({ error: 'Image too large (max 10MB)' });
    }

    const orgId = sanitizeOrgIdForUploadPath(String(identity.orgId));
    // `filename` is set by our diskStorage config; fall back to a fresh id if
    // a different storage engine didn't populate it.
    const filename = req.file.filename || `${uuidv4()}${path.extname(req.file.originalname || '') || '.png'}`;
    const url = `/uploads/whiteboard/${orgId}/${filename}`;

    logger.info(`[whiteboard-uploads] Image uploaded for org ${orgId}: ${filename}`);

    return res.status(201).json({ url, id: filename });
  })
);

export default router;
