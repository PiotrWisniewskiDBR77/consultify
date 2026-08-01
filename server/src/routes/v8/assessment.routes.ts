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
import AssessmentDefinitionService from '../../services/assessment/AssessmentDefinitionService.js';
import { computeDrdCompletion } from '../../services/assessment/drdCompletion.js';
import type { DrdAreasMap } from '../../services/assessment/drdCompletion.js';
import AssessmentWorkbenchService, {
  assertPromotionPayloadShape,
  buildBoundedPromotionPayload,
  buildWhatNextGuidance,
} from '../../services/assessment/AssessmentWorkbenchService.js';
import AssessmentPermissionService from '../../services/assessmentPermissionService.js';
import { assessmentAuditLogger } from '../../utils/AssessmentAuditLogger.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { decodeHtmlEntities } from '../../utils/htmlEntities.js';
import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';

const router = Router();

export const V8_ASSESSMENT_READ_CONTRACT = 'assessment_runtime_read_v1';
export const V8_ASSESSMENT_MUTATION_CONTRACT = 'assessment_runtime_mutation_v1';
export const V8_ASSESSMENT_WORKBENCH_CONTRACT = 'assessment_workbench_p28_v1';

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

function workbenchReadMeta() {
  return {
    version: 'v8' as const,
    contract: V8_ASSESSMENT_WORKBENCH_CONTRACT,
    readScope: 'p28_workbench' as const,
  };
}

function workbenchMutationMeta() {
  return {
    version: 'v8' as const,
    contract: V8_ASSESSMENT_WORKBENCH_CONTRACT,
    writeScope: 'p28_workbench' as const,
  };
}

const VALID_ASSESSMENT_TYPES = new Set(['DRD', 'SIRI', 'ADMA', 'CMMI', 'LEAN']);
const SUPPORTED_P28_HANDOFFS = [
  {
    targetKind: 'outputs_artifact',
    targetRefOwner: 'outputs_library',
    bounded: true,
    purpose: 'materialize approved assessment payload into outputs/report artifacts',
  },
  {
    targetKind: 'interview_insight',
    targetRefOwner: 'insights',
    bounded: true,
    purpose: 'promote approved findings into governed insight records',
  },
] as const;

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
    `SELECT id, created_by, assessment_type FROM assessments WHERE id = ? AND organization_id = ?`,
    [assessmentId, organizationId]
  )) as Record<string, unknown> | null;
}

function buildWorkbenchPermissionDenied(role: string, missingPermission: string) {
  return {
    error: 'Workbench action denied',
    code: 'P28_PERMISSION_DENIED',
    role,
    missingPermission,
    whatNext: [
      'Request access from an assessment admin or owner.',
      'Use read-only workbench view until permission is granted.',
    ],
  };
}

async function ensureWorkbenchPermission(params: {
  assessmentId: string;
  organizationId: string;
  userId: string;
  userRole?: string;
  permission: 'canView' | 'canEdit' | 'canApprove';
}): Promise<
  | { ok: true; role: string }
  | {
      ok: false;
      status: number;
      body: ReturnType<typeof buildWorkbenchPermissionDenied>;
    }
