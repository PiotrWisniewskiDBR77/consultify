/**
 * Cloud Data Routes
 *
 * API endpoints for managing cloud storage connections and file imports.
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import logger from '../utils/Logger.js';

const router = Router();

/**
 * GET /api/cloud/sources
 * List all cloud sources for the user's organization
 */
router.get('/sources', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization context required' });
    }

    const { listCloudSources } = await import('../services/cloudDataService.js');
    const sources = await listCloudSources(organizationId);

    // Strip sensitive tokens from response
    const safeSources = sources.map((s) => ({
      ...s,
      accessToken: undefined,
      refreshToken: undefined,
    }));

    return res.json({ sources: safeSources });
  } catch (err: any) {
    logger.error('[CloudRoutes] Failed to list sources:', err?.message);
    return res.status(500).json({ error: 'Failed to list cloud sources' });
  }
});

/**
 * POST /api/cloud/sources
 * Connect a new cloud source
 */
router.post('/sources', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.organizationId;
    const userId = req.userId;
    if (!organizationId || !userId) {
      return res.status(400).json({ error: 'Organization and user context required' });
    }

    const { provider, name, accessToken, refreshToken, rootFolderId, settings } = req.body;
    if (!provider || !name) {
      return res.status(400).json({ error: 'Provider and name are required' });
    }

    const { createCloudSource } = await import('../services/cloudDataService.js');
    const source = await createCloudSource({
      organizationId,
      userId,
      provider,
      name,
      accessToken,
      refreshToken,
      rootFolderId,
      settings,
    });

    return res.status(201).json({
      source: { ...source, accessToken: undefined, refreshToken: undefined },
    });
  } catch (err: any) {
    logger.error('[CloudRoutes] Failed to create source:', err?.message);
    return res.status(500).json({ error: 'Failed to create cloud source' });
  }
});

/**
 * DELETE /api/cloud/sources/:id
 * Disconnect a cloud source
 */
router.delete('/sources/:id', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization context required' });
    }

    const { deleteCloudSource } = await import('../services/cloudDataService.js');
    await deleteCloudSource(req.params.id, organizationId);

    return res.json({ success: true });
  } catch (err: any) {
    logger.error('[CloudRoutes] Failed to delete source:', err?.message);
    return res.status(500).json({ error: 'Failed to delete cloud source' });
  }
});

/**
 * GET /api/cloud/sources/:id/files
 * List files in a cloud source
 */
router.get('/sources/:id/files', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization context required' });
    }

    const folderId = req.query.folderId as string | undefined;
    const { listCloudFiles } = await import('../services/cloudDataService.js');
    const files = await listCloudFiles(req.params.id, organizationId, folderId);

    return res.json({ files });
  } catch (err: any) {
    logger.error('[CloudRoutes] Failed to list files:', err?.message);
    return res.status(500).json({ error: 'Failed to list cloud files' });
  }
});

/**
 * GET /api/cloud/sources/:id/files/:fileId/download
 * Download file bytes from a cloud source
 */
router.get(
  '/sources/:id/files/:fileId/download',
  verifyToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.organizationId;
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization context required' });
      }

      const { downloadCloudFile } = await import('../services/cloudDataService.js');
      const result = await downloadCloudFile(req.params.id, organizationId, req.params.fileId);

      res.setHeader('Content-Type', result.mimeType || 'application/octet-stream');
      const safeFileName = String(result.fileName || 'download.bin').replace(/"/g, '');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
      return res.send(result.content);
    } catch (err: any) {
      const message = String(err?.message || 'Failed to download cloud file');
      logger.error('[CloudRoutes] Failed to download file:', message);
      if (message.includes('not found')) {
        return res.status(404).json({ error: 'Cloud source or file not found' });
      }
      if (message.includes('not supported')) {
        return res.status(503).json({
          statusCode: 503,
          status: false,
          type: 'not_configured',
          message: 'Service temporarily unavailable due to missing configuration',
        });
      }
      return res.status(500).json({ error: 'Failed to download cloud file' });
    }
  }
);

/**
 * POST /api/cloud/sources/:id/upload
 * Upload a file to a cloud source.
 *
 * Body:
 *  - fileName: string (required)
 *  - mimeType: string (required)
 *  - contentBase64: string (required)  base64 of file bytes
 *  - folderId: string (optional) provider-specific folder/driveItem id
 */
router.post('/sources/:id/upload', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization context required' });
    }

    const fileName = String(req.body?.fileName || '').trim();
    const mimeType = String(req.body?.mimeType || '').trim();
    const contentBase64 = String(req.body?.contentBase64 || '').trim();
    const folderId = req.body?.folderId ? String(req.body.folderId).trim() : undefined;

    if (!fileName || !mimeType || !contentBase64) {
      return res.status(400).json({ error: 'fileName, mimeType, contentBase64 are required' });
    }

    const content = Buffer.from(contentBase64, 'base64');
    if (!content.length) return res.status(400).json({ error: 'Empty content' });

    const { uploadCloudFile } = await import('../services/cloudDataService.js');
    const result = await uploadCloudFile({
      sourceId: req.params.id,
      organizationId,
      fileName,
      mimeType,
      content,
      folderId,
    });

    return res.status(201).json({ file: result });
  } catch (err: any) {
    logger.error('[CloudRoutes] Failed to upload file:', err?.message);
    return res.status(500).json({ error: 'Failed to upload file' });
  }
});

/**
 * POST /api/cloud/import
 * Start a file import job from a cloud source
 */
router.post('/import', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.organizationId;
    const userId = req.userId;
    if (!organizationId || !userId) {
      return res.status(400).json({ error: 'Organization and user context required' });
    }

    const { cloudSourceId, filePath, fileName, fileType, fileSize } = req.body;
    if (!cloudSourceId || !filePath || !fileName) {
      return res.status(400).json({ error: 'cloudSourceId, filePath, and fileName are required' });
    }

    const { startImportJob } = await import('../services/cloudDataService.js');
    const job = await startImportJob({
      cloudSourceId,
      organizationId,
      userId,
      filePath,
      fileName,
      fileType,
      fileSize,
    });

    return res.status(201).json({ job });
  } catch (err: any) {
    logger.error('[CloudRoutes] Failed to start import:', err?.message);
    return res.status(500).json({ error: 'Failed to start import job' });
  }
});

/**
 * GET /api/cloud/import/:id
 * Check import job status
 */
router.get('/import/:id', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization context required' });
    }

    const { getImportJob } = await import('../services/cloudDataService.js');
    const job = await getImportJob(req.params.id, organizationId);

    if (!job) {
      return res.status(404).json({ error: 'Import job not found' });
    }

    return res.json({ job });
  } catch (err: any) {
    logger.error('[CloudRoutes] Failed to get import job:', err?.message);
    return res.status(500).json({ error: 'Failed to get import job status' });
  }
});

export default router;
