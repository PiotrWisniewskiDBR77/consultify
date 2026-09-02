// @ts-nocheck
/**
 * Studio Routes
 *
 * REST API for Consultify Studio visual workspace
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { studioService } from '../services/StudioService.js';
import logger from '../utils/Logger.js';

const router = Router();

/**
 * GET /api/studio/documents
 * List all documents for the user's organization
 */
router.get('/documents', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId || 'default';

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const documents = await studioService.getDocuments(organizationId, userId);
    res.json(documents);
  } catch (error: any) {
    logger.error('[Studio] GET /documents error:', error);
    res.status(500).json({ error: 'Failed to get documents' });
  }
});

/**
 * GET /api/studio/documents/:id
 * Get a single document by ID
 */
router.get('/documents/:id', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId || 'default';
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const document = await studioService.getDocument(id, userId, organizationId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(document);
  } catch (error: any) {
    logger.error('[Studio] GET /documents/:id error:', error);
    res.status(500).json({ error: 'Failed to get document' });
  }
});

/**
 * POST /api/studio/documents
 * Create a new document
 */
router.post('/documents', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId || 'default';

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      name,
      description,
      type,
      nodes,
      edges,
      linkedTaskId,
      linkedProjectId,
      linkedInitiativeId,
    } = req.body;

    const document = await studioService.createDocument(organizationId, userId, {
      name,
      description,
      type,
      nodes,
      edges,
      linkedTaskId,
      linkedProjectId,
      linkedInitiativeId,
    });

    res.status(201).json(document);
  } catch (error: any) {
    logger.error('[Studio] POST /documents error:', error);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

/**
 * PUT /api/studio/documents/:id
 * Update a document
 */
router.put('/documents/:id', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId || 'default';
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      name,
      description,
      type,
      nodes,
      edges,
      viewport,
      linkedTaskId,
      linkedProjectId,
      linkedInitiativeId,
      isPublic,
      tags,
      createSnapshot,
      snapshotReason,
    } = req.body;

    const document = await studioService.updateDocument(id, userId, organizationId, {
      name,
      description,
      type,
      nodes,
      edges,
      viewport,
      linkedTaskId,
      linkedProjectId,
      linkedInitiativeId,
      isPublic,
      tags,
      createSnapshot,
      snapshotReason,
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(document);
  } catch (error: any) {
    logger.error('[Studio] PUT /documents/:id error:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

/**
 * DELETE /api/studio/documents/:id
 * Delete a document
 */
router.delete('/documents/:id', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId || 'default';
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const deleted = await studioService.deleteDocument(id, userId, organizationId);

    if (!deleted) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ success: true });
  } catch (error: any) {
    logger.error('[Studio] DELETE /documents/:id error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

/**
 * GET /api/studio/documents/:id/snapshots
 * Get all snapshots for a document
 */
router.get('/documents/:id/snapshots', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId || 'default';
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const snapshots = await studioService.getSnapshots(id, userId, organizationId);
    res.json(snapshots);
  } catch (error: any) {
    logger.error('[Studio] GET /documents/:id/snapshots error:', error);
    res.status(500).json({ error: 'Failed to get snapshots' });
  }
});

/**
 * POST /api/studio/documents/:id/snapshots
 * Create a snapshot of a document
 */
router.post('/documents/:id/snapshots', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId || 'default';
    const { id } = req.params;
    const { reason } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const snapshotId = await studioService.createSnapshot(
      id,
      userId,
      organizationId,
      reason || 'manual'
    );
    res.status(201).json({ id: snapshotId });
  } catch (error: any) {
    logger.error('[Studio] POST /documents/:id/snapshots error:', error);
    res.status(500).json({ error: 'Failed to create snapshot' });
  }
});

/**
 * POST /api/studio/snapshots/:snapshotId/restore
 * Restore a document from a snapshot
 */
router.post(
  '/snapshots/:snapshotId/restore',
  verifyToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId || 'default';
      const { snapshotId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const document = await studioService.restoreSnapshot(snapshotId, userId, organizationId);

      if (!document) {
        return res.status(404).json({ error: 'Snapshot not found' });
      }

      res.json(document);
    } catch (error: any) {
      logger.error('[Studio] POST /snapshots/:snapshotId/restore error:', error);
      res.status(500).json({ error: 'Failed to restore snapshot' });
    }
  }
);

export default router;
