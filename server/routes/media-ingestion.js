/**
 * Media Ingestion API Routes
 * 
 * Unified API endpoints for ingesting various media types into the AI knowledge base.
 * Supports file uploads, YouTube URLs, and web URLs.
 * 
 * Part of the Multimodal Content Ingestion System
 * 
 * @version 1.0.0
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import mediaIngestionService from '../services/ai/mediaIngestionService.js';
import requireAuth from '../middleware/authMiddleware.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const UPLOAD_DIR = path.join(__dirname, '../../uploads/ingestion');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `${uniqueSuffix}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (mediaIngestionService.isSupported(file.originalname)) {
        cb(null, true);
    } else {
        cb(new Error(`Unsupported file type: ${ext}`), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB max
    }
});

/**
 * @route POST /api/media-ingestion/ingest
 * @desc Ingest content from file upload, URL, or YouTube
 * @access Private
 */
router.post('/ingest', requireAuth, upload.single('file'), async (req, res) => {
    let filePath = null;

    try {
        const body = req.body || {};
        const { url, youtube, language = 'pl', projectId } = body;
        const organizationId = req.user.organization_id;

        let input;
        let source;

        // Determine input type
        if (req.file) {
            // File upload
            input = req.file.path;
            filePath = req.file.path;
            source = 'upload';
        } else if (youtube) {
            // YouTube URL
            input = youtube;
            source = 'youtube';
        } else if (url) {
            // Web URL
            input = url;
            source = 'url';
        } else {
            return res.status(400).json({
                success: false,
                error: 'No input provided. Expected file, url, or youtube parameter.'
            });
        }

        // Process the input
        const result = await mediaIngestionService.ingest(input, {
            organizationId,
            projectId: projectId || null,
            language,
            source,
            filename: req.file?.originalname
        });

        // Clean up uploaded file after processing
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        res.json({
            success: true,
            message: 'Content ingested successfully',
            ...result
        });

    } catch (error) {
        console.error('[MediaIngestion API] Error:', error);

        // Clean up on error
        if (filePath && fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch (e) { }
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route POST /api/media-ingestion/ingest/batch
 * @desc Batch ingest multiple files
 * @access Private
 */
router.post('/ingest/batch', requireAuth, upload.array('files', 10), async (req, res) => {
    const filePaths = [];

    try {
        const { language = 'pl', projectId } = req.body;
        const organizationId = req.user.organization_id;

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No files provided'
            });
        }

        const results = [];
        const errors = [];

        for (const file of req.files) {
            filePaths.push(file.path);

            try {
                const result = await mediaIngestionService.ingest(file.path, {
                    organizationId,
                    projectId: projectId || null,
                    language,
                    source: 'upload',
                    filename: file.originalname
                });

                results.push({
                    filename: file.originalname,
                    ...result
                });

            } catch (error) {
                errors.push({
                    filename: file.originalname,
                    error: error.message
                });
            }
        }

        // Clean up all uploaded files
        for (const fp of filePaths) {
            if (fs.existsSync(fp)) {
                try { fs.unlinkSync(fp); } catch (e) { }
            }
        }

        res.json({
            success: true,
            message: `Processed ${results.length} of ${req.files.length} files`,
            results,
            errors
        });

    } catch (error) {
        console.error('[MediaIngestion API] Batch error:', error);

        // Clean up on error
        for (const fp of filePaths) {
            if (fs.existsSync(fp)) {
                try { fs.unlinkSync(fp); } catch (e) { }
            }
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route POST /api/media-ingestion/ingest/youtube
 * @desc Ingest content from YouTube video
 * @access Private
 */
router.post('/ingest/youtube', requireAuth, async (req, res) => {
    try {
        const { url, language = 'pl', projectId, timestamps = false } = req.body;
        const organizationId = req.user.organization_id;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'YouTube URL is required'
            });
        }

        if (!mediaIngestionService.isYouTubeUrl(url)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid YouTube URL'
            });
        }

        const result = await mediaIngestionService.ingest(url, {
            organizationId,
            projectId: projectId || null,
            language,
            source: 'youtube',
            includeTimestamps: timestamps
        });

        res.json({
            success: true,
            message: 'YouTube video processed successfully',
            ...result
        });

    } catch (error) {
        console.error('[MediaIngestion API] YouTube error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route POST /api/media-ingestion/ingest/url
 * @desc Ingest content from web URL
 * @access Private
 */
router.post('/ingest/url', requireAuth, async (req, res) => {
    try {
        const { url, projectId, includeLinks = false, renderJs = false } = req.body;
        const organizationId = req.user.organization_id;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL is required'
            });
        }

        if (!mediaIngestionService.isUrl(url)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid URL'
            });
        }

        const result = await mediaIngestionService.ingest(url, {
            organizationId,
            projectId: projectId || null,
            source: 'url',
            includeLinks,
            renderJs
        });

        res.json({
            success: true,
            message: 'URL processed successfully',
            ...result
        });

    } catch (error) {
        console.error('[MediaIngestion API] URL error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route GET /api/media-ingestion/supported-types
 * @desc Get list of supported media types
 * @access Public
 */
router.get('/supported-types', (req, res) => {
    const supportedTypes = mediaIngestionService.getSupportedTypes();
    const capabilities = mediaIngestionService.getCapabilities();

    res.json({
        success: true,
        supportedTypes,
        capabilities,
        maxFileSize: '100MB',
        maxFiles: 10
    });
});

/**
 * @route GET /api/media-ingestion/capabilities
 * @desc Get detailed processing capabilities
 * @access Public
 */
router.get('/capabilities', (req, res) => {
    res.json({
        success: true,
        capabilities: mediaIngestionService.getCapabilities()
    });
});

/**
 * @route POST /api/media-ingestion/preview
 * @desc Preview content extraction without storing
 * @access Private
 */
router.post('/preview', requireAuth, upload.single('file'), async (req, res) => {
    let filePath = null;

    try {
        const { url, youtube, language = 'pl' } = req.body;

        let result;

        if (req.file) {
            filePath = req.file.path;
            result = await mediaIngestionService.processFile(req.file.path, { language });
        } else if (youtube) {
            result = await mediaIngestionService.processYouTube(youtube, { language });
        } else if (url) {
            result = await mediaIngestionService.processUrl(url);
        } else {
            return res.status(400).json({
                success: false,
                error: 'No input provided'
            });
        }

        // Clean up
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Return preview (truncated text)
        res.json({
            success: true,
            preview: {
                text: result.text.substring(0, 2000) + (result.text.length > 2000 ? '...' : ''),
                fullLength: result.text.length,
                metadata: result.metadata
            }
        });

    } catch (error) {
        if (filePath && fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch (e) { }
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route POST /api/media-ingestion/validate
 * @desc Validate if a file or URL can be processed
 * @access Public
 */
router.post('/validate', (req, res) => {
    const { filename, url, youtube } = req.body;

    let input;
    let type;

    if (filename) {
        input = filename;
        type = 'file';
    } else if (youtube) {
        input = youtube;
        type = 'youtube';
    } else if (url) {
        input = url;
        type = 'url';
    } else {
        return res.status(400).json({
            success: false,
            valid: false,
            error: 'No input to validate'
        });
    }

    const isSupported = mediaIngestionService.isSupported(input);

    res.json({
        success: true,
        valid: isSupported,
        type,
        input: type === 'file' ? filename : input
    });
});

// Error handling for multer
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File too large. Maximum size is 100MB.'
            });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                error: 'Too many files. Maximum is 10 files.'
            });
        }
    }

    if (error.message.includes('Unsupported file type')) {
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }

    next(error);
});

export default router;

