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
// ★ MW-10 — jedno źródło uprawnień do dokumentu Vault (dokument I każda jego
// wersja liczone TYM SAMYM predykatem) + kanoniczna historia wersji.
import {
  canDeleteDocument,
  canMutateDocument,
  canReadDocument,
  type VaultAccessContext,
} from '../services/vault/vaultDocumentAccess.js';
import vaultVersions from '../services/vault/vaultDocumentVersionService.js';
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

/**
 * ★ MW-10 — ta sama normalizacja nazwy, którą stosuje
 * `KnowledgeService.addDocument` (`safeFilename`, KnowledgeService.ts:56).
 * Wiersz wersji musi nieść DOKŁADNIE tę nazwę, którą dostał wiersz dokumentu,
 * inaczej „aktualna wersja" i dokument rozjeżdżają się w nazwie pliku.
 */
const safeFilenameForVersion = (name: string): string =>
  String(name || 'document')
    .replace(/[/\\]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * ★ MW-10 — kontekst uprawnień wołającego, budowany RAZ i podawany do
 * `vaultDocumentAccess`. Dzięki temu handler dokumentu i handlery wersji nie
 * mogą się rozjechać (kontrakt pkt 6).
 */
async function buildVaultAccessContext(req: AuthRequest): Promise<VaultAccessContext> {
  const userId = req.user?.id || null;
  return {
    organizationId: String(req.user?.organizationId || ''),
    userId,
    isSuperAdmin: req.user?.isSuperAdmin === true,
    memberProjectIds: userId ? await getMemberProjectIds(userId) : [],
  };
}

/** Kształt wersji wystawiany na zewnątrz — stabilne ID, autor, znacznik czasu. */
const serializeVersion = (v: any) => ({
  versionId: v.versionId,
  documentId: v.documentId,
  versionNumber: v.versionNumber,
  filename: v.filename,
  fileSizeBytes: v.fileSizeBytes,
  contentHash: v.contentHash,
  chunkCount: v.chunkCount,
  origin: v.origin,
  restoredFromVersion: v.restoredFromVersion,
  note: v.note,
  createdBy: v.createdBy,
  createdAt: v.createdAt,
});

/**
 * Wczytuje dokument + od razu rozstrzyga uprawnienie. Zwraca gotową odpowiedź
 * HTTP zamiast rzucać — wszystkie ścieżki wersji wchodzą przez tę bramkę, więc
 * 404/403 wyglądają identycznie dla dokumentu i dla wersji.
 */
async function loadVaultDocumentForRequest(
  req: AuthRequest,
  res: Response,
  documentId: string,
  need: 'read' | 'mutate' | 'delete'
): Promise<{ doc: any; ctx: VaultAccessContext } | null> {
  const orgId = req.user?.organizationId;
  if (!orgId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  const doc = await KnowledgeService.getDocumentById(orgId, documentId);
  const ctx = await buildVaultAccessContext(req);

  // Brak prawa ODCZYTU nie może zdradzać istnienia dokumentu → 404, nie 403.
  if (!canReadDocument(doc, ctx)) {
    res.status(404).json({ error: 'Document not found' });
    return null;
  }
  if (need === 'mutate' && !canMutateDocument(doc, ctx)) {
    res.status(403).json({ error: 'Brak uprawnień do edycji dokumentu' });
    return null;
  }
  if (need === 'delete' && !canDeleteDocument(doc, ctx)) {
    res.status(403).json({ error: 'Brak uprawnień do usunięcia dokumentu' });
    return null;
  }
  return { doc, ctx };
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
      logger.error('[Knowledge] Get candidates failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się pobrać kandydatów wiedzy',
        code: 'KNOWLEDGE_CANDIDATES_LIST_FAILED',
      });
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
      logger.error('[Knowledge] Add candidate failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się zgłosić kandydata',
        code: 'KNOWLEDGE_CANDIDATE_CREATE_FAILED',
      });
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
      logger.error('[Knowledge] Update candidate status failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się zaktualizować statusu kandydata',
        code: 'KNOWLEDGE_CANDIDATE_STATUS_UPDATE_FAILED',
      });
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
      logger.error('[Knowledge] Update candidate failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się zaktualizować kandydata',
        code: 'KNOWLEDGE_CANDIDATE_UPDATE_FAILED',
      });
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
      logger.error('[Knowledge] Link idea to project failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się powiązać pomysłu z projektem',
        code: 'KNOWLEDGE_CANDIDATE_LINK_PROJECT_FAILED',
      });
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
      logger.error('[Knowledge] Get approved ideas failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się pobrać zatwierdzonych pomysłów',
        code: 'KNOWLEDGE_CANDIDATES_APPROVED_FAILED',
      });
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
      logger.error('[Knowledge] Get ideas by category failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się pobrać pomysłów wg kategorii',
        code: 'KNOWLEDGE_CANDIDATES_BY_CATEGORY_FAILED',
      });
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
      logger.error('[Knowledge] Get ideas by project failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się pobrać pomysłów wg projektu',
        code: 'KNOWLEDGE_CANDIDATES_BY_PROJECT_FAILED',
      });
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
      logger.error('[Knowledge] Get strategies failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się pobrać strategii',
        code: 'KNOWLEDGE_STRATEGIES_LIST_FAILED',
      });
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
      logger.error('[Knowledge] Create strategy failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się utworzyć strategii',
        code: 'KNOWLEDGE_STRATEGY_CREATE_FAILED',
      });
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
      logger.error('[Knowledge] Update strategy failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się zaktualizować strategii',
        code: 'KNOWLEDGE_STRATEGY_UPDATE_FAILED',
      });
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
      logger.error('[Knowledge] Link strategy to document failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się powiązać dokumentu ze strategią',
        code: 'KNOWLEDGE_STRATEGY_LINK_DOCUMENT_FAILED',
      });
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
      logger.error('[Knowledge] Link strategy to idea failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się powiązać pomysłu ze strategią',
        code: 'KNOWLEDGE_STRATEGY_LINK_IDEA_FAILED',
      });
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
      logger.error('[Knowledge] Unlink strategy from document failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się odłączyć dokumentu od strategii',
        code: 'KNOWLEDGE_STRATEGY_UNLINK_DOCUMENT_FAILED',
      });
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
      logger.error('[Knowledge] Unlink strategy from idea failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się odłączyć pomysłu od strategii',
        code: 'KNOWLEDGE_STRATEGY_UNLINK_IDEA_FAILED',
      });
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
      logger.error('[Knowledge] Update strategy progress failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się zaktualizować postępu strategii',
        code: 'KNOWLEDGE_STRATEGY_PROGRESS_UPDATE_FAILED',
      });
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
      logger.error('[Knowledge] Get strategy with related failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się pobrać strategii z powiązaniami',
        code: 'KNOWLEDGE_STRATEGY_RELATED_FAILED',
      });
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
      logger.error('[Knowledge] Toggle strategy failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się przełączyć strategii',
        code: 'KNOWLEDGE_STRATEGY_TOGGLE_FAILED',
      });
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
      const chunkCount = await KnowledgeService.processDocument(docId, text, orgId);

      // ★ MW-10 (kontrakt pkt 1) — upload zakłada dokument I wersję 1. Wiersz
      // wersji niesie własny, niezmienny snapshot (`finalPath` + sha256), więc
      // późniejsza edycja nigdy nie kasuje treści pierwszej wersji.
      let initialVersion: any = null;
      try {
        initialVersion = await vaultVersions.recordInitialVersion({
          organizationId: orgId,
          documentId: docId,
          filename: safeFilenameForVersion(originalname),
          filepath: finalPath,
          fileSizeBytes: Number.isFinite(Number(size)) ? Number(size) : null,
          chunkCount,
          createdBy: ownerId || null,
        });
      } catch (versionErr: any) {
        logger.error('[Knowledge] Initial version record failed', {
          err: versionErr,
          docId,
          correlationId: (req as any).correlationId,
        });
      }

      // Record storage usage (Organization Level)
      if (recordStorageAfterUpload) {
        await recordStorageAfterUpload(req, size, 'document_upload');
      }

      return res.json({
        message: 'Document uploaded and indexed',
        docId,
        chunkCount,
        version: initialVersion ? initialVersion.versionNumber : 1,
        versionId: initialVersion ? initialVersion.versionId : null,
      });
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
      return res.status(500).json({
        error: 'Nie udało się przesłać dokumentu',
        code: 'KNOWLEDGE_DOCUMENT_UPLOAD_FAILED',
      });
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
      logger.error('[Knowledge] Get documents failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się pobrać dokumentów wiedzy',
        code: 'KNOWLEDGE_DOCUMENTS_LIST_FAILED',
      });
    }
    return;
  })
);

