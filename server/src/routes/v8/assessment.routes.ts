/**
 * V8 bounded Assessment bridge.
 * Provides org-scoped list/detail/create/update for assessment runtime surfaces
 * that currently suffer from legacy split-brain wiring.
 */

import type { Response } from 'express';
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { ensureAssessmentSchema, normalizeStatus } from '../../controllers/AssessmentController.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import AssessmentPermissionService from '../../services/assessmentPermissionService.js';
import { assessmentAuditLogger } from '../../utils/AssessmentAuditLogger.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as queryHelpers from '../../utils/queryHelpers.js';

const router = Router();

export const V8_ASSESSMENT_READ_CONTRACT = 'assessment_runtime_read_v1';
export const V8_ASSESSMENT_MUTATION_CONTRACT = 'assessment_runtime_mutation_v1';

function assessmentReadMeta() {
  return {
    version: 'v8' as const,
    contract: V8_ASSESSMENT_READ_CONTRACT,
    readScope: 'persisted_database' as const,
  };
}

function assessmentMutationMeta() {
  return {
    version: 'v8' as const,
    contract: V8_ASSESSMENT_MUTATION_CONTRACT,
    writeScope: 'bounded_assessment_runtime' as const,
  };
}

const VALID_ASSESSMENT_TYPES = new Set(['DRD', 'SIRI', 'ADMA', 'CMMI', 'LEAN']);

const firstParam = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
};

const parseJsonSafely = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const isGlobalAdminRole = (role: string): boolean => {
  const value = String(role || '').toUpperCase();
  return (
    value === 'ADMIN' ||
    value === 'ADMINISTRATOR' ||
    value === 'OWNER' ||
    value === 'SUPERADMIN' ||
    value === 'SUPER_ADMIN'
  );
};

