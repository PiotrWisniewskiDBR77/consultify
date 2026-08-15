/**
 * V8 Interview bridge — org-scoped session listing/detail, assignments, and insight endpoints.
 * Namespace: /api/v8/interview (mounted by v8/index).
 *
 * @module routes/v8/interview.routes
 */

import type { Response } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

import {
  InterviewController,
  loadAcceptedInterviewSessionsForManager,
  loadInterviewSessionForOrganization,
  loadInterviewSessionsForOrganization,
  loadManagedInterviewSessionsForManager,
} from '../../controllers/InterviewController.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { requireAnyPermission, requirePermission } from '../../middleware/permission.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import {
  getManagedAssignments,
  getMyAssignments,
  getOverdueAssignments,
} from '../../services/InterviewAssignmentService.js';
import {
  buildInterviewReportPackExportManifest,
  buildInterviewReportPackMarkdownExport,
  createInterviewReportPackDraft,
  createInterviewReportPackRevision,
  evaluateInterviewReportPackReadiness,
  getInterviewReportPackReadiness,
  publishInterviewReportPack,
  submitInterviewReportPackForReview,
  updateInterviewReportWorksheet,
} from '../../services/interviewInsightReportPackService.js';
import {
  INSIGHT_GATED_STATUSES,
  INSIGHT_PATCH_SETTABLE_STATUSES,
  mergeInsightSectionOverrides,
} from '../../services/InterviewInsightService.js';
import { resolveInterviewManagerScope } from '../../services/interviewManagerScope.js';
import contextDocumentService from '../../services/organizationContext/ContextDocumentService.js';
import organizationContextService from '../../services/organizationContext/OrganizationContextService.js';
import {
  listFindings as listP10Findings,
  type P10Finding,
} from '../../services/v8/interviewInsightFindingsService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getTableColumns } from '../../utils/dbSchema.js';
import { decodeHtmlEntities } from '../../utils/htmlEntities.js';
import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';

const router = Router();
const contextDocsUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/json',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('text/')) return cb(null, true);
    return cb(new Error(`Unsupported file type: ${file.mimetype}`));
  },
});

/** Stable contract id for clients parsing V8 interview read responses. */
export const V8_INTERVIEW_READ_CONTRACT = 'interview_runtime_read_v1';
export const V8_INTERVIEW_INSIGHT_READ_CONTRACT = 'interview_insight_read_v1';
export const V8_INTERVIEW_INSIGHT_MUTATION_CONTRACT = 'interview_insight_mutation_v1';

function interviewMeta() {
  return { version: 'v8' as const, contract: V8_INTERVIEW_READ_CONTRACT };
}

function insightReadMeta() {
  return { version: 'v8' as const, contract: V8_INTERVIEW_INSIGHT_READ_CONTRACT };
}

function insightMutationMeta() {
  return { version: 'v8' as const, contract: V8_INTERVIEW_INSIGHT_MUTATION_CONTRACT };
}

function v8Wrap(
  handler: (req: any, res: any, next: any) => void,
  metaFn: () => { version: 'v8'; contract: string }
) {
  return (req: any, res: any, next: any) => {
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode >= 400) return originalJson(body);
      return originalJson({ data: body, meta: metaFn() });
    };
    return handler(req, res, next);
  };
}

const firstParam = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
};

async function ensureInterviewInsightActivityTable(): Promise<void> {
  // Fail-soft: this opportunistic DDL runs first inside the GET
  // /insights/:id/activity read path. queryHelpers.queryRun() REJECTS on any DB
  // error (unlike DbPromise which defaults to fallback:true), so a transient DDL
  // failure (lock/timeout/brief read-only/connection blip) would bubble up as a
  // bare HTTP 500 → white screen. Swallow + log here so the read path degrades to
  // a safe empty list at the call site instead. Real errors are logged, never
  // silently hidden.
  try {
    await queryHelpers.queryRun(
      `CREATE TABLE IF NOT EXISTS interview_insight_activity (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      insight_id TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      user_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
    );
    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_interview_insight_activity_org ON interview_insight_activity(organization_id)`
    );
    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_interview_insight_activity_insight ON interview_insight_activity(insight_id)`
    );
    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_interview_insight_activity_created ON interview_insight_activity(created_at DESC)`
    );
  } catch (err: any) {
    logger.warn(
      `[V8 Interview] ensureInterviewInsightActivityTable DDL failed (degrading gracefully): ${err?.message}`
    );
  }
}

