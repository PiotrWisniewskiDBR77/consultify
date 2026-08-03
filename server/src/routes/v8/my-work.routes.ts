import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { z, ZodError } from 'zod';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import { InboxAiAssistItemSchema, runInboxAiAssist } from '../../services/inboxAiAssistService.js';
import inboxService from '../../services/inboxService.js';
import {
  applyGovernedBulkInboxTriage,
  applyGovernedInboxTriage,
  VALID_INBOX_TRIAGE_ACTIONS,
} from '../../services/inboxTriageService.js';
import {
  addNotebookAttachmentsToPage,
  NotebookAttachmentMutationError,
  parseNotebookAttachments,
  removeNotebookAttachmentFromPage,
  resolveNotebookAttachmentFile,
  toPublicNotebookAttachments,
} from '../../services/notebookAttachmentService.js';
import {
  convertNotebookPage,
  NotebookConversionError,
} from '../../services/notebookConversionService.js';
import notebookService from '../../services/notebookService.js';
import {
  resolveStoredNotebookSourceFile,
  toPublicNotebookCaptureMetadata,
} from '../../services/notebookSourceFileService.js';
import * as myWorkRoofService from '../../services/v8/myWorkRoofService.js';
import { materializeInstances } from '../../services/v8/recurrenceEngine.js';
import type {
  CalendarPhaseName,
  CalendarPhaseStatus,
  HomeBlockName,
  MaturityLevel,
} from '../../types/myWorkRoofPackage.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getTableColumns } from '../../utils/dbSchema.js';
import { decodeHtmlEntities, deepDecodeHtmlEntities } from '../../utils/htmlEntities.js';
import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';

const router = Router();
const notebookCaptureUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});
const notebookAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
});

/** B-05: V8 envelope for governed canonical inbox (V4-INBX-01) intake surface. */
const V8_INBOX_CANONICAL_CONTRACT = 'my_work_inbox_canonical_v1';
const V8_INBOX_TRIAGE_MUTATION_CONTRACT = 'my_work_inbox_triage_mutation_v1';
const V8_INBOX_CLOSE_BY_TASK_CONTRACT = 'my_work_inbox_close_by_task_v1';
const V8_INBOX_AI_ASSIST_CONTRACT = 'my_work_inbox_ai_assist_v1';
const V8_NOTEBOOK_CONTRACT = 'my_work_notebook_v1';
const V8_CALENDAR_CONTRACT = 'my_work_calendar_v1';
const notebookProposalSchema = z.object({
  proposalType: z.enum(['insert', 'replace', 'append']),
  blockContent: z.record(z.string(), z.unknown()),
  rationale: z.string().max(2000),
});

async function requireCanonicalInboxTable(res: Response): Promise<boolean> {
  const isTestGateway =
    process.env.NODE_ENV === 'test' ||
    process.env.E2E_MODE === 'true' ||
    process.env.ENABLE_TEST_GATEWAY === 'true';
  const mockDbEnabled =
    process.env.MOCK_DB === 'true' ||
    (process.env.NODE_ENV === 'test' &&
      process.env.RUN_DB_TESTS !== '1' &&
      process.env.MOCK_DB !== 'false');

  if (isTestGateway && mockDbEnabled) {
    return true;
  }

  const cols = await getTableColumns('canonical_inbox_items');
  if (!cols || cols.size === 0) {
    res.status(503).json({
      statusCode: 503,
      status: false,
      type: 'not_configured',
      message: 'Service temporarily unavailable due to missing configuration',
    });
    return false;
  }
  return true;
}

async function requireInboxTriageTables(res: Response): Promise<boolean> {
  const isTestGateway =
    process.env.NODE_ENV === 'test' ||
    process.env.E2E_MODE === 'true' ||
    process.env.ENABLE_TEST_GATEWAY === 'true';
  const mockDbEnabled =
    process.env.MOCK_DB === 'true' ||
    (process.env.NODE_ENV === 'test' &&
      process.env.RUN_DB_TESTS !== '1' &&
      process.env.MOCK_DB !== 'false');

  if (isTestGateway && mockDbEnabled) {
    return true;
  }

  const triageCols = await getTableColumns('my_work_inbox_triage');
  const focusCols = await getTableColumns('my_work_focus_state');
  if (!triageCols?.size || !focusCols?.size) {
    res.status(503).json({
      statusCode: 503,
      status: false,
      type: 'not_configured',
      message: 'Service temporarily unavailable due to missing configuration',
    });
    return false;
  }

  return true;
}

async function requireNotebookPagesTable(res: Response): Promise<boolean> {
  const isTestGateway =
    process.env.NODE_ENV === 'test' ||
    process.env.E2E_MODE === 'true' ||
    process.env.ENABLE_TEST_GATEWAY === 'true';
  const mockDbEnabled =
    process.env.MOCK_DB === 'true' ||
    process.env.E2E_MOCK_DB === 'true' ||
    (process.env.NODE_ENV === 'test' &&
      process.env.RUN_DB_TESTS !== '1' &&
      process.env.MOCK_DB !== 'false');

  // Mock/test gateways often do not expose schema introspection reliably.
  // Skip table-introspection gating there to avoid false 503s.
  if (isTestGateway && mockDbEnabled) {
    return true;
  }

  const cols = await getTableColumns('notebook_pages');
  if (!cols?.size) {
    res.status(503).json({
      error: 'Notebook pages table is not configured',
      code: 'NOTEBOOK_TABLE_NOT_CONFIGURED',
    });
    return false;
  }
  return true;
}

async function getNotebookPageColumns(): Promise<Set<string>> {
  return getTableColumns('notebook_pages');
}

function notebookSelectExpr(
  cols: Set<string>,
  tableAlias: string,
  column: string,
  alias: string,
  fallbackSql: string
): string {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  return cols.has(column) ? `${prefix}${column} as ${alias}` : `${fallbackSql} as ${alias}`;
}

function buildNotebookSelectFields(cols: Set<string>, tableAlias = 'np'): string {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  return [
    `${prefix}id`,
    `${prefix}owner_user_id as "ownerUserId"`,
    `${prefix}organization_id as "organizationId"`,
    `${prefix}project_id as "projectId"`,
    `${prefix}visibility`,
    `${prefix}title`,
    `${prefix}content_json as "contentJson"`,
    `${prefix}content_text as "contentText"`,
    `${prefix}tags_json as tags`,
    notebookSelectExpr(cols, tableAlias, 'maturity', 'maturity', `'seed'`),
    notebookSelectExpr(cols, tableAlias, 'icon', 'icon', 'NULL'),
    notebookSelectExpr(cols, tableAlias, 'summary', 'summary', 'NULL'),
    notebookSelectExpr(cols, tableAlias, 'status', 'status', `'active'`),
    cols.has('pinned') ? `coalesce(${prefix}pinned, 0) as pinned` : `0 as pinned`,
    cols.has('verification_status')
      ? `coalesce(${prefix}verification_status, 'unverified') as "verificationStatus"`
      : `'unverified' as "verificationStatus"`,
    cols.has('review_cadence')
      ? `coalesce(${prefix}review_cadence, 'monthly') as "reviewCadence"`
      : `'monthly' as "reviewCadence"`,
    notebookSelectExpr(cols, tableAlias, 'stale_at', '"staleAt"', 'NULL'),
    notebookSelectExpr(cols, tableAlias, 'last_reviewed_at', '"lastReviewedAt"', 'NULL'),
    notebookSelectExpr(cols, tableAlias, 'capture_source', '"captureSource"', 'NULL'),
    notebookSelectExpr(cols, tableAlias, 'capture_metadata', '"captureMetadataJson"', 'NULL'),
    cols.has('attachments_json')
      ? `${prefix}attachments_json as "attachmentsJson"`
      : `'[]' as "attachmentsJson"`,
    notebookSelectExpr(cols, tableAlias, 'converted_to_json', '"convertedToJson"', 'NULL'),
    `${prefix}created_at as "createdAt"`,
    `${prefix}updated_at as "updatedAt"`,
  ].join(',\n          ');
}

function classifyNotebookSuggestion(input: { title?: string | null; contentText?: string | null }) {
  const text = String(input.contentText || input.title || '').toLowerCase();

  let suggestedType = 'none';
  let reason = '';

  const decisionKeywords = [
    'decide',
    'decision',
    'approve',
    'reject',
    'choose',
    'option',
    'alternative',
    'decyzja',
    'zdecydować',
    'opcja',
  ];
  const taskKeywords = [
    'todo',
    'action',
    'implement',
    'fix',
    'create',
    'build',
    'do',
    'task',
    'step',
    'zadanie',
    'zrobić',
    'naprawić',
  ];
  const ideaKeywords = [
    'idea',
    'concept',
    'what if',
    'imagine',
    'brainstorm',
    'explore',
    'pomysł',
    'koncept',
  ];

  const decisionScore = decisionKeywords.filter((keyword) => text.includes(keyword)).length;
  const taskScore = taskKeywords.filter((keyword) => text.includes(keyword)).length;
  const ideaScore = ideaKeywords.filter((keyword) => text.includes(keyword)).length;

  const actionItemCount = (
    text.match(/[-•]\s*(create|fix|update|send|review|check|build|implement|add|remove)/gi) || []
  ).length;

  if (actionItemCount >= 2) {
    suggestedType = 'tasks';
    reason = `Found ${actionItemCount} action items`;
  } else if (decisionScore > taskScore && decisionScore > ideaScore && decisionScore >= 2) {
    suggestedType = 'decision';
    reason = 'Contains decision-related language';
  } else if (taskScore > decisionScore && taskScore > ideaScore && taskScore >= 2) {
    suggestedType = 'task';
    reason = 'Contains task-oriented language';
  } else if (ideaScore >= 2) {
    suggestedType = 'idea';
    reason = 'Contains exploratory/idea language';
  }

  return { suggestedType, reason };
}

const parseTagsArray = (input: unknown): string[] => {
  if (Array.isArray(input)) {
    return input
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .slice(0, 50);
  }

  if (typeof input === 'string' && input.trim()) {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        return parsed
          .map((value) => String(value || '').trim())
          .filter(Boolean)
          .slice(0, 50);
      }
    } catch {
      return input
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 50);
    }
  }

  return [];
};