async function ensureAssessmentInOrg(
  assessmentId: string,
  organizationId: string
): Promise<Record<string, unknown> | null> {
  await ensureAssessmentSchema();
  return (await queryHelpers.queryOne(
    `SELECT id, created_by FROM assessments WHERE id = ? AND organization_id = ?`,
    [assessmentId, organizationId]
  )) as Record<string, unknown> | null;
}

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const projectId = firstParam(req.query.projectId);
    const status = firstParam(req.query.status);
    const assessmentType = firstParam(req.query.assessmentType);
    const limit = Number(firstParam(req.query.limit) ?? 100) || 100;
    const offset = Number(firstParam(req.query.offset) ?? 0) || 0;

    let sql = `SELECT * FROM assessments WHERE organization_id = ?`;
    const params: unknown[] = [organizationId];

    if (projectId) {
      sql += ` AND project_id = ?`;
      params.push(projectId);
    }
    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    if (assessmentType) {
      sql += ` AND assessment_type = ?`;
      params.push(assessmentType);
    }

    sql += ` ORDER BY updated_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rows = (await queryHelpers.queryAll(sql, params)) as Array<Record<string, unknown>>;
    const items = rows.map((row) => ({
      ...row,
      status: normalizeStatus(String(row.status || 'DRAFT')),
      backendStatus: row.status,
      answers: parseJsonSafely(row.answers_json as string | null | undefined, {}),
      scoreSummary: parseJsonSafely(row.score_summary as string | null | undefined, {}),
    }));

    return res.json({
      data: {
        items,
        assessments: items,
        total: items.length,
        limit,
        offset,
      },
      meta: assessmentReadMeta(),
    });
  })
);

router.get(
  '/:assessmentId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const assessmentId = firstParam(req.params.assessmentId);
    if (!assessmentId) {
      return res
        .status(400)
        .json({ error: 'Assessment id is required', code: 'ASSESSMENT_ID_REQUIRED' });
    }

    await ensureAssessmentSchema();

    const assessment = (await queryHelpers.queryOne(
      `SELECT * FROM assessments WHERE id = ? AND organization_id = ?`,
      [assessmentId, organizationId]
    )) as Record<string, unknown> | null;

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found', code: 'ASSESSMENT_NOT_FOUND' });
    }

    const normalized = {
      ...assessment,
      status: normalizeStatus(String(assessment.status || 'DRAFT')),
      backendStatus: assessment.status,
      answers: parseJsonSafely(assessment.answers_json as string | null | undefined, {}),
      contextSnapshot: parseJsonSafely(
        assessment.context_snapshot as string | null | undefined,
        {}
      ),
      scoreSummary: parseJsonSafely(assessment.score_summary as string | null | undefined, {}),
      navigation: parseJsonSafely(assessment.navigation_json as string | null | undefined, null),
    };

    return res.json({
      data: { assessment: normalized },
      meta: assessmentReadMeta(),
    });
  })
);

router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const assessmentType = String(req.body?.assessmentType || '')
      .trim()
      .toUpperCase();
    const name = String(req.body?.name || '').trim();
    const projectId = req.body?.projectId ? String(req.body.projectId) : null;

    if (!assessmentType || !name) {
      return res.status(400).json({
        error: 'assessmentType and name are required',
        code: 'ASSESSMENT_CREATE_INVALID',
      });
    }

    if (!VALID_ASSESSMENT_TYPES.has(assessmentType)) {
      return res.status(400).json({
        error: 'Invalid assessment type',
        code: 'ASSESSMENT_INVALID_TYPE',
      });
    }

    await ensureAssessmentSchema();

    const id = uuidv4();
    const now = new Date().toISOString();

    await queryHelpers.queryRun(
      `INSERT INTO assessments (
        id, organization_id, project_id, assessment_type, name, status,
        completion_percent, confidence_avg, answers_json, context_snapshot,
        created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        organizationId,
        projectId,
        assessmentType,
        name,
        'DRAFT',
        0,
        0,
        '{}',
        '{}',
        userId,
        userId,
        now,
        now,
      ]
    );

    await queryHelpers.queryRun(
      `INSERT INTO assessment_sessions (id, assessment_id, user_id, opened_at) VALUES (?, ?, ?, ?)`,
      [uuidv4(), id, userId, now]
    );

    assessmentAuditLogger.logCreation(req, id, assessmentType).catch(() => {});

    return res.status(201).json({
      data: {
        id,
        assessment: {
          id,
          assessmentType,
          name,
          projectId,
          status: 'DRAFT',
          backendStatus: 'DRAFT',
          createdAt: now,
          updatedAt: now,
        },
      },
      meta: assessmentMutationMeta(),
    });
  })
);