async function logInsightActivity(params: {
  organizationId: string;
  insightId: string;
  type: string;
  description: string;
  userId?: string;
}): Promise<void> {
  const { organizationId, insightId, type, description, userId } = params;
  try {
    await ensureInterviewInsightActivityTable();
    await queryHelpers.queryRun(
      `INSERT INTO interview_insight_activity (id, organization_id, insight_id, type, description, user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        organizationId,
        insightId,
        type,
        description,
        userId || null,
        new Date().toISOString(),
      ]
    );
  } catch (e) {
    logger.warn('[V8 Interview] Failed to log insight activity', e);
  }
}

async function resolveValidProjectId(params: {
  organizationId: string;
  projectId?: string;
}): Promise<string | null> {
  const { organizationId, projectId } = params;
  if (projectId) {
    const row = await queryHelpers.queryOne(
      `SELECT id FROM projects WHERE id = ? AND organization_id = ?`,
      [projectId, organizationId]
    );
    if (row) return projectId;
  }
  const fallback = await queryHelpers.queryOne(
    `SELECT id FROM projects WHERE organization_id = ? ORDER BY created_at DESC LIMIT 1`,
    [organizationId]
  );
  return (fallback as any)?.id || null;
}

/**
 * GET /api/v8/interview/sessions?status=
 * Same org filter and status semantics as GET /api/interview/sessions.
 */
router.get(
  '/sessions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const sessions = await loadInterviewSessionsForOrganization(organizationId, req.query.status);
    return res.json({ data: { sessions }, meta: interviewMeta() });
  })
);

/**
 * GET /api/v8/interview/sessions/accepted
 * Same manager-scoped accepted-sources semantics as GET /api/interview/sessions/accepted.
 */
router.get(
  '/sessions/accepted',
  // V-A S1 — mirror the legacy gate (interview.routes.ts:64-68). These are
  // manager-scoped reads; the V8 path had dropped the capability gate.
  requireAnyPermission(['INTERVIEW_ASSIGN_VIEW', 'INTERVIEW_ASSIGN_MANAGE']),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const sessions = await loadAcceptedInterviewSessionsForManager(organizationId, userId);
    return res.json({ data: { sessions }, meta: interviewMeta() });
  })
);

router.get(
  '/sessions/managed',
  requireAnyPermission(['INTERVIEW_ASSIGN_VIEW', 'INTERVIEW_ASSIGN_MANAGE']),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId, userRole } = getV8Context(req);
    const scope = await resolveInterviewManagerScope({
      organizationId,
      userId,
      role: userRole,
    });
    const sessions = await loadManagedInterviewSessionsForManager(organizationId, userId, {
      scope,
    });
    return res.json({ data: { sessions }, meta: interviewMeta() });
  })
);

/**
 * GET /api/v8/interview/sessions/:id
 * Same org-scoped access as GET /api/interview/sessions/:id.
 */
router.get(
  '/sessions/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const id = firstParam((req.params as { id?: string }).id);
    if (!id) {
      return res
        .status(400)
        .json({ error: 'Session id is required', code: 'INTERVIEW_SESSION_ID_REQUIRED' });
    }

    const session = await loadInterviewSessionForOrganization(organizationId, id);
    if (!session) {
      return res
        .status(404)
        .json({ error: 'Session not found', code: 'INTERVIEW_SESSION_NOT_FOUND' });
    }

    return res.json({ data: { session }, meta: interviewMeta() });
  })
);

/**
 * GET /api/v8/interview/sessions/:id/summary
 * Org-scoped session summary (facts, gaps, constraints, painPoints).
 */
router.get(
  '/sessions/:id/summary',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const id = firstParam((req.params as { id?: string }).id);
    if (!id) {
      return res
        .status(400)
        .json({ error: 'Session id is required', code: 'INTERVIEW_SESSION_ID_REQUIRED' });
    }

    const row = await queryHelpers.queryOne(
      `SELECT s.summary_facts, s.summary_gaps, s.summary_constraints, s.summary_pain_points
       FROM interview_sessions s
       LEFT JOIN projects p ON p.id = s.project_id
       WHERE s.id = ?
         AND (
           p.organization_id = ?
           OR (s.project_id IS NULL AND s.organization_id = ?)
         )`,
      [id, organizationId, organizationId]
    );
    if (!row) {
      return res
        .status(404)
        .json({ error: 'Session not found', code: 'INTERVIEW_SESSION_NOT_FOUND' });
    }

    const safeParseJson = <T>(value: unknown, fallback: T): T => {
      if (!value || typeof value !== 'string') return fallback;
      try {
        return JSON.parse(value) as T;
      } catch {
        return fallback;
      }
    };

    return res.json({
      data: {
        facts: safeParseJson((row as any).summary_facts, []),
        gaps: safeParseJson((row as any).summary_gaps, []),
        constraints: safeParseJson((row as any).summary_constraints, []),
        painPoints: safeParseJson((row as any).summary_pain_points, []),
      },
      meta: interviewMeta(),
    });
  })
);

/**
 * GET /api/v8/interview/assignments/my
 * Same assignee-scoped semantics as GET /api/interview/assignments/my.
 */
router.get(
  '/assignments/my',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const assignments = await getMyAssignments(userId, organizationId);
    return res.json({ data: { assignments }, meta: interviewMeta() });
  })
);

/**
 * GET /api/v8/interview/assignments/managed
 * Same manager-scoped semantics as GET /api/interview/assignments/managed.
 */
router.get(
  '/assignments/managed',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId, userRole } = getV8Context(req);
    const scope = await resolveInterviewManagerScope({
      organizationId,
      userId,
      role: userRole,
    });
    const assignments = await getManagedAssignments(userId, organizationId, {
      scope,
    });
    return res.json({ data: { assignments }, meta: interviewMeta() });
  })
);

/**
 * GET /api/v8/interview/assignments/overdue
 * Same organization-scoped semantics as GET /api/interview/assignments/overdue.
 */
router.get(
  '/assignments/overdue',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId, userRole } = getV8Context(req);
    const scope = await resolveInterviewManagerScope({
      organizationId,
      userId,
      role: userRole,
    });
    const assignments = await getOverdueAssignments(organizationId, { scope });
    return res.json({ data: { assignments }, meta: interviewMeta() });
  })
);

/**
 * Canonical assignment management adapter.
 *
 * Keep the V8 client on one namespace for the complete authenticated invite
 * lifecycle. The legacy controller remains the single mutation authority, so
 * tenant, role, template-publication and anonymity rules cannot drift between
 * two implementations.
 */
router.post(
  '/assignments',
  requirePermission('INTERVIEW_ASSIGN_MANAGE'),
  v8Wrap(InterviewController.createAssignment, interviewMeta)
);

router.get(
  '/assignments/:id',
  v8Wrap(InterviewController.getAssignment, interviewMeta)
);

router.patch(
  '/assignments/:id',
  requirePermission('INTERVIEW_ASSIGN_MANAGE'),
  v8Wrap(InterviewController.updateAssignment, interviewMeta)
);

router.delete(
  '/assignments/:id',
  requirePermission('INTERVIEW_ASSIGN_MANAGE'),
  v8Wrap(InterviewController.deleteAssignment, interviewMeta)
);

router.post(
  '/assignments/:id/archive',
  requirePermission('INTERVIEW_ASSIGN_MANAGE'),
  v8Wrap(InterviewController.archiveAssignment, interviewMeta)
);

router.post(
  '/assignments/:id/restore',
  requirePermission('INTERVIEW_ASSIGN_MANAGE'),
  v8Wrap(InterviewController.restoreAssignment, interviewMeta)
);

// V-A S1 — restore the function-level authorization the legacy /api/interview
// stack enforces but the V8 production path dropped. Mirror the legacy gates
// exactly (interview.routes.ts:104-161):
//   start / submit  → no permission gate; the controller validates the caller
//                     is the assignee (assignee acts on their own assignment).
//   remind          → INTERVIEW_REMIND
//   send-back/approve → INTERVIEW_ASSIGN_MANAGE  (manager-only)
// Without these, any authenticated org member could approve/send-back any
// submitted assignment in their org (intra-org privilege escalation).
router.post('/assignments/:id/start', v8Wrap(InterviewController.startAssignment, interviewMeta));

router.post('/assignments/:id/submit', v8Wrap(InterviewController.submitAssignment, interviewMeta));

router.post(
  '/assignments/:id/remind',
  requirePermission('INTERVIEW_REMIND'),
  v8Wrap(InterviewController.sendAssignmentReminder, interviewMeta)
);

router.post(
  '/assignments/:id/send-back',
  requirePermission('INTERVIEW_ASSIGN_MANAGE'),
  v8Wrap(InterviewController.sendBackAssignment, interviewMeta)
);

router.post(
  '/assignments/:id/approve',
  requirePermission('INTERVIEW_ASSIGN_MANAGE'),
  v8Wrap(InterviewController.approveAssignment, interviewMeta)
);

router.patch(
  '/assignments/:id/manage',
  requirePermission('INTERVIEW_ASSIGN_MANAGE'),
  v8Wrap(InterviewController.updateAssignment, interviewMeta)
);

router.post(
  '/sessions/:sessionId/evaluate-answers',
  v8Wrap(InterviewController.evaluateSessionAnswers, interviewMeta)
);

// ==========================================
// INSIGHTS — V8 bounded bridge (P10)
// ==========================================

router.get(
  '/context-documents',
  requirePermission('INTERVIEW_INSIGHTS_VIEW'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const scopeRaw = String(firstParam((req.query as any).scope) || 'all').toLowerCase();
    const scope = scopeRaw === 'project' || scopeRaw === 'user' ? scopeRaw : 'all';
    const projectId = firstParam((req.query as any).projectId);
    const statusesRaw = firstParam((req.query as any).statuses);
    const statuses = statusesRaw
      ? statusesRaw
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : undefined;

    const documents = await contextDocumentService.listAccessibleDocuments({
      organizationId,
      userId,
      scope,
      projectId: projectId || undefined,
      statuses: statuses as any,
    });

    return res.json({
      data: { documents },
      meta: insightReadMeta(),
    });
  })
);

router.post(
  '/context-documents/upload',
  requirePermission('INTERVIEW_INSIGHTS_CREATE'),
  contextDocsUpload.single('file'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId, userRole, isSuperAdmin } = getV8Context(req);
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded', code: 'CONTEXT_DOC_FILE_REQUIRED' });
    }

    const scopeRaw = String((req.body as any)?.scope || 'user').toLowerCase();
    const scope = scopeRaw === 'project' ? 'project' : 'user';
    const projectIdRaw = String((req.body as any)?.projectId || '').trim();
    const projectId = projectIdRaw || null;
    if (scope === 'project' && !projectId) {
      return res.status(400).json({
        error: 'projectId is required for project scope',
        code: 'CONTEXT_DOC_PROJECT_REQUIRED',
      });
    }
    if (scope === 'project') {
      const canAccessProject = await contextDocumentService.canAccessProject({
        organizationId,
        userId,
        projectId: String(projectId),
        userRole,
        isSuperAdmin,
      });
      if (!canAccessProject) {
        return res.status(403).json({
          error: 'Project not found or access denied',
          code: 'CONTEXT_DOC_PROJECT_ACCESS_DENIED',
        });
      }
    }

    let document;
    try {
      document = await contextDocumentService.uploadAndIngest({
        file: req.file,
        organizationId,
        ownerId: userId,
        scope,
        projectId,
        sourceUpload: 'interview.insight_creator',
      });
    } catch (error: any) {
      if (
        error?.code === 'CONTEXT_STORAGE_QUOTA_EXCEEDED' ||
        error?.code === 'PROJECT_STORAGE_QUOTA_EXCEEDED'
      ) {
        return res.status(429).json({
          error: error.message || 'Storage quota exceeded',
          code: error.code,
          data: {
            document: error.document || null,
            quota: error.quota || null,
          },
          meta: insightMutationMeta(),
        });
      }
      throw error;
    }

    return res.status(201).json({
      data: { document },
      meta: insightMutationMeta(),
    });
  })
);

router.get(
  '/insights',
  requirePermission('INTERVIEW_INSIGHTS_VIEW'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const limit = Number(firstParam(req.query.limit as string) ?? 50) || 50;
    const offset = Number(firstParam(req.query.offset as string) ?? 0) || 0;

    const interviewInsightService = await import('../../services/InterviewInsightService.js');
    const insights = await interviewInsightService.list(organizationId, { limit, offset });

    return res.json({ data: { insights }, meta: insightReadMeta() });
  })
);

router.get(
  '/insights/:id',
  requirePermission('INTERVIEW_INSIGHTS_VIEW'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { id } = req.params;

    const interviewInsightService = await import('../../services/InterviewInsightService.js');
    const insight = await interviewInsightService.getById(id);
    if (!insight) {
      return res
        .status(404)
        .json({ error: 'Insight not found', code: 'INTERVIEW_INSIGHT_NOT_FOUND' });
    }
    if (String(insight.organizationId) !== String(organizationId)) {
      return res.status(403).json({ error: 'Forbidden', code: 'INTERVIEW_INSIGHT_FORBIDDEN' });
    }

    return res.json({ data: { insight }, meta: insightReadMeta() });
  })
);

/**
 * Lazy guard kolumny `section_overrides` (ręczna redakcja sekcji, n-Type §6.2).
 * Ten sam wzór, którym w tym pliku żyje `section_completions`: sprawdzenie przez
 * `pg_attribute` (katalog, BEZ locka na tabelę), ALTER tylko gdy kolumny nie ma.
 * Dzięki temu endpoint działa również na bazie, na której migracja 931 jeszcze
 * nie poszła — i NIE wykonuje DDL, gdy kolumna już istnieje (typowy przypadek).
 */
let _insightSectionOverridesEnsured = false;
async function ensureInsightSectionOverridesColumn(): Promise<void> {
  if (_insightSectionOverridesEnsured) return;
  try {
    const rows = await queryHelpers.queryAll<{ attname: string }>(
      `SELECT attname FROM pg_attribute
       WHERE attrelid = 'interview_insights'::regclass
         AND attname = 'section_overrides'
         AND attnum > 0 AND NOT attisdropped`,
      []
    );
    if (rows && rows.length > 0) {
      _insightSectionOverridesEnsured = true;
      return;
    }
    await queryHelpers.queryRun(`ALTER TABLE interview_insights ADD COLUMN section_overrides TEXT`);
    _insightSectionOverridesEnsured = true;
  } catch (err: any) {
    const m = String(err?.message || err).toLowerCase();
    if (m.includes('already exists') || m.includes('duplicate column')) {
      _insightSectionOverridesEnsured = true;
      return;
    }
    throw err;
  }
}

/**
 * PATCH /api/v8/interview/insights/:id
 * Update insight — supports sectionCompletions (Mark Complete), sectionOverrides
 * (ręczna redakcja treści sekcji — n-Type §6.2), title, status, archived.
 * Mirrors InterviewController.updateInsight but registered in the v8 namespace so
 * that v8Patch('/interview/insights/:id') reaches a real route (without this the
 * request fell through the v8 router without matching → 503 Vite proxy timeout).
 */
router.patch(
  '/insights/:id',
  requirePermission('INTERVIEW_INSIGHTS_REVIEW'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { id } = req.params;
    const {
      title,
      status,
      exportedToTools,
      exportedToAssessment,
      archived,
      sectionCompletions,
      sectionOverrides,
    } = req.body || {};

    const interviewInsightService = await import('../../services/InterviewInsightService.js');
    const insight = await interviewInsightService.getById(id);
    if (!insight) {
      return res
        .status(404)
        .json({ data: null, error: 'Insight not found', code: 'INTERVIEW_INSIGHT_NOT_FOUND' });
    }
    if (String(insight.organizationId) !== String(organizationId)) {
      return res
        .status(403)
        .json({ data: null, error: 'Forbidden', code: 'INTERVIEW_INSIGHT_FORBIDDEN' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (typeof title === 'string') {
      updates.push('title = ?');
      values.push(title.trim());
    }
    if (status !== undefined) {
      // SEC — see InterviewController.updateInsight: the body must not forge a
      // GATED review status (published/in_review/approved). Those transitions are
      // owned by the lifecycle gate (POST /insights/:insightId/lifecycle) which
      // enforces findings + canon + readback + INTERVIEW_INSIGHTS_PUBLISH and
      // server-derives reviewed_by/published_at. Accepting them here would bypass
      // the entire approval gate (mass-assignment / state-machine bypass).
      const requested = String(status);
      if (INSIGHT_GATED_STATUSES.has(requested)) {
        return res.status(409).json({
          data: null,
          error:
            'This status is managed by the review workflow. Use the insight lifecycle action (submit/approve/publish) instead of a direct status edit.',
          code: 'INSIGHT_STATUS_GATED',
        });
      }
      if (!INSIGHT_PATCH_SETTABLE_STATUSES.has(requested as never)) {
        return res
          .status(400)
          .json({ data: null, error: 'Invalid status', code: 'INSIGHT_STATUS_INVALID' });
      }
      updates.push('status = ?');
      values.push(requested);
    }
    if (exportedToTools !== undefined) {
      updates.push('exported_to_tools = ?');
      values.push(exportedToTools ? 1 : 0);
    }
    if (exportedToAssessment !== undefined) {
      updates.push('exported_to_assessment = ?');
      values.push(exportedToAssessment ? 1 : 0);
    }
    if (archived !== undefined) {
      // Ensure lifecycle columns exist (lazy-ALTER via IF NOT EXISTS — fast, idempotent).
      try {
        await queryHelpers.queryRun(
          `ALTER TABLE interview_insights ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP`
        );
        await queryHelpers.queryRun(
          `ALTER TABLE interview_insights ADD COLUMN IF NOT EXISTS archived_by TEXT`
        );
      } catch {
        /* column already exists */
      }
      updates.push('archived_at = ?', 'archived_by = ?');
      values.push(
        archived ? new Date().toISOString() : null,
        archived ? (req as any).userId || organizationId : null
      );
    }
    if (sectionCompletions !== undefined && sectionCompletions !== null) {
      // Use pg_attribute (no table-lock) to check column existence, then ALTER only if missing.
      try {
        const rows = await queryHelpers.queryAll<{ attname: string }>(
          `SELECT attname FROM pg_attribute
           WHERE attrelid = 'interview_insights'::regclass
             AND attname = 'section_completions'
             AND attnum > 0 AND NOT attisdropped`,
          []
        );
        if (!rows || rows.length === 0) {
          await queryHelpers.queryRun(
            `ALTER TABLE interview_insights ADD COLUMN section_completions TEXT`
          );
        }
      } catch {
        /* best-effort */
      }
      updates.push('section_completions = ?');
      values.push(
        typeof sectionCompletions === 'string'
          ? sectionCompletions
          : JSON.stringify(sectionCompletions)
      );
    }

    // ── Ręczna redakcja treści sekcji (n-Type §6.2; właściciel 2026-07-23) ────
    // ADDYTYWNE: nie dotyka `content` ani `*_json` z generacji — nadpisania leżą
    // OBOK treści AI, więc regeneracja nie kasuje ręcznej pracy, a wyłączenie
    // funkcji sprowadza się do zignorowania jednej kolumny. Scalanie jest
    // CZĘŚCIOWE (patrz `mergeInsightSectionOverrides`), żeby dwie osoby
    // redagujące różne sekcje nie kasowały sobie nawzajem zmian.
    if (sectionOverrides !== undefined) {
      const merged = mergeInsightSectionOverrides(
        insight.sectionOverrides,
        sectionOverrides,
        userId
      );
      if (merged.ok === false) {
        return res.status(400).json({ data: null, error: merged.error, code: merged.code });
      }
      await ensureInsightSectionOverridesColumn();
      updates.push('section_overrides = ?');
      values.push(Object.keys(merged.value).length === 0 ? null : JSON.stringify(merged.value));
    }

    if (updates.length === 0) {
      return res
        .status(400)
        .json({ data: null, error: 'No fields to update', code: 'INTERVIEW_INSIGHT_NO_FIELDS' });
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);
    values.push(organizationId);

    await queryHelpers.queryRun(
      `UPDATE interview_insights SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
      values
    );

    return res.json({ data: { success: true }, meta: insightMutationMeta() });
  })
);

