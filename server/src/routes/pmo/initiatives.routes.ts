/**
 * Initiatives Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * All initiative-related API endpoints with Zod validation
 */

import { type Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { InitiativeStatus } from '../../constants/initiativeStatuses.js';
import InitiativeControllerRaw from '../../controllers/InitiativeController.js';
const InitiativeController = InitiativeControllerRaw as any;
import { StaffingPlanController } from '../../controllers/StaffingPlanController.js';
import { validateOrgMembership, verifyToken } from '../../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../../middleware/demoGuard.middleware.js';
import { requireInitiativeCapability } from '../../middleware/effectiveCapability.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { requireOrgAccess, requireOrgRole } from '../../middleware/rbac.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import auditEventsService from '../../services/AuditEventsService.js';
import blueprintService from '../../services/blueprintService.js';
import {
  createInitiative as funnelCreateInitiative,
  duplicateInitiative,
} from '../../services/initiative/createInitiativeService.js';
import {
  evaluateInitiativeGateAccess,
  requireInitiativeWriteAccess,
} from '../../services/initiative/initiativeGovernanceGuard.js';
import { upsertInitiativeKpiAssignment } from '../../services/initiative/initiativeKpiAssignmentService.js';
import {
  InitiativeProfileError,
  updateInitiativeProfile,
} from '../../services/initiative/initiativeProfileService.js';
import {
  INITIATIVE_LIFECYCLE_GATE_DOMAINS,
  InitiativeLifecycleGateDecisionError,
  recordInitiativeLifecycleGateDecision,
} from '../../services/initiative/initiativeLifecycleGateDecisionService.js';
import {
  createWizardSession,
  evaluateShortlistGateForSession,
  generateCandidates as generateWizardCandidates,
  getWizardSession,
  listCandidates as listWizardCandidates,
  listWizardAuditEvents,
  recordShortlistDraftsCreated,
  recordShortlistGateBlocked,
  triageCandidate as triageWizardCandidate,
} from '../../services/initiative/initiativeWizardService.js';
import initiativeGenerationService from '../../services/initiativeGenerationService.js';
import { resolveInitiativeProjectId } from '../../services/initiativeProjectPolicyService.js';
import initiativeSectionTypeService from '../../services/initiativeSectionTypeService.js';
import { checkSimilarInitiatives } from '../../services/initiativeSimilarityService.js';
import initiativeTemplateService from '../../services/initiativeTemplateService.js';
import { getInitiativesRaciResultsSummary } from '../../services/pmo/initiativeRaciResultsSummaryService.js';
import { getProgramRollup } from '../../services/pmo/programRollupService.js';
import {
  getCapacityTimeline,
  getInitiativeCapacity,
} from '../../services/workloadCapacityService.js';
import { decodeHtmlEntities } from '../../utils/htmlEntities.js';
import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import {
  CreateInitiativeSchema,
  QuickUpdateInitiativeSchema,
  UpdateInitiativeSchema,
  UpdateInitiativeStatusSchema,
  UpdateInitiativeTemplateSchema,
} from '../../validators/initiative.validators.js';
import initiativesExecutionRuntimeRouter from './initiativesExecutionRuntime.routes.js';

const router = Router();

// INI-MVP-PROFILE-001: Initiative routes have completed their shadow period.
// Preserve per-route project resolution/allowWithoutProject options, but never
// allow an individual caller to silently return to log-only authorization.
const requireGovernedInitiativeCapability = (
  capability: string,
  options: Parameters<typeof requireInitiativeCapability>[1] = {}
) => requireInitiativeCapability(capability, { ...options, shadow: false });

function resolvePmoInitiativesCorrelationId(req: any): string | null {
  return req?.correlationId || req?.get?.('X-Correlation-ID') || null;
}

function buildPmoInitiativesFailClosedError(
  req: any,
  statusCode: number,
  code: string,
  message: string
) {
  return {
    status: statusCode >= 500 ? 'error' : 'fail',
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
    },
    correlationId: resolvePmoInitiativesCorrelationId(req),
  };
}

/**
 * INFO-DISCLOSURE GUARD (M13): legacy handlers in this file historically echoed
 * raw `err.message` into 500 bodies (`{ error, message: err.message }`), leaking
 * DB/driver/schema internals to clients. This helper preserves the EXACT legacy
 * response shape the frontend expects (`{ error, message, code }`) but swaps the
 * leaky raw value for a stable generic message + code, and logs the real error
 * server-side instead of returning it.
 */
function failInitiative500(res: Response, errorLabel: string, code: string, err: unknown) {
  logger.error(`[M13 Initiatives] ${errorLabel} (${code})`, err);
  return res.status(500).json({
    error: errorLabel,
    message: 'An internal error occurred. Please try again later.',
    code,
  });
}

const notConfigured = (req: any, res: Response) =>
  res
    .status(503)
    .json(
      buildPmoInitiativesFailClosedError(
        req,
        503,
        'PMO_INITIATIVES_SERVICE_NOT_CONFIGURED',
        'PMO initiatives service is temporarily unavailable.'
      )
    );

// Apply rate limiting
router.use(apiAuthRateLimiter);

// Apply auth middleware to all routes
router.use(verifyToken);
router.use(validateOrgMembership);
router.use(requireOrgAccess());

// Apply demo context middleware (switches org to demo org if x-demo-mode header is set)
router.use(demoContextMiddleware);

// Canonical Initiatives + Execution vertical. Parent middleware supplies authenticated,
// tenant-scoped actor context; the child router additionally enforces project capability.
router.use('/runtime-v1', initiativesExecutionRuntimeRouter);

// ==========================================
// INITIATIVE CRUD
// ==========================================

const WizardSessionSchema = z.object({
  projectId: z.string().optional().nullable(),
  mode: z
    .enum([
      'create_first_portfolio',
      'generate_from_evidence',
      'prioritize_by_goal',
      'match_existing',
      'refresh_portfolio',
      'build_waves',
      'improve_portfolio',
    ])
    .optional(),
  businessPriorities: z.array(z.string()).optional(),
  targetCount: z.number().int().min(1).max(10).optional().nullable(),
  timeHorizon: z.string().max(50).optional().nullable(),
  riskAppetite: z.string().max(50).optional().nullable(),
  sourceBasket: z.array(z.unknown()).optional(),
  manualNotes: z.string().max(20000).optional().nullable(),
});

const WizardCandidateTriageSchema = z.object({
  triageStatus: z.enum([
    'new_candidate',
    'accepted_for_shortlist',
    'rejected',
    'needs_evidence',
    'needs_split',
    'needs_merge',
    'needs_rewrite',
    'already_covered',
    'ready_for_charter',
  ]),
  triageReason: z.string().max(2000).optional().nullable(),
  linkedInitiativeId: z.string().max(255).optional().nullable(),
});

// ==========================================
// INITIATIVE WIZARD (interactive consultant workbench)
// All wizard endpoints require at minimum 'user' org role.
// Reads (GET) are gated to prevent leaking session/audit data to viewers
// without an active workspace seat. Writes (POST/PATCH) are gated to enforce
// `proposal -> approval -> execution -> audit` per INITIATIVE_CANONICAL_STANDARD.
// ==========================================

router.post(
  '/wizard/sessions',
  requireOrgRole('user'),
  requireGovernedInitiativeCapability('initiative.wizard.use', {
    shadow: true,
    allowWithoutProject: true,
  }),
  requireInitiativeWriteAccess(),
  validateBody(WizardSessionSchema),
  async (req: any, res: any) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const session = await createWizardSession({
      organizationId: String(orgId),
      userId: req.user?.id || null,
      input: req.body,
    });
    return res.status(201).json({ session });
  }
);

router.get('/wizard/sessions/:sessionId', requireOrgRole('user'), async (req: any, res: any) => {
  const orgId = req.user?.organizationId;
  if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
  const session = await getWizardSession(String(orgId), String(req.params.sessionId));
  if (!session) return res.status(404).json({ error: 'Wizard session not found' });
  return res.json({ session });
});

router.post(
  '/wizard/sessions/:sessionId/candidates/generate',
  requireOrgRole('user'),
  requireGovernedInitiativeCapability('initiative.wizard.use', {
    shadow: true,
    allowWithoutProject: true,
  }),
  requireInitiativeWriteAccess(),
  async (req: any, res: any) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const session = await getWizardSession(String(orgId), String(req.params.sessionId));
    if (!session) return res.status(404).json({ error: 'Wizard session not found' });
    const candidates = await generateWizardCandidates({
      organizationId: String(orgId),
      sessionId: String(req.params.sessionId),
      userId: req.user?.id || null,
    });
    return res.status(201).json({ candidates });
  }
);

router.get(
  '/wizard/sessions/:sessionId/candidates',
  requireOrgRole('user'),
  async (req: any, res: any) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const session = await getWizardSession(String(orgId), String(req.params.sessionId));
    if (!session) return res.status(404).json({ error: 'Wizard session not found' });
    const candidates = await listWizardCandidates(String(orgId), String(req.params.sessionId));
    return res.json({ candidates });
  }
);

router.get(
  '/wizard/sessions/:sessionId/audit-events',
  requireOrgRole('user'),
  async (req: any, res: any) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const session = await getWizardSession(String(orgId), String(req.params.sessionId));
    if (!session) return res.status(404).json({ error: 'Wizard session not found' });
    const events = await listWizardAuditEvents(String(orgId), String(req.params.sessionId));
    return res.json({ events });
  }
);

router.patch(
  '/wizard/candidates/:candidateId/triage',
  requireOrgRole('user'),
  requireGovernedInitiativeCapability('initiative.wizard.use', {
    shadow: true,
    allowWithoutProject: true,
  }),
  requireInitiativeWriteAccess(),
  validateBody(WizardCandidateTriageSchema),
  async (req: any, res: any) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const candidate = await triageWizardCandidate({
      organizationId: String(orgId),
      candidateId: String(req.params.candidateId),
      userId: req.user?.id || null,
      triageStatus: req.body.triageStatus,
      triageReason: req.body.triageReason || null,
      linkedInitiativeId: req.body.linkedInitiativeId || null,
    });
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
    return res.json({ candidate });
  }
);

// Shortlist gate (P0 #7): non-mutating evaluation that frontend calls before
// `Utworz drafty`. Backend remains the source of truth so any UI bypass still
// produces an audit event when contradicted/missing-evidence candidates leak in.
router.get(
  '/wizard/sessions/:sessionId/shortlist-gate',
  requireOrgRole('user'),
  async (req: any, res: any) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const session = await getWizardSession(String(orgId), String(req.params.sessionId));
    if (!session) return res.status(404).json({ error: 'Wizard session not found' });
    const result = await evaluateShortlistGateForSession(
      String(orgId),
      String(req.params.sessionId)
    );
    return res.json({ gate: result });
  }
);

const WizardDraftsCreatedSchema = z.object({
  draftCount: z.number().int().min(0).max(50),
  candidateIds: z.array(z.string().min(1)).max(50),
  blockedReasons: z
    .array(
      z.object({
        candidateId: z.string().min(1),
        reason: z.string().max(120),
      })
    )
    .max(50)
    .optional(),
});

router.post(
  '/wizard/sessions/:sessionId/drafts-created',
  requireOrgRole('user'),
  requireGovernedInitiativeCapability('initiative.wizard.use', {
    shadow: true,
    allowWithoutProject: true,
  }),
  requireInitiativeWriteAccess(),
  validateBody(WizardDraftsCreatedSchema),
  async (req: any, res: any) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const session = await getWizardSession(String(orgId), String(req.params.sessionId));
    if (!session) return res.status(404).json({ error: 'Wizard session not found' });
    const result = await evaluateShortlistGateForSession(
      String(orgId),
      String(req.params.sessionId)
    );
    if (!result.ok) {
      await recordShortlistGateBlocked({
        organizationId: String(orgId),
        sessionId: String(req.params.sessionId),
        userId: req.user?.id || null,
        result,
      });
    }
    await recordShortlistDraftsCreated({
      organizationId: String(orgId),
      sessionId: String(req.params.sessionId),
      userId: req.user?.id || null,
      draftCount: Number(req.body.draftCount || 0),
      candidateIds: Array.isArray(req.body.candidateIds) ? req.body.candidateIds : [],
    });
    return res.json({ ok: true, gate: result });
  }
);

// ==========================================
// SIMILARITY / DUPLICATE CHECK (AI Wizard)
// ==========================================

const SimilarityCheckSchema = z.object({
  projectId: z.string().max(255).optional().nullable(),
  candidates: z
    .array(
      z.object({
        title: z.string().min(1).max(2000),
        description: z.string().max(20000).optional().nullable(),
      })
    )
    .min(1)
    .max(20),
});

/**
 * POST /api/initiatives/similarity-check
 * For each AI-proposed candidate, return whether an existing active initiative
 * in the org (and project, if given) already duplicates / closely resembles it.
 * Informational only — does not mutate state or block the wizard.
 */
router.post(
  '/similarity-check',
  requireOrgRole('user'),
  validateBody(SimilarityCheckSchema),
  async (req: any, res: any) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const result = await checkSimilarInitiatives({
        orgId: String(orgId),
        projectId: req.body?.projectId ? String(req.body.projectId) : null,
        candidates: req.body.candidates,
      });

      return res.json(result);
    } catch (err: any) {
      return res
        .status(500)
        .json(
          buildPmoInitiativesFailClosedError(
            req,
            500,
            'PMO_INITIATIVES_SIMILARITY_CHECK_FAILED',
            'Failed to run initiative similarity check.'
          )
        );
    }
  }
);

// ==========================================
// MERGE / EXTEND FROM INSIGHT (AI Wizard #29e)
// ==========================================

const MergeExtendFromInsightSchema = z
  .object({
    // `mode` is derived from the route (merge-from-insight / extend-from-insight);
    // accepted in the body too for callers that prefer a single endpoint shape.
    mode: z.enum(['merge', 'extend']).optional(),
    sourceInsightId: z.string().min(1).max(255).optional().nullable(),
    sourceInsightIds: z.array(z.string().min(1).max(255)).max(50).optional(),
    summary: z.string().min(1).max(20000),
    scopeText: z.string().max(20000).optional().nullable(),
  })
  .refine((data) => Boolean(data.sourceInsightId) || (data.sourceInsightIds?.length ?? 0) > 0, {
    message: 'sourceInsightId or sourceInsightIds is required',
    path: ['sourceInsightId'],
  });

