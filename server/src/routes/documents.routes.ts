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
import contextDocumentService from '../services/organizationContext/ContextDocumentService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

// Apply rate limiting
const router = Router();

function resolveDocumentsCorrelationId(req: AuthRequest): string | null {
  return (req as any).correlationId || req.get('X-Correlation-ID') || null;
}

function buildDocumentsFailClosedError(
  req: AuthRequest,
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

function getRequestUserRole(req: AuthRequest): string | null {
  return (
    req.userRole ||
    (req.user as any)?.userRole ||
    (req.user as any)?.role ||
    (req.user as any)?.platformRole ||
    null
  );
}

const MAX_UPLOAD_BYTES = Math.max(
  1024 * 1024,
  Math.min(Number(process.env.ORG_CONTEXT_MAX_UPLOAD_BYTES || 100 * 1024 * 1024), 500 * 1024 * 1024)
);

const upload = multer({
  // Avoid runtime filesystem writes when the feature is unavailable.
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/json',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/x-wav',
      'audio/m4a',
      'audio/x-m4a',
      'audio/webm',
      'audio/ogg',
    ];
    if (
      allowedTypes.includes(file.mimetype) ||
      file.mimetype.startsWith('text/') ||
      file.mimetype.startsWith('audio/') ||
      file.mimetype.startsWith('image/')
    ) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

/**
 * GET /api/documents/project/:projectId
 * List project documents
 */
router.get(
  '/project/:projectId',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
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
      const { projectId } = req.params;
      const documents = await contextDocumentService.listAccessibleDocuments({
        organizationId,
        userId,
        scope: 'project',
        projectId,
      });
      return res.json(documents);
    } catch (error: any) {
      logger.error('[Documents] Error fetching project documents:', {
        error,
        correlationId: resolveDocumentsCorrelationId(req),
      });
      return res
        .status(500)
        .json(
          buildDocumentsFailClosedError(
            req,
            500,
            'DOCUMENTS_PROJECT_LIST_FAILED',
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
    try {
      const userId = req.user?.id;
      const organizationId = (req.user as any)?.organization_id || req.user?.organizationId;
      if (!userId || !organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const documents = await contextDocumentService.listAccessibleDocuments({
        organizationId,
        userId,
        scope: 'user',
      });
      return res.json(documents);
    } catch (error: any) {
      logger.error('[Documents] Error fetching user documents:', {
        error,
        correlationId: resolveDocumentsCorrelationId(req),
      });
      return res
        .status(500)
        .json(
          buildDocumentsFailClosedError(
            req,
            500,
            'DOCUMENTS_USER_LIST_FAILED',
            'Failed to load your documents.'
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
    try {
      const userId = req.user?.id;
      const organizationId = (req.user as any)?.organization_id || req.user?.organizationId;
      if (!userId || !organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { projectId } = req.query;
      const documents = await contextDocumentService.listAccessibleDocuments({
        organizationId,
        userId,
        scope: 'all',
        projectId: (projectId as string | undefined) || undefined,
      });
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
    try {
      const userId = req.user?.id;
      const organizationId = (req.user as any)?.organization_id || req.user?.organizationId;
      if (!userId || !organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { projectId } = req.query;
      const documents = await contextDocumentService.listAccessibleDocuments({
        organizationId,
        userId,
        scope: 'all',
        projectId: (projectId as string | undefined) || undefined,
      });
      return res.json(documents);
    } catch (error: any) {
      logger.error('[Documents] Error fetching documents:', {
        error,
        correlationId: resolveDocumentsCorrelationId(req),
      });
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
    try {
      const userId = req.user?.id;
      const organizationId = (req.user as any)?.organization_id || req.user?.organizationId;
      if (!userId || !organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const document = await contextDocumentService.getDocumentForAccess({
        documentId: req.params.id,
        organizationId,
        userId,
      });
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      return res.json(document);
    } catch (error: any) {
      logger.error('[Documents] Error fetching document:', {
        error,
        correlationId: resolveDocumentsCorrelationId(req),
      });
      return res
        .status(500)
        .json(
          buildDocumentsFailClosedError(
            req,
            500,
            'DOCUMENTS_GET_FAILED',
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
    try {
      const userId = req.user?.id;
      const organizationId = (req.user as any)?.organization_id || req.user?.organizationId;
      if (!userId || !organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const document = await contextDocumentService.getDocumentForAccess({
        documentId: req.params.id,
        organizationId,
        userId,
      });
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      const filePath = (document as any).filepath || (document as any).filePath;
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found on server' });
      }

      return res.download(filePath, document.originalName || document.filename);
    } catch (error: any) {
      logger.error('[Documents] Error downloading document:', {
        error,
        correlationId: resolveDocumentsCorrelationId(req),
      });
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
    try {
      const uploadedFile = req.file as any;
      if (
        !uploadedFile ||
        (!uploadedFile.originalname &&
          !uploadedFile.originalName &&
          !uploadedFile.mimetype &&
          typeof uploadedFile.size !== 'number' &&
          !uploadedFile.buffer)
      ) {
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

      const { scope = 'user', projectId } = req.body || {};

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
      if (scope === 'project') {
        const canAccessProject = await contextDocumentService.canAccessProject({
          organizationId,
          userId: ownerId,
          projectId: String(projectId),
          userRole: getRequestUserRole(req),
          isSuperAdmin: Boolean((req.user as any)?.isSuperAdmin),
        });
        if (!canAccessProject) {
          return res.status(403).json({
            error: 'Project not found or access denied',
            code: 'PROJECT_CONTEXT_ACCESS_DENIED',
          });
        }
      }

      logger.info(
        `[Documents] Upload: ${uploadedFile.originalname}, scope: ${scope}, owner: ${ownerId}`
      );

      const document = await contextDocumentService.uploadAndIngest({
        file: uploadedFile,
        organizationId,
        projectId: scope === 'project' ? String(projectId) : null,
        ownerId,
        scope: scope === 'project' ? 'project' : 'user',
        sourceUpload: 'documents.library',
      });

      return res.status(201).json({
        message: 'Document uploaded successfully',
        document,
      });
    } catch (error: any) {
      logger.error('[Documents] Upload error:', error);
      if (
        error?.code === 'CONTEXT_STORAGE_QUOTA_EXCEEDED' ||
        error?.code === 'PROJECT_STORAGE_QUOTA_EXCEEDED'
      ) {
        return res.status(429).json({
          error: error.message || 'Storage quota exceeded',
          code: error.code,
          document: error.document || null,
          quota: error.quota || null,
        });
      }
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
 * POST /api/documents/:id/processing-attention/ack
 * Explicitly acknowledge a visible processing attention state.
 */
router.post(
  '/:id/processing-attention/ack',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const organizationId = (req.user as any)?.organization_id || req.user?.organizationId;
      if (!userId || !organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const result = await contextDocumentService.acknowledgeProcessingAttention({
        documentId: req.params.id,
        organizationId,
        userId,
      });

      if (result.reason === 'document_not_found') {
        return res.status(404).json({ error: 'Document not found' });
      }
      if (result.reason === 'attention_not_required') {
        return res.status(409).json({
          code: 'PROCESSING_ATTENTION_NOT_REQUIRED',
          data: result,
        });
      }

      return res.json({
        message: 'Processing attention acknowledged',
        data: result,
      });
    } catch (error: any) {
      logger.error('[Documents] Processing attention acknowledgement error:', {
        error,
        correlationId: resolveDocumentsCorrelationId(req),
      });
      return res
        .status(500)
        .json(
          buildDocumentsFailClosedError(
            req,
            500,
            'DOCUMENTS_ACK_FAILED',
            'Failed to acknowledge processing attention.'
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
    try {
      const { id: documentId } = req.params;
      const { projectId } = req.body;
      const userId = req.user?.id;
      const organizationId = (req.user as any)?.organization_id || req.user?.organizationId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      if (!organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!projectId) {
        return res.status(400).json({ error: 'Project ID required' });
      }
      const canAccessProject = await contextDocumentService.canAccessProject({
        organizationId,
        userId,
        projectId: String(projectId),
        userRole: getRequestUserRole(req),
        isSuperAdmin: Boolean((req.user as any)?.isSuperAdmin),
      });
      if (!canAccessProject) {
        return res.status(403).json({
          error: 'Project not found or access denied',
          code: 'PROJECT_CONTEXT_ACCESS_DENIED',
        });
      }

      const document = await contextDocumentService.moveToProject({
        documentId,
        organizationId,
        userId,
        projectId: String(projectId),
      });
      if (!document) {
        return res.status(404).json({ error: 'Document not found or access denied' });
      }
      return res.json({
        message: 'Document moved to project',
        document,
      });
    } catch (error: any) {
      logger.error('[Documents] Move error:', {
        error,
        correlationId: resolveDocumentsCorrelationId(req),
      });
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
    try {
      const userId = req.user?.id;
      const organizationId = (req.user as any)?.organization_id || req.user?.organizationId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      if (!organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const result = await contextDocumentService.softDelete({
        documentId: req.params.id,
        organizationId,
        userId,
      });

      if (!result) {
        return res.status(404).json({ error: 'Document not found or access denied' });
      }

      return res.json({ message: 'Document deleted' });
    } catch (error: any) {
      logger.error('[Documents] Delete error:', {
        error,
        correlationId: resolveDocumentsCorrelationId(req),
      });
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