const safeJsonString = (value: unknown, fallback: string) => {
  try {
    if (value === undefined) return fallback;
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
};

const parseConvertedTo = (raw: string | null | undefined) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const parseCaptureMetadata = (raw: string | null | undefined) =>
  toPublicNotebookCaptureMetadata(raw);
const parseAttachments = (raw: string | null | undefined) => toPublicNotebookAttachments(raw);

const parseNotebookContent = (raw: string | null | undefined) => {
  try {
    return raw ? JSON.parse(raw) : { type: 'doc', content: [] };
  } catch {
    return { type: 'doc', content: [] };
  }
};

const formatNotebookRow = (row: any) => ({
  ...row,
  tags: parseTagsArray(row?.tags),
  pinned: Boolean(row?.pinned),
  verificationStatus: row?.verificationStatus ?? 'unverified',
  reviewCadence: row?.reviewCadence ?? 'monthly',
  staleAt: row?.staleAt ?? null,
  lastReviewedAt: row?.lastReviewedAt ?? null,
  captureSource: row?.captureSource ?? null,
  captureMetadata: parseCaptureMetadata(row?.captureMetadataJson),
  attachments: parseAttachments(row?.attachmentsJson),
  convertedTo: parseConvertedTo(row?.convertedToJson),
  convertedToJson: undefined,
  captureMetadataJson: undefined,
  attachmentsJson: undefined,
  contentJson: parseNotebookContent(row?.contentJson),
});

async function canAccessNotebookRow(userId: string, orgId: string, row: any): Promise<boolean> {
  if (!row) return false;
  if (String(row.organization_id || row.organizationId || '') !== String(orgId)) return false;

  const visibility = String(row.visibility || 'private').toLowerCase();
  const ownerId = String(row.owner_user_id || row.ownerUserId || '');
  const projectId = row.project_id || row.projectId || null;

  if (visibility === 'private') {
    return ownerId === String(userId);
  }

  if (visibility === 'project' && projectId) {
    if (ownerId === String(userId)) return true;
    const member = await queryHelpers.queryOne<{ ok: number }>(
      `SELECT 1 as ok FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1`,
      [projectId, userId]
    );
    return Boolean(member);
  }

  return ownerId === String(userId);
}

const toDateOnly = (value: unknown): string | null => {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    // MW-07 acceptance correction. An earlier revision of this helper switched
    // to LOCAL getters on the premise that these are `timestamp without time
    // zone` columns. They are not: `tasks.due_date` (and the sibling date
    // columns read here) are `timestamp WITH time zone` — verified with
    // `information_schema.columns` on a database migrated purely by
    // `db:migrate:strict`, and the app never issues `SET TIME ZONE`, so the
    // session TimeZone is the server default (`Etc/UTC`). Writing the
    // date-only string `'2026-03-05'` therefore stores exactly
    // `2026-03-05 00:00:00+00`, and node-pg hands back that same absolute
    // instant. UTC getters recover the intended calendar day in EVERY process
    // timezone; local getters only agree when the process offset is >= 0 and
    // silently shift the day back by one anywhere west of UTC (measured:
    // America/Los_Angeles read 2026-03-05 back as 2026-03-04, which turned
    // this file's own two-timezone gate red 5/10).
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const dateOnly = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dateOnly) ? dateOnly : null;
};

const addDaysDateOnly = (dateOnly: string, days: number): string => {
  const date = new Date(`${dateOnly}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateOnly;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

function handleMyWorkRoofError(
  err: unknown,
  res: Response,
  fallbackMessage: string
): Response | null {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: fallbackMessage,
      code: 'VALIDATION_ERROR',
      details: err.issues,
    });
  }

  if (err instanceof Error && err.message.toLowerCase().includes('not found')) {
    return res.status(404).json({
      error: 'Resource not found',
      code: 'RESOURCE_NOT_FOUND',
    });
  }

  return null;
}

type DerivedHomeBlockTruth = {
  blockName: HomeBlockName;
  maturityLevel: MaturityLevel;
  serviceRef: string | null;
  rationale: string;
};

type DerivedCalendarPhaseTruth = {
  phaseName: CalendarPhaseName;
  status: CalendarPhaseStatus;
  blockedBy: string | null;
  rationale: string;
};

const DERIVED_HOME_BLOCKS: DerivedHomeBlockTruth[] = [
  {
    blockName: 'aiPulseCore',
    maturityLevel: 'backed_by_real_service',
    serviceRef: 'radarService',
    rationale: 'Hero briefing is live and backed by governed Radar runtime.',
  },
  {
    blockName: 'momentum',
    maturityLevel: 'backed_by_real_service',
    serviceRef:
      'executionVisibilityService.rollupSignals + planningContinuityService.getPendingDecisions + inboxService.getInboxStats',
    rationale:
      'Momentum now surfaces governed execution-signal, decision-chain, and inbox-follow-through truth directly on the aggregated Home V2 surface instead of relying only on stitched ideas/tasks narrative.',
  },
  {
    blockName: 'sparkField',
    maturityLevel: 'backed_by_real_service',
    serviceRef: 'artifactRegistryService + notebook_pages + ideas/task linkage reads',
    rationale:
      'Spark Field now surfaces visible persisted notebook, artifact-output, and idea-to-task linkage summary on the Home V2 surface instead of acting only as a stitched list of idea and note cards.',
  },
  {
    blockName: 'decisionTemperature',
    maturityLevel: 'backed_by_real_service',
    serviceRef: 'planningContinuityService.getPendingDecisions + home/v2 decisions/tasks',
    rationale:
      'Decision Temperature now surfaces governed pending-decision-chain depth from planningContinuityService on top of live decisions and overdue-task pressure in Home V2.',
  },
  {
    blockName: 'industryLens',
    maturityLevel: 'backed_by_real_service',
    serviceRef: 'radarService',
    rationale: 'External transformation signals are live through Radar-backed Home sections.',
  },
  {
    blockName: 'executionCurrent',
    maturityLevel: 'backed_by_real_service',
    serviceRef: 'executionVisibilityService.rollupSignals + artifactRegistryService',
    rationale:
      'Execution Current now reads governed execution-signal depth from executionVisibilityService alongside the live outputs bridge on the aggregated Home V2 surface.',
  },
  {
    blockName: 'teamSignal',
    maturityLevel: 'backed_by_real_service',
    serviceRef: 'collaborationRoomService.getActiveRoomsByOrg/getRoomHealth',
    rationale:
      'Team Signal now surfaces governed collaboration-room depth through collaborationRoomService, while still blending narrative scaffolding and peer tips on the Home V2 surface.',
  },
  {
    blockName: 'commandDock',
    maturityLevel: 'backed_by_real_service',
    serviceRef: 'inboxService.getInboxStats + artifactRegistryService',
    rationale:
      'Command Dock now surfaces governed inbox and outputs runtime summary alongside the existing app/chat action bridge on the Home V2 surface.',
  },
];

const DERIVED_CALENDAR_PHASES: DerivedCalendarPhaseTruth[] = [
  {
    phaseName: 'phase_a_internal',
    status: 'active',
    blockedBy: null,
    rationale:
      'Internal MyWork calendar hardening can proceed independently of connector delivery.',
  },
  {
    phaseName: 'phase_b_external_sync',
    status: 'blocked',
    blockedBy: 'wave5_connector_platform',
    rationale: 'External Google/Outlook sync remains blocked on Wave 5 connector delivery.',
  },
];

function buildSummaryCounts(
  blocks: Array<{ maturityLevel: MaturityLevel }>
): Record<MaturityLevel, number> {
  return blocks.reduce<Record<MaturityLevel, number>>(
    (acc, block) => {
      acc[block.maturityLevel] += 1;
      return acc;
    },
    {
      backed_by_real_service: 0,
      partial_stitched: 0,
      placeholder_non_canonical: 0,
    }
  );
}

router.put(
  '/objects/:objectId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);

    try {
      const data = await myWorkRoofService.setCanonicalObjectState({
        ...req.body,
        objectId: req.params.objectId,
        organizationId,
      });
      return res.json({ data, meta: { version: 'v8' } });
    } catch (err) {
      const handled = handleMyWorkRoofError(err, res, 'Invalid canonical object state parameters');
      if (handled) return handled;
      throw err;
    }
  })
);

router.get(
  '/objects/:objectId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const data = await myWorkRoofService.getCanonicalObjectState(
      req.params.objectId,
      organizationId
    );

    if (!data) {
      return res.status(404).json({
        error: `Canonical object ${req.params.objectId} not found`,
        code: 'OBJECT_NOT_FOUND',
      });
    }

    return res.json({ data, meta: { version: 'v8' } });
  })
);

router.put(
  '/objects/:objectId/projections/:surface',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);

    try {
      const data = await myWorkRoofService.updateSurfaceProjection({
        ...req.body,
        objectId: req.params.objectId,
        organizationId,
        surface: req.params.surface as any,
      });

      if (!data) {
        return res.status(404).json({
          error: `Canonical object ${req.params.objectId} not found`,
          code: 'OBJECT_NOT_FOUND',
        });
      }

      return res.json({ data, meta: { version: 'v8' } });
    } catch (err) {
      const handled = handleMyWorkRoofError(err, res, 'Invalid surface projection parameters');
      if (handled) return handled;
      throw err;
    }
  })
);

router.get(
  '/objects/:objectId/projections/:surface',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const data = await myWorkRoofService.getSurfaceProjection(
      req.params.objectId,
      req.params.surface as any,
      organizationId
    );

    if (!data) {
      return res.status(404).json({
        error: `Projection ${req.params.surface} for object ${req.params.objectId} not found`,
        code: 'PROJECTION_NOT_FOUND',
      });
    }

    return res.json({ data, meta: { version: 'v8' } });
  })
);

/**
 * GET /api/v8/my-work/inbox/canonical
 * Canonical inbox rows (persistent materialization table) for the V8 org + user.
 */
router.get(
  '/inbox/canonical',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    if (!(await requireCanonicalInboxTable(res))) return;

    const filters = {
      section: req.query.section ? String(req.query.section) : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
      priority: req.query.priority ? String(req.query.priority) : undefined,
      slaStatus: req.query.slaStatus ? String(req.query.slaStatus) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    };

    const items = await inboxService.getInboxItems(userId, organizationId, filters);
    return res.json({
      data: { items },
      meta: { version: 'v8', contract: V8_INBOX_CANONICAL_CONTRACT },
    });
  })
);

/**
 * GET /api/v8/my-work/inbox/canonical/stats
 * Aggregate counts for canonical inbox items (section / SLA / priority / status).
 */
router.get(
  '/inbox/canonical/stats',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    if (!(await requireCanonicalInboxTable(res))) return;

    const stats = await inboxService.getInboxStats(userId, organizationId);
    return res.json({
      data: stats,
      meta: { version: 'v8', contract: V8_INBOX_CANONICAL_CONTRACT },
    });
  })
);

/**
 * POST /api/v8/my-work/inbox/canonical/materialize
 * Re-materialize canonical_inbox_items from tasks, decisions, and notifications (intake).
 */
router.post(
  '/inbox/canonical/materialize',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    if (!(await requireCanonicalInboxTable(res))) return;

    const result = await inboxService.materializeInboxItems(userId, organizationId);
    return res.status(201).json({
      data: { success: true, ...result },
      meta: { version: 'v8', contract: V8_INBOX_CANONICAL_CONTRACT },
    });
  })
);

/**
 * POST /api/v8/my-work/inbox/tasks/:taskId/close
 *
 * Golden-flow Inbox close, keyed by the Task (source of truth) rather than
 * the inbox item id — this is Step 2 of the
 * Task-assigned → Inbox item → accept/in-progress → Inbox closes flow.
 *
 * Task is the source of truth; this route never trusts a client-supplied
 * status/ownership claim — it always re-reads the task from the DB and
 * derives userId/organizationId from the server auth context (getV8Context),
 * never from the request body. Sits behind the router-level v8OrgGate, so a
 * non-V8-enabled org already gets a 404 V8_ORG_DISABLED before reaching this
 * handler — that IS the required fail-closed "unsupported for this org"
 * response; there is no legacy-Inbox fallback here.
 *
 * Safely retriable: closeInboxItemForSource() is idempotent (not_materialized
 * / already_closed / closed), so calling this again after a 500
 * INBOX_CLOSE_RECOVERY_REQUIRED response either succeeds or returns
 * already_closed — never a duplicate side effect, never a second error on
 * "already handled."
 */
router.post(
  '/inbox/tasks/:taskId/close',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    if (!(await requireCanonicalInboxTable(res))) return;

    const { taskId } = req.params;
    const expectedStatus =
      typeof req.body?.expectedStatus === 'string' ? req.body.expectedStatus : undefined;

    const task = await queryHelpers.queryOne<{
      id: string;
      organization_id: string;
      assignee_id: string | null;
      owner_id: string | null;
      status: string | null;
    }>(
      `SELECT id, organization_id, assignee_id, owner_id, status
       FROM tasks WHERE id = ? AND organization_id = ?`,
      [taskId, organizationId]
    );

    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
        code: 'INBOX_CLOSE_TASK_NOT_FOUND',
      });
    }

    const isOwnerOrAssignee = task.assignee_id === userId || task.owner_id === userId;
    if (!isOwnerOrAssignee) {
      return res.status(403).json({
        error: 'Only the task assignee/owner may close its inbox item',
        code: 'INBOX_CLOSE_FORBIDDEN',
      });
    }

    if (expectedStatus !== undefined && String(task.status || '') !== expectedStatus) {
      return res.status(409).json({
        error: "Task status has changed since the caller's expectedStatus was read",
        code: 'INBOX_CLOSE_STATE_MISMATCH',
        currentStatus: task.status,
      });
    }

    // From here on, the Task transition (Step 1, PUT /api/tasks/:id) is
    // assumed already committed by the caller — a failure past this point is
    // a close-mutation failure, not a task-transition failure, and must be
    // reported honestly as recovery-required rather than silently swallowed.
    try {
      const result = await inboxService.closeInboxItemForSource(
        userId,
        organizationId,
        'task',
        taskId,
        { closedVia: V8_INBOX_CLOSE_BY_TASK_CONTRACT, taskStatus: task.status }
      );

      return res.json({
        data: {
          success: true,
          taskId,
          status: result.status,
          inboxItem: result.item,
        },
        meta: { version: 'v8', contract: V8_INBOX_CLOSE_BY_TASK_CONTRACT },
      });
    } catch (err: any) {
      logger.error('[v8/my-work] Inbox close-by-task failed after task read', {
        taskId,
        organizationId,
        error: err?.message,
      });
      return res.status(500).json({
        error:
          'Task update succeeded but closing its inbox item failed. Retry this call — it is safe to repeat.',
        code: 'INBOX_CLOSE_RECOVERY_REQUIRED',
      });
    }
  })
);

router.post(
  '/inbox/:itemId/triage',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    if (!(await requireCanonicalInboxTable(res))) return;
    if (!(await requireInboxTriageTables(res))) return;

    const action = String(req.body?.action || '');
    const itemKey = String(req.body?.itemKey || req.body?._key || req.query.itemKey || '');
    const params = (req.body?.params || undefined) as Record<string, unknown> | undefined;
    const fromAISuggestion = Boolean(req.body?.fromAISuggestion);
    const confidence = typeof req.body?.confidence === 'number' ? req.body.confidence : undefined;

    if (!VALID_INBOX_TRIAGE_ACTIONS.includes(action as any)) {
      return res.status(400).json({ error: 'Invalid action', code: 'INBOX_TRIAGE_ACTION_INVALID' });
    }
    if (!itemKey || !itemKey.includes(':')) {
      return res.status(400).json({
        error: 'Missing itemKey (expected task:<id> | decision:<id> | notification:<id>)',
        code: 'INBOX_TRIAGE_ITEM_KEY_REQUIRED',
      });
    }

    const data = await applyGovernedInboxTriage({
      userId,
      organizationId,
      itemId: req.params.itemId,
      itemKey,
      action: action as any,
      params,
      fromAISuggestion,
      confidence,
    });

    return res.json({
      data,
      meta: { version: 'v8', contract: V8_INBOX_TRIAGE_MUTATION_CONTRACT },
    });
  })
);

router.post(
  '/inbox/bulk-triage',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    if (!(await requireCanonicalInboxTable(res))) return;
    if (!(await requireInboxTriageTables(res))) return;

    const action = String(req.body?.action || '');
    const params = (req.body?.params || undefined) as Record<string, unknown> | undefined;
    const itemKeys = Array.isArray(req.body?.itemKeys)
      ? req.body.itemKeys.map((value: unknown) => String(value)).filter(Boolean)
      : [];
    const items = Array.isArray(req.body?.items)
      ? req.body.items
          .map((row: any) => ({
            itemId: typeof row?.itemId === 'string' ? row.itemId : undefined,
            itemKey: typeof row?.itemKey === 'string' ? row.itemKey : '',
          }))
          .filter((row: { itemId?: string; itemKey: string }) => Boolean(row.itemKey))
      : undefined;
    const aiItems = Array.isArray(req.body?.aiItems)
      ? req.body.aiItems
          .map((row: any) => ({
            itemKey: typeof row?.itemKey === 'string' ? row.itemKey : '',
            confidence:
              typeof row?.confidence === 'number' && Number.isFinite(row.confidence)
                ? row.confidence
                : null,
          }))
          .filter((row: { itemKey: string; confidence: number | null }) => Boolean(row.itemKey))
      : undefined;

    if (!VALID_INBOX_TRIAGE_ACTIONS.includes(action as any)) {
      return res.status(400).json({ error: 'Invalid action', code: 'INBOX_TRIAGE_ACTION_INVALID' });
    }
    if (itemKeys.length === 0) {
      return res
        .status(400)
        .json({ error: 'Missing itemKeys[]', code: 'INBOX_TRIAGE_ITEM_KEYS_REQUIRED' });
    }

    const data = await applyGovernedBulkInboxTriage({
      userId,
      organizationId,
      items,
      itemKeys,
      action: action as any,
      params,
      aiItems,
    });

    return res.json({
      data,
      meta: { version: 'v8', contract: V8_INBOX_TRIAGE_MUTATION_CONTRACT },
    });
  })
);

router.post(
  '/inbox/ai-assist',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const body = req.body || {};
    const payload = InboxAiAssistItemSchema.safeParse(body.item);

    if (!payload.success) {
      return res
        .status(400)
        .json({ error: 'Invalid item payload', code: 'INBOX_AI_ASSIST_INVALID_ITEM' });
    }

    try {
      const result = await runInboxAiAssist({
        organizationId,
        language: body.language,
        item: payload.data,
      });

      return res.json({
        data: { result },
        meta: { version: 'v8', contract: V8_INBOX_AI_ASSIST_CONTRACT },
      });
    } catch (err: any) {
      return res.status(503).json({
        error: 'AI assist unavailable',
        code: 'INBOX_AI_ASSIST_UNAVAILABLE',
        message: err?.message,
      });
    }
  })
);

router.post(
  '/inbox/materializations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);

    try {
      const data = await myWorkRoofService.recordInboxMaterialization({
        ...req.body,
        organizationId,
        userId,
      });
      return res.status(201).json({ data, meta: { version: 'v8' } });
    } catch (err) {
      const handled = handleMyWorkRoofError(err, res, 'Invalid inbox materialization parameters');
      if (handled) return handled;
      throw err;
    }
  })
);

router.get(
  '/inbox/materializations/stats',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const data = await myWorkRoofService.getInboxMaterializationStats(userId, organizationId);
    return res.json({ data, meta: { version: 'v8' } });
  })
);

router.get(
  '/notebook/pages',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    if (!(await requireNotebookPagesTable(res))) return;
    const notebookCols = await getNotebookPageColumns();

    const where = [`np.organization_id = ?`];
    const params: Array<string | number> = [organizationId];

    if (req.query.projectId) {
      where.push('np.project_id = ?');
      params.push(String(req.query.projectId));
    }

    if (req.query.status) {
      where.push("coalesce(np.status, 'active') = ?");
      params.push(String(req.query.status));
    }

    if (req.query.pinned === '1') {
      where.push('coalesce(np.pinned, 0) = 1');
    } else if (req.query.pinned === '0') {
      where.push('coalesce(np.pinned, 0) = 0');
    }

    if (req.query.q) {
      const like = `%${String(req.query.q).trim().toLowerCase()}%`;
      where.push("(lower(np.title) LIKE ? OR lower(coalesce(np.content_text, '')) LIKE ?)");
      params.push(like, like);
    }

    where.push(
      `(
        (lower(np.visibility) = 'private' AND np.owner_user_id = ?)
        OR (
          lower(np.visibility) = 'project'
          AND np.project_id IS NOT NULL
          AND (
            np.owner_user_id = ?
            OR pm.user_id IS NOT NULL
          )
        )
      )`
    );
    params.push(userId, userId);

    const sortParam = String(req.query.sort || 'updated').toLowerCase();
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
    const offset = Math.max(Number(req.query.offset || 0), 0);
    const orderClauses: Record<string, string> = {
      updated: 'np.pinned DESC, np.updated_at DESC',
      created: 'np.pinned DESC, np.created_at DESC',
      title: 'np.pinned DESC, np.title ASC',
    };
    const orderBy = orderClauses[sortParam] || orderClauses.updated;

    const rows =
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          ${buildNotebookSelectFields(notebookCols, 'np')}
        FROM notebook_pages np
        LEFT JOIN project_members pm
          ON pm.project_id = np.project_id
         AND pm.user_id = ?
        WHERE ${where.join(' AND ')}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
      `,
        [userId, ...params, limit, offset]
      )) || [];

    return res.json({
      data: rows.map((row) => formatNotebookRow(row)),
      meta: { version: 'v8', contract: V8_NOTEBOOK_CONTRACT },
    });
  })
);

