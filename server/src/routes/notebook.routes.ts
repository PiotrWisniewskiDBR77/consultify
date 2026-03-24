/**
 * Notebook V4 Routes (V4-NOTE-01/02/04/06/07)
 *
 * Extended notebook API for capture connectors, semantic search,
 * AI proposals with audit, and embed chip resolution.
 *
 * Base CRUD remains in my-work.routes.ts; these routes add V4 capabilities.
 */

import { Router, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { notebookService } from '../services/notebookService.js';
import type { CaptureSource } from '../services/notebookService.js';

const router = Router();
router.use(verifyToken);

const requireUser = (req: AuthRequest, res: Response): { userId: string; orgId: string } | null => {
  const userId = req.user?.id || req.userId;
  const orgId =
    req.user?.organizationId ||
    req.organizationId ||
    (req.headers['x-organization-id'] as string) ||
    (req.query.organizationId as string);
  if (!userId || !orgId) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return { userId, orgId };
};

const captureUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ============================================================
// V4-NOTE-01: Capture — web clipper
// ============================================================

const webClipperSchema = z.object({
  url: z.string().url(),
  title: z.string().max(200).optional(),
  content: z.string().max(500000),
  tags: z.array(z.string()).optional(),
  projectId: z.string().optional(),
});

router.post(
  '/capture/web-clip',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;

    const parsed = webClipperSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const result = await notebookService.capture(identity.orgId, identity.userId, {
      source: 'web_clipper',
      ...parsed.data,
    });

    res.status(201).json(result);
  })
);

// ============================================================
// V4-NOTE-01: Capture — email forward
// ============================================================

const emailForwardSchema = z.object({
  emailFrom: z.string().max(200).optional(),
  emailSubject: z.string().max(200).optional(),
  content: z.string().max(500000),
  tags: z.array(z.string()).optional(),
  projectId: z.string().optional(),
});

router.post(
  '/capture/email',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;

    const parsed = emailForwardSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const result = await notebookService.capture(identity.orgId, identity.userId, {
      source: 'email_forward',
      ...parsed.data,
    });

    res.status(201).json(result);
  })
);

// ============================================================
// V4-NOTE-01: Capture — file upload (extended: PDF, XLSX, DOCX, HTML, TXT, MD)
// ============================================================

router.post(
  '/capture/upload',
  captureUpload.single('file'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'File required' });
      return;
    }

    const tags = req.body.tags ? (Array.isArray(req.body.tags) ? req.body.tags : [req.body.tags]) : [];
    const projectId = req.body.projectId || undefined;

    const result = await notebookService.capture(identity.orgId, identity.userId, {
      source: 'upload',
      title: req.body.title,
      fileBuffer: file.buffer,
      fileMimetype: file.mimetype,
      fileOriginalname: file.originalname,
      tags,
      projectId,
    });

    res.status(201).json(result);
  })
);

// ============================================================
// V4-NOTE-01: Capture — API import
// ============================================================

const apiImportSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(500000),
  tags: z.array(z.string()).optional(),
  projectId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

router.post(
  '/capture/import',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;

    const parsed = apiImportSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const result = await notebookService.capture(identity.orgId, identity.userId, {
      source: 'api_import',
      ...parsed.data,
    });

    res.status(201).json(result);
  })
);

// ============================================================
// V4-NOTE-04: Semantic search + RAG
// ============================================================

router.get(
  '/search',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;

    const query = String(req.query.q || '').trim();
    if (!query) {
      res.status(400).json({ error: 'q parameter required' });
      return;
    }

    const limit = req.query.limit ? Math.min(Number(req.query.limit), 100) : 20;
    const projectId = req.query.projectId ? String(req.query.projectId) : undefined;

    const results = await notebookService.semanticSearch(identity.orgId, identity.userId, query, {
      limit,
      projectId,
    });

    res.json({ results, total: results.length });
  })
);

router.post(
  '/rag-context',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;

    const schema = z.object({
      query: z.string().min(1).max(2000),
      maxTokens: z.number().int().min(100).max(16000).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const result = await notebookService.buildRAGContext(
      identity.orgId,
      identity.userId,
      parsed.data.query,
      { maxTokens: parsed.data.maxTokens, limit: parsed.data.limit }
    );

    res.json(result);
  })
);

// ============================================================
// V4-NOTE-06: AI proposals — create
// ============================================================

const proposalSchema = z.object({
  proposalType: z.enum(['insert', 'replace', 'append']),
  blockContent: z.record(z.string(), z.unknown()),
  rationale: z.string().max(2000),
});

router.post(
  '/pages/:pageId/ai-proposals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;

    const parsed = proposalSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const proposal = await notebookService.createAIProposal(
      identity.orgId,
      identity.userId,
      req.params.pageId,
      parsed.data
    );

    res.status(201).json(proposal);
  })
);

// ============================================================
// V4-NOTE-06: AI proposals — list for page
// ============================================================

router.get(
  '/pages/:pageId/ai-proposals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;

    const status = req.query.status ? String(req.query.status) : undefined;
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : 50;

    const proposals = await notebookService.getProposalsForPage(identity.orgId, req.params.pageId, { status, limit });
    res.json({ proposals });
  })
);

// ============================================================
// V4-NOTE-06: AI proposals — resolve (accept/reject)
// ============================================================

router.post(
  '/ai-proposals/:proposalId/resolve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;

    const schema = z.object({ action: z.enum(['accepted', 'rejected']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const proposal = await notebookService.resolveAIProposal(
      identity.orgId,
      req.params.proposalId,
      identity.userId,
      parsed.data.action
    );

    if (!proposal) {
      res.status(404).json({ error: 'Proposal not found' });
      return;
    }

    res.json(proposal);
  })
);

// ============================================================
// V4-NOTE-07: Embed chips — resolve artifact info
// ============================================================

router.post(
  '/embed-chips/resolve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;

    const schema = z.object({
      refs: z.array(z.object({
        type: z.string().min(1),
        id: z.string().min(1),
      })).min(1).max(50),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const chips = await notebookService.resolveEmbedChips(identity.orgId, identity.userId, parsed.data.refs);
    res.json({ chips });
  })
);

export default router;
