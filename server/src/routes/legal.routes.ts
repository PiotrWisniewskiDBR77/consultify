/**
 * Legal Routes
 * API endpoints for legal documents (TOS, Privacy Policy, etc.)
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';

import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();

const SUPPORTED_DOCUMENTS: Record<string, { title: string; envKey: string }> = {
  TOS: { title: 'Terms of Service', envKey: 'LEGAL_TOS_CONTENT' },
  PRIVACY: { title: 'Privacy Policy', envKey: 'LEGAL_PRIVACY_CONTENT' },
  COOKIES: { title: 'Cookie Policy', envKey: 'LEGAL_COOKIES_CONTENT' },
  DPA: { title: 'Data Processing Agreement', envKey: 'LEGAL_DPA_CONTENT' },
};

function isMissingTableError(error: unknown): boolean {
  const message = (error as any)?.message;
  if (typeof message !== 'string') return false;
  return (
    message.includes('no such table') ||
    message.includes('does not exist') ||
    message.includes('relation') ||
    message.includes('Database not initialized')
  );
}

function configuredFromEnv(upperType: string): { title: string; content: string } | null {
  const doc = SUPPORTED_DOCUMENTS[upperType];
  if (!doc) return null;
  const content = process.env[doc.envKey];
  if (!content || !content.trim()) return null;
  const title = process.env[`LEGAL_${upperType}_TITLE`] || doc.title;
  return { title, content };
}

/**
 * GET /api/legal/document/:type
 * Get a legal document by type (TOS, PRIVACY, COOKIES, DPA)
 */
router.get(
  '/document/:type',
  asyncHandler(async (req, res: Response) => {
    const { type } = req.params;
    const upperType = type.toUpperCase();

    try {
      if (!SUPPORTED_DOCUMENTS[upperType]) {
        return res.status(404).json({ error: 'Document type not found' });
      }

      // Try to fetch from database first (no fallback).
      const doc = await dbGet<any>(
        `SELECT * FROM legal_documents WHERE type = ? ORDER BY version DESC LIMIT 1`,
        [upperType],
        { fallback: false }
      );

      if (doc?.content) {
        return res.json({
          success: true,
          data: {
            type: upperType,
            title: doc.title || SUPPORTED_DOCUMENTS[upperType].title,
            content: doc.content,
            version: doc.version || null,
            effectiveDate: doc.effective_date || null,
          },
        });
      }

      // Fallback to explicit env-configured content.
      const envDoc = configuredFromEnv(upperType);
      if (envDoc) {
        return res.json({
          success: true,
          data: {
            type: upperType,
            title: envDoc.title,
            content: envDoc.content,
            version: process.env[`LEGAL_${upperType}_VERSION`] || 'env',
            effectiveDate: process.env[`LEGAL_${upperType}_EFFECTIVE_DATE`] || null,
          },
        });
      }

      return res.status(503).json({
        error: 'Legal document not configured',
        code: 'LEGAL_NOT_CONFIGURED',
        type: upperType,
      });
    } catch (error: any) {
      logger.error('[Legal] Error fetching document:', error);
      if (isMissingTableError(error)) {
        const envDoc = configuredFromEnv(upperType);
        if (envDoc) {
          return res.json({
            success: true,
            data: {
              type: upperType,
              title: envDoc.title,
              content: envDoc.content,
              version: process.env[`LEGAL_${upperType}_VERSION`] || 'env',
              effectiveDate: process.env[`LEGAL_${upperType}_EFFECTIVE_DATE`] || null,
            },
          });
        }
        return res.status(503).json({
          error: 'Legal documents storage not available',
          code: 'LEGAL_STORAGE_UNAVAILABLE',
        });
      }
      return res.status(500).json({ error: 'Failed to fetch document' });
    }
  })
);

/**
 * GET /api/legal/documents
 * List all available legal documents
 */
router.get(
  '/documents',
  asyncHandler(async (_req, res: Response) => {
    const types = Object.keys(SUPPORTED_DOCUMENTS);
    const configuredTypes = new Set<string>();

    try {
      const rows = await dbAll<{ type: string }>(
        `SELECT DISTINCT type FROM legal_documents WHERE type IN (${types.map(() => '?').join(',')})`,
        types,
        { fallback: false }
      );
      for (const row of rows) configuredTypes.add((row.type || '').toUpperCase());
    } catch (error: unknown) {
      if (!isMissingTableError(error)) {
        logger.error('[Legal] Error listing documents:', error);
      }
    }

    const documents = types.map((type) => {
      const base = SUPPORTED_DOCUMENTS[type];
      const envConfigured = Boolean(configuredFromEnv(type));
      const dbConfigured = configuredTypes.has(type);
      return {
        type,
        title: process.env[`LEGAL_${type}_TITLE`] || base.title,
        configured: envConfigured || dbConfigured,
      };
    });

    return res.json({
      success: true,
      data: documents,
    });
  })
);

/**
 * GET /api/legal/active
 * List active legal documents
 */
router.get(
  '/active',
  asyncHandler(async (_req, res: Response) => {
    const types = Object.keys(SUPPORTED_DOCUMENTS);
    const documents: Array<{
      type: string;
      title: string;
      version: string | null;
      isActive: boolean;
      effectiveDate: string | null;
    }> = [];

    for (const type of types) {
      try {
        const doc = await dbGet<any>(
          `SELECT * FROM legal_documents WHERE type = ? ORDER BY version DESC LIMIT 1`,
          [type],
          { fallback: false }
        );
        if (doc?.content) {
          documents.push({
            type,
            title: doc.title || SUPPORTED_DOCUMENTS[type].title,
            version: doc.version || null,
            isActive: true,
            effectiveDate: doc.effective_date || null,
          });
          continue;
        }
      } catch (error: unknown) {
        if (!isMissingTableError(error)) {
          logger.error('[Legal] Error fetching active document:', { type, error });
        }
      }

      const envDoc = configuredFromEnv(type);
      if (envDoc) {
        documents.push({
          type,
          title: envDoc.title,
          version: process.env[`LEGAL_${type}_VERSION`] || 'env',
          isActive: true,
          effectiveDate: process.env[`LEGAL_${type}_EFFECTIVE_DATE`] || null,
        });
      }
    }

    if (documents.length === 0) {
      return res.status(503).json({
        error: 'No active legal documents configured',
        code: 'LEGAL_NOT_CONFIGURED',
      });
    }

    return res.json({
      success: true,
      data: documents,
    });
  })
);

/**
 * GET /api/legal/pending
 * Check pending legal document acceptances for user
 */
router.get(
  '/pending',
  asyncHandler(async (_req, res: Response) => {
    return res.status(503).json({
      error: 'Legal acceptance tracking not configured',
      code: 'LEGAL_ACCEPTANCE_UNAVAILABLE',
    });
  })
);

export default router;
