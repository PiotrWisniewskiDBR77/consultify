const express = require('express');
const router = express.Router();
const KnowledgeService = require('../services/knowledgeService');
const requireSuperAdmin = require('../middleware/superAdminMiddleware');
const { enforceStorageQuota, recordStorageAfterUpload } = require('../middleware/quotaMiddleware');

// --- CANDIDATES (Idea Inbox) ---

// Get pending candidates (SuperAdmin only)
router.get('/candidates', requireSuperAdmin, async (req, res) => {
    try {
        const status = req.query.status || 'pending';
        const items = await KnowledgeService.getCandidates(status);
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Submit a new candidate (Internal AI or User feedback)
// No specific auth required for AI internal calls, but public endpoint should probably be protected
// For now, allow authenticated users to "suggest" ideas
router.post('/candidates', async (req, res) => {
    try {
        const { content, reasoning, source, relatedAxis, originContext } = req.body;
        const id = await KnowledgeService.addCandidate(content, reasoning, source, relatedAxis, originContext);
        res.json({ id, message: 'Candidate submitted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Review candidate (Approve/Reject)
router.put('/candidates/:id/status', requireSuperAdmin, async (req, res) => {
    try {
        const { status, adminComment } = req.body;
        await KnowledgeService.updateCandidateStatus(req.params.id, status, adminComment);
        res.json({ message: 'Status updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- AI OBSERVATIONS ---

router.get('/observations/generate', requireSuperAdmin, async (req, res) => {
    try {
        const AiService = require('../services/aiService'); // Lazy load to avoid circular dep if any
        const observations = await AiService.generateObservations(req.user?.id);
        res.json(observations);
    } catch (err) {
        console.error("Observation Route Error", err);
        res.status(500).json({ error: err.message });
    }
});

// --- GLOBAL STRATEGIES ---

router.get('/strategies', async (req, res) => {
    try {
        // Active strategies are public for all users (to influence AI)
        // Admin sees all? Let's just return active for now or filtering
        const strategies = await KnowledgeService.getActiveStrategies();
        res.json(strategies);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/strategies', requireSuperAdmin, async (req, res) => {
    try {
        const { title, description } = req.body;
        const id = await KnowledgeService.addStrategy(title, description, req.user?.email || 'admin');
        res.json({ id, message: 'Strategy created' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/strategies/:id/toggle', requireSuperAdmin, async (req, res) => {
    try {
        const { isActive } = req.body;
        await KnowledgeService.toggleStrategy(req.params.id, isActive);
        res.json({ message: 'Strategy toggled' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- KNOWLEDGE DOCUMENTS (RAG) ---

const StorageService = require('../services/storageService');
const { v4: uuidv4 } = require('uuid');

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdf = require('pdf-parse');

// Configure multer to use a temporary staging directory
const upload = multer({
    dest: path.join(__dirname, '../../uploads/temp'), // Staging area
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf' || file.mimetype === 'text/plain' || file.mimetype === 'text/markdown') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF, TXT, and Markdown files are allowed'));
        }
    }
});

const verifyToken = require('../middleware/authMiddleware');
const enforceProjectQuota = require('../middleware/projectQuotaMiddleware');

// Apply storage quota enforcement before upload
router.post('/documents', verifyToken, enforceStorageQuota, upload.single('file'), enforceProjectQuota, async (req, res) => {
    let tempPath = null;
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const { originalname, size, path: multerPath, mimetype } = req.file;
        tempPath = multerPath;

        const orgId = req.user?.organizationId || req.user?.organization_id;
        // Project ID is optional (global org doc vs project doc)
        const projectId = req.body.project_id || null;

        if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

        // 1. Check Project Quota (if in project context)
        // TODO: Implement strict project quota check here using verifyToken context

        // 2. Move file to isolated storage
        const finalPath = await StorageService.storeFile(tempPath, orgId, projectId, 'knowledge', originalname);

        // 3. Save metadata
        const docId = await KnowledgeService.addDocument(originalname, finalPath, orgId, projectId, size);

        // 4. Extract Text
        let text = '';
        if (mimetype === 'application/pdf') {
            const dataBuffer = fs.readFileSync(finalPath);
            const pdfData = await pdf(dataBuffer);
            text = pdfData.text;
        } else {
            text = fs.readFileSync(finalPath, 'utf8');
        }

        // 5. Process & Index (Async)
        const chunkCount = await KnowledgeService.processDocument(docId, text);

        // 6. Record storage usage (Organization Level)
        await recordStorageAfterUpload(req, size, 'document_upload');

        // 7. Record storage usage (Project Level) - Optional for now, added column in DB
        // await ProjectUsageService.record(...)

        res.json({ message: 'Document uploaded and indexed', docId, chunkCount });

    } catch (err) {
        console.error("Upload Error", err);
        // Cleanup temp file if it still exists
        if (tempPath && fs.existsSync(tempPath)) {
            try { fs.unlinkSync(tempPath); } catch (e) { }
        }
        res.status(500).json({ error: err.message });
    }
});

router.get('/documents', verifyToken, async (req, res) => {
    try {
        const orgId = req.user?.organizationId || req.user?.organization_id;
        const docs = await KnowledgeService.getDocuments(orgId);
        res.json(docs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/documents/:id', verifyToken, async (req, res) => {
    try {
        const orgId = req.user?.organizationId || req.user?.organization_id;
        const success = await KnowledgeService.deleteDocument(req.params.id, orgId);
        if (success) {
            res.json({ message: 'Document deleted' });
        } else {
            res.status(404).json({ error: 'Document not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
