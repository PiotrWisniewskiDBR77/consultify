/**
 * Legal Routes
 * T093: Legal Agreements — API endpoints for legal documents and acceptances
 *
 * Endpoints:
 *   GET  /api/legal/active          — list active documents (public)
 *   GET  /api/legal/active/:docType — full document + metadata (public)
 *   GET  /api/legal/my-acceptances  — user's acceptance history (auth)
 *   GET  /api/legal/pending         — required/pending docs for user (auth)
 *   POST /api/legal/accept          — record acceptance (auth)
 *   GET  /api/legal/document/:type  — legacy endpoint (public)
 *   GET  /api/legal/documents       — legacy list endpoint (public)
 */

import { Response, Router } from 'express';

import { type AuthRequest, optionalAuth, verifyToken } from '../middleware/auth.middleware.js';
import legalService from '../services/legalService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();

// ==========================================
// PUBLIC ENDPOINTS
// ==========================================

/**
 * GET /api/legal/active
 * List all active legal documents (one per docType)
 */
router.get(
  '/active',
  asyncHandler(async (_req, res: Response) => {
    const documents = await legalService.getActiveDocuments();

    if (documents.length === 0) {
      return res.status(503).json({
        statusCode: 503,
        status: false,
        type: 'not_configured',
        message: 'Service temporarily unavailable due to missing configuration',
      });
    }

    return res.json({
      success: true,
      data: documents,
    });
  })
);

/**
 * GET /api/legal/active/:docType
 * Get full document content + metadata by docType
 */
router.get(
  '/active/:docType',
  asyncHandler(async (req, res: Response) => {
    const { docType } = req.params;
    const doc = await legalService.getActiveDocumentByType(docType);

    if (!doc) {
      return res.status(404).json({
        error: 'Document not found or not active',
        code: 'LEGAL_DOC_NOT_FOUND',
        docType: docType.toUpperCase(),
      });
    }

    return res.json({
      success: true,
      ...doc,
    });
  })
);

// ==========================================
// AUTHENTICATED ENDPOINTS
// ==========================================

/**
 * GET /api/legal/my-acceptances
 * List all acceptances for the authenticated user
 */
router.get(
  '/my-acceptances',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const acceptances = await legalService.getUserAcceptances(userId);

    return res.json({
      success: true,
      data: acceptances,
    });
  })
);

/**
 * GET /api/legal/pending
 * Get required/pending documents for the authenticated user
 */
router.get(
  '/pending',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const organizationId = req.organizationId || req.user?.organizationId;
    const userRole = req.userRole || req.user?.role;

    const pending = await legalService.getPendingDocuments(userId, organizationId, userRole);

    return res.json({
      success: true,
      ...pending,
    });
  })
);

/**
 * POST /api/legal/accept
 * Record acceptance of one or more documents
 * Body: { docTypes: string[], scope: 'USER' | 'ORG_ADMIN' }
 */
router.post(
  '/accept',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { docTypes, scope = 'USER' } = req.body;

    if (!docTypes || !Array.isArray(docTypes) || docTypes.length === 0) {
      return res.status(400).json({
        error: 'docTypes array is required',
        code: 'INVALID_REQUEST',
      });
    }

    if (!['USER', 'ORG_ADMIN'].includes(scope)) {
      return res.status(400).json({
        error: 'scope must be USER or ORG_ADMIN',
        code: 'INVALID_SCOPE',
      });
    }

    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      '';
    const userAgent = (req.headers['user-agent'] as string) || '';
    const organizationId = req.organizationId || req.user?.organizationId;

    const result = await legalService.acceptDocuments(
      userId,
      docTypes,
      scope as 'USER' | 'ORG_ADMIN',
      ipAddress,
      userAgent,
      organizationId
    );

    if (result.errors.length > 0 && result.accepted.length === 0) {
      return res.status(400).json({
        success: false,
        errors: result.errors,
      });
    }

    return res.json({
      success: true,
      accepted: result.accepted,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  })
);

// ==========================================
// LEGACY ENDPOINTS (backward compatibility)
// ==========================================

/**
 * GET /api/legal/document/:type
 * Legacy: Get a legal document by type
 */
router.get(
  '/document/:type',
  asyncHandler(async (req, res: Response) => {
    const { type } = req.params;
    const doc = await legalService.getActiveDocumentByType(type);

    if (!doc) {
      return res.status(404).json({
        error: 'Legal document not found',
        code: 'LEGAL_DOC_NOT_FOUND',
        type: type.toUpperCase(),
      });
    }

    return res.json({
      success: true,
      data: {
        type: doc.docType,
        title: doc.title,
        content: doc.contentMd,
        version: doc.version,
        effectiveDate: doc.effectiveFrom,
      },
      document: {
        id: doc.id,
        doc_type: doc.docType,
        version: doc.version,
        title: doc.title,
        content_md: doc.contentMd,
        effective_from: doc.effectiveFrom || '',
        created_at: doc.createdAt || '',
      },
    });
  })
);

/**
 * GET /api/legal/documents
 * Legacy: List all available legal documents
 */
router.get(
  '/documents',
  asyncHandler(async (_req, res: Response) => {
    const documents = await legalService.getActiveDocuments();

    return res.json({
      success: true,
      data: documents.map((d) => ({
        type: d.docType,
        title: d.title,
        configured: true,
      })),
    });
  })
);

export default router;