router.put(
  '/:assessmentId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const assessmentId = firstParam(req.params.assessmentId);
    if (!assessmentId) {
      return res
        .status(400)
        .json({ error: 'Assessment id is required', code: 'ASSESSMENT_ID_REQUIRED' });
    }

    await ensureAssessmentSchema();

    const existing = (await queryHelpers.queryOne<{
      answers_json?: string | null;
      context_snapshot?: string | null;
      score_summary?: string | null;
      completion_percent?: number | null;
      confidence_avg?: number | null;
      current_section_id?: string | null;
      navigation_json?: string | null;
    }>(
      `SELECT answers_json, context_snapshot, score_summary, completion_percent, confidence_avg, current_section_id, navigation_json
       FROM assessments
       WHERE id = ? AND organization_id = ?`,
      [assessmentId, organizationId]
    )) as {
      answers_json?: string | null;
      context_snapshot?: string | null;
      score_summary?: string | null;
      completion_percent?: number | null;
      confidence_avg?: number | null;
      current_section_id?: string | null;
      navigation_json?: string | null;
    } | null;

    if (!existing) {
      return res.status(404).json({ error: 'Assessment not found', code: 'ASSESSMENT_NOT_FOUND' });
    }

    const nextAnswers =
      req.body?.answers !== undefined
        ? req.body.answers
        : parseJsonSafely(existing.answers_json, {});
    const nextContextSnapshot =
      req.body?.contextSnapshot !== undefined
        ? req.body.contextSnapshot
        : parseJsonSafely(existing.context_snapshot, {});
    const nextScoreSummary =
      req.body?.scoreSummary !== undefined
        ? req.body.scoreSummary
        : parseJsonSafely(existing.score_summary, {});
    const nextCompletionPercent =
      req.body?.completionPercent !== undefined
        ? Number(req.body.completionPercent)
        : Number(existing.completion_percent || 0);
    const nextConfidenceAvg =
      req.body?.confidenceAvg !== undefined
        ? Number(req.body.confidenceAvg)
        : Number(existing.confidence_avg || 0);
    const nextCurrentSectionId =
      req.body?.currentSectionId !== undefined
        ? req.body.currentSectionId || null
        : existing.current_section_id || null;
    const nextNavigation =
      req.body?.navigation !== undefined
        ? req.body.navigation
        : parseJsonSafely(existing.navigation_json, {});
    const now = new Date().toISOString();

    await queryHelpers.queryRun(
      `UPDATE assessments
       SET name = COALESCE(?, name),
           answers_json = ?, context_snapshot = ?, completion_percent = ?, confidence_avg = ?,
           score_summary = ?, current_section_id = ?, navigation_json = ?, updated_by = ?, updated_at = ?
       WHERE id = ? AND organization_id = ?`,
      [
        req.body?.name ?? null,
        JSON.stringify(nextAnswers || {}),
        JSON.stringify(nextContextSnapshot || {}),
        nextCompletionPercent,
        nextConfidenceAvg,
        JSON.stringify(nextScoreSummary || {}),
        nextCurrentSectionId,
        JSON.stringify(nextNavigation || {}),
        userId,
        now,
        assessmentId,
        organizationId,
      ]
    );

    assessmentAuditLogger
      .logUpdate(req, assessmentId, {
        completionPercent: nextCompletionPercent,
        hasAnswers: req.body?.answers !== undefined,
        hasContextSnapshot: req.body?.contextSnapshot !== undefined,
      })
      .catch(() => {});

    return res.json({
      data: { id: assessmentId, updatedAt: now },
      meta: assessmentMutationMeta(),
    });
  })
);

router.get(
  '/:assessmentId/my-role',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId, userRole } = getV8Context(req);
    const assessmentId = firstParam(req.params.assessmentId);
    if (!assessmentId) {
      return res
        .status(400)
        .json({ error: 'Assessment id is required', code: 'ASSESSMENT_ID_REQUIRED' });
    }

    const assessment = await ensureAssessmentInOrg(assessmentId, organizationId);
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found', code: 'ASSESSMENT_NOT_FOUND' });
    }

    const roleInfo = isGlobalAdminRole(userRole)
      ? {
          role: 'admin',
          permissions: AssessmentPermissionService.getDefaultPermissions('admin'),
          assignedAreas: null,
          isOwner: true,
        }
      : await AssessmentPermissionService.getUserRole(assessmentId, userId, organizationId);

    return res.json({
      data: roleInfo,
      meta: assessmentReadMeta(),
    });
  })
);

router.get(
  '/:assessmentId/user-state',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const assessmentId = firstParam(req.params.assessmentId);
    if (!assessmentId) {
      return res
        .status(400)
        .json({ error: 'Assessment id is required', code: 'ASSESSMENT_ID_REQUIRED' });
    }

    const assessment = await ensureAssessmentInOrg(assessmentId, organizationId);
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found', code: 'ASSESSMENT_NOT_FOUND' });
    }

    const row = (await queryHelpers.queryOne(
      `SELECT navigation_json, updated_at
       FROM assessment_user_state
       WHERE assessment_id = ? AND user_id = ?`,
      [assessmentId, userId]
    )) as { navigation_json?: string | null; updated_at?: string | null } | null;

    return res.json({
      data: {
        assessmentId,
        userId,
        navigation: parseJsonSafely(row?.navigation_json, null),
        updatedAt: row?.updated_at || null,
      },
      meta: assessmentReadMeta(),
    });
  })
);

