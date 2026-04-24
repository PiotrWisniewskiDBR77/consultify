/**
 * V8 Interview bridge — org-scoped session listing/detail, assignments, and insight endpoints.
 * Namespace: /api/v8/interview (mounted by v8/index).
 *
 * @module routes/v8/interview.routes
 */

import type { Response } from 'express';
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import {
  InterviewController,
  loadAcceptedInterviewSessionsForManager,
  loadInterviewSessionForOrganization,
  loadInterviewSessionsForOrganization,
  loadManagedInterviewSessionsForManager,
} from '../../controllers/InterviewController.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import {
  getManagedAssignments,
  getMyAssignments,
  getOverdueAssignments,
} from '../../services/InterviewAssignmentService.js';
import { resolveInterviewManagerScope } from '../../services/interviewManagerScope.js';
import organizationContextService from '../../services/organizationContext/OrganizationContextService.js';
import { listFindings as listP10Findings } from '../../services/v8/interviewInsightFindingsService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getTableColumns } from '../../utils/dbSchema.js';
import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';

const router = Router();

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
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const sessions = await loadAcceptedInterviewSessionsForManager(organizationId, userId);
    return res.json({ data: { sessions }, meta: interviewMeta() });
  })
);

router.get(
  '/sessions/managed',
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

router.post('/assignments/:id/start', v8Wrap(InterviewController.startAssignment, interviewMeta));

router.post('/assignments/:id/submit', v8Wrap(InterviewController.submitAssignment, interviewMeta));

router.post(
  '/assignments/:id/remind',
  v8Wrap(InterviewController.sendAssignmentReminder, interviewMeta)
);

router.patch(
  '/assignments/:id/manage',
  v8Wrap(InterviewController.manageAssignment, interviewMeta)
);

router.post(
  '/assignments/:id/archive',
  v8Wrap(InterviewController.archiveAssignment, interviewMeta)
);

router.post(
  '/assignments/:id/send-back',
  v8Wrap(InterviewController.sendBackAssignment, interviewMeta)
);

router.post(
  '/assignments/:id/approve',
  v8Wrap(InterviewController.approveAssignment, interviewMeta)
);

router.post(
  '/assignments/:id/revoke-approval',
  v8Wrap(InterviewController.revokeApproval, interviewMeta)
);

router.post(
  '/sessions/:sessionId/evaluate-answers',
  v8Wrap(InterviewController.evaluateSessionAnswers, interviewMeta)
);

// ==========================================
// INSIGHTS — V8 bounded bridge (P10)
// ==========================================

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

router.post(
  '/insights',
  requirePermission('INTERVIEW_INSIGHTS_CREATE'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { title, sessionIds, sessionId, promptType, filters, customPrompt } = req.body || {};

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

    let normalizedTitle = typeof title === 'string' ? title.trim() : '';
    const normalizedPromptType = (
      typeof promptType === 'string' && promptType.trim() ? promptType.trim() : 'summary'
    ) as any;

    if (!normalizedTitle) {
      try {
        const sessionRow = await queryHelpers.queryOne(
          `SELECT name FROM interview_sessions WHERE id = ?`,
          [normalizedSessionIds[0]]
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
      customPrompt,
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
      updates.push('status = ?');
      values.push(status);
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
      await queryHelpers.queryRun(
        `UPDATE interview_insights SET ${column} = 1, updated_at = ? WHERE id = ?`,
        [new Date().toISOString(), id]
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
    const p10Findings = await listP10Findings(id).catch(() => []);
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
      };

      await queryHelpers.queryRun(
        `INSERT INTO tool_sessions (id, organization_id, project_id, tool_type, name, status, completion_percent, confidence_avg, answers_json, context_snapshot, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'DRAFT', 0, 0, ?, ?, ?, ?, ?)`,
        [
          toolSessionId,
          organizationId,
          resolvedProjectId,
          'dynamic-swot',
          `Interview Insight: ${String(insightRow.title || 'Untitled')}`,
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
          `UPDATE interview_insights SET exported_to_tools = 1, updated_at = ? WHERE id = ?`,
          [now, id]
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
        `UPDATE interview_insights SET exported_to_assessment = 1, updated_at = ? WHERE id = ?`,
        [now, id]
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
    const entries = await queryHelpers.queryAll(
      `SELECT a.id, a.type, a.description, a.created_at, u.first_name, u.last_name
       FROM interview_insight_activity a LEFT JOIN users u ON u.id = a.user_id
       WHERE a.organization_id = ? AND a.insight_id = ? ORDER BY a.created_at DESC`,
      [organizationId, id]
    );
    const auditEntries = await queryHelpers
      .queryAll(
        `SELECT a.id, a.action as type, a.created_at, a.detail_json, u.first_name, u.last_name
         FROM interview_insight_audit_log a
         LEFT JOIN users u ON u.id = a.actor_user_id
         WHERE a.organization_id = ? AND a.insight_id = ?
         ORDER BY a.created_at DESC`,
        [organizationId, id]
      )
      .catch(() => []);
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
        description: `P10: ${String(e.type || 'updated')}`,
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
    const deleted = await interviewInsightService.deleteInsight(id);
    if (!deleted)
      return res
        .status(404)
        .json({ error: 'Insight not found', code: 'INTERVIEW_INSIGHT_NOT_FOUND' });

    return res.json({ data: { success: true }, meta: insightMutationMeta() });
  })
);

export default router;