/**
 * POST /api/v8/interview/insights/:id/fork
 * Duplicate an existing insight into a brand-new record. Copies the source
 * insight's defining fields (title → "<title> (Fork)", promptType,
 * sourceSessionIds, filters, analysisScope/mode/contextMode/topicFocus) into a
 * fresh `create()` so the new insight gets its own generated id, then carries
 * over the source's content + status so the fork is immediately usable (rather
 * than re-running generation from scratch). Derived analysis JSON (themes,
 * issues, evidence map, material quality, etc.) is intentionally not copied —
 * the fork keeps the rendered `content` + `status` and can be regenerated.
 */
router.post(
  '/insights/:id/fork',
  requirePermission('INTERVIEW_INSIGHTS_REVIEW'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { id } = req.params;

    const interviewInsightService = await import('../../services/InterviewInsightService.js');
    const source = await interviewInsightService.getById(id);
    if (!source) {
      return res
        .status(404)
        .json({ data: null, error: 'Insight not found', code: 'INTERVIEW_INSIGHT_NOT_FOUND' });
    }
    if (String(source.organizationId) !== String(organizationId)) {
      return res
        .status(403)
        .json({ data: null, error: 'Forbidden', code: 'INTERVIEW_INSIGHT_FORBIDDEN' });
    }

    const forkTitle = `${String(source.title || 'Interview Insight').trim()} (Fork)`;
    const created = await interviewInsightService.create({
      organizationId: String(source.organizationId),
      title: forkTitle,
      sessionIds: Array.isArray(source.sourceSessionIds) ? source.sourceSessionIds : [],
      promptType: source.promptType,
      filters: source.filters as any,
      analysisScope: source.analysisScope,
      analysisMode: source.analysisMode,
      contextMode: source.contextMode,
      topicFocus: source.topicFocus,
      createdBy: userId,
    });

    // Carry over the rendered content + lifecycle status from the source so the
    // fork is usable immediately. `create()` starts a fresh generation pass and
    // sets status='generating'; overwrite that with the source's values.
    try {
      await queryHelpers.queryRun(
        `UPDATE interview_insights
         SET content = ?, status = ?, updated_at = ?
         WHERE id = ? AND organization_id = ?`,
        [
          source.content ?? null,
          source.status,
          new Date().toISOString(),
          created.id,
          organizationId,
        ]
      );
    } catch (e) {
      logger.warn(
        `[V8 Interview] Fork content carry-over for insight ${created.id} skipped: ${String(
          (e as Error)?.message || e
        )}`
      );
    }

    const insight = (await interviewInsightService.getById(created.id)) ?? created;

    void logInsightActivity({
      organizationId,
      insightId: insight.id,
      type: 'created',
      description: `Insight forked from ${id}`,
      userId,
    });

    return res.json({ data: { insight }, meta: insightMutationMeta() });
  })
);