/**
 * GET /api/knowledge/vault-safes
 * ★ VLT-005 — warstwa tabeli sejfów PRZED narzędziem Vault (menu → tabela → dokumenty).
 * Sejf = klient/projekt (decyzja Piotra, zero nowej tabeli) — reużywa `knowledge_docs.scope`
 * + `project_members` (ta sama lista co `/projects/my-memberships`, patrz
 * getMemberProjectIds powyżej). Zwraca [Mój sejf] (scope=user, tylko dokumenty
 * właściciela) + [Sejf organizacji] (scope=organization) + po jednym na projekt, w
 * którym wołający jest członkiem — z licznikiem dokumentów i datą ostatniej zmiany,
 * jednym zapytaniem GROUP BY (bez N+1).
 */
router.get(
  '/vault-safes',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const memberProjectIds = await getMemberProjectIds(userId);

      // ★ Kolumny „Rozmiar" / „W wiedzy AI" / „Błędy indeksowania" (research Harvey
      // Vault + kanon nazw z tabeli dokumentów, patrz VaultDocumentsView.tsx
      // `colChunks`/`colSize`) — policzone TYM SAMYM zapytaniem GROUP BY, zero N+1.
      const grouped = await DbPromise.all<{
        scope: string | null;
        project_id: string | null;
        owner_id: string | null;
        cnt: number;
        last_modified: string | null;
        size_bytes: number | null;
        indexed_cnt: number;
        error_cnt: number;
      }>(
        `SELECT scope, project_id, owner_id, COUNT(*) as cnt, MAX(updated_at) as last_modified,
                SUM(COALESCE(file_size_bytes, 0)) as size_bytes,
                SUM(CASE WHEN chunk_count > 0 THEN 1 ELSE 0 END) as indexed_cnt,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_cnt
         FROM knowledge_docs
         WHERE (organization_id = ? OR organization_id IS NULL) AND deleted_at IS NULL
         GROUP BY scope, project_id, owner_id`,
        [orgId],
        { fallback: true } as any
      );
      const rows = grouped || [];

      const mergeLatest = (a: string | null, b: string | null): string | null => {
        if (!a) return b;
        if (!b) return a;
        return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
      };

      // [Mój sejf] — WYŁĄCZNIE dokumenty prywatne (scope='user'), których
      // właścicielem jest wołający (nie inni userzy organizacji).
      let myCount = 0;
      let myLast: string | null = null;
      let mySize = 0;
      let myIndexed = 0;
      let myErrors = 0;
      // [Sejf organizacji] — scope='organization' (albo NULL, patrz KnowledgeService.getDocuments).
      let orgCount = 0;
      let orgLast: string | null = null;
      let orgSize = 0;
      let orgIndexed = 0;
      let orgErrors = 0;
      // Sejfy per projekt — scope='project', policzone tylko dla projektów,
      // w których wołający jest członkiem (memberProjectIds).
      const projectCounts = new Map<
        string,
        { cnt: number; last: string | null; size: number; indexed: number; errors: number }
      >();

      for (const row of rows) {
        const cnt = Number(row.cnt) || 0;
        const size = Number(row.size_bytes) || 0;
        const indexed = Number(row.indexed_cnt) || 0;
        const errors = Number(row.error_cnt) || 0;
        if (row.scope === 'user') {
          if (String(row.owner_id || '') === String(userId)) {
            myCount += cnt;
            myLast = mergeLatest(myLast, row.last_modified);
            mySize += size;
            myIndexed += indexed;
            myErrors += errors;
          }
        } else if (row.scope === 'organization' || !row.scope) {
          orgCount += cnt;
          orgLast = mergeLatest(orgLast, row.last_modified);
          orgSize += size;
          orgIndexed += indexed;
          orgErrors += errors;
        } else if (row.scope === 'project' && row.project_id) {
          const pid = String(row.project_id);
          if (memberProjectIds.includes(pid)) {
            const prev = projectCounts.get(pid) || {
              cnt: 0,
              last: null,
              size: 0,
              indexed: 0,
              errors: 0,
            };
            projectCounts.set(pid, {
              cnt: prev.cnt + cnt,
              last: mergeLatest(prev.last, row.last_modified),
              size: prev.size + size,
              indexed: prev.indexed + indexed,
              errors: prev.errors + errors,
            });
          }
        }
      }

      let projectNames = new Map<string, string>();
      if (memberProjectIds.length > 0) {
        const placeholders = memberProjectIds.map(() => '?').join(',');
        const projectRows = await DbPromise.all<{ id: string; name: string }>(
          `SELECT id, name FROM projects WHERE id IN (${placeholders})`,
          memberProjectIds,
          { fallback: true } as any
        );
        projectNames = new Map((projectRows || []).map((p) => [String(p.id), String(p.name)]));
      }

      const safes = [
        {
          id: 'user',
          type: 'user' as const,
          projectId: null,
          name: 'Mój sejf',
          documentCount: myCount,
          lastModified: myLast,
          sizeBytes: mySize,
          indexedCount: myIndexed,
          errorCount: myErrors,
        },
        {
          id: 'organization',
          type: 'organization' as const,
          projectId: null,
          name: 'Sejf organizacji',
          documentCount: orgCount,
          lastModified: orgLast,
          sizeBytes: orgSize,
          indexedCount: orgIndexed,
          errorCount: orgErrors,
        },
        ...memberProjectIds.map((pid) => {
          const counted = projectCounts.get(pid) || {
            cnt: 0,
            last: null,
            size: 0,
            indexed: 0,
            errors: 0,
          };
          return {
            id: `project:${pid}`,
            type: 'project' as const,
            projectId: pid,
            name: projectNames.get(pid) || 'Untitled project',
            documentCount: counted.cnt,
            lastModified: counted.last,
            sizeBytes: counted.size,
            indexedCount: counted.indexed,
            errorCount: counted.errors,
          };
        }),
      ];

      return res.json({ safes });
    } catch (err: any) {
      logger.error('[Knowledge] Get vault safes failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Nie udało się pobrać listy sejfów', code: 'KNOWLEDGE_VAULT_SAFES_FAILED' });
    }
  })
);

