/**
 * Knowledge Routes
 * API endpoints for knowledge management (candidates, strategies, documents)
 *
 * Fully migrated to TypeScript ES modules
 */

import { NextFunction, Response, Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

import { type AuthRequest, requireSuperAdmin, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Extend AuthRequest to include multer file
interface AuthRequestWithFile extends AuthRequest {
    file?: Express.Multer.File;
}

// ==========================================
// TYPES
// ==========================================

export interface IKnowledgeCandidate {
    id: string;
    content: string;
    reasoning: string;
    source: string;
    status: 'pending' | 'approved' | 'rejected' | 'implemented' | 'archived';
    origin_context?: string;
    related_axis?: string;
    category?: string;
    tags?: string[] | string;
    implementation_notes?: string;
    impact_score?: number;
    related_project_ids?: string[] | string;
    admin_comment?: string;
    created_at: string;
}

export interface IKnowledgeStrategy {
    id: string;
    title: string;
    description: string;
    created_by: string;
    success_metrics: string[] | string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    target_date?: string;
    progress_percentage: number;
    is_active: boolean | number;
    related_document_ids?: string[] | string;
    related_idea_ids?: string[] | string;
    created_at: string;
}

export interface IKnowledgeDocument {
    id: string;
    filename: string;
    filepath: string;
    organization_id: string;
    project_id?: string | null;
    file_size_bytes: number;
    status: 'pending' | 'indexing' | 'indexed' | 'error';
    category?: string;
    tags?: string[] | string;
    version?: number;
    parent_doc_id?: string;
    created_at: string;
    deleted_at?: string;
}

interface IKnowledgeService {
    getCandidates: (status: string) => Promise<IKnowledgeCandidate[]>;
    addCandidate: (
        content: string,
        reasoning: string,
        source: string,
        relatedAxis?: null,
        originContext?: string,
    ) => Promise<string>;
    updateCandidateStatus: (id: string, status: string, adminComment?: string) => Promise<number>;
    updateCandidate: (id: string, updates: Partial<IKnowledgeCandidate>) => Promise<number>;
    linkIdeaToProject: (ideaId: string, projectId: string, notes?: string) => Promise<number>;
    getApprovedIdeas: (filters: Record<string, string>) => Promise<IKnowledgeCandidate[]>;
    getIdeasByCategory: (category: string) => Promise<IKnowledgeCandidate[]>;
    getIdeasByProject: (projectId: string) => Promise<IKnowledgeCandidate[]>;
    addStrategy: (title: string, description: string, createdBy: string, options: any) => Promise<string>;
    updateStrategy: (id: string, updates: Partial<IKnowledgeStrategy>) => Promise<number>;
    linkStrategyToDocument: (strategyId: string, docId: string) => Promise<number>;
    linkStrategyToIdea: (strategyId: string, ideaId: string) => Promise<number>;
    unlinkStrategyFromDocument: (strategyId: string, docId: string) => Promise<number>;
    unlinkStrategyFromIdea: (strategyId: string, ideaId: string) => Promise<number>;
    updateStrategyProgress: (strategyId: string, percentage: number) => Promise<number>;
    getStrategyWithRelated: (strategyId: string) => Promise<any>;
    toggleStrategy: (id: string, isActive: boolean) => Promise<number>;
    getActiveStrategies: () => Promise<IKnowledgeStrategy[]>;
    getAllStrategies: () => Promise<IKnowledgeStrategy[]>;
    addDocument: (
        filename: string,
        filepath: string,
        orgId: string,
        projectId: string | null,
        size: number,
        category?: string | null,
        tags?: string[],
    ) => Promise<string>;
    processDocument: (docId: string, text: string) => Promise<number>;
    getDocuments: (orgId: string, userId?: string, role?: string) => Promise<IKnowledgeDocument[]>;
    getDocumentsByCategory: (orgId: string, category: string) => Promise<IKnowledgeDocument[]>;
    getDocumentsByStrategy: (strategyId: string) => Promise<IKnowledgeDocument[]>;
    updateDocument: (docId: string, updates: Partial<IKnowledgeDocument>) => Promise<number>;
    deleteDocument: (docId: string, orgId: string) => Promise<boolean>;
}

interface IStorageService {
    storeFile: (
        tempPath: string,
        orgId: string,
        projectId: string | null,
        type: string,
        originalName: string,
    ) => Promise<string>;
}

const router = Router();

// Dynamic imports for services that may not be migrated yet
let KnowledgeService: IKnowledgeService | null = null;
let StorageService: IStorageService | null = null;

try {
    const knowledgeModule = await import('../../services/knowledgeService.js');
    KnowledgeService = knowledgeModule.default || knowledgeModule;
} catch {
    console.warn('[Knowledge] KnowledgeService not available');
}

try {
    const storageModule = await import('../../services/storageService.js');
    StorageService = storageModule.default || storageModule;
} catch {
    console.warn('[Knowledge] StorageService not available');
}

// NotificationOutboxService removed - not used

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer to use a temporary staging directory
const upload = multer({
    dest: path.join(__dirname, '../../../uploads/temp'), // Staging area
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (_req, file, cb) => {
        if (
            file.mimetype === 'application/pdf' ||
            file.mimetype === 'text/plain' ||
            file.mimetype === 'text/markdown'
        ) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF, TXT, and Markdown files are allowed'));
        }
    },
});

// Dynamic import for quota middleware (may not be migrated yet)
let enforceStorageQuota: any = null;
let recordStorageAfterUpload: ((req: AuthRequest, size: number, type: string) => Promise<void>) | null = null;
let enforceProjectQuota: any = null;

try {
    const quotaModule = await import('../../middleware/quota.middleware.js');
    enforceStorageQuota = quotaModule.enforceStorageQuota;
    recordStorageAfterUpload = quotaModule.recordStorageAfterUpload;
} catch {
    console.warn('[Knowledge] Quota middleware not available');
}

try {
    const projectQuotaModule = await import('../../middleware/projectQuotaMiddleware.js');
    enforceProjectQuota = projectQuotaModule.default || projectQuotaModule;
} catch {
    console.warn('[Knowledge] Project quota middleware not available');
}

/**
 * GET /api/knowledge/candidates
 * Get pending candidates (SuperAdmin only)
 */
router.get(
    '/candidates',
    requireSuperAdmin,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!KnowledgeService?.getCandidates) {
            return res.status(503).json({ error: 'Knowledge service not available' });
        }

        try {
            const status = (req.query.status as string) || 'pending';
            const items = await KnowledgeService.getCandidates(status);
            return res.json(items);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            return res.status(500).json({ error: message });
        }
    }),
);