router.post(
  '/notebook/capture/upload',
  notebookCaptureUpload.single('file'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        error: 'File required',
        code: 'NOTEBOOK_CAPTURE_FILE_REQUIRED',
      });
    }

    const tags = req.body.tags
      ? Array.isArray(req.body.tags)
        ? req.body.tags
        : [req.body.tags]
      : [];

    const data = await notebookService.capture(organizationId, userId, {
      source: 'upload',
      title: req.body.title,
      fileBuffer: file.buffer,
      fileMimetype: file.mimetype,
      fileOriginalname: file.originalname,
      tags,
      projectId: req.body.projectId || undefined,
    });

    return res.status(201).json({
      data,
      meta: { version: 'v8', contract: V8_NOTEBOOK_CONTRACT },
    });
  })
);

router.post(
  '/notebook/pages',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    if (!(await requireNotebookPagesTable(res))) return;
    const notebookCols = await getNotebookPageColumns();

    // Z139 (data-integrity): the global input-sanitization middleware escapes
    // HTML entities on every req.body string. Decode back to plain before
    // storing notebook_pages.title — same fix already applied to the primary
    // /my-work/notebook path — so the DB holds plain text instead of a literal
    // `&amp;` that would otherwise render un-decoded in the UI.
    const title = decodeHtmlEntities(String(req.body?.title || '').trim());
    if (!title) {
      return res.status(400).json({ error: 'title is required', code: 'NOTEBOOK_TITLE_REQUIRED' });
    }

    const projectId = req.body?.projectId ? String(req.body.projectId) : null;
    const visibility = (
      req.body?.visibility
        ? String(req.body.visibility).toLowerCase()
        : projectId
          ? 'project'
          : 'private'
    ) as 'private' | 'project';

    if (visibility === 'project' && !projectId) {
      return res.status(400).json({
        error: 'projectId is required for visibility=project',
        code: 'PROJECT_ID_REQUIRED',
      });
    }

    if (visibility === 'project' && projectId) {
      const member = await queryHelpers.queryOne<{ ok: number }>(
        `SELECT 1 as ok FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1`,
        [projectId, userId]
      );
      if (!member) {
        return res
          .status(403)
          .json({ error: 'Not a project member', code: 'PROJECT_MEMBERSHIP_REQUIRED' });
      }
    }

    const id = randomUUID();
    const now = new Date().toISOString();

    await queryHelpers.queryRun(
      `INSERT INTO notebook_pages
        (id, owner_user_id, organization_id, project_id, visibility, title, content_json, content_text, tags_json, icon, maturity, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        organizationId,
        projectId,
        visibility,
        title,
        safeJsonString(
          deepDecodeHtmlEntities(req.body?.contentJson),
          JSON.stringify({ type: 'doc', content: [] })
        ),
        // Z139 (full scope): decode before storing, mirroring my-work/notebook.routes.ts.
        typeof req.body?.contentText === 'string' ? decodeHtmlEntities(req.body.contentText) : null,
        JSON.stringify(parseTagsArray(req.body?.tags)),
        typeof req.body?.icon === 'string' ? req.body.icon : null,
        typeof req.body?.maturity === 'string' ? req.body.maturity : 'seed',
        typeof req.body?.status === 'string' && ['inbox', 'active'].includes(req.body.status)
          ? req.body.status
          : 'active',
        now,
        now,
      ]
    );

    const row = await queryHelpers.queryOne<any>(
      `SELECT
        ${buildNotebookSelectFields(notebookCols, '')}
       FROM notebook_pages
       WHERE id = ? LIMIT 1`,
      [id]
    );

    return res.status(201).json({
      data: formatNotebookRow(row),
      meta: { version: 'v8', contract: V8_NOTEBOOK_CONTRACT },
    });
  })
);

router.get(
  '/notebook/pages/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    if (!(await requireNotebookPagesTable(res))) return;
    const notebookCols = await getNotebookPageColumns();

    const row = await queryHelpers.queryOne<any>(
      `SELECT
        ${buildNotebookSelectFields(notebookCols, '')}
       FROM notebook_pages
       WHERE id = ?
       LIMIT 1`,
      [String(req.params.id || '').trim()]
    );

    if (!row) {
      return res.status(404).json({ error: 'Not found', code: 'NOTEBOOK_PAGE_NOT_FOUND' });
    }
    if (!(await canAccessNotebookRow(userId, organizationId, row))) {
      return res.status(403).json({ error: 'Forbidden', code: 'NOTEBOOK_PAGE_FORBIDDEN' });
    }

    return res.json({
      data: formatNotebookRow(row),
      meta: { version: 'v8', contract: V8_NOTEBOOK_CONTRACT },
    });
  })
);

router.get(
  '/notebook/pages/:id/source-file',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    if (!(await requireNotebookPagesTable(res))) return;

    const id = String(req.params.id || '').trim();
    const row = await queryHelpers.queryOne<any>(
      `SELECT
        id,
        owner_user_id as "ownerUserId",
        organization_id as "organizationId",
        project_id as "projectId",
        visibility,
        capture_source as "captureSource",
        capture_metadata as "captureMetadataJson"
       FROM notebook_pages
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (!row) {
      return res.status(404).json({ error: 'Not found', code: 'NOTEBOOK_PAGE_NOT_FOUND' });
    }
    if (!(await canAccessNotebookRow(userId, organizationId, row))) {
      return res.status(403).json({ error: 'Forbidden', code: 'NOTEBOOK_PAGE_FORBIDDEN' });
    }
    if (String(row.captureSource || '').toLowerCase() !== 'upload') {
      return res
        .status(404)
        .json({ error: 'Source file not found', code: 'NOTEBOOK_SOURCE_FILE_NOT_FOUND' });
    }

    const storedFile = await resolveStoredNotebookSourceFile(row.captureMetadataJson);
    if (!storedFile) {
      return res
        .status(404)
        .json({ error: 'Source file not found', code: 'NOTEBOOK_SOURCE_FILE_NOT_FOUND' });
    }

    res.setHeader('Content-Type', storedFile.mimeType || 'application/octet-stream');
    return res.download(storedFile.filePath, storedFile.fileName);
  })
);

