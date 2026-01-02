const express = require('express');
const router = express.Router();
const KnowledgeService = require('../services/knowledgeService');
const requireSuperAdmin = require('../middleware/superAdminMiddleware');
const verifyToken = require('../middleware/authMiddleware');
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

// Update candidate (full update with category, tags, etc.)
router.put('/candidates/:id', requireSuperAdmin, async (req, res) => {
    try {
        const updates = {};
        if (req.body.category !== undefined) updates.category = req.body.category;
        if (req.body.tags !== undefined) {
            updates.tags = Array.isArray(req.body.tags) ? req.body.tags : JSON.parse(req.body.tags);
        }
        if (req.body.implementation_notes !== undefined) updates.implementation_notes = req.body.implementation_notes;
        if (req.body.impact_score !== undefined) updates.impact_score = req.body.impact_score;
        if (req.body.status !== undefined) updates.status = req.body.status;
        
        const changes = await KnowledgeService.updateCandidate(req.params.id, updates);
        res.json({ message: 'Candidate updated', changes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Link idea to project
router.post('/candidates/:id/link-project', verifyToken, async (req, res) => {
    try {
        const { project_id, notes } = req.body;
        if (!project_id) return res.status(400).json({ error: 'project_id is required' });
        
        const changes = await KnowledgeService.linkIdeaToProject(req.params.id, project_id, notes || '');
        res.json({ message: 'Idea linked to project', changes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get approved ideas library
router.get('/candidates/approved', verifyToken, async (req, res) => {
    try {
        const filters = {};
        if (req.query.category) filters.category = req.query.category;
        
        const ideas = await KnowledgeService.getApprovedIdeas(filters);
        res.json(ideas);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get ideas by category
router.get('/candidates/by-category/:category', verifyToken, async (req, res) => {
    try {
        const ideas = await KnowledgeService.getIdeasByCategory(req.params.category);
        res.json(ideas);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get ideas by project
router.get('/candidates/by-project/:projectId', verifyToken, async (req, res) => {
    try {
        const ideas = await KnowledgeService.getIdeasByProject(req.params.projectId);
        res.json(ideas);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- AI OBSERVATIONS ---

router.get('/observations/generate', requireSuperAdmin, async (req, res) => {
    try {
        // Use unified AI pipeline for observation generation
        const { generateObservations } = require('../services/ai/aiPipeline');
        const observations = await generateObservations(req.user?.id, req.user?.organizationId);
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
        const all = req.query.all === 'true';
        const strategies = all 
            ? await KnowledgeService.getAllStrategies() 
            : await KnowledgeService.getActiveStrategies();
        res.json(strategies);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/strategies', requireSuperAdmin, async (req, res) => {
    try {
        const { title, description, success_metrics, priority, target_date, progress_percentage } = req.body;
        const options = {
            success_metrics: success_metrics || [],
            priority: priority || 'medium',
            target_date: target_date || null,
            progress_percentage: progress_percentage || 0
        };
        const id = await KnowledgeService.addStrategy(title, description, req.user?.email || 'admin', options);
        res.json({ id, message: 'Strategy created' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/strategies/:id', requireSuperAdmin, async (req, res) => {
    try {
        const updates = {};
        if (req.body.title !== undefined) updates.title = req.body.title;
        if (req.body.description !== undefined) updates.description = req.body.description;
        if (req.body.success_metrics !== undefined) {
            updates.success_metrics = Array.isArray(req.body.success_metrics) 
                ? req.body.success_metrics 
                : JSON.parse(req.body.success_metrics);
        }
        if (req.body.priority !== undefined) updates.priority = req.body.priority;
        if (req.body.target_date !== undefined) updates.target_date = req.body.target_date;
        if (req.body.progress_percentage !== undefined) updates.progress_percentage = req.body.progress_percentage;
        if (req.body.is_active !== undefined) updates.is_active = req.body.is_active;
        
        const changes = await KnowledgeService.updateStrategy(req.params.id, updates);
        res.json({ message: 'Strategy updated', changes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/strategies/:id/link-document', requireSuperAdmin, async (req, res) => {
    try {
        const { document_id } = req.body;
        if (!document_id) return res.status(400).json({ error: 'document_id is required' });
        
        const changes = await KnowledgeService.linkStrategyToDocument(req.params.id, document_id);
        res.json({ message: 'Document linked to strategy', changes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/strategies/:id/link-idea', requireSuperAdmin, async (req, res) => {
    try {
        const { idea_id } = req.body;
        if (!idea_id) return res.status(400).json({ error: 'idea_id is required' });
        
        const changes = await KnowledgeService.linkStrategyToIdea(req.params.id, idea_id);
        res.json({ message: 'Idea linked to strategy', changes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/strategies/:id/unlink-document/:docId', requireSuperAdmin, async (req, res) => {
    try {
        const changes = await KnowledgeService.unlinkStrategyFromDocument(req.params.id, req.params.docId);
        res.json({ message: 'Document unlinked from strategy', changes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/strategies/:id/unlink-idea/:ideaId', requireSuperAdmin, async (req, res) => {
    try {
        const changes = await KnowledgeService.unlinkStrategyFromIdea(req.params.id, req.params.ideaId);
        res.json({ message: 'Idea unlinked from strategy', changes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/strategies/:id/progress', requireSuperAdmin, async (req, res) => {
    try {
        const { progress_percentage } = req.body;
        if (progress_percentage === undefined) return res.status(400).json({ error: 'progress_percentage is required' });
        
        const changes = await KnowledgeService.updateStrategyProgress(req.params.id, progress_percentage);
        res.json({ message: 'Strategy progress updated', changes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/strategies/:id/related', verifyToken, async (req, res) => {
    try {
        const strategy = await KnowledgeService.getStrategyWithRelated(req.params.id);
        if (!strategy) return res.status(404).json({ error: 'Strategy not found' });
        res.json(strategy);
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

const enforceProjectQuota = require('../middleware/projectQuotaMiddleware');

// Apply storage quota enforcement before upload
router.post('/documents', verifyToken, enforceStorageQuota, upload.single('file'), enforceProjectQuota, async (req, res) => {
    let tempPath = null;
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const { originalname, size, path: multerPath, mimetype } = req.file;
        tempPath = multerPath;

        const orgId = req.user?.organizationId || req.user?.organization_id;
        // Force project_id = NULL for global knowledge docs (organization-level only)
        const projectId = null;

        if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

        // 1. Check Project Quota (if in project context)
        // TODO: Implement strict project quota check here using verifyToken context

        // 2. Move file to isolated storage (use null for projectId to enforce global scope)
        const finalPath = await StorageService.storeFile(tempPath, orgId, null, 'knowledge', originalname);

        // 3. Save metadata with category and tags
        const category = req.body.category || null;
        const tags = req.body.tags ? (Array.isArray(req.body.tags) ? req.body.tags : JSON.parse(req.body.tags)) : [];
        const docId = await KnowledgeService.addDocument(originalname, finalPath, orgId, projectId, size, category, tags);

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
        const userId = req.user?.id;
        const role = req.user?.role || 'USER';
        const category = req.query.category;
        const strategyId = req.query.strategy_id;

        let docs;
        if (strategyId) {
            docs = await KnowledgeService.getDocumentsByStrategy(strategyId);
        } else if (category) {
            docs = await KnowledgeService.getDocumentsByCategory(orgId, category);
        } else {
            docs = await KnowledgeService.getDocuments(orgId, userId, role);
        }
        
        // Parse JSON fields
        const parsed = docs.map(doc => ({
            ...doc,
            tags: doc.tags ? (typeof doc.tags === 'string' ? JSON.parse(doc.tags) : doc.tags) : []
        }));
        
        res.json(parsed);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/documents/:id', verifyToken, async (req, res) => {
    try {
        const updates = {};
        if (req.body.category !== undefined) updates.category = req.body.category;
        if (req.body.tags !== undefined) {
            updates.tags = Array.isArray(req.body.tags) ? req.body.tags : JSON.parse(req.body.tags);
        }
        if (req.body.version !== undefined) updates.version = req.body.version;
        if (req.body.parent_doc_id !== undefined) updates.parent_doc_id = req.body.parent_doc_id;
        
        const changes = await KnowledgeService.updateDocument(req.params.id, updates);
        res.json({ message: 'Document updated', changes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/documents/by-strategy/:strategyId', verifyToken, async (req, res) => {
    try {
        const docs = await KnowledgeService.getDocumentsByStrategy(req.params.strategyId);
        const parsed = docs.map(doc => ({
            ...doc,
            tags: doc.tags ? (typeof doc.tags === 'string' ? JSON.parse(doc.tags) : doc.tags) : []
        }));
        res.json(parsed);
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