/**
 * POST /api/knowledge/candidates
 * Submit a new candidate (Internal AI or User feedback)
 */
router.post(
    '/candidates',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!KnowledgeService?.addCandidate) {
            return res.status(503).json({ error: 'Knowledge service not available' });
        }

        try {
            const { content, reasoning, source, relatedAxis, originContext } = req.body;
            const id = await KnowledgeService.addCandidate(content, reasoning, source, relatedAxis, originContext);
            return res.json({ id, message: 'Candidate submitted' });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            return res.status(500).json({ error: message });
        }
    }),
);

/**
 * PUT /api/knowledge/candidates/:id/status
 * Review candidate (Approve/Reject)
 */
router.put(
    '/candidates/:id/status',
    requireSuperAdmin,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!KnowledgeService?.updateCandidateStatus) {
            return res.status(503).json({ error: 'Knowledge service not available' });
        }

        try {
            const { status, adminComment } = req.body;
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            if (!id) return res.status(400).json({ error: 'id is required' });
            await KnowledgeService.updateCandidateStatus(id, status, adminComment);
            return res.json({ message: 'Status updated' });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            return res.status(500).json({ error: message });
        }
    }),
);

/**
 * PUT /api/knowledge/candidates/:id
 * Update candidate (full update with category, tags, etc.)
 */
router.put(
    '/candidates/:id',
    requireSuperAdmin,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!KnowledgeService?.updateCandidate) {
            return res.status(503).json({ error: 'Knowledge service not available' });
        }

        try {
            const updates: Partial<IKnowledgeCandidate> = {};
            if (req.body.category !== undefined) updates.category = req.body.category;
            if (req.body.tags !== undefined) {
                updates.tags = Array.isArray(req.body.tags) ? req.body.tags : JSON.parse(req.body.tags);
            }
            if (req.body.implementation_notes !== undefined)
                updates.implementation_notes = req.body.implementation_notes;
            if (req.body.impact_score !== undefined) updates.impact_score = req.body.impact_score;
            if (req.body.status !== undefined) updates.status = req.body.status;

            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            if (!id) return res.status(400).json({ error: 'id is required' });
            const changes = await KnowledgeService.updateCandidate(id, updates);
            return res.json({ message: 'Candidate updated', changes });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            return res.status(500).json({ error: message });
        }
    }),
);

