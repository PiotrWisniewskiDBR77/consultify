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
 * Storage: routed through the provider-agnostic storage seam
 * (services/storage). Default provider is local disk, keyed
 * `whiteboard/<orgId>/<uuid>.<ext>` under the `uploads/` tree and served by the
 * existing `/uploads` express.static mount (server/src/index.ts) — identical to
 * the previous behavior. Flipping STORAGE_PROVIDER=s3 moves these images to
 * durable S3/R2 storage with no change here (fixes the Railway redeploy-wipe).
 */
import multer from 'multer';
import path from 'path';
import { Router } from 'express';
import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { sanitizeOrgIdForUploadPath } from '../../middleware/fileUpload.middleware.js';
import { getStorage } from '../../services/storage/index.js';
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

/** Storage-seam key prefix for whiteboard images: `whiteboard/<orgId>/<file>`. */
const WHITEBOARD_KEY_PREFIX = 'whiteboard';

// memoryStorage so the raw bytes are available to hand to the storage seam
// (getStorage().putObject). The seam picks local disk (default) or S3/R2 by
// STORAGE_PROVIDER, so uploads survive Railway redeploys once S3/R2 is enabled.
const whiteboardImageUpload = multer({
  storage: multer.memoryStorage(),
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
    const ext = path.extname(req.file.originalname || '').toLowerCase() || '.png';
    const filename = `${uuidv4()}${ext}`;
    const key = `${WHITEBOARD_KEY_PREFIX}/${orgId}/${filename}`;

    // memoryStorage guarantees req.file.buffer; guard for alternate engines.
    if (!req.file.buffer) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const storage = getStorage();
    await storage.putObject({ key, body: req.file.buffer, contentType: req.file.mimetype });
    // For local: `/uploads/whiteboard/<orgId>/<file>` (unchanged). For S3/R2: a
    // signed or public URL. Existing base64 nodes are unaffected.
    const url = await storage.getUrl(key);

    logger.info(`[whiteboard-uploads] Image uploaded for org ${orgId}: ${filename}`);

    return res.status(201).json({ url, id: filename });
  })
);

export default router;