router.post(
  '/notebook/pages/:id/attachments',
  notebookAttachmentUpload.array('files', 10),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    if (!(await requireNotebookPagesTable(res))) return;
    const notebookCols = await getNotebookPageColumns();

    const id = String(req.params.id || '').trim();
    const files = ((req.files as Express.Multer.File[] | undefined) || []).filter(Boolean);
    if (files.length === 0) {
      return res
        .status(400)
        .json({ error: 'Files required', code: 'NOTEBOOK_ATTACHMENT_FILE_REQUIRED' });
    }

    const existing = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id, attachments_json as "attachmentsJson"
       FROM notebook_pages
       WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!existing) {
      return res.status(404).json({ error: 'Not found', code: 'NOTEBOOK_PAGE_NOT_FOUND' });
    }
    if (String(existing.organization_id || '') !== String(organizationId)) {
      return res.status(403).json({ error: 'Forbidden', code: 'NOTEBOOK_PAGE_FORBIDDEN' });
    }
    if (String(existing.owner_user_id || '') !== String(userId)) {
      return res.status(403).json({ error: 'Owner-only', code: 'NOTEBOOK_PAGE_OWNER_ONLY' });
    }

    try {
      await addNotebookAttachmentsToPage({
        organizationId,
        pageId: id,
        files: files.map((file) => ({
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
        })),
        userId,
      });
    } catch (error) {
      return res
        .status(error instanceof NotebookAttachmentMutationError ? error.status : 400)
        .json({
          error: 'Attachment upload failed',
          code:
            error instanceof NotebookAttachmentMutationError
              ? error.code
              : 'NOTEBOOK_ATTACHMENT_UPLOAD_FAILED',
        });
    }

    const row = await queryHelpers.queryOne<any>(
      `SELECT
        ${buildNotebookSelectFields(notebookCols, '')}
       FROM notebook_pages WHERE id = ? LIMIT 1`,
      [id]
    );

    return res.status(201).json({
      data: formatNotebookRow(row),
      meta: { version: 'v8', contract: V8_NOTEBOOK_CONTRACT },
    });
  })
);

router.get(
  '/notebook/pages/:id/attachments/:attachmentId/download',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    if (!(await requireNotebookPagesTable(res))) return;

    const id = String(req.params.id || '').trim();
    const attachmentId = String(req.params.attachmentId || '').trim();
    const row = await queryHelpers.queryOne<any>(
      `SELECT
        id,
        owner_user_id as "ownerUserId",
        organization_id as "organizationId",
        project_id as "projectId",
        visibility,
        attachments_json as "attachmentsJson"
       FROM notebook_pages
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    if (!row) {
      return res.status(404).json({ error: 'Not found', code: 'NOTEBOOK_PAGE_NOT_FOUND' });
    }
    if (!(await canAccessNotebookRow(userId, organizationId, row))) {
      return res.status(403).json({ error: 'Forbidden', code: 'NOTEBOOK_PAGE_FORBIDDEN' });
    }

    const storedFile = await resolveNotebookAttachmentFile(row.attachmentsJson, attachmentId);
    if (!storedFile) {
      return res
        .status(404)
        .json({ error: 'Attachment not found', code: 'NOTEBOOK_ATTACHMENT_NOT_FOUND' });
    }

    res.setHeader('Content-Type', storedFile.mimeType || 'application/octet-stream');
    return res.download(storedFile.filePath, storedFile.fileName);
  })
);

router.delete(
  '/notebook/pages/:id/attachments/:attachmentId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    if (!(await requireNotebookPagesTable(res))) return;
    const notebookCols = await getNotebookPageColumns();

    const id = String(req.params.id || '').trim();
    const attachmentId = String(req.params.attachmentId || '').trim();
    const existing = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id, attachments_json as "attachmentsJson"
       FROM notebook_pages
       WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!existing) {
      return res.status(404).json({ error: 'Not found', code: 'NOTEBOOK_PAGE_NOT_FOUND' });
    }
    if (String(existing.organization_id || '') !== String(organizationId)) {
      return res.status(403).json({ error: 'Forbidden', code: 'NOTEBOOK_PAGE_FORBIDDEN' });
    }
    if (String(existing.owner_user_id || '') !== String(userId)) {
      return res.status(403).json({ error: 'Owner-only', code: 'NOTEBOOK_PAGE_OWNER_ONLY' });
    }

    if (
      !parseNotebookAttachments(existing.attachmentsJson).some(
        (attachment) => attachment.id === attachmentId
      )
    ) {
      return res
        .status(404)
        .json({ error: 'Attachment not found', code: 'NOTEBOOK_ATTACHMENT_NOT_FOUND' });
    }

    try {
      await removeNotebookAttachmentFromPage({
        pageId: id,
        attachmentId,
      });
    } catch (error) {
      return res
        .status(error instanceof NotebookAttachmentMutationError ? error.status : 400)
        .json({
          error: 'Attachment delete failed',
          code:
            error instanceof NotebookAttachmentMutationError
              ? error.code
              : 'NOTEBOOK_ATTACHMENT_DELETE_FAILED',
        });
    }

    const row = await queryHelpers.queryOne<any>(
      `SELECT
        ${buildNotebookSelectFields(notebookCols, '')}
       FROM notebook_pages WHERE id = ? LIMIT 1`,
      [id]
    );

    return res.json({
      data: formatNotebookRow(row),
      meta: { version: 'v8', contract: V8_NOTEBOOK_CONTRACT },
    });
  })
);

router.put(
  '/notebook/pages/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    if (!(await requireNotebookPagesTable(res))) return;
    const notebookCols = await getNotebookPageColumns();

    const id = String(req.params.id || '').trim();
    const existing = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id, project_id, visibility, updated_at
       FROM notebook_pages
       WHERE id = ? LIMIT 1`,
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Not found', code: 'NOTEBOOK_PAGE_NOT_FOUND' });
    }
    if (String(existing.organization_id || '') !== String(organizationId)) {
      return res.status(403).json({ error: 'Forbidden', code: 'NOTEBOOK_PAGE_FORBIDDEN' });
    }
    if (String(existing.owner_user_id || '') !== String(userId)) {
      return res.status(403).json({ error: 'Owner-only', code: 'NOTEBOOK_PAGE_OWNER_ONLY' });
    }

    // Optimistic concurrency: if the client tells us which version it based its
    // edit on (expectedUpdatedAt), reject silent last-write-wins when the row
    // has moved on since. Happy-path autosave omits the field → unchanged.
    const expectedUpdatedAt =
      req.body?.expectedUpdatedAt !== undefined && req.body?.expectedUpdatedAt !== null
        ? String(req.body.expectedUpdatedAt)
        : null;
    if (expectedUpdatedAt) {
      const expected = new Date(expectedUpdatedAt).getTime();
      // pg returns TIMESTAMPTZ as a Date. String(Date) drops milliseconds, so
      // reparsing that string turned a matching token such as `.726Z` into
      // `.000Z` and falsely rejected every first UI autosave as a conflict.
      const current = existing.updated_at ? new Date(existing.updated_at).getTime() : NaN;
      // Only enforce when both timestamps are parseable; a mismatch means the
      // page was edited elsewhere between the client's read and this write.
      if (Number.isFinite(expected) && Number.isFinite(current) && expected !== current) {
        const fresh = await queryHelpers.queryOne<any>(
          `SELECT
            ${buildNotebookSelectFields(notebookCols, '')}
           FROM notebook_pages WHERE id = ? LIMIT 1`,
          [id]
        );
        return res.status(409).json({
          error: 'Page was modified elsewhere',
          code: 'NOTEBOOK_PAGE_CONFLICT',
          data: fresh ? formatNotebookRow(fresh) : null,
          meta: { version: 'v8', contract: V8_NOTEBOOK_CONTRACT },
        });
      }
    }

    const setParts: string[] = [];
    const params: unknown[] = [];
    const set = (col: string, value: unknown) => {
      setParts.push(`${col} = ?`);
      params.push(value);
    };

    if (typeof req.body?.title === 'string')
      set('title', decodeHtmlEntities(String(req.body.title).trim())); // Z139: decode-before-store
    if (req.body?.tags !== undefined)
      set('tags_json', JSON.stringify(parseTagsArray(req.body.tags)));
    if (req.body?.contentJson !== undefined) {
      set(
        'content_json',
        safeJsonString(
          deepDecodeHtmlEntities(req.body.contentJson),
          JSON.stringify({ type: 'doc', content: [] })
        )
      );
    }
    // Z139 (full scope): decode before storing, mirroring my-work/notebook.routes.ts.
    if (typeof req.body?.contentText === 'string')
      set('content_text', decodeHtmlEntities(req.body.contentText));
    if (notebookCols.has('maturity') && typeof req.body?.maturity === 'string')
      set('maturity', req.body.maturity);
    if (notebookCols.has('icon') && typeof req.body?.icon === 'string') set('icon', req.body.icon);
    if (notebookCols.has('summary') && typeof req.body?.summary === 'string')
      set('summary', req.body.summary);
    if (
      notebookCols.has('status') &&
      typeof req.body?.status === 'string' &&
      ['inbox', 'active', 'converted', 'archived'].includes(req.body.status)
    ) {
      set('status', req.body.status);
    }
    if (
      notebookCols.has('verification_status') &&
      typeof req.body?.verificationStatus === 'string' &&
      ['unverified', 'verified', 'disputed'].includes(req.body.verificationStatus)
    ) {
      set('verification_status', req.body.verificationStatus);
    }
    if (
      notebookCols.has('review_cadence') &&
      typeof req.body?.reviewCadence === 'string' &&
      ['weekly', 'monthly', 'quarterly', 'never'].includes(req.body.reviewCadence)
    ) {
      set('review_cadence', req.body.reviewCadence);
    }
    if (
      notebookCols.has('stale_at') &&
      (req.body?.staleAt === null || (typeof req.body?.staleAt === 'string' && req.body.staleAt))
    ) {
      set('stale_at', req.body.staleAt || null);
    }
    if (notebookCols.has('last_reviewed_at') && req.body?.lastReviewedAt !== undefined) {
      set('last_reviewed_at', req.body.lastReviewedAt || null);
    }
    if (req.body?.projectId !== undefined) {
      const nextProjectId = req.body.projectId ? String(req.body.projectId) : null;
      set('project_id', nextProjectId);
      set('visibility', nextProjectId ? 'project' : 'private');
    }
    if (notebookCols.has('converted_to_json') && req.body?.convertedTo !== undefined) {
      set(
        'converted_to_json',
        safeJsonString(Array.isArray(req.body.convertedTo) ? req.body.convertedTo : [], '[]')
      );
    }

    if (setParts.length > 0) {
      setParts.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);
      const isPostgres =
        process.env.DB_TYPE === 'postgres' ||
        /^postgres(?:ql)?:/i.test(String(process.env.DATABASE_URL || ''));
      if (expectedUpdatedAt) {
        if (isPostgres && existing.updated_at instanceof Date) {
          // `updated_at` is TIMESTAMP WITHOUT TIME ZONE. node-postgres parses
          // it in the process timezone, so rebuild the same naive local value
          // before binding it back; binding Date/ISO would shift it by the TZ.
          const value = existing.updated_at;
          const part = (n: number, width = 2) => String(n).padStart(width, '0');
          params.push(
            `${value.getFullYear()}-${part(value.getMonth() + 1)}-${part(value.getDate())} ` +
              `${part(value.getHours())}:${part(value.getMinutes())}:${part(value.getSeconds())}.` +
              part(value.getMilliseconds(), 3)
          );
        } else {
          params.push(expectedUpdatedAt);
        }
      }
      // Normalize fractional precision in PostgreSQL; SQLite stores the
      // serialized timestamp token directly and uses plain equality.
      const versionPredicate = isPostgres
        ? "date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', CAST(? AS timestamp))"
        : 'updated_at = ?';
      const update = await queryHelpers.queryRun(
        `UPDATE notebook_pages SET ${setParts.join(', ')}
         WHERE id = ?${expectedUpdatedAt ? ` AND ${versionPredicate}` : ''}`,
        params
      );
      if (expectedUpdatedAt && !update.changes) {
        const fresh = await queryHelpers.queryOne<any>(
          `SELECT ${buildNotebookSelectFields(notebookCols, '')}
           FROM notebook_pages WHERE id = ? LIMIT 1`,
          [id]
        );
        return res.status(409).json({
          error: 'Page was modified elsewhere',
          code: 'NOTEBOOK_PAGE_CONFLICT',
          data: fresh ? formatNotebookRow(fresh) : null,
          meta: { version: 'v8', contract: V8_NOTEBOOK_CONTRACT },
        });
      }
    }

    const row = await queryHelpers.queryOne<any>(
      `SELECT
        ${buildNotebookSelectFields(notebookCols, '')}
       FROM notebook_pages WHERE id = ? LIMIT 1`,
      [id]
    );

    return res.json({
      data: formatNotebookRow(row),
      meta: { version: 'v8', contract: V8_NOTEBOOK_CONTRACT },
    });
  })
);

