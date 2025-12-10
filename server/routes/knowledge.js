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

const multer = require('multer');
const path = require('path');
const fs = require('fs');
// const pdf = require('pdf-parse'); // Moved to lazy load inside handler

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../../knowledge_uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Sanitize filename
        const safeName = file.originalname.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
        cb(null, `${Date.now()}-${safeName}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf' || file.mimetype === 'text/plain' || file.mimetype === 'text/markdown') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF, TXT, and Markdown files are allowed'));
        }
    }
});

// Apply storage quota enforcement before upload
router.post('/documents', requireSuperAdmin, enforceStorageQuota, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const { filename, path: filepath, mimetype, size } = req.file;

        // 1. Save metadata
        const docId = await KnowledgeService.addDocument(filename, filepath);

        // 2. Extract Text
        let text = '';
        if (mimetype === 'application/pdf') {
            const dataBuffer = fs.readFileSync(filepath);
            // Lazy load pdf-parse to avoid DOMMatrix error in Node environments during tests
            const pdf = require('pdf-parse');
            const pdfData = await pdf(dataBuffer);
            text = pdfData.text;
        } else {
            text = fs.readFileSync(filepath, 'utf8');
        }

        // 3. Process & Index (Async)
        // We don't await this fully so UI returns fast, but for verification we might want to await.
        // Let's await for simplicity and immediate feedback.
        const chunkCount = await KnowledgeService.processDocument(docId, text);

        // 4. Record storage usage
        await recordStorageAfterUpload(req, size, 'document_upload');

        res.json({ message: 'Document uploaded and indexed', docId, chunkCount });

    } catch (err) {
        console.error("Upload Error", err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/documents', requireSuperAdmin, async (req, res) => {
    try {
        const docs = await KnowledgeService.getDocuments();
        res.json(docs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
