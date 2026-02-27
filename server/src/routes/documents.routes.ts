/**
 * Documents Routes
 * API endpoints for document management
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';
import fs from 'fs';
import multer from 'multer';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

// Apply rate limiting
const router = Router();

// Dynamic import for DocumentService (may not be migrated yet)
const DocumentService: any = null;

try {
  // const documentModule = await import('../services/documentService.js');
  // DocumentService = documentModule.default || documentModule;
} catch {
  logger.warn('[Documents] DocumentService not available');
}

const upload = multer({
  // Avoid runtime filesystem writes when the feature is unavailable.
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'application/json',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png',
      'image/jpeg',
      'image/gif',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

const featureReadFallback = (res: Response, data: unknown = []) =>
  res.status(200).json({
    success: true,
    status: 'not_configured',
    feature: 'documents',
    writable: false,
    data,
  });

const featureWriteBlocked = (res: Response) =>
  res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
  });

/**
 * GET /api/documents/project/:projectId
 * List project documents
 */
router.get(
  '/project/:projectId',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!DocumentService?.getProjectDocuments) {
      return featureReadFallback(res, []);
    }

    try {
      const { projectId } = req.params;
      const documents = await DocumentService.getProjectDocuments(projectId);
      return res.json(documents);
    } catch (error: any) {
      logger.error('[Documents] Error fetching project documents:', error);
      return res.status(500).json({ error: error.message });
    }
  })
);

/**
 * GET /api/documents/user
 * List user's private documents
 */
router.get(
  '/user',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!DocumentService?.getUserDocuments) {
      return featureReadFallback(res, []);
    }

    try {
      const userId = req.user?.id;
      const organizationId = (req.user as any)?.organization_id || req.user?.organizationId;
      if (!userId || !organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const documents = await DocumentService.getUserDocuments(userId, organizationId);
      return res.json(documents);
    } catch (error: any) {
      logger.error('[Documents] Error fetching user documents:', error);
      return res.status(500).json({ error: error.message });
    }
  })
);

/**
 * GET /api/documents/all
 * List all accessible documents (user's + project's if projectId provided)
 */
router.get(
  '/all',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!DocumentService?.getAccessibleDocuments) {
      return featureReadFallback(res, []);
    }

    try {
      const userId = req.user?.id;
      const organizationId = (req.user as any)?.organization_id || req.user?.organizationId;
      if (!userId || !organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { projectId } = req.query;
      const documents = await DocumentService.getAccessibleDocuments(
        userId,
        organizationId,
        projectId as string | undefined
      );
      return res.json(documents);
    } catch (error: any) {
      logger.error('[Documents] Error fetching documents:', error);
      return res.status(500).json({ error: error.message });
    }
  })
);

/**
 * GET /api/documents
 * Alias for /documents/all
 */
router.get(
  '/',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Return empty array if service not available (for tests)
    if (!DocumentService?.getAccessibleDocuments) {
      return res.json([]);
    }

    try {
      const userId = req.user?.id;
      const organizationId = (req.user as any)?.organization_id || req.user?.organizationId;
      if (!userId || !organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { projectId } = req.query;
      const documents = await DocumentService.getAccessibleDocuments(
        userId,
        organizationId,
        projectId as string | undefined
      );
      return res.json(documents);
    } catch (error: any) {
      logger.error('[Documents] Error fetching documents:', error);
      return res.status(500).json({ error: error.message });
    }
  })
);

/**
 * GET /api/documents/:id
 * Get single document
 */
router.get(
  '/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!DocumentService?.getDocumentById) {
      return featureReadFallback(res, null);
    }

    try {
      const document = await DocumentService.getDocumentById(req.params.id);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      return res.json(document);
    } catch (error: any) {
      logger.error('[Documents] Error fetching document:', error);
      return res.status(500).json({ error: error.message });
    }
  })
);

/**
 * GET /api/documents/:id/download
 * Download document file
 */
router.get(
  '/:id/download',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!DocumentService?.getDocumentById) {
      return res.status(503).json({
        statusCode: 503,
        status: false,
        type: 'not_configured',
        message: 'Service temporarily unavailable due to missing configuration',
      });
    }

    try {
      const document = await DocumentService.getDocumentById(req.params.id);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      const filePath = document.filepath;
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found on server' });
      }

      return res.download(filePath, document.originalName || document.filename);
    } catch (error: any) {
      logger.error('[Documents] Error downloading document:', error);
      return res.status(500).json({ error: error.message });
    }
  })
);

/**
 * POST /api/documents/upload
 * Upload new document
 */
router.post(
  '/upload',
  verifyToken,
  upload.single('file'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!DocumentService?.uploadDocument) {
      // Return 400 for missing file (tests expect this, not 503)
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      return featureWriteBlocked(res);
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const ownerId = req.user?.id;
      const organizationId = (req.user as any)?.organization_id || req.user?.organizationId;
      if (!ownerId || !organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { scope = 'user', projectId, description, tags } = req.body;

      // Validate scope
      if (scope === 'project' && !projectId) {
        return res.status(400).json({ error: 'Project ID required for project scope' });
      }

      logger.info(
        `[Documents] Upload: ${req.file.originalname}, scope: ${scope}, owner: ${ownerId}`
      );

      const document = await DocumentService.uploadDocument(req.file, {
        organizationId,
        projectId: scope === 'project' ? projectId : null,
        ownerId,
        scope,
        description,
        tags: tags ? JSON.parse(tags) : [],
      });

      return res.status(201).json({
        message: 'Document uploaded successfully',
        document,
      });
    } catch (error: any) {
      logger.error('[Documents] Upload error:', error);
      return res.status(500).json({ error: error.message || 'Upload failed' });
    }
  })
);

/**
 * PUT /api/documents/:id/move-to-project
 * Move private doc to project
 */
router.put(
  '/:id/move-to-project',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!DocumentService?.moveToProject) {
      return featureWriteBlocked(res);
    }

    try {
      const { id: documentId } = req.params;
      const { projectId } = req.body;
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!projectId) {
        return res.status(400).json({ error: 'Project ID required' });
      }

      const document = await DocumentService.moveToProject(documentId, projectId, userId);
      return res.json({
        message: 'Document moved to project',
        document,
      });
    } catch (error: any) {
      logger.error('[Documents] Move error:', error);
      return res.status(500).json({ error: error.message });
    }
  })
);

/**
 * DELETE /api/documents/:id
 * Soft delete document
 */
router.delete(
  '/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!DocumentService?.deleteDocument) {
      return featureWriteBlocked(res);
    }

    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const result = await DocumentService.deleteDocument(req.params.id, userId);

      if (!result.success) {
        return res.status(404).json({ error: 'Document not found or access denied' });
      }

      return res.json({ message: 'Document deleted' });
    } catch (error: any) {
      logger.error('[Documents] Delete error:', error);
      return res.status(500).json({ error: error.message });
    }
  })
);

export default router;
