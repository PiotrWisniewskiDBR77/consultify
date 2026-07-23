// @ts-nocheck
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

import { type AuthRequest, requireSuperAdmin, verifyToken } from '../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import {
  extractTextFromFile as extractDocumentText,
  isSupportedIngest,
} from '../services/documentTextExtractor.js';
import KnowledgeService, { type VaultDocumentScope } from '../services/KnowledgeService.js';
// ★ VLT-001: reużyty tylko punktowo — sprawdzenie członkostwa w projekcie
// (contextDocumentService.canAccessProject), NIE cały pipeline uploadAndIngest (dysproporcjonalne
// wobec zakresu VLT-001, patrz DZIENNIK zadania). Ta sama tabela knowledge_docs, druga usługa.
import contextDocumentService from '../services/organizationContext/ContextDocumentService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { uploadsDir } from '../utils/storagePaths.js';

const VAULT_SCOPES: VaultDocumentScope[] = ['user', 'project', 'organization'];

const parseVaultScope = (value: unknown): VaultDocumentScope | null => {
  const s = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return (VAULT_SCOPES as string[]).includes(s) ? (s as VaultDocumentScope) : null;
};

/** Projekty, w których dany user jest członkiem (do domyślnego widoku Vault i filtra scope=project). */
async function getMemberProjectIds(userId: string): Promise<string[]> {
  if (!userId) return [];
  const rows = await DbPromise.all<{ project_id: string }>(
    `SELECT project_id FROM project_members WHERE user_id = ?`,
    [userId],
    { fallback: true } as any
  );
  return (rows || []).map((r) => String(r.project_id)).filter(Boolean);
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

const router = Router();
const notConfigured = (res: Response) =>
  res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
  });

// Apply rate limiting
router.use(apiAuthRateLimiter);

// Services
const StorageService: any = null;
const NotificationOutboxService: any = null;

// Services are currently not available - imports commented out
// Uncomment when services are ready:
// try {
//   const storageModule = (await import('../services/storageService.js')) as any;
//   StorageService = storageModule.default || storageModule;
// } catch {
//   logger.debug('[Knowledge] StorageService not available');
// }

// try {
//   const notificationModule = (await import('../services/notificationOutboxService.js')) as any;
//   NotificationOutboxService = notificationModule.default || notificationModule;
// } catch {
//   logger.debug('[Knowledge] NotificationOutboxService not available');
// }

// Configure multer to use a temporary staging directory
// (was `path.join(__dirname, '../../../uploads/temp')` — equivalent to
// `process.cwd()/uploads/temp` at runtime; routed through the shared helper
// for G2 volume readiness, see utils/storagePaths.ts)
const upload = multer({
  dest: uploadsDir('temp'), // Staging area
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    // HP-23: ingest RAG obsługuje PDF/TXT/MD oraz formaty biurowe
    // DOCX/XLSX/PPTX/CSV — ten sam chunking+embedding (documentTextExtractor).
    if (isSupportedIngest(file.originalname, file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, TXT, MD, CSV, DOCX, XLSX, and PPTX files are allowed'));
    }
  },
});

// Dynamic import for quota middleware (may not be migrated yet)
let enforceStorageQuota: any = null;
let recordStorageAfterUpload:
  | ((req: AuthRequest, size: number, type: string) => Promise<void>)
  | null = null;
let enforceProjectQuota: any = null;

try {
  const quotaModule = (await import('../middleware/quotaMiddleware.js')) as any;
  enforceStorageQuota = quotaModule.enforceStorageQuota;
  recordStorageAfterUpload = quotaModule.recordStorageAfterUpload;
} catch {
  logger.warn('[Knowledge] Quota middleware not available');
}

try {
  const projectQuotaModule = await import('../middleware/projectQuota.middleware.js');
  // enforceProjectQuota is a named export, not default
  enforceProjectQuota =
    projectQuotaModule.enforceProjectQuota || projectQuotaModule.default || projectQuotaModule;
} catch (error: any) {
  logger.warn(`[Knowledge] Project quota middleware not available: ${error.message}`);
}