/**
 * POST /api/knowledge/candidates/:id/link-project
 * Link idea to project
 */
router.post(
    '/candidates/:id/link-project',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!KnowledgeService?.linkIdeaToProject) {
            return res.status(503).json({ error: 'Knowledge service not available' });
        }

        try {
            const { project_id, notes } = req.body;
            if (!project_id) return res.status(400).json({ error: 'project_id is required' });

            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            if (!id) return res.status(400).json({ error: 'id is required' });
            const changes = await KnowledgeService.linkIdeaToProject(id, project_id, notes || '');
            return res.json({ message: 'Idea linked to project', changes });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            return res.status(500).json({ error: message });
        }
    }),
);

/**
 * GET /api/knowledge/candidates/approved
 * Get approved ideas library
 */
router.get(
    '/candidates/approved',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!KnowledgeService?.getApprovedIdeas) {
            return res.status(503).json({ error: 'Knowledge service not available' });
        }

        try {
            const filters: Record<string, string> = {};
            if (req.query.category) filters.category = req.query.category as string;

            const ideas = await KnowledgeService.getApprovedIdeas(filters);
            return res.json(ideas);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            return res.status(500).json({ error: message });
        }
    }),
);

/**
 * GET /api/knowledge/candidates/by-category/:category
 * Get ideas by category
 */
router.get(
    '/candidates/by-category/:category',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!KnowledgeService?.getIdeasByCategory) {
            return res.status(503).json({ error: 'Knowledge service not available' });
        }

        try {
            const category = Array.isArray(req.params.category) ? req.params.category[0] : req.params.category;
            if (!category) return res.status(400).json({ error: 'category is required' });
            const ideas = await KnowledgeService.getIdeasByCategory(category);
            return res.json(ideas);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            return res.status(500).json({ error: message });
        }
    }),
);

/**
 * GET /api/knowledge/candidates/by-project/:projectId
 * Get ideas by project
 */
router.get(
    '/candidates/by-project/:projectId',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!KnowledgeService?.getIdeasByProject) {
            return res.status(503).json({ error: 'Knowledge service not available' });
        }

        try {
            const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
            if (!projectId) return res.status(400).json({ error: 'projectId is required' });
            const ideas = await KnowledgeService.getIdeasByProject(projectId);
            return res.json(ideas);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            return res.status(500).json({ error: message });
        }
    }),
);

/**
 * GET /api/knowledge/observations/generate
 * Generate AI observations
 */
router.get(
    '/observations/generate',
    requireSuperAdmin,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            // Use unified AI pipeline for observation generation
            const aiPipelineModule = await import('../../services/ai/AIPipeline.js');
            const pipeline = aiPipelineModule.aiPipeline || aiPipelineModule.AIPipeline.getInstance();
            const userId = req.user?.id;
            const organizationId = req.user?.organizationId;
            if (!userId || !organizationId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const observations = await pipeline.process({
                capability: 'generateObservations',
                userId,
                organizationId,
                context: {},
            });
            return res.json(observations);
        } catch (err: unknown) {
            console.error('Observation Route Error', err);
            const message = err instanceof Error ? err.message : 'Unknown error';
            return res.status(500).json({ error: message });
        }
    }),
);

/**
 * GET /api/knowledge/strategies
 * Get global strategies
 */
router.get(
    '/strategies',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!KnowledgeService?.getAllStrategies || !KnowledgeService?.getActiveStrategies) {
            return res.status(503).json({ error: 'Knowledge service not available' });
        }

        try {
            // Active strategies are public for all users (to influence AI)
            const all = req.query.all === 'true';
            const strategies = all
                ? await KnowledgeService.getAllStrategies()
                : await KnowledgeService.getActiveStrategies();
            return res.json(strategies);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            return res.status(500).json({ error: message });
        }
    }),
);

/**
 * POST /api/knowledge/strategies
 * Create strategy (SuperAdmin only)
 */