/**
 * ★ VLT-FOLDERS — foldery WEWNĄTRZ sejfu Vault (dzielą temat, nie granicę
 * bezpieczeństwa — sejf/scope zostaje jedyną granicą dostępu, decyzja
 * właściciela). Folder NIE niesie własnego pola poziomu: `scope`/`project_id`
 * są nadawane RAZ przy tworzeniu (dziedziczą po sejfie, w którym folder
 * powstał) i widoczność liczy DOKŁADNIE ta sama reguła co dla dokumentów
 * (`KnowledgeService.getDocuments`/`getFolders`, ta sama gałąź WHERE).
 *
 * GET    /vault-folders?scope=&project_id=  — lista folderów w JEDNYM sejfie
 * POST   /vault-folders                     — nowy folder (scope/projectId wymagane)
 * PUT    /vault-folders/:id                 — rename/opis/kolor — TYLKO twórca
 * DELETE /vault-folders/:id                 — usuń — TYLKO twórca; dokumenty zostają, odpięte
 */
router.get(
  '/vault-folders',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.getFolders) return notConfigured(res);
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

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
        userRole: req.user?.role || 'USER',
      });
      if (!canAccess) return res.status(403).json({ error: 'Brak dostępu do projektu' });
    }

    try {
      const memberProjectIds = userId ? await getMemberProjectIds(userId) : [];
      const folders = await KnowledgeService.getFolders(orgId, userId, {
        scope: requestedScope,
        projectId: requestedProjectId,
        memberProjectIds,
      });
      return res.json(
        folders.map((f: any) => ({
          id: f.id,
          name: f.name,
          description: f.description ?? null,
          color: f.color ?? null,
          scope: f.scope,
          projectId: f.project_id ?? null,
          ownerId: f.owner_id,
          parentFolderId: f.parent_folder_id ?? null,
          createdAt: f.created_at,
          updatedAt: f.updated_at,
        }))
      );
    } catch (err: any) {
      logger.error('[Knowledge] Get vault folders failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Nie udało się pobrać folderów', code: 'KNOWLEDGE_VAULT_FOLDERS_FAILED' });
    }
  })
);