/**
 * GET /api/knowledge/candidates
 * Get pending candidates (SuperAdmin only)
 */
router.get(
  '/candidates',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.getCandidates) {
      return notConfigured(res);
    }

    try {
      const status = (req.query.status as string) || 'pending';
      const items = await KnowledgeService.getCandidates(status);
      return res.json(items);
    } catch (err: any) {
      logger.error('[Knowledge] Get candidates failed', { err, correlationId: (req as any).correlationId });
      return res.status(500).json({ error: 'Nie udało się pobrać kandydatów wiedzy', code: 'KNOWLEDGE_CANDIDATES_LIST_FAILED' });
    }
    return;
  })
);

/**
 * POST /api/knowledge/candidates
 * Submit a new candidate (Internal AI or User feedback)
 */
router.post(
  '/candidates',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.addCandidate) {
      return notConfigured(res);
    }

    try {
      const { content, reasoning, source, relatedAxis, originContext } = req.body;
      const id = await KnowledgeService.addCandidate(
        content,
        reasoning,
        source,
        relatedAxis,
        originContext
      );
      return res.json({ id, message: 'Candidate submitted' });
    } catch (err: any) {
      logger.error('[Knowledge] Add candidate failed', { err, correlationId: (req as any).correlationId });
      return res.status(500).json({ error: 'Nie udało się zgłosić kandydata', code: 'KNOWLEDGE_CANDIDATE_CREATE_FAILED' });
    }
    return;
  })
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
      return notConfigured(res);
    }

    try {
      const { status, adminComment } = req.body;
      await KnowledgeService.updateCandidateStatus(req.params.id, status, adminComment);
      return res.json({ message: 'Status updated' });
    } catch (err: any) {
      logger.error('[Knowledge] Update candidate status failed', { err, correlationId: (req as any).correlationId });
      return res.status(500).json({ error: 'Nie udało się zaktualizować statusu kandydata', code: 'KNOWLEDGE_CANDIDATE_STATUS_UPDATE_FAILED' });
    }
    return;
  })
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
      return notConfigured(res);
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

      const changes = await KnowledgeService.updateCandidate(req.params.id, updates);
      return res.json({ message: 'Candidate updated', changes });
    } catch (err: any) {
      logger.error('[Knowledge] Update candidate failed', { err, correlationId: (req as any).correlationId });
      return res.status(500).json({ error: 'Nie udało się zaktualizować kandydata', code: 'KNOWLEDGE_CANDIDATE_UPDATE_FAILED' });
    }
    return;
  })
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
      return notConfigured(res);
    }

    try {
      const { project_id, notes } = req.body;
      if (!project_id) {
        return res.status(400).json({ error: 'project_id is required' });
        return;
      }

      const changes = await KnowledgeService.linkIdeaToProject(
        req.params.id,
        project_id,
        notes || ''
      );
      return res.json({ message: 'Idea linked to project', changes });
    } catch (err: any) {
      logger.error('[Knowledge] Link idea to project failed', { err, correlationId: (req as any).correlationId });
      return res.status(500).json({ error: 'Nie udało się powiązać pomysłu z projektem', code: 'KNOWLEDGE_CANDIDATE_LINK_PROJECT_FAILED' });
    }
    return;
  })
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
      return notConfigured(res);
    }

    try {
      const filters: Record<string, string> = {};
      if (req.query.category) filters.category = req.query.category as string;

      const ideas = await KnowledgeService.getApprovedIdeas(filters);
      return res.json(ideas);
    } catch (err: any) {
      logger.error('[Knowledge] Get approved ideas failed', { err, correlationId: (req as any).correlationId });
      return res.status(500).json({ error: 'Nie udało się pobrać zatwierdzonych pomysłów', code: 'KNOWLEDGE_CANDIDATES_APPROVED_FAILED' });
    }
    return;
  })
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
      return notConfigured(res);
    }

    try {
      const ideas = await KnowledgeService.getIdeasByCategory(req.params.category);
      return res.json(ideas);
    } catch (err: any) {
      logger.error('[Knowledge] Get ideas by category failed', { err, correlationId: (req as any).correlationId });
      return res.status(500).json({ error: 'Nie udało się pobrać pomysłów wg kategorii', code: 'KNOWLEDGE_CANDIDATES_BY_CATEGORY_FAILED' });
    }
    return;
  })
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
      return notConfigured(res);
    }

    try {
      const ideas = await KnowledgeService.getIdeasByProject(req.params.projectId);
      return res.json(ideas);
    } catch (err: any) {
      logger.error('[Knowledge] Get ideas by project failed', { err, correlationId: (req as any).correlationId });
      return res.status(500).json({ error: 'Nie udało się pobrać pomysłów wg projektu', code: 'KNOWLEDGE_CANDIDATES_BY_PROJECT_FAILED' });
    }
    return;
  })
);

