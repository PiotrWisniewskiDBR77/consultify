// @ts-nocheck
/**
 * media-ingestion Routes
 */
import { Router } from 'express';

import mediaIngestionService from '../services/ai/mediaIngestionService.js';
import logger from '../utils/Logger.js';

const router = Router();

/**
 * GET /api/media-ingestion/supported-types
 */
router.get('/supported-types', async (req, res) => {
  try {
    if (!mediaIngestionService?.getSupportedTypes) {
      return res.json({
        success: true,
        supportedTypes: [],
        degraded: true,
      });
    }
    const supportedTypes = await mediaIngestionService.getSupportedTypes();
    res.json({
      success: true,
      supportedTypes,
    });
  } catch (error) {
    logger.error('Error fetching supported types:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/media-ingestion/capabilities
 */
router.get('/capabilities', async (req, res) => {
  try {
    if (!mediaIngestionService?.getCapabilities) {
      return res.json({
        success: true,
        capabilities: {},
        degraded: true,
      });
    }
    const capabilities = await mediaIngestionService.getCapabilities();
    res.json({
      success: true,
      capabilities,
    });
  } catch (error) {
    logger.error('Error fetching capabilities:', error);
    res.status(500).json({ error: 'Internal server error' });
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
    if (!mediaIngestionService?.validateMedia) {
      return res.json({
        success: false,
        error: 'Media ingestion service unavailable',
        degraded: true,
      });
    }
    const result = await mediaIngestionService.validateMedia(filename, mimeType);
    res.json(result);
  } catch (error) {
    logger.error('Error validating media:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
