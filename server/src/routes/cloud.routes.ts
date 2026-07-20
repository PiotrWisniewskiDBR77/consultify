/**
 * Cloud Data Routes
 *
 * API endpoints for managing cloud storage connections and file imports.
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import logger from '../utils/Logger.js';

const router = Router();
const CLOUD_SOURCES_CACHE_TTL_MS = Number(process.env.CLOUD_SOURCES_CACHE_TTL_MS || 30_000);
const cloudSourcesCache = new Map<
  string,
  { expiresAt: number; payload: { sources: Array<Record<string, unknown>> } }
>();

const readCachedSources = (organizationId: string) => {
  const cached = cloudSourcesCache.get(organizationId);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    cloudSourcesCache.delete(organizationId);
    return null;
  }
  return cached.payload;
};

const writeCachedSources = (
  organizationId: string,
  payload: { sources: Array<Record<string, unknown>> }
) => {
  cloudSourcesCache.set(organizationId, {
    payload,
    expiresAt: Date.now() + CLOUD_SOURCES_CACHE_TTL_MS,
  });
};

const invalidateCachedSources = (organizationId: string) => {
  cloudSourcesCache.delete(organizationId);
};

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

    const cached = readCachedSources(organizationId);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    const { listCloudSources } = await import('../services/cloudDataService.js');
    const sources = await listCloudSources(organizationId);

    // Strip sensitive tokens from response
    const safeSources = sources.map((s) => ({
      ...s,
      accessToken: undefined,
      refreshToken: undefined,
    }));

    const payload = { sources: safeSources };
    writeCachedSources(organizationId, payload);
    return res.json({ ...payload, cached: false });
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

    invalidateCachedSources(organizationId);

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

    invalidateCachedSources(organizationId);

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

/**
 * POST /api/cloud/import/:id/process
 * Trigger background processing of an import job (download + extract)
 */
router.post('/import/:id/process', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization context required' });
    }

    const { processImportJob } = await import('../services/cloudDataService.js');
    processImportJob(req.params.id, organizationId).catch((err: Error) => {
      logger.error(`[CloudRoutes] Background import failed: ${err.message}`);
    });

    return res.json({ success: true, message: 'Import processing started' });
  } catch (err: any) {
    logger.error('[CloudRoutes] Failed to process import:', err?.message);
    return res.status(500).json({ error: 'Failed to process import' });
  }
});

/**
 * POST /api/cloud/sources/:id/sync
 * Trigger a full file listing sync for a cloud source (indexes files into sync mappings)
 */
router.post('/sources/:id/sync', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization context required' });
    }

    invalidateCachedSources(organizationId);

    const { listCloudFiles, getCloudSource } = await import('../services/cloudDataService.js');
    const source = await getCloudSource(req.params.id, organizationId);
    if (!source) return res.status(404).json({ error: 'Cloud source not found' });

    const files = await listCloudFiles(req.params.id, organizationId);

    const { run: dbRun } = await import('../utils/DbPromise.js');
    let synced = 0;
    for (const file of files) {
      await dbRun(
        `INSERT INTO integration_sync_mappings (id, integration_id, external_id, external_type, local_type, local_id, metadata, last_sync_at)
         VALUES (gen_random_uuid()::TEXT, ?, ?, ?, 'file', ?, ?::JSONB, NOW())
         ON CONFLICT (integration_id, external_type, external_id) DO UPDATE SET metadata = EXCLUDED.metadata, last_sync_at = NOW()`,
        [
          req.params.id,
          file.id,
          `${source.provider}_file`,
          file.id,
          JSON.stringify({
            name: file.name,
            mimeType: file.mimeType,
            size: file.size,
            isFolder: file.isFolder,
          }),
        ]
      );
      synced++;
    }

    const { run: dbRunUpdate } = await import('../utils/DbPromise.js');
    await dbRunUpdate(
      `UPDATE cloud_sources SET last_sync_at = NOW(), updated_at = NOW() WHERE id = ? AND organization_id = ?`,
      [req.params.id, organizationId]
    );

    return res.json({ success: true, provider: source.provider, filesSynced: synced });
  } catch (err: any) {
    logger.error('[CloudRoutes] Failed to sync cloud source:', err?.message);
    return res.status(500).json({ error: 'Failed to sync cloud source' });
  }
});

/**
 * GET /api/cloud/providers
 * List supported cloud storage providers
 */
router.get('/providers', verifyToken, async (req: AuthRequest, res: Response) => {
  // Real connection state: a provider is "connected" when the org has at least
  // one configured cloud source for it. Previously this endpoint returned a
  // STATIC list with underscore ids (`google_drive`) and no `connected` flag,
  // so the in-chat cloud rows (which filter on hyphenated id + connected) never
  // rendered even after the user linked a provider. (Composer audit A4.)
  const organizationId = req.organizationId;
  const connected = new Set<string>();
  try {
    if (organizationId) {
      const { listCloudSources } = await import('../services/cloudDataService.js');
      const sources = await listCloudSources(organizationId);
      for (const s of sources || []) {
        const p = String((s as any)?.provider || '')
          .toLowerCase()
          .replace(/_/g, '-');
        if (p) connected.add(p);
      }
    }
  } catch (err: any) {
    // Non-fatal — fall back to "nothing connected" rather than 500.
    logger.warn('[CloudRoutes] providers connection-state lookup failed:', err?.message);
  }
  const isConnected = (id: string) => connected.has(id) || connected.has(id.replace(/-/g, '_'));
  return res.json({
    providers: [
      {
        id: 'google-drive',
        name: 'Google Drive',
        authType: 'oauth2',
        capabilities: ['list', 'download', 'upload', 'search'],
        connected: isConnected('google-drive'),
      },
      {
        id: 'onedrive',
        name: 'OneDrive / SharePoint',
        authType: 'oauth2',
        capabilities: ['list', 'download', 'upload'],
        connected: isConnected('onedrive'),
      },
      {
        id: 'dropbox',
        name: 'Dropbox',
        authType: 'oauth2',
        capabilities: ['list', 'download', 'upload'],
        connected: isConnected('dropbox'),
      },
    ],
  });
});

export default router;