router.get(
  '/insights/:id/context-lineage',
  requirePermission('INTERVIEW_INSIGHTS_VIEW'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { id } = req.params;

    const interviewInsightService = await import('../../services/InterviewInsightService.js');
    const insight = await interviewInsightService.getById(id);
    if (!insight) {
      return res
        .status(404)
        .json({ error: 'Insight not found', code: 'INTERVIEW_INSIGHT_NOT_FOUND' });
    }
    if (String(insight.organizationId) !== String(organizationId)) {
      return res.status(403).json({ error: 'Forbidden', code: 'INTERVIEW_INSIGHT_FORBIDDEN' });
    }

    const lineage = await interviewInsightService.listContextLineage(organizationId, id);
    return res.json({ data: { lineage }, meta: insightReadMeta() });
  })
);

router.get(
  '/insights/:id/report-pack',
  requirePermission('INTERVIEW_INSIGHTS_VIEW'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { id } = req.params;

    const interviewInsightService = await import('../../services/InterviewInsightService.js');
    const insight = await interviewInsightService.getById(id);
    if (!insight) {
      return res
        .status(404)
        .json({ error: 'Insight not found', code: 'INTERVIEW_INSIGHT_NOT_FOUND' });
    }
    if (String(insight.organizationId) !== String(organizationId)) {
      return res.status(403).json({ error: 'Forbidden', code: 'INTERVIEW_INSIGHT_FORBIDDEN' });
    }

    const reportPack = await createInterviewReportPackDraft({
      organizationId,
      insight: insight as any,
      createdBy: userId,
    });
    return res.json({ data: { reportPack }, meta: insightReadMeta() });
  })
);

router.get(
  '/insights/:id/report-pack/readiness',
  requirePermission('INTERVIEW_INSIGHTS_VIEW'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { id } = req.params;

    const interviewInsightService = await import('../../services/InterviewInsightService.js');
    const insight = await interviewInsightService.getById(id);
    if (!insight) {
      return res
        .status(404)
        .json({ error: 'Insight not found', code: 'INTERVIEW_INSIGHT_NOT_FOUND' });
    }
    if (String(insight.organizationId) !== String(organizationId)) {
      return res.status(403).json({ error: 'Forbidden', code: 'INTERVIEW_INSIGHT_FORBIDDEN' });
    }

    const persistedReadiness = await getInterviewReportPackReadiness(organizationId, id);
    if (persistedReadiness) {
      return res.json({ data: { readiness: persistedReadiness }, meta: insightReadMeta() });
    }

    const reportPack = await createInterviewReportPackDraft({
      organizationId,
      insight: insight as any,
      createdBy: userId,
    });
    return res.json({
      data: { readiness: evaluateInterviewReportPackReadiness(reportPack) },
      meta: insightReadMeta(),
    });
  })
);

router.post(
  '/insights/:id/report-pack/submit-review',
  requirePermission('INTERVIEW_INSIGHTS_REVIEW'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { id } = req.params;

    const interviewInsightService = await import('../../services/InterviewInsightService.js');
    const insight = await interviewInsightService.getById(id);
    if (!insight) {
      return res
        .status(404)
        .json({ error: 'Insight not found', code: 'INTERVIEW_INSIGHT_NOT_FOUND' });
    }
    if (String(insight.organizationId) !== String(organizationId)) {
      return res.status(403).json({ error: 'Forbidden', code: 'INTERVIEW_INSIGHT_FORBIDDEN' });
    }

    await createInterviewReportPackDraft({
      organizationId,
      insight: insight as any,
      createdBy: userId,
    });

    const result = await submitInterviewReportPackForReview({
      organizationId,
      insightId: id,
      actorUserId: userId,
    });

    if (!result) {
      return res.status(404).json({
        error: 'Report pack not found',
        code: 'INTERVIEW_REPORT_PACK_NOT_FOUND',
      });
    }

    return res.json({ data: { result }, meta: insightMutationMeta() });
  })
);

router.post(
  '/insights/:id/report-pack/publish',
  requirePermission('INTERVIEW_INSIGHTS_PUBLISH'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { id } = req.params;

    const interviewInsightService = await import('../../services/InterviewInsightService.js');
    const insight = await interviewInsightService.getById(id);
    if (!insight) {
      return res
        .status(404)
        .json({ error: 'Insight not found', code: 'INTERVIEW_INSIGHT_NOT_FOUND' });
    }
    if (String(insight.organizationId) !== String(organizationId)) {
      return res.status(403).json({ error: 'Forbidden', code: 'INTERVIEW_INSIGHT_FORBIDDEN' });
    }

    const result = await publishInterviewReportPack({
      organizationId,
      insightId: id,
      actorUserId: userId,
    });

    if (!result) {
      return res.status(404).json({
        error: 'Report pack not found',
        code: 'INTERVIEW_REPORT_PACK_NOT_FOUND',
      });
    }

    return res.json({ data: { result }, meta: insightMutationMeta() });
  })
);

router.get(
  '/insights/:id/report-pack/export-manifest',
  requirePermission('INTERVIEW_INSIGHTS_PUBLISH'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { id } = req.params;

    const interviewInsightService = await import('../../services/InterviewInsightService.js');
    const insight = await interviewInsightService.getById(id);
    if (!insight) {
      return res
        .status(404)
        .json({ error: 'Insight not found', code: 'INTERVIEW_INSIGHT_NOT_FOUND' });
    }
    if (String(insight.organizationId) !== String(organizationId)) {
      return res.status(403).json({ error: 'Forbidden', code: 'INTERVIEW_INSIGHT_FORBIDDEN' });
    }

    let exportManifest;
    try {
      exportManifest = await buildInterviewReportPackExportManifest({
        organizationId,
        insightId: id,
      });
    } catch (error) {
      const knownError = error as { code?: unknown; message?: unknown; statusCode?: unknown };
      if (knownError.code === 'INTERVIEW_REPORT_PACK_EXPORT_BLOCKED') {
        return res.status(Number(knownError.statusCode) || 409).json({
          error:
            typeof knownError.message === 'string'
              ? knownError.message
              : 'Only published report packs can be exported as client-ready material.',
          code: 'INTERVIEW_REPORT_PACK_EXPORT_BLOCKED',
        });
      }
      throw error;
    }

    if (!exportManifest) {
      return res.status(404).json({
        error: 'Report pack not found',
        code: 'INTERVIEW_REPORT_PACK_NOT_FOUND',
      });
    }

    await queryHelpers.queryRun(
      `INSERT INTO interview_insight_audit_log
       (id, organization_id, insight_id, entity_type, entity_id, action, actor_user_id, detail_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        organizationId,
        id,
        'interview_report_pack',
        exportManifest.reportPackId,
        'report_pack_exported',
        userId || null,
        JSON.stringify({
          reportPackId: exportManifest.reportPackId,
          worksheetCount: exportManifest.worksheetCount,
          completenessScore: exportManifest.completenessScore,
          readinessStatus: exportManifest.readiness.status,
          exportedAt: exportManifest.exportedAt,
          manifestHash: exportManifest.manifestHash,
        }),
        new Date().toISOString(),
      ]
    );

    return res.json({ data: { exportManifest }, meta: insightReadMeta() });
  })
);

router.get(
  '/insights/:id/report-pack/export-markdown',
  requirePermission('INTERVIEW_INSIGHTS_PUBLISH'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { id } = req.params;

    const interviewInsightService = await import('../../services/InterviewInsightService.js');
    const insight = await interviewInsightService.getById(id);
    if (!insight) {
      return res
        .status(404)
        .json({ error: 'Insight not found', code: 'INTERVIEW_INSIGHT_NOT_FOUND' });
    }
    if (String(insight.organizationId) !== String(organizationId)) {
      return res.status(403).json({ error: 'Forbidden', code: 'INTERVIEW_INSIGHT_FORBIDDEN' });
    }

    let markdownExport;
    try {
      markdownExport = await buildInterviewReportPackMarkdownExport({
        organizationId,
        insightId: id,
      });
    } catch (error) {
      const knownError = error as { code?: unknown; message?: unknown; statusCode?: unknown };
      if (knownError.code === 'INTERVIEW_REPORT_PACK_EXPORT_BLOCKED') {
        return res.status(Number(knownError.statusCode) || 409).json({
          error:
            typeof knownError.message === 'string'
              ? knownError.message
              : 'Only published report packs can be exported as client-ready material.',
          code: 'INTERVIEW_REPORT_PACK_EXPORT_BLOCKED',
        });
      }
      throw error;
    }

    if (!markdownExport) {
      return res.status(404).json({
        error: 'Report pack not found',
        code: 'INTERVIEW_REPORT_PACK_NOT_FOUND',
      });
    }

    await queryHelpers.queryRun(
      `INSERT INTO interview_insight_audit_log
       (id, organization_id, insight_id, entity_type, entity_id, action, actor_user_id, detail_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        organizationId,
        id,
        'interview_report_pack',
        markdownExport.reportPackId,
        'report_pack_client_markdown_exported',
        userId || null,
        JSON.stringify({
          reportPackId: markdownExport.reportPackId,
          worksheetCount: markdownExport.worksheetCount,
          exportedAt: markdownExport.exportedAt,
          sourceManifestHash: markdownExport.sourceManifestHash,
          exportHash: markdownExport.exportHash,
          format: markdownExport.format,
        }),
        new Date().toISOString(),
      ]
    );

    return res.json({ data: { markdownExport }, meta: insightReadMeta() });
  })
);