router.delete(
  '/notebook/pages/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    if (!(await requireNotebookPagesTable(res))) return;

    const id = String(req.params.id || '').trim();
    const existing = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id FROM notebook_pages WHERE id = ? LIMIT 1`,
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Not found', code: 'NOTEBOOK_PAGE_NOT_FOUND' });
    }
    if (String(existing.organization_id || '') !== String(organizationId)) {
      return res.status(403).json({ error: 'Forbidden', code: 'NOTEBOOK_PAGE_FORBIDDEN' });
    }
    if (String(existing.owner_user_id || '') !== String(userId)) {
      return res.status(403).json({ error: 'Owner-only', code: 'NOTEBOOK_PAGE_OWNER_ONLY' });
    }

    await queryHelpers.queryRun(`DELETE FROM notebook_pages WHERE id = ?`, [id]);
    return res.json({
      data: { success: true, id },
      meta: { version: 'v8', contract: V8_NOTEBOOK_CONTRACT },
    });
  })
);

router.put(
  '/notebook/pages/:id/pin',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    if (!(await requireNotebookPagesTable(res))) return;

    const id = String(req.params.id || '').trim();
    const existing = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id, coalesce(pinned, 0) as pinned FROM notebook_pages WHERE id = ? LIMIT 1`,
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Not found', code: 'NOTEBOOK_PAGE_NOT_FOUND' });
    }
    if (String(existing.organization_id || '') !== String(organizationId)) {
      return res.status(403).json({ error: 'Forbidden', code: 'NOTEBOOK_PAGE_FORBIDDEN' });
    }
    if (String(existing.owner_user_id || '') !== String(userId)) {
      return res.status(403).json({ error: 'Owner-only', code: 'NOTEBOOK_PAGE_OWNER_ONLY' });
    }

    const pinned = existing.pinned ? 0 : 1;
    await queryHelpers.queryRun(
      `UPDATE notebook_pages SET pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [pinned, id]
    );

    return res.json({
      data: { id, pinned: Boolean(pinned) },
      meta: { version: 'v8', contract: V8_NOTEBOOK_CONTRACT },
    });
  })
);

router.put(
  '/notebook/pages/:id/status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    if (!(await requireNotebookPagesTable(res))) return;

    const id = String(req.params.id || '').trim();
    const status = String(req.body?.status || '')
      .trim()
      .toLowerCase();
    if (!['inbox', 'active', 'converted', 'archived'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Must be inbox|active|converted|archived',
        code: 'NOTEBOOK_STATUS_INVALID',
      });
    }

    const existing = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id FROM notebook_pages WHERE id = ? LIMIT 1`,
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Not found', code: 'NOTEBOOK_PAGE_NOT_FOUND' });
    }
    if (String(existing.organization_id || '') !== String(organizationId)) {
      return res.status(403).json({ error: 'Forbidden', code: 'NOTEBOOK_PAGE_FORBIDDEN' });
    }
    if (String(existing.owner_user_id || '') !== String(userId)) {
      return res.status(403).json({ error: 'Owner-only', code: 'NOTEBOOK_PAGE_OWNER_ONLY' });
    }

    await queryHelpers.queryRun(
      `UPDATE notebook_pages SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, id]
    );

    return res.json({
      data: { id, status },
      meta: { version: 'v8', contract: V8_NOTEBOOK_CONTRACT },
    });
  })
);

router.post(
  '/notebook/pages/:id/classify',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    if (!(await requireNotebookPagesTable(res))) return;

    const pageId = String(req.params.id || '').trim();
    const page = await queryHelpers.queryOne<any>(
      `SELECT id, title, content_text as "contentText", maturity
       FROM notebook_pages
       WHERE id = ? AND owner_user_id = ? AND organization_id = ? LIMIT 1`,
      [pageId, userId, organizationId]
    );

    if (!page) {
      return res.status(404).json({ error: 'Page not found', code: 'NOTEBOOK_PAGE_NOT_FOUND' });
    }

    const suggestion = classifyNotebookSuggestion(page);
    return res.json({
      data: {
        pageId,
        ...suggestion,
        maturity: page.maturity ?? null,
        // L-06: keyword-scoring, NOT an LLM — declare the method so no consumer
        // (incl. the FE that calls this V8 path first) presents it as "AI".
        method: 'heuristic' as const,
      },
      meta: { version: 'v8', contract: V8_NOTEBOOK_CONTRACT },
    });
  })
);

router.post(
  '/notebook/pages/:id/ai-proposals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    if (!(await requireNotebookPagesTable(res))) return;

    const pageId = String(req.params.id || '').trim();
    const parsed = notebookProposalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.message, code: 'NOTEBOOK_AI_PROPOSAL_INVALID' });
    }

    const proposal = await notebookService.createAIProposal(
      organizationId,
      userId,
      pageId,
      parsed.data
    );

    return res.status(201).json({
      data: proposal,
      meta: { version: 'v8', contract: V8_NOTEBOOK_CONTRACT },
    });
  })
);

router.get(
  '/notebook/pages/:id/ai-proposals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    if (!(await requireNotebookPagesTable(res))) return;

    const pageId = String(req.params.id || '').trim();
    const status = req.query.status ? String(req.query.status) : undefined;
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : 50;

    const proposals = await notebookService.getProposalsForPage(organizationId, pageId, {
      status,
      limit,
    });

    return res.json({
      data: { proposals },
      meta: { version: 'v8', contract: V8_NOTEBOOK_CONTRACT },
    });
  })
);

router.post(
  '/notebook/ai-proposals/:proposalId/resolve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    if (!(await requireNotebookPagesTable(res))) return;

    const schema = z.object({ action: z.enum(['accepted', 'rejected']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.message, code: 'NOTEBOOK_AI_PROPOSAL_ACTION_INVALID' });
    }

    const proposal = await notebookService.resolveAIProposal(
      organizationId,
      String(req.params.proposalId || '').trim(),
      userId,
      parsed.data.action
    );

    if (!proposal) {
      return res
        .status(404)
        .json({ error: 'Proposal not found', code: 'NOTEBOOK_AI_PROPOSAL_NOT_FOUND' });
    }

    return res.json({
      data: proposal,
      meta: { version: 'v8', contract: V8_NOTEBOOK_CONTRACT },
    });
  })
);

router.post(
  '/notebook/pages/:id/convert',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    if (!(await requireNotebookPagesTable(res))) return;

    const pageId = String(req.params.id || '').trim();
    const target = String(req.body?.target || '')
      .trim()
      .toLowerCase();

    if (
      !['task', 'decision', 'initiative', 'report', 'presentation', 'assessment'].includes(target)
    ) {
      return res.status(400).json({
        error: 'target must be task|decision|initiative|report|presentation|assessment',
        code: 'NOTEBOOK_CONVERT_TARGET_INVALID',
      });
    }

    try {
      const result = await convertNotebookPage({
        pageId,
        orgId: organizationId,
        userId,
        target: target as
          | 'task'
          | 'decision'
          | 'initiative'
          | 'report'
          | 'presentation'
          | 'assessment',
        title: typeof req.body?.title === 'string' ? req.body.title : undefined,
        description: typeof req.body?.description === 'string' ? req.body.description : undefined,
        assessmentType:
          typeof req.body?.assessmentType === 'string'
            ? (String(req.body.assessmentType).toUpperCase() as
                | 'DRD'
                | 'SIRI'
                | 'ADMA'
                | 'CMMI'
                | 'LEAN')
            : undefined,
      });

      return res.status(201).json({
        data: result,
        meta: { version: 'v8', contract: V8_NOTEBOOK_CONTRACT },
      });
    } catch (error) {
      if (error instanceof NotebookConversionError) {
        return res.status(error.status).json({
          error: error.message,
          code: error.code,
        });
      }
      throw error;
    }
  })
);

router.get(
  '/calendar/unified',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const startRaw = req.query.start ? String(req.query.start).trim() : '';
    const endRaw = req.query.end ? String(req.query.end).trim() : '';
    const start = startRaw || null;
    const end = endRaw || null;
    const hasRange = Boolean(start && end);

    const sourcesParam = req.query.sources ? String(req.query.sources) : null;
    const requestedSources = sourcesParam
      ? sourcesParam
          .split(',')
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean)
      : ['task', 'initiative', 'decision', 'outlook', 'google', 'consultify'];
    const projectId = req.query.projectId ? String(req.query.projectId).trim() : '';
    const ownership = req.query.ownership
      ? String(req.query.ownership).trim().toLowerCase()
      : 'any';

    const events: Array<{
      id: string;
      title: string;
      start: string;
      end?: string;
      allDay: boolean;
      source: string;
      sourceId: string;
      color?: string;
      status?: string;
      priority?: string;
      description?: string;
      visibilityClass?: string;
      editAuthority?: string;
      syncState?: string;
      permissionGradient?: string;
      etag?: string;
    }> = [];

    if (requestedSources.includes('task')) {
      const taskCols = await getTableColumns('tasks');
      const hasDue = taskCols.has('due_date');
      const hasStart = taskCols.has('start_date');
      const hasEnd = taskCols.has('end_date');
      const hasPlannedStart = taskCols.has('planned_start_date');
      const hasPlannedEnd = taskCols.has('planned_end_date');
      const hasProjectId = taskCols.has('project_id');
      const hasAssigneeId = taskCols.has('assignee_id');
      const hasAssignedTo = taskCols.has('assigned_to');
      const hasOwnerId = taskCols.has('owner_id');
      const hasCreatedBy = taskCols.has('created_by');

      const dateExprParts: string[] = [];
      if (hasDue) dateExprParts.push('t.due_date');
      if (hasStart) dateExprParts.push('t.start_date');
      if (hasPlannedStart) dateExprParts.push('t.planned_start_date');
      const primaryDateExpr =
        dateExprParts.length > 0 ? `COALESCE(${dateExprParts.join(', ')})` : null;

      const assignmentParts: string[] = [];
      if (hasAssigneeId) assignmentParts.push('t.assignee_id = ?');
      if (hasAssignedTo && ownership !== 'owner') assignmentParts.push('t.assigned_to = ?');
      if (hasOwnerId && ownership !== 'assignee') assignmentParts.push('t.owner_id = ?');
      if (assignmentParts.length === 0 && hasCreatedBy) assignmentParts.push('t.created_by = ?');

      const where: string[] = ['t.organization_id = ?'];
      const params: Array<string | number> = [organizationId];

      if (assignmentParts.length > 0) {
        where.push(`(${assignmentParts.join(' OR ')})`);
        for (let i = 0; i < assignmentParts.length; i++) params.push(userId);
      } else {
        where.push('1=0');
      }

      where.push("LOWER(COALESCE(t.status,'')) NOT IN ('done','completed','cancelled')");

      const hasAnyDateParts: string[] = [];
      if (hasDue) hasAnyDateParts.push('t.due_date IS NOT NULL');
      if (hasStart) hasAnyDateParts.push('t.start_date IS NOT NULL');
      if (hasPlannedStart) hasAnyDateParts.push('t.planned_start_date IS NOT NULL');
      if (hasAnyDateParts.length > 0) {
        where.push(`(${hasAnyDateParts.join(' OR ')})`);
      }

      if (projectId && hasProjectId) {
        where.push('t.project_id = ?');
        params.push(projectId);
      }

      if (hasRange && primaryDateExpr) {
        where.push(`${primaryDateExpr} >= ? AND ${primaryDateExpr} < ?`);
        params.push(start!, end!);
      }

      const select: string[] = ['t.id', 't.title', 't.status', 't.priority', 't.description'];
      if (hasDue) select.push('t.due_date as due_date');
      if (hasStart) select.push('t.start_date as start_date');
      if (hasEnd) select.push('t.end_date as end_date');
      if (hasPlannedStart) select.push('t.planned_start_date as planned_start_date');
      if (hasPlannedEnd) select.push('t.planned_end_date as planned_end_date');
      if (taskCols.has('metadata')) select.push('t.metadata as metadata');

      const rows =
        (await queryHelpers.queryAll<any>(
          `
            SELECT ${select.join(', ')}
            FROM tasks t
            WHERE ${where.join(' AND ')}
            ORDER BY ${primaryDateExpr ? `${primaryDateExpr} ASC` : 't.updated_at DESC'}
            LIMIT 800
          `,
          params
        )) || [];

      for (const row of rows) {
        const due = toDateOnly(row?.due_date);
        const startDate = due || toDateOnly(row?.start_date) || toDateOnly(row?.planned_start_date);
        const endDate = toDateOnly(row?.end_date) || toDateOnly(row?.planned_end_date);
        if (!startDate) continue;

        events.push({
          id: `task-${row.id}`,
          title: String(row.title || '').trim() || 'Task',
          start: startDate,
          end: due ? undefined : endDate ? addDaysDateOnly(endDate, 1) : undefined,
          allDay: true,
          source: 'task',
          sourceId: String(row.id),
          color: '#2563eb',
          status: row.status,
          priority: row.priority,
          description: row.description,
        });

        try {
          const metadataRaw = row?.metadata;
          const metadata =
            typeof metadataRaw === 'string' ? JSON.parse(metadataRaw || '{}') : metadataRaw;
          const recurrence = metadata?.calendarRecurrence;
          if (recurrence?.rrule && startDate && end && start) {
            const seriesStart = `${startDate}T00:00:00.000Z`;
            const materialized = materializeInstances(
              seriesStart,
              due ? undefined : endDate ? `${endDate}T00:00:00.000Z` : null,
              {
                seriesMasterRef: String(row.id),
                rrule: recurrence.rrule,
                rdate: null,
                exdate: null,
                exceptions: [],
                materializationRule: 'window_only',
              },
              start,
              end
            );
            for (const occurrence of materialized) {
              if (occurrence.isCancelled) continue;
              const occDate = occurrence.startAt.slice(0, 10);
              events.push({
                id: `task-${row.id}-rec-${occurrence.recurrenceId}`,
                title: String(row.title || '').trim() || 'Task',
                start: occDate,
                allDay: true,
                source: 'task',
                sourceId: String(row.id),
                color: '#2563eb',
                status: row.status,
                priority: row.priority,
                description: row.description,
                recurrenceRule: recurrence.rrule,
                recurrenceSourceId: String(row.id),
              });
            }
          }
        } catch {
          // ignore invalid metadata payload and keep base event
        }
      }
    }

    if (requestedSources.includes('initiative')) {
      const initCols = await getTableColumns('initiatives');
      const hasInitPlannedStart = initCols.has('planned_start_date');
      const hasInitPlannedEnd = initCols.has('planned_end_date');
      const hasInitStart = initCols.has('start_date');
      const hasInitEnd = initCols.has('end_date');
      const hasInitTarget = initCols.has('target_date');
      const hasInitProjectId = initCols.has('project_id');
      const hasInitOwnerBusiness = initCols.has('owner_business_id');
      const hasInitOwnerExecution = initCols.has('owner_execution_id');
      const hasInitOwnerLegacy = initCols.has('owner_id');
      const hasInitSponsor = initCols.has('sponsor_id');
      const hasInitCreatedBy = initCols.has('created_by');
      const stakeholderCols = await getTableColumns('initiative_stakeholders');
      const hasStakeholders =
        stakeholderCols.has('initiative_id') && stakeholderCols.has('user_id');

      const startExpr =
        (hasInitPlannedStart && 'i.planned_start_date') ||
        (hasInitStart && 'i.start_date') ||
        (hasInitTarget && 'i.target_date') ||
        null;
      const endExpr =
        (hasInitPlannedEnd && 'i.planned_end_date') ||
        (hasInitEnd && 'i.end_date') ||
        (hasInitTarget && 'i.target_date') ||
        null;

      if (startExpr) {
        const relationParts: string[] = [];
        if (hasInitOwnerExecution) relationParts.push('i.owner_execution_id = ?');
        if (hasInitOwnerBusiness) relationParts.push('i.owner_business_id = ?');
        if (hasInitOwnerLegacy) relationParts.push('i.owner_id = ?');
        if (hasInitSponsor) relationParts.push('i.sponsor_id = ?');
        if (hasStakeholders) {
          relationParts.push(
            'EXISTS (SELECT 1 FROM initiative_stakeholders s WHERE s.initiative_id = i.id AND s.user_id = ?)'
          );
        }
        if (relationParts.length === 0 && hasInitCreatedBy) relationParts.push('i.created_by = ?');

        const where: string[] = ['i.organization_id = ?'];
        const params: Array<string | number> = [organizationId];

        if (relationParts.length > 0) {
          where.push(`(${relationParts.join(' OR ')})`);
          for (let i = 0; i < relationParts.length; i++) params.push(userId);
        } else {
          where.push('1=0');
        }

        where.push(`${startExpr} IS NOT NULL`);
        where.push("LOWER(COALESCE(i.status,'')) NOT IN ('completed','done','cancelled')");

        if (projectId && hasInitProjectId) {
          where.push('i.project_id = ?');
          params.push(projectId);
        }

        if (hasRange) {
          const endOrStart = endExpr ? `COALESCE(${endExpr}, ${startExpr})` : startExpr;
          where.push(`${startExpr} < ? AND ${endOrStart} >= ?`);
          params.push(end!, start!);
        }

        const rows =
          (await queryHelpers.queryAll<any>(
            `
              SELECT i.id, i.name, i.status,
                     ${startExpr} as start_date
                     ${endExpr ? `, ${endExpr} as end_date` : ''}
              FROM initiatives i
              WHERE ${where.join(' AND ')}
              ORDER BY ${startExpr} ASC
              LIMIT 400
            `,
            params
          )) || [];

        for (const row of rows) {
          const startDate = toDateOnly(row?.start_date);
          const endDate = toDateOnly(row?.end_date);
          if (!startDate) continue;
          events.push({
            id: `initiative-${row.id}`,
            title: String(row.name || '').trim() || 'Initiative',
            start: startDate,
            end: endDate ? addDaysDateOnly(endDate, 1) : undefined,
            allDay: true,
            source: 'initiative',
            sourceId: String(row.id),
            color: '#7c3aed',
            status: row.status,
          });
        }
      }

      const milestoneCols = await getTableColumns('initiative_milestones');
      const hasMilestones = milestoneCols.has('target_date');
      const hasMsProjectId = milestoneCols.has('project_id');
      if (hasMilestones) {
        const relationParts: string[] = [];
        if (hasInitOwnerExecution) relationParts.push('i.owner_execution_id = ?');
        if (hasInitOwnerBusiness) relationParts.push('i.owner_business_id = ?');
        if (hasInitOwnerLegacy) relationParts.push('i.owner_id = ?');
        if (hasInitSponsor) relationParts.push('i.sponsor_id = ?');
        if (hasStakeholders) {
          relationParts.push(
            'EXISTS (SELECT 1 FROM initiative_stakeholders s WHERE s.initiative_id = i.id AND s.user_id = ?)'
          );
        }
        if (relationParts.length === 0 && hasInitCreatedBy) relationParts.push('i.created_by = ?');

        const where: string[] = ['m.organization_id = ?', 'm.target_date IS NOT NULL'];
        const params: Array<string | number> = [organizationId];

        if (relationParts.length > 0) {
          where.push(`(${relationParts.join(' OR ')})`);
          for (let i = 0; i < relationParts.length; i++) params.push(userId);
        } else {
          where.push('1=0');
        }

        if (projectId && hasMsProjectId) {
          where.push('m.project_id = ?');
          params.push(projectId);
        }

        if (hasRange) {
          where.push('m.target_date >= ? AND m.target_date < ?');
          params.push(start!, end!);
        }

        const rows =
          (await queryHelpers.queryAll<any>(
            `
              SELECT
                m.id,
                m.initiative_id,
                m.name,
                m.status,
                m.target_date,
                i.name as initiative_name
              FROM initiative_milestones m
              LEFT JOIN initiatives i ON i.id = m.initiative_id
              WHERE ${where.join(' AND ')}
              ORDER BY m.target_date ASC
              LIMIT 600
            `,
            params
          )) || [];

        for (const row of rows) {
          const targetDate = toDateOnly(row?.target_date);
          if (!targetDate) continue;
          const initiativeName = String(row?.initiative_name || '').trim();
          const milestoneName = String(row?.name || '').trim();
          events.push({
            id: `initiative-ms-${row.id}`,
            title: initiativeName
              ? `${initiativeName}: ${milestoneName || 'Milestone'}`
              : milestoneName || 'Milestone',
            start: targetDate,
            allDay: true,
            source: 'initiative',
            sourceId: String(row.initiative_id || row.id),
            color: '#7c3aed',
            status: row.status,
          });
        }
      }
    }

    if (requestedSources.includes('decision')) {
      const decisionCols = await getTableColumns('decisions');
      const hasDecisionMaker = decisionCols.has('decision_maker_id');
      const hasCreatedBy = decisionCols.has('created_by');
      const hasAssignedTo = decisionCols.has('assigned_to');
      const hasDecisionOwner = decisionCols.has('decision_owner_id');
      const hasProjectId = decisionCols.has('project_id');

      const ownerParts: string[] = [];
      if (hasDecisionOwner && ownership !== 'assignee') ownerParts.push('d.decision_owner_id = ?');
      if (hasDecisionMaker && ownership !== 'assignee') ownerParts.push('d.decision_maker_id = ?');
      if (hasAssignedTo && ownership !== 'owner') ownerParts.push('d.assigned_to = ?');
      if (ownerParts.length === 0 && hasCreatedBy) ownerParts.push('d.created_by = ?');
      if (ownerParts.length === 0) ownerParts.push('1=0');

      const ownerParamCount =
        (hasDecisionOwner ? 1 : 0) +
        (hasDecisionMaker ? 1 : 0) +
        (hasAssignedTo ? 1 : 0) +
        (ownerParts.includes('d.created_by = ?') ? 1 : 0);

      const where: string[] = [
        'd.organization_id = ?',
        'd.deadline IS NOT NULL',
        `(${ownerParts.join(' OR ')})`,
        "LOWER(COALESCE(d.status,'')) NOT IN ('resolved','done','completed','cancelled')",
      ];
      const params: Array<string | number> = [organizationId];
      for (let i = 0; i < ownerParamCount; i++) params.push(userId);

      if (projectId && hasProjectId) {
        where.push('d.project_id = ?');
        params.push(projectId);
      }

      if (hasRange) {
        where.push('d.deadline >= ? AND d.deadline < ?');
        params.push(start!, end!);
      }

      const rows =
        (await queryHelpers.queryAll<any>(
          `
            SELECT d.id, d.title, d.deadline, d.status,
                   ${decisionCols.has('priority') ? 'd.priority' : `'MEDIUM' as priority`}
            FROM decisions d
            WHERE ${where.join(' AND ')}
            ORDER BY d.deadline ASC
            LIMIT 400
          `,
          params
        )) || [];

      for (const row of rows) {
        const dueDate = toDateOnly(row?.deadline);
        if (!dueDate) continue;
        events.push({
          id: `decision-${row.id}`,
          title: String(row.title || '').trim() || 'Decision',
          start: dueDate,
          allDay: true,
          source: 'decision',
          sourceId: String(row.id),
          color: '#d97706',
          status: row.status,
          priority: row.priority,
        });
      }
    }

    const wantOutlook = requestedSources.includes('outlook');
    const wantGoogle = requestedSources.includes('google');
    const wantConsultify = requestedSources.includes('consultify');
    if (wantOutlook || wantGoogle || wantConsultify) {
      const meetingCols = await getTableColumns('meetings');
      if (meetingCols.has('start_at') && meetingCols.has('end_at')) {
        const where: string[] = ['m.organization_id = ?'];
        const params: Array<string | number> = [organizationId];

        if (meetingCols.has('created_by')) {
          where.push('m.created_by = ?');
          params.push(userId);
        }

        if (hasRange) {
          where.push('m.start_at >= ? AND m.start_at < ?');
          params.push(start!, end!);
        }

        const rows =
          (await queryHelpers.queryAll<any>(
            `
              SELECT m.id, m.title, m.start_at, m.end_at, m.location, m.status, m.agenda_json
              FROM meetings m
              WHERE ${where.join(' AND ')}
              ORDER BY m.start_at ASC
              LIMIT 200
            `,
            params
          )) || [];

        const sourceColorMap: Record<string, string> = {
          google: '#059669',
          outlook: '#4f46e5',
          consultify: '#6d28d9',
        };

        for (const row of rows) {
          let agenda: Record<string, any> = {};
          try {
            agenda = JSON.parse(row.agenda_json || '{}');
          } catch {
            agenda = {};
          }
          const calendarSource = agenda.calendarSource || 'outlook';
          if (calendarSource === 'outlook' && !wantOutlook) continue;
          if (calendarSource === 'google' && !wantGoogle) continue;
          if (calendarSource === 'consultify' && !wantConsultify) continue;

          const meetingType = agenda.meetingType || 'team';
          const prefix = meetingType === 'personal' ? '👤 ' : '👥 ';
          const startIso = row.start_at ? new Date(row.start_at).toISOString() : null;
          const endIso = row.end_at ? new Date(row.end_at).toISOString() : null;
          if (!startIso) continue;

          events.push({
            id: `${calendarSource}-${row.id}`,
            title: `${prefix}${String(row.title || '').trim() || 'Meeting'}`,
            start: startIso,
            end: endIso || undefined,
            allDay: false,
            source: calendarSource,
            sourceId: String(row.id),
            color: sourceColorMap[calendarSource] || '#4f46e5',
            status: row.status || 'confirmed',
            description: row.location ? `📍 ${row.location}` : undefined,
          });
        }
      }
    }

    if (hasRange && start && end) {
      const meetingStarts = events
        .filter(
          (event) => !event.allDay && ['outlook', 'google', 'consultify'].includes(event.source)
        )
        .map((event) => ({
          start: new Date(event.start),
          end: event.end
            ? new Date(event.end)
            : new Date(new Date(event.start).getTime() + 3600000),
        }));

      const rangeStart = new Date(start);
      const rangeEnd = new Date(end);
      const dayMs = 86400000;

      for (
        let current = new Date(rangeStart);
        current < rangeEnd;
        current = new Date(current.getTime() + dayMs)
      ) {
        const dayOfWeek = current.getUTCDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;

        const dayStr = current.toISOString().slice(0, 10);
        const dayMeetings = meetingStarts
          .filter((meeting) => meeting.start.toISOString().slice(0, 10) === dayStr)
          .sort((a, b) => a.start.getTime() - b.start.getTime());

        const workStart = new Date(`${dayStr}T08:00:00Z`);
        const workEnd = new Date(`${dayStr}T17:00:00Z`);
        const slots: Array<{ start: Date; end: Date }> = [];
        let cursor = workStart;

        for (const meeting of dayMeetings) {
          const meetingStart = meeting.start < workStart ? workStart : meeting.start;
          if (meetingStart > cursor) {
            slots.push({ start: cursor, end: meetingStart });
          }
          if (meeting.end > cursor) cursor = meeting.end;
        }

        if (cursor < workEnd) {
          slots.push({ start: cursor, end: workEnd });
        }

        let bestGap = { start: workStart, end: workStart, duration: 0 };
        for (const slot of slots) {
          const duration = slot.end.getTime() - slot.start.getTime();
          if (duration > bestGap.duration) bestGap = { ...slot, duration };
        }

        if (dayMeetings.length > 0 && bestGap.duration >= 5400000) {
          const focusStart = bestGap.start;
          const focusDuration = Math.min(bestGap.duration, 7200000);
          const focusEnd = new Date(focusStart.getTime() + focusDuration);

          events.push({
            id: `ai-focus-${dayStr}`,
            title: '🧠 Focus time (AI suggestion)',
            start: focusStart.toISOString(),
            end: focusEnd.toISOString(),
            allDay: false,
            source: 'task',
            sourceId: `ai-focus-${dayStr}`,
            color: 'rgba(124, 58, 237, 0.15)',
            status: 'ai_suggestion',
            description: 'AI-suggested deep work block based on your calendar gaps',
          });
        }
      }
    }

    const needsP02ExternalBridge = requestedSources.some((source) =>
      ['google', 'outlook', 'consultify'].includes(source)
    );
    if (needsP02ExternalBridge) {
      // P02 §2.3.13: Bridge external calendar items from calendarInteropService
      try {
        const { getCalendarItems, getCalendarSources } =
          await import('../../services/v8/calendarInteropService.js');
        const p02Sources = await getCalendarSources(organizationId);
        const p02Items = await getCalendarItems(organizationId, {
          startAt: start ?? undefined,
          endAt: end ?? undefined,
        });

        const sourceMap = new Map(p02Sources.map((s: any) => [s.calendarSourceId, s]));

        for (const item of p02Items) {
          if (item.sourceSystem === 'consultify') continue;

          const source = sourceMap.get(item.sourceId);
          const eventSource: string =
            item.sourceSystem === 'google_calendar'
              ? 'google'
              : item.sourceSystem === 'outlook_calendar'
                ? 'outlook'
                : 'consultify';

          if (!requestedSources.includes(eventSource)) continue;

          events.push({
            id: item.calendarItemId,
            title:
              item.visibilityClass === 'free_busy_only' ? 'Busy' : (item.title ?? 'External event'),
            start: item.startAt,
            end: item.endAt || undefined,
            allDay: item.allDay,
            source: eventSource,
            sourceId: item.sourceObjectRef || item.calendarItemId,
            color: undefined,
            status: item.syncState,
            description: item.visibilityClass === 'free_busy_only' ? undefined : undefined,
            visibilityClass: item.visibilityClass,
            editAuthority: item.editAuthority,
            syncState: item.syncState,
            permissionGradient: source?.permissionGradient ?? 'read',
            etag: item.etag ?? undefined,
          });
        }
      } catch (p02Err: any) {
        // P02 external items are optional; log but don't fail the entire endpoint
        const p02Logger = await import('../../utils/Logger.js');
        p02Logger.default.warn(
          '[MyWork/Calendar] P02 external events unavailable:',
          p02Err?.message
        );
      }
    }

    events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    return res.json({
      data: { events },
      meta: { version: 'v8', contract: V8_CALENDAR_CONTRACT },
    });
  })
);

router.post(
  '/calendar/events',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const schema = z.object({
      title: z.string().min(1).max(500),
      start: z.string(),
      end: z.string().optional(),
      allDay: z.boolean().optional().default(true),
      source: z.enum(['task', 'initiative', 'decision']).optional().default('task'),
      description: z.string().optional(),
      recurrence: z
        .object({
          preset: z.enum(['daily', 'weekly', 'monthly']),
        })
        .optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid event data',
        details: parsed.error.issues,
      });
    }

    const { title, start, source, description, recurrence } = parsed.data;
    if (source !== 'task') {
      return res.status(501).json({
        error: `Creating ${source} events from calendar is not yet supported`,
      });
    }

    const id = randomUUID();
    const recurrencePayload =
      recurrence?.preset === 'daily'
        ? { rrule: 'FREQ=DAILY' }
        : recurrence?.preset === 'weekly'
          ? { rrule: 'FREQ=WEEKLY' }
          : recurrence?.preset === 'monthly'
            ? { rrule: 'FREQ=MONTHLY' }
            : null;

    await queryHelpers.queryRun(
      `INSERT INTO tasks (id, title, description, due_date, assignee_id, organization_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'todo', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [id, title, description || null, start, userId, organizationId]
    );
    if (recurrencePayload) {
      const taskCols = await getTableColumns('tasks');
      if (!taskCols.has('metadata')) {
        return res.status(501).json({
          error: 'Recurring calendar tasks are not supported in this environment',
        });
      }
      await queryHelpers.queryRun(
        `UPDATE tasks SET metadata = ? WHERE id = ? AND organization_id = ?`,
        [JSON.stringify({ calendarRecurrence: recurrencePayload }), id, organizationId]
      );
    }

    return res.status(201).json({
      data: { id, source: 'task', message: 'Task created from calendar' },
      meta: { version: 'v8', contract: V8_CALENDAR_CONTRACT },
    });
  })
);

