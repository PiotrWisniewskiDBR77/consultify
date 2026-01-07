/**
 * Legal Routes
 * API endpoints for legal documents (TOS, Privacy Policy, etc.)
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';

import { asyncHandler } from '../utils/asyncHandler.js';
import { get as dbGet } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();

// Default legal documents content
const DEFAULT_DOCUMENTS: Record<string, { title: string; content: string }> = {
    TOS: {
        title: 'Terms of Service',
        content: 'Terms of Service content placeholder. Please configure your TOS.',
    },
    PRIVACY: {
        title: 'Privacy Policy',
        content: 'Privacy Policy content placeholder. Please configure your privacy policy.',
    },
    COOKIES: {
        title: 'Cookie Policy',
        content: 'Cookie Policy content placeholder.',
    },
    DPA: {
        title: 'Data Processing Agreement',
        content: 'DPA content placeholder.',
    },
};

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
            // Try to fetch from database first
            const doc = await dbGet<any>(`SELECT * FROM legal_documents WHERE type = ? ORDER BY version DESC LIMIT 1`, [
                upperType,
            ]);

            if (doc) {
                return res.json({
                    success: true,
                    data: {
                        type: upperType,
                        title: doc.title || DEFAULT_DOCUMENTS[upperType]?.title || type,
                        content: doc.content,
                        version: doc.version,
                        effectiveDate: doc.effective_date,
                    },
                });
            }

            // Fall back to default
            const defaultDoc = DEFAULT_DOCUMENTS[upperType];
            if (defaultDoc) {
                return res.json({
                    success: true,
                    data: {
                        type: upperType,
                        title: defaultDoc.title,
                        content: defaultDoc.content,
                        version: '1.0',
                        effectiveDate: new Date().toISOString(),
                    },
                });
            }

            return res.status(404).json({ error: 'Document type not found' });
        } catch (error: any) {
            logger.error('[Legal] Error fetching document:', error);
            // Return default on error
            const defaultDoc = DEFAULT_DOCUMENTS[upperType];
            if (defaultDoc) {
                return res.json({
                    success: true,
                    data: {
                        type: upperType,
                        title: defaultDoc.title,
                        content: defaultDoc.content,
                        version: '1.0',
                    },
                });
            }
            return res.status(500).json({ error: 'Failed to fetch document' });
        }
    }),
);

/**
 * GET /api/legal/documents
 * List all available legal documents
 */
router.get(
    '/documents',
    asyncHandler(async (_req, res: Response) => {
        const documents = Object.entries(DEFAULT_DOCUMENTS).map(([type, doc]) => ({
            type,
            title: doc.title,
            available: true,
        }));

        return res.json({
            success: true,
            data: documents,
        });
    }),
);

/**
 * GET /api/legal/active
 * List active legal documents
 */
router.get(
    '/active',
    asyncHandler(async (_req, res: Response) => {
        const documents = Object.entries(DEFAULT_DOCUMENTS).map(([type, doc]) => ({
            type,
            title: doc.title,
            version: '1.0',
            isActive: true,
            effectiveDate: new Date().toISOString()
        }));

        return res.json({
            success: true,
            data: documents,
        });
    }),
);

/**
 * GET /api/legal/pending
 * Check pending legal document acceptances for user
 */
router.get(
    '/pending',
    asyncHandler(async (_req, res: Response) => {
        // For now, return empty pending list
        return res.json({
            success: true,
            pendingDocuments: [],
            allAccepted: true
        });
    }),
);

export default router;
