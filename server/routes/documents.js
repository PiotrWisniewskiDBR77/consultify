const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const IngestionService = require('../services/ingestionService');
const authenticateToken = require('../middleware/authMiddleware');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Sanitize filename and append unique suffix
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_'));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf' ||
            file.mimetype === 'text/plain' ||
            file.mimetype === 'text/markdown' ||
            file.mimetype === 'application/json') {
            cb(null, true);
        } else {
            cb(new Error('Unsupported file type'), false);
        }
    }
});

// POST /documents/upload
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Get Org ID from authenticated user
        const { organization_id } = req.user;
        if (!organization_id) {
            // In some flows user might not have org yet? assume strict for now
            // Or allow personal doc? Let's assume strict org context.
        }

        console.log(`[Document] Upload received: ${req.file.originalname} for Org: ${organization_id}`);

        const result = await IngestionService.processFile(req.file, organization_id || 'personal');

        res.status(201).json({
            message: 'Document uploaded and processed successfully',
            document: result
        });

    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

module.exports = router;