router.post(
  '/vault-folders',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.createFolder) return notConfigured(res);
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name is required' });

    const scope = parseVaultScope(req.body?.scope);
    if (!scope) {
      return res.status(400).json({ error: 'scope is required (user|project|organization)' });
    }

    const rawProjectId =
      typeof req.body?.projectId === 'string' && req.body.projectId.trim()
        ? req.body.projectId.trim()
        : typeof req.body?.project_id === 'string' && req.body.project_id.trim()
          ? req.body.project_id.trim()
          : null;

    if (scope === 'project') {
      if (!rawProjectId) {
        return res.status(400).json({ error: 'projectId wymagany dla scope=project' });
      }
      const canAccess = await contextDocumentService.canAccessProject({
        organizationId: orgId,
        userId,
        projectId: rawProjectId,
        userRole: req.user?.role || 'USER',
      });
      if (!canAccess) return res.status(403).json({ error: 'Brak dostępu do projektu' });
    }

    try {
      const created = await KnowledgeService.createFolder(orgId, userId, {
        name,
        description: typeof req.body?.description === 'string' ? req.body.description : null,
        color: req.body?.color ? String(req.body.color) : null,
        parentFolderId: req.body?.parentFolderId ? String(req.body.parentFolderId) : null,
        scope,
        projectId: scope === 'project' ? rawProjectId : null,
      });
      return res.status(201).json(created);
    } catch (err: any) {
      logger.error('[Knowledge] Create vault folder failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się utworzyć folderu',
        code: 'KNOWLEDGE_VAULT_FOLDER_CREATE_FAILED',
      });
    }
  })
);