/**
 * GET /api/knowledge/strategies
 * Get global strategies
 */
router.get(
  '/strategies',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.getAllStrategies || !KnowledgeService?.getActiveStrategies) {
      return notConfigured(res);
    }

    try {
      // Active strategies are public for all users (to influence AI)
      const all = req.query.all === 'true';
      const strategies = all
        ? await KnowledgeService.getAllStrategies()
        : await KnowledgeService.getActiveStrategies();
      return res.json(strategies);
    } catch (err: any) {
      logger.error('[Knowledge] Get strategies failed', { err, correlationId: (req as any).correlationId });
      return res.status(500).json({ error: 'Nie udało się pobrać strategii', code: 'KNOWLEDGE_STRATEGIES_LIST_FAILED' });
    }
    return;
  })
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
      return notConfigured(res);
    }

    try {
      const { title, description, success_metrics, priority, target_date, progress_percentage } =
        req.body;
      const options = {
        success_metrics: success_metrics || [],
        priority: priority || 'medium',
        target_date: target_date || null,
        progress_percentage: progress_percentage || 0,
      };
      const id = await KnowledgeService.addStrategy(
        title,
        description,
        req.user?.email || 'admin',
        options
      );
      return res.json({ id, message: 'Strategy created' });
    } catch (err: any) {
      logger.error('[Knowledge] Create strategy failed', { err, correlationId: (req as any).correlationId });
      return res.status(500).json({ error: 'Nie udało się utworzyć strategii', code: 'KNOWLEDGE_STRATEGY_CREATE_FAILED' });
    }
    return;
  })
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
      return notConfigured(res);
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
      if (req.body.progress_percentage !== undefined)
        updates.progress_percentage = req.body.progress_percentage;
      if (req.body.is_active !== undefined) updates.is_active = req.body.is_active;

      const changes = await KnowledgeService.updateStrategy(req.params.id, updates);
      return res.json({ message: 'Strategy updated', changes });
    } catch (err: any) {
      logger.error('[Knowledge] Update strategy failed', { err, correlationId: (req as any).correlationId });
      return res.status(500).json({ error: 'Nie udało się zaktualizować strategii', code: 'KNOWLEDGE_STRATEGY_UPDATE_FAILED' });
    }
    return;
  })
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
      return notConfigured(res);
    }

    try {
      const { document_id } = req.body;
      if (!document_id) {
        return res.status(400).json({ error: 'document_id is required' });
        return;
      }

      const changes = await KnowledgeService.linkStrategyToDocument(req.params.id, document_id);
      return res.json({ message: 'Document linked to strategy', changes });
    } catch (err: any) {
      logger.error('[Knowledge] Link strategy to document failed', { err, correlationId: (req as any).correlationId });
      return res.status(500).json({ error: 'Nie udało się powiązać dokumentu ze strategią', code: 'KNOWLEDGE_STRATEGY_LINK_DOCUMENT_FAILED' });
    }
    return;
  })
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
      return notConfigured(res);
    }

    try {
      const { idea_id } = req.body;
      if (!idea_id) {
        return res.status(400).json({ error: 'idea_id is required' });
        return;
      }

      const changes = await KnowledgeService.linkStrategyToIdea(req.params.id, idea_id);
      return res.json({ message: 'Idea linked to strategy', changes });
    } catch (err: any) {
      logger.error('[Knowledge] Link strategy to idea failed', { err, correlationId: (req as any).correlationId });
      return res.status(500).json({ error: 'Nie udało się powiązać pomysłu ze strategią', code: 'KNOWLEDGE_STRATEGY_LINK_IDEA_FAILED' });
    }
    return;
  })
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
      return notConfigured(res);
    }

    try {
      const changes = await KnowledgeService.unlinkStrategyFromDocument(
        req.params.id,
        req.params.docId
      );
      return res.json({ message: 'Document unlinked from strategy', changes });
    } catch (err: any) {
      logger.error('[Knowledge] Unlink strategy from document failed', { err, correlationId: (req as any).correlationId });
      return res.status(500).json({ error: 'Nie udało się odłączyć dokumentu od strategii', code: 'KNOWLEDGE_STRATEGY_UNLINK_DOCUMENT_FAILED' });
    }
    return;
  })
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
      return notConfigured(res);
    }

    try {
      const changes = await KnowledgeService.unlinkStrategyFromIdea(
        req.params.id,
        req.params.ideaId
      );
      return res.json({ message: 'Idea unlinked from strategy', changes });
    } catch (err: any) {
      logger.error('[Knowledge] Unlink strategy from idea failed', { err, correlationId: (req as any).correlationId });
      return res.status(500).json({ error: 'Nie udało się odłączyć pomysłu od strategii', code: 'KNOWLEDGE_STRATEGY_UNLINK_IDEA_FAILED' });
    }
    return;
  })
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
      return notConfigured(res);
    }

    try {
      const { progress_percentage } = req.body;
      if (progress_percentage === undefined) {
        return res.status(400).json({ error: 'progress_percentage is required' });
        return;
      }

      const changes = await KnowledgeService.updateStrategyProgress(
        req.params.id,
        progress_percentage
      );
      return res.json({ message: 'Strategy progress updated', changes });
    } catch (err: any) {
      logger.error('[Knowledge] Update strategy progress failed', { err, correlationId: (req as any).correlationId });
      return res.status(500).json({ error: 'Nie udało się zaktualizować postępu strategii', code: 'KNOWLEDGE_STRATEGY_PROGRESS_UPDATE_FAILED' });
    }
    return;
  })
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
      return notConfigured(res);
    }

    try {
      const strategy = await KnowledgeService.getStrategyWithRelated(req.params.id);
      if (!strategy) {
        return res.status(404).json({ error: 'Strategy not found' });
        return;
      }
      return res.json(strategy);
    } catch (err: any) {
      logger.error('[Knowledge] Get strategy with related failed', { err, correlationId: (req as any).correlationId });
      return res.status(500).json({ error: 'Nie udało się pobrać strategii z powiązaniami', code: 'KNOWLEDGE_STRATEGY_RELATED_FAILED' });
    }
    return;
  })
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
      return notConfigured(res);
    }

    try {
      const { isActive } = req.body;
      await KnowledgeService.toggleStrategy(req.params.id, isActive);
      return res.json({ message: 'Strategy toggled' });
    } catch (err: any) {
      logger.error('[Knowledge] Toggle strategy failed', { err, correlationId: (req as any).correlationId });
      return res.status(500).json({ error: 'Nie udało się przełączyć strategii', code: 'KNOWLEDGE_STRATEGY_TOGGLE_FAILED' });
    }
    return;
  })
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
  asyncHandler(async (req: AuthRequest, res: Response) => {
    let tempPath: string | null = null;
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      if (!KnowledgeService?.addDocument || !KnowledgeService?.processDocument) {
        return notConfigured(res);
        return;
      }

      const { originalname, size, path: multerPath, mimetype } = req.file;
      tempPath = multerPath;

      const orgId = req.user?.organizationId;
      const ownerId = req.user?.id;
      const role = req.user?.role || 'USER';

      if (!orgId) {
        return res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // ★ VLT-001: 3 poziomy przypisania — osoba/projekt/organizacja (dawniej zawsze wymuszone
      // na organization/project_id=null, patrz DZIENNIK zadania). Brak `scope` w body (stary
      // klient, przed VLT-003 UI) = 'organization', zachowanie identyczne jak przed VLT-001.
      const requestedScope = parseVaultScope(req.body?.scope) || 'organization';
      const rawProjectId =
        typeof req.body?.project_id === 'string' && req.body.project_id.trim()
          ? req.body.project_id.trim()
          : typeof req.body?.projectId === 'string' && req.body.projectId.trim()
            ? req.body.projectId.trim()
            : null;

      if (requestedScope === 'project') {
        if (!rawProjectId) {
          return res.status(400).json({ error: 'project_id wymagany dla scope=project' });
        }
        const canAccess = await contextDocumentService.canAccessProject({
          organizationId: orgId,
          userId: ownerId || '',
          projectId: rawProjectId,
          userRole: role,
        });
        if (!canAccess) {
          return res.status(403).json({ error: 'Brak dostępu do projektu' });
        }
      }
      const projectId = requestedScope === 'project' ? rawProjectId : null;

      // Move file to local storage (org-scoped; global docs => project_id NULL)
      const safeName = String(path.basename(originalname || 'document'))
        .replace(/[/\\]+/g, '_')
        .replace(/\s+/g, ' ')
        .trim();
      const destDir = uploadsDir('knowledge', orgId);
      const finalPath = path.join(destDir, `${Date.now()}-${safeName}`);
      try {
        fs.renameSync(tempPath, finalPath);
        tempPath = null;
      } catch (_moveErr) {
        // Fallback for cross-device moves
        fs.copyFileSync(tempPath, finalPath);
        fs.unlinkSync(tempPath);
        tempPath = null;
      }

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
        undefined,
        ownerId,
        requestedScope
      );

      // Extract Text (HP-23: PDF/TXT/MD/CSV/DOCX/XLSX/PPTX — wspólny ekstraktor,
      // wynik trafia do TEGO SAMEGO chunking+embedding co dotąd PDF).
      let text = '';
      try {
        text = await extractDocumentText(finalPath, mimetype);
      } catch (extractErr) {
        logger.error('Document text extraction error', extractErr);
        text = '';
      }

      // Process & Index (Async)
      const chunkCount = await KnowledgeService.processDocument(docId, text);

      // Record storage usage (Organization Level)
      if (recordStorageAfterUpload) {
        await recordStorageAfterUpload(req, size, 'document_upload');
      }

      return res.json({ message: 'Document uploaded and indexed', docId, chunkCount });
    } catch (err: any) {
      logger.error('[Knowledge] Upload document failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      // Cleanup temp file if it still exists
      if (tempPath && fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch (e) {}
      }
      return res.status(500).json({ error: 'Nie udało się przesłać dokumentu', code: 'KNOWLEDGE_DOCUMENT_UPLOAD_FAILED' });
    }
    return;
  })
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
      return notConfigured(res);
    }

    try {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      const role = req.user?.role || 'USER';
      const category = req.query.category as string | undefined;
      const strategyId = req.query.strategy_id as string | undefined;

      if (!orgId) {
        return res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // ★ VLT-001: scope opcjonalny w query (?scope=user|project|organization&project_id=...).
      // Brak scope = widok domyślny (własne prywatne + organizacyjne + projekty, których user
      // jest członkiem). Bez tego GET dziś (przed VLT-001) ignorował userId/role całkowicie.
      const requestedScope = parseVaultScope(req.query.scope);
      const requestedProjectId =
        typeof req.query.project_id === 'string' && req.query.project_id.trim()
          ? req.query.project_id.trim()
          : null;

      if (requestedScope === 'project' && requestedProjectId && userId) {
        const canAccess = await contextDocumentService.canAccessProject({
          organizationId: orgId,
          userId,
          projectId: requestedProjectId,
          userRole: role,
        });
        if (!canAccess) {
          return res.status(403).json({ error: 'Brak dostępu do projektu' });
        }
      }

      let docs: any[];
      if (strategyId) {
        docs = await KnowledgeService.getDocumentsByStrategy(strategyId);
      } else if (category) {
        docs = await KnowledgeService.getDocumentsByCategory(orgId, category);
      } else {
        const memberProjectIds = userId ? await getMemberProjectIds(userId) : [];
        docs = await KnowledgeService.getDocuments(orgId, userId, role, {
          scope: requestedScope,
          projectId: requestedProjectId,
          memberProjectIds,
        });
      }

      // Parse JSON fields
      const parsed = docs.map((doc: any) => ({
        ...doc,
        tags: doc.tags ? (typeof doc.tags === 'string' ? JSON.parse(doc.tags) : doc.tags) : [],
      }));

      return res.json(parsed);
    } catch (err: any) {
      logger.error('[Knowledge] Get documents failed', { err, correlationId: (req as any).correlationId });
      return res.status(500).json({ error: 'Nie udało się pobrać dokumentów wiedzy', code: 'KNOWLEDGE_DOCUMENTS_LIST_FAILED' });
    }
    return;
  })
);

