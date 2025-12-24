const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const DocumentService = require('../services/documentService');
const authenticateToken = require('../middleware/authMiddleware');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../uploads/documents');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer for document uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, uniqueSuffix + '-' + sanitizedName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'text/plain',
            'text/markdown',
            'application/json',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'image/png',
            'image/jpeg',
            'image/gif'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
        }
    }
});

// GET /documents/project/:projectId - List project documents
router.get('/project/:projectId', authenticateToken, async (req, res) => {
    try {
        const { projectId } = req.params;
        const documents = await DocumentService.getProjectDocuments(projectId);
        res.json(documents);
    } catch (error) {
        console.error('[Documents] Error fetching project documents:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /documents/user - List user's private documents
router.get('/user', authenticateToken, async (req, res) => {
    try {
        const { id: userId, organization_id: organizationId } = req.user;
        const documents = await DocumentService.getUserDocuments(userId, organizationId);
        res.json(documents);
    } catch (error) {
        console.error('[Documents] Error fetching user documents:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /documents/all - List all accessible documents (user's + project's if projectId provided)
router.get('/all', authenticateToken, async (req, res) => {
    try {
        const { id: userId, organization_id: organizationId } = req.user;
        const { projectId } = req.query;
        const documents = await DocumentService.getAccessibleDocuments(userId, organizationId, projectId);
        res.json(documents);
    } catch (error) {
        console.error('[Documents] Error fetching documents:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /documents/:id - Get single document
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const document = await DocumentService.getDocumentById(req.params.id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        res.json(document);
    } catch (error) {
        console.error('[Documents] Error fetching document:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /documents/:id/download - Download document file
router.get('/:id/download', authenticateToken, async (req, res) => {
    try {
        const document = await DocumentService.getDocumentById(req.params.id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const filePath = document.filepath;
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found on server' });
        }

        res.download(filePath, document.originalName || document.filename);
    } catch (error) {
        console.error('[Documents] Error downloading document:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /documents/upload - Upload new document
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { id: ownerId, organization_id: organizationId } = req.user;
        const { scope = 'user', projectId, description, tags } = req.body;

        // Validate scope
        if (scope === 'project' && !projectId) {
            return res.status(400).json({ error: 'Project ID required for project scope' });
        }

        console.log(`[Documents] Upload: ${req.file.originalname}, scope: ${scope}, owner: ${ownerId}`);

        const document = await DocumentService.uploadDocument(req.file, {
            organizationId,
            projectId: scope === 'project' ? projectId : null,
            ownerId,
            scope,
            description,
            tags: tags ? JSON.parse(tags) : []
        });

        res.status(201).json({
            message: 'Document uploaded successfully',
            document
        });
    } catch (error) {
        console.error('[Documents] Upload error:', error);
        res.status(500).json({ error: error.message || 'Upload failed' });
    }
});

// PUT /documents/:id/move-to-project - Move private doc to project
router.put('/:id/move-to-project', authenticateToken, async (req, res) => {
    try {
        const { id: documentId } = req.params;
        const { projectId } = req.body;
        const { id: userId } = req.user;

        if (!projectId) {
            return res.status(400).json({ error: 'Project ID required' });
        }

        const document = await DocumentService.moveToProject(documentId, projectId, userId);
        res.json({
            message: 'Document moved to project',
            document
        });
    } catch (error) {
        console.error('[Documents] Move error:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /documents/:id - Soft delete document
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id: userId } = req.user;
        const result = await DocumentService.deleteDocument(req.params.id, userId);

        if (!result.success) {
            return res.status(404).json({ error: 'Document not found or access denied' });
        }

        res.json({ message: 'Document deleted' });
    } catch (error) {
        console.error('[Documents] Delete error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