router.put(
  '/vault-folders/:folderId',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.updateFolder) return notConfigured(res);
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const { folderId } = req.params;
    const { name, description, color, parentFolderId } = req.body || {};
    try {
      const result = await KnowledgeService.updateFolder(orgId, userId, folderId, {
        name: typeof name === 'string' ? name : undefined,
        description: description !== undefined ? description : undefined,
        color: color !== undefined ? color : undefined,
        parentFolderId: parentFolderId !== undefined ? parentFolderId : undefined,
      });
      return res.json({ success: true, ...result });
    } catch (err: any) {
      logger.error('[Knowledge] Update vault folder failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się zaktualizować folderu',
        code: 'KNOWLEDGE_VAULT_FOLDER_UPDATE_FAILED',
      });
    }
  })
);

router.delete(
  '/vault-folders/:folderId',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.deleteFolder) return notConfigured(res);
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const { folderId } = req.params;
    try {
      const result = await KnowledgeService.deleteFolder(orgId, userId, folderId);
      return res.json({ success: true, ...result });
    } catch (err: any) {
      logger.error('[Knowledge] Delete vault folder failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się usunąć folderu',
        code: 'KNOWLEDGE_VAULT_FOLDER_DELETE_FAILED',
      });
    }
  })
);

/**
 * ★ VLT-002 / ★ MW-10 — reguła „kto może zmieniać dokument Vault" (SuperAdmin
 * albo właściciel WŁASNEGO dokumentu prywatnego) przeniesiona 1:1 do
 * `services/vault/vaultDocumentAccess.ts` i wołana przez
 * `loadVaultDocumentForRequest`. Dokumenty project/organization pozostają
 * SuperAdmin-only — bez zmiany względem VLT-002.
 */

/**
 * GET /api/knowledge/documents/:id
 * ★ MW-10 (kontrakt pkt 5) — świeży odczyt POJEDYNCZEGO dokumentu. Przed MW-10
 * takiego endpointu nie było wcale: UI potrafił dojść do dokumentu wyłącznie
 * przez listę, więc twardy reload/deep-link nie miał czego zawołać.
 */
router.get(
  '/documents/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.getDocumentById) return notConfigured(res);
    const gate = await loadVaultDocumentForRequest(req, res, req.params.id, 'read');
    if (!gate) return;

    const versions = await vaultVersions.listVersions(gate.ctx.organizationId, gate.doc.id);
    const currentVersionNumber = Number(gate.doc.version) || versions[0]?.versionNumber || 1;
    const current =
      versions.find((v: any) => v.versionNumber === currentVersionNumber) || versions[0] || null;

    return res.json({
      ...gate.doc,
      version: currentVersionNumber,
      versionCount: versions.length,
      currentVersion: current ? serializeVersion(current) : null,
      permissions: {
        canEdit: canMutateDocument(gate.doc, gate.ctx),
        canDelete: canDeleteDocument(gate.doc, gate.ctx),
      },
    });
  })
);

/**
 * GET /api/knowledge/documents/:id/versions
 * ★ MW-10 (kontrakt pkt 3) — historia ze stabilnym `versionId`, autorem i czasem.
 */
router.get(
  '/documents/:id/versions',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.getDocumentById) return notConfigured(res);
    const gate = await loadVaultDocumentForRequest(req, res, req.params.id, 'read');
    if (!gate) return;

    const versions = await vaultVersions.listVersions(gate.ctx.organizationId, gate.doc.id);
    return res.json({
      documentId: gate.doc.id,
      currentVersion: Number(gate.doc.version) || versions[0]?.versionNumber || 1,
      versions: versions.map(serializeVersion),
    });
  })
);

/**
 * GET /api/knowledge/documents/:id/versions/:versionNumber
 * Metadane pojedynczej wersji. Uprawnienie IDENTYCZNE jak dla dokumentu
 * (kontrakt pkt 6) — bo idzie przez tę samą bramkę.
 */