> {
  if (params.userRole && isGlobalAdminRole(params.userRole)) {
    return { ok: true, role: 'admin' };
  }

  const userRoleInfo = await AssessmentPermissionService.getUserRole(
    params.assessmentId,
    params.userId,
    params.organizationId
  );
  if (userRoleInfo.permissions[params.permission]) {
    return { ok: true, role: userRoleInfo.role };
  }

  return {
    ok: false,
    status: 403,
    body: buildWorkbenchPermissionDenied(userRoleInfo.role, params.permission),
  };
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
      assessmentDefinitionId: row.assessment_definition_id || null,
      assessmentDefinitionVersion: row.assessment_definition_version || null,
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
  '/definitions/:methodologyId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const methodologyId = String(firstParam(req.params.methodologyId) || '')
      .trim()
      .toUpperCase();
    if (!methodologyId) {
      return res
        .status(400)
        .json({ error: 'Methodology id is required', code: 'P28_DEFINITION_METHOD_REQUIRED' });
    }

    const versions = await AssessmentDefinitionService.listDefinitionVersions(methodologyId);
    return res.json({
      data: { methodologyId, versions },
      meta: workbenchReadMeta(),
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

    const answers = parseJsonSafely(assessment.answers_json as string | null | undefined, {});

    // ASM-001A: DRD completion is server-derived from answers.drd.areas,
    // never trusted from whatever was last written to the row by a client.
    // Non-DRD frameworks (SIRI/ADMA/CMMI/Lean) are untouched — they keep
    // reading the persisted completion_percent as-is.
    const isDrdAssessment = String(assessment.assessment_type || '').toUpperCase() === 'DRD';
    const drdAreas = isDrdAssessment
      ? (answers as { drd?: { areas?: DrdAreasMap } })?.drd?.areas
      : undefined;
    const derivedCompletionPercent = drdAreas ? computeDrdCompletion(drdAreas) : undefined;

    const normalized = {
      ...assessment,
      status: normalizeStatus(String(assessment.status || 'DRAFT')),
      backendStatus: assessment.status,
      answers,
      contextSnapshot: parseJsonSafely(
        assessment.context_snapshot as string | null | undefined,
        {}
      ),
      scoreSummary: parseJsonSafely(assessment.score_summary as string | null | undefined, {}),
      navigation: parseJsonSafely(assessment.navigation_json as string | null | undefined, null),
      assessmentDefinitionId: assessment.assessment_definition_id || null,
      assessmentDefinitionVersion: assessment.assessment_definition_version || null,
      ...(derivedCompletionPercent !== undefined
        ? { completion_percent: derivedCompletionPercent, completionPercent: derivedCompletionPercent }
        : {}),
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
    // T5 (Z139 follow-up): decode HTML entities the global input-sanitization
    // middleware escaped, before storing — mirrors AssessmentController.createAssessment.
    const name = decodeHtmlEntities(String(req.body?.name || '').trim());
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

    // ASM-001A: DRD assessments created from the Library tab bind to a
    // published assessment_definitions row. Backwards-compatible — callers
    // that don't send definitionId/definitionVersion (every caller today)
    // keep the exact pre-existing behavior of a null-bound assessment.
    let boundDefinitionId: string | null = null;
    let boundDefinitionVersion: string | null = null;

    const requestedDefinitionId =
      typeof req.body?.definitionId === 'string' ? req.body.definitionId.trim() : '';
    const requestedDefinitionVersion =
      typeof req.body?.definitionVersion === 'string' ? req.body.definitionVersion.trim() : '';

    if (assessmentType === 'DRD' && (requestedDefinitionId || requestedDefinitionVersion)) {
      if (!requestedDefinitionId) {
        return res.status(400).json({
          error: 'definitionId is required when definitionVersion is supplied',
          code: 'DEFINITION_NOT_FOUND',
        });
      }

      const definition = await AssessmentDefinitionService.getDefinitionById(
        requestedDefinitionId
      );
      if (!definition) {
        return res.status(400).json({
          error: 'Assessment definition not found',
          code: 'DEFINITION_NOT_FOUND',
        });
      }
      if (requestedDefinitionVersion && definition.version !== requestedDefinitionVersion) {
        return res.status(400).json({
          error: 'Assessment definition version does not match the referenced definition',
          code: 'DEFINITION_NOT_FOUND',
        });
      }
      if (definition.status !== 'published') {
        return res.status(422).json({
          error: 'Assessment definition is not published',
          code: 'DEFINITION_NOT_PUBLISHED',
        });
      }

      boundDefinitionId = definition.id;
      boundDefinitionVersion = definition.version;
    }

    await ensureAssessmentSchema();

    const id = uuidv4();
    const now = new Date().toISOString();

    await queryHelpers.queryRun(
      `INSERT INTO assessments (
        id, organization_id, project_id, assessment_type, name, status,
        completion_percent, confidence_avg, answers_json, context_snapshot,
        assessment_definition_id, assessment_definition_version,
        created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        boundDefinitionId,
        boundDefinitionVersion,
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

    assessmentAuditLogger
      .logCreation(req, id, assessmentType)
      .catch((err: unknown) => logger.warn('[Assessment] non-blocking operation failed', err));

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
          assessmentDefinitionId: boundDefinitionId,
          assessmentDefinitionVersion: boundDefinitionVersion,
          createdAt: now,
          updatedAt: now,
        },
      },
      meta: assessmentMutationMeta(),
    });
  })
);

router.post(
  '/definitions/:methodologyId/draft',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId, userRole } = getV8Context(req);
    if (!isGlobalAdminRole(userRole)) {
      return res.status(403).json(buildWorkbenchPermissionDenied('viewer', 'canManage'));
    }

    const methodologyId = String(firstParam(req.params.methodologyId) || '')
      .trim()
      .toUpperCase();
    const version = String(req.body?.version || '').trim();
    if (!methodologyId || !version) {
      return res.status(400).json({
        error: 'Methodology id and version are required',
        code: 'P28_DEFINITION_DRAFT_INVALID',
      });
    }

    const definition = await AssessmentDefinitionService.createDraftDefinitionVersion({
      methodologyId,
      version,
      title: req.body?.title,
      definition: req.body?.definition,
      createdBy: userId,
    });

    return res.status(201).json({
      data: { definition },
      meta: workbenchMutationMeta(),
    });
  })
);

router.post(
  '/definitions/:definitionId/publish',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId, userRole } = getV8Context(req);
    if (!isGlobalAdminRole(userRole)) {
      return res.status(403).json(buildWorkbenchPermissionDenied('viewer', 'canManage'));
    }

    const definitionId = String(firstParam(req.params.definitionId) || '').trim();
    if (!definitionId) {
      return res
        .status(400)
        .json({ error: 'Definition id is required', code: 'P28_DEFINITION_ID_REQUIRED' });
    }

    const definition = await AssessmentDefinitionService.publishDefinitionVersion({
      definitionId,
      publishedBy: userId,
    });

    return res.json({
      data: { definition },
      meta: workbenchMutationMeta(),
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
      p28_workbench_v1?: string | null;
      completion_percent?: number | null;
      confidence_avg?: number | null;
      current_section_id?: string | null;
      navigation_json?: string | null;
      assessment_type?: string | null;
    }>(
      `SELECT answers_json, context_snapshot, score_summary, p28_workbench_v1, completion_percent, confidence_avg, current_section_id, navigation_json, assessment_type
       FROM assessments
       WHERE id = ? AND organization_id = ?`,
      [assessmentId, organizationId]
    )) as {
      answers_json?: string | null;
      context_snapshot?: string | null;
      score_summary?: string | null;
      p28_workbench_v1?: string | null;
      completion_percent?: number | null;
      confidence_avg?: number | null;
      current_section_id?: string | null;
      navigation_json?: string | null;
      assessment_type?: string | null;
    } | null;

    if (!existing) {
      return res.status(404).json({ error: 'Assessment not found', code: 'ASSESSMENT_NOT_FOUND' });
    }

    if (req.body?.scoreSummary !== undefined && existing.p28_workbench_v1) {
      return res.status(409).json({
        error:
          'P28 assessments require explicit score proposals and review before scores can change',
        code: 'P28_NO_SILENT_SCORING',
        whatNext: [
          'Use the workbench score proposal flow instead of updating scoreSummary directly.',
        ],
      });
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

    // ASM-001A: DRD assessments derive completion_percent server-side from
    // answers.drd.areas — whatever the client sent in completionPercent is
    // ignored for DRD once the answers carry a drd.areas map. Non-DRD
    // frameworks (SIRI/ADMA/CMMI/Lean) keep the exact pre-existing
    // "trust the client" behavior — zero change in scope for those.
    const isDrdAssessment = String(existing.assessment_type || '').toUpperCase() === 'DRD';
    const drdAreasForCompletion = isDrdAssessment
      ? (nextAnswers as { drd?: { areas?: DrdAreasMap } })?.drd?.areas
      : undefined;
    const nextCompletionPercent = drdAreasForCompletion
      ? computeDrdCompletion(drdAreasForCompletion)
      : req.body?.completionPercent !== undefined
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
    // T5 (Z139 follow-up): decode HTML entities before storing — mirrors
    // AssessmentController.updateAssessment.
    const nextName =
      typeof req.body?.name === 'string'
        ? decodeHtmlEntities(req.body.name)
        : (req.body?.name ?? null);

    await queryHelpers.queryRun(
      `UPDATE assessments
       SET name = COALESCE(?, name),
           answers_json = ?, context_snapshot = ?, completion_percent = ?, confidence_avg = ?,
           score_summary = ?, current_section_id = ?, navigation_json = ?, updated_by = ?, updated_at = ?
       WHERE id = ? AND organization_id = ?`,
      [
        nextName,
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
      .catch((err: unknown) => logger.warn('[Assessment] non-blocking operation failed', err));

    return res.json({
      data: {
        id: assessmentId,
        updatedAt: now,
        // ASM-001A: surfaced so callers don't need a round-trip GET to see the
        // server-derived value for DRD; harmless additive field for non-DRD.
        completionPercent: nextCompletionPercent,
      },
      meta: assessmentMutationMeta(),
    });
  })
);

// --- P28 Assessment workbench (no silent scoring; proposals + review) ---
router.get(
  '/:assessmentId/workbench',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId, userRole } = getV8Context(req);
    const assessmentId = firstParam(req.params.assessmentId);
    if (!assessmentId) {
      return res
        .status(400)
        .json({ error: 'Assessment id is required', code: 'ASSESSMENT_ID_REQUIRED' });
    }
    await ensureAssessmentSchema();
    const row = (await queryHelpers.queryOne<{
      assessment_type?: string | null;
      created_by?: string | null;
    }>(`SELECT assessment_type, created_by FROM assessments WHERE id = ? AND organization_id = ?`, [
      assessmentId,
      organizationId,
    ])) as { assessment_type?: string | null; created_by?: string | null } | null;
    if (!row) {
      return res.status(404).json({ error: 'Assessment not found', code: 'ASSESSMENT_NOT_FOUND' });
    }
    const permission = await ensureWorkbenchPermission({
      assessmentId,
      organizationId,
      userId,
      userRole,
      permission: 'canView',
    });
    if (!permission.ok) {
      const denied = permission as { ok: false; status: number; body: Record<string, unknown> };
      return res.status(denied.status).json(denied.body);
    }
    const state = await AssessmentWorkbenchService.load(
      assessmentId,
      organizationId,
      String(row.assessment_type || 'DRD'),
      String(row.created_by || userId)
    );
    const whatNext = buildWhatNextGuidance(state);
    return res.json({
      data: { workbench: state, whatNext },
      meta: workbenchReadMeta(),
    });
  })
);

router.get(
  '/:assessmentId/workbench/definition',
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
    const permission = await ensureWorkbenchPermission({
      assessmentId,
      organizationId,
      userId,
      userRole,
      permission: 'canView',
    });
    if (!permission.ok) {
      const denied = permission as { ok: false; status: number; body: Record<string, unknown> };
      return res.status(denied.status).json(denied.body);
    }
    const state = await AssessmentWorkbenchService.load(
      assessmentId,
      organizationId,
      String(assessment.assessment_type || 'DRD'),
      String(assessment.created_by || userId)
    );
    const definition = await AssessmentDefinitionService.getDefinitionById(
      state.assessmentDefinitionRef.definitionId
    );
    return res.json({
      data: { definitionRef: state.assessmentDefinitionRef, definition },
      meta: workbenchReadMeta(),
    });
  })
);

router.post(
  '/:assessmentId/workbench/methodology-preset',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId, userRole } = getV8Context(req);
    const assessmentId = firstParam(req.params.assessmentId);
    const preset = String(req.body?.preset || '').trim();
    if (!assessmentId || !preset) {
      return res
        .status(400)
        .json({ error: 'preset required (e.g. DRD)', code: 'P28_PRESET_REQUIRED' });
    }
    await ensureAssessmentSchema();
    const permission = await ensureWorkbenchPermission({
      assessmentId,
      organizationId,
      userId,
      userRole,
      permission: 'canEdit',
    });
    if (!permission.ok) {
      const denied = permission as { ok: false; status: number; body: Record<string, unknown> };
      return res.status(denied.status).json(denied.body);
    }
    try {
      const state = await AssessmentWorkbenchService.applyMethodologyPreset(
        assessmentId,
        organizationId,
        userId,
        preset
      );
      return res.json({
        data: { workbench: state, whatNext: buildWhatNextGuidance(state) },
        meta: workbenchMutationMeta(),
      });
    } catch (e: any) {
      if (e?.code === 'ASSESSMENT_NOT_FOUND') {
        return res.status(404).json({ error: 'Assessment not found', code: e.code });
      }
      return res.status(400).json({
        error: e?.message || 'Preset error',
        code: e?.code,
        knownPresets: e?.knownPresets,
      });
    }
  })
);

router.post(
  '/:assessmentId/workbench/transition',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId, userRole } = getV8Context(req);
    const assessmentId = firstParam(req.params.assessmentId);
    const to = String(req.body?.toState || '');
    const valid = new Set(['running', 'awaiting_evidence', 'completed', 'failed']);
    if (!assessmentId || !valid.has(to)) {
      return res.status(400).json({ error: 'Invalid transition', code: 'P28_TRANSITION_INVALID' });
    }
    await ensureAssessmentSchema();
    const permission = await ensureWorkbenchPermission({
      assessmentId,
      organizationId,
      userId,
      userRole,
      permission: to === 'completed' ? 'canApprove' : 'canEdit',
    });
    if (!permission.ok) {
      const denied = permission as { ok: false; status: number; body: Record<string, unknown> };
      return res.status(denied.status).json(denied.body);
    }
    try {
      const state = await AssessmentWorkbenchService.transition(
        assessmentId,
        organizationId,
        userId,
        to as any,
        { reason: req.body?.reason }
      );
      return res.json({ data: { workbench: state }, meta: workbenchMutationMeta() });
    } catch (e: any) {
      const code = e?.code || 'P28_ERROR';
      if (code === 'ASSESSMENT_NOT_FOUND') {
        return res.status(404).json({ error: 'Assessment not found', code });
      }
      return res.status(400).json({ error: e?.message || 'Workbench error', code });
    }
  })
);

router.post(
  '/:assessmentId/workbench/evidence',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId, userRole } = getV8Context(req);
    const assessmentId = firstParam(req.params.assessmentId);
    const pointers = Array.isArray(req.body?.pointers) ? req.body.pointers : [];
    if (!assessmentId || !pointers.length) {
      return res.status(400).json({ error: 'pointers required', code: 'P28_EVIDENCE_INVALID' });
    }
    await ensureAssessmentSchema();
    const permission = await ensureWorkbenchPermission({
      assessmentId,
      organizationId,
      userId,
      userRole,
      permission: 'canEdit',
    });
    if (!permission.ok) {
      const denied = permission as { ok: false; status: number; body: Record<string, unknown> };
      return res.status(denied.status).json(denied.body);
    }
    try {
      const state = await AssessmentWorkbenchService.addEvidence(
        assessmentId,
        organizationId,
        userId,
        pointers
      );
      return res.json({ data: { workbench: state }, meta: workbenchMutationMeta() });
    } catch (e: any) {
      return res.status(400).json({ error: e?.message || 'Evidence error', code: e?.code });
    }
  })
);

router.post(
  '/:assessmentId/workbench/required-evidence',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId, userRole } = getV8Context(req);
    const assessmentId = firstParam(req.params.assessmentId);
    const kinds = Array.isArray(req.body?.kinds) ? req.body.kinds.map(String) : [];
    if (!assessmentId) {
      return res
        .status(400)
        .json({ error: 'Assessment id required', code: 'ASSESSMENT_ID_REQUIRED' });
    }
    await ensureAssessmentSchema();
    const permission = await ensureWorkbenchPermission({
      assessmentId,
      organizationId,
      userId,
      userRole,
      permission: 'canEdit',
    });
    if (!permission.ok) {
      const denied = permission as { ok: false; status: number; body: Record<string, unknown> };
      return res.status(denied.status).json(denied.body);
    }
    try {
      const state = await AssessmentWorkbenchService.setRequiredEvidenceKinds(
        assessmentId,
        organizationId,
        userId,
        kinds
      );
      return res.json({ data: { workbench: state }, meta: workbenchMutationMeta() });
    } catch (e: any) {
      return res.status(400).json({ error: e?.message || 'Workbench error', code: e?.code });
    }
  })
);

router.post(
  '/:assessmentId/workbench/score-proposal',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId, userRole } = getV8Context(req);
    const assessmentId = firstParam(req.params.assessmentId);
    if (!assessmentId) {
      return res
        .status(400)
        .json({ error: 'Assessment id required', code: 'ASSESSMENT_ID_REQUIRED' });
    }
    await ensureAssessmentSchema();
    const permission = await ensureWorkbenchPermission({
      assessmentId,
      organizationId,
      userId,
      userRole,
      permission: 'canEdit',
    });
    if (!permission.ok) {
      const denied = permission as { ok: false; status: number; body: Record<string, unknown> };
      return res.status(denied.status).json(denied.body);
    }
    try {
      const state = await AssessmentWorkbenchService.proposeScore(
        assessmentId,
        organizationId,
        userId,
        {
          scoreValues: req.body?.scoreValues || {},
          scoringRationale: String(req.body?.scoringRationale || ''),
          evidencePointerIds: Array.isArray(req.body?.evidencePointerIds)
            ? req.body.evidencePointerIds.map(String)
            : [],
          assumptions: Array.isArray(req.body?.assumptions) ? req.body.assumptions.map(String) : [],
          confidence: Number(req.body?.confidence ?? 0.5),
        }
      );
      return res.json({ data: { workbench: state }, meta: workbenchMutationMeta() });
    } catch (e: any) {
      if (e?.code === 'P28_AWAITING_EVIDENCE') {
        return res.status(409).json({
          error: e?.message,
          code: e.code,
          missingEvidenceKinds: e.missingEvidenceKinds,
          whatNext: e.whatNext,
        });
      }
      return res.status(400).json({ error: e?.message || 'Score proposal error', code: e?.code });
    }
  })
);

router.post(
  '/:assessmentId/workbench/score-review',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId, userRole } = getV8Context(req);
    const assessmentId = firstParam(req.params.assessmentId);
    if (!assessmentId) {
      return res
        .status(400)
        .json({ error: 'Assessment id required', code: 'ASSESSMENT_ID_REQUIRED' });
    }
    await ensureAssessmentSchema();
    const permission = await ensureWorkbenchPermission({
      assessmentId,
      organizationId,
      userId,
      userRole,
      permission: 'canApprove',
    });
    if (!permission.ok) {
      const denied = permission as { ok: false; status: number; body: Record<string, unknown> };
      return res.status(denied.status).json(denied.body);
    }
    const action = String(req.body?.action || '') as 'accept' | 'reject' | 'override';
    if (!['accept', 'reject', 'override'].includes(action)) {
      return res
        .status(400)
        .json({ error: 'action must be accept|reject|override', code: 'P28_REVIEW_INVALID' });
    }
    try {
      const state = await AssessmentWorkbenchService.reviewScore(
        assessmentId,
        organizationId,
        userId,
        {
          action,
          reason: req.body?.reason,
          overrideScoreValues: req.body?.overrideScoreValues,
        }
      );
      return res.json({ data: { workbench: state }, meta: workbenchMutationMeta() });
    } catch (e: any) {
      return res.status(400).json({ error: e?.message || 'Score review error', code: e?.code });
    }
  })
);

router.post(
  '/:assessmentId/workbench/interpretation-proposal',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId, userRole } = getV8Context(req);
    const assessmentId = firstParam(req.params.assessmentId);
    if (!assessmentId) {
      return res
        .status(400)
        .json({ error: 'Assessment id required', code: 'ASSESSMENT_ID_REQUIRED' });
    }
    await ensureAssessmentSchema();
    const permission = await ensureWorkbenchPermission({
      assessmentId,
      organizationId,
      userId,
      userRole,
      permission: 'canEdit',
    });
    if (!permission.ok) {
      const denied = permission as { ok: false; status: number; body: Record<string, unknown> };
      return res.status(denied.status).json(denied.body);
    }
    try {
      const state = await AssessmentWorkbenchService.proposeInterpretation(
        assessmentId,
        organizationId,
        userId,
        {
          summary: String(req.body?.summary || ''),
          keyFindings: Array.isArray(req.body?.keyFindings) ? req.body.keyFindings.map(String) : [],
          limits: String(req.body?.limits || ''),
          nextActions: Array.isArray(req.body?.nextActions) ? req.body.nextActions.map(String) : [],
        }
      );
      return res.json({ data: { workbench: state }, meta: workbenchMutationMeta() });
    } catch (e: any) {
      return res.status(400).json({ error: e?.message || 'Interpretation error', code: e?.code });
    }
  })
);

router.post(
  '/:assessmentId/workbench/interpretation-review',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId, userRole } = getV8Context(req);
    const assessmentId = firstParam(req.params.assessmentId);
    if (!assessmentId) {
      return res
        .status(400)
        .json({ error: 'Assessment id required', code: 'ASSESSMENT_ID_REQUIRED' });
    }
    await ensureAssessmentSchema();
    const permission = await ensureWorkbenchPermission({
      assessmentId,
      organizationId,
      userId,
      userRole,
      permission: 'canApprove',
    });
    if (!permission.ok) {
      const denied = permission as { ok: false; status: number; body: Record<string, unknown> };
      return res.status(denied.status).json(denied.body);
    }
    const intAction = String(req.body?.action || '') as 'accept' | 'reject' | 'override';
    if (!['accept', 'reject', 'override'].includes(intAction)) {
      return res
        .status(400)
        .json({ error: 'action must be accept|reject|override', code: 'P28_REVIEW_INVALID' });
    }
    try {
      const state = await AssessmentWorkbenchService.reviewInterpretation(
        assessmentId,
        organizationId,
        userId,
        {
          action: intAction,
          reason: req.body?.reason,
          overrideSummary: req.body?.overrideSummary,
        }
      );
      return res.json({ data: { workbench: state }, meta: workbenchMutationMeta() });
    } catch (e: any) {
      return res
        .status(400)
        .json({ error: e?.message || 'Interpretation review error', code: e?.code });
    }
  })
);

router.get(
  '/:assessmentId/workbench/promotion-payload',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId, userRole } = getV8Context(req);
    const assessmentId = firstParam(req.params.assessmentId);
    if (!assessmentId) {
      return res
        .status(400)
        .json({ error: 'Assessment id required', code: 'ASSESSMENT_ID_REQUIRED' });
    }
    await ensureAssessmentSchema();
    const row = (await queryHelpers.queryOne<{
      assessment_type?: string | null;
      created_by?: string | null;
    }>(`SELECT assessment_type, created_by FROM assessments WHERE id = ? AND organization_id = ?`, [
      assessmentId,
      organizationId,
    ])) as { assessment_type?: string | null; created_by?: string | null } | null;
    if (!row) {
      return res.status(404).json({ error: 'Assessment not found', code: 'ASSESSMENT_NOT_FOUND' });
    }
    const permission = await ensureWorkbenchPermission({
      assessmentId,
      organizationId,
      userId,
      userRole,
      permission: 'canView',
    });
    if (!permission.ok) {
      const denied = permission as { ok: false; status: number; body: Record<string, unknown> };
      return res.status(denied.status).json(denied.body);
    }
    const state = await AssessmentWorkbenchService.load(
      assessmentId,
      organizationId,
      String(row.assessment_type || 'DRD'),
      String(row.created_by || userId)
    );
    const validation = assertPromotionPayloadShape(state);
    const payload = buildBoundedPromotionPayload(state);
    return res.json({
      data: {
        valid: validation.ok,
        validationErrors: validation.errors,
        payload,
        supportedHandoffs: SUPPORTED_P28_HANDOFFS,
        downstreamContract: {
          initiatives: {
            origin: 'assessment_initiative_generation_runs.inputs_json.provenance',
            bounded: true,
            requiresApprovedAssessment: true,
          },
          execution: {
            boundedContractReady: true,
            currentOwner: 'initiative downstream',
          },
          kpi: {
            boundedContractReady: true,
            currentOwner: 'report/action-plan downstream',
          },
        },
      },
      meta: workbenchReadMeta(),
    });
  })
);

router.post(
  '/:assessmentId/workbench/promotion',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId, userRole } = getV8Context(req);
    const assessmentId = firstParam(req.params.assessmentId);
    if (!assessmentId) {
      return res
        .status(400)
        .json({ error: 'Assessment id required', code: 'ASSESSMENT_ID_REQUIRED' });
    }
    await ensureAssessmentSchema();
    const permission = await ensureWorkbenchPermission({
      assessmentId,
      organizationId,
      userId,
      userRole,
      permission: 'canApprove',
    });
    if (!permission.ok) {
      const denied = permission as { ok: false; status: number; body: Record<string, unknown> };
      return res.status(denied.status).json(denied.body);
    }
    try {
      const state = await AssessmentWorkbenchService.recordPromotion(
        assessmentId,
        organizationId,
        userId,
        {
          targetKind: req.body?.targetKind,
          targetRef: String(req.body?.targetRef || ''),
          payloadSummary: req.body?.payloadSummary,
        }
      );
      return res.json({ data: { workbench: state }, meta: workbenchMutationMeta() });
    } catch (e: any) {
      return res.status(400).json({
        error: e?.message || 'Promotion error',
        code: e?.code,
        validationErrors: e?.validationErrors,
        whatNext: e?.whatNext,
      });
    }
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