function parseJsonArraySafe(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * POST /api/initiatives/:id/merge-from-insight  (mode 'merge')
 * POST /api/initiatives/:id/extend-from-insight (mode 'extend')
 *
 * Audit #29e: convert the wizard "Merge / Extend" choice into a REAL,
 * ADDITIVE + NON-DESTRUCTIVE operation against an existing initiative. We never
 * create a duplicate initiative and never blank the target's core fields.
 *
 *   merge  — attach the candidate's source insight(s) to the existing
 *            initiative as lineage links (evidence_refs_json) and append the
 *            candidate's problem/context as a recorded "Merged from insight"
 *            note on the description (hypothesis) / summary.
 *   extend — like merge, but the candidate is recorded as ADDITIONAL SCOPE:
 *            its scope/objective text is appended to scope_in (when present)
 *            and to the description as a "Extended scope from insight" note.
 *
 * Read-modify-write only (never overwrite). Org-scoped + 'user' role.
 * 404 if the initiative is missing or not in the caller's org.
 */
async function handleMergeOrExtendFromInsight(req: any, res: any, mode: 'merge' | 'extend') {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const initiativeId = String(req.params.id || '');
    if (!initiativeId) return res.status(400).json({ error: 'Initiative id is required' });

    // Org-scoped read of the existing initiative (defensive 404).
    const existing = (await queryHelpers.queryOne(
      `SELECT * FROM initiatives WHERE id = ? AND organization_id = ?`,
      [initiativeId, String(orgId)]
    )) as any;
    if (!existing) return res.status(404).json({ error: 'Initiative not found' });

    const summary = String(req.body?.summary || '').trim();
    const scopeText = req.body?.scopeText != null ? String(req.body.scopeText).trim() : '';
    const insightIds = Array.from(
      new Set(
        [
          ...(req.body?.sourceInsightId ? [String(req.body.sourceInsightId)] : []),
          ...(Array.isArray(req.body?.sourceInsightIds)
            ? req.body.sourceInsightIds.map((id: unknown) => String(id))
            : []),
        ].filter(Boolean)
      )
    );

    // Discover the actual columns so we only touch fields that exist (SQLite +
    // Postgres environments differ; mirrors the duplicate route's approach).
    let cols: Set<string> = new Set();
    try {
      const info = (await queryHelpers.queryAll(`PRAGMA table_info(initiatives)`)) as Array<{
        name?: string;
      }>;
      cols = new Set((info || []).map((r) => String(r.name || '')).filter(Boolean));
    } catch {
      cols = new Set();
    }
    if (cols.size === 0) {
      try {
        const colRows = (await queryHelpers.queryAll(
          `SELECT LOWER(column_name) as column_name FROM information_schema.columns WHERE table_name = 'initiatives'`
        )) as Array<{ column_name?: string }>;
        cols = new Set((colRows || []).map((r) => String(r.column_name || '')).filter(Boolean));
      } catch {
        cols = new Set();
      }
    }

    const now = new Date().toISOString();
    const noteHeader =
      mode === 'merge'
        ? `Merged from insight${insightIds.length > 1 ? 's' : ''} ${insightIds.join(', ') || '(n/a)'}`
        : `Extended scope from insight${insightIds.length > 1 ? 's' : ''} ${insightIds.join(', ') || '(n/a)'}`;
    const noteBody = [summary, mode === 'extend' && scopeText ? `Scope: ${scopeText}` : '']
      .filter(Boolean)
      .join('\n');
    const note = `[${now}] ${noteHeader}: ${noteBody}`;

    const setClauses: string[] = [];
    const setVals: any[] = [];

    // (1) Append the recorded note to the description/scope — read-modify-write,
    // never blank. Prefer `hypothesis` (the create flow's description home),
    // else `summary`, else `problem_statement`.
    const descCol = cols.has('hypothesis')
      ? 'hypothesis'
      : cols.has('summary')
        ? 'summary'
        : cols.has('problem_statement')
          ? 'problem_statement'
          : null;
    if (descCol) {
      const prevDesc = existing[descCol] != null ? String(existing[descCol]) : '';
      setClauses.push(`${descCol} = ?`);
      setVals.push([prevDesc, note].filter(Boolean).join('\n\n'));
    }

    // For EXTEND: also append the additional scope to scope_in (JSON array).
    if (mode === 'extend' && cols.has('scope_in')) {
      const prevScope = parseJsonArraySafe(existing.scope_in);
      const scopeAddition = scopeText || summary;
      if (scopeAddition) {
        const nextScope = Array.from(new Set([...prevScope, scopeAddition]));
        setClauses.push(`scope_in = ?`);
        setVals.push(JSON.stringify(nextScope));
      }
    }

    // (2) Lineage: append source-insight links to evidence_refs_json — the same
    // 1:N evidence container the create flow tags initiatives with.
    if (cols.has('evidence_refs_json') && insightIds.length > 0) {
      const prevRefs = parseJsonArraySafe(existing.evidence_refs_json).map((r) => String(r));
      const newRefs = insightIds.map((id) => `interview_insight:${id}`);
      const mergedRefs = Array.from(new Set([...prevRefs, ...newRefs]));
      setClauses.push(`evidence_refs_json = ?`);
      setVals.push(JSON.stringify(mergedRefs));
    }

    if (cols.has('updated_at')) {
      setClauses.push(`updated_at = ?`);
      setVals.push(now);
    }
    if (cols.has('updated_by')) {
      setClauses.push(`updated_by = ?`);
      setVals.push(String(req.user?.id || existing.updated_by || 'system'));
    }

    if (setClauses.length > 0) {
      setVals.push(initiativeId, String(orgId));
      await queryHelpers.queryRun(
        `UPDATE initiatives SET ${setClauses.join(', ')} WHERE id = ? AND organization_id = ?`,
        setVals
      );
    }

    // (3) Record an audit / decision note for traceability.
    try {
      await auditEventsService.log({
        actorId: req.user?.id,
        actorType: 'USER',
        action:
          mode === 'merge' ? 'initiative.merged_from_insight' : 'initiative.extended_from_insight',
        resourceType: 'initiative',
        resourceId: initiativeId,
        before: { id: initiativeId },
        after: {
          id: initiativeId,
          mode,
          sourceInsightIds: insightIds,
          note,
        },
        organizationId: String(orgId),
        ip: (req as any).ip,
        userAgent: (req as any).get?.('user-agent'),
      });
    } catch {
      // Audit is best-effort — never fail the mutation on a logging error.
    }

    const updated = (await queryHelpers.queryOne(
      `SELECT * FROM initiatives WHERE id = ? AND organization_id = ?`,
      [initiativeId, String(orgId)]
    )) as any;

    return res.json({
      ok: true,
      mode,
      sourceInsightIds: insightIds,
      initiative: {
        id: updated?.id ?? initiativeId,
        title: updated?.title ?? updated?.name ?? existing.title ?? existing.name ?? null,
        status: updated?.status ?? existing.status ?? null,
        summary: updated?.summary ?? null,
        evidenceRefs: parseJsonArraySafe(updated?.evidence_refs_json),
        scopeIn: parseJsonArraySafe(updated?.scope_in),
        updatedAt: updated?.updated_at ?? now,
      },
    });
  } catch (err: any) {
    return res
      .status(500)
      .json(
        buildPmoInitiativesFailClosedError(
          req,
          500,
          'PMO_INITIATIVES_MERGE_EXTEND_FAILED',
          'Failed to merge/extend initiative from insight.'
        )
      );
  }
}

router.post(
  '/:id/merge-from-insight',
  requireOrgRole('user'),
  requireGovernedInitiativeCapability('initiative.update', { shadow: true }),
  validateBody(MergeExtendFromInsightSchema),
  async (req: any, res: any) => handleMergeOrExtendFromInsight(req, res, 'merge')
);

router.post(
  '/:id/extend-from-insight',
  requireOrgRole('user'),
  requireGovernedInitiativeCapability('initiative.update', { shadow: true }),
  validateBody(MergeExtendFromInsightSchema),
  async (req: any, res: any) => handleMergeOrExtendFromInsight(req, res, 'extend')
);

/**
 * GET /api/initiatives/capacity?projectId=...
 * Audit #29c: lightweight capacity / overload signal for the AI Initiative
 * Wizard. Counts non-terminal ("active") initiatives in the org (optionally
 * scoped to a project) and returns a suggested number of NEW initiatives to
 * create plus an overload band. Read-only, org-scoped, never mutates state.
 *
 *   activeCount  — initiatives whose status is NOT CANCELLED/ARCHIVED/DONE
 *   suggestedCount — 0-2 active → 3-5; 3-5 → 2-3; 6+ → 1-2 (we surface the
 *                    upper bound so the count field defaults sensibly)
 *   overload     — 'green' (0-2) | 'amber' (3-5) | 'red' (6+)
 */
router.get('/capacity', requireOrgRole('user'), async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const projectId =
      typeof req.query?.projectId === 'string' && req.query.projectId.trim().length > 0
        ? String(req.query.projectId).trim()
        : null;

    const excluded = [
      InitiativeStatus.CANCELLED,
      InitiativeStatus.ARCHIVED,
      InitiativeStatus.DONE,
    ].map((status) => status.toUpperCase());

    const params: unknown[] = [String(orgId), ...excluded];
    let sql = `SELECT COUNT(*) AS active_count
                 FROM initiatives
                WHERE organization_id = ?
                  AND UPPER(COALESCE(status, '')) NOT IN (${excluded.map(() => '?').join(', ')})`;
    if (projectId) {
      sql += ' AND project_id = ?';
      params.push(projectId);
    }

    const row = await queryHelpers.queryOne<{ active_count?: number }>(sql, params);
    const activeCount = Number(row?.active_count ?? 0);

    let suggestedCount: number;
    let overload: 'green' | 'amber' | 'red';
    if (activeCount <= 2) {
      suggestedCount = 3;
      overload = 'green';
    } else if (activeCount <= 5) {
      suggestedCount = 3;
      overload = 'amber';
    } else {
      suggestedCount = 2;
      overload = 'red';
    }

    return res.json({ activeCount, suggestedCount, overload });
  } catch (err: any) {
    return res
      .status(500)
      .json(
        buildPmoInitiativesFailClosedError(
          req,
          500,
          'PMO_INITIATIVES_CAPACITY_FAILED',
          'Failed to compute initiative capacity.'
        )
      );
  }
});

/**
 * GET /api/initiatives/portfolio
 * Get initiatives with portfolio stats
 */
router.get('/portfolio', InitiativeController.getPortfolioData);

/**
 * GET /api/initiatives/portfolio/rollups
 * V4-INIT-02: Get portfolio rollups by program (hierarchy)
 */
router.get('/portfolio/rollups', InitiativeController.getPortfolioRollups);

/**
 * GET /api/initiatives/portfolio/dependencies
 * Get initiative dependencies for timeline
 */
router.get('/portfolio/dependencies', InitiativeController.getPortfolioDependencies);

/**
 * POST /api/initiatives/portfolio/dependencies
 * Create initiative dependency
 */
router.post(
  '/portfolio/dependencies',
  requireOrgRole('user'),
  requireGovernedInitiativeCapability('initiative.dependency.manage', {
    shadow: true,
    allowWithoutProject: true,
  }),
  InitiativeController.createPortfolioDependency
);

/**
 * DELETE /api/initiatives/portfolio/dependencies/:id
 * Remove initiative dependency
 */
router.delete(
  '/portfolio/dependencies/:id',
  requireOrgRole('user'),
  requireGovernedInitiativeCapability('initiative.dependency.manage', {
    shadow: true,
    allowWithoutProject: true,
  }),
  InitiativeController.deletePortfolioDependency
);

// ==========================================
// V4-INIT-02: PROGRAM HIERARCHY CRUD
// ==========================================

router.get('/programs', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res
        .status(401)
        .json(
          buildPmoInitiativesFailClosedError(
            req,
            401,
            'PMO_INITIATIVES_UNAUTHORIZED',
            'Authentication is required to access PMO initiatives.'
          )
        );
    }

    const rows = await queryHelpers.queryAll(
      `SELECT p.*,
              (SELECT COUNT(*) FROM initiatives i WHERE i.program_id = p.id AND i.organization_id = p.organization_id) AS initiative_count,
              (SELECT COUNT(*) FROM programs cp WHERE cp.parent_program_id = p.id) AS child_program_count
       FROM programs p
       WHERE p.organization_id = ?
       ORDER BY p.name ASC`,
      [String(orgId)]
    );

    const programs = rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      name: r.name,
      description: r.description,
      parentProgramId: r.parent_program_id || null,
      status: r.status,
      ownerUserId: r.owner_user_id || null,
      startDate: r.start_date || null,
      endDate: r.end_date || null,
      initiativeCount: Number(r.initiative_count) || 0,
      childProgramCount: Number(r.child_program_count) || 0,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return res.json({ programs });
  } catch {
    return res
      .status(500)
      .json(
        buildPmoInitiativesFailClosedError(
          req,
          500,
          'PMO_INITIATIVES_PROGRAMS_READ_FAILED',
          'Failed to fetch PMO programs.'
        )
      );
  }
});