router.put(
  '/calendar/events/:source/:sourceId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const source = String(req.params.source || '').toLowerCase();
    const sourceId = String(req.params.sourceId || '').trim();
    const schema = z.object({
      start: z.string().min(1),
      end: z.string().optional(),
      allDay: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid event update payload',
        details: parsed.error.issues,
      });
    }

    if (!sourceId || !['task', 'initiative', 'decision'].includes(source)) {
      return res.status(400).json({
        error: 'Invalid source/sourceId',
      });
    }

    const { start } = parsed.data;
    const startDate = String(start).slice(0, 10);

    if (source === 'task') {
      const result = await queryHelpers.queryRun(
        `UPDATE tasks
         SET due_date = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ? AND assignee_id = ?`,
        [startDate, sourceId, organizationId, userId]
      );
      if (!result.changes) {
        return res.status(404).json({ error: 'Task event not found for user' });
      }
      return res.json({
        data: { id: sourceId, source: 'task', message: 'Task rescheduled from calendar' },
        meta: { version: 'v8', contract: V8_CALENDAR_CONTRACT },
      });
    }

    if (source === 'initiative') {
      const initCols = await getTableColumns('initiatives');
      const startColumn = initCols.has('planned_start_date')
        ? 'planned_start_date'
        : initCols.has('start_date')
          ? 'start_date'
          : null;
      if (!startColumn) {
        return res
          .status(501)
          .json({ error: 'Initiative calendar updates are not supported here' });
      }
      const result = await queryHelpers.queryRun(
        `UPDATE initiatives
         SET ${startColumn} = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ?`,
        [startDate, sourceId, organizationId]
      );
      if (!result.changes) {
        return res.status(404).json({ error: 'Initiative event not found' });
      }
      return res.json({
        data: {
          id: sourceId,
          source: 'initiative',
          message: 'Initiative rescheduled from calendar',
        },
        meta: { version: 'v8', contract: V8_CALENDAR_CONTRACT },
      });
    }

    const decisionCols = await getTableColumns('decisions');
    const ownerClause = decisionCols.has('decision_owner_id')
      ? '(decision_owner_id = ? OR decision_maker_id = ? OR assigned_to = ? OR created_by = ?)'
      : '(assigned_to = ? OR created_by = ?)';
    const ownerParams = decisionCols.has('decision_owner_id')
      ? [userId, userId, userId, userId]
      : [userId, userId];
    const result = await queryHelpers.queryRun(
      `UPDATE decisions
       SET deadline = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ? AND ${ownerClause}`,
      [startDate, sourceId, organizationId, ...ownerParams]
    );
    if (!result.changes) {
      return res.status(404).json({ error: 'Decision event not found for user' });
    }
    return res.json({
      data: { id: sourceId, source: 'decision', message: 'Decision rescheduled from calendar' },
      meta: { version: 'v8', contract: V8_CALENDAR_CONTRACT },
    });
  })
);