router.get(
  '/documents/:id/versions/:versionNumber',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.getDocumentById) return notConfigured(res);
    const gate = await loadVaultDocumentForRequest(req, res, req.params.id, 'read');
    if (!gate) return;

    const versionNumber = Number(req.params.versionNumber);
    if (!Number.isInteger(versionNumber) || versionNumber < 1) {
      return res.status(400).json({ error: 'versionNumber musi być dodatnią liczbą całkowitą' });
    }
    const version = await vaultVersions.getVersion(
      gate.ctx.organizationId,
      gate.doc.id,
      versionNumber
    );
    if (!version) return res.status(404).json({ error: 'Version not found' });
    return res.json(serializeVersion(version));
  })
);

/**
 * POST /api/knowledge/documents/:id/versions
 * ★ MW-10 (kontrakt pkt 2 + 10) — nowa treść dokumentu = KOLEJNA, niezmienna
 * wersja. `expectedVersion` w body to token CAS: jeżeli w międzyczasie ktoś
 * zapisał swoją wersję, dostajesz 409 z aktualnym numerem — nigdy cichego
 * nadpisania (last-write-wins).
 */
router.post(
  '/documents/:id/versions',
  verifyToken,
  enforceStorageQuota || ((_req: AuthRequest, _res: Response, next: NextFunction) => next()),
  upload.single('file'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    let tempPath: string | null = req.file?.path || null;
    const dropTemp = () => {
      if (tempPath && fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch {
          /* best effort */
        }
      }
      tempPath = null;
    };

    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      if (!KnowledgeService?.getDocumentById || !KnowledgeService?.processDocument) {
        return notConfigured(res);
      }

      const gate = await loadVaultDocumentForRequest(req, res, req.params.id, 'mutate');
      if (!gate) return dropTemp();

      const rawExpected = req.body?.expectedVersion;
      let expectedVersion: number | null = null;
      if (rawExpected !== undefined && rawExpected !== null && String(rawExpected).trim() !== '') {
        expectedVersion = Number(rawExpected);
        if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
          dropTemp();
          return res.status(400).json({ error: 'expectedVersion musi być liczbą całkowitą' });
        }
      }

      const claim = await vaultVersions.claimNextVersion({
        organizationId: gate.ctx.organizationId,
        documentId: gate.doc.id,
        expectedVersion,
      });
      if (!claim.ok) {
        dropTemp();
        if (claim.reason === 'not_found') {
          return res.status(404).json({ error: 'Document not found' });
        }
        return res.status(409).json({
          error: 'Dokument zmienił się w międzyczasie — odśwież i spróbuj ponownie',
          code: 'VAULT_VERSION_CONFLICT',
          currentVersion: claim.currentVersion,
          expectedVersion,
        });
      }

      const filename = safeFilenameForVersion(req.file.originalname);
      const finalPath = vaultVersions.buildVersionFilePath(gate.ctx.organizationId, filename);
      try {
        fs.renameSync(tempPath as string, finalPath);
      } catch {
        fs.copyFileSync(tempPath as string, finalPath);
        fs.unlinkSync(tempPath as string);
      }
      tempPath = null;

      let text = '';
      try {
        text = await extractDocumentText(finalPath, req.file.mimetype);
      } catch (extractErr) {
        logger.error('Document text extraction error', extractErr);
        text = '';
      }

      let chunkCount = 0;
      try {
        chunkCount = await KnowledgeService.processDocument(
          gate.doc.id,
          text,
          gate.ctx.organizationId
        );
      } catch (indexErr) {
        logger.error('[Knowledge] Reindex on new version failed', { err: indexErr });
      }

      let version;
      try {
        version = await vaultVersions.commitVersion({
          organizationId: gate.ctx.organizationId,
          documentId: gate.doc.id,
          versionNumber: claim.nextVersion,
          filename,
          filepath: finalPath,
          fileSizeBytes: Number.isFinite(Number(req.file.size)) ? Number(req.file.size) : null,
          contentHash: vaultVersions.hashFile(finalPath),
          chunkCount,
          origin: 'edit',
          note: typeof req.body?.note === 'string' ? req.body.note.slice(0, 500) : null,
          createdBy: gate.ctx.userId,
        });
      } catch (commitErr: any) {
        // Kompensacja: wskaźnik został już podbity przez CAS, a wiersz wersji
        // nie powstał — cofamy wskaźnik, żeby dokument nie wskazywał na wersję,
        // której nie ma.
        await vaultVersions.releaseVersionClaim({
          organizationId: gate.ctx.organizationId,
          documentId: gate.doc.id,
          previousVersion: claim.previousVersion,
          claimedVersion: claim.nextVersion,
        });
        throw commitErr;
      }

      if (recordStorageAfterUpload) {
        await recordStorageAfterUpload(req, req.file.size, 'document_upload');
      }

      return res.status(201).json({
        documentId: gate.doc.id,
        version: serializeVersion(version),
        currentVersion: claim.nextVersion,
      });
    } catch (err: any) {
      dropTemp();
      logger.error('[Knowledge] Create document version failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się zapisać nowej wersji dokumentu',
        code: 'VAULT_VERSION_CREATE_FAILED',
      });
    }
  })
);