router.post(
    '/strategies',
    requireSuperAdmin,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!KnowledgeService?.addStrategy) {
            return res.status(503).json({ error: 'Knowledge service not available' });
        }

        try {
            const { title, description, success_metrics, priority, target_date, progress_percentage } = req.body;
            const options = {
                success_metrics: success_metrics || [],
                priority: priority || 'medium',
                target_date: target_date || null,
                progress_percentage: progress_percentage || 0,
            };
            const id = await KnowledgeService.addStrategy(title, description, req.user?.email || 'admin', options);
            res.json({ id, message: 'Strategy created' });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            return res.status(500).json({ error: message });
        }
    }),
);

/**
 * PUT /api/knowledge/strategies/:id
 * Update strategy (SuperAdmin only)
 */
router.put(
    '/strategies/:id',
    requireSuperAdmin,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!KnowledgeService?.updateStrategy) {
            return res.status(503).json({ error: 'Knowledge service not available' });
        }

        try {
            const updates: Partial<IKnowledgeStrategy> = {};
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

            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            if (!id) return res.status(400).json({ error: 'id is required' });
            const changes = await KnowledgeService.updateStrategy(id, updates);
            return res.json({ message: 'Strategy updated', changes });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            return res.status(500).json({ error: message });
        }
    }),
);

/**
 * POST /api/knowledge/strategies/:id/link-document
 * Link document to strategy (SuperAdmin only)
 */
router.post(
    '/strategies/:id/link-document',
    requireSuperAdmin,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!KnowledgeService?.linkStrategyToDocument) {
            return res.status(503).json({ error: 'Knowledge service not available' });
        }

        try {
            const { document_id } = req.body;
            if (!document_id) return res.status(400).json({ error: 'document_id is required' });

            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            if (!id) return res.status(400).json({ error: 'id is required' });
            const changes = await KnowledgeService.linkStrategyToDocument(id, document_id);
            return res.json({ message: 'Document linked to strategy', changes });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            return res.status(500).json({ error: message });
        }
    }),
);

/**
 * POST /api/knowledge/strategies/:id/link-idea
 * Link idea to strategy (SuperAdmin only)
 */
router.post(
    '/strategies/:id/link-idea',
    requireSuperAdmin,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!KnowledgeService?.linkStrategyToIdea) {
            return res.status(503).json({ error: 'Knowledge service not available' });
        }

        try {
            const { idea_id } = req.body;
            if (!idea_id) return res.status(400).json({ error: 'idea_id is required' });

            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            if (!id) return res.status(400).json({ error: 'id is required' });
            const changes = await KnowledgeService.linkStrategyToIdea(id, idea_id);
            return res.json({ message: 'Idea linked to strategy', changes });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            return res.status(500).json({ error: message });
        }
    }),
);

/**
 * DELETE /api/knowledge/strategies/:id/unlink-document/:docId
 * Unlink document from strategy (SuperAdmin only)
 */
router.delete(
    '/strategies/:id/unlink-document/:docId',
    requireSuperAdmin,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!KnowledgeService?.unlinkStrategyFromDocument) {
            return res.status(503).json({ error: 'Knowledge service not available' });
        }

        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const docId = Array.isArray(req.params.docId) ? req.params.docId[0] : req.params.docId;
            if (!id || !docId) return res.status(400).json({ error: 'id and docId are required' });
            const changes = await KnowledgeService.unlinkStrategyFromDocument(id, docId);
            return res.json({ message: 'Document unlinked from strategy', changes });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            return res.status(500).json({ error: message });
        }
    }),
);

/**
 * DELETE /api/knowledge/strategies/:id/unlink-idea/:ideaId
 * Unlink idea from strategy (SuperAdmin only)
 */
router.delete(
    '/strategies/:id/unlink-idea/:ideaId',
    requireSuperAdmin,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!KnowledgeService?.unlinkStrategyFromIdea) {
            return res.status(503).json({ error: 'Knowledge service not available' });
        }

        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const ideaId = Array.isArray(req.params.ideaId) ? req.params.ideaId[0] : req.params.ideaId;
            if (!id || !ideaId) return res.status(400).json({ error: 'id and ideaId are required' });
            const changes = await KnowledgeService.unlinkStrategyFromIdea(id, ideaId);
            return res.json({ message: 'Idea unlinked from strategy', changes });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            return res.status(500).json({ error: message });
        }
    }),
);