router.put(
  '/:assessmentId/user-state',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const assessmentId = firstParam(req.params.assessmentId);
    if (!assessmentId) {
      return res
        .status(400)
        .json({ error: 'Assessment id is required', code: 'ASSESSMENT_ID_REQUIRED' });
    }

    const assessment = await ensureAssessmentInOrg(assessmentId, organizationId);
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found', code: 'ASSESSMENT_NOT_FOUND' });
    }

    const now = new Date().toISOString();
    const navigation = req.body?.navigation || {};

    await queryHelpers.queryRun(
      `INSERT INTO assessment_user_state (assessment_id, user_id, navigation_json, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (assessment_id, user_id) DO UPDATE SET
         navigation_json = excluded.navigation_json,
         updated_at = excluded.updated_at`,
      [assessmentId, userId, JSON.stringify(navigation), now]
    );

    return res.json({
      data: { assessmentId, userId, updatedAt: now },
      meta: assessmentMutationMeta(),
    });
  })
);

router.get(
  '/:assessmentId/assignments',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const assessmentId = firstParam(req.params.assessmentId);
    if (!assessmentId) {
      return res
        .status(400)
        .json({ error: 'Assessment id is required', code: 'ASSESSMENT_ID_REQUIRED' });
    }

    const assessment = await ensureAssessmentInOrg(assessmentId, organizationId);
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found', code: 'ASSESSMENT_NOT_FOUND' });
    }

    const assignments = (await queryHelpers.queryAll(
      `SELECT id, assessment_id, area_id, assigned_user_id, assigned_by, assigned_at, due_at, status
       FROM assessment_area_assignments
       WHERE assessment_id = ?
       ORDER BY area_id ASC`,
      [assessmentId]
    )) as Array<Record<string, unknown>>;

    return res.json({
      data: { assessmentId, assignments },
      meta: assessmentReadMeta(),
    });
  })
);

router.put(
  '/:assessmentId/assignments',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const assessmentId = firstParam(req.params.assessmentId);
    if (!assessmentId) {
      return res
        .status(400)
        .json({ error: 'Assessment id is required', code: 'ASSESSMENT_ID_REQUIRED' });
    }

    const assessment = await ensureAssessmentInOrg(assessmentId, organizationId);
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found', code: 'ASSESSMENT_NOT_FOUND' });
    }

    const areaId = String(req.body?.areaId || '').trim();
    const assignedUserId = String(req.body?.assignedUserId || '').trim();
    if (!areaId || !assignedUserId) {
      return res.status(400).json({
        error: 'areaId and assignedUserId are required',
        code: 'ASSESSMENT_ASSIGNMENT_INVALID',
      });
    }

    const now = new Date().toISOString();
    const id = uuidv4();
    const dueAt = req.body?.dueAt || null;
    const status = String(req.body?.status || 'ACTIVE');

    await queryHelpers.queryRun(
      `INSERT INTO assessment_area_assignments (
         id, assessment_id, area_id, assigned_user_id, assigned_by, assigned_at, due_at, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (assessment_id, area_id) DO UPDATE SET
         assigned_user_id = excluded.assigned_user_id,
         assigned_by = excluded.assigned_by,
         assigned_at = excluded.assigned_at,
         due_at = excluded.due_at,
         status = excluded.status`,
      [id, assessmentId, areaId, assignedUserId, userId, now, dueAt, status]
    );

    return res.json({
      data: {
        assessmentId,
        areaId,
        assignedUserId,
        dueAt,
        status,
        updatedAt: now,
      },
      meta: assessmentMutationMeta(),
    });
  })
);

router.delete(
  '/:assessmentId/assignments/:assignmentId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const assessmentId = firstParam(req.params.assessmentId);
    const assignmentId = firstParam(req.params.assignmentId);
    if (!assessmentId || !assignmentId) {
      return res.status(400).json({
        error: 'Assessment id and assignment id are required',
        code: 'ASSESSMENT_ASSIGNMENT_ID_REQUIRED',
      });
    }

    const assessment = await ensureAssessmentInOrg(assessmentId, organizationId);
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found', code: 'ASSESSMENT_NOT_FOUND' });
    }

    await queryHelpers.queryRun(
      `DELETE FROM assessment_area_assignments WHERE id = ? AND assessment_id = ?`,
      [assignmentId, assessmentId]
    );

    return res.json({
      data: { assessmentId, assignmentId, deleted: true },
      meta: assessmentMutationMeta(),
    });
  })
);

export default router;