/**
 * POST /api/knowledge/documents/:id/versions/:versionNumber/restore
 * ★ MW-10 (kontrakt pkt 4) — restore NIE nadpisuje historii. Tworzy KOLEJNĄ
 * wersję, której treść jest kopią wskazanej wersji, a wiersz niesie
 * `origin='restore'` + `restoredFromVersion` (provenance).
 */
router.post(
  '/documents/:id/versions/:versionNumber/restore',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.getDocumentById) return notConfigured(res);

    const gate = await loadVaultDocumentForRequest(req, res, req.params.id, 'mutate');
    if (!gate) return;

    const sourceNumber = Number(req.params.versionNumber);
    if (!Number.isInteger(sourceNumber) || sourceNumber < 1) {
      return res.status(400).json({ error: 'versionNumber musi być dodatnią liczbą całkowitą' });
    }
    const source = await vaultVersions.getVersion(
      gate.ctx.organizationId,
      gate.doc.id,
      sourceNumber
    );
    if (!source) return res.status(404).json({ error: 'Version not found' });

    const rawExpected = req.body?.expectedVersion;
    let expectedVersion: number | null = null;
    if (rawExpected !== undefined && rawExpected !== null && String(rawExpected).trim() !== '') {
      expectedVersion = Number(rawExpected);
      if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
        return res.status(400).json({ error: 'expectedVersion musi być liczbą całkowitą' });
      }
    }

    const claim = await vaultVersions.claimNextVersion({
      organizationId: gate.ctx.organizationId,
      documentId: gate.doc.id,
      expectedVersion,
    });
    if (!claim.ok) {
      if (claim.reason === 'not_found') {
        return res.status(404).json({ error: 'Document not found' });
      }
      return res.status(409).json({
        error: 'Dokument zmienił się w międzyczasie — odśwież i spróbuj ponownie',
        code: 'VAULT_VERSION_CONFLICT',
        currentVersion: claim.currentVersion,
        expectedVersion,
      });
    }

    try {
      // Kopia pliku, nie współdzielenie ścieżki — snapshot pozostaje niezmienny
      // nawet gdyby plik źródłowej wersji został kiedyś usunięty z dysku.
      const copied = source.filepath
        ? vaultVersions.copySnapshotFile(gate.ctx.organizationId, source.filepath, source.filename)
        : null;

      let chunkCount = source.chunkCount;
      if (copied?.filepath) {
        try {
          const text = await extractDocumentText(copied.filepath);
          chunkCount = await KnowledgeService.processDocument(
            gate.doc.id,
            text,
            gate.ctx.organizationId
          );
        } catch (indexErr) {
          logger.error('[Knowledge] Reindex on restore failed', { err: indexErr });
        }
      }

      const version = await vaultVersions.commitVersion({
        organizationId: gate.ctx.organizationId,
        documentId: gate.doc.id,
        versionNumber: claim.nextVersion,
        filename: source.filename,
        filepath: copied?.filepath ?? source.filepath,
        fileSizeBytes: copied?.sizeBytes ?? source.fileSizeBytes,
        contentHash: copied?.contentHash ?? source.contentHash,
        chunkCount,
        origin: 'restore',
        restoredFromVersion: sourceNumber,
        note: typeof req.body?.note === 'string' ? req.body.note.slice(0, 500) : null,
        createdBy: gate.ctx.userId,
      });

      return res.status(201).json({
        documentId: gate.doc.id,
        version: serializeVersion(version),
        currentVersion: claim.nextVersion,
        restoredFromVersion: sourceNumber,
      });
    } catch (err: any) {
      await vaultVersions.releaseVersionClaim({
        organizationId: gate.ctx.organizationId,
        documentId: gate.doc.id,
        previousVersion: claim.previousVersion,
        claimedVersion: claim.nextVersion,
      });
      logger.error('[Knowledge] Restore document version failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się przywrócić wersji dokumentu',
        code: 'VAULT_VERSION_RESTORE_FAILED',
      });
    }
  })
);