router.post(
  '/insights/:id/report-pack/revisions',
  requirePermission('INTERVIEW_INSIGHTS_REVIEW'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { id } = req.params;

    const interviewInsightService = await import('../../services/InterviewInsightService.js');
    const insight = await interviewInsightService.getById(id);
    if (!insight) {
      return res
        .status(404)
        .json({ error: 'Insight not found', code: 'INTERVIEW_INSIGHT_NOT_FOUND' });
    }
    if (String(insight.organizationId) !== String(organizationId)) {
      return res.status(403).json({ error: 'Forbidden', code: 'INTERVIEW_INSIGHT_FORBIDDEN' });
    }

    let result;
    try {
      result = await createInterviewReportPackRevision({
        organizationId,
        insightId: id,
        actorUserId: userId,
      });
    } catch (error) {
      const knownError = error as { code?: unknown; message?: unknown; statusCode?: unknown };
      if (knownError.code === 'INTERVIEW_REPORT_PACK_REVISION_BLOCKED') {
        return res.status(Number(knownError.statusCode) || 409).json({
          error:
            typeof knownError.message === 'string'
              ? knownError.message
              : 'Only published report packs can create a new editable revision.',
          code: 'INTERVIEW_REPORT_PACK_REVISION_BLOCKED',
        });
      }
      throw error;
    }

    if (!result) {
      return res.status(404).json({
        error: 'Report pack not found',
        code: 'INTERVIEW_REPORT_PACK_NOT_FOUND',
      });
    }

    return res.json({ data: { result }, meta: insightMutationMeta() });
  })
);

router.patch(
  '/insights/:id/report-pack/worksheets/:worksheetKey',
  requirePermission('INTERVIEW_INSIGHTS_REVIEW'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { id, worksheetKey } = req.params;

    const row = await queryHelpers.queryOne(
      `SELECT organization_id FROM interview_insights WHERE id = ?`,
      [id]
    );
    if (!row) {
      return res
        .status(404)
        .json({ error: 'Insight not found', code: 'INTERVIEW_INSIGHT_NOT_FOUND' });
    }
    if (String((row as any).organization_id) !== String(organizationId)) {
      return res.status(403).json({ error: 'Forbidden', code: 'INTERVIEW_INSIGHT_FORBIDDEN' });
    }

    const { status, completenessScore, warnings, rows, markdown } = req.body || {};
    const hasAnyUpdate =
      status !== undefined ||
      completenessScore !== undefined ||
      warnings !== undefined ||
      rows !== undefined ||
      markdown !== undefined;
    if (!hasAnyUpdate) {
      return res.status(400).json({
        error: 'At least one worksheet field is required',
        code: 'INTERVIEW_REPORT_WORKSHEET_PATCH_EMPTY',
      });
    }

    let reportPack;
    try {
      reportPack = await updateInterviewReportWorksheet({
        organizationId,
        insightId: id,
        worksheetKey,
        actorUserId: userId,
        updates: {
          status,
          completenessScore,
          warnings: Array.isArray(warnings) ? warnings.map(String) : undefined,
          rows: Array.isArray(rows) ? rows : undefined,
          markdown: markdown === null || typeof markdown === 'string' ? markdown : undefined,
        },
      });
    } catch (error) {
      const knownError = error as { code?: unknown; message?: unknown; statusCode?: unknown };
      if (knownError.code === 'INTERVIEW_REPORT_PACK_IMMUTABLE') {
        return res.status(Number(knownError.statusCode) || 409).json({
          error:
            typeof knownError.message === 'string'
              ? knownError.message
              : 'Published report packs cannot be edited.',
          code: 'INTERVIEW_REPORT_PACK_IMMUTABLE',
        });
      }
      throw error;
    }

    if (!reportPack) {
      return res.status(404).json({
        error: 'Report pack worksheet not found',
        code: 'INTERVIEW_REPORT_WORKSHEET_NOT_FOUND',
      });
    }

    return res.json({ data: { reportPack }, meta: insightMutationMeta() });
  })
);

router.post(
  '/insights',
  requirePermission('INTERVIEW_INSIGHTS_CREATE'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const {
      title,
      sessionIds,
      sessionId,
      promptType,
      filters,
      analysisScope,
      analysisMode,
      contextMode,
      topicFocus,
      consultantNote,
      leadingQuestion,
      customPrompt,
      selectedContextDocumentIds,
    } = req.body || {};

    const normalizedSessionIds: string[] = Array.isArray(sessionIds)
      ? sessionIds.map(String).filter(Boolean)
      : sessionId
        ? [String(sessionId)].filter(Boolean)
        : [];

    if (normalizedSessionIds.length === 0) {
      return res.status(400).json({
        error: 'sessionId or sessionIds is required',
        code: 'INTERVIEW_INSIGHT_SESSION_REQUIRED',
      });
    }

    const placeholders = normalizedSessionIds.map(() => '?').join(',');
    const approvedRows = await queryHelpers.queryAll<{ id: string }>(
      `SELECT s.id
       FROM interview_sessions s
       LEFT JOIN interview_assignments a ON a.id = s.assignment_id AND a.organization_id = ?
       LEFT JOIN projects p ON p.id = s.project_id
       WHERE s.id IN (${placeholders})
         AND (
           p.organization_id = ?
           OR (s.project_id IS NULL AND s.organization_id = ?)
         )
         AND s.status = 'completed'
         AND (s.assignment_id IS NULL OR a.status IN ('approved', 'completed'))`,
      [organizationId, ...normalizedSessionIds, organizationId, organizationId]
    );
    const approvedIds = new Set((approvedRows || []).map((row) => String(row.id)));
    const rejectedIds = normalizedSessionIds.filter((id) => !approvedIds.has(id));
    if (rejectedIds.length > 0) {
      return res.status(409).json({
        error: 'Interview Insight can only be generated from approved/completed interview sessions',
        code: 'INTERVIEW_INSIGHT_SOURCE_NOT_APPROVED',
        rejectedSessionIds: rejectedIds,
      });
    }

    let normalizedTitle = typeof title === 'string' ? title.trim() : '';
    const normalizedPromptType = (
      typeof promptType === 'string' && promptType.trim() ? promptType.trim() : 'summary'
    ) as any;

    if (!normalizedTitle) {
      try {
        // Scope the title lookup by org as well. The id is already validated to
        // belong to this org via `approvedRows` above, but adding the explicit
        // organization_id guard keeps this defensive and mirrors sibling
        // queries (so a future refactor of the validation can't turn this into
        // a cross-org name leak).
        const sessionRow = await queryHelpers.queryOne(
          `SELECT name FROM interview_sessions WHERE id = ? AND organization_id = ?`,
          [normalizedSessionIds[0], organizationId]
        );
        const sessionName = String((sessionRow as any)?.name || '').trim();
        normalizedTitle = sessionName
          ? `${sessionName} — ${normalizedPromptType}`
          : `Interview Insight — ${normalizedPromptType}`;
      } catch {
        normalizedTitle = `Interview Insight — ${normalizedPromptType}`;
      }
    }

    const interviewInsightService = await import('../../services/InterviewInsightService.js');
    const insight = await interviewInsightService.create({
      organizationId,
      title: normalizedTitle,
      sessionIds: normalizedSessionIds,
      promptType: normalizedPromptType,
      filters,
      analysisScope,
      analysisMode,
      contextMode,
      topicFocus,
      consultantNote,
      leadingQuestion,
      customPrompt,
      selectedContextDocumentIds: Array.isArray(selectedContextDocumentIds)
        ? selectedContextDocumentIds.map(String).filter(Boolean)
        : [],
      createdBy: userId,
    });

    void logInsightActivity({
      organizationId,
      insightId: insight.id,
      type: 'created',
      description: `Insight created (${normalizedPromptType})`,
      userId,
    });

    void (async () => {
      try {
        const lgCols = await getTableColumns('link_graph_edges');
        if (!lgCols || lgCols.size === 0) return;
        const now = new Date().toISOString();
        for (const sid of normalizedSessionIds) {
          await queryHelpers.queryRun(
            `INSERT OR IGNORE INTO link_graph_edges
             (id, organization_id, source_type, source_id, target_type, target_id, relation, created_by, created_at)
             VALUES (?, ?, 'interview_insight', ?, 'interview_session', ?, 'created_from', ?, ?)`,
            [uuidv4(), organizationId, insight.id, sid, userId, now]
          );
        }
      } catch (e) {
        logger.warn(
          `[V8 Interview] Link graph edges for insight ${insight.id} skipped: ${String((e as Error)?.message || e)}`
        );
      }
    })();

    return res.status(201).json({ data: { insight }, meta: insightMutationMeta() });
  })
);