/**
 * ★ VLT-002 — czy `req.user` wolno edytować dany dokument Vault? SuperAdmin zawsze;
 * poza tym wyłącznie właściciel WŁASNEGO prywatnego dokumentu (`scope='user' AND
 * owner_id=self`) — zgodnie z zadaniem VLT-002 pkt 3 (klient dostawał 403 przy
 * edycji własnego dokumentu, bo PUT wymuszał `requireSuperAdmin` bezwarunkowo).
 * Dokumentów project/organization NIE odblokowujemy tu dla zwykłych userów — to
 * pozostaje SuperAdmin-only (poza zakresem tego zadania).
 */
function canEditOwnPrivateDocument(req: AuthRequest, doc: any): boolean {
  if (req.user?.isSuperAdmin === true) return true;
  const userId = req.user?.id;
  if (!userId || !doc) return false;
  return doc.scope === 'user' && String(doc.owner_id || '') === String(userId);
}

/**
 * PUT /api/knowledge/documents/:id
 * Update knowledge document metadata. SuperAdmin, or the owner of their own
 * private (scope='user') document — patrz `canEditOwnPrivateDocument`.
 */
router.put(
  '/documents/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.updateDocumentMetadata || !KnowledgeService?.getDocumentById) {
      return notConfigured(res);
    }

    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;

    const doc = await KnowledgeService.getDocumentById(orgId, id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (!canEditOwnPrivateDocument(req, doc)) {
      return res.status(403).json({ error: 'Super admin access required' });
    }

    const { category, tags } = req.body || {};

    if (category !== undefined && category !== null && typeof category !== 'string') {
      return res.status(400).json({ error: 'Invalid category' });
    }
    if (tags !== undefined && tags !== null && !Array.isArray(tags)) {
      return res.status(400).json({ error: 'Invalid tags' });
    }

    const result = await KnowledgeService.updateDocumentMetadata(orgId, id, {
      category: category ?? null,
      tags: Array.isArray(tags) ? tags : null,
    });

    return res.json({ success: true, ...result });
  })
);