router.post(
  '/programs',
  requireOrgRole('user'),
  requireGovernedInitiativeCapability('initiative.program.manage', {
    shadow: true,
    allowWithoutProject: true,
  }),
  async (req: any, res: any) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const {
        name: rawName,
        description: rawDescription,
        parentProgramId,
        status,
        ownerUserId,
        startDate,
        endDate,
      } = req.body;
      if (!rawName || typeof rawName !== 'string' || !rawName.trim()) {
        return res.status(400).json({ error: 'name is required' });
      }
      // T5 (Z139 follow-up): decode HTML entities the global input-sanitization
      // middleware escaped, before storing — mirrors the initiatives title fix above.
      const name = decodeHtmlEntities(rawName);
      const description =
        typeof rawDescription === 'string' ? decodeHtmlEntities(rawDescription) : rawDescription;

      if (parentProgramId) {
        const parent = await queryHelpers.queryOne(
          `SELECT id FROM programs WHERE id = ? AND organization_id = ?`,
          [String(parentProgramId), String(orgId)]
        );
        if (!parent) return res.status(400).json({ error: 'Parent program not found' });
      }

      const id = uuidv4();
      const now = new Date().toISOString();

      await queryHelpers.queryRun(
        `INSERT INTO programs (id, organization_id, name, description, parent_program_id, status, owner_user_id, start_date, end_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          String(orgId),
          name.trim(),
          description || null,
          parentProgramId || null,
          status || 'active',
          ownerUserId || null,
          startDate || null,
          endDate || null,
          now,
          now,
        ]
      );

      return res.status(201).json({
        id,
        organizationId: String(orgId),
        name: name.trim(),
        description: description || null,
        parentProgramId: parentProgramId || null,
        status: status || 'active',
        ownerUserId: ownerUserId || null,
        startDate: startDate || null,
        endDate: endDate || null,
        createdAt: now,
        updatedAt: now,
      });
    } catch (err: any) {
      return failInitiative500(res, 'Failed to create program', 'PROGRAM_CREATE_FAILED', err);
    }
  }
);

router.get('/programs/:programId', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { programId } = req.params;
    const program = (await queryHelpers.queryOne(
      `SELECT * FROM programs WHERE id = ? AND organization_id = ?`,
      [String(programId), String(orgId)]
    )) as any;
    if (!program) return res.status(404).json({ error: 'Program not found' });

    const childPrograms = await queryHelpers.queryAll(
      `SELECT p.*,
              (SELECT COUNT(*) FROM initiatives i WHERE i.program_id = p.id AND i.organization_id = p.organization_id) AS initiative_count
       FROM programs p
       WHERE p.parent_program_id = ? AND p.organization_id = ?
       ORDER BY p.name ASC`,
      [String(programId), String(orgId)]
    );

    const initiatives = await queryHelpers.queryAll(
      `SELECT id, name, title, status, priority, progress,
              COALESCE(cost_capex, 0) + COALESCE(cost_opex, 0) AS budget,
              COALESCE(business_value, 0) AS value
       FROM initiatives
       WHERE program_id = ? AND organization_id = ?
       ORDER BY name ASC`,
      [String(programId), String(orgId)]
    );

    return res.json({
      program: {
        id: program.id,
        organizationId: program.organization_id,
        name: program.name,
        description: program.description,
        parentProgramId: program.parent_program_id || null,
        status: program.status,
        ownerUserId: program.owner_user_id || null,
        startDate: program.start_date || null,
        endDate: program.end_date || null,
        createdAt: program.created_at,
        updatedAt: program.updated_at,
      },
      childPrograms: childPrograms.map((cp: any) => ({
        id: cp.id,
        name: cp.name,
        status: cp.status,
        parentProgramId: cp.parent_program_id,
        initiativeCount: Number(cp.initiative_count) || 0,
      })),
      initiatives: initiatives.map((i: any) => ({
        id: i.id,
        name: i.name || i.title,
        status: i.status,
        priority: i.priority,
        progress: Number(i.progress) || 0,
        budget: Number(i.budget) || 0,
        value: Number(i.value) || 0,
      })),
    });
  } catch (err: any) {
    return failInitiative500(res, 'Failed to fetch program', 'PROGRAM_FETCH_FAILED', err);
  }
});

/**
 * GET /api/initiatives/programs/:programId/rollup
 * Program rollup (F5 engine→route wiring, additive) — budget/value/benefits/ROI/health rolled
 * up across a program's projects + root initiatives + child programs, via
 * `programRollupService.getProgramRollup`. Read-only.
 */
router.get('/programs/:programId/rollup', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { programId } = req.params;
    const rollup = await getProgramRollup(String(orgId), String(programId));
    if (!rollup) return res.status(404).json({ error: 'Program not found' });

    return res.json(rollup);
  } catch (err: any) {
    return failInitiative500(
      res,
      'Failed to fetch program rollup',
      'PROGRAM_ROLLUP_FETCH_FAILED',
      err
    );
  }
});

router.put(
  '/programs/:programId',
  requireOrgRole('user'),
  requireGovernedInitiativeCapability('initiative.program.manage', {
    shadow: true,
    allowWithoutProject: true,
  }),
  async (req: any, res: any) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const { programId } = req.params;
      const existing = await queryHelpers.queryOne(
        `SELECT id FROM programs WHERE id = ? AND organization_id = ?`,
        [String(programId), String(orgId)]
      );
      if (!existing) return res.status(404).json({ error: 'Program not found' });

      const {
        name: rawName,
        description: rawDescription,
        parentProgramId,
        status,
        ownerUserId,
        startDate,
        endDate,
      } = req.body;
      // T5 (Z139 follow-up): decode HTML entities before storing — see POST /programs.
      const name = typeof rawName === 'string' ? decodeHtmlEntities(rawName) : rawName;
      const description =
        typeof rawDescription === 'string' ? decodeHtmlEntities(rawDescription) : rawDescription;

      if (parentProgramId === programId) {
        return res.status(400).json({ error: 'Program cannot be its own parent' });
      }

      if (parentProgramId) {
        const parent = await queryHelpers.queryOne(
          `SELECT id FROM programs WHERE id = ? AND organization_id = ?`,
          [String(parentProgramId), String(orgId)]
        );
        if (!parent) return res.status(400).json({ error: 'Parent program not found' });
      }

      const now = new Date().toISOString();
      await queryHelpers.queryRun(
        `UPDATE programs
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           parent_program_id = ?,
           status = COALESCE(?, status),
           owner_user_id = ?,
           start_date = ?,
           end_date = ?,
           updated_at = ?
       WHERE id = ? AND organization_id = ?`,
        [
          name || null,
          description !== undefined ? description : null,
          parentProgramId !== undefined ? parentProgramId || null : null,
          status || null,
          ownerUserId !== undefined ? ownerUserId || null : null,
          startDate !== undefined ? startDate || null : null,
          endDate !== undefined ? endDate || null : null,
          now,
          String(programId),
          String(orgId),
        ]
      );

      const updated = (await queryHelpers.queryOne(
        `SELECT * FROM programs WHERE id = ? AND organization_id = ?`,
        [String(programId), String(orgId)]
      )) as any;

      return res.json({
        id: updated.id,
        organizationId: updated.organization_id,
        name: updated.name,
        description: updated.description,
        parentProgramId: updated.parent_program_id || null,
        status: updated.status,
        ownerUserId: updated.owner_user_id || null,
        startDate: updated.start_date || null,
        endDate: updated.end_date || null,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      });
    } catch (err: any) {
      return failInitiative500(res, 'Failed to update program', 'PROGRAM_UPDATE_FAILED', err);
    }
  }
);

router.delete(
  '/programs/:programId',
  requireOrgRole('user'),
  requireGovernedInitiativeCapability('initiative.program.manage', {
    shadow: true,
    allowWithoutProject: true,
  }),
  async (req: any, res: any) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const { programId } = req.params;
      const existing = await queryHelpers.queryOne(
        `SELECT id FROM programs WHERE id = ? AND organization_id = ?`,
        [String(programId), String(orgId)]
      );
      if (!existing) return res.status(404).json({ error: 'Program not found' });

      const initiativeCount = (await queryHelpers.queryOne(
        `SELECT COUNT(*) AS cnt FROM initiatives WHERE program_id = ? AND organization_id = ?`,
        [String(programId), String(orgId)]
      )) as any;
      if (Number(initiativeCount?.cnt) > 0) {
        return res.status(409).json({
          error: 'Cannot delete program with linked initiatives. Reassign or remove them first.',
        });
      }

      const childCount = (await queryHelpers.queryOne(
        `SELECT COUNT(*) AS cnt FROM programs WHERE parent_program_id = ?`,
        [String(programId)]
      )) as any;
      if (Number(childCount?.cnt) > 0) {
        return res.status(409).json({
          error: 'Cannot delete program with child programs. Reassign or remove them first.',
        });
      }

      await queryHelpers.queryRun(`DELETE FROM programs WHERE id = ? AND organization_id = ?`, [
        String(programId),
        String(orgId),
      ]);

      return res.json({ success: true });
    } catch (err: any) {
      return failInitiative500(res, 'Failed to delete program', 'PROGRAM_DELETE_FAILED', err);
    }
  }
);

// ==========================================
// INITIATIVE CRUD
// ==========================================

/**
 * GET /api/initiatives
 * Get all initiatives for organization
 */
router.get('/', InitiativeController.getInitiatives);

/**
 * GET /api/initiatives/raci-results-summary?ids=id1,id2,id3
 * Faza2 gap #5 (audyt endpointów READ) — batched READ dla LISTY inicjatyw: RACI
 * (initiative_stakeholders.raci_type, taki sam wzorzec jak GET /:id/stakeholders) +
 * powiązane wyniki/KPI (initiative_kpis przez `initiativeKpiAssignmentService` — TEN SAM
 * czytnik co katalog KPI, NIE tabele v8, zgodnie z istniejącym wzorcem). Additive: NIE
 * zmienia kształtu `GET /` (getInitiatives) — lista woła to jako osobny, batched follow-up
 * zamiast N+1 wywołań `/:id/stakeholders` + `/:id/kpis` per wiersz. Fail-soft per id
 * (obcy/nieznany initiativeId → pusty wpis, nie 500 całego batcha). Max 200 id na wywołanie.
 * Query: `ids` (wymagane, comma-separated).
 */
router.get('/raci-results-summary', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const idsRaw = typeof req.query.ids === 'string' ? req.query.ids : '';
    const ids = idsRaw
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      return res.json({ summary: {} });
    }
    const summary = await getInitiativesRaciResultsSummary(orgId, ids);
    return res.json({ summary });
  } catch (err) {
    logger.error('[Initiatives] Error loading raci-results-summary:', err);
    return res.status(500).json({ error: 'Failed to load RACI/results summary' });
  }
});

/**
 * POST /api/initiatives/:id/duplicate
 * Duplicate a single initiative (lightweight copy; keeps assessment/report linkage).
 *
 * Note: This intentionally duplicates only the main `initiatives` row and does not clone
 * deep project-management sub-entities (tasks, RAID, etc.). Those can be re-generated later.
 *
 * Duplikacja zachowuje wszystkie kolumny istniejącego rekordu, ale jej zapis
 * należy do kanonicznego createInitiativeService. Router nie jest drugim
 * writerem i odpowiada wyłącznie za auth/HTTP.
 */
router.post(
  '/:id/duplicate',
  requireGovernedInitiativeCapability('initiative.create', { shadow: true }),
  async (req: any, res: any) => {
    try {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const duplicated = await duplicateInitiative(String(orgId), String(req.params.id || ''), {
        title: req.body?.title ? String(req.body.title) : null,
        actor: {
          id: userId ? String(userId) : null,
          ip: req.ip,
          userAgent: req.get?.('user-agent') || null,
        },
      });
      return res.status(201).json({ id: duplicated.id });
    } catch (err: any) {
      if (err?.statusCode === 404) return res.status(404).json({ error: 'Initiative not found' });
      return failInitiative500(
        res,
        'Failed to duplicate initiative',
        'INITIATIVE_DUPLICATE_FAILED',
        err
      );
    }
  }
);

/**
 * GET /api/initiatives/templates
 * List initiative templates (public + org-scoped)
 */
router.get('/templates', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const category = req.query?.category ? String(req.query.category) : null;
    const templates = await initiativeTemplateService.getTemplates({
      category,
      organizationId: String(orgId),
      includePublic: true,
    });
    return res.json({ templates });
  } catch (err: any) {
    return failInitiative500(res, 'Failed to fetch templates', 'TEMPLATES_FETCH_FAILED', err);
  }
});

/**
 * GET /api/initiatives/templates/:templateId
 * Fetch template details (incl. cardScope)
 */
router.get('/templates/:templateId', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { templateId } = req.params;
    const tpl = await initiativeTemplateService.getTemplateById(String(templateId));
    if (!tpl) return res.status(404).json({ error: 'Template not found' });
    if (!tpl.isPublic && tpl.organizationId !== String(orgId)) {
      return res.status(404).json({ error: 'Template not found' });
    }
    return res.json({ template: tpl });
  } catch (err: any) {
    return failInitiative500(res, 'Failed to fetch template', 'TEMPLATE_FETCH_FAILED', err);
  }
});

/**
 * POST /api/initiatives/templates
 * Create a new initiative template (org-scoped)
 */
router.post(
  '/templates',
  requireGovernedInitiativeCapability('initiative.template.manage', {
    shadow: true,
    allowWithoutProject: true,
  }),
  async (req: any, res: any) => {
    try {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const template = await initiativeTemplateService.createTemplate(
        { ...req.body, organizationId: String(orgId) },
        String(userId)
      );
      return res.status(201).json({ template });
    } catch (err: any) {
      return failInitiative500(res, 'Failed to create template', 'TEMPLATE_CREATE_FAILED', err);
    }
  }
);

/**
 * PUT /api/initiatives/templates/:templateId
 * Update an initiative template (org-scoped only)
 */
router.put(
  '/templates/:templateId',
  requireGovernedInitiativeCapability('initiative.template.manage', {
    shadow: true,
    allowWithoutProject: true,
  }),
  async (req: any, res: any) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const { templateId } = req.params;
      const existing = await initiativeTemplateService.getTemplateById(String(templateId));
      if (!existing) return res.status(404).json({ error: 'Template not found' });
      if (existing.isPublic && !existing.organizationId) {
        return res.status(403).json({ error: 'Cannot edit system templates' });
      }
      if (existing.organizationId && existing.organizationId !== String(orgId)) {
        return res.status(403).json({ error: 'Not authorized to edit this template' });
      }

      const updated = await initiativeTemplateService.updateTemplate(
        String(templateId),
        req.body,
        req.user?.id
      );
      return res.json({ template: updated });
    } catch (err: any) {
      return failInitiative500(res, 'Failed to update template', 'TEMPLATE_UPDATE_FAILED', err);
    }
  }
);

/**
 * DELETE /api/initiatives/templates/:templateId
 * Delete an initiative template (org-scoped only, cannot delete system)
 */
router.delete(
  '/templates/:templateId',
  requireGovernedInitiativeCapability('initiative.template.manage', {
    shadow: true,
    allowWithoutProject: true,
  }),
  async (req: any, res: any) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const { templateId } = req.params;
      const existing = await initiativeTemplateService.getTemplateById(String(templateId));
      if (!existing) return res.status(404).json({ error: 'Template not found' });
      if (existing.isPublic && !existing.organizationId) {
        return res.status(403).json({ error: 'Cannot delete system templates' });
      }
      if (existing.organizationId && existing.organizationId !== String(orgId)) {
        return res.status(403).json({ error: 'Not authorized to delete this template' });
      }

      await initiativeTemplateService.deleteTemplate(String(templateId));
      return res.json({ success: true });
    } catch (err: any) {
      return failInitiative500(res, 'Failed to delete template', 'TEMPLATE_DELETE_FAILED', err);
    }
  }
);

/**
 * POST /api/initiatives/templates/:templateId/duplicate
 * Duplicate a template to the org scope
 */
router.post(
  '/templates/:templateId/duplicate',
  requireGovernedInitiativeCapability('initiative.template.manage', {
    shadow: true,
    allowWithoutProject: true,
  }),
  async (req: any, res: any) => {
    try {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const { templateId } = req.params;
      const source = await initiativeTemplateService.getTemplateById(String(templateId));
      if (!source) return res.status(404).json({ error: 'Source template not found' });

      const newName = req.body?.name || `${source.name} (Copy)`;

      // Create a duplicate as org-scoped
      const duplicate = await initiativeTemplateService.createTemplate(
        {
          name: newName,
          category: source.category,
          description: source.description || undefined,
          applicableAxes: source.applicableAxes,
          problemStructured: source.problemStructured || undefined,
          targetState: source.targetState || undefined,
          killCriteria: source.killCriteria,
          suggestedTasks: source.suggestedTasks,
          suggestedRoles: source.suggestedRoles,
          typicalTimeline: source.typicalTimeline || undefined,
          typicalBudgetRange: source.typicalBudgetRange || undefined,
          isPublic: false,
          organizationId: String(orgId),
        },
        String(userId)
      );
      return res.status(201).json({ template: duplicate });
    } catch (err: any) {
      return failInitiative500(
        res,
        'Failed to duplicate template',
        'TEMPLATE_DUPLICATE_FAILED',
        err
      );
    }
  }
);

// ==========================================
// V4-INIT-03: BLUEPRINT WBS & VALIDATION
// ==========================================

/**
 * SECURITY (M13 cross-org IDOR): the blueprint WBS sub-resource lives on
 * `blueprint_wbs_items`, keyed ONLY by `template_id` — it carries no
 * `organization_id`. The org boundary lives on the parent `initiative_templates`
 * row. blueprintService.* therefore trusts the caller to have already verified
 * the template's ownership. Without this guard, any authenticated user could
 * read/add/update/delete/reorder another org's template WBS by id.
 *
 * Resolves the template and enforces visibility, mirroring the GET/PUT/DELETE
 * `/templates/:templateId` guards:
 *   - missing template            → 404
 *   - foreign-org private template → 404 (do not leak existence)
 *   - system/public template + write intent → 403 (immutable)
 * Returns `true` when the request handler may proceed; otherwise it has already
 * sent the response and the caller must `return`.
 */
async function ensureTemplateOrgAccess(
  req: any,
  res: any,
  templateId: string,
  intent: 'read' | 'write'
): Promise<boolean> {
  const orgId = req.user?.organizationId;
  if (!orgId) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  const tpl = await initiativeTemplateService.getTemplateById(String(templateId));
  if (!tpl) {
    res.status(404).json({ error: 'Template not found' });
    return false;
  }
  // Private template owned by another org → 404 (existence not leaked).
  if (tpl.organizationId && tpl.organizationId !== String(orgId)) {
    res.status(404).json({ error: 'Template not found' });
    return false;
  }
  // System/public template (no owning org): readable by all, but immutable.
  if (intent === 'write' && tpl.isPublic && !tpl.organizationId) {
    res.status(403).json({ error: 'Cannot modify system templates' });
    return false;
  }
  return true;
}

/**
 * GET /api/initiatives/templates/:templateId/wbs
 * Get WBS tree for a blueprint template
 */
router.get('/templates/:templateId/wbs', async (req: any, res: any) => {
  try {
    const { templateId } = req.params;
    if (!(await ensureTemplateOrgAccess(req, res, String(templateId), 'read'))) return;

    const tree = await blueprintService.getWbsTree(String(templateId));
    return res.json({ wbs: tree });
  } catch (err: any) {
    return failInitiative500(res, 'Failed to fetch WBS', 'WBS_FETCH_FAILED', err);
  }
});

/**
 * POST /api/initiatives/templates/:templateId/wbs
 * Add a WBS item to a blueprint template
 */
router.post(
  '/templates/:templateId/wbs',
  requireOrgRole('user'),
  requireGovernedInitiativeCapability('initiative.template.manage', {
    shadow: true,
    allowWithoutProject: true,
  }),
  async (req: any, res: any) => {
    try {
      const { templateId } = req.params;
      if (!(await ensureTemplateOrgAccess(req, res, String(templateId), 'write'))) return;

      const {
        parentId,
        title,
        itemType,
        level,
        sortOrder,
        estimatedHours,
        deliverables,
        acceptanceCriteria,
        assignedRole,
      } = req.body;
      if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ error: 'title is required' });
      }

      const item = await blueprintService.addWbsItem(String(templateId), {
        parentId,
        title: title.trim(),
        itemType,
        level,
        sortOrder,
        estimatedHours,
        deliverables,
        acceptanceCriteria,
        assignedRole,
      });
      return res.status(201).json({ item });
    } catch (err: any) {
      return failInitiative500(res, 'Failed to add WBS item', 'WBS_ADD_FAILED', err);
    }
  }
);

/**
 * PUT /api/initiatives/templates/:templateId/wbs/:itemId
 * Update a WBS item
 */
router.put(
  '/templates/:templateId/wbs/:itemId',
  requireOrgRole('user'),
  requireGovernedInitiativeCapability('initiative.template.manage', {
    shadow: true,
    allowWithoutProject: true,
  }),
  async (req: any, res: any) => {
    try {
      const { templateId, itemId } = req.params;
      if (!(await ensureTemplateOrgAccess(req, res, String(templateId), 'write'))) return;

      const item = await blueprintService.updateWbsItem(
        String(templateId),
        String(itemId),
        req.body
      );
      if (!item) return res.status(404).json({ error: 'WBS item not found' });
      return res.json({ item });
    } catch (err: any) {
      return failInitiative500(res, 'Failed to update WBS item', 'WBS_UPDATE_FAILED', err);
    }
  }
);

/**
 * DELETE /api/initiatives/templates/:templateId/wbs/:itemId
 * Delete a WBS item (cascades to children)
 */
router.delete(
  '/templates/:templateId/wbs/:itemId',
  requireOrgRole('user'),
  requireGovernedInitiativeCapability('initiative.template.manage', {
    shadow: true,
    allowWithoutProject: true,
  }),
  async (req: any, res: any) => {
    try {
      const { templateId, itemId } = req.params;
      if (!(await ensureTemplateOrgAccess(req, res, String(templateId), 'write'))) return;

      const deleted = await blueprintService.deleteWbsItem(String(templateId), String(itemId));
      if (!deleted) return res.status(404).json({ error: 'WBS item not found' });
      return res.json({ success: true });
    } catch (err: any) {
      return failInitiative500(res, 'Failed to delete WBS item', 'WBS_DELETE_FAILED', err);
    }
  }
);

/**
 * POST /api/initiatives/templates/:templateId/wbs/reorder
 * Reorder WBS items
 */
router.post(
  '/templates/:templateId/wbs/reorder',
  requireOrgRole('user'),
  requireGovernedInitiativeCapability('initiative.template.manage', {
    shadow: true,
    allowWithoutProject: true,
  }),
  async (req: any, res: any) => {
    try {
      const { templateId } = req.params;
      if (!(await ensureTemplateOrgAccess(req, res, String(templateId), 'write'))) return;

      const { items } = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: 'items array is required' });
      }

      await blueprintService.reorderWbsItems(String(templateId), items);
      return res.json({ success: true });
    } catch (err: any) {
      return failInitiative500(res, 'Failed to reorder WBS items', 'WBS_REORDER_FAILED', err);
    }
  }
);

/**
 * GET /api/initiatives/templates/:templateId/validate
 * Validate blueprint completeness
 */
router.get('/templates/:templateId/validate', async (req: any, res: any) => {
  try {
    const { templateId } = req.params;
    if (!(await ensureTemplateOrgAccess(req, res, String(templateId), 'read'))) return;

    const validation = await blueprintService.validateBlueprint(String(templateId));
    return res.json(validation);
  } catch (err: any) {
    return failInitiative500(res, 'Failed to validate blueprint', 'BLUEPRINT_VALIDATE_FAILED', err);
  }
});

/**
 * POST /api/initiatives/templates/:templateId/clone
 * Deep clone a blueprint template (including WBS items)
 */
router.post(
  '/templates/:templateId/clone',
  requireOrgRole('user'),
  requireGovernedInitiativeCapability('initiative.template.manage', {
    shadow: true,
    allowWithoutProject: true,
  }),
  async (req: any, res: any) => {
    try {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const { templateId } = req.params;
      // Read intent: cloning a system/public OR own-org template into your org is
      // allowed; a foreign-org private source must 404 (no cross-org read).
      if (!(await ensureTemplateOrgAccess(req, res, String(templateId), 'read'))) return;

      const result = await blueprintService.cloneBlueprint(
        String(templateId),
        String(orgId),
        String(userId)
      );
      return res.status(201).json(result);
    } catch (err: any) {
      return failInitiative500(res, 'Failed to clone blueprint', 'BLUEPRINT_CLONE_FAILED', err);
    }
  }
);

/**
 * PATCH /api/initiatives/:id/template
 * Change initiative template (card scope).
 */
router.patch(
  '/:id/template',
  requireGovernedInitiativeCapability('initiative.template.apply', { shadow: true }),
  validateBody(UpdateInitiativeTemplateSchema),
  async (req: any, res: any) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const { id } = req.params;
      const templateId = req.body?.templateId ?? null;

      // Validate template visibility if provided
      if (templateId) {
        const tpl = await initiativeTemplateService.getTemplateById(String(templateId));
        if (!tpl) return res.status(400).json({ error: 'Invalid templateId' });
        if (!tpl.isPublic && tpl.organizationId !== String(orgId)) {
          return res.status(403).json({ error: 'Template not available for this organization' });
        }
      }

      const existing = await queryHelpers.queryOne<any>(
        `SELECT id FROM initiatives WHERE id = ? AND organization_id = ? LIMIT 1`,
        [String(id), String(orgId)]
      );
      if (!existing) return res.status(404).json({ error: 'Initiative not found' });

      await queryHelpers.queryRun(
        `UPDATE initiatives SET initiative_template_id = ? WHERE id = ? AND organization_id = ?`,
        [templateId ? String(templateId) : null, String(id), String(orgId)]
      );
      return res.json({
        id: String(id),
        initiativeTemplateId: templateId ? String(templateId) : null,
      });
    } catch (err: any) {
      return failInitiative500(
        res,
        'Failed to update template',
        'INITIATIVE_TEMPLATE_ASSIGN_FAILED',
        err
      );
    }
  }
);

/**
 * POST /api/initiatives/:id/apply-template
 * Apply a template to an initiative: creates suggested tasks, milestones, decisions, KPIs, RAID items
 */
router.post(
  '/:id/apply-template',
  requireGovernedInitiativeCapability('initiative.template.apply', { shadow: true }),
  async (req: any, res: any) => {
    try {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const { id } = req.params;
      const { templateId } = req.body;
      if (!templateId) return res.status(400).json({ error: 'templateId is required' });

      // Verify initiative exists
      const initiative = (await queryHelpers.queryOne(
        `SELECT id, name, title FROM initiatives WHERE id = ? AND organization_id = ?`,
        [String(id), String(orgId)]
      )) as any;
      if (!initiative) return res.status(404).json({ error: 'Initiative not found' });

      // Fetch template
      const template = await initiativeTemplateService.getTemplateById(String(templateId));
      if (!template) return res.status(404).json({ error: 'Template not found' });

      const now = new Date().toISOString();
      const created = { tasks: 0, milestones: 0, decisions: 0, kpis: 0, raidItems: 0 };

      // 1. Create suggested tasks (V3: suggestedTaskItems)
      const taskItems = template.suggestedTaskItems || [];
      for (const task of taskItems) {
        try {
          const taskId = uuidv4();
          await queryHelpers.queryRun(
            `INSERT INTO tasks (id, organization_id, initiative_id, title, type, priority, status, step_phase, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'TODO', ?, ?, ?, ?)`,
            [
              taskId,
              String(orgId),
              String(id),
              String(task.title || 'Untitled task'),
              String(task.taskType || task.type || 'general'),
              String(task.priority || 'medium'),
              String(task.stepPhase || task.phase || null),
              String(userId || 'system'),
              now,
              now,
            ]
          );
          created.tasks++;
        } catch {
          // table schema may differ — skip individual failures
        }
      }

      // Fallback: V1 suggestedTasks (simple string array)
      if (taskItems.length === 0 && template.suggestedTasks?.length) {
        for (const taskTitle of template.suggestedTasks) {
          try {
            const taskId = uuidv4();
            await queryHelpers.queryRun(
              `INSERT INTO tasks (id, organization_id, initiative_id, title, status, created_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'TODO', ?, ?, ?)`,
              [
                taskId,
                String(orgId),
                String(id),
                String(taskTitle),
                String(userId || 'system'),
                now,
                now,
              ]
            );
            created.tasks++;
          } catch {
            // skip
          }
        }
      }

      // 2. Create suggested milestones
      const milestones = template.suggestedMilestones || [];
      for (let i = 0; i < milestones.length; i++) {
        const ms = milestones[i];
        try {
          const msId = uuidv4();
          await queryHelpers.queryRun(
            `INSERT INTO initiative_milestones (id, initiative_id, organization_id, name, description, status, is_gate, order_index, created_at)
           VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`,
            [
              msId,
              String(id),
              String(orgId),
              String(ms.name || `Milestone ${i + 1}`),
              String(ms.description || ''),
              ms.isGate ? 1 : 0,
              ms.order ?? i,
              now,
            ]
          );
          created.milestones++;
        } catch {
          // skip
        }
      }

      // 3. Create suggested decisions (gate decisions)
      const decisions = template.suggestedDecisions || [];
      for (const dec of decisions) {
        try {
          const decId = uuidv4();
          await queryHelpers.queryRun(
            `INSERT INTO decisions (id, organization_id, initiative_id, title, type, priority, status, pmo_domain, trigger_status, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
            [
              decId,
              String(orgId),
              String(id),
              String(dec.title || 'Untitled decision'),
              String(dec.type || 'APPROVAL'),
              String(dec.priority || 'medium'),
              String(dec.pmoDomain || dec.pmo_domain || null),
              String(dec.triggerStatus || dec.trigger_status || null),
              String(userId || 'system'),
              now,
              now,
            ]
          );
          created.decisions++;
        } catch {
          // skip — decisions table schema may vary
        }
      }

      // 4. Create suggested KPIs
      const kpis = template.suggestedKpis || [];
      for (const kpi of kpis) {
        try {
          const observationPhase =
            String(kpi.observationPhase || '').trim() === 'realization' ||
            String(kpi.observationPhase || '').trim() === 'both'
              ? String(kpi.observationPhase)
              : 'post-implementation';
          const measurementFrequency =
            String(kpi.measurementFrequency || kpi.frequency || 'MONTHLY').toUpperCase() === 'DAILY'
              ? 'DAILY'
              : String(kpi.measurementFrequency || kpi.frequency || 'MONTHLY').toUpperCase() ===
                  'WEEKLY'
                ? 'WEEKLY'
                : String(kpi.measurementFrequency || kpi.frequency || 'MONTHLY').toUpperCase() ===
                    'QUARTERLY'
                  ? 'QUARTERLY'
                  : 'MONTHLY';
          const baselineValue = kpi.baselineValue ?? kpi.baseline ?? null;
          const targetValue = kpi.targetValue ?? kpi.target ?? kpi.target_value ?? null;
          const realizationTargetValue =
            kpi.realizationExpectation?.targetValue ?? kpi.realizationTarget ?? targetValue;
          const postImplementationTargetValue =
            kpi.postImplementationExpectation?.targetValue ??
            kpi.postImplementationTarget ??
            targetValue;

          await upsertInitiativeKpiAssignment({
            initiativeId: String(id),
            organizationId: String(orgId),
            userId: String(userId || 'system'),
            name: String(kpi.name || 'Untitled KPI'),
            description: String(kpi.description || ''),
            category: String(kpi.category || 'benefits'),
            unit: String(kpi.unit || '%'),
            baselineValue,
            targetValue,
            measurementFrequency,
            currentValue: baselineValue,
            definitionSource: 'initiative-custom',
            observationPhase:
              observationPhase === 'realization' || observationPhase === 'both'
                ? (observationPhase as 'realization' | 'both')
                : 'post-implementation',
            trackedInRealization: observationPhase === 'realization' || observationPhase === 'both',
            trackedPostImplementation:
              observationPhase === 'post-implementation' || observationPhase === 'both',
            realizationExpectation: {
              baselineValue,
              targetValue: realizationTargetValue,
              measurementFrequency,
            },
            postImplementationExpectation: {
              baselineValue,
              targetValue: postImplementationTargetValue,
              measurementFrequency,
            },
          });
          created.kpis++;
        } catch {
          // skip
        }
      }

      // 5. Create RAID template items
      const raidItems = template.raidTemplates || [];
      for (const item of raidItems) {
        try {
          const raidId = uuidv4();
          await queryHelpers.queryRun(
            `INSERT INTO raid_items (id, initiative_id, organization_id, type, title, description, severity, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?)`,
            [
              raidId,
              String(id),
              String(orgId),
              String(item.type || 'RISK').toUpperCase(),
              String(item.title || 'Untitled'),
              String(item.description || ''),
              String(item.impact || item.severity || 'MEDIUM').toUpperCase(),
              now,
              now,
            ]
          );
          created.raidItems++;
        } catch {
          // skip
        }
      }

      // Update initiative template reference
      await queryHelpers.queryRun(
        `UPDATE initiatives SET initiative_template_id = ?, updated_at = ? WHERE id = ? AND organization_id = ?`,
        [String(templateId), now, String(id), String(orgId)]
      );

      return res.json({
        success: true,
        initiativeId: id,
        templateId,
        templateName: template.name,
        created,
      });
    } catch (err: any) {
      return failInitiative500(res, 'Failed to apply template', 'TEMPLATE_APPLY_FAILED', err);
    }
  }
);