router.post(
  '/insights/:id/regenerate',
  requirePermission('INTERVIEW_INSIGHTS_CREATE'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { id } = req.params;

    const row = await queryHelpers.queryOne(
      `SELECT organization_id FROM interview_insights WHERE id = ?`,
      [id]
    );
    if (!row) {
      return res
        .status(404)
        .json({ error: 'Insight not found', code: 'INTERVIEW_INSIGHT_NOT_FOUND' });
    }
    if (String((row as any).organization_id) !== String(organizationId)) {
      return res.status(403).json({ error: 'Forbidden', code: 'INTERVIEW_INSIGHT_FORBIDDEN' });
    }

    const interviewInsightService = await import('../../services/InterviewInsightService.js');
    const insight = await interviewInsightService.regenerate(id);
    if (!insight) {
      return res
        .status(404)
        .json({ error: 'Insight not found', code: 'INTERVIEW_INSIGHT_NOT_FOUND' });
    }

    void logInsightActivity({
      organizationId,
      insightId: id,
      type: 'regenerated',
      description: 'Regeneration requested',
      userId,
    });

    return res.json({ data: { insight }, meta: insightMutationMeta() });
  })
);

router.patch(
  '/insights/:id',
  requirePermission('INTERVIEW_INSIGHTS_REVIEW'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { id } = req.params;
    const { title, status, exportedToTools, exportedToAssessment } = req.body;

    const updates: string[] = [];
    const values: any[] = [];

    if (typeof title === 'string') {
      updates.push('title = ?');
      values.push(title.trim());
    }
    if (status !== undefined) {
      // SEC — gated review statuses (published/in_review/approved) are owned by
      // the lifecycle gate, never settable from a plain PATCH body. (This handler
      // is shadowed by the earlier /insights/:id route, but kept consistent.)
      const requested = String(status);
      if (INSIGHT_GATED_STATUSES.has(requested)) {
        return res.status(409).json({
          error:
            'This status is managed by the review workflow. Use the insight lifecycle action (submit/approve/publish) instead of a direct status edit.',
          code: 'INSIGHT_STATUS_GATED',
        });
      }
      if (!INSIGHT_PATCH_SETTABLE_STATUSES.has(requested as never)) {
        return res.status(400).json({ error: 'Invalid status', code: 'INSIGHT_STATUS_INVALID' });
      }
      updates.push('status = ?');
      values.push(requested);
    }
    if (exportedToTools !== undefined) {
      updates.push('exported_to_tools = ?');
      values.push(exportedToTools ? 1 : 0);
    }
    if (exportedToAssessment !== undefined) {
      updates.push('exported_to_assessment = ?');
      values.push(exportedToAssessment ? 1 : 0);
    }

    if (updates.length === 0) {
      return res
        .status(400)
        .json({ error: 'No fields to update', code: 'INTERVIEW_INSIGHT_NO_FIELDS' });
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);
    values.push(organizationId);

    await queryHelpers.queryRun(
      `UPDATE interview_insights SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
      values
    );

    if (typeof title === 'string') {
      void logInsightActivity({
        organizationId,
        insightId: id,
        type: 'edit',
        description: 'Insight updated',
        userId,
      });
    }

    return res.json({ data: { success: true }, meta: insightMutationMeta() });
  })
);

router.post(
  '/insights/:id/export',
  requirePermission('INTERVIEW_INSIGHTS_HANDOFF'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { id } = req.params;
    const { target } = req.body;

    if (!target || !['tools', 'assessment'].includes(target)) {
      return res.status(400).json({
        error: 'target must be "tools" or "assessment"',
        code: 'INTERVIEW_INSIGHT_EXPORT_INVALID_TARGET',
      });
    }

    let insightRow: any = null;
    try {
      insightRow = await queryHelpers.queryOne(
        `SELECT id, session_id, organization_id, category, title, description, insight_type, status, exported_to_tools, exported_to_assessment
         FROM interview_insights WHERE id = ? AND organization_id = ?`,
        [id, organizationId]
      );
    } catch {
      try {
        insightRow = await queryHelpers.queryOne(
          `SELECT id, organization_id, title, prompt_type, source_session_ids, content, status
           FROM interview_insights WHERE id = ? AND organization_id = ?`,
          [id, organizationId]
        );
      } catch {
        /* handled below */
      }
    }

    if (!insightRow) {
      return res
        .status(404)
        .json({ error: 'Insight not found', code: 'INTERVIEW_INSIGHT_NOT_FOUND' });
    }

    let sessionId: string | null = null;
    if (insightRow.session_id) {
      sessionId = String(insightRow.session_id);
    } else if (insightRow.source_session_ids) {
      try {
        const ids = JSON.parse(String(insightRow.source_session_ids || '[]'));
        if (Array.isArray(ids) && ids[0]) sessionId = String(ids[0]);
      } catch {
        /* ignore */
      }
    }

    if (sessionId) {
      const sessionRow = await queryHelpers.queryOne(
        `SELECT id, status, assignment_id, project_id FROM interview_sessions WHERE id = ? AND organization_id = ?`,
        [sessionId, organizationId]
      );
      if (sessionRow) {
        const sessionStatus = String((sessionRow as any).status || '').toLowerCase();
        if ((sessionRow as any).assignment_id) {
          const assignment = await queryHelpers.queryOne(
            `SELECT status FROM interview_assignments WHERE id = ? AND organization_id = ?`,
            [(sessionRow as any).assignment_id, organizationId]
          );
          const asgStatus = String((assignment as any)?.status || '').toLowerCase();
          if (asgStatus !== 'approved' && asgStatus !== 'completed') {
            return res.status(409).json({
              error: 'Interview not approved - cannot export yet',
              code: 'INTERVIEW_INSIGHT_EXPORT_NOT_APPROVED',
            });
          }
        } else if (sessionStatus !== 'completed') {
          return res.status(409).json({
            error: 'Interview not completed - cannot export yet',
            code: 'INTERVIEW_INSIGHT_EXPORT_NOT_COMPLETED',
          });
        }
      }
    }

    await queryHelpers.queryRun(
      `CREATE TABLE IF NOT EXISTS interview_insight_exports (
        id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, insight_id TEXT NOT NULL,
        session_id TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT NOT NULL,
        created_by TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );

    const existing = (await queryHelpers.queryOne(
      `SELECT target_id FROM interview_insight_exports WHERE organization_id = ? AND insight_id = ? AND target_type = ? ORDER BY created_at DESC LIMIT 1`,
      [organizationId, id, target]
    )) as any;

    if (existing?.target_id) {
      const column = target === 'tools' ? 'exported_to_tools' : 'exported_to_assessment';
      // `id` is already org-validated above; the org guard mirrors sibling
      // writes and keeps this defensive against future refactors.
      await queryHelpers.queryRun(
        `UPDATE interview_insights SET ${column} = 1, updated_at = ? WHERE id = ? AND organization_id = ?`,
        [new Date().toISOString(), id, organizationId]
      );
      void logInsightActivity({
        organizationId,
        insightId: id,
        type: 'exported',
        description: `Exported to ${target}`,
        userId,
      });
      return res.json({
        data: { success: true, target, targetId: existing.target_id },
        meta: insightMutationMeta(),
      });
    }

    const now = new Date().toISOString();
    const p10Findings: P10Finding[] = await listP10Findings(id).catch(() => [] as P10Finding[]);
    const boundedInsightPayload = {
      findings: p10Findings.map((finding) => ({
        id: finding.id,
        findingStatement: finding.finding_statement,
        confidenceLevel: finding.confidence_level,
        limits: finding.limits,
        nextAction: finding.next_action,
        evidencePointers: finding.evidence_pointers.filter((pointer) => !pointer.isTombstone),
      })),
      counts: {
        findings: p10Findings.length,
        activeEvidence: p10Findings.reduce(
          (sum, finding) =>
            sum + finding.evidence_pointers.filter((pointer) => !pointer.isTombstone).length,
          0
        ),
      },
    };

    if (target === 'tools') {
      await queryHelpers.queryRun(
        `CREATE TABLE IF NOT EXISTS tool_sessions (
          id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT, tool_type TEXT NOT NULL,
          name TEXT NOT NULL, status TEXT DEFAULT 'DRAFT', completion_percent INTEGER DEFAULT 0,
          confidence_avg REAL DEFAULT 0, answers_json TEXT DEFAULT '{}', context_snapshot TEXT DEFAULT '{}',
          review_requested_at TIMESTAMP, approved_at TIMESTAMP, created_by TEXT NOT NULL,
          updated_by TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      );

      let resolvedProjectId: string | null = null;
      try {
        resolvedProjectId = await resolveValidProjectId({ organizationId });
      } catch {
        /* ignore */
      }

      const toolSessionId = uuidv4();
      const orgContext = await organizationContextService.buildResolvedContext(organizationId);
      const contextSnapshot = {
        source: {
          kind: 'interview_insight',
          insightId: id,
          sessionId,
          category: insightRow.category,
          title: insightRow.title,
          description: insightRow.description || insightRow.content || null,
          insightType: insightRow.insight_type || insightRow.prompt_type || null,
          exportedAt: now,
        },
        boundedInsightPayload,
        organizationContext: orgContext,
        // D2 — ToolInitiativeService reads `context.org`. Mirror the org context
        // under that key so the downstream generator actually sees it (the
        // `organizationContext` key it was written under was never read).
        org: orgContext,
      };

      await queryHelpers.queryRun(
        `INSERT INTO tool_sessions (id, organization_id, project_id, tool_type, name, status, completion_percent, confidence_avg, answers_json, context_snapshot, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'DRAFT', 0, 0, ?, ?, ?, ?, ?)`,
        [
          toolSessionId,
          organizationId,
          resolvedProjectId,
          'dynamic-swot',
          // Z139 (data-integrity): decode before storing tool_sessions.name —
          // insightRow.title may already carry entities escaped by the global
          // sanitizer on a prior save (mirrors notebook/canvas decode-before-store).
          decodeHtmlEntities(`Interview Insight: ${String(insightRow.title || 'Untitled')}`),
          JSON.stringify({}),
          JSON.stringify(contextSnapshot),
          userId,
          now,
          now,
        ]
      );

      await queryHelpers.queryRun(
        `INSERT INTO interview_insight_exports (id, organization_id, insight_id, session_id, target_type, target_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), organizationId, id, sessionId || 'unknown', 'tools', toolSessionId, userId, now]
      );

      try {
        await queryHelpers.queryRun(
          `UPDATE interview_insights SET exported_to_tools = 1, updated_at = ? WHERE id = ? AND organization_id = ?`,
          [now, id, organizationId]
        );
      } catch {
        /* ignore */
      }
      void logInsightActivity({
        organizationId,
        insightId: id,
        type: 'exported',
        description: 'Exported to tools',
        userId,
      });
      return res.json({
        data: { success: true, target: 'tools', targetId: toolSessionId },
        meta: insightMutationMeta(),
      });
    }

    // target === 'assessment'
    await queryHelpers.queryRun(
      `CREATE TABLE IF NOT EXISTS assessments (
        id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT, assessment_type TEXT NOT NULL,
        name TEXT NOT NULL, status TEXT DEFAULT 'DRAFT', completion_percent INTEGER DEFAULT 0,
        confidence_avg REAL DEFAULT 0, answers_json TEXT DEFAULT '{}', context_snapshot TEXT DEFAULT '{}',
        score_summary TEXT DEFAULT '{}', current_section_id TEXT, review_requested_at TIMESTAMP,
        report_approved_at TIMESTAMP, approved_at TIMESTAMP, created_by TEXT NOT NULL,
        updated_by TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );

    let resolvedProjectId: string | null = null;
    try {
      resolvedProjectId = await resolveValidProjectId({ organizationId });
    } catch {
      /* ignore */
    }

    const assessmentId = uuidv4();
    const orgContext = await organizationContextService.buildResolvedContext(organizationId);
    const contextSnapshot = {
      source: {
        kind: 'interview_insight',
        insightId: id,
        sessionId,
        category: insightRow.category,
        title: insightRow.title,
        description: insightRow.description || insightRow.content || null,
        insightType: insightRow.insight_type || insightRow.prompt_type || null,
        exportedAt: now,
      },
      boundedInsightPayload,
      organizationContext: orgContext,
      // D1 — assessmentInitiativeService reads `contextSnapshot.org`. Mirror
      // the org context under that key so the DRD assessment generator sees it
      // (the `organizationContext` key it was written under was never read).
      org: orgContext,
    };

    await queryHelpers.queryRun(
      `INSERT INTO assessments (id, organization_id, project_id, assessment_type, name, status, completion_percent, confidence_avg, answers_json, context_snapshot, score_summary, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'DRAFT', 0, 0, ?, ?, ?, ?, ?, ?)`,
      [
        assessmentId,
        organizationId,
        resolvedProjectId,
        'DRD',
        `Interview Insight: ${String(insightRow.title || 'Untitled')}`,
        JSON.stringify({}),
        JSON.stringify(contextSnapshot),
        JSON.stringify({}),
        userId,
        now,
        now,
      ]
    );

    await queryHelpers.queryRun(
      `INSERT INTO interview_insight_exports (id, organization_id, insight_id, session_id, target_type, target_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        organizationId,
        id,
        sessionId || 'unknown',
        'assessment',
        assessmentId,
        userId,
        now,
      ]
    );

    try {
      await queryHelpers.queryRun(
        `UPDATE interview_insights SET exported_to_assessment = 1, updated_at = ? WHERE id = ? AND organization_id = ?`,
        [now, id, organizationId]
      );
    } catch {
      /* ignore */
    }
    void logInsightActivity({
      organizationId,
      insightId: id,
      type: 'exported',
      description: 'Exported to assessment',
      userId,
    });
    return res.json({
      data: { success: true, target: 'assessment', targetId: assessmentId, assessmentType: 'DRD' },
      meta: insightMutationMeta(),
    });
  })
);