/**
 * GET /api/knowledge/documents/:id/scope-impact
 * ★ VLT-002 (DEC-003) — DRY-RUN, nie zapisuje nic. Zwraca `becameOrgVisibleCount`
 * dla żądanego `?scope=` — frontend (VLT-003) woła to PRZED PATCH .../scope, żeby
 * pokazać ostrzeżenie „X dokumentów stanie się widocznych dla całej organizacji"
 * i dać użytkownikowi anulować bez żadnej zmiany w bazie.
 */
router.get(
  '/documents/:id/scope-impact',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.getDocumentById) return notConfigured(res);

    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const requestedScope = parseVaultScope(req.query.scope);
    if (!requestedScope) {
      return res
        .status(400)
        .json({ error: 'scope musi być jednym z: user, project, organization' });
    }

    const doc = await KnowledgeService.getDocumentById(orgId, id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (!canEditOwnPrivateDocument(req, doc)) {
      return res.status(403).json({ error: 'Super admin access required' });
    }

    const previousScope = doc.scope || 'organization'; // legacy scope IS NULL == 'organization'
    const becameOrgVisibleCount =
      previousScope !== 'organization' && requestedScope === 'organization' ? 1 : 0;

    return res.json({ previousScope, requestedScope, becameOrgVisibleCount });
  })
);