/**
 * PUT /api/knowledge/strategies/:id/progress
 * Update strategy progress (SuperAdmin only)
 */
router.put(
    '/strategies/:id/progress',
    requireSuperAdmin,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!KnowledgeService?.updateStrategyProgress) {
            return res.status(503).json({ error: 'Knowledge service not available' });
        }

        try {
            const { progress_percentage } = req.body;
            if (progress_percentage === undefined)
                return res.status(400).json({ error: 'progress_percentage is required' });

            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            if (!id) return res.status(400).json({ error: 'id is required' });
            const changes = await KnowledgeService.updateStrategyProgress(id, progress_percentage);
            return res.json({ message: 'Strategy progress updated', changes });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            return res.status(500).json({ error: message });
        }
    }),
);

/**
 * GET /api/knowledge/strategies/:id/related
 * Get strategy with related items
 */
router.get(
    '/strategies/:id/related',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!KnowledgeService?.getStrategyWithRelated) {
            return res.status(503).json({ error: 'Knowledge service not available' });
        }

        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            if (!id) return res.status(400).json({ error: 'id is required' });
            const strategy = await KnowledgeService.getStrategyWithRelated(id);
            if (!strategy) return res.status(404).json({ error: 'Strategy not found' });
            return res.json(strategy);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            return res.status(500).json({ error: message });
        }
    }),
);

/**
 * PUT /api/knowledge/strategies/:id/toggle
 * Toggle strategy active status (SuperAdmin only)
 */
router.put(
    '/strategies/:id/toggle',
    requireSuperAdmin,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!KnowledgeService?.toggleStrategy) {
            return res.status(503).json({ error: 'Knowledge service not available' });
        }

        try {
            const { isActive } = req.body;
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            if (!id) return res.status(400).json({ error: 'id is required' });
            await KnowledgeService.toggleStrategy(id, isActive);
            return res.json({ message: 'Strategy toggled' });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            return res.status(500).json({ error: message });
        }
    }),
);

/**
 * POST /api/knowledge/documents
 * Upload knowledge document
 */
router.post(
    '/documents',
    verifyToken,
    enforceStorageQuota || ((_req: AuthRequest, _res: Response, next: NextFunction) => next()),
    upload.single('file'),
    enforceProjectQuota || ((_req: AuthRequest, _res: Response, next: NextFunction) => next()),
    asyncHandler(async (req: AuthRequestWithFile, res: Response) => {
        let tempPath: string | null = null;
        try {
            if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

            if (!StorageService?.storeFile || !KnowledgeService?.addDocument || !KnowledgeService?.processDocument) {
                return res.status(503).json({ error: 'Required services not available' });
            }

            const { originalname, size, path: multerPath, mimetype } = req.file;
            tempPath = multerPath;

            const orgId = req.user?.organizationId;
            // Force project_id = NULL for global knowledge docs (organization-level only)
            const projectId = null;

            if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

            // Move file to isolated storage (use null for projectId to enforce global scope)
            const finalPath = await StorageService.storeFile(tempPath, orgId, null, 'knowledge', originalname);

            // Save metadata with category and tags
            const category = (req.body.category as string) || null;
            const tags = req.body.tags
                ? Array.isArray(req.body.tags)
                    ? req.body.tags
                    : JSON.parse(req.body.tags as string)
                : [];
            const docId = await KnowledgeService.addDocument(
                originalname,
                finalPath,
                orgId,
                projectId,
                size,
                category,
                tags,
            );

            // Extract Text
            let text = '';
            try {
                if (mimetype === 'application/pdf') {
                    const pdfParseMod = await import('pdf-parse');
                    const pdf = pdfParseMod.default || pdfParseMod;
                    const dataBuffer = fs.readFileSync(finalPath);
                    const pdfData = await pdf(dataBuffer);
                    text = pdfData.text;
                } else {
                    text = fs.readFileSync(finalPath, 'utf8');
                }
            } catch (pdfErr) {
                console.error('PDF Parsing error', pdfErr);
                text = 'Error parsing PDF content';
            }

            // Process & Index (Async)
            const chunkCount = await KnowledgeService.processDocument(docId, text);

            // Record storage usage (Organization Level)
            if (recordStorageAfterUpload) {
                await recordStorageAfterUpload(req, size, 'document_upload');
            }

            return res.json({ message: 'Document uploaded and indexed', docId, chunkCount });
        } catch (err: unknown) {
            console.error('Upload Error', err);
            // Cleanup temp file if it still exists
            if (tempPath && fs.existsSync(tempPath)) {
                try {
                    fs.unlinkSync(tempPath);
                } catch (e) {}
            }
            const message = err instanceof Error ? err.message : 'Unknown error';
            return res.status(500).json({ error: message });
        }
    }),
);