router.get(
  '/insights/:id/activity',
  requirePermission('INTERVIEW_INSIGHTS_VIEW'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { id } = req.params;

    const row = await queryHelpers.queryOne(
      `SELECT organization_id FROM interview_insights WHERE id = ?`,
      [id]
    );
    if (!row)
      return res
        .status(404)
        .json({ error: 'Insight not found', code: 'INTERVIEW_INSIGHT_NOT_FOUND' });
    if (String((row as any).organization_id) !== String(organizationId)) {
      return res.status(403).json({ error: 'Forbidden', code: 'INTERVIEW_INSIGHT_FORBIDDEN' });
    }

    await ensureInterviewInsightActivityTable();
    // Fail-soft read: if the activity table is briefly unavailable (freshly
    // provisioned / transient error), degrade to an empty list rather than a
    // bare 500 — the audit-log query below already does the same.
    const entries = await queryHelpers
      .queryAll(
        `SELECT a.id, a.type, a.description, a.created_at, u.first_name, u.last_name
       FROM interview_insight_activity a LEFT JOIN users u ON u.id = a.user_id
       WHERE a.organization_id = ? AND a.insight_id = ? ORDER BY a.created_at DESC`,
        [organizationId, id]
      )
      .catch(() => []);
    const auditEntries = await queryHelpers
      .queryAll(
        `SELECT a.id, a.action as type, a.entity_type, a.entity_id, a.created_at, a.detail_json, u.first_name, u.last_name
         FROM interview_insight_audit_log a
         LEFT JOIN users u ON u.id = a.actor_user_id
         WHERE a.organization_id = ? AND a.insight_id = ?
         ORDER BY a.created_at DESC`,
        [organizationId, id]
      )
      .catch(() => []);
    const describeAuditEntry = (entry: any): string => {
      let detail: any = {};
      try {
        detail = entry.detail_json ? JSON.parse(String(entry.detail_json)) : {};
      } catch {
        detail = {};
      }
      if (entry.entity_type === 'interview_report_worksheet') {
        const worksheetKey = String(detail.worksheetKey || entry.entity_id || 'worksheet');
        if (entry.type === 'worksheet_update_blocked') {
          return `Report worksheet ${worksheetKey} update blocked because report pack is published`;
        }
        const status = String(detail.updates?.status || 'updated');
        const score =
          detail.nextPack?.completenessScore !== undefined
            ? `, pack completeness ${detail.nextPack.completenessScore}%`
            : '';
        return `Report worksheet ${worksheetKey} marked ${status}${score}`;
      }
      if (entry.entity_type === 'interview_report_pack') {
        const readinessStatus = String(
          detail.readiness?.status || detail.readinessStatus || 'unknown'
        );
        const blockerCount = Array.isArray(detail.readiness?.blockers)
          ? detail.readiness.blockers.length
          : 0;
        if (entry.type === 'report_pack_review_blocked') {
          return `Report pack review blocked by readiness gate (${blockerCount} blockers)`;
        }
        if (entry.type === 'report_pack_submitted_for_review') {
          return `Report pack submitted for review (${readinessStatus})`;
        }
        if (entry.type === 'report_pack_publish_blocked') {
          return `Report pack publish blocked by readiness gate (${blockerCount} blockers)`;
        }
        if (entry.type === 'report_pack_published') {
          return `Report pack published (${readinessStatus})`;
        }
        if (entry.type === 'report_pack_exported') {
          const worksheetCount =
            detail.worksheetCount !== undefined ? `, ${detail.worksheetCount} worksheets` : '';
          const hash = detail.manifestHash
            ? `, hash ${String(detail.manifestHash).slice(0, 12)}`
            : '';
          return `Report pack export manifest downloaded (${readinessStatus}${worksheetCount}${hash})`;
        }
        if (entry.type === 'report_pack_client_markdown_exported') {
          const worksheetCount =
            detail.worksheetCount !== undefined ? `, ${detail.worksheetCount} worksheets` : '';
          const hash = detail.exportHash
            ? `, export hash ${String(detail.exportHash).slice(0, 12)}`
            : '';
          return `Client-ready Markdown report downloaded (${detail.format || 'markdown'}${worksheetCount}${hash})`;
        }
        if (entry.type === 'report_pack_revision_created') {
          const version = detail.version !== undefined ? ` v${detail.version}` : '';
          const hash = detail.manifestHash
            ? `, base hash ${String(detail.manifestHash).slice(0, 12)}`
            : '';
          return `Report pack revision${version} created from published pack${hash}`;
        }
      }
      return `Audit: ${String(entry.type || 'updated')}`;
    };

    const mergedEntries = [
      ...(entries || []).map((e: any) => ({
        id: e.id,
        type: e.type,
        description: e.description,
        created_at: e.created_at,
        first_name: e.first_name,
        last_name: e.last_name,
      })),
      ...(auditEntries || []).map((e: any) => ({
        id: e.id,
        type: e.type,
        description: describeAuditEntry(e),
        created_at: e.created_at,
        first_name: e.first_name,
        last_name: e.last_name,
      })),
    ].sort((a: any, b: any) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return tb - ta;
    });

    return res.json({
      data: {
        activity: mergedEntries.map((e: any) => ({
          id: e.id,
          type: e.type,
          description: e.description,
          timestamp: e.created_at,
          userName:
            `${String(e.first_name || '').trim()} ${String(e.last_name || '').trim()}`.trim() ||
            undefined,
        })),
      },
      meta: insightReadMeta(),
    });
  })
);