/**
 * POST /api/initiatives/:id/changes
 * EXE-05 — create-or-link a change/decision record against the initiative,
 * without touching the FROZEN DecisionController.ts. Mirrors the apply-template
 * precedent above (direct INSERT INTO decisions) for the same reason: the frozen
 * controller stays the only path for ordinary decisions created from the UI
 * (DecisionsSection.tsx -> POST /api/decisions), while this route is a second,
 * narrowly-scoped call site for execution-spine change management.
 *
 * body:
 *  - decisionId?: string        -> LINK path: attach an existing decision to this initiative
 *  - title?: string             -> CREATE path (required when decisionId is absent)
 *  - description?, type?, priority?
 *  - reason?: string            -> stored as initiative_history.notes
 *  - idempotencyKey?: string    -> retry-safe replay guard (see 20260802_exe005006_change_progress_spine.sql)
 */
router.post(
  '/:id/changes',
  requireGovernedInitiativeCapability('initiative.change.manage', { shadow: true }),
  async (req: any, res: any) => {
    try {
      const orgId = req.user?.organizationId;
      const actorId = req.user?.id;
      if (!orgId || !actorId) return res.status(401).json({ error: 'Unauthorized' });

      const { id } = req.params;
      const { decisionId, title, description, type, priority, reason, idempotencyKey } =
        req.body || {};

      // Org-scope guard BEFORE any mutation, same shape as apply-template above.
      const initiative = await queryHelpers.queryOne(
        `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
        [String(id), String(orgId)]
      );
      if (!initiative) return res.status(404).json({ error: 'Initiative not found' });

      const isLink = Boolean(decisionId);

      if (isLink) {
        // LINK path: attach an existing decision to this initiative. Must belong to the
        // SAME org (cross-tenant fail-closed) — 404, not 403, to avoid confirming the
        // decision's existence to an unauthorized caller.
        const decision = (await queryHelpers.queryOne(
          `SELECT id, initiative_id FROM decisions WHERE id = ? AND organization_id = ?`,
          [String(decisionId), String(orgId)]
        )) as any;
        if (!decision) return res.status(404).json({ error: 'Decision not found' });

        // Idempotent replay guard (initiative_history dedup key, scoped to this action —
        // see EXE-06 progress_updated precedent in InitiativeController.ts).
        if (idempotencyKey) {
          const existingHistory = await queryHelpers.queryOne(
            `SELECT id FROM initiative_history WHERE initiative_id = ? AND action = 'change_linked' AND idempotency_key = ?`,
            [String(id), String(idempotencyKey)]
          );
          if (existingHistory) {
            return res
              .status(200)
              .json({ success: true, idempotent: true, decisionId: String(decisionId) });
          }
        }

        // Do not steal a decision already linked to a different initiative — only
        // (re)link if currently unlinked or already pointing here.
        if (decision.initiative_id && String(decision.initiative_id) !== String(id)) {
          return res.status(409).json({
            error: 'Decision is already linked to a different initiative',
            code: 'DECISION_ALREADY_LINKED',
          });
        }
        if (!decision.initiative_id) {
          await queryHelpers.queryRun(
            `UPDATE decisions SET initiative_id = ?, updated_at = ? WHERE id = ? AND organization_id = ?`,
            [String(id), new Date().toISOString(), String(decisionId), String(orgId)]
          );
        }

        try {
          await queryHelpers.queryRun(
            `INSERT INTO initiative_history (id, initiative_id, action, old_value, new_value, changed_by, notes, idempotency_key)
             VALUES (?, ?, 'change_linked', NULL, ?, ?, ?, ?)`,
            [
              uuidv4(),
              String(id),
              JSON.stringify({ decisionId }),
              String(actorId),
              reason || null,
              idempotencyKey || null,
            ]
          );
        } catch (histErr: any) {
          if (histErr?.code !== '23505') {
            logger.error('[POST /:id/changes] failed to write change_linked history', {
              initiativeId: id,
              error: histErr?.message || String(histErr),
            });
          }
        }

        return res.status(200).json({ success: true, decisionId: String(decisionId) });
      }

      // CREATE path: new decision linked to this initiative, mirroring apply-template's
      // INSERT INTO decisions shape above.
      if (!title)
        return res.status(400).json({ error: 'title is required to create a change/decision' });

      if (idempotencyKey) {
        const existingDecision = (await queryHelpers.queryOne(
          `SELECT id FROM decisions WHERE initiative_id = ? AND idempotency_key = ?`,
          [String(id), String(idempotencyKey)]
        )) as any;
        if (existingDecision) {
          return res
            .status(200)
            .json({ success: true, idempotent: true, decisionId: String(existingDecision.id) });
        }
      }

      const now = new Date().toISOString();
      const decId = uuidv4();
      // decisions.decision_maker_id is NOT NULL on the real schema — it is the
      // person responsible for deciding, not merely the row's author. Canonical
      // semantics (DecisionController.createDecision, frozen, read-only for
      // reference): `decision_maker_id = decisionOwnerId || userId` — an
      // explicit owner from the request if the caller provided one, otherwise
      // the session actor. This endpoint does not (yet) accept a caller-chosen
      // owner — accepting one from the body without its own ownership/capability
      // check would let any caller with initiative-change access hand a decision
      // to an arbitrary user id. So: always the session actor, matching
      // canonical's own default-when-unspecified path. No fabricated system id,
      // no relaxed NOT NULL, no schema change.
      try {
        await queryHelpers.queryRun(
          `INSERT INTO decisions (id, organization_id, initiative_id, title, description, type, priority, status, decision_maker_id, created_by, created_at, updated_at, idempotency_key)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
          [
            decId,
            String(orgId),
            String(id),
            String(title),
            description || null,
            String(type || 'CHANGE'),
            String(priority || 'medium'),
            String(actorId),
            String(actorId),
            now,
            now,
            idempotencyKey || null,
          ]
        );
      } catch (insertErr: any) {
        // Unique-violation on (initiative_id, idempotency_key) means a concurrent identical
        // retry already created the decision — treat that as success, not an error.
        if (insertErr?.code === '23505' && idempotencyKey) {
          const winner = (await queryHelpers.queryOne(
            `SELECT id FROM decisions WHERE initiative_id = ? AND idempotency_key = ?`,
            [String(id), String(idempotencyKey)]
          )) as any;
          if (winner) {
            return res
              .status(200)
              .json({ success: true, idempotent: true, decisionId: String(winner.id) });
          }
        }
        throw insertErr;
      }

      try {
        await queryHelpers.queryRun(
          `INSERT INTO initiative_history (id, initiative_id, action, old_value, new_value, changed_by, notes, idempotency_key)
           VALUES (?, ?, 'change_created', NULL, ?, ?, ?, ?)`,
          [
            uuidv4(),
            String(id),
            JSON.stringify({ decisionId: decId, title }),
            String(actorId),
            reason || null,
            idempotencyKey || null,
          ]
        );
      } catch (histErr: any) {
        if (histErr?.code !== '23505') {
          logger.error('[POST /:id/changes] failed to write change_created history', {
            initiativeId: id,
            error: histErr?.message || String(histErr),
          });
        }
      }

      return res.status(201).json({ success: true, decisionId: decId });
    } catch (err: any) {
      return failInitiative500(
        res,
        'Failed to create/link change',
        'INITIATIVE_CHANGE_FAILED',
        err
      );
    }
  }
);