router.get(
  '/calendar/conflicts',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const date = req.query.date ? String(req.query.date) : new Date().toISOString().split('T')[0];

    const [tasks, decisions, meetings] = await Promise.all([
      queryHelpers.queryAll<any>(
        `SELECT id, title, due_date
         FROM tasks
         WHERE assignee_id = ? AND organization_id = ?
           AND date(due_date) = date(?)
           AND LOWER(COALESCE(status,'')) NOT IN ('done','completed','cancelled')
         ORDER BY due_date ASC`,
        [userId, organizationId, date]
      ),
      queryHelpers.queryAll<any>(
        `SELECT id, title, deadline
         FROM decisions
         WHERE organization_id = ?
           AND (created_by = ? OR assigned_to = ?)
           AND date(deadline) = date(?)
           AND LOWER(COALESCE(status,'')) NOT IN ('resolved','cancelled')
         ORDER BY deadline ASC`,
        [organizationId, userId, userId, date]
      ),
      queryHelpers.queryAll<any>(
        `SELECT id, title, start_at, end_at
         FROM meetings
         WHERE organization_id = ?
           AND created_by = ?
           AND date(start_at) = date(?)
         ORDER BY start_at ASC`,
        [organizationId, userId, date]
      ),
    ]);

    const taskRows = tasks || [];
    const decisionRows = decisions || [];
    const totalItems = taskRows.length + decisionRows.length;
    const windows: Array<{ start: number; end: number }> = [];
    const toMs = (value: unknown) => {
      const dateObj = value ? new Date(String(value)) : null;
      return dateObj && !Number.isNaN(dateObj.getTime()) ? dateObj.getTime() : null;
    };
    for (const task of taskRows) {
      const startMs = toMs(
        task?.due_date ? `${String(task.due_date).slice(0, 10)}T09:00:00.000Z` : null
      );
      if (startMs != null) windows.push({ start: startMs, end: startMs + 60 * 60 * 1000 });
    }
    for (const decision of decisionRows) {
      const startMs = toMs(
        decision?.deadline ? `${String(decision.deadline).slice(0, 10)}T11:00:00.000Z` : null
      );
      if (startMs != null) windows.push({ start: startMs, end: startMs + 60 * 60 * 1000 });
    }
    for (const meeting of meetings || []) {
      const startMs = toMs(meeting?.start_at);
      const endMs = toMs(meeting?.end_at);
      if (startMs != null) {
        windows.push({
          start: startMs,
          end: endMs != null && endMs > startMs ? endMs : startMs + 30 * 60 * 1000,
        });
      }
    }
    windows.sort((a, b) => a.start - b.start);
    let overlapCount = 0;
    for (let index = 1; index < windows.length; index += 1) {
      if (windows[index].start < windows[index - 1].end) {
        overlapCount += 1;
      }
    }
    const hasConflicts = overlapCount > 0 || totalItems > 3;

    return res.json({
      data: {
        date,
        tasks: taskRows,
        decisions: decisionRows,
        totalItems,
        hasConflicts,
        overlapCount,
        suggestion: hasConflicts
          ? 'This day looks busy. Consider rescheduling lower-priority items.'
          : null,
      },
      meta: { version: 'v8', contract: V8_CALENDAR_CONTRACT },
    });
  })
);