/**
 * PATCH /api/knowledge/documents/:id/scope
 * ★ VLT-002 (DEC-003) — faktyczna zmiana poziomu. Body: { scope, project_id? }.
 * Zwraca ten sam `becameOrgVisibleCount` co dry-run wyżej (po fakcie) — frontend
 * pokazuje ostrzeżenie z /scope-impact, user potwierdza, DOPIERO wtedy wołany jest
 * ten endpoint; anulowanie w UI = po prostu nie wywołuj PATCH (dokument zostaje
 * bez zmian, patrz KRYTERIUM ODBIORU zadania).
 */
router.patch(
  '/documents/:id/scope',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.getDocumentById || !KnowledgeService?.updateDocumentScope) {
      return notConfigured(res);
    }

    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const role = req.user?.role || 'USER';
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const requestedScope = parseVaultScope(req.body?.scope);
    if (!requestedScope) {
      return res
        .status(400)
        .json({ error: 'scope musi być jednym z: user, project, organization' });
    }

    const doc = await KnowledgeService.getDocumentById(orgId, id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (!canEditOwnPrivateDocument(req, doc)) {
      return res.status(403).json({ error: 'Super admin access required' });
    }

    const rawProjectId =
      typeof req.body?.project_id === 'string' && req.body.project_id.trim()
        ? req.body.project_id.trim()
        : null;

    if (requestedScope === 'project') {
      if (!rawProjectId) {
        return res.status(400).json({ error: 'project_id wymagany dla scope=project' });
      }
      const canAccess = await contextDocumentService.canAccessProject({
        organizationId: orgId,
        userId: userId || '',
        projectId: rawProjectId,
        userRole: role,
      });
      if (!canAccess) {
        return res.status(403).json({ error: 'Brak dostępu do projektu' });
      }
    }

    const result = await KnowledgeService.updateDocumentScope(
      orgId,
      id,
      requestedScope,
      rawProjectId
    );
    if (!result.updated) return res.status(404).json({ error: 'Document not found' });

    return res.json({ success: true, ...result });
  })
);

/**
 * DELETE /api/knowledge/documents/:id
 * Soft-delete a knowledge document (sets deleted_at). Org-scoped.
 */
router.delete(
  '/documents/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Missing document id' });

    const result = await KnowledgeService.deleteDocument(orgId, id);
    if (!result.deleted) return res.status(404).json({ error: 'Document not found' });

    return res.json({ success: true, deleted: id });
  })
);

export default router;
