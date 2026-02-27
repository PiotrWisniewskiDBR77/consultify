// @ts-nocheck
/**
 * media-ingestion Routes
 */
import { Router } from 'express';

import logger from '../utils/Logger.js';

const router = Router();

async function getMediaIngestionService(): Promise<any | null> {
  try {
    const mod = await import('../services/ai/mediaIngestionService.js');
    const svc = (mod as any).default;
    // Some legacy wrappers export a Promise as default. Resolve it safely.
    if (svc && typeof svc === 'object' && typeof (svc as any).then === 'function') {
      return await (svc as Promise<any>);
    }
    if (svc && (svc as any).__unavailable__ === true) return null;
    return svc || null;
  } catch (err) {
    logger.warn('[media-ingestion] Service import failed:', (err as any)?.message || err);
    return null;
  }
}

/**
 * GET /api/media-ingestion/supported-types
 */
router.get('/supported-types', async (req, res) => {
  try {
    const mediaIngestionService = await getMediaIngestionService();
    if (!mediaIngestionService?.getSupportedTypes) {
      return res.status(503).json({
        statusCode: 503,
        status: false,
        type: 'not_configured',
        message: 'Service temporarily unavailable due to missing configuration',
      });
    }
    const supportedTypes = await mediaIngestionService.getSupportedTypes();
    res.json({
      success: true,
      supportedTypes,
    });
  } catch (error) {
    logger.error('Error fetching supported types:', error);
    res.status(503).json({
      statusCode: 503,
      status: false,
      type: 'not_configured',
      message: 'Service temporarily unavailable due to missing configuration',
    });
  }
});

/**
 * GET /api/media-ingestion/capabilities
 */
router.get('/capabilities', async (req, res) => {
  try {
    const mediaIngestionService = await getMediaIngestionService();
    if (!mediaIngestionService?.getCapabilities) {
      return res.status(503).json({
        statusCode: 503,
        status: false,
        type: 'not_configured',
        message: 'Service temporarily unavailable due to missing configuration',
      });
    }
    const capabilities = await mediaIngestionService.getCapabilities();
    res.json({
      success: true,
      capabilities,
    });
  } catch (error) {
    logger.error('Error fetching capabilities:', error);
    res.status(503).json({
      statusCode: 503,
      status: false,
      type: 'not_configured',
      message: 'Service temporarily unavailable due to missing configuration',
    });
  }
});

/**
 * POST /api/media-ingestion/validate
 */
router.post('/validate', async (req, res) => {
  try {
    const { filename, mimeType } = req.body;
    if (!filename || !mimeType) {
      return res.status(400).json({ error: 'filename and mimeType are required' });
    }
    const mediaIngestionService = await getMediaIngestionService();
    if (!mediaIngestionService?.validateMedia) {
      return res.status(503).json({
        statusCode: 503,
        status: false,
        type: 'not_configured',
        message: 'Service temporarily unavailable due to missing configuration',
      });
    }
    const result = await mediaIngestionService.validateMedia(filename, mimeType);
    res.json(result);
  } catch (error) {
    logger.error('Error validating media:', error);
    res.status(503).json({
      statusCode: 503,
      status: false,
      type: 'not_configured',
      message: 'Service temporarily unavailable due to missing configuration',
    });
  }
});

// ---------------------------------------------------------------------------
// Ingestion endpoints (used by UI). Not implemented yet → honest 503.
// ---------------------------------------------------------------------------

router.post('/ingest/batch', async (_req, res) => {
  return res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
  });
});

router.post('/ingest/youtube', async (_req, res) => {
  return res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
  });
});

router.post('/ingest/url', async (_req, res) => {
  return res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
  });
});

export default router;