/**
 * POST /api/initiatives/:id/apply-blueprint
 * Enhanced apply that includes WBS tasks, milestone dependencies, role templates, and DoD per level
 */
router.post(
  '/:id/apply-blueprint',
  requireOrgRole('user'),
  requireGovernedInitiativeCapability('initiative.template.apply', { shadow: true }),
  async (req: any, res: any) => {
    try {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const { id } = req.params;
      const { templateId } = req.body;
      if (!templateId) return res.status(400).json({ error: 'templateId is required' });

      const initiative = await queryHelpers.queryOne(
        `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
        [String(id), String(orgId)]
      );
      if (!initiative) return res.status(404).json({ error: 'Initiative not found' });

      const template = await initiativeTemplateService.getTemplateById(String(templateId));
      if (!template) return res.status(404).json({ error: 'Template not found' });

      const wbsResult = await blueprintService.applyWbs(
        String(templateId),
        String(id),
        String(orgId),
        String(userId)
      );
      const msResult = await blueprintService.applyMilestoneDependencies(
        String(templateId),
        String(id),
        String(orgId)
      );
      const roleResult = await blueprintService.applyRoleTemplates(
        String(templateId),
        String(id),
        String(orgId),
        String(userId)
      );
      const dodResult = await blueprintService.applyDoDPerLevel(String(templateId), String(id));

      await queryHelpers.queryRun(
        `UPDATE initiatives SET initiative_template_id = ?, updated_at = ? WHERE id = ? AND organization_id = ?`,
        [String(templateId), new Date().toISOString(), String(id), String(orgId)]
      );

      return res.json({
        success: true,
        initiativeId: id,
        templateId,
        templateName: template.name,
        applied: {
          tasksCreated: wbsResult.tasksCreated,
          milestonesCreated: msResult.milestonesCreated,
          rolesCreated: roleResult.rolesCreated,
          dodLevelsApplied: dodResult.levelsApplied,
        },
      });
    } catch (err: any) {
      return failInitiative500(res, 'Failed to apply blueprint', 'BLUEPRINT_APPLY_FAILED', err);
    }
  }
);

function isMissingInitiativeSectionTypesTable(error: unknown): boolean {
  const message = String((error as any)?.message || error || '').toLowerCase();
  return (
    (message.includes('no such table') || message.includes('does not exist')) &&
    message.includes('initiative_section_types')
  );
}

// ==========================================
// INITIATIVE SECTION TYPES (Library)
// ==========================================

/**
 * GET /api/initiatives/section-types
 * List all section types (system + org-specific)
 */
router.get('/section-types', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    const sectionTypes = await initiativeSectionTypeService.getAllSectionTypes(orgId);
    return res.json(sectionTypes);
  } catch (err: any) {
    if (isMissingInitiativeSectionTypesTable(err)) {
      return res.json([]);
    }
    return failInitiative500(
      res,
      'Failed to fetch section types',
      'SECTION_TYPES_FETCH_FAILED',
      err
    );
  }
});

/**
 * GET /api/initiatives/section-types/:id
 * Get single section type by ID
 */
router.get('/section-types/:id', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const sectionType = await initiativeSectionTypeService.getSectionTypeById(req.params.id);
    if (!sectionType) return res.status(404).json({ error: 'Section type not found' });
    // SECURITY (M13 cross-org IDOR): a private org section type is visible only
    // to its owning org. System types (organizationId === null) are public.
    if (sectionType.organizationId && sectionType.organizationId !== String(orgId)) {
      return res.status(404).json({ error: 'Section type not found' });
    }
    return res.json(sectionType);
  } catch (err: any) {
    return failInitiative500(res, 'Failed to fetch section type', 'SECTION_TYPE_FETCH_FAILED', err);
  }
});

/**
 * POST /api/initiatives/section-types
 * Create a new organization section type
 */
router.post(
  '/section-types',
  requireGovernedInitiativeCapability('initiative.section_type.manage', {
    shadow: true,
    allowWithoutProject: true,
  }),
  async (req: any, res: any) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const created = await initiativeSectionTypeService.createSectionType({
        ...req.body,
        organizationId: orgId,
        createdBy: req.user?.id,
      });
      return res.status(201).json(created);
    } catch (err: any) {
      return failInitiative500(
        res,
        'Failed to create section type',
        'SECTION_TYPE_CREATE_FAILED',
        err
      );
    }
  }
);

/**
 * PUT /api/initiatives/section-types/:id
 * Update an organization section type
 */
router.put(
  '/section-types/:id',
  requireGovernedInitiativeCapability('initiative.section_type.manage', {
    shadow: true,
    allowWithoutProject: true,
  }),
  async (req: any, res: any) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      // SECURITY (M13 cross-org IDOR): the service updates by id only and never
      // checks the owning org, so without this guard org A could rewrite org B's
      // private section type. A foreign-org (non-system) row must 404, never write.
      const existing = await initiativeSectionTypeService.getSectionTypeById(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Section type not found' });
      if (existing.isSystem || !existing.organizationId) {
        return res.status(403).json({ error: 'Cannot modify system section types' });
      }
      if (existing.organizationId !== String(orgId)) {
        return res.status(404).json({ error: 'Section type not found' });
      }

      const updated = await initiativeSectionTypeService.updateSectionType(req.params.id, req.body);
      return res.json(updated);
    } catch (err: any) {
      if (err.message?.includes('system')) {
        return res.status(403).json({ error: 'Cannot modify system section types' });
      }
      return failInitiative500(
        res,
        'Failed to update section type',
        'SECTION_TYPE_UPDATE_FAILED',
        err
      );
    }
  }
);

/**
 * DELETE /api/initiatives/section-types/:id
 * Deactivate a section type (soft delete)
 */
router.delete(
  '/section-types/:id',
  requireGovernedInitiativeCapability('initiative.section_type.manage', {
    shadow: true,
    allowWithoutProject: true,
  }),
  async (req: any, res: any) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      // SECURITY (M13 cross-org IDOR): mirror the update guard — the service
      // soft-deletes by id only. A foreign-org (non-system) row must 404, never
      // be deactivated by another org.
      const existing = await initiativeSectionTypeService.getSectionTypeById(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Section type not found' });
      if (existing.isSystem || !existing.organizationId) {
        return res.status(403).json({ error: 'Cannot delete system section types' });
      }
      if (existing.organizationId !== String(orgId)) {
        return res.status(404).json({ error: 'Section type not found' });
      }

      await initiativeSectionTypeService.deleteSectionType(req.params.id);
      return res.json({ success: true });
    } catch (err: any) {
      if (err.message?.includes('system')) {
        return res.status(403).json({ error: 'Cannot delete system section types' });
      }
      return failInitiative500(
        res,
        'Failed to delete section type',
        'SECTION_TYPE_DELETE_FAILED',
        err
      );
    }
  }
);

/**
 * POST /api/initiatives/section-types/:id/duplicate
 * Duplicate a section type to organization
 */
router.post(
  '/section-types/:id/duplicate',
  requireGovernedInitiativeCapability('initiative.section_type.manage', {
    shadow: true,
    allowWithoutProject: true,
  }),
  async (req: any, res: any) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      // SECURITY (M13 cross-org IDOR): you may only duplicate a system section type
      // or one your own org owns — never read a foreign org's private type.
      const source = await initiativeSectionTypeService.getSectionTypeById(req.params.id);
      if (!source) return res.status(404).json({ error: 'Source section type not found' });
      if (source.organizationId && source.organizationId !== String(orgId)) {
        return res.status(404).json({ error: 'Source section type not found' });
      }

      const duplicated = await initiativeSectionTypeService.duplicateSectionType(
        req.params.id,
        orgId,
        req.user?.id
      );
      return res.status(201).json(duplicated);
    } catch (err: any) {
      return failInitiative500(
        res,
        'Failed to duplicate section type',
        'SECTION_TYPE_DUPLICATE_FAILED',
        err
      );
    }
  }
);

// ==========================================
// AI GENERATION ENDPOINTS
// ==========================================

/**
 * POST /api/initiatives/generate-section
 * Generate AI content for a specific initiative section
 * Body: { sectionKey, initiativeId?, initiativeName, summary?, language?, ... }
 */
router.post('/generate-section', requireInitiativeWriteAccess(), async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { sectionKey, withReview, ...context } = req.body;
    if (!sectionKey) {
      return res.status(400).json({ error: 'sectionKey is required' });
    }

    const result = await initiativeGenerationService.generateSectionContent(
      sectionKey,
      { ...context, language: context.language || 'en' },
      String(orgId),
      // F3.8 — reviewer §B4 DEFAULT ON (uspójnienie). Pass withReview:false to
      // opt out; any other value (including absent) enables the advisory verdict.
      // Never auto-rejects — the human still reviews and saves.
      { withReview: withReview !== false }
    );

    return res.json(result);
  } catch (err: any) {
    const statusCodeRaw = Number(err?.statusCode ?? err?.status ?? 500);
    const statusCode =
      Number.isFinite(statusCodeRaw) && statusCodeRaw >= 100 && statusCodeRaw <= 599
        ? statusCodeRaw
        : 500;

    if (statusCode === 503 || err?.code === 'FEATURE_UNAVAILABLE') {
      return notConfigured(req, res);
    }

    return res
      .status(statusCode)
      .json(
        buildPmoInitiativesFailClosedError(
          req,
          statusCode,
          'PMO_INITIATIVES_SECTION_GENERATION_FAILED',
          'Failed to generate section content.'
        )
      );
  }
});

/**
 * POST /api/initiatives/review-section
 * ADVERSARIAL REVIEWER (CARD_CONTENT_FORMULA §B4/§B6): score already-generated
 * section content (0–100 + PASS/FAIL + deficiencies) so low-quality output is
 * flagged BEFORE a human accepts it. ADVISORY — never auto-rejects/auto-submits.
 * Body: { sectionKey, content, language?, sectionName? }
 */
router.post('/review-section', requireInitiativeWriteAccess(), async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { sectionKey, content, language, sectionName } = req.body;
    if (!sectionKey) return res.status(400).json({ error: 'sectionKey is required' });
    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'content is required' });
    }

    const review = await initiativeGenerationService.reviewSectionContent(sectionKey, content, {
      language: language === 'pl' ? 'pl' : language === 'en' ? 'en' : undefined,
      sectionName: typeof sectionName === 'string' ? sectionName : undefined,
    });

    return res.json({ review });
  } catch (err: any) {
    const statusCodeRaw = Number(err?.statusCode ?? err?.status ?? 500);
    const statusCode =
      Number.isFinite(statusCodeRaw) && statusCodeRaw >= 100 && statusCodeRaw <= 599
        ? statusCodeRaw
        : 500;

    if (statusCode === 503 || err?.code === 'FEATURE_UNAVAILABLE') {
      return notConfigured(req, res);
    }

    return res
      .status(statusCode)
      .json(
        buildPmoInitiativesFailClosedError(
          req,
          statusCode,
          'PMO_INITIATIVES_SECTION_REVIEW_FAILED',
          'Failed to review section content.'
        )
      );
  }
});

/**
 * POST /api/initiatives/generate-section-fill
 *
 * K4 (decyzja właściciela 2026-07-19): AI-„uzupełnij" UNIWERSALNIE na sekcjach
 * inicjatywy, które NIE mają natywnego AI (team, raci, dependencies, milestones,
 * timeline, technical, tasks, attachments, comments, activity). Sekcje z AI
 * dalej używają `/generate-section`. Ten endpoint uzupełnia lukę wg
 * `services/ai/initiativeSectionFill.ts` (prompty w kodzie, doktryna BCG).
 *
 * ★ ZA FLAGĄ default OFF (`INITIATIVE_SECTION_AIFILL`) — reguła #7: nic wizualnie
 * nowego przed odbiorem Piotra. Gdy flaga OFF → 503 notConfigured (jak brak AI).
 *
 * Body: { initiativeId, sectionKey, language?, existingItems?, relatedTasks?, teamContext?, ... }
 * Governance jak `/generate-section` (auth + org scope + requireInitiativeWriteAccess).
 */
router.post(
  '/generate-section-fill',
  requireInitiativeWriteAccess(),
  async (req: any, res: any) => {
    // Flaga default OFF — bez implementacji zmiany zachowania przed akceptem Piotra.
    if (process.env.INITIATIVE_SECTION_AIFILL !== 'true') {
      return notConfigured(req, res);
    }

    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const { sectionKey, initiativeId, ...context } = req.body || {};
      if (!sectionKey) {
        return res.status(400).json({ error: 'sectionKey is required' });
      }

      const { generateInitiativeSectionFill, normalizeFillSectionKey } =
        await import('../../services/ai/initiativeSectionFill.js');

      if (!normalizeFillSectionKey(String(sectionKey))) {
        // Sekcja ma natywne AI (albo nieznana) — kieruj do /generate-section.
        return res.status(400).json({
          error: `Section "${sectionKey}" is not handled by generate-section-fill; use /generate-section.`,
          code: 'SECTION_NOT_FILLABLE',
        });
      }

      // Ugruntowanie: gdy podano initiativeId, dociągnij podstawowy kontekst z bazy
      // (org-scoped). Body-provided context ma pierwszeństwo (UI może już go znać).
      const grounded: Record<string, any> = { ...context };
      if (initiativeId) {
        const initiative = (await queryHelpers.queryOne(
          `SELECT * FROM initiatives WHERE id = ? AND organization_id = ?`,
          [String(initiativeId), String(orgId)]
        )) as any;
        if (!initiative) {
          return res.status(404).json({ error: 'Initiative not found' });
        }
        grounded.initiativeId = String(initiativeId);
        grounded.initiativeName ??= initiative.name || initiative.title || 'Initiative';
        grounded.summary ??= initiative.summary || initiative.description || '';
        grounded.problemStatement ??= initiative.problem_statement || '';
        grounded.category ??= initiative.category || '';
        grounded.module ??= initiative.module || '';
        grounded.status ??= initiative.status || '';
      }

      const result = await generateInitiativeSectionFill(String(sectionKey), grounded, {
        language: context.language || 'en',
      });

      return res.json(result);
    } catch (err: any) {
      const statusCodeRaw = Number(err?.statusCode ?? err?.status ?? 500);
      const statusCode =
        Number.isFinite(statusCodeRaw) && statusCodeRaw >= 100 && statusCodeRaw <= 599
          ? statusCodeRaw
          : 500;

      if (statusCode === 503 || err?.code === 'FEATURE_UNAVAILABLE') {
        return notConfigured(req, res);
      }

      return res
        .status(statusCode)
        .json(
          buildPmoInitiativesFailClosedError(
            req,
            statusCode,
            'PMO_INITIATIVES_SECTION_FILL_FAILED',
            'Failed to generate section fill content.'
          )
        );
    }
  }
);

/**
 * POST /api/initiatives/readiness-analysis
 * AI-powered readiness analysis for the next gate
 * Body: { initiativeId }
 */
router.post('/readiness-analysis', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { initiativeId } = req.body;
    if (!initiativeId) return res.status(400).json({ error: 'initiativeId is required' });

    // Fetch initiative + related data
    const initiative = (await queryHelpers.queryOne(
      `SELECT * FROM initiatives WHERE id = ? AND organization_id = ?`,
      [String(initiativeId), String(orgId)]
    )) as any;
    if (!initiative) return res.status(404).json({ error: 'Initiative not found' });

    // Gather context
    let taskCount = 0;
    let taskDone = 0;
    let decisionCount = 0;
    let decisionApproved = 0;
    let raidCritical = 0;

    try {
      const taskRows = await queryHelpers.queryAll<any>(
        `SELECT status FROM tasks WHERE initiative_id = ? AND organization_id = ?`,
        [String(initiativeId), String(orgId)]
      );
      taskCount = taskRows.length;
      taskDone = taskRows.filter((t: any) => ['done', 'DONE'].includes(t.status)).length;
    } catch {
      /* tasks table may not exist */
    }

    try {
      const decRows = await queryHelpers.queryAll<any>(
        `SELECT status FROM decisions WHERE initiative_id = ? AND organization_id = ?`,
        [String(initiativeId), String(orgId)]
      );
      decisionCount = decRows.length;
      decisionApproved = decRows.filter((d: any) =>
        ['approved', 'APPROVED'].includes(d.status)
      ).length;
    } catch {
      /* */
    }

    try {
      const raidRows = await queryHelpers.queryAll<any>(
        `SELECT severity FROM raid_items WHERE initiative_id = ? AND organization_id = ? AND status != 'RESOLVED'`,
        [String(initiativeId), String(orgId)]
      );
      raidCritical = raidRows.filter((r: any) =>
        ['HIGH', 'CRITICAL'].includes(String(r.severity || '').toUpperCase())
      ).length;
    } catch {
      /* */
    }

    // Generate AI readiness analysis
    const result = await initiativeGenerationService.generateSectionContent(
      'gates',
      {
        initiativeId: String(initiativeId),
        initiativeName: initiative.name || initiative.title || 'Initiative',
        summary: initiative.summary || '',
        problemStatement: initiative.problem_statement || '',
        status: initiative.status || 'DRAFT',
        completedTasks: taskDone,
        totalTasks: taskCount,
        openRisks: raidCritical,
        openDecisions: decisionCount - decisionApproved,
        language: req.body.language || 'en',
      },
      String(orgId)
    );

    return res.json({
      analysis: result.content,
      parsedAnalysis: result.parsedContent,
      metrics: {
        tasksProgress: taskCount > 0 ? Math.round((taskDone / taskCount) * 100) : 0,
        decisionsApproved: decisionApproved,
        decisionsPending: decisionCount - decisionApproved,
        criticalRisks: raidCritical,
        hasOwner: !!initiative.owner_business_id || !!initiative.owner_execution_id,
        hasTimeline: !!initiative.planned_start_date && !!initiative.planned_end_date,
        hasSummary: !!(initiative.summary || '').trim(),
        hasProblemStatement: !!(initiative.problem_statement || '').trim(),
      },
      model: result.model,
    });
  } catch (err: any) {
    const statusCodeRaw = Number(err?.statusCode ?? err?.status ?? 500);
    const statusCode =
      Number.isFinite(statusCodeRaw) && statusCodeRaw >= 100 && statusCodeRaw <= 599
        ? statusCodeRaw
        : 500;

    if (statusCode === 503 || err?.code === 'FEATURE_UNAVAILABLE') {
      return notConfigured(req, res);
    }

    return res
      .status(statusCode)
      .json(
        buildPmoInitiativesFailClosedError(
          req,
          statusCode,
          'PMO_INITIATIVES_READINESS_ANALYSIS_FAILED',
          'Failed to analyze readiness.'
        )
      );
  }
});

/**
 * POST /api/initiatives/suggest-sections
 * Get AI suggestions for which sections to enable
 * Body: { initiativeName, summary?, category?, module? }
 */
router.post('/suggest-sections', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const suggestions = await initiativeGenerationService.suggestSections(
      { ...req.body, language: req.body.language || 'en' },
      String(orgId)
    );

    return res.json({ suggestions });
  } catch (err: any) {
    const statusCodeRaw = Number(err?.statusCode ?? err?.status ?? 500);
    const statusCode =
      Number.isFinite(statusCodeRaw) && statusCodeRaw >= 100 && statusCodeRaw <= 599
        ? statusCodeRaw
        : 500;

    if (statusCode === 503 || err?.code === 'FEATURE_UNAVAILABLE') {
      return notConfigured(req, res);
    }

    return res
      .status(statusCode)
      .json(
        buildPmoInitiativesFailClosedError(
          req,
          statusCode,
          'PMO_INITIATIVES_SUGGEST_SECTIONS_FAILED',
          'Failed to suggest sections.'
        )
      );
  }
});

// ==========================================
// INITIATIVE CRUD
// ==========================================

/**
 * POST /api/initiatives
 * Create a new initiative
 */
router.post(
  '/',
  requireGovernedInitiativeCapability('initiative.create', { shadow: true }),
  validateBody(CreateInitiativeSchema),
  InitiativeController.createInitiative
);

// ─────────────────────────────────────────────────────────────────────────
// H1.4 / S6.2 — Tools → Initiatives session handoff (chain gap #4).
//
// A Discovery tool session concludes with recommendations, but the
// "materialize these into the Initiatives backbone" callback had NO server
// handler: the SWOT SummaryStep's develop/defer/idea marking lived only in
// local UI state (SummaryStep.tsx `initiativeActions`) and evaporated on
// unmount. This endpoint closes the gap. It drafts ONE canonical initiative
// per accepted recommendation through the SAME funnel the wizard and the
// interview-insight handoff use (createInitiativeService), tagged
// source_type='tool_session' / source_id=<sessionId> for a real back-reference.
//
// Idempotent (dedup przy powtórce): a repeat call skips any recommendation
// already materialized from this session — the same back-ref-based dedup
// doctrine as the interview-insight handoff (#59) and the AI tool generator
// (#68b), so re-clicking "Create initiatives" never duplicates the portfolio.
//
// Recommendations are taken from the request body (the SummaryStep already
// holds them client-side); when omitted, they are derived from the session's
// own stored output/answers so a server-only caller still works.
// ─────────────────────────────────────────────────────────────────────────
const FromToolSessionSchema = z.object({
  toolSessionId: z.string().min(1).max(255),
  projectId: z.string().max(255).optional().nullable(),
  recommendations: z
    .array(
      z.object({
        title: z.string().min(1).max(255),
        description: z.string().max(20000).optional().nullable(),
        rationale: z.string().max(20000).optional().nullable(),
        category: z.string().max(255).optional().nullable(),
        impact: z.string().max(50).optional().nullable(),
        effort: z.string().max(50).optional().nullable(),
      })
    )
    .max(50)
    .optional(),
});

type ToolSessionRecommendation = {
  title: string;
  description?: string | null;
  rationale?: string | null;
  category?: string | null;
  impact?: string | null;
  effort?: string | null;
};

/**
 * Derive recommendations from a tool session's persisted state when the caller
 * did not pass an explicit list. Tolerant of the several shapes tools store:
 * `recommendedInitiatives` / `generatedInitiatives` / `summary.recommendedInitiatives`
 * / `recommendations`, in either `output_json` or `answers_json`.
 */
function extractSessionRecommendations(session: {
  answers_json: string | null;
  output_json: string | null;
}): ToolSessionRecommendation[] {
  const tryParse = (s: string | null): any => {
    try {
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  };
  const out: ToolSessionRecommendation[] = [];
  for (const src of [tryParse(session.output_json), tryParse(session.answers_json)]) {
    if (!src || typeof src !== 'object') continue;
    const list: any[] | null =
      (Array.isArray(src.recommendedInitiatives) && src.recommendedInitiatives) ||
      (Array.isArray(src.generatedInitiatives) && src.generatedInitiatives) ||
      (src.summary &&
        Array.isArray(src.summary.recommendedInitiatives) &&
        src.summary.recommendedInitiatives) ||
      (Array.isArray(src.recommendations) && src.recommendations) ||
      null;
    if (list && list.length) {
      for (const item of list) {
        const title = item?.title || item?.name;
        if (!title) continue;
        out.push({
          title: String(title),
          description: item?.description ?? null,
          rationale: item?.rationale ?? null,
          category: item?.category ?? item?.type ?? null,
          impact: item?.estimatedImpact ?? item?.impact ?? null,
          effort: item?.estimatedEffort ?? item?.effort ?? null,
        });
      }
      if (out.length) break;
    }
  }
  return out;
}

router.post(
  '/from-tool-session',
  requireOrgRole('user'),
  requireGovernedInitiativeCapability('initiative.create', { shadow: true }),
  requireInitiativeWriteAccess(),
  validateBody(FromToolSessionSchema),
  async (req: any, res: any) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id || null;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const toolSessionId = String(req.body.toolSessionId);

    // 1) Session must exist within the caller's org (tenant guard).
    const session = (await queryHelpers.queryOne(
      `SELECT id, organization_id, project_id, tool_type, answers_json, output_json
         FROM tool_sessions WHERE id = ? AND organization_id = ?`,
      [toolSessionId, orgId]
    )) as {
      id: string;
      organization_id: string;
      project_id: string | null;
      tool_type: string;
      answers_json: string | null;
      output_json: string | null;
    } | null;
    if (!session) {
      return res
        .status(404)
        .json({ error: 'Tool session not found', code: 'TOOL_SESSION_NOT_FOUND' });
    }

    // 2) Resolve recommendations: explicit body list wins; else derive from the
    //    session's own persisted output/answers.
    const bodyRecs: ToolSessionRecommendation[] = Array.isArray(req.body.recommendations)
      ? req.body.recommendations
      : [];
    const recommendations = bodyRecs.length > 0 ? bodyRecs : extractSessionRecommendations(session);
    if (!recommendations.length) {
      return res.status(422).json({
        error: 'Tool session has no recommendations to materialize',
        code: 'TOOL_SESSION_NO_RECOMMENDATIONS',
      });
    }

    // Project scope: body override, else the session's own project.
    const projectId =
      (typeof req.body.projectId === 'string' && req.body.projectId) || session.project_id || null;

    // 3) Existing back-refs from THIS session drive the idempotent dedup.
    const existingRows = (await queryHelpers.queryAll(
      `SELECT LOWER(TRIM(COALESCE(title, name))) AS norm_title FROM initiatives
        WHERE organization_id = ? AND source_type = 'tool_session' AND source_id = ?`,
      [orgId, toolSessionId]
    )) as Array<{ norm_title: string | null }>;
    const seenTitles = new Set(existingRows.map((r) => (r.norm_title || '').trim()));

    const created: Array<{ id: string; title: string; status: string }> = [];
    const skipped: Array<{ title: string; reason: string }> = [];

    for (const rec of recommendations) {
      const title = String(rec.title || '').trim();
      if (!title) {
        skipped.push({ title: '', reason: 'empty_title' });
        continue;
      }
      const norm = title.toLowerCase();
      if (seenTitles.has(norm)) {
        skipped.push({ title, reason: 'already_materialized' });
        continue;
      }
      try {
        const result = await funnelCreateInitiative(
          orgId,
          {
            title,
            projectId,
            summary: rec.description || rec.rationale || title,
            description: rec.rationale || rec.description || null,
            axis: rec.category ? String(rec.category).toLowerCase() : null,
            impact: rec.impact || null,
            effort: rec.effort || null,
            status: 'DRAFT',
            sourceType: 'tool_session',
            sourceId: toolSessionId,
          },
          { validate: false, actor: { id: userId } }
        );
        created.push({ id: result.id, title: result.title, status: result.status });
        // Guard against duplicate titles WITHIN a single request payload too.
        seenTitles.add(norm);
      } catch (err: any) {
        logger.warn('[Tools→Initiatives] initiative create failed', {
          toolSessionId,
          title,
          msg: err?.message,
        });
        skipped.push({ title, reason: 'create_failed' });
      }
    }

    // 4) Best-effort audit (mirrors ToolInitiativeService's tool-generation log).
    try {
      await auditEventsService.log({
        actorId: userId ?? undefined,
        actorType: 'USER',
        action: 'initiatives.from_tool_session',
        resourceType: 'tool_session',
        resourceId: toolSessionId,
        after: { created: created.length, skipped: skipped.length },
        organizationId: orgId,
      });
    } catch {
      /* best-effort audit */
    }

    return res.status(created.length > 0 ? 201 : 200).json({
      sessionId: toolSessionId,
      created,
      skipped,
    });
  }
);

/**
 * GET /api/initiatives/by-status/:statuses
 * Get initiatives filtered by comma-separated statuses
 * Used by Benefits module - MUST be before /:id route
 */
router.get('/by-status/:statuses', InitiativeController.getInitiativesByStatus);

/**
 * GET /api/initiatives/:id
 * Get single initiative by ID
 */
router.get('/:id', InitiativeController.getInitiativeById);

router.put('/:id/profile', requireOrgRole('OWNER', 'ADMIN'), async (req: any, res: any) => {
  try {
    const result = await updateInitiativeProfile(
      req.user.organizationId,
      req.params.id,
      req.user.id,
      {
        summary: String(req.body?.summary || ''),
        expectedVersion: Number(req.body?.expectedVersion),
        idempotencyKey: String(req.get('Idempotency-Key') || ''),
      }
    );
    return res.status(result.idempotentReplay ? 200 : 201).json(result);
  } catch (error) {
    if (error instanceof InitiativeProfileError) {
      return res.status(error.statusCode).json({ code: error.code, error: error.message });
    }
    throw error;
  }
});

/**
 * PUT /api/initiatives/:id
 * Update initiative
 */
router.put(
  '/:id',
  requireGovernedInitiativeCapability('initiative.update', { shadow: true }),
  validateBody(UpdateInitiativeSchema),
  InitiativeController.updateInitiative
);

/**
 * PATCH /api/initiatives/:id/status
 * Update initiative status
 */
router.patch(
  '/:id/status',
  requireGovernedInitiativeCapability('initiative.status.change', { shadow: true }),
  validateBody(UpdateInitiativeStatusSchema),
  InitiativeController.updateInitiativeStatus
);

/**
 * PATCH /api/initiatives/:id/quick-update
 * Quick update initiative fields
 */
router.patch(
  '/:id/quick-update',
  requireGovernedInitiativeCapability('initiative.update', { shadow: true }),
  validateBody(QuickUpdateInitiativeSchema),
  InitiativeController.quickUpdateInitiative
);

/**
 * PATCH /api/initiatives/:id
 * Backwards-compatible alias for clients that used a generic PATCH.
 *
 * - If the payload contains `status`, delegate to the canonical `/status` handler
 *   (keeps transition validation + governance rules).
 * - Otherwise, delegate to the canonical update handler (same as PUT, but accepts partial payloads).
 */
router.patch(
  '/:id',
  requireGovernedInitiativeCapability('initiative.update', { shadow: true }),
  (req, res, next) => {
    const body = (req as any)?.body || {};
    const hasStatus = body && Object.prototype.hasOwnProperty.call(body, 'status');

    if (hasStatus) {
      return (validateBody(UpdateInitiativeStatusSchema) as any)(req, res, (err?: unknown) => {
        if (err) return next(err);
        return (InitiativeController.updateInitiativeStatus as any)(req, res, next);
      });
    }

    return (validateBody(UpdateInitiativeSchema) as any)(req, res, (err?: unknown) => {
      if (err) return next(err);
      return (InitiativeController.updateInitiative as any)(req, res, next);
    });
  }
);

/**
 * DELETE /api/initiatives/:id
 * Hard-delete an initiative. Org-scoped + owner/admin authorization and
 * cascade cleanup are enforced in the controller. Lets DRAFT initiatives
 * (e.g. created via notebook convert) be discarded.
 */
router.delete(
  '/:id',
  requireOrgRole('user'),
  requireGovernedInitiativeCapability('initiative.delete', { shadow: true }),
  requireInitiativeWriteAccess(),
  InitiativeController.deleteInitiative
);

// ==========================================
// FLOW-INITIATIVE-001: STATUS TRANSITIONS
// ==========================================

/**
 * GET /api/initiatives/:id/readiness
 * Check if initiative is ready for review
 */
router.get('/:id/readiness', InitiativeController.checkReadiness);

/**
 * POST /api/initiatives/:id/submit-review
 * Submit initiative for review
 */
router.post(
  '/:id/submit-review',
  requireGovernedInitiativeCapability('initiative.submit', { shadow: true }),
  InitiativeController.submitForReview
);

/**
 * POST /api/initiatives/:id/approve
 * Approve initiative
 */
router.post(
  '/:id/approve',
  requireGovernedInitiativeCapability('initiative.approve', { shadow: true }),
  InitiativeController.approveInitiative
);

/**
 * POST /api/initiatives/:id/reject — REMOVED (H16 fix, 2026-08-01).
 *
 * rejectInitiative bypassed the canonical gate/decision engine (used the
 * legacy evaluateInitiativeGateAccess role table which over-grants PMO, wrote
 * status='planning' directly — not even VALID_TRANSITIONS[REVIEW]'s actual
 * REJECT target of DRAFT — with no decision check and no audit row). A
 * repo-wide grep (excluding node_modules) for `'/reject'` / `rejectInitiative`
 * found ZERO real callers — no UI button, no test asserting its behavior, no
 * script — confirming the same finding from an earlier caller-inventory pass.
 * The one hit was a generic route-wiring "fail-closed contract" test
 * (tests/integration/routes/pmo.initiatives.fail-closed.contract.test.ts) that
 * mocks the ENTIRE InitiativeController surface for unrelated route
 * assertions; it does not exercise this route and is unaffected by its
 * removal. Deleted per the mission's explicit instruction to prefer deletion
 * over preserving an unsafe surface once caller-absence is proven. If a
 * REJECT-style adapter is ever needed again, route it through
 * executeInitiativeTransition targeting canonical DRAFT (the real REJECT gate
 * target), the same way approveInitiative/startExecution now do.
 */

/**
 * POST /api/initiatives/:id/start-execution
 * Start execution phase
 */
router.post(
  '/:id/start-execution',
  requireGovernedInitiativeCapability('initiative.start', { shadow: true }),
  InitiativeController.startExecution
);

/**
 * POST /api/initiatives/:id/block
 * Block initiative
 */
router.post(
  '/:id/block',
  requireGovernedInitiativeCapability('initiative.block', { shadow: true }),
  InitiativeController.blockInitiative
);

/**
 * POST /api/initiatives/:id/unblock
 * Unblock initiative
 */
router.post(
  '/:id/unblock',
  requireGovernedInitiativeCapability('initiative.unblock', { shadow: true }),
  InitiativeController.unblockInitiative
);

/**
 * POST /api/initiatives/:id/complete
 * Mark initiative as done
 */
router.post(
  '/:id/complete',
  requireGovernedInitiativeCapability('initiative.complete', { shadow: true }),
  InitiativeController.completeInitiative
);

/**
 * POST /api/initiatives/:id/move
 * Move initiative to different project
 */
router.post(
  '/:id/move',
  requireGovernedInitiativeCapability('initiative.update', { shadow: true }),
  InitiativeController.moveInitiative
);

/**
 * POST /api/pmo/initiatives/bulk-assign
 * Zwornik Delta C (§5.2.2) — bulk-assign "Nieprzypisane" (project_id IS NULL,
 * surfaced via GET /?projectId=unassigned) initiatives to a project. Body:
 * { initiativeIds: string[], targetProjectId: string, moveTasks?: boolean }.
 * Declared as a literal path (not `/:id/...`) so it never collides with the
 * single-initiative routes above.
 */
router.post(
  '/bulk-assign',
  requireGovernedInitiativeCapability('initiative.update', { shadow: true }),
  InitiativeController.bulkAssignInitiatives
);

/**
 * POST /api/initiatives/:id/archive
 * Archive initiative
 */
router.post(
  '/:id/archive',
  requireGovernedInitiativeCapability('initiative.status.change', { shadow: true }),
  InitiativeController.archiveInitiative
);

// ==========================================
// V4-EXEC-04: INITIATIVE CAPACITY
// ==========================================

router.get('/:id/capacity', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const capacity = await getInitiativeCapacity(String(orgId), String(req.params.id));
    return res.json(capacity);
  } catch (err: any) {
    logger.error(
      '[M13 Initiatives] Failed to fetch initiative capacity (INITIATIVE_CAPACITY_FETCH_FAILED)',
      err
    );
    return res.status(500).json({
      error: 'Failed to fetch initiative capacity',
      message: 'An internal error occurred. Please try again later.',
      code: 'INITIATIVE_CAPACITY_FETCH_FAILED',
    });
  }
});

router.get('/:id/capacity/timeline', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const timeline = await getCapacityTimeline(String(orgId), String(req.params.id));
    return res.json({ weeks: timeline });
  } catch (err: any) {
    logger.error(
      '[M13 Initiatives] Failed to fetch capacity timeline (CAPACITY_TIMELINE_FETCH_FAILED)',
      err
    );
    return res.status(500).json({
      error: 'Failed to fetch capacity timeline',
      message: 'An internal error occurred. Please try again later.',
      code: 'CAPACITY_TIMELINE_FETCH_FAILED',
    });
  }
});

// ==========================================
// BENEFITS MODULE: KPI ENDPOINTS
// ==========================================

/**
 * GET /api/initiatives/:id/kpis
 * Get KPIs for an initiative
 */
router.get('/:id/kpis', InitiativeController.getInitiativeKpis);

/**
 * POST /api/initiatives/:id/kpis
 * Create a new KPI for an initiative
 */
router.post(
  '/:id/kpis',
  requireGovernedInitiativeCapability('kpi.update', { shadow: true }),
  InitiativeController.createInitiativeKpi
);

/**
 * PUT /api/initiatives/:id/kpis/:kpiId
 * Update KPI assignment for an initiative
 */
router.put(
  '/:id/kpis/:kpiId',
  requireGovernedInitiativeCapability('kpi.update', { shadow: true }),
  InitiativeController.updateInitiativeKpi
);

/**
 * DELETE /api/initiatives/:id/kpis/:kpiId
 * Delete KPI assignment for an initiative
 */
router.delete(
  '/:id/kpis/:kpiId',
  requireGovernedInitiativeCapability('kpi.update', { shadow: true }),
  InitiativeController.deleteInitiativeKpi
);

// ==========================================
// ROADMAP MODULE: MILESTONES ENDPOINTS
// ==========================================

/**
 * GET /api/initiatives/:id/milestones
 * Get all milestones for an initiative
 */
router.get('/:id/milestones', InitiativeController.getMilestones);

/**
 * POST /api/initiatives/:id/milestones
 * Create a new milestone for an initiative
 */
router.post(
  '/:id/milestones',
  requireGovernedInitiativeCapability('initiative.milestone.manage', { shadow: true }),
  InitiativeController.createMilestone
);

/**
 * PUT /api/initiatives/:id/milestones/:milestoneId
 * Update a milestone
 */
router.put(
  '/:id/milestones/:milestoneId',
  requireGovernedInitiativeCapability('initiative.milestone.manage', { shadow: true }),
  InitiativeController.updateMilestone
);

/**
 * DELETE /api/initiatives/:id/milestones/:milestoneId
 * Delete a milestone
 */
router.delete(
  '/:id/milestones/:milestoneId',
  requireGovernedInitiativeCapability('initiative.milestone.manage', { shadow: true }),
  InitiativeController.deleteMilestone
);

// ==========================================
// ROADMAP MODULE: SCHEDULE BASELINES (Timeline lock)
// ==========================================

/**
 * GET /api/initiatives/:id/schedule-baselines
 * List schedule baseline snapshots
 */
router.get('/:id/schedule-baselines', InitiativeController.getScheduleBaselines);

/**
 * GET /api/initiatives/:id/schedule-baselines/:version
 * Get a single baseline snapshot (by version)
 */
router.get('/:id/schedule-baselines/:version', InitiativeController.getScheduleBaseline);

// ==========================================
// ROADMAP MODULE: RESOURCES ENDPOINTS
// ==========================================

const ResourcesAiApplyLogSchema = z.object({
  scope: z.enum(['budget', 'fte', 'tools', 'intangibles', 'all']),
  budgetAdded: z.number().int().min(0),
  fteAdded: z.number().int().min(0),
  toolsAdded: z.number().int().min(0),
  intangiblesAdded: z.number().int().min(0),
  note: z.string().nullable().optional(),
});

/**
 * GET /api/initiatives/:id/resources
 * Get resources allocated to an initiative
 */
router.get('/:id/resources', InitiativeController.getResources);

/**
 * POST /api/initiatives/:id/resources
 * Add a resource to an initiative
 */
router.post(
  '/:id/resources',
  requireGovernedInitiativeCapability('initiative.resource.manage', { shadow: true }),
  InitiativeController.addResource
);

/**
 * DELETE /api/initiatives/:id/resources/:resourceId
 * Remove a resource from an initiative
 */
router.delete(
  '/:id/resources/:resourceId',
  requireGovernedInitiativeCapability('initiative.resource.manage', { shadow: true }),
  InitiativeController.deleteResource
);

/**
 * PUT /api/initiatives/:id/resources/:resourceId
 * Update a resource in an initiative
 */
router.put(
  '/:id/resources/:resourceId',
  requireGovernedInitiativeCapability('initiative.resource.manage', { shadow: true }),
  InitiativeController.updateResource
);

/**
 * POST /api/initiatives/:id/resources/ai-apply-log
 * Write a single audit entry after applying AI proposals.
 */
router.post(
  '/:id/resources/ai-apply-log',
  requireGovernedInitiativeCapability('initiative.resource.manage', { shadow: true }),
  validateBody(ResourcesAiApplyLogSchema),
  InitiativeController.logResourcesAiApply
);

// ==========================================
// V4-INIT-05: STAFFING PLANS
// ==========================================

router.get('/:id/staffing-plans', StaffingPlanController.listPlans);
router.post(
  '/:id/staffing-plans',
  requireOrgRole('user'),
  requireGovernedInitiativeCapability('initiative.staffing.manage', { shadow: true }),
  StaffingPlanController.createPlan
);
router.get('/:id/staffing-plans/:planId', StaffingPlanController.getPlan);
router.put(
  '/:id/staffing-plans/:planId',
  requireOrgRole('user'),
  requireGovernedInitiativeCapability('initiative.staffing.manage', { shadow: true }),
  StaffingPlanController.updatePlan
);
router.delete(
  '/:id/staffing-plans/:planId',
  requireOrgRole('user'),
  requireGovernedInitiativeCapability('initiative.staffing.manage', { shadow: true }),
  StaffingPlanController.deletePlan
);

router.post(
  '/:id/staffing-plans/:planId/roles',
  requireOrgRole('user'),
  requireGovernedInitiativeCapability('initiative.staffing.manage', { shadow: true }),
  StaffingPlanController.addRole
);
router.put(
  '/:id/staffing-plans/:planId/roles/:roleId',
  requireOrgRole('user'),
  requireGovernedInitiativeCapability('initiative.staffing.manage', { shadow: true }),
  StaffingPlanController.updateRole
);
router.delete(
  '/:id/staffing-plans/:planId/roles/:roleId',
  requireOrgRole('user'),
  requireGovernedInitiativeCapability('initiative.staffing.manage', { shadow: true }),
  StaffingPlanController.deleteRole
);

router.get('/:id/staffing-plans/:planId/gaps', StaffingPlanController.getGaps);
router.post(
  '/:id/staffing-plans/:planId/sync-capacity',
  requireOrgRole('user'),
  requireGovernedInitiativeCapability('initiative.staffing.manage', { shadow: true }),
  StaffingPlanController.syncCapacity
);

// ==========================================
// ROADMAP MODULE: BUDGET ITEMS ENDPOINTS
// ==========================================

/**
 * GET /api/initiatives/:id/budget-items
 * Get all budget items for an initiative
 */
router.get('/:id/budget-items', InitiativeController.getBudgetItems);

/**
 * POST /api/initiatives/:id/budget-items
 * Add a budget item to an initiative
 */
router.post(
  '/:id/budget-items',
  requireGovernedInitiativeCapability('initiative.budget.manage', { shadow: true }),
  InitiativeController.addBudgetItem
);

/**
 * PUT /api/initiatives/:id/budget-items/:itemId
 * Update a budget item
 */
router.put(
  '/:id/budget-items/:itemId',
  requireGovernedInitiativeCapability('initiative.budget.manage', { shadow: true }),
  InitiativeController.updateBudgetItem
);

/**
 * DELETE /api/initiatives/:id/budget-items/:itemId
 * Delete a budget item
 */
router.delete(
  '/:id/budget-items/:itemId',
  requireGovernedInitiativeCapability('initiative.budget.manage', { shadow: true }),
  InitiativeController.deleteBudgetItem
);

// ==========================================
// ROADMAP MODULE: TOOLS ENDPOINTS
// ==========================================

/**
 * GET /api/initiatives/:id/tools
 * Get all tools for an initiative
 */
router.get('/:id/tools', InitiativeController.getTools);

/**
 * POST /api/initiatives/:id/tools
 * Add a tool to an initiative
 */
router.post(
  '/:id/tools',
  requireGovernedInitiativeCapability('initiative.tool.manage', { shadow: true }),
  InitiativeController.addTool
);

/**
 * PUT /api/initiatives/:id/tools/:toolId
 * Update a tool
 */
router.put(
  '/:id/tools/:toolId',
  requireGovernedInitiativeCapability('initiative.tool.manage', { shadow: true }),
  InitiativeController.updateTool
);

/**
 * DELETE /api/initiatives/:id/tools/:toolId
 * Delete a tool
 */
router.delete(
  '/:id/tools/:toolId',
  requireGovernedInitiativeCapability('initiative.tool.manage', { shadow: true }),
  InitiativeController.deleteTool
);

// ==========================================
// ROADMAP MODULE: INTANGIBLE ASSETS ENDPOINTS
// ==========================================

/**
 * GET /api/initiatives/:id/intangible-assets
 * Get all intangible assets for an initiative
 */
router.get('/:id/intangible-assets', InitiativeController.getIntangibleAssets);

/**
 * POST /api/initiatives/:id/intangible-assets
 * Add an intangible asset to an initiative
 */
router.post(
  '/:id/intangible-assets',
  requireGovernedInitiativeCapability('initiative.intangible.manage', { shadow: true }),
  InitiativeController.addIntangibleAsset
);

/**
 * PUT /api/initiatives/:id/intangible-assets/:assetId
 * Update an intangible asset
 */
router.put(
  '/:id/intangible-assets/:assetId',
  requireGovernedInitiativeCapability('initiative.intangible.manage', { shadow: true }),
  InitiativeController.updateIntangibleAsset
);

/**
 * DELETE /api/initiatives/:id/intangible-assets/:assetId
 * Delete an intangible asset
 */
router.delete(
  '/:id/intangible-assets/:assetId',
  requireGovernedInitiativeCapability('initiative.intangible.manage', { shadow: true }),
  InitiativeController.deleteIntangibleAsset
);

// ==========================================
// P0: RAID / Stakeholders / Watchers / History
// ==========================================

router.get('/:id/stakeholders', InitiativeController.getStakeholders);
router.post(
  '/:id/stakeholders',
  requireGovernedInitiativeCapability('initiative.stakeholder.manage', { shadow: true }),
  InitiativeController.addStakeholder
);
router.delete(
  '/:id/stakeholders/:stakeholderId',
  requireGovernedInitiativeCapability('initiative.stakeholder.manage', { shadow: true }),
  InitiativeController.deleteStakeholder
);

router.get('/:id/watchers', InitiativeController.getWatchers);
router.post(
  '/:id/watchers',
  requireGovernedInitiativeCapability('initiative.watcher.manage', { shadow: true }),
  InitiativeController.addWatcher
);
router.delete(
  '/:id/watchers/:watcherId',
  requireGovernedInitiativeCapability('initiative.watcher.manage', { shadow: true }),
  InitiativeController.deleteWatcher
);

router.get('/:id/raid', InitiativeController.getRaid);
router.post(
  '/:id/raid',
  requireGovernedInitiativeCapability('initiative.raid.manage', { shadow: true }),
  InitiativeController.createRaidItem
);
router.patch(
  '/:id/raid/:raidId',
  requireGovernedInitiativeCapability('initiative.raid.manage', { shadow: true }),
  InitiativeController.updateRaidItem
);
router.delete(
  '/:id/raid/:raidId',
  requireGovernedInitiativeCapability('initiative.raid.manage', { shadow: true }),
  InitiativeController.deleteRaidItem
);

router.get('/:id/history', InitiativeController.getHistory);

// ==========================================
// INITIATIVE COMMENTS
// ==========================================

router.get('/:id/comments', InitiativeController.getInitiativeComments);
router.post(
  '/:id/comments',
  requireGovernedInitiativeCapability('initiative.comment', { shadow: true }),
  InitiativeController.addInitiativeComment
);
router.delete(
  '/:id/comments/:commentId',
  requireGovernedInitiativeCapability('initiative.comment', { shadow: true }),
  InitiativeController.deleteInitiativeComment
);

// ==========================================
// INITIATIVE TASK DEPENDENCIES (aggregated)
// ==========================================

/**
 * GET /api/initiatives/:id/task-dependencies
 * Aggregate task dependencies within the initiative (for Dependencies section).
 */
router.get('/:id/task-dependencies', InitiativeController.getInitiativeTaskDependencies);

// ==========================================
// Gate Roles & Governance
// ==========================================

router.get('/:id/gate-roles', InitiativeController.getGateRoles);
router.put(
  '/:id/gate-roles',
  requireGovernedInitiativeCapability('initiative.gate_role.manage', { shadow: true }),
  InitiativeController.updateGateRoles
);

/**
 * POST /api/initiatives/:id/lifecycle-gate-decisions
 *
 * INI-MVP-GATE-001: mounted writer for the canonical
 * `initiative_lifecycle_gate_decisions` owner (T01/U03). Records a human
 * GO (`decisionStatus: 'approved'`) or NO-GO (`'rejected'`) lifecycle gate
 * decision by delegating to the existing, unmodified
 * `recordInitiativeLifecycleGateDecision()` — this route does no SQL of its
 * own. That function already enforces: an active in-tenant human actor, an
 * exact-scope A05 approval receipt, tenant-scoped Case→Initiative lineage,
 * an un-expired deadline, and idempotent-replay-safe writes guarded by a
 * transaction-scoped advisory lock + `UNIQUE(organization_id,
 * idempotency_key)` — so a retry of the same key returns the SAME decision
 * row rather than creating a second one, and two concurrent submissions of
 * the same key serialize to exactly one row. The table's own DB trigger
 * forbids UPDATE/DELETE; every reversal is therefore a NEW row chained via
 * `supersedesDecisionId`, which the underlying function computes — never a
 * mutation of an existing row.
 *
 * Tenant scope (`organizationId`) and the acting human
 * (`humanActorUserId`) come ONLY from the authenticated session — never from
 * the request body — so a caller cannot record a decision for, or as, a
 * different organization/user by forging body fields.
 *
 * Capability: FAILS CLOSED. Reuses `evaluateInitiativeGateAccess` (the same
 * admin/role allowlist that already gates initiative APPROVE/REJECT
 * governance elsewhere in this codebase — `initiativeGovernanceGuard.ts`),
 * mapping `decisionStatus: 'approved' -> APPROVE` / `'rejected' -> REJECT`.
 * That evaluator itself fails closed when it cannot resolve access ("Fail
 * closed: if we cannot resolve the access context, deny the gate."); this
 * handler additionally treats ANY error thrown while resolving access as a
 * deny, so an unexpected failure can never fall through to an allow. This is
 * deliberately NOT `requireGovernedInitiativeCapability(..., { shadow: true })` —
 * that helper's shadow mode (used elsewhere in this file) is telemetry-only
 * and, even without `shadow`, silently ALLOWS every caller unless the
 * `EFFECTIVE_ACCESS_ENFORCE`/`EFFECTIVE_ACCESS_SHADOW` env flags happen to be
 * set — the opposite of fail-closed this endpoint requires.
 *
 * Body: RecordInitiativeLifecycleGateDecisionInput minus organizationId/
 * humanActorUserId (see above). `initiativeId` comes from the path.
 */
const LifecycleGateDecisionSchema = z.object({
  transformationCaseId: z.string().trim().min(1).max(255),
  pmoDomain: z.enum(INITIATIVE_LIFECYCLE_GATE_DOMAINS),
  decisionStatus: z.enum(['approved', 'rejected']),
  sourceDigest: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[0-9a-f]{64}$/, 'sourceDigest must be a SHA-256 hex digest'),
  sourceCaseVersion: z.number().int().min(1),
  baselineRefs: z.array(z.string().trim().min(1)).min(1).max(200),
  a05ProposalVersionId: z.string().trim().min(1).max(255),
  a05ApprovalReceiptRef: z.string().trim().min(1).max(255),
  humanAuthorityRef: z.string().trim().min(1).max(255),
  rationale: z.string().trim().min(1).max(4000),
  deadlineAt: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1).max(255),
});

router.post(
  '/:id/lifecycle-gate-decisions',
  requireOrgRole('user'),
  validateBody(LifecycleGateDecisionSchema),
  async (req: any, res: any) => {
    const orgId = req.user?.organizationId;
    const actorUserId = req.user?.id;
    if (!orgId || !actorUserId) return res.status(401).json({ error: 'Unauthorized' });

    const initiativeId = String(req.params.id || '').trim();
    if (!initiativeId) {
      return res
        .status(400)
        .json({ error: 'initiative id is required', code: 'INITIATIVE_ID_REQUIRED' });
    }

    const governanceGate: 'APPROVE' | 'REJECT' =
      req.body.decisionStatus === 'approved' ? 'APPROVE' : 'REJECT';

    let access: any;
    try {
      access = await evaluateInitiativeGateAccess({
        organizationId: String(orgId),
        initiativeId,
        userId: String(actorUserId),
        gate: governanceGate,
        systemRoleHint: req.user?.role ?? null,
        isSuperAdmin: req.user?.isSuperAdmin === true,
      });
    } catch (accessErr) {
      // FAIL CLOSED: any error resolving governance access denies the write —
      // never falls through to an allow.
      logger.error('[M13 Initiatives] lifecycle gate access check failed', accessErr);
      return res.status(403).json({
        error: 'Unable to verify governance authority for this gate decision',
        code: 'INITIATIVE_GATE_DECISION_ACCESS_CHECK_FAILED',
      });
    }
    if (!access.allowed) {
      return res.status(403).json({ error: access.reason, code: access.code });
    }

    try {
      const result = await queryHelpers.withPgTransaction((client) =>
        recordInitiativeLifecycleGateDecision(client, {
          organizationId: String(orgId),
          initiativeId,
          transformationCaseId: req.body.transformationCaseId,
          pmoDomain: req.body.pmoDomain,
          decisionStatus: req.body.decisionStatus,
          sourceDigest: req.body.sourceDigest,
          sourceCaseVersion: req.body.sourceCaseVersion,
          baselineRefs: req.body.baselineRefs,
          a05ProposalVersionId: req.body.a05ProposalVersionId,
          a05ApprovalReceiptRef: req.body.a05ApprovalReceiptRef,
          humanActorUserId: String(actorUserId),
          humanAuthorityRef: req.body.humanAuthorityRef,
          rationale: req.body.rationale,
          deadlineAt: req.body.deadlineAt,
          idempotencyKey: req.body.idempotencyKey,
        })
      );
      return res.status(result.idempotentReplay ? 200 : 201).json({
        decision: result.decision,
        idempotentReplay: result.idempotentReplay,
      });
    } catch (err: any) {
      if (err instanceof InitiativeLifecycleGateDecisionError) {
        return res.status(err.statusCode).json({ error: err.message, code: err.code });
      }
      return failInitiative500(
        res,
        'Failed to record initiative lifecycle gate decision',
        'INITIATIVE_GATE_DECISION_WRITE_FAILED',
        err
      );
    }
  }
);

router.post('/similar-check', InitiativeController.checkSimilarInitiatives);
router.post('/validate-card', InitiativeController.validateCard);
router.post('/:id/gate-ai-check', InitiativeController.getGateAiCheck);
router.get('/:id/linked-items', InitiativeController.getLinkedItems);
router.post(
  '/:id/linked-items',
  requireGovernedInitiativeCapability('initiative.link.manage', { shadow: true }),
  InitiativeController.addLinkedItem
);
router.delete(
  '/:id/linked-items/:linkId',
  requireGovernedInitiativeCapability('initiative.link.manage', { shadow: true }),
  InitiativeController.removeLinkedItem
);
router.get('/:id/gate-readiness-check', InitiativeController.getGateReadinessCheck);
router.get('/:id/status-history', InitiativeController.getStatusHistory);

export default router;
