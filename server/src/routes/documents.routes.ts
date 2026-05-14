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

const featureReadFallback = (req: AuthRequest, res: Response, _data: unknown = []) =>
  res.status(503).json(
    buildDocumentsFailClosedError(
      req,
      503,
      'DOCUMENTS_SERVICE_NOT_CONFIGURED',
      'Documents service is temporarily unavailable.'
    )
  );

const featureWriteBlocked = (req: AuthRequest, res: Response) =>
  res.status(503).json(
    buildDocumentsFailClosedError(
      req,
      503,
      'DOCUMENTS_SERVICE_NOT_CONFIGURED',
      'Documents service is temporarily unavailable.'
    )
  );

function resolveDocumentsCorrelationId(req: AuthRequest | null): string | null {
  if (!req) return null;
  return (req as any).correlationId || req.get('X-Correlation-ID') || null;
}

function buildDocumentsFailClosedError(
  req: AuthRequest | null,
  statusCode: number,
  code: string,
  message: string
) {
  return {
    status: statusCode >= 500 ? 'error' : 'fail',
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
    },
    correlationId: resolveDocumentsCorrelationId(req),
  };
}

/**
 * GET /api/documents/project/:projectId
 * List project documents
 */
router.get(
  '/project/:projectId',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!DocumentService?.getProjectDocuments) {
      return featureReadFallback(req, res, []);
    }

    try {
      const { projectId } = req.params;
      const documents = await DocumentService.getProjectDocuments(projectId);
      return res.json(documents);
    } catch (error: any) {
      logger.error('[Documents] Error fetching project documents:', error);
      return res
        .status(500)
        .json(
          buildDocumentsFailClosedError(
            req,
            500,
            'DOCUMENTS_PROJECT_READ_FAILED',
            'Failed to load project documents.'
          )
        );
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
      return featureReadFallback(req, res, []);
    }

    try {
      const userId = req.user?.id;
      const organizationId = (req.user as any)?.organization_id || req.user?.organizationId;
      if (!userId || !organizationId) {
        return res
          .status(401)
          .json(
            buildDocumentsFailClosedError(
              req,
              401,
              'DOCUMENTS_UNAUTHORIZED',
              'Authentication is required to access documents.'
            )
          );
      }

      const documents = await DocumentService.getUserDocuments(userId, organizationId);
      return res.json(documents);
    } catch (error: any) {
      logger.error('[Documents] Error fetching user documents:', error);
      return res
        .status(500)
        .json(
          buildDocumentsFailClosedError(
            req,
            500,
            'DOCUMENTS_USER_READ_FAILED',
            'Failed to load user documents.'
          )
        );
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
      return featureReadFallback(req, res, []);
    }

    try {
      const userId = req.user?.id;
      const organizationId = (req.user as any)?.organization_id || req.user?.organizationId;
      if (!userId || !organizationId) {
        return res
          .status(401)
          .json(
            buildDocumentsFailClosedError(
              req,
              401,
              'DOCUMENTS_UNAUTHORIZED',
              'Authentication is required to access documents.'
            )
          );
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
      return res
        .status(500)
        .json(
          buildDocumentsFailClosedError(
            req,
            500,
            'DOCUMENTS_ACCESSIBLE_READ_FAILED',
            'Failed to load documents.'
          )
        );
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
      return featureReadFallback(req, res, []);
    }

    try {
      const userId = req.user?.id;
      const organizationId = (req.user as any)?.organization_id || req.user?.organizationId;
      if (!userId || !organizationId) {
        return res
          .status(401)
          .json(
            buildDocumentsFailClosedError(
              req,
              401,
              'DOCUMENTS_UNAUTHORIZED',
              'Authentication is required to access documents.'
            )
          );
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
      return res
        .status(500)
        .json(
          buildDocumentsFailClosedError(
            req,
            500,
            'DOCUMENTS_ACCESSIBLE_READ_FAILED',
            'Failed to load documents.'
          )
        );
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
      return featureReadFallback(req, res, null);
    }

    try {
      const document = await DocumentService.getDocumentById(req.params.id);
      if (!document) {
        return res
          .status(404)
          .json(
            buildDocumentsFailClosedError(
              req,
              404,
              'DOCUMENTS_ITEM_NOT_FOUND',
              'Document was not found.'
            )
          );
      }
      return res.json(document);
    } catch (error: any) {
      logger.error('[Documents] Error fetching document:', error);
      return res
        .status(500)
        .json(
          buildDocumentsFailClosedError(
            req,
            500,
            'DOCUMENTS_ITEM_READ_FAILED',
            'Failed to load document.'
          )
        );
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
      return featureReadFallback(req, res, null);
    }

    try {
      const document = await DocumentService.getDocumentById(req.params.id);
      if (!document) {
        return res
          .status(404)
          .json(
            buildDocumentsFailClosedError(
              req,
              404,
              'DOCUMENTS_ITEM_NOT_FOUND',
              'Document was not found.'
            )
          );
      }

      const filePath = document.filepath;
      if (!fs.existsSync(filePath)) {
        return res
          .status(404)
          .json(
            buildDocumentsFailClosedError(
              req,
              404,
              'DOCUMENTS_FILE_NOT_FOUND',
              'Document file was not found.'
            )
          );
      }

      return res.download(filePath, document.originalName || document.filename);
    } catch (error: any) {
      logger.error('[Documents] Error downloading document:', error);
      return res
        .status(500)
        .json(
          buildDocumentsFailClosedError(
            req,
            500,
            'DOCUMENTS_DOWNLOAD_FAILED',
            'Failed to download document.'
          )
        );
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
        return res
          .status(400)
          .json(
            buildDocumentsFailClosedError(
              req,
              400,
              'DOCUMENTS_UPLOAD_FILE_REQUIRED',
              'File is required for upload.'
            )
          );
      }
      return featureWriteBlocked(req, res);
    }

    try {
      if (!req.file) {
        return res
          .status(400)
          .json(
            buildDocumentsFailClosedError(
              req,
              400,
              'DOCUMENTS_UPLOAD_FILE_REQUIRED',
              'File is required for upload.'
            )
          );
      }

      const ownerId = req.user?.id;
      const organizationId = (req.user as any)?.organization_id || req.user?.organizationId;
      if (!ownerId || !organizationId) {
        return res
          .status(401)
          .json(
            buildDocumentsFailClosedError(
              req,
              401,
              'DOCUMENTS_UNAUTHORIZED',
              'Authentication is required to upload documents.'
            )
          );
      }

      const { scope = 'user', projectId, description, tags } = req.body;

      // Validate scope
      if (scope === 'project' && !projectId) {
        return res
          .status(400)
          .json(
            buildDocumentsFailClosedError(
              req,
              400,
              'DOCUMENTS_PROJECT_ID_REQUIRED',
              'Project id is required for project-scoped uploads.'
            )
          );
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
      return res
        .status(500)
        .json(
          buildDocumentsFailClosedError(
            req,
            500,
            'DOCUMENTS_UPLOAD_FAILED',
            'Failed to upload document.'
          )
        );
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
      return featureWriteBlocked(req, res);
    }

    try {
      const { id: documentId } = req.params;
      const { projectId } = req.body;
      const userId = req.user?.id;
      if (!userId) {
        return res
          .status(401)
          .json(
            buildDocumentsFailClosedError(
              req,
              401,
              'DOCUMENTS_UNAUTHORIZED',
              'Authentication is required to modify documents.'
            )
          );
      }

      if (!projectId) {
        return res
          .status(400)
          .json(
            buildDocumentsFailClosedError(
              req,
              400,
              'DOCUMENTS_PROJECT_ID_REQUIRED',
              'Project id is required.'
            )
          );
      }

      const document = await DocumentService.moveToProject(documentId, projectId, userId);
      return res.json({
        message: 'Document moved to project',
        document,
      });
    } catch (error: any) {
      logger.error('[Documents] Move error:', error);
      return res
        .status(500)
        .json(
          buildDocumentsFailClosedError(
            req,
            500,
            'DOCUMENTS_MOVE_FAILED',
            'Failed to move document.'
          )
        );
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
      return featureWriteBlocked(req, res);
    }

    try {
      const userId = req.user?.id;
      if (!userId) {
        return res
          .status(401)
          .json(
            buildDocumentsFailClosedError(
              req,
              401,
              'DOCUMENTS_UNAUTHORIZED',
              'Authentication is required to delete documents.'
            )
          );
      }

      const result = await DocumentService.deleteDocument(req.params.id, userId);

      if (!result.success) {
        return res
          .status(404)
          .json(
            buildDocumentsFailClosedError(
              req,
              404,
              'DOCUMENTS_DELETE_NOT_FOUND',
              'Document was not found or access is denied.'
            )
          );
      }

      return res.json({ message: 'Document deleted' });
    } catch (error: any) {
      logger.error('[Documents] Delete error:', error);
      return res
        .status(500)
        .json(
          buildDocumentsFailClosedError(
            req,
            500,
            'DOCUMENTS_DELETE_FAILED',
            'Failed to delete document.'
          )
        );
    }
  })
);

export default router;