router.get(
  '/insights/:id/comments',
  requirePermission('INTERVIEW_INSIGHTS_VIEW'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { id } = req.params;

    const row = await queryHelpers.queryOne(
      `SELECT organization_id FROM interview_insights WHERE id = ?`,
      [id]
    );
    if (!row)
      return res
        .status(404)
        .json({ error: 'Insight not found', code: 'INTERVIEW_INSIGHT_NOT_FOUND' });
    if (String((row as any).organization_id) !== String(organizationId)) {
      return res.status(403).json({ error: 'Forbidden', code: 'INTERVIEW_INSIGHT_FORBIDDEN' });
    }

    const { CommentService } = await import('../../services/content/CommentService.js');
    const commentService = new CommentService();
    const comments = await commentService.getContentComments(id, 'interview_insight', {
      includeResolved: true,
    });

    const safeParsePriority = (positionRef?: string | null) => {
      if (!positionRef) return 'normal';
      try {
        const parsed = JSON.parse(positionRef);
        const p = String((parsed as any)?.priority || '').toLowerCase();
        return p === 'low' || p === 'high' || p === 'normal' ? p : 'normal';
      } catch {
        return 'normal';
      }
    };

    return res.json({
      data: {
        comments: (comments || []).map((c: any) => ({
          id: c.id,
          authorName: c.user ? `${c.user.firstName} ${c.user.lastName}`.trim() : undefined,
          content: c.commentText,
          createdAt: c.createdAt,
          priority: safeParsePriority(c.positionRef),
        })),
      },
      meta: insightReadMeta(),
    });
  })
);

router.post(
  '/insights/:id/comments',
  requirePermission('INTERVIEW_INSIGHTS_VIEW'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { id } = req.params;
    const { content, priority } = req.body || {};

    const row = await queryHelpers.queryOne(
      `SELECT organization_id FROM interview_insights WHERE id = ?`,
      [id]
    );
    if (!row)
      return res
        .status(404)
        .json({ error: 'Insight not found', code: 'INTERVIEW_INSIGHT_NOT_FOUND' });
    if (String((row as any).organization_id) !== String(organizationId)) {
      return res.status(403).json({ error: 'Forbidden', code: 'INTERVIEW_INSIGHT_FORBIDDEN' });
    }

    const text = typeof content === 'string' ? content.trim() : '';
    if (!text)
      return res
        .status(400)
        .json({ error: 'content is required', code: 'INTERVIEW_INSIGHT_COMMENT_EMPTY' });

    const p = String(priority || '').toLowerCase();
    const safePriority = p === 'low' || p === 'high' || p === 'normal' ? p : 'normal';

    const { CommentService } = await import('../../services/content/CommentService.js');
    const commentService = new CommentService();
    const created = await commentService.createComment({
      contentId: id,
      contentType: 'interview_insight',
      userId,
      commentText: text,
      positionRef: JSON.stringify({ priority: safePriority }),
    });

    void logInsightActivity({
      organizationId,
      insightId: id,
      type: 'comment',
      description: 'Comment added',
      userId,
    });

    return res.status(201).json({
      data: {
        id: created.id,
        authorName: created.user
          ? `${created.user.firstName} ${created.user.lastName}`.trim()
          : undefined,
        content: created.commentText,
        createdAt: created.createdAt,
        priority: safePriority,
      },
      meta: insightMutationMeta(),
    });
  })
);

router.delete(
  '/insights/:id/comments/:commentId',
  requirePermission('INTERVIEW_INSIGHTS_VIEW'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { id, commentId } = req.params;

    const row = await queryHelpers.queryOne(
      `SELECT organization_id FROM interview_insights WHERE id = ?`,
      [id]
    );
    if (!row)
      return res
        .status(404)
        .json({ error: 'Insight not found', code: 'INTERVIEW_INSIGHT_NOT_FOUND' });
    if (String((row as any).organization_id) !== String(organizationId)) {
      return res.status(403).json({ error: 'Forbidden', code: 'INTERVIEW_INSIGHT_FORBIDDEN' });
    }

    const { CommentService } = await import('../../services/content/CommentService.js');
    const commentService = new CommentService();
    const comment = await commentService.getCommentById(commentId);
    if (!comment || comment.contentId !== id || comment.contentType !== 'interview_insight') {
      return res
        .status(404)
        .json({ error: 'Comment not found', code: 'INTERVIEW_INSIGHT_COMMENT_NOT_FOUND' });
    }

    const role = String((req as any).user?.role || '').toUpperCase();
    const canDelete = comment.userId === userId || role === 'ADMIN' || role === 'SUPERADMIN';
    if (!canDelete)
      return res
        .status(403)
        .json({ error: 'Forbidden', code: 'INTERVIEW_INSIGHT_COMMENT_FORBIDDEN' });

    const deleted = await commentService.deleteComment(commentId);
    if (!deleted)
      return res
        .status(404)
        .json({ error: 'Comment not found', code: 'INTERVIEW_INSIGHT_COMMENT_NOT_FOUND' });

    void logInsightActivity({
      organizationId,
      insightId: id,
      type: 'comment',
      description: 'Comment deleted',
      userId,
    });
    return res.json({ data: { success: true }, meta: insightMutationMeta() });
  })
);

router.delete(
  '/insights/:id',
  requirePermission('INTERVIEW_INSIGHTS_PUBLISH'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { id } = req.params;

    const row = await queryHelpers.queryOne(
      `SELECT organization_id FROM interview_insights WHERE id = ?`,
      [id]
    );
    if (!row)
      return res
        .status(404)
        .json({ error: 'Insight not found', code: 'INTERVIEW_INSIGHT_NOT_FOUND' });
    if (String((row as any).organization_id) !== String(organizationId)) {
      return res.status(403).json({ error: 'Forbidden', code: 'INTERVIEW_INSIGHT_FORBIDDEN' });
    }

    const interviewInsightService = await import('../../services/InterviewInsightService.js');
    let deleted = false;
    try {
      deleted = await interviewInsightService.deleteInsight(id);
    } catch (error) {
      // M03R-008 — ta sama bramka co na trasie v1; obie ścieżki kasowania muszą
      // odmawiać tak samo, inaczej guard da się obejść wyborem endpointu.
      if (error instanceof interviewInsightService.InsightReferencedError) {
        return res.status(error.status).json({
          error: error.message,
          code: error.code,
          referencingCount: error.referencingCount,
        });
      }
      throw error;
    }
    if (!deleted)
      return res
        .status(404)
        .json({ error: 'Insight not found', code: 'INTERVIEW_INSIGHT_NOT_FOUND' });

    return res.json({ data: { success: true }, meta: insightMutationMeta() });
  })
);

export default router;
