/**
 * Documents Routes
 * API endpoints for document management
 * 
 * Fully migrated to TypeScript ES modules
 */

import { Router, Response } from 'express';
import { verifyToken, type AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = Router();

// Dynamic import for DocumentService (may not be migrated yet)
let DocumentService: any = null;

try {
    const documentModule = await import('../../services/documentService.js');
    DocumentService = documentModule.default || documentModule;
} catch {
    console.warn('[Documents] DocumentService not available');
}

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../../uploads/documents');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer for document uploads
const storage = multer.diskStorage({
    destination: function (_req, _file, cb) {
        cb(null, uploadDir);
    },
    filename: function (_req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, uniqueSuffix + '-' + sanitizedName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
    fileFilter: (_req, file, cb) => {
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
            cb(new Error(`Unsupported file type: ${file.mimetype}`));
        }
    }
});

/**
 * GET /api/documents/project/:projectId
 * List project documents
 */
router.get('/project/:projectId', verifyToken, asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!DocumentService?.getProjectDocuments) {
        return res.status(503).json({ error: 'Document service not available' });
    }

    try {
        const { projectId } = req.params;
        const documents = await DocumentService.getProjectDocuments(projectId);
        res.json(documents);
    } catch (error: any) {
        console.error('[Documents] Error fetching project documents:', error);
        res.status(500).json({ error: error.message });
    }
}));

/**
 * GET /api/documents/user
 * List user's private documents
 */
router.get('/user', verifyToken, asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!DocumentService?.getUserDocuments) {
        return res.status(503).json({ error: 'Document service not available' });
    }

    try {
        const userId = req.user?.id;
        const organizationId = (req.user as any)?.organization_id || req.user?.organizationId;
        if (!userId || !organizationId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const documents = await DocumentService.getUserDocuments(userId, organizationId);
        res.json(documents);
    } catch (error: any) {
        console.error('[Documents] Error fetching user documents:', error);
        res.status(500).json({ error: error.message });
    }
}));

/**
 * GET /api/documents/all
 * List all accessible documents (user's + project's if projectId provided)
 */
router.get('/all', verifyToken, asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!DocumentService?.getAccessibleDocuments) {
        return res.status(503).json({ error: 'Document service not available' });
    }

    try {
        const userId = req.user?.id;
        const organizationId = (req.user as any)?.organization_id || req.user?.organizationId;
        if (!userId || !organizationId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { projectId } = req.query;
        const documents = await DocumentService.getAccessibleDocuments(userId, organizationId, projectId as string | undefined);
        res.json(documents);
    } catch (error: any) {
        console.error('[Documents] Error fetching documents:', error);
        res.status(500).json({ error: error.message });
    }
}));

/**
 * GET /api/documents
 * Alias for /documents/all
 */
router.get('/', verifyToken, asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!DocumentService?.getAccessibleDocuments) {
        return res.status(503).json({ error: 'Document service not available' });
    }

    try {
        const userId = req.user?.id;
        const organizationId = (req.user as any)?.organization_id || req.user?.organizationId;
        if (!userId || !organizationId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { projectId } = req.query;
        const documents = await DocumentService.getAccessibleDocuments(userId, organizationId, projectId as string | undefined);
        res.json(documents);
    } catch (error: any) {
        console.error('[Documents] Error fetching documents:', error);
        res.status(500).json({ error: error.message });
    }
}));

/**
 * GET /api/documents/:id
 * Get single document
 */
router.get('/:id', verifyToken, asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!DocumentService?.getDocumentById) {
        return res.status(503).json({ error: 'Document service not available' });
    }

    try {
        const document = await DocumentService.getDocumentById(req.params.id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        res.json(document);
    } catch (error: any) {
        console.error('[Documents] Error fetching document:', error);
        res.status(500).json({ error: error.message });
    }
}));

/**
 * GET /api/documents/:id/download
 * Download document file
 */
router.get('/:id/download', verifyToken, asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!DocumentService?.getDocumentById) {
        return res.status(503).json({ error: 'Document service not available' });
    }

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
    } catch (error: any) {
        console.error('[Documents] Error downloading document:', error);
        res.status(500).json({ error: error.message });
    }
}));

/**
 * POST /api/documents/upload
 * Upload new document
 */
router.post('/upload', verifyToken, upload.single('file'), asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!DocumentService?.uploadDocument) {
        return res.status(503).json({ error: 'Document service not available' });
    }

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const ownerId = req.user?.id;
        const organizationId = (req.user as any)?.organization_id || req.user?.organizationId;
        if (!ownerId || !organizationId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

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
    } catch (error: any) {
        console.error('[Documents] Upload error:', error);
        res.status(500).json({ error: error.message || 'Upload failed' });
    }
}));

/**
 * PUT /api/documents/:id/move-to-project
 * Move private doc to project
 */
router.put('/:id/move-to-project', verifyToken, asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!DocumentService?.moveToProject) {
        return res.status(503).json({ error: 'Document service not available' });
    }

    try {
        const { id: documentId } = req.params;
        const { projectId } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!projectId) {
            return res.status(400).json({ error: 'Project ID required' });
        }

        const document = await DocumentService.moveToProject(documentId, projectId, userId);
        res.json({
            message: 'Document moved to project',
            document
        });
    } catch (error: any) {
        console.error('[Documents] Move error:', error);
        res.status(500).json({ error: error.message });
    }
}));

/**
 * DELETE /api/documents/:id
 * Soft delete document
 */
router.delete('/:id', verifyToken, asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!DocumentService?.deleteDocument) {
        return res.status(503).json({ error: 'Document service not available' });
    }

    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const result = await DocumentService.deleteDocument(req.params.id, userId);

        if (!result.success) {
            return res.status(404).json({ error: 'Document not found or access denied' });
        }

        res.json({ message: 'Document deleted' });
    } catch (error: any) {
        console.error('[Documents] Delete error:', error);
        res.status(500).json({ error: error.message });
    }
}));

export default router;