/**
 * PUT /api/knowledge/documents/:id
 * Update knowledge document metadata. SuperAdmin, or the owner of their own
 * private (scope='user') document — patrz `vaultDocumentAccess.canMutateDocument`.
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

    const gate = await loadVaultDocumentForRequest(req, res, id, 'mutate');
    if (!gate) return;
    const doc = gate.doc;

    const { category, tags, folderId } = req.body || {};

    if (category !== undefined && category !== null && typeof category !== 'string') {
      return res.status(400).json({ error: 'Invalid category' });
    }
    if (tags !== undefined && tags !== null && !Array.isArray(tags)) {
      return res.status(400).json({ error: 'Invalid tags' });
    }
    if (folderId !== undefined && folderId !== null && typeof folderId !== 'string') {
      return res.status(400).json({ error: 'Invalid folderId' });
    }

    // ★ VLT-FOLDERS — przypisanie do folderu (kebab wiersza „Przenieś do
    // folderu", VaultDocumentsView.tsx). Folder MUSI żyć w TYM SAMYM sejfie co
    // dokument (poziom + — dla project — projekt) — inaczej to byłaby furtka do
    // sklejenia dokumentu z folderem z innego, niewidocznego dla właściciela
    // dokumentu poziomu. `null`/`''` = odepnij (bez folderu).
    let resolvedFolderId: string | null | undefined;
    if (folderId !== undefined) {
      if (!folderId) {
        resolvedFolderId = null;
      } else if (KnowledgeService?.getFolderById) {
        const folder = await KnowledgeService.getFolderById(orgId, String(folderId));
        if (!folder) return res.status(400).json({ error: 'Folder not found' });
        const docScope = doc.scope || 'organization';
        if (folder.scope !== docScope) {
          return res.status(400).json({ error: 'Folder należy do innego poziomu sejfu' });
        }
        if (
          docScope === 'project' &&
          String(folder.project_id || '') !== String(doc.project_id || '')
        ) {
          return res.status(400).json({ error: 'Folder należy do innego projektu' });
        }
        resolvedFolderId = String(folderId);
      }
    }

    // ★ NAPRAWA PRZY OKAZJI: poprzednia wersja zawsze wysyłała `category ?? null`
    // / `Array.isArray(tags) ? tags : null` do `updateDocumentMetadata` — więc
    // KAŻDE PUT (np. samo `{ folderId }` z kebaba) zerowało category/tags, bo
    // `updates.category !== undefined` było zawsze prawdą. Teraz pola idą
    // WYŁĄCZNIE gdy faktycznie były w body (spójnie z kontraktem `updateDocumentMetadata`).
    const result = await KnowledgeService.updateDocumentMetadata(orgId, id, {
      ...(category !== undefined ? { category: category ?? null } : {}),
      ...(tags !== undefined ? { tags: Array.isArray(tags) ? tags : null } : {}),
      ...(resolvedFolderId !== undefined ? { folderId: resolvedFolderId } : {}),
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

    const gate = await loadVaultDocumentForRequest(req, res, id, 'mutate');
    if (!gate) return;
    const doc = gate.doc;

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

    const gate = await loadVaultDocumentForRequest(req, res, id, 'mutate');
    if (!gate) return;

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
 * Soft-delete a knowledge document (sets deleted_at).
 *
 * ★ MW-10 — DWIE zmiany względem stanu przed zadaniem:
 *  1. Bramka uprawnień. Do MW-10 ten handler sprawdzał WYŁĄCZNIE
 *     `organization_id`, więc dowolny użytkownik organizacji mógł skasować
 *     CUDZY dokument prywatny (`scope='user'`), którego nie widział nawet na
 *     liście. Teraz idzie przez `canDeleteDocument`, który (po recenzji CTO
 *     2026-08-02) jest identyczny z `canMutateDocument`: dla
 *     `scope='project'|'organization'` DELETE jest superadmin-only — TAK SAMO
 *     jak dodanie wersji/restore/edycja metadanych, nie „każdy, kto widzi"
 *     (pierwsza wersja tego pliku tak miała; recenzja wykazała, że to była
 *     asymetria bez pokrycia w VLT-002, patrz `vaultDocumentAccess.ts`
 *     nagłówek DZIENNIK).
 *  2. Kaskada na wersje (kontrakt pkt 9) — po usunięciu dokumentu nie zostaje
 *     ANI JEDNA osiągalna wersja.
 */
router.delete(
  '/documents/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Missing document id' });

    const gate = await loadVaultDocumentForRequest(req, res, id, 'delete');
    if (!gate) return;

    const result = await KnowledgeService.deleteDocument(orgId, id);
    if (!result.deleted) return res.status(404).json({ error: 'Document not found' });

    const versionsRemoved = await vaultVersions.softDeleteVersionsForDocument(
      gate.ctx.organizationId,
      id
    );

    return res.json({ success: true, deleted: id, versionsRemoved });
  })
);

export default router;
