/**
 * assessment-level-attachments Routes
 *
 * Provides evidence upload and retrieval for assessment levels:
 * - POST   /api/assessment-level-attachments                         (multipart/form-data)
 * - GET    /api/assessment-level-attachments/level/:assessmentId/:axisId/:levelNumber?areaId=...
 * - GET    /api/assessment-level-attachments/:assessmentId
 * - GET    /api/assessment-level-attachments/download/:attachmentId
 * - PUT    /api/assessment-level-attachments/:attachmentId/description
 * - DELETE /api/assessment-level-attachments/:attachmentId
 *
 * Storage:
 * - Files are stored on disk under /uploads/assessment-level-attachments/<orgId>/
 * - Metadata is stored in SQLite in table `assessment_level_attachments`
 */
import type { Response } from 'express';
import { Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';

import { getDatabase } from '../../database/index.js';
import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../../middleware/demoGuard.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/Logger.js';
import { uploadsDir } from '../../utils/storagePaths.js';

const router = Router();

router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(demoContextMiddleware);

// Was `path.join(__dirname, '../../../../uploads/assessment-level-attachments')`
// — equivalent to `process.cwd()/uploads/...` at runtime; routed through the
// shared helper for G2 volume readiness (utils/storagePaths.ts).
const baseUploadDir = uploadsDir('assessment-level-attachments');

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const orgId = (req as AuthRequest).user?.organizationId || 'unknown';
    const dir = path.join(baseUploadDir, orgId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitized}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

const ensureSchema = async () => {
  const db = getDatabase();
  await new Promise<void>((resolve, reject) => {
    db.exec(
      `CREATE TABLE IF NOT EXISTS assessment_level_attachments (
        id TEXT PRIMARY KEY,
        assessment_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        axis_id TEXT NOT NULL,
        area_id TEXT,
        level_number INTEGER NOT NULL,
        attachment_type TEXT DEFAULT 'EVIDENCE',
        description TEXT,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ala_assessment ON assessment_level_attachments(assessment_id);
      CREATE INDEX IF NOT EXISTS idx_ala_axis_level ON assessment_level_attachments(axis_id, level_number);
      CREATE INDEX IF NOT EXISTS idx_ala_area ON assessment_level_attachments(area_id);`,
      (err) => (err ? reject(err) : resolve())
    );
  });
};

type AttachmentRow = {
  id: string;
  attachment_type: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  description?: string | null;
  created_at: string;
};

const mapRow = (r: AttachmentRow) => ({
  id: r.id,
  attachmentType: r.attachment_type,
  fileName: r.file_name,
  fileSize: r.file_size,
  mimeType: r.mime_type,
  description: r.description || undefined,
  createdAt: r.created_at,
});

router.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureSchema();
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (!req.file) return res.status(400).json({ error: 'Missing file' });

    const uploadedFile = req.file;
    const { assessmentId, axisId, levelNumber, areaId, attachmentType, description } =
      req.body || {};
    if (!assessmentId || !axisId || !levelNumber) {
      return res.status(400).json({ error: 'assessmentId, axisId, levelNumber are required' });
    }

    const id = `ala-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const db = getDatabase();
    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO assessment_level_attachments (
          id, assessment_id, organization_id, axis_id, area_id, level_number,
          attachment_type, description, file_name, file_path, file_size, mime_type, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          assessmentId,
          user.organizationId,
          axisId,
          areaId || null,
          Number(levelNumber),
          attachmentType || 'EVIDENCE',
          description || null,
          uploadedFile.originalname,
          uploadedFile.path,
          uploadedFile.size,
          uploadedFile.mimetype,
          user.id,
        ],
        (err) => (err ? reject(err) : resolve())
      );
    });

    res.json(
      mapRow({
        id,
        attachment_type: attachmentType || 'EVIDENCE',
        file_name: uploadedFile.originalname,
        file_size: uploadedFile.size,
        mime_type: uploadedFile.mimetype,
        description: description || null,
        created_at: new Date().toISOString(),
      })
    );
  })
);

router.get(
  '/level/:assessmentId/:axisId/:levelNumber',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureSchema();
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { assessmentId, axisId, levelNumber } = req.params;
    const { areaId } = req.query as { areaId?: string };

    const db = getDatabase();
    const rows = await new Promise<AttachmentRow[]>((resolve, reject) => {
      const params: any[] = [assessmentId, user.organizationId, axisId, Number(levelNumber)];
      let sql = `SELECT id, attachment_type, file_name, file_size, mime_type, description, created_at
                 FROM assessment_level_attachments
                 WHERE assessment_id = ? AND organization_id = ? AND axis_id = ? AND level_number = ?`;
      if (areaId) {
        sql += ' AND area_id = ?';
        params.push(areaId);
      } else {
        sql += ' AND area_id IS NULL';
      }
      sql += ' ORDER BY created_at DESC';
      db.all(sql, params, (err, r) => (err ? reject(err) : resolve((r as any[]) || [])));
    });

    res.json({
      axisId,
      levelNumber: Number(levelNumber),
      areaId: areaId || null,
      attachments: rows.map(mapRow),
      count: rows.length,
    });
  })
);

router.get(
  '/download/:attachmentId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureSchema();
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const { attachmentId } = req.params;

    const db = getDatabase();
    const row = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT file_path, file_name, mime_type
         FROM assessment_level_attachments
         WHERE id = ? AND organization_id = ?`,
        [attachmentId, user.organizationId],
        (err, r) => (err ? reject(err) : resolve(r))
      );
    });

    if (!row) return res.status(404).json({ error: 'Attachment not found' });
    if (!fs.existsSync(row.file_path))
      return res.status(404).json({ error: 'File missing on disk' });

    res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
    res.download(row.file_path, row.file_name);
  })
);

router.put(
  '/:attachmentId/description',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureSchema();
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const { attachmentId } = req.params;
    const { description } = req.body as { description?: string };

    const db = getDatabase();
    await new Promise<void>((resolve, reject) => {
      db.run(
        `UPDATE assessment_level_attachments SET description = ? WHERE id = ? AND organization_id = ?`,
        [description || null, attachmentId, user.organizationId],
        (err) => (err ? reject(err) : resolve())
      );
    });

    res.json({ success: true });
  })
);

router.delete(
  '/:attachmentId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureSchema();
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const { attachmentId } = req.params;

    const db = getDatabase();
    const row = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT file_path FROM assessment_level_attachments WHERE id = ? AND organization_id = ?`,
        [attachmentId, user.organizationId],
        (err, r) => (err ? reject(err) : resolve(r))
      );
    });
    if (!row) return res.status(404).json({ error: 'Attachment not found' });

    await new Promise<void>((resolve, reject) => {
      db.run(
        `DELETE FROM assessment_level_attachments WHERE id = ? AND organization_id = ?`,
        [attachmentId, user.organizationId],
        (err) => (err ? reject(err) : resolve())
      );
    });

    try {
      if (row.file_path && fs.existsSync(row.file_path)) fs.unlinkSync(row.file_path);
    } catch (e) {
      logger.warn('[assessment-level-attachments] Failed to delete file from disk');
    }

    res.json({ success: true });
  })
);

export default router;