/**
 * GET /api/knowledge/documents
 * Get knowledge documents
 */
router.get(
    '/documents',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (
            !KnowledgeService?.getDocuments ||
            !KnowledgeService?.getDocumentsByCategory ||
            !KnowledgeService?.getDocumentsByStrategy
        ) {
            return res.status(503).json({ error: 'Knowledge service not available' });
        }

        try {
            const orgId = req.user?.organizationId;
            const userId = req.user?.id;
            const role = req.user?.role || 'USER';
            const category = req.query.category as string | undefined;
            const strategyId = req.query.strategy_id as string | undefined;

            if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

            let docs: IKnowledgeDocument[];
            if (strategyId) {
                docs = await KnowledgeService.getDocumentsByStrategy(strategyId);
            } else if (category) {
                docs = await KnowledgeService.getDocumentsByCategory(orgId, category);
            } else {
                docs = await KnowledgeService.getDocuments(orgId, userId, role);
            }

            // Parse JSON fields
            const parsed = docs.map((doc: IKnowledgeDocument) => ({
                ...doc,
                tags: doc.tags ? (typeof doc.tags === 'string' ? JSON.parse(doc.tags) : doc.tags) : [],
            }));

            res.json(parsed);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            return res.status(500).json({ error: message });
        }
    }),
);

/**
 * PUT /api/knowledge/documents/:id
 * Update document
 */
router.put(
    '/documents/:id',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!KnowledgeService?.updateDocument) {
            return res.status(503).json({ error: 'Knowledge service not available' });
        }

        try {
            const updates: Partial<IKnowledgeDocument> = {};
            if (req.body.category !== undefined) updates.category = req.body.category;
            if (req.body.tags !== undefined) {
                updates.tags = Array.isArray(req.body.tags) ? req.body.tags : JSON.parse(req.body.tags);
            }
            if (req.body.version !== undefined) updates.version = req.body.version;
            if (req.body.parent_doc_id !== undefined) updates.parent_doc_id = req.body.parent_doc_id;

            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            if (!id) return res.status(400).json({ error: 'id is required' });
            const changes = await KnowledgeService.updateDocument(id, updates);
            return res.json({ message: 'Document updated', changes });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            return res.status(500).json({ error: message });
        }
    }),
);

/**
 * GET /api/knowledge/documents/by-strategy/:strategyId
 * Get documents by strategy
 */
router.get(
    '/documents/by-strategy/:strategyId',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!KnowledgeService?.getDocumentsByStrategy) {
            return res.status(503).json({ error: 'Knowledge service not available' });
        }

        try {
            const strategyId = Array.isArray(req.params.strategyId) ? req.params.strategyId[0] : req.params.strategyId;
            if (!strategyId) return res.status(400).json({ error: 'strategyId is required' });
            const docs = await KnowledgeService.getDocumentsByStrategy(strategyId);
            const parsed = docs.map((doc: IKnowledgeDocument) => ({
                ...doc,
                tags: doc.tags ? (typeof doc.tags === 'string' ? JSON.parse(doc.tags) : doc.tags) : [],
            }));
            return res.json(parsed);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            return res.status(500).json({ error: message });
        }
    }),
);

/**
 * DELETE /api/knowledge/documents/:id
 * Delete document
 */
router.delete(
    '/documents/:id',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!KnowledgeService?.deleteDocument) {
            return res.status(503).json({ error: 'Knowledge service not available' });
        }

        try {
            const orgId = req.user?.organizationId;
            if (!orgId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            if (!id) return res.status(400).json({ error: 'id is required' });
            const success = await KnowledgeService.deleteDocument(id, orgId);
            if (success) {
                return res.json({ message: 'Document deleted' });
            } else {
                return res.status(404).json({ error: 'Document not found' });
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            return res.status(500).json({ error: message });
        }
    }),
);

export default router;