router.put(
  '/calendar/phases/:phaseName',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);

    try {
      const data = await myWorkRoofService.setCalendarPhase({
        ...req.body,
        phaseName: req.params.phaseName as any,
        organizationId,
      });
      return res.json({ data, meta: { version: 'v8' } });
    } catch (err) {
      const handled = handleMyWorkRoofError(err, res, 'Invalid calendar phase parameters');
      if (handled) return handled;
      throw err;
    }
  })
);

router.get(
  '/calendar/phases',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const data = await myWorkRoofService.getCalendarPhases(organizationId);
    return res.json({ data, meta: { version: 'v8' } });
  })
);

router.get(
  '/roof/summary',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const generatedAt = new Date().toISOString();

    const [storedBlocks, inboxStats, storedCalendarPhases] = await Promise.all([
      myWorkRoofService.getHomeBlockMaturity(organizationId).catch(() => []),
      myWorkRoofService.getInboxMaterializationStats(userId, organizationId).catch(() => ({
        avgLatencyMs: 0,
        latencyBandDistribution: {
          near_realtime: 0,
          operational: 0,
          degraded: 0,
        },
      })),
      myWorkRoofService.getCalendarPhases(organizationId).catch(() => []),
    ]);

    const blockMap = new Map(storedBlocks.map((block) => [block.blockName, block] as const));
    const calendarMap = new Map(
      storedCalendarPhases.map((phase) => [phase.phaseName, phase] as const)
    );

    const homeBlocks = DERIVED_HOME_BLOCKS.map((block) => {
      const stored = blockMap.get(block.blockName);
      return {
        blockName: block.blockName,
        maturityLevel: stored?.maturityLevel ?? block.maturityLevel,
        serviceRef: stored?.serviceRef ?? block.serviceRef,
        lastAuditedAt: stored?.lastAuditedAt ?? generatedAt,
        source: stored ? ('persisted' as const) : ('derived' as const),
        rationale: block.rationale,
      };
    });

    const calendar = DERIVED_CALENDAR_PHASES.map((phase) => {
      const stored = calendarMap.get(phase.phaseName);
      return {
        phaseName: phase.phaseName,
        status: stored?.status ?? phase.status,
        blockedBy: stored?.blockedBy ?? phase.blockedBy,
        source: stored ? ('persisted' as const) : ('derived' as const),
        rationale: phase.rationale,
      };
    });

    const counts = buildSummaryCounts(homeBlocks);
    const overallStatus =
      counts.placeholder_non_canonical > 0
        ? 'mixed_truth'
        : counts.partial_stitched > 0
          ? 'partially_coherent'
          : 'coherent';

    return res.json({
      data: {
        generatedAt,
        overallStatus,
        surfaceMode: 'home_v2_aggregated_with_outputs_bridge',
        contracts: {
          homeV2Endpoint: true,
          radarEndpoint: true,
          homeViewUsesAggregatedContract: true,
          outputsBridgeVisible: true,
        },
        homeBlocks,
        counts,
        inboxMaterialization: {
          ...inboxStats,
          status:
            inboxStats.avgLatencyMs > 0 ||
            Object.values(inboxStats.latencyBandDistribution).some((count) => count > 0)
              ? 'observed'
              : 'not_proven_yet',
        },
        calendar,
      },
      meta: { version: 'v8' },
    });
  })
);

export default router;
