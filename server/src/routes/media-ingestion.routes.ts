/**
 * media-ingestion Routes
 */
import { Router } from 'express';
import logger from '../utils/Logger.js';
import mediaIngestionService from '../services/ai/mediaIngestionService.js';

const router = Router();

/**
 * GET /api/media-ingestion/supported-types
 */
router.get('/supported-types', async (req, res) => {
    try {
        const supportedTypes = await mediaIngestionService.getSupportedTypes();
        res.json({
            success: true,
            supportedTypes
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
        const capabilities = await mediaIngestionService.getCapabilities();
        res.json({
            success: true,
            capabilities
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
        const result = await mediaIngestionService.validateMedia(filename, mimeType);
        res.json(result);
    } catch (error) {
        logger.error('Error validating media:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
