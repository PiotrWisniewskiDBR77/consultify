import { randomUUID } from 'node:crypto';

import { type Response, Router } from 'express';
import * as XLSX from 'xlsx';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import {
  buildCanvasCanonicalWrite,
  inferCanvasVersionFormat,
  resolveCanvasCanonicalEnvelope,
} from '../services/artifacts/canvasCanonicalPersistence.js';
import {
  type ArtifactContentEnvelope,
  type CanonicalFormat,
  type CanvasArtifactBlock,
  type CanvasArtifactBlockKind,
  createArtifactContentEnvelope,
  type MarkdownProjectionStatus,
  normalizeCanvasArtifactBlocks,
  projectCanvasArtifactBlockToMarkdown,
} from '../services/artifacts/contentProjectionService.js';
import { materializeCanvasTable } from '../services/canvasTableMaterialize.js';
import {
  hasEffectiveCapability,
  resolveEffectiveAccess,
} from '../services/effectiveAccessService.js';
import { unifiedExportService } from '../services/export/UnifiedExportService.js';
import * as workCanvasService from '../services/workCanvasService.js';
import { insertDynamic } from '../utils/dbDynamic.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { decodeHtmlEntities, deepDecodeHtmlEntities } from '../utils/htmlEntities.js';
import logger from '../utils/Logger.js';

const router = Router();

type DraftKind =
  | 'markdown'
  | 'table'
  | 'checklist'
  | 'research'
  | 'decision'
  | 'document'
  | 'report'
  | 'sheet'
  | 'deck';
type ProposalStatus = 'proposed' | 'approved' | 'rejected';
type WorkspaceTarget = 'idea' | 'note' | 'initiative' | 'decision' | 'task';

type OutputType = 'presentation' | 'table' | 'report';
type ExportFormat = 'markdown' | 'csv' | 'json' | 'pdf' | 'docx' | 'xlsx' | 'pptx';
type WorkflowTemplate =
  | 'market_research_to_report'
  | 'meeting_note_to_initiatives'
  | 'kpi_review_to_dashboard'
  | 'client_proposal_to_deck'
  | 'decision_memo_to_execution_plan';
type EditOperationType = 'replace_selection' | 'append_section' | 'update_document';
type BlockOperationType =
  | 'insert_block'
  | 'update_block'
  | 'delete_block'
  | 'convert_block'
  | 'generate_block_from_selection'
  | 'generate_artifact_from_dataset'
  | 'regenerate_projection';

interface WorkCanvasDraft {
  id: string;
  organizationId: string;
  createdBy: string;
  conversationId: string;
  kind: DraftKind;
  title: string;
  content: unknown;
  contentEnvelope: ArtifactContentEnvelope;
  canonicalFormat: CanonicalFormat;
  contentMd: string;
  contentJson: unknown;
  blocks: CanvasArtifactBlock[];
  contentSchemaVersion: string | null;
  markdownProjectionStatus: MarkdownProjectionStatus;
  markdownProjectedAt: string | null;
  projectionError: string | null;
  sources: unknown[];
  provenance: Record<string, unknown>;
  projectId: string | null;
  ownerId: string | null;
  researchSessionId: string | null;
  artifactId: string | null;
  artifactRunId: string | null;
  artifactVersion: number | null;
  saveState: 'unsaved' | 'saved' | 'failed';
  lifecycleState: 'draft' | 'proposed' | 'approved';
  dirtyState: 'clean' | 'dirty';
  visibility: 'private' | 'project';
  auditStatus: 'not_required' | 'logged';
  createdAt: string;
  updatedAt: string;
}

interface WorkCanvasProposal {
  id: string;
  draftId: string;
  organizationId: string;
  createdBy: string;
  target: string;
  title: string;
  summary: string;
  status: ProposalStatus;
  payload: Record<string, unknown>;
  requiredCapability: string;
  targetObjectId: string | null;
  readBack: Record<string, unknown> | null;
  auditEventId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface WorkCanvasWorkflowStep {
  id: string;
  kind:
    | 'teresa_action'
    | 'user_approval'
    | 'generated_artifact'
    | 'failed_retry'
    | 'downstream_conversion';
  title: string;
  summary: string;
  status: 'pending' | 'completed' | 'failed' | 'skipped';
  approvalRequired?: boolean;
  approvedAt?: string | null;
  outputType?: string | null;
  outputId?: string | null;
  blockId?: string | null;
  versionId?: string | null;
  createdAt: string;
}

interface WorkCanvasWorkflowRun {
  id: string;
  draftId: string;
  conversationId: string;
  template: WorkflowTemplate;
  title: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  steps: WorkCanvasWorkflowStep[];
  approvals: Array<{
    stepId: string;
    status: 'pending' | 'approved' | 'rejected';
    requiredCapability: string;
  }>;
  outputs: Array<{
    stepId: string;
    type: string;
    id: string;
    title: string;
    url?: string;
  }>;
  events?: Array<{
    id: string;
    type:
      | 'created'
      | 'resumed'
      | 'approval_required'
      | 'approved'
      | 'output_created'
      | 'collaboration_updated'
      | 'comment_added';
    actorId: string;
    summary: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
  }>;
  collaboration?: {
    ownerId?: string | null;
    reviewerId?: string | null;
    lifecycle?: 'draft' | 'in_review' | 'approved';
    comments?: Array<{
      id: string;
      authorId: string;
      body: string;
      createdAt: string;
    }>;
  };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const CANVAS_DRAFT_CONFLICT_CODE = 'CANVAS_DRAFT_CONFLICT';

function requestedBaseUpdatedAt(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, any>;
  const direct = record.baseUpdatedAt;
  const operationBase = record.operation?.baseUpdatedAt;
  const value =
    typeof direct === 'string' ? direct : typeof operationBase === 'string' ? operationBase : '';
  return value.trim() ? value.trim() : null;
}

/**
 * M01-P06A (M01-027c) — `work_canvas_drafts.updated_at`/`created_at` is
 * canonically `TEXT` (`760_work_canvas_runtime.sql`, matches live demo
 * schema), but `ensureStorage()` below used to `CREATE TABLE IF NOT EXISTS`
 * the same table as `TIMESTAMPTZ`. On any environment where `ensureStorage()`
 * creates the table FIRST (fresh/staging with `server/migrations` not yet
 * applied), `node-postgres` has no type parser registered for OID 1184 in
 * this codebase (same root cause documented in `financePeriodFormat.ts` for
 * OID 1082 `DATE`), so every read of that column hands the application a JS
 * `Date` object instead of a string. `hasDraftConflict`/
 * `hasMissingOrStaleBaseToken` then compare that `Date` against the client's
 * ISO-string `baseUpdatedAt` with `!==` — a `Date` is never `===` a string,
 * so EVERY save looked like a conflict (false 409, not a real one).
 *
 * `ensureStorage()` now declares `TEXT` (matching the migration), and
 * `943_work_canvas_timestamp_parity_postgres.sql` corrects any environment
 * that already created the `TIMESTAMPTZ` version before this fix shipped.
 * This coercion is the second, independent layer: it makes the comparison
 * itself correct regardless of the column's actual runtime type — including
 * the window between deploying this code and a migration run actually
 * landing on a given environment, and any row that (for whatever reason)
 * still comes back as a `Date`. Never throws: an unparsable value falls back
 * to `''`, which cannot equal a real client token, so it fails safe into
 * "conflict" rather than silently accepting a stale write.
 */
function normalizeTimestampToken(value: unknown): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  }
  if (typeof value === 'string') return value;
  if (value == null) return '';
  const coerced = new Date(value as string | number);
  return Number.isNaN(coerced.getTime()) ? '' : coerced.toISOString();
}

function hasDraftConflict(draft: WorkCanvasDraft, baseUpdatedAt: string | null): boolean {
  return Boolean(baseUpdatedAt && draft.updatedAt && baseUpdatedAt !== draft.updatedAt);
}

/**
 * M01-P06 §8 (CAS: WYMAGANE) — a write to the primary save path with NO
 * conflict token is not "no conflict", it is an unverifiable write and must
 * be rejected exactly like a stale one. `hasDraftConflict` above (used by
 * operations/restore/workflows) intentionally stays permissive when the
 * token is absent — those endpoints have long-standing callers that omit
 * it and are not the client's save affordance. `PUT /drafts/:draftId` IS
 * that affordance (`persistDraft` in WorkCanvasDocumentPanel.tsx always
 * sends `baseUpdatedAt`), so it gets the strict check.
 */
function hasMissingOrStaleBaseToken(draft: WorkCanvasDraft, baseUpdatedAt: string | null): boolean {
  if (!baseUpdatedAt) return true;
  return Boolean(draft.updatedAt && baseUpdatedAt !== draft.updatedAt);
}

function sendDraftConflict(
  res: any,
  draft: WorkCanvasDraft,
  baseUpdatedAt: string | null,
  action: string
) {
  logger.warn('[work-canvas] canvas.draft.conflict_409', {
    draftId: draft.id,
    action,
    baseUpdatedAt,
    currentUpdatedAt: draft.updatedAt,
  });
  return res.status(409).json({
    error:
      'Canvas changed since this action started. Reload the latest draft or retry from the current version.',
    code: CANVAS_DRAFT_CONFLICT_CODE,
    recoverable: true,
    action,
    data: {
      currentDraft: {
        id: draft.id,
        title: draft.title,
        updatedAt: draft.updatedAt,
        saveState: draft.saveState,
        markdownProjectionStatus: draft.markdownProjectionStatus,
      },
      baseUpdatedAt,
    },
  });
}

type DraftRow = {
  id: string;
  organization_id: string;
  created_by: string;
  conversation_id: string;
  kind: DraftKind;
  title: string;
  content_json: string | null;
  canonical_format: CanonicalFormat | null;
  content_md: string | null;
  content_json_native: string | null;
  blocks_json: string | null;
  content_schema_version: string | null;
  markdown_projection_status: MarkdownProjectionStatus | null;
  markdown_projected_at: string | null;
  projection_error: string | null;
  sources_json: string | null;
  provenance_json: string | null;
  project_id: string | null;
  owner_id: string | null;
  research_session_id: string | null;
  artifact_id: string | null;
  artifact_run_id: string | null;
  artifact_version: number | null;
  save_state: 'unsaved' | 'saved' | 'failed';
  lifecycle_state: 'draft' | 'proposed' | 'approved';
  dirty_state: 'clean' | 'dirty';
  visibility: 'private' | 'project';
  audit_status: 'not_required' | 'logged';
  created_at: string;
  updated_at: string;
};

type ProposalRow = {
  id: string;
  draft_id: string;
  organization_id: string;
  created_by: string;
  target: string;
  title: string;
  summary: string;
  status: ProposalStatus;
  payload_json: string | null;
  required_capability: string;
  target_object_id: string | null;
  read_back_json: string | null;
  audit_event_id: string | null;
  created_at: string;
  updated_at: string;
};

type VersionRow = {
  id: string;
  draft_id: string;
  operation_type: string;
  summary: string;
  content_md: string;
  content_json_native: string | null;
  blocks_json: string | null;
  created_by: string;
  created_at: string;
};

let storageReadyPromise: Promise<void> | null = null;

const workflowTemplateTitles: Record<WorkflowTemplate, string> = {
  market_research_to_report: 'Market research to report',
  meeting_note_to_initiatives: 'Meeting note to initiatives',
  kpi_review_to_dashboard: 'KPI review to dashboard',
  client_proposal_to_deck: 'Client proposal to deck',
  decision_memo_to_execution_plan: 'Decision memo to execution plan',
};

const workflowTemplatePlans: Record<
  WorkflowTemplate,
  Array<{
    kind: WorkCanvasWorkflowStep['kind'];
    title: string;
    summary: string;
    approvalRequired?: boolean;
  }>
> = {
  market_research_to_report: [
    {
      kind: 'teresa_action',
      title: 'Frame research question',
      summary: 'Extract the market question, audience and decision criteria from Canvas context.',
    },
    {
      kind: 'teresa_action',
      title: 'Structure evidence map',
      summary:
        'Organize available evidence into findings, gaps, risks and recommended next research.',
    },
    {
      kind: 'user_approval',
      title: 'Approve research narrative',
      summary: 'User approves the report angle before a durable research output is created.',
      approvalRequired: true,
    },
    {
      kind: 'generated_artifact',
      title: 'Generate research report',
      summary: 'Create a report output linked back to this source Canvas and workflow run.',
    },
  ],
  meeting_note_to_initiatives: [
    {
      kind: 'teresa_action',
      title: 'Extract decisions and owners',
      summary: 'Identify decisions, open questions, owners and due signals from the meeting note.',
    },
    {
      kind: 'teresa_action',
      title: 'Cluster initiative candidates',
      summary: 'Group action items into candidate initiatives with business rationale.',
    },
    {
      kind: 'user_approval',
      title: 'Approve initiative shortlist',
      summary: 'User approves the candidate initiatives before generating a durable summary.',
      approvalRequired: true,
    },
    {
      kind: 'generated_artifact',
      title: 'Generate initiative brief',
      summary: 'Create a report-style initiative brief with owners, risks and next steps.',
    },
  ],
  kpi_review_to_dashboard: [
    {
      kind: 'teresa_action',
      title: 'Identify KPI signals',
      summary: 'Read the Canvas context and detect KPI names, thresholds and owners.',
    },
    {
      kind: 'teresa_action',
      title: 'Prepare dashboard structure',
      summary: 'Create a dashboard plan with KPIs, charts, caveats and required source checks.',
    },
    {
      kind: 'user_approval',
      title: 'Approve KPI dashboard plan',
      summary: 'User approves the KPI framing before a durable table/dashboard output is linked.',
      approvalRequired: true,
    },
    {
      kind: 'generated_artifact',
      title: 'Generate KPI output',
      summary: 'Create a table output that can be opened from the workflow ledger.',
    },
  ],
  client_proposal_to_deck: [
    {
      kind: 'teresa_action',
      title: 'Extract proposal storyline',
      summary: 'Identify client problem, promised outcome, proof points and commercial ask.',
    },
    {
      kind: 'teresa_action',
      title: 'Plan deck narrative',
      summary: 'Prepare slide flow, objections, evidence and final recommendation.',
    },
    {
      kind: 'user_approval',
      title: 'Approve deck outline',
      summary: 'User approves the proposal storyline before a durable presentation is created.',
      approvalRequired: true,
    },
    {
      kind: 'generated_artifact',
      title: 'Generate proposal deck',
      summary: 'Create a presentation output linked back to the source Canvas.',
    },
  ],
  decision_memo_to_execution_plan: [
    {
      kind: 'teresa_action',
      title: 'Extract decision logic',
      summary: 'Identify recommendation, alternatives, risks, assumptions and decision owner.',
    },
    {
      kind: 'teresa_action',
      title: 'Translate into execution plan',
      summary: 'Convert the decision memo into milestones, dependencies and operating checks.',
    },
    {
      kind: 'user_approval',
      title: 'Approve execution plan',
      summary: 'User approves scope and accountability before a durable execution plan is created.',
      approvalRequired: true,
    },
    {
      kind: 'generated_artifact',
      title: 'Generate execution plan',
      summary: 'Create a report output for downstream execution.',
    },
  ],
};

function workflowEvent(params: {
  type: NonNullable<WorkCanvasWorkflowRun['events']>[number]['type'];
  actorId: string;
  summary: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}): NonNullable<WorkCanvasWorkflowRun['events']>[number] {
  return {
    id: randomUUID(),
    type: params.type,
    actorId: params.actorId,
    summary: params.summary,
    createdAt: params.createdAt,
    ...(params.metadata ? { metadata: params.metadata } : {}),
  };
}

function authContext(req: AuthRequest) {
  return {
    userId: req.userId || req.user?.id || 'unknown-user',
    organizationId: req.organizationId || req.user?.organizationId || 'unknown-org',
  };
}

/**
 * SEC-M02-3 (L-10a) — single source of truth for `canvas.*` capability checks.
 * Resolves the SAME effective access the panel consults via GET
 * /api/access/effective (effectiveAccessService), NOT the legacy req.can /
 * PermissionService role-fallback. An empty capability means "no extra gate".
 * Returns a boolean so callers can shape their own 403 (e.g. proposal approval
 * keeps its CANVAS_PROPOSAL_CAPABILITY_REQUIRED contract).
 */
async function hasCanvasCapability(req: AuthRequest, capability: string): Promise<boolean> {
  if (!capability.trim()) return true;
  const { userId, organizationId } = authContext(req);
  const access = await resolveEffectiveAccess({
    userId,
    organizationId,
    applicationRole: req.userRole || req.user?.role,
    isImpersonating: Boolean(req.user?.impersonatorId),
  });
  return hasEffectiveCapability(access, capability);
}

/**
 * P0-2 — server-side enforcement of the same `canvas.*` capability the panel
 * resolves via GET /api/access/effective. Returns true when allowed; otherwise
 * writes a 403 in the same shape access/roles routes use and returns false.
 */
async function requireCanvasCapability(
  req: AuthRequest,
  res: Response,
  capability: string
): Promise<boolean> {
  if (await hasCanvasCapability(req, capability)) return true;
  res.status(403).json({
    error: 'Canvas permission required',
    code: 'CANVAS_CAPABILITY_REQUIRED',
    required: capability,
  });
  return false;
}

function envelope<T>(data: T, extra: Record<string, unknown> = {}) {
  return { success: true, data, ...extra };
}

function sendProposalServiceError(res: Response, error: unknown) {
  const typed = error as { statusCode?: unknown; code?: unknown; recovery?: unknown };
  const statusCode = Number(typed?.statusCode) || 500;
  return res.status(statusCode).json({
    error: error instanceof Error ? error.message : 'Canvas proposal operation failed',
    code: typeof typed?.code === 'string' ? typed.code : 'CANVAS_PROPOSAL_OPERATION_FAILED',
    recoverable: statusCode >= 409,
    ...(typeof typed?.recovery === 'string' ? { recovery: typed.recovery } : {}),
  });
}

function parseJson(value: string | null, fallback: unknown): unknown {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function workflowRunsFromProvenance(provenance: Record<string, unknown>): WorkCanvasWorkflowRun[] {
  const value = provenance.workflowRuns;
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is WorkCanvasWorkflowRun => {
    if (!item || typeof item !== 'object') return false;
    const record = item as Record<string, unknown>;
    return (
      typeof record.id === 'string' &&
      typeof record.draftId === 'string' &&
      typeof record.conversationId === 'string' &&
      Array.isArray(record.steps)
    );
  });
}

function createWorkflowRun(params: {
  draft: WorkCanvasDraft;
  template: WorkflowTemplate;
  userId: string;
  now: string;
}): WorkCanvasWorkflowRun {
  const step = (
    kind: WorkCanvasWorkflowStep['kind'],
    title: string,
    summary: string,
    status: WorkCanvasWorkflowStep['status'] = 'pending',
    approvalRequired = false
  ): WorkCanvasWorkflowStep => ({
    id: randomUUID(),
    kind,
    title,
    summary,
    status,
    approvalRequired,
    createdAt: params.now,
  });
  const run: WorkCanvasWorkflowRun = {
    id: randomUUID(),
    draftId: params.draft.id,
    conversationId: params.draft.conversationId,
    template: params.template,
    title: workflowTemplateTitles[params.template],
    status: 'active',
    steps: [],
    approvals: [],
    outputs: [],
    events: [
      workflowEvent({
        type: 'created',
        actorId: params.userId,
        summary: `Workflow created from template: ${workflowTemplateTitles[params.template]}.`,
        createdAt: params.now,
        metadata: { template: params.template, draftId: params.draft.id },
      }),
      workflowEvent({
        type: 'approval_required',
        actorId: params.userId,
        summary: 'Workflow requires approval before durable output creation.',
        createdAt: params.now,
      }),
    ],
    collaboration: {
      ownerId: params.userId,
      reviewerId: null,
      lifecycle: 'draft',
      comments: [],
    },
    createdBy: params.userId,
    createdAt: params.now,
    updatedAt: params.now,
  };
  run.steps = [
    ...workflowTemplatePlans[params.template].map((plannedStep, index) =>
      step(
        plannedStep.kind,
        plannedStep.title,
        plannedStep.summary,
        index === 0 ? 'completed' : 'pending',
        plannedStep.approvalRequired || false
      )
    ),
    step(
      'downstream_conversion',
      'Link downstream output',
      'Attach generated output ids and links back to this workflow step.',
      'pending'
    ),
  ];
  const approvalStep = run.steps.find((plannedStep) => plannedStep.approvalRequired);
  run.approvals = [
    {
      stepId: approvalStep?.id || run.steps[0].id,
      status: 'pending',
      requiredCapability: 'work_canvas.workflow.approve',
    },
  ];
  return run;
}

function appendWorkflowRun(
  draft: WorkCanvasDraft,
  workflowRun: WorkCanvasWorkflowRun
): Record<string, unknown> {
  return {
    ...(draft.provenance || {}),
    workflowRuns: [...workflowRunsFromProvenance(draft.provenance || {}), workflowRun],
  };
}

function workflowOutputType(template: WorkflowTemplate): OutputType {
  if (template === 'client_proposal_to_deck') return 'presentation';
  if (template === 'kpi_review_to_dashboard') return 'table';
  return 'report';
}

function toDraft(row: DraftRow): WorkCanvasDraft {
  const blocks = normalizeCanvasArtifactBlocks(parseJson(row.blocks_json, []));
  const contentEnvelope = resolveCanvasCanonicalEnvelope(row);
  const projectionStatus = contentEnvelope.markdownProjectionStatus;
  return {
    id: row.id,
    organizationId: row.organization_id,
    createdBy: row.created_by,
    conversationId: row.conversation_id,
    kind: row.kind,
    title: row.title,
    content:
      contentEnvelope.canonicalFormat === 'json'
        ? contentEnvelope.contentJson
        : contentEnvelope.contentMd,
    contentEnvelope,
    canonicalFormat: contentEnvelope.canonicalFormat,
    contentMd: contentEnvelope.contentMd,
    contentJson: contentEnvelope.contentJson,
    blocks: normalizeCanvasArtifactBlocks(contentEnvelope.blocks || blocks),
    contentSchemaVersion: contentEnvelope.contentSchemaVersion,
    markdownProjectionStatus: projectionStatus,
    markdownProjectedAt: contentEnvelope.markdownProjectedAt || null,
    projectionError: contentEnvelope.projectionError || null,
    sources: parseJson(row.sources_json, []) as unknown[],
    provenance: parseJson(row.provenance_json, {}) as Record<string, unknown>,
    projectId: row.project_id,
    ownerId: row.owner_id,
    researchSessionId: row.research_session_id,
    artifactId: row.artifact_id,
    artifactRunId: row.artifact_run_id,
    artifactVersion: row.artifact_version,
    saveState: row.save_state,
    lifecycleState: row.lifecycle_state,
    dirtyState: row.dirty_state,
    visibility: row.visibility,
    auditStatus: row.audit_status,
    // M01-027c — see `normalizeTimestampToken` above: `row.updated_at`/
    // `row.created_at` are typed `string` (DraftRow) but can arrive as a
    // JS `Date` when the underlying column is `TIMESTAMPTZ` instead of the
    // canonical `TEXT`. Coerce here, once, at the read boundary, so every
    // consumer of `WorkCanvasDraft.updatedAt` (CAS comparisons, JSON
    // responses, version-cadence math) sees a stable ISO string.
    createdAt: normalizeTimestampToken(row.created_at),
    updatedAt: normalizeTimestampToken(row.updated_at),
  };
}

function toProposal(row: ProposalRow): WorkCanvasProposal {
  return {
    id: row.id,
    draftId: row.draft_id,
    organizationId: row.organization_id,
    createdBy: row.created_by,
    target: row.target,
    title: row.title,
    summary: row.summary,
    status: row.status,
    payload: parseJson(row.payload_json, {}) as Record<string, unknown>,
    requiredCapability: row.required_capability,
    targetObjectId: row.target_object_id,
    readBack: parseJson(row.read_back_json, null) as Record<string, unknown> | null,
    auditEventId: row.audit_event_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toVersion(row: VersionRow) {
  return {
    id: row.id,
    draftId: row.draft_id,
    operationType: row.operation_type,
    summary: row.summary,
    contentMd: row.content_md,
    contentJson: parseJson(row.content_json_native, undefined),
    blocks: normalizeCanvasArtifactBlocks(parseJson(row.blocks_json, [])),
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function firstMarkdownHeading(markdown: string, fallback: string): string {
  const heading = String(markdown || '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('# '));
  return (heading ? heading.replace(/^#\s+/, '') : fallback).trim().slice(0, 180) || fallback;
}

function markdownSummary(markdown: string, max = 1200): string {
  return String(markdown || '')
    .replace(/^#+\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

function markdownSections(markdown: string): Array<{ heading: string; body: string }> {
  const lines = String(markdown || '').split('\n');
  const sections: Array<{ heading: string; body: string[] }> = [];
  let current: { heading: string; body: string[] } | null = null;
  for (const line of lines) {
    const match = line.match(/^#{1,3}\s+(.+)$/);
    if (match) {
      if (current) sections.push(current);
      current = { heading: match[1].trim(), body: [] };
      continue;
    }
    if (current) current.body.push(line);
  }
  if (current) sections.push(current);
  return sections
    .map((section) => ({ heading: section.heading, body: section.body.join('\n').trim() }))
    .filter((section) => section.heading);
}

function sourceCanvasUrl(draftId: string): string {
  return `/work-canvas?draftId=${encodeURIComponent(draftId)}`;
}

function suggestedWave5ArtifactType(outputType?: OutputType) {
  if (outputType === 'presentation') return 'slide_deck';
  if (outputType === 'table') return 'spreadsheet';
  if (outputType === 'report') return 'report';
  return null;
}

function outputMetadata(
  draft: WorkCanvasDraft,
  params: {
    outputType?: OutputType;
    outputId?: string;
    outputTitle?: string;
    sourceVersionId?: string;
    createdBy: string;
    createdAt: string;
    lifecycleState?: WorkCanvasDraft['lifecycleState'];
  }
) {
  const lifecycleState = params.lifecycleState || draft.lifecycleState || 'draft';
  const suggestedArtifactType = suggestedWave5ArtifactType(params.outputType);
  return {
    ownerId: draft.ownerId || draft.createdBy,
    lifecycleState,
    approvedFinalStatus: lifecycleState === 'approved' ? 'approved' : 'draft',
    source: {
      type: 'work_canvas',
      draftId: draft.id,
      title: draft.title,
      conversationId: draft.conversationId,
      versionId: params.sourceVersionId || null,
      url: sourceCanvasUrl(draft.id),
    },
    createdFrom: {
      operation: params.outputType ? `create_output:${params.outputType}` : 'work_canvas_export',
      outputType: params.outputType || null,
      outputId: params.outputId || null,
      outputTitle: params.outputTitle || null,
      createdBy: params.createdBy,
      createdAt: params.createdAt,
    },
    artifactRuntimeHint: suggestedArtifactType
      ? {
          runtime: 'wave5',
          suggestedArtifactType,
          conversationId: draft.conversationId,
          projectId: draft.projectId || null,
          researchSessionId: draft.researchSessionId || null,
          sourceRefsTemplate: [
            {
              sourceClass: 'work_canvas',
              draftId: draft.id,
              canvasVersionId: params.sourceVersionId || null,
              outputResourceType: params.outputType || null,
              outputResourceId: params.outputId || null,
              title: draft.title,
              url: sourceCanvasUrl(draft.id),
            },
          ],
        }
      : null,
    openInSourceCanvasUrl: sourceCanvasUrl(draft.id),
  };
}

function csvCell(value: unknown): string {
  const textValue = String(value ?? '');
  if (/[",\n\r]/.test(textValue)) return `"${textValue.replace(/"/g, '""')}"`;
  return textValue;
}

function tableBlockToCsv(block: CanvasArtifactBlock): string | null {
  const data =
    typeof block.data === 'object' && block.data !== null
      ? (block.data as Record<string, unknown>)
      : {};
  const rows = Array.isArray(data.rows) ? data.rows : [];
  const columns = Array.isArray(data.columns) ? data.columns : [];
  const columnNames =
    columns.length > 0
      ? columns.map((column) =>
          typeof column === 'object' && column !== null
            ? String(
                (column as Record<string, unknown>).label ||
                  (column as Record<string, unknown>).name ||
                  (column as Record<string, unknown>).id ||
                  'Column'
              )
            : String(column)
        )
      : rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null
        ? Object.keys(rows[0])
        : ['Item'];
  if (rows.length === 0) return null;
  return [
    columnNames.map(csvCell).join(','),
    ...rows.map((row) => {
      const record: Record<string, unknown> =
        typeof row === 'object' && row !== null ? (row as Record<string, unknown>) : { Item: row };
      return columnNames.map((column) => csvCell(record[column])).join(',');
    }),
  ].join('\n');
}

function exportMarkdown(draft: WorkCanvasDraft): string {
  const projections = draft.blocks.map(projectCanvasArtifactBlockToMarkdown).filter(Boolean);
  const metadata = [
    `Source Canvas: ${draft.id}`,
    `Owner: ${draft.ownerId || draft.createdBy}`,
    `Lifecycle: ${draft.lifecycleState}`,
    `Version: ${draft.artifactVersion || 'draft'}`,
  ];
  return [`<!-- ${metadata.join(' | ')} -->`, draft.contentMd, ...projections].join('\n\n').trim();
}

function exportCsv(draft: WorkCanvasDraft): string {
  const tableBlock = draft.blocks.find((block) => block.kind === 'table');
  const tableCsv = tableBlock ? tableBlockToCsv(tableBlock) : null;
  if (tableCsv) return tableCsv;

  const sections = markdownSections(draft.contentMd);
  const rows = sections.length
    ? sections.map((section) => [section.heading, markdownSummary(section.body, 500), draft.title])
    : [[draft.title, markdownSummary(draft.contentMd, 500), 'Canvas']];
  return [['Topic', 'Detail', 'Source'], ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\n');
}

function exportJson(draft: WorkCanvasDraft, userId: string) {
  const metadata = outputMetadata(draft, {
    createdBy: userId,
    createdAt: new Date().toISOString(),
  });
  return {
    schemaVersion: 'work-canvas-export/v1',
    metadata,
    draft: {
      id: draft.id,
      title: draft.title,
      kind: draft.kind,
      canonicalFormat: draft.canonicalFormat,
      lifecycleState: draft.lifecycleState,
      ownerId: draft.ownerId,
      contentMd: draft.contentMd,
      contentJson: draft.contentJson,
      blocks: draft.blocks,
      sources: draft.sources,
      provenance: draft.provenance,
      updatedAt: draft.updatedAt,
    },
  };
}

// The binary generators (PDF/DOCX/XLSX/PPTX) were extracted into the
// domain-agnostic UnifiedExportService (STEP 1 of system-unification). These
// thin wrappers project the Canvas-domain draft into a generic ExportSource and
// delegate, preserving byte-for-byte output.

async function exportPdfBuffer(draft: WorkCanvasDraft): Promise<Buffer> {
  return unifiedExportService.exportPdf({
    title: draft.title,
    markdown: exportMarkdown(draft),
    sourceLabel: `Source Canvas: ${draft.id}`,
    lifecycle: draft.lifecycleState,
    updatedAt: draft.updatedAt,
  });
}

async function exportDocxBuffer(draft: WorkCanvasDraft): Promise<Buffer> {
  return unifiedExportService.exportDocx({
    title: draft.title,
    markdown: exportMarkdown(draft),
    sourceLabel: `Source Canvas: ${draft.id}`,
    lifecycle: draft.lifecycleState,
  });
}

async function exportXlsxBuffer(draft: WorkCanvasDraft): Promise<Buffer> {
  // W4/B4 (premium) — flag-gated, FAIL-OPEN. Gdy ENABLE_DELIVERABLES_PREMIUM
  // jest ON i draft niesie typowany schemat B4 w provenance (zapisany przez
  // startSheet), eksportujemy go realnym builderem exceljs (style/CF/kolory
  // singleSelect) zamiast fasady SheetJS. Każdy błąd / brak schematu / flaga OFF
  // ⇒ ścieżka legacy poniżej (zachowanie byte-identyczne jak dziś).
  try {
    const provenance = (draft.provenance || {}) as Record<string, any>;
    const tableSchemaB4 = provenance?.deliverablesGeneration?.tableSchemaB4;
    if (tableSchemaB4 && typeof tableSchemaB4 === 'object') {
      const { resolveDeliverableTier } = await import('../services/deliverableGenerationTier.js');
      if (resolveDeliverableTier({ preferPremium: true }) === 'PREMIUM') {
        const { tableSchemaToWorkbook, buildWorkbookBuffer } =
          await import('../services/workbook/WorkbookBuilder.js');
        const wbSchema = tableSchemaToWorkbook(tableSchemaB4 as any, {
          title: draft.title,
          author: 'Business Work Canvas',
        });
        const buffer = await buildWorkbookBuffer(wbSchema);
        logger.info('[work-canvas] xlsx export via premium B4 workbook', {
          draftId: draft.id,
          sheets: wbSchema.sheets?.length ?? 0,
        });
        return buffer;
      }
    }
  } catch (premiumErr) {
    logger.warn('[work-canvas] premium xlsx export failed, falling back to legacy', {
      draftId: draft.id,
      error: premiumErr instanceof Error ? premiumErr.message : String(premiumErr),
    });
  }

  // XLSX renders a two-cell footer (`['Source Canvas', <id>]`), so the raw draft
  // id is passed as sourceLabel here (not the prefixed `Source Canvas: <id>`
  // label used by PDF/DOCX/PPTX), keeping the spreadsheet byte-for-byte.
  return unifiedExportService.exportXlsx({
    title: draft.title,
    markdown: exportMarkdown(draft),
    csv: exportCsv(draft),
    sourceLabel: draft.id,
    lifecycle: draft.lifecycleState,
    author: 'Business Work Canvas',
  });
}

async function exportPptxBuffer(draft: WorkCanvasDraft): Promise<Buffer> {
  // The Canvas-specific sectionizer (markdownSections/markdownSummary) stays in
  // the route; pre-built slides are handed to the generic service so the cap and
  // footer rendering live in one place.
  const sections = markdownSections(draft.contentMd);
  const slides = sections.length
    ? sections.map((section, index) => ({
        title: section.heading || `Slide ${index + 1}`,
        body: markdownSummary(section.body, 700),
      }))
    : [{ title: draft.title, body: markdownSummary(draft.contentMd, 700) }];
  return unifiedExportService.exportPptx({
    title: draft.title,
    markdown: markdownSummary(draft.contentMd, 700),
    sourceLabel: `Source Canvas: ${draft.id}`,
    author: 'Business Work Canvas',
    slides,
  });
}

async function exportFormatPayload(draft: WorkCanvasDraft, userId: string, format: ExportFormat) {
  if (format === 'json') {
    return {
      body: JSON.stringify(exportJson(draft, userId), null, 2),
      contentType: 'application/json; charset=utf-8',
      extension: 'metadata.json',
    };
  }
  if (format === 'csv') {
    return { body: exportCsv(draft), contentType: 'text/csv; charset=utf-8', extension: 'csv' };
  }
  if (format === 'pdf') {
    return { body: await exportPdfBuffer(draft), contentType: 'application/pdf', extension: 'pdf' };
  }
  if (format === 'docx') {
    return {
      body: await exportDocxBuffer(draft),
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extension: 'docx',
    };
  }
  if (format === 'xlsx') {
    return {
      body: await exportXlsxBuffer(draft),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
    };
  }
  if (format === 'pptx') {
    return {
      body: await exportPptxBuffer(draft),
      contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      extension: 'pptx',
    };
  }
  return {
    body: exportMarkdown(draft),
    contentType: 'text/markdown; charset=utf-8',
    extension: 'md',
  };
}

type DatasetFormat = 'csv' | 'json' | 'xlsx';
type DatasetArtifactKind = 'table' | 'chart' | 'dashboard' | 'research';
type DatasetAnalysisKind = 'profile_summary' | 'aggregate_numeric' | 'filtered_table';

interface DatasetProfile {
  datasetId: string;
  filename: string;
  format: DatasetFormat;
  rowCount: number;
  columns: Array<{
    name: string;
    type: 'number' | 'boolean' | 'date' | 'text' | 'empty';
    missingValues: number;
    sampleValues: unknown[];
  }>;
  sampleRows: Record<string, unknown>[];
  limitations: string[];
}

interface DatasetAnalysisResult {
  profile: DatasetProfile;
  rows: Record<string, unknown>[];
  summary: string;
}

function parseCsvRows(content: string): Record<string, unknown>[] {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(current);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      current = '';
      continue;
    }
    current += char;
  }
  row.push(current);
  if (row.some((cell) => cell.trim())) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header, index) => header.trim() || `Column ${index + 1}`);
  return rows.slice(1).map((cells) =>
    headers.reduce<Record<string, unknown>>((record, header, index) => {
      record[header] = cells[index] ?? '';
      return record;
    }, {})
  );
}

function parseDatasetRows(params: {
  format: DatasetFormat;
  content: string;
}): Record<string, unknown>[] {
  if (params.format === 'csv') return parseCsvRows(params.content);
  if (params.format === 'xlsx') {
    const workbook = XLSX.read(Buffer.from(params.content, 'base64'), { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils
      .sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      .filter((row) => row && typeof row === 'object' && !Array.isArray(row));
  }
  const parsed = JSON.parse(params.content);
  const rows = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.rows)
      ? parsed.rows
      : Array.isArray(parsed?.data)
        ? parsed.data
        : [];
  return rows
    .filter((row: unknown) => row && typeof row === 'object' && !Array.isArray(row))
    .map((row: unknown) => row as Record<string, unknown>);
}

function inferColumnType(values: unknown[]): DatasetProfile['columns'][number]['type'] {
  const present = values.filter(
    (value) => value !== null && value !== undefined && String(value).trim() !== ''
  );
  if (present.length === 0) return 'empty';
  if (present.every((value) => !Number.isNaN(Number(value)))) return 'number';
  if (present.every((value) => ['true', 'false'].includes(String(value).toLowerCase())))
    return 'boolean';
  if (present.every((value) => !Number.isNaN(Date.parse(String(value))))) return 'date';
  return 'text';
}

function createDatasetProfileFromRows(params: {
  filename: string;
  format: DatasetFormat;
  parsedRows: Record<string, unknown>[];
  limitations: string[];
}): {
  profile: DatasetProfile;
  rows: Record<string, unknown>[];
} {
  const rows = params.parsedRows.slice(0, 500);
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 50);
  const limitations = [...params.limitations];
  if (params.parsedRows.length > rows.length) {
    limitations.push(
      `Profile limited to first ${rows.length} of ${params.parsedRows.length} rows.`
    );
  }
  if (columns.length >= 50) limitations.push('Column profile limited to first 50 columns.');
  const profile: DatasetProfile = {
    datasetId: randomUUID(),
    filename: params.filename,
    format: params.format,
    rowCount: params.parsedRows.length,
    columns: columns.map((name) => {
      const values = rows.map((row) => row[name]);
      return {
        name,
        type: inferColumnType(values),
        missingValues: values.filter(
          (value) => value === null || value === undefined || String(value).trim() === ''
        ).length,
        sampleValues: values
          .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
          .slice(0, 3),
      };
    }),
    sampleRows: rows.slice(0, 10),
    limitations,
  };
  return { profile, rows };
}

function createDatasetProfile(params: { filename?: string; format?: string; content?: string }): {
  profile: DatasetProfile;
  rows: Record<string, unknown>[];
} {
  const format = String(params.format || '').toLowerCase() as DatasetFormat;
  if (!['csv', 'json', 'xlsx'].includes(format)) {
    throw new Error('Dataset format must be csv, json, or xlsx');
  }
  const content = String(params.content || '');
  if (!content.trim()) throw new Error('Dataset content is required');
  if (content.length > 3_000_000) {
    throw new Error('Dataset content exceeds the 3MB Stage 16 import limit');
  }
  const parsedRows = parseDatasetRows({ format, content });
  if (parsedRows.length === 0) throw new Error('Dataset has no readable rows');
  return createDatasetProfileFromRows({
    filename: String(params.filename || `canvas-dataset.${format}`),
    format,
    parsedRows,
    limitations: [
      'Stage 7 uses deterministic server-side profiling only; no arbitrary code execution was run.',
    ],
  });
}

function numericValue(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function applyDatasetAnalysis(params: {
  analysisKind?: string;
  profile: DatasetProfile;
  rows: Record<string, unknown>[];
}): DatasetAnalysisResult {
  const analysisKind = String(params.analysisKind || '').trim() as DatasetAnalysisKind | '';
  if (!analysisKind) {
    return {
      profile: params.profile,
      rows: params.rows,
      summary: 'Dataset profiled without an additional Stage 18 transformation.',
    };
  }
  if (!['profile_summary', 'aggregate_numeric', 'filtered_table'].includes(analysisKind)) {
    throw new Error(
      'Dataset analysis kind must be profile_summary, aggregate_numeric, or filtered_table'
    );
  }
  const numericColumn = params.profile.columns.find((column) => column.type === 'number');
  const groupColumn =
    params.profile.columns.find((column) => column.type === 'text') || params.profile.columns[0];

  if (analysisKind === 'aggregate_numeric') {
    if (!numericColumn || !groupColumn) {
      throw new Error(
        'Aggregate analysis requires at least one numeric column and one grouping column'
      );
    }
    const grouped = new Map<string, { total: number; count: number }>();
    params.rows.forEach((row, index) => {
      const rawLabel = String(row[groupColumn.name] || `Group ${index + 1}`).trim();
      const label = rawLabel || `Group ${index + 1}`;
      const current = grouped.get(label) || { total: 0, count: 0 };
      grouped.set(label, {
        total: current.total + numericValue(row[numericColumn.name]),
        count: current.count + 1,
      });
    });
    const aggregateRows = Array.from(grouped.entries())
      .map(([label, value]) => ({
        [groupColumn.name]: label,
        [`${numericColumn.name} total`]: Number(value.total.toFixed(2)),
        'Row count': value.count,
      }))
      .sort(
        (left, right) =>
          numericValue(right[`${numericColumn.name} total`]) -
          numericValue(left[`${numericColumn.name} total`])
      )
      .slice(0, 50);
    const { profile, rows } = createDatasetProfileFromRows({
      filename: `${params.profile.filename} aggregate`,
      format: params.profile.format,
      parsedRows: aggregateRows,
      limitations: [
        ...params.profile.limitations,
        `Stage 18 aggregate grouped by "${groupColumn.name}" and summed "${numericColumn.name}".`,
      ],
    });
    return {
      profile,
      rows,
      summary: `Aggregated ${numericColumn.name} by ${groupColumn.name}.`,
    };
  }

  if (analysisKind === 'filtered_table') {
    const scoredRows = params.rows.map((row) => {
      const missingValues = params.profile.columns.filter((column) => {
        const value = row[column.name];
        return value === null || value === undefined || String(value).trim() === '';
      }).length;
      return { ...row, 'Completeness score': params.profile.columns.length - missingValues };
    });
    const filteredRows = scoredRows
      .filter((row) => numericValue(row['Completeness score']) > 0)
      .sort(
        (left, right) =>
          numericValue(right['Completeness score']) - numericValue(left['Completeness score'])
      )
      .slice(0, 100);
    const { profile, rows } = createDatasetProfileFromRows({
      filename: `${params.profile.filename} filtered`,
      format: params.profile.format,
      parsedRows: filteredRows,
      limitations: [
        ...params.profile.limitations,
        'Stage 18 filtered table keeps rows with at least one populated value and ranks completeness.',
      ],
    });
    return {
      profile,
      rows,
      summary: 'Filtered rows by deterministic completeness score.',
    };
  }

  const completeness = params.profile.columns.map((column) => ({
    Column: column.name,
    Type: column.type,
    'Missing values': column.missingValues,
    'Sample values': column.sampleValues.join(', '),
  }));
  const { profile, rows } = createDatasetProfileFromRows({
    filename: `${params.profile.filename} summary`,
    format: params.profile.format,
    parsedRows: completeness,
    limitations: [
      ...params.profile.limitations,
      'Stage 18 profile summary converts column profile metadata into a reviewable table.',
    ],
  });
  return {
    profile,
    rows,
    summary: 'Created a column-level profile summary.',
  };
}

function createDatasetArtifactBlock(params: {
  artifactKind: DatasetArtifactKind;
  profile: DatasetProfile;
  rows: Record<string, unknown>[];
  title: string;
  analysisKind?: DatasetAnalysisKind | null;
  analysisSummary?: string;
  conversationId: string;
  draftId: string;
  userId: string;
}): CanvasArtifactBlock {
  const numericColumns = params.profile.columns.filter((column) => column.type === 'number');
  const firstTextColumn =
    params.profile.columns.find((column) => column.type === 'text') || params.profile.columns[0];
  const firstNumericColumn = numericColumns[0];
  const common = {
    id: randomUUID(),
    kind: params.artifactKind,
    schemaVersion: 'canvas-block/v1' as const,
    title: params.title,
    status: 'ready' as const,
    capabilities: ['view', 'export', 'convert'] as const,
    provenance: {
      source: 'import',
      conversationId: params.conversationId,
      draftId: params.draftId,
      datasetId: params.profile.datasetId,
      filename: params.profile.filename,
      analysisKind: params.analysisKind || null,
      createdBy: params.userId,
      createdAt: new Date().toISOString(),
    },
    markdownProjection: '',
    markdownProjectionStatus: 'synced' as const,
  };
  let data: Record<string, unknown>;
  if (params.artifactKind === 'table') {
    data = {
      columns: params.profile.columns.map((column) => column.name),
      rows: params.rows.slice(0, 100),
      profile: params.profile,
      analysis: params.analysisSummary,
    };
  } else if (params.artifactKind === 'chart') {
    data = {
      chartType: 'bar',
      insight: firstNumericColumn
        ? `Quick distribution for ${firstNumericColumn.name}.`
        : 'No numeric column was detected; chart uses row count preview.',
      metrics: params.rows.slice(0, 12).map((row, index) => ({
        label: String(row[firstTextColumn?.name || ''] || `Row ${index + 1}`).slice(0, 48),
        value: firstNumericColumn ? Number(row[firstNumericColumn.name]) || 0 : index + 1,
      })),
      profile: params.profile,
      limitations: params.profile.limitations,
      analysis: params.analysisSummary,
    };
  } else if (params.artifactKind === 'dashboard') {
    data = {
      kpis: [
        { label: 'Rows', value: params.profile.rowCount },
        { label: 'Columns', value: params.profile.columns.length },
        { label: 'Numeric columns', value: numericColumns.length },
        {
          label: 'Missing values',
          value: params.profile.columns.reduce((sum, column) => sum + column.missingValues, 0),
        },
      ],
      charts: firstNumericColumn
        ? [
            {
              title: `${firstNumericColumn.name} preview`,
              metrics: params.rows.slice(0, 8).map((row, index) => ({
                label: String(row[firstTextColumn?.name || ''] || `Row ${index + 1}`).slice(0, 32),
                value: Number(row[firstNumericColumn.name]) || 0,
              })),
            },
          ]
        : [],
      table: {
        columns: params.profile.columns.map((column) => column.name),
        rows: params.rows.slice(0, 10),
      },
      insights: [
        `Dataset "${params.profile.filename}" has ${params.profile.rowCount} rows and ${params.profile.columns.length} columns.`,
        firstNumericColumn
          ? `Numeric analysis can start from "${firstNumericColumn.name}".`
          : 'No numeric column was detected, so dashboard metrics are structural only.',
      ],
      recommendedActions: [
        'Validate column meanings with the business owner.',
        'Confirm missing values before making operational decisions.',
      ],
      limitations: params.profile.limitations,
      profile: params.profile,
      analysis: params.analysisSummary,
    };
  } else {
    data = {
      question: `What business findings are visible in ${params.profile.filename}?`,
      confidence: 'medium',
      facts: params.profile.columns.map(
        (column) => `${column.name}: ${column.type}, ${column.missingValues} missing`
      ),
      findings: [
        `Dataset contains ${params.profile.rowCount} rows.`,
        `Detected ${numericColumns.length} numeric columns.`,
      ],
      sources: [params.profile.filename],
      gaps: params.profile.limitations,
      recommendations: ['Review sample rows before treating this as a final finding.'],
      analysis: params.analysisSummary,
    };
  }
  const [block] = normalizeCanvasArtifactBlocks([{ ...common, data }]);
  if (!block) throw new Error('Dataset artifact block failed validation');
  return block;
}

function diffSummary(before: string, after: string) {
  const beforeLines = String(before || '').split('\n');
  const afterLines = String(after || '').split('\n');
  const beforeSet = new Set(beforeLines);
  const afterSet = new Set(afterLines);
  const addedLineSamples = afterLines
    .filter((line) => !beforeSet.has(line) && line.trim())
    .slice(0, 3);
  const removedLineSamples = beforeLines
    .filter((line) => !afterSet.has(line) && line.trim())
    .slice(0, 3);
  const addedLines = afterLines.filter((line) => !beforeSet.has(line)).length;
  const removedLines = beforeLines.filter((line) => !afterSet.has(line)).length;
  return {
    addedLines,
    removedLines,
    summary: `${addedLines} lines added, ${removedLines} lines removed`,
    addedLineSamples,
    removedLineSamples,
  };
}

function selectionLines(selectedText: string): string[] {
  return String(selectedText || '')
    .split('\n')
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean);
}

function generatedBlockFromSelection(params: {
  kind: CanvasArtifactBlockKind;
  selectedText: string;
  title: string;
  conversationId: string;
  draftId: string;
  userId: string;
}): CanvasArtifactBlock {
  const lines = selectionLines(params.selectedText);
  if (lines.length === 0) throw new Error('selectedText is required for block generation');
  const id = randomUUID();
  const common = {
    id,
    kind: params.kind,
    schemaVersion: 'canvas-block/v1' as const,
    title: params.title,
    status: 'draft' as const,
    capabilities:
      params.kind === 'table'
        ? ['view', 'sort', 'filter', 'export', 'convert']
        : ['view', 'convert'],
    provenance: {
      source: 'user',
      conversationId: params.conversationId,
      draftId: params.draftId,
      createdBy: params.userId,
      createdAt: new Date().toISOString(),
    },
    markdownProjection: '',
    markdownProjectionStatus: 'synced' as const,
  };
  let data: Record<string, unknown>;
  if (params.kind === 'table') {
    data = {
      columns: ['Item', 'Source'],
      rows: lines.map((line) => ({ Item: line, Source: 'Canvas selection' })),
    };
  } else if (params.kind === 'chart') {
    data = {
      chartType: 'bar',
      metrics: lines.map((line, index) => ({ label: line.slice(0, 48), value: index + 1 })),
    };
  } else if (params.kind === 'diagram') {
    data = {
      nodes: lines.map((line, index) => ({ id: `step-${index + 1}`, label: line })),
      edges: lines.slice(1).map((_, index) => ({
        from: `step-${index + 1}`,
        to: `step-${index + 2}`,
        label: 'then',
      })),
    };
  } else if (params.kind === 'research') {
    data = {
      question: lines[0],
      hypotheses: lines.slice(1, 3),
      facts: lines.slice(0, 5),
      findings: lines.slice(0, 5),
      contradictions: [],
      confidence: 'medium',
      gaps: ['Needs source validation'],
      implications: lines.slice(0, 2),
      recommendations: ['Validate findings before making a durable decision'],
      sources: ['Canvas selection'],
    };
  } else {
    data = {
      question: lines[0],
      options: lines
        .slice(0, 4)
        .map((line, index) => ({ label: line, score: index === 0 ? 1 : 0 })),
      criteria: ['Business impact', 'Execution risk', 'Evidence quality'],
      assumptions: ['Generated from selected Canvas text'],
      risks: ['Needs owner review before approval'],
      recommendation: lines[0],
      approvalStatus: 'draft',
    };
  }
  const [block] = normalizeCanvasArtifactBlocks([{ ...common, data }]);
  if (!block) throw new Error('Generated block failed validation');
  return block;
}

function convertTableBlock(
  block: CanvasArtifactBlock,
  targetKind: CanvasArtifactBlockKind
): CanvasArtifactBlock {
  if (block.kind !== 'table') throw new Error('Only table blocks can be converted in Stage 4');
  const data =
    block.data && typeof block.data === 'object' && !Array.isArray(block.data) ? block.data : {};
  const rows = Array.isArray((data as any).rows)
    ? ((data as any).rows as Record<string, unknown>[])
    : [];
  const id = randomUUID();
  const converted =
    targetKind === 'chart'
      ? {
          id,
          kind: 'chart',
          schemaVersion: 'canvas-block/v1',
          title: `Chart from ${block.title}`,
          status: 'draft',
          capabilities: ['view', 'convert'],
          data: {
            chartType: 'bar',
            metrics: rows.slice(0, 12).map((row, index) => ({
              label: String(Object.values(row)[0] ?? `Row ${index + 1}`).slice(0, 48),
              value: index + 1,
            })),
          },
          provenance: {
            ...block.provenance,
            sourceBlockId: block.id,
            convertedAt: new Date().toISOString(),
          },
          markdownProjection: '',
          markdownProjectionStatus: 'synced',
        }
      : {
          id,
          kind: 'diagram',
          schemaVersion: 'canvas-block/v1',
          title: `Diagram from ${block.title}`,
          status: 'draft',
          capabilities: ['view', 'convert'],
          data: {
            nodes: rows.slice(0, 12).map((row, index) => ({
              id: `row-${index + 1}`,
              label: String(Object.values(row)[0] ?? `Row ${index + 1}`).slice(0, 80),
            })),
            edges: rows.slice(1, 12).map((_, index) => ({
              from: `row-${index + 1}`,
              to: `row-${index + 2}`,
              label: 'then',
            })),
          },
          provenance: {
            ...block.provenance,
            sourceBlockId: block.id,
            convertedAt: new Date().toISOString(),
          },
          markdownProjection: '',
          markdownProjectionStatus: 'synced',
        };
  const [normalized] = normalizeCanvasArtifactBlocks([converted]);
  if (!normalized) throw new Error('Converted block failed validation');
  return normalized;
}

function operationPreview(params: {
  proposedChange: string;
  affectedBlocks: string[];
  beforeMd: string;
  afterMd: string;
  approvalRequired: boolean;
}) {
  return {
    proposedChange: params.proposedChange,
    affectedBlocks: params.affectedBlocks,
    markdownDiff: diffSummary(params.beforeMd, params.afterMd),
    approvalRequired: params.approvalRequired,
    validationResult: {
      status: 'passed',
      message: 'Operation validated against the Stage 4 Canvas transformation contract.',
    },
  };
}

function applyEditOperation(
  draft: WorkCanvasDraft,
  operation: any
): {
  contentMd: string;
  blocks: CanvasArtifactBlock[];
  summary: string;
  affectedBlocks: string[];
  proposedChange: string;
  approvalRequired: boolean;
} {
  const operationType = String(operation?.type || '') as EditOperationType;
  if (operationType === 'replace_selection') {
    const selectedText = String(operation?.selectedText || '');
    const replacementMd = String(operation?.replacementMd || '');
    if (!selectedText) throw new Error('selectedText is required for replace_selection');
    if (!draft.contentMd.includes(selectedText)) {
      throw new Error('Selected text was not found in the current Canvas draft');
    }
    return {
      contentMd: draft.contentMd.replace(selectedText, replacementMd),
      blocks: draft.blocks,
      summary: operation?.reason || 'Replaced selected Canvas text',
      affectedBlocks: [],
      proposedChange: 'Replace selected Canvas text',
      approvalRequired: false,
    };
  }
  if (operationType === 'append_section') {
    const heading = String(operation?.heading || '').trim();
    const contentMd = String(operation?.contentMd || '').trim();
    if (!heading) throw new Error('heading is required for append_section');
    return {
      contentMd: `${draft.contentMd.trim()}\n\n## ${heading}\n\n${contentMd}\n`,
      blocks: draft.blocks,
      summary: operation?.reason || `Appended section: ${heading}`,
      affectedBlocks: [],
      proposedChange: `Append section: ${heading}`,
      approvalRequired: false,
    };
  }
  if (operationType === 'update_document') {
    const contentMd = String(operation?.contentMd || '');
    if (!contentMd.trim()) throw new Error('contentMd is required for update_document');
    return {
      contentMd,
      blocks: draft.blocks,
      summary: operation?.reason || 'Updated Canvas document',
      affectedBlocks: [],
      proposedChange: 'Update Canvas document',
      approvalRequired: false,
    };
  }
  throw new Error('operation.type must be replace_selection, append_section, or update_document');
}

function applyBlockOperation(
  draft: WorkCanvasDraft,
  operation: any,
  userId: string
): {
  contentMd: string;
  blocks: CanvasArtifactBlock[];
  summary: string;
  affectedBlocks: string[];
  proposedChange: string;
  approvalRequired: boolean;
} {
  const operationType = String(operation?.type || '') as BlockOperationType;
  const blocks = [...draft.blocks];

  if (operationType === 'generate_block_from_selection') {
    const kind = String(operation?.kind || 'table') as CanvasArtifactBlockKind;
    if (!['table', 'chart', 'diagram', 'decision', 'research', 'dashboard'].includes(kind)) {
      throw new Error('Unsupported block kind');
    }
    const block = generatedBlockFromSelection({
      kind,
      selectedText: String(operation?.selectedText || ''),
      title: String(operation?.title || `${kind} from selection`),
      conversationId: draft.conversationId,
      draftId: draft.id,
      userId,
    });
    return {
      contentMd: draft.contentMd,
      blocks: [...blocks, block],
      summary: operation?.reason || `Generated ${kind} block from Canvas selection`,
      affectedBlocks: [block.id],
      proposedChange: `Create ${kind} block "${block.title}" from selected Canvas text`,
      approvalRequired: true,
    };
  }

  if (operationType === 'generate_artifact_from_dataset') {
    const artifactKind = String(operation?.artifactKind || 'dashboard') as DatasetArtifactKind;
    if (!['table', 'chart', 'dashboard', 'research'].includes(artifactKind)) {
      throw new Error('Dataset artifact kind must be table, chart, dashboard, or research');
    }
    const { profile, rows } = createDatasetProfile({
      filename: operation?.dataset?.filename,
      format: operation?.dataset?.format,
      content: operation?.dataset?.content,
    });
    const analysis = applyDatasetAnalysis({
      analysisKind: operation?.analysis?.kind,
      profile,
      rows,
    });
    const block = createDatasetArtifactBlock({
      artifactKind,
      profile: analysis.profile,
      rows: analysis.rows,
      title: String(operation?.title || `${artifactKind} from ${profile.filename}`),
      analysisKind: operation?.analysis?.kind,
      analysisSummary: analysis.summary,
      conversationId: draft.conversationId,
      draftId: draft.id,
      userId,
    });
    return {
      contentMd: draft.contentMd,
      blocks: [...blocks, block],
      summary:
        operation?.reason ||
        `Generated ${artifactKind} block from dataset ${profile.filename}. ${analysis.summary}`,
      affectedBlocks: [block.id],
      proposedChange: `Create ${artifactKind} block "${block.title}" from dataset "${profile.filename}"`,
      approvalRequired: true,
    };
  }

  if (operationType === 'insert_block') {
    const [block] = normalizeCanvasArtifactBlocks([operation?.block]);
    if (!block) throw new Error('A valid block is required for insert_block');
    return {
      contentMd: draft.contentMd,
      blocks: [...blocks, block],
      summary: operation?.reason || `Inserted block: ${block.title}`,
      affectedBlocks: [block.id],
      proposedChange: `Insert block "${block.title}"`,
      approvalRequired: true,
    };
  }

  if (operationType === 'update_block') {
    const blockId = String(operation?.blockId || '');
    const index = blocks.findIndex((block) => block.id === blockId);
    if (index < 0) throw new Error('Block not found for update_block');
    const [updatedBlock] = normalizeCanvasArtifactBlocks([
      { ...blocks[index], ...(operation?.patch || {}) },
    ]);
    if (!updatedBlock) throw new Error('Updated block failed validation');
    blocks[index] = updatedBlock;
    return {
      contentMd: draft.contentMd,
      blocks,
      summary: operation?.reason || `Updated block: ${updatedBlock.title}`,
      affectedBlocks: [updatedBlock.id],
      proposedChange: `Update block "${updatedBlock.title}"`,
      approvalRequired: true,
    };
  }

  if (operationType === 'delete_block') {
    const blockId = String(operation?.blockId || '');
    const target = blocks.find((block) => block.id === blockId);
    if (!target) throw new Error('Block not found for delete_block');
    return {
      contentMd: draft.contentMd,
      blocks: blocks.filter((block) => block.id !== blockId),
      summary: operation?.reason || `Deleted block: ${target.title}`,
      affectedBlocks: [target.id],
      proposedChange: `Delete block "${target.title}"`,
      approvalRequired: true,
    };
  }

  if (operationType === 'regenerate_projection') {
    const blockId = String(operation?.blockId || '');
    const index = blocks.findIndex((block) => block.id === blockId);
    if (index < 0) throw new Error('Block not found for regenerate_projection');
    const [regenerated] = normalizeCanvasArtifactBlocks([
      { ...blocks[index], markdownProjection: '' },
    ]);
    if (!regenerated) throw new Error('Regenerated block failed validation');
    blocks[index] = regenerated;
    return {
      contentMd: draft.contentMd,
      blocks,
      summary: operation?.reason || `Regenerated projection for block: ${regenerated.title}`,
      affectedBlocks: [regenerated.id],
      proposedChange: `Regenerate Markdown projection for "${regenerated.title}"`,
      approvalRequired: true,
    };
  }

  if (operationType === 'convert_block') {
    const blockId = String(operation?.blockId || '');
    const targetKind = String(operation?.targetKind || 'chart') as CanvasArtifactBlockKind;
    const target = blocks.find((block) => block.id === blockId);
    if (!target) throw new Error('Block not found for convert_block');
    const converted = convertTableBlock(target, targetKind);
    return {
      contentMd: draft.contentMd,
      blocks: [...blocks, converted],
      summary: operation?.reason || `Converted ${target.title} to ${targetKind}`,
      affectedBlocks: [target.id, converted.id],
      proposedChange: `Create ${targetKind} block from "${target.title}"`,
      approvalRequired: true,
    };
  }

  throw new Error('Unsupported block operation type');
}

// M-7 — `insertDynamic` was extracted to `../utils/dbDynamic.ts` so the shared
// Canvas materializer can call it without a circular dependency. Imported at
// the top of the file; this comment block reserves the spot for blame
// continuity.

async function updateDraftAfterOperation(
  draft: WorkCanvasDraft,
  provenancePatch: Record<string, unknown>
): Promise<WorkCanvasDraft> {
  const now = new Date().toISOString();
  const updated: WorkCanvasDraft = {
    ...draft,
    provenance: {
      ...(draft.provenance || {}),
      ...provenancePatch,
    },
    saveState: 'saved',
    dirtyState: 'clean',
    auditStatus: 'logged',
    updatedAt: now,
  };
  await dbRun(
    `UPDATE work_canvas_drafts
     SET provenance_json = ?, save_state = ?, dirty_state = ?, audit_status = ?, updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [
      JSON.stringify(updated.provenance),
      updated.saveState,
      updated.dirtyState,
      updated.auditStatus,
      updated.updatedAt,
      updated.id,
      updated.organizationId,
    ],
    { fallback: false }
  );
  return updated;
}

async function updateWorkflowDraftAfterOperation(
  draft: WorkCanvasDraft,
  provenancePatch: Record<string, unknown>
): Promise<WorkCanvasDraft> {
  try {
    return await updateDraftAfterOperation(draft, provenancePatch);
  } catch {
    throw Object.assign(new Error('Workflow state could not be persisted'), {
      statusCode: 503,
      code: 'WORK_CANVAS_WORKFLOW_PERSIST_FAILED',
    });
  }
}

async function createVersionSnapshot(
  draft: WorkCanvasDraft,
  operationType: string,
  summary: string,
  userId: string
) {
  const now = new Date().toISOString();
  const version = {
    id: randomUUID(),
    draft_id: draft.id,
    operation_type: operationType,
    summary,
    content_md: draft.contentMd || '',
    content_json_native: draft.contentJson === undefined ? null : JSON.stringify(draft.contentJson),
    blocks_json: draft.blocks.length > 0 ? JSON.stringify(draft.blocks) : null,
    created_by: userId,
    created_at: now,
  };
  await dbRun(
    `INSERT INTO work_canvas_versions (
      id, draft_id, operation_type, summary, content_md, content_json_native, blocks_json, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      version.id,
      version.draft_id,
      version.operation_type,
      version.summary,
      version.content_md,
      version.content_json_native,
      version.blocks_json,
      version.created_by,
      version.created_at,
    ],
    { fallback: false }
  );
  return toVersion(version);
}

async function ensureStorage(): Promise<void> {
  if (!storageReadyPromise) {
    storageReadyPromise = (async () => {
      // Fail-soft, self-healing: this opportunistic DDL runs first in the Canvas
      // read paths (GET /drafts etc). Use fallback:true so a transient DDL failure
      // (lock/timeout/brief read-only/connection blip) can NEVER reject and bubble
      // up as a bare HTTP 500 / white screen. The IIFE is also memoized below; on
      // failure we null the promise (see .catch) so the next request retries
      // instead of being poisoned by a permanently-rejected cached promise.
      //
      // M01-027c — `created_at`/`updated_at` on work_canvas_drafts and
      // work_canvas_proposals are canonically TEXT (ISO-8601 strings), NOT
      // TIMESTAMPTZ. This was previously TIMESTAMPTZ here while
      // `760_work_canvas_runtime.sql` declared TEXT for the same tables —
      // whichever one created the table first "won", and on any environment
      // where this function won that race, `node-postgres` handed the app a
      // JS `Date` for those columns (no type parser registered for OID
      // 1184 in this codebase), breaking the CAS string comparisons in
      // `hasDraftConflict`/`hasMissingOrStaleBaseToken` below (false 409 on
      // every draft save). TEXT is the canonical choice: it is what the
      // migration already declares and what the live demo database already
      // has, it is portable across the sqlite/postgres dual-target DbPromise
      // layer this codebase supports, and the application never relies on
      // SQL-level DEFAULT NOW() — every INSERT/UPDATE path already supplies
      // an explicit `new Date().toISOString()` value. See
      // `943_work_canvas_timestamp_parity_postgres.sql` for the migration
      // that corrects any environment that already created the TIMESTAMPTZ
      // version of these two tables before this fix shipped, and
      // `normalizeTimestampToken` above for the defense-in-depth read-side
      // coercion.
      await dbRun(
        `CREATE TABLE IF NOT EXISTS work_canvas_drafts (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          created_by TEXT NOT NULL,
          conversation_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          title TEXT NOT NULL,
          content_json TEXT NOT NULL,
          canonical_format TEXT NOT NULL DEFAULT 'markdown',
          content_md TEXT,
          content_json_native TEXT,
          blocks_json TEXT,
          content_schema_version TEXT,
          markdown_projection_status TEXT NOT NULL DEFAULT 'synced',
          markdown_projected_at TEXT,
          markdown_projection_stale_at TEXT,
          projection_error TEXT,
          sources_json TEXT NOT NULL DEFAULT '[]',
          provenance_json TEXT NOT NULL DEFAULT '{}',
          project_id TEXT,
          owner_id TEXT,
          research_session_id TEXT,
          artifact_id TEXT,
          artifact_run_id TEXT,
          artifact_version INTEGER,
          save_state TEXT NOT NULL DEFAULT 'unsaved',
          lifecycle_state TEXT NOT NULL DEFAULT 'draft',
          dirty_state TEXT NOT NULL DEFAULT 'dirty',
          visibility TEXT NOT NULL DEFAULT 'private',
          audit_status TEXT NOT NULL DEFAULT 'not_required',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`,
        [],
        { fallback: true }
      );
      const contentContractColumns = [
        "ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS canonical_format TEXT NOT NULL DEFAULT 'markdown'",
        'ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS content_md TEXT',
        'ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS content_json_native TEXT',
        'ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS blocks_json TEXT',
        'ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS content_schema_version TEXT',
        "ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS markdown_projection_status TEXT NOT NULL DEFAULT 'synced'",
        'ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS markdown_projected_at TEXT',
        'ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS markdown_projection_stale_at TEXT',
        'ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS projection_error TEXT',
      ];
      for (const statement of contentContractColumns) {
        await dbRun(statement, [], { fallback: true });
      }
      await dbRun(
        `CREATE INDEX IF NOT EXISTS idx_work_canvas_drafts_org_updated
         ON work_canvas_drafts (organization_id, updated_at DESC)`,
        [],
        { fallback: true }
      );
      await dbRun(
        `CREATE INDEX IF NOT EXISTS idx_work_canvas_drafts_conversation
         ON work_canvas_drafts (organization_id, conversation_id)`,
        [],
        { fallback: true }
      );
      await dbRun(
        `CREATE TABLE IF NOT EXISTS work_canvas_proposals (
          id TEXT PRIMARY KEY,
          draft_id TEXT NOT NULL REFERENCES work_canvas_drafts(id) ON DELETE CASCADE,
          organization_id TEXT NOT NULL,
          created_by TEXT NOT NULL,
          target TEXT NOT NULL,
          title TEXT NOT NULL,
          summary TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'proposed',
          payload_json TEXT NOT NULL DEFAULT '{}',
          required_capability TEXT NOT NULL,
          target_object_id TEXT,
          read_back_json TEXT,
          audit_event_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`,
        [],
        { fallback: true }
      );
      await dbRun(
        `CREATE TABLE IF NOT EXISTS work_canvas_versions (
          id TEXT PRIMARY KEY,
          draft_id TEXT NOT NULL REFERENCES work_canvas_drafts(id) ON DELETE CASCADE,
          operation_type TEXT NOT NULL,
          summary TEXT NOT NULL,
          content_md TEXT NOT NULL,
          content_json_native TEXT,
          blocks_json TEXT,
          created_by TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        [],
        { fallback: true }
      );
      await dbRun(
        'ALTER TABLE work_canvas_versions ADD COLUMN IF NOT EXISTS blocks_json TEXT',
        [],
        { fallback: true }
      );
      await dbRun(
        `CREATE INDEX IF NOT EXISTS idx_work_canvas_versions_draft_created
         ON work_canvas_versions (draft_id, created_at DESC)`,
        [],
        { fallback: true }
      );
    })().catch((err: any) => {
      // Self-heal: drop the memoized (now rejected) promise so a transient DDL
      // failure retries on the next request instead of poisoning Canvas until
      // process restart. Re-throw so this call still surfaces the failure to its
      // caller (handlers wrap ensureStorage / degrade to a safe response).
      storageReadyPromise = null;
      throw err;
    });
  }
  return storageReadyPromise;
}

async function ownedDraft(req: AuthRequest, draftId: string): Promise<WorkCanvasDraft | null> {
  await ensureStorage();
  const { organizationId, userId } = authContext(req);
  const row = await dbGet<DraftRow>(
    `SELECT * FROM work_canvas_drafts WHERE id = ? AND organization_id = ?`,
    [draftId, organizationId],
    { fallback: false }
  );
  if (!row) return null;
  const draft = toDraft(row);
  if (draft.visibility === 'project') return draft;
  if (draft.createdBy === userId) return draft;
  if (draft.ownerId && draft.ownerId === userId) return draft;
  return null;
}

function sharedDraftPayload(draft: WorkCanvasDraft): {
  token: string;
  url: string;
  title: string;
  createdAt: string;
  expiresAt: string;
} | null {
  const share = draft.provenance?.share;
  if (!share || typeof share !== 'object') return null;
  const record = share as Record<string, unknown>;
  const token = typeof record.token === 'string' ? record.token : '';
  if (!token.trim()) return null;
  return {
    token,
    // Fallback for legacy share records without a stored url — point them at
    // the public viewer (the token resolves there regardless of mint date).
    url: typeof record.url === 'string' ? record.url : `/public/artifacts/${token}`,
    title: typeof record.title === 'string' ? record.title : draft.title,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : draft.updatedAt,
    expiresAt: typeof record.expiresAt === 'string' ? record.expiresAt : draft.updatedAt,
  };
}

async function draftProposals(draftId: string): Promise<WorkCanvasProposal[]> {
  await ensureStorage();
  const rows = await dbAll<ProposalRow>(
    `SELECT * FROM work_canvas_proposals WHERE draft_id = ? ORDER BY created_at DESC`,
    [draftId],
    { fallback: false }
  );
  return rows.map(toProposal);
}

/**
 * M-7 — `createWorkspaceResource` is now a thin wrapper around the shared
 * Canvas materializer. The previous in-place implementation (idea / note /
 * decision / task / initiative branches) lives in `services/canvasMaterialize.ts`
 * and is shared with `commitProposalToDomain` (proposal-approval path).
 * Both writers produce identical entities — single bug surface, single fix
 * site.
 */
async function createWorkspaceResource(
  draft: WorkCanvasDraft,
  target: WorkspaceTarget,
  userId: string,
  organizationId: string
) {
  const { materializeOrThrow } = await import('../services/canvasMaterialize.js');
  const title = firstMarkdownHeading(draft.contentMd, draft.title || 'Canvas document');
  // W2-E5 — cap below the canonical TaskService Zod limit (5000) to leave
  // headroom for multibyte expansion in the persisted summary.
  const summary = markdownSummary(draft.contentMd, 4900);

  // W2-E6 — UUID-validate projectId so canonical services (TaskService /
  // decisionService) don't 500 on a slug-style draft.projectId.
  const validUuidProjectId =
    draft.projectId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(draft.projectId)
      ? draft.projectId
      : null;

  return materializeOrThrow(
    {
      organizationId,
      actorUserId: userId,
      target,
      title,
      contentMd: draft.contentMd,
      summary,
      projectId: validUuidProjectId,
      sourceDraftId: draft.id,
      sourceConversationId: draft.conversationId,
      sections: markdownSections(draft.contentMd),
    },
    { writer: 'save_to_workspace' }
  );
}

function buildTableOutputMarkdown(draft: WorkCanvasDraft): string {
  const sections = markdownSections(draft.contentMd).slice(0, 12);
  const rows = sections.length
    ? sections.map(
        (section) =>
          `| ${section.heading.replace(/\|/g, '/')} | ${markdownSummary(section.body, 180).replace(/\|/g, '/')} | ${draft.title.replace(/\|/g, '/')} |`
      )
    : [
        `| ${draft.title.replace(/\|/g, '/')} | ${markdownSummary(draft.contentMd, 180).replace(/\|/g, '/')} | Canvas |`,
      ];
  return `# Table from ${draft.title}

| Topic | Detail | Source |
|---|---|---|
${rows.join('\n')}
`;
}

function buildReportOutputMarkdown(draft: WorkCanvasDraft): string {
  return `# Report: ${draft.title}

## Executive Summary

${markdownSummary(draft.contentMd, 700) || 'Summary to be completed.'}

## Context

Generated from Work Canvas draft \`${draft.id}\`.

## Key Points

${
  markdownSections(draft.contentMd)
    .slice(0, 8)
    .map((section) => `- **${section.heading}:** ${markdownSummary(section.body, 220) || 'TBD'}`)
    .join('\n') || '- TBD'
}

## Next Steps

- [ ] Review the report with Teresa.
- [ ] Confirm audience and decision owner.
- [ ] Convert into a final deliverable when ready.
`;
}

function buildPresentationSlides(draft: WorkCanvasDraft) {
  const sections = markdownSections(draft.contentMd).slice(0, 6);
  const baseSections = sections.length
    ? sections
    : [{ heading: draft.title, body: markdownSummary(draft.contentMd, 500) }];
  return [
    {
      type: 'title',
      content: { title: draft.title, subtitle: 'Generated from Work Canvas' },
    },
    ...baseSections.map((section) => ({
      type: 'content',
      content: {
        title: section.heading,
        bullets: markdownSummary(section.body, 500)
          .split('\n')
          .map((line) => line.replace(/^[-*]\s*/, '').trim())
          .filter(Boolean)
          .slice(0, 5),
      },
    })),
    {
      type: 'next_steps',
      content: {
        title: 'Next steps',
        bullets: ['Review the narrative', 'Confirm supporting evidence', 'Prepare final version'],
      },
    },
  ];
}

/**
 * C7 — pull an initiative id out of loosely-typed source refs (Canvas
 * `draft.sources`, provenance sourceRefs, DocumentSourceRef-shaped hints).
 * Tolerates the three shapes that exist across the codebase:
 * `{ sourceType, sourceId }`, `{ type, id }`, `{ entityType, entityId }`.
 */
function extractInitiativeIdFromRefs(refs: unknown[]): string | null {
  for (const ref of refs) {
    if (!ref || typeof ref !== 'object') continue;
    const candidate = ref as Record<string, unknown>;
    const refType = String(
      candidate.sourceType ?? candidate.type ?? candidate.entityType ?? ''
    ).toLowerCase();
    if (refType !== 'initiative') continue;
    const id = candidate.sourceId ?? candidate.id ?? candidate.entityId;
    if (typeof id === 'string' && id.trim()) return id.trim();
  }
  return null;
}

/**
 * C7 — best-effort registration of a durable Canvas output in the canonical
 * artifact registry (`v8_output_artifacts` + origin link), same path
 * DocumentStudio's G5 fix uses. Output creation must NEVER fail because of a
 * registry hiccup, so every error is swallowed and logged (the lazy
 * `ensureBackfilledOutputsForOrg` pass will pick the row up later anyway —
 * but without the sourceInitiativeId/draft linkage we attach here).
 */
async function registerCanvasOutputInRegistry(params: {
  organizationId: string;
  userId: string;
  outputType: 'report' | 'presentation' | 'sheet';
  artifactFamily: 'document' | 'presentation' | 'sheet';
  originRuntime: 'report' | 'presentation' | 'sheet';
  originRecordId: string;
  titleSnapshot: string;
  projectId: string | null;
  sourceInitiativeId: string | null;
  originSummary: Record<string, unknown>;
}): Promise<void> {
  try {
    const { registerArtifactOrigin } = await import('../services/v8/artifactRegistryService.js');
    await registerArtifactOrigin({
      organizationId: params.organizationId,
      outputType: params.outputType,
      artifactFamily: params.artifactFamily,
      originRuntime: params.originRuntime,
      originRecordId: params.originRecordId,
      titleSnapshot: params.titleSnapshot,
      ownerUserId: params.userId,
      createdBy: params.userId,
      projectId: params.projectId,
      sourceInitiativeId: params.sourceInitiativeId,
      originSummary: params.originSummary,
    });
  } catch (err) {
    logger.warn('[work-canvas] canvas.output.registry_failed (output still created)', {
      originRuntime: params.originRuntime,
      originRecordId: params.originRecordId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function createOutputResource(
  draft: WorkCanvasDraft,
  outputType: OutputType,
  userId: string,
  organizationId: string,
  sourceVersionId?: string
) {
  const title = firstMarkdownHeading(draft.contentMd, draft.title || 'Canvas output');
  const now = new Date().toISOString();
  // C7 — initiative linkage is determinable only when the draft's sources or
  // provenance carry an explicit initiative ref; otherwise register without it.
  const provenanceSourceRefs = Array.isArray(
    (draft.provenance as Record<string, unknown> | null)?.sourceRefs
  )
    ? ((draft.provenance as Record<string, unknown>).sourceRefs as unknown[])
    : [];
  const sourceInitiativeId = extractInitiativeIdFromRefs([
    ...(Array.isArray(draft.sources) ? draft.sources : []),
    ...provenanceSourceRefs,
  ]);

  if (outputType === 'presentation') {
    const deckId = randomUUID().replace(/-/g, '');
    const slides = buildPresentationSlides(draft);
    const metadata = outputMetadata(draft, {
      outputType,
      outputId: deckId,
      outputTitle: `Presentation: ${title}`,
      sourceVersionId,
      createdBy: userId,
      createdAt: now,
      lifecycleState: 'draft',
    });
    // W2-E9 — map to canonical presentation_decks columns. The previous insert
    // wrote `created_by`, `source_id`, `source_refs_json` — none of which exist
    // in the canonical schema (`568_presentations_brand_kits_templates.sql`).
    // `insertDynamic` silently dropped them, so the deck row had no creator
    // attribution and the outputMetadata payload returned to the client was a
    // fiction. Canonical columns are `generated_by` + `source_artifacts`; the
    // rich metadata lives in `outline_json` alongside the slide structure.
    await insertDynamic(
      'presentation_decks',
      {
        id: deckId,
        organization_id: organizationId,
        generated_by: userId,
        title: `Presentation: ${title}`,
        deck_type: 'custom',
        theme: 'modern',
        slide_count: slides.length,
        status: 'draft',
        source_artifacts: JSON.stringify([
          {
            type: 'work_canvas_draft',
            id: draft.id,
            versionId: sourceVersionId || null,
            title,
          },
        ]),
        outline_json: JSON.stringify({
          source: 'work_canvas',
          sourceDraftId: draft.id,
          canvasMetadata: metadata,
          slides,
        }),
        created_at: now,
        updated_at: now,
      },
      ['id']
    );
    for (let i = 0; i < slides.length; i += 1) {
      const slide = slides[i];
      await insertDynamic(
        'presentation_cards',
        {
          id: randomUUID().replace(/-/g, ''),
          deck_id: deckId,
          card_index: i,
          intent: slide.type,
          blocks_json: JSON.stringify(slide.content),
          created_at: now,
          updated_at: now,
        },
        ['id']
      );
    }
    // C7 — register the deck in the canonical Outputs registry with its Canvas
    // origin (and initiative linkage when the draft carries one). Best-effort.
    await registerCanvasOutputInRegistry({
      organizationId,
      userId,
      outputType: 'presentation',
      artifactFamily: 'presentation',
      originRuntime: 'presentation',
      originRecordId: deckId,
      titleSnapshot: `Presentation: ${title}`,
      projectId: draft.projectId || null,
      sourceInitiativeId,
      originSummary: {
        sourceType: 'work_canvas',
        sourceDraftId: draft.id,
        sourceVersionId: sourceVersionId || null,
        nativeStatus: 'draft',
        sourceTable: 'presentation_decks',
      },
    });
    return {
      type: 'presentation' as const,
      id: deckId,
      title: `Presentation: ${title}`,
      url: `/presentations/builder/${deckId}`,
      metadata,
      readBack: { outputType, deckId, slideCount: slides.length, status: 'created', metadata },
    };
  }

  const kind: DraftKind = outputType === 'table' ? 'table' : 'report';
  const contentMd =
    outputType === 'table' ? buildTableOutputMarkdown(draft) : buildReportOutputMarkdown(draft);
  const contentJson =
    outputType === 'table'
      ? {
          columns: ['Topic', 'Detail', 'Source'],
          sourceDraftId: draft.id,
        }
      : undefined;
  const envelopeForOutput = createArtifactContentEnvelope({
    artifactType: kind,
    canonicalFormat: outputType === 'table' ? 'json' : 'markdown',
    contentMd,
    contentJson,
  });
  const outputDraftId = randomUUID();
  const outputDraftTitle = `${outputType === 'table' ? 'Table' : 'Report'}: ${title}`;
  const metadata = outputMetadata(draft, {
    outputType,
    outputId: outputDraftId,
    outputTitle: outputDraftTitle,
    sourceVersionId,
    createdBy: userId,
    createdAt: now,
    lifecycleState: 'draft',
  });
  const outputDraft: WorkCanvasDraft = {
    ...draft,
    id: outputDraftId,
    kind,
    title: outputDraftTitle,
    content: outputType === 'table' ? contentJson : contentMd,
    contentEnvelope: envelopeForOutput,
    canonicalFormat: envelopeForOutput.canonicalFormat,
    contentMd: envelopeForOutput.contentMd,
    contentJson: envelopeForOutput.contentJson,
    blocks: normalizeCanvasArtifactBlocks(envelopeForOutput.blocks || []),
    contentSchemaVersion: envelopeForOutput.contentSchemaVersion || null,
    markdownProjectionStatus: envelopeForOutput.markdownProjectionStatus,
    markdownProjectedAt: envelopeForOutput.markdownProjectedAt || null,
    projectionError: envelopeForOutput.projectionError || null,
    provenance: {
      source: 'work_canvas_create_output',
      sourceDraftId: draft.id,
      sourceVersionId: sourceVersionId || null,
      outputType,
      metadata,
    },
    artifactId: null,
    artifactRunId: null,
    artifactVersion: null,
    saveState: 'saved',
    lifecycleState: 'draft',
    dirtyState: 'clean',
    auditStatus: 'logged',
    createdAt: now,
    updatedAt: now,
  };

  await dbRun(
    `INSERT INTO work_canvas_drafts (
      id, organization_id, created_by, conversation_id, kind, title, content_json,
      canonical_format, content_md, content_json_native, blocks_json, content_schema_version,
      markdown_projection_status, markdown_projected_at, projection_error,
      sources_json, provenance_json, project_id, owner_id, research_session_id,
      artifact_id, artifact_run_id, artifact_version, save_state, lifecycle_state,
      dirty_state, visibility, audit_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      outputDraft.id,
      outputDraft.organizationId,
      outputDraft.createdBy,
      outputDraft.conversationId,
      outputDraft.kind,
      outputDraft.title,
      JSON.stringify(outputDraft.content),
      outputDraft.canonicalFormat,
      outputDraft.contentMd,
      outputDraft.contentJson === undefined ? null : JSON.stringify(outputDraft.contentJson),
      outputDraft.blocks.length > 0 ? JSON.stringify(outputDraft.blocks) : null,
      outputDraft.contentSchemaVersion,
      outputDraft.markdownProjectionStatus,
      outputDraft.markdownProjectedAt,
      outputDraft.projectionError,
      JSON.stringify(outputDraft.sources),
      JSON.stringify(outputDraft.provenance),
      outputDraft.projectId,
      outputDraft.ownerId,
      outputDraft.researchSessionId,
      outputDraft.artifactId,
      outputDraft.artifactRunId,
      outputDraft.artifactVersion,
      outputDraft.saveState,
      outputDraft.lifecycleState,
      outputDraft.dirtyState,
      outputDraft.visibility,
      outputDraft.auditStatus,
      outputDraft.createdAt,
      outputDraft.updatedAt,
    ],
    { fallback: false }
  );

  // C4.2 — for `report` outputs, ALSO write a real report_builder_reports row so
  // Canvas → Report lands in the Reports module (not only as a sibling
  // work_canvas_drafts kind='report'). The draft above stays as the editable
  // working copy; the report row is the surface Outputs/Reports renders. Failure
  // is non-fatal — the draft is still returned, audit log captures the gap.
  if (outputType === 'report') {
    try {
      const reportId = randomUUID();
      const companyContext = {
        source: 'work_canvas',
        sourceDraftId: draft.id,
        sourceVersionId: sourceVersionId || null,
        title,
        markdownExcerpt: String(draft.contentMd || '').slice(0, 4000),
      };
      // W2-E4 — `CANVAS_REPORT` is not in `report_invocation_profiles` enum
      // (R1|R2|R3|R4|custom + legacy GENERAL|ASSESSMENT). Use the recognized
      // 'custom' discriminant and stash the Canvas hint in config_json so the
      // builder UI can light up Canvas-specific affordances when it ships.
      const config = {
        canvasOutput: true,
        canvasReport: true,
        outputDraftId,
        sourceDraftId: draft.id,
      };
      await dbRun(
        `INSERT INTO report_builder_reports (
          id, organization_id, project_id, source_type, source_id, source_name, source_framework,
          title, description, report_type, template_id, config_json, company_context_json, status,
          created_by, created_at, updated_at, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reportId,
          organizationId,
          draft.projectId || null,
          // P1-3 — own discriminant so report-list filters can distinguish
          // narrative Canvas drafts from real upload bundles. Falls back to
          // INTERVIEW template via reportBuilderService.getTemplateForSource.
          'WORK_CANVAS',
          draft.id,
          `Canvas: ${title}`,
          'work_canvas',
          `Report: ${title}`,
          'Generated from Work Canvas draft.',
          'custom',
          null,
          JSON.stringify(config),
          JSON.stringify(companyContext),
          'DRAFT',
          userId,
          now,
          now,
          1,
        ],
        { fallback: false }
      );
      // C7 — register the report in the canonical Outputs registry (same
      // conventions as backfillReportsForOrg: report → family 'document').
      await registerCanvasOutputInRegistry({
        organizationId,
        userId,
        outputType: 'report',
        artifactFamily: 'document',
        originRuntime: 'report',
        originRecordId: reportId,
        titleSnapshot: `Report: ${title}`,
        projectId: draft.projectId || null,
        sourceInitiativeId,
        originSummary: {
          reportType: 'custom',
          sourceType: 'work_canvas',
          sourceDraftId: draft.id,
          sourceVersionId: sourceVersionId || null,
          nativeStatus: 'DRAFT',
          sourceTable: 'report_builder_reports',
        },
      });
      return {
        type: outputType,
        id: reportId,
        title: outputDraft.title,
        // W2-E2 — Reports module migrated to /presentations (AppRoutes.tsx has
        // `reports_ui_moved_to_presentations` placeholder). `/reports/:id`
        // 404s; the canonical mount is /presentations?reportId=...
        url: `/presentations?reportId=${encodeURIComponent(reportId)}`,
        metadata,
        readBack: {
          outputType,
          draftId: outputDraft.id,
          reportId,
          status: 'created',
          metadata,
        },
      };
    } catch (err) {
      logger.warn('[work-canvas] canvas.report.materialize_failed', {
        draftId: draft.id,
        error: err instanceof Error ? err.message : String(err),
      });
      // Fall through to draft-only return below — non-fatal, audit captured.
    }
  }

  return {
    type: outputType,
    id: outputDraft.id,
    title: outputDraft.title,
    url: `/work-canvas?draftId=${encodeURIComponent(outputDraft.id)}`,
    metadata,
    readBack: {
      outputType,
      draftId: outputDraft.id,
      status: 'created',
      metadata,
    },
  };
}

router.use(verifyToken);

router.get('/drafts', async (req: AuthRequest, res) => {
  // Fail-soft list: this is a high-traffic Canvas read. A transient DDL/read
  // failure must degrade to an empty list (not a bare HTTP 500 / white screen).
  // ensureStorage() is now fail-soft + self-healing; wrap the read too so any
  // residual transient error still yields a well-formed empty envelope.
  try {
    await ensureStorage();
    const { organizationId, userId } = authContext(req);
    const conversationId = req.query.conversationId ? String(req.query.conversationId) : null;
    const projectId = req.query.projectId ? String(req.query.projectId) : null;
    const whereParts = ['organization_id = ?'];
    const queryParams: unknown[] = [organizationId];
    if (conversationId) {
      whereParts.push('conversation_id = ?');
      queryParams.push(conversationId);
    }
    const accessParts = ['created_by = ?', 'owner_id = ?', "visibility = 'project'"];
    queryParams.push(userId, userId);
    if (projectId) {
      whereParts.push('project_id = ?');
      queryParams.push(projectId);
    }
    whereParts.push(`(${accessParts.join(' OR ')})`);
    const rows = await dbAll<DraftRow>(
      `SELECT * FROM work_canvas_drafts
     WHERE ${whereParts.join(' AND ')}
     ORDER BY updated_at DESC`,
      queryParams,
      { fallback: true }
    );
    const result = rows.map(toDraft);
    res.json(envelope(result));
  } catch (err: any) {
    logger.warn(`[WorkCanvas] GET /drafts degraded to empty list: ${err?.message}`);
    res.json(envelope([] as ReturnType<typeof toDraft>[]));
  }
});

router.post('/drafts', async (req: AuthRequest, res) => {
  await ensureStorage();
  const { organizationId, userId } = authContext(req);
  const now = new Date().toISOString();
  // Z139 (full scope): undo the input-sanitizer's HTML-entity escaping before
  // storing rich text AND the title, otherwise every save re-escapes and
  // corrupts the canvas content/title.
  if (req.body && typeof req.body === 'object') {
    const b = req.body as Record<string, unknown>;
    if (typeof b.contentMd === 'string') b.contentMd = decodeHtmlEntities(b.contentMd);
    if (typeof b.content === 'string') b.content = decodeHtmlEntities(b.content);
    if (b.contentJson !== undefined) b.contentJson = deepDecodeHtmlEntities(b.contentJson);
    if (Array.isArray(b.blocks)) b.blocks = deepDecodeHtmlEntities(b.blocks);
    if (typeof b.title === 'string') b.title = decodeHtmlEntities(b.title);
  }
  const draft: WorkCanvasDraft = {
    id: randomUUID(),
    organizationId,
    createdBy: userId,
    conversationId: String(req.body?.conversationId || `conversation-${Date.now()}`),
    kind: (req.body?.kind || 'markdown') as DraftKind,
    title: String(req.body?.title || 'Untitled work canvas'),
    content: req.body?.content ?? '',
    contentEnvelope: createArtifactContentEnvelope({
      artifactType: String(req.body?.kind || 'markdown'),
      canonicalFormat: req.body?.canonicalFormat,
      contentMd:
        req.body?.contentMd ?? (typeof req.body?.content === 'string' ? req.body.content : ''),
      contentJson: req.body?.contentJson,
      blocks: req.body?.blocks,
      contentSchemaVersion: req.body?.contentSchemaVersion,
    }),
    canonicalFormat: 'markdown',
    contentMd: '',
    contentJson: undefined,
    blocks: [],
    contentSchemaVersion: req.body?.contentSchemaVersion || null,
    markdownProjectionStatus: 'synced',
    markdownProjectedAt: null,
    projectionError: null,
    sources: Array.isArray(req.body?.sources) ? req.body.sources : [],
    provenance:
      req.body?.provenance && typeof req.body.provenance === 'object' ? req.body.provenance : {},
    projectId: req.body?.projectId || null,
    ownerId: req.body?.ownerId || userId,
    researchSessionId: req.body?.researchSessionId || null,
    artifactId: req.body?.artifactId || null,
    artifactRunId: req.body?.artifactRunId || null,
    artifactVersion: null,
    saveState: 'unsaved',
    lifecycleState: 'draft',
    dirtyState: 'dirty',
    visibility: req.body?.projectId ? 'project' : 'private',
    auditStatus: 'not_required',
    createdAt: now,
    updatedAt: now,
  };
  draft.canonicalFormat = draft.contentEnvelope.canonicalFormat;
  draft.contentMd = draft.contentEnvelope.contentMd;
  draft.contentJson = draft.contentEnvelope.contentJson;
  draft.blocks = normalizeCanvasArtifactBlocks(draft.contentEnvelope.blocks || []);
  draft.markdownProjectionStatus = draft.contentEnvelope.markdownProjectionStatus;
  draft.markdownProjectedAt = draft.contentEnvelope.markdownProjectedAt || null;
  draft.projectionError = draft.contentEnvelope.projectionError || null;
  await dbRun(
    `INSERT INTO work_canvas_drafts (
      id, organization_id, created_by, conversation_id, kind, title, content_json,
      canonical_format, content_md, content_json_native, blocks_json, content_schema_version,
      markdown_projection_status, markdown_projected_at, projection_error,
      sources_json, provenance_json, project_id, owner_id, research_session_id,
      artifact_id, artifact_run_id, artifact_version, save_state, lifecycle_state,
      dirty_state, visibility, audit_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      draft.id,
      draft.organizationId,
      draft.createdBy,
      draft.conversationId,
      draft.kind,
      draft.title,
      JSON.stringify(draft.content),
      draft.canonicalFormat,
      draft.contentMd,
      draft.contentJson === undefined ? null : JSON.stringify(draft.contentJson),
      draft.blocks.length > 0 ? JSON.stringify(draft.blocks) : null,
      draft.contentSchemaVersion,
      draft.markdownProjectionStatus,
      draft.markdownProjectedAt,
      draft.projectionError,
      JSON.stringify(draft.sources),
      JSON.stringify(draft.provenance),
      draft.projectId,
      draft.ownerId,
      draft.researchSessionId,
      draft.artifactId,
      draft.artifactRunId,
      draft.artifactVersion,
      draft.saveState,
      draft.lifecycleState,
      draft.dirtyState,
      draft.visibility,
      draft.auditStatus,
      draft.createdAt,
      draft.updatedAt,
    ],
    { fallback: false }
  );

  // FIX-15 / FIX-7 (Day 3 acceptance): "Rozwiń w dokument" was permanently
  // disabled client-side because this endpoint never wrote a real, durable,
  // independently-readable audit receipt for a notebook-page expand — the
  // client fell back to using the draft id itself as a fake "receiptId"
  // (see notebookExpandToDocument.ts's prior comment). The client already
  // sends `provenance.source === 'notebook-expand'` + `provenance.sourceId`
  // (the notebook page id) on every expand request (buildNotebookExpandDraftBody
  // in notebookExpandToDocument.ts) — when present, and only when the actor
  // owns that notebook page (same owner-only gate as notebook delete/write),
  // write a real audit_events row and return its id as `receiptId`, readable
  // back via GET /api/v8/my-work/notebook/action-receipts/:receiptId
  // (generalized in my-work.routes.ts to accept this action too).
  let expandReceiptId: string | null = null;
  const provenanceSource =
    draft.provenance && typeof draft.provenance === 'object'
      ? (draft.provenance as Record<string, unknown>)
      : null;
  if (
    provenanceSource?.source === 'notebook-expand' &&
    typeof provenanceSource.sourceId === 'string' &&
    provenanceSource.sourceId
  ) {
    const sourcePageId = provenanceSource.sourceId;
    try {
      const sourcePage = await dbGet<{ owner_user_id?: string; organization_id?: string }>(
        `SELECT owner_user_id, organization_id FROM notebook_pages WHERE id = ? LIMIT 1`,
        [sourcePageId]
      );
      if (
        sourcePage &&
        String(sourcePage.organization_id || '') === String(organizationId) &&
        String(sourcePage.owner_user_id || '') === String(userId)
      ) {
        expandReceiptId = `ae-${randomUUID()}`;
        await dbRun(
          `INSERT INTO audit_events (
            id, ts, actor_id, actor_type, org_id, action, resource_type, resource_id,
            before_json, after_json, metadata_json
          ) VALUES (?, ?, ?, 'USER', ?, 'NOTEBOOK_PAGE_EXPANDED', 'notebook_page', ?, ?, ?, ?)`,
          [
            expandReceiptId,
            now,
            userId,
            organizationId,
            sourcePageId,
            JSON.stringify({ id: sourcePageId }),
            JSON.stringify({ expandedToDraftId: draft.id }),
            JSON.stringify({
              draftId: draft.id,
              contract: 'notebook_expand_document_receipt_v1',
            }),
          ]
        );
      }
      // Not owner-scoped, or the source page no longer exists: skip the
      // receipt silently. The draft itself is still created — creating a
      // Canvas draft is not owner-gated on its own; only the *audited
      // expand-from-notebook* claim requires ownership of the source page.
    } catch (err) {
      logger.warn('[work-canvas] failed to write notebook-expand audit receipt', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  res.status(201).json(
    envelope(draft, {
      auditEventId: `ae-${randomUUID()}`,
      ...(expandReceiptId ? { receiptId: expandReceiptId } : {}),
    })
  );
});

router.get('/drafts/:draftId', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  return res.json(envelope({ draft, proposals: await draftProposals(draft.id) }));
});

router.get('/drafts/:draftId/workflows', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  return res.json(envelope(workflowRunsFromProvenance(draft.provenance || {})));
});

router.post('/drafts/:draftId/workflows', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft)
    return res
      .status(404)
      .json({ error: 'Canvas draft not found', code: 'WORK_CANVAS_DRAFT_NOT_FOUND' });
  const baseUpdatedAt = requestedBaseUpdatedAt(req.body);
  if (hasDraftConflict(draft, baseUpdatedAt)) {
    return sendDraftConflict(res, draft, baseUpdatedAt, 'start_workflow');
  }
  const { userId } = authContext(req);
  const template = String(req.body?.template || '') as WorkflowTemplate;
  if (!Object.keys(workflowTemplateTitles).includes(template)) {
    return res.status(400).json({
      error: 'Unsupported workflow template',
      code: 'WORK_CANVAS_WORKFLOW_TEMPLATE_INVALID',
    });
  }

  const workflowRun = createWorkflowRun({
    draft,
    template,
    userId,
    now: new Date().toISOString(),
  });
  const updatedDraft = await updateWorkflowDraftAfterOperation(
    draft,
    appendWorkflowRun(draft, workflowRun)
  );
  return res.status(201).json(
    envelope({
      draft: updatedDraft,
      workflowRun,
      readBack: {
        status: 'created',
        workflowRunId: workflowRun.id,
        draftId: draft.id,
        conversationId: draft.conversationId,
        approvalRequired: true,
      },
    })
  );
});

router.post('/drafts/:draftId/workflows/:workflowRunId/resume', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft)
    return res
      .status(404)
      .json({ error: 'Canvas draft not found', code: 'WORK_CANVAS_DRAFT_NOT_FOUND' });
  const baseUpdatedAt = requestedBaseUpdatedAt(req.body);
  if (hasDraftConflict(draft, baseUpdatedAt)) {
    return sendDraftConflict(res, draft, baseUpdatedAt, 'resume_workflow');
  }
  const runs = workflowRunsFromProvenance(draft.provenance || {});
  const index = runs.findIndex((run) => run.id === req.params.workflowRunId);
  if (index < 0) {
    return res.status(404).json({
      error: 'Workflow run not found',
      code: 'WORK_CANVAS_WORKFLOW_RUN_NOT_FOUND',
    });
  }
  const run = runs[index];
  if (run.draftId !== draft.id || run.conversationId !== draft.conversationId) {
    return res.status(409).json({
      error: 'Workflow context does not match this Canvas draft',
      code: 'WORK_CANVAS_WORKFLOW_CONTEXT_MISMATCH',
    });
  }
  const now = new Date().toISOString();
  const resumeStep: WorkCanvasWorkflowStep = {
    id: randomUUID(),
    kind: 'teresa_action',
    title: 'Resume workflow',
    summary: String(req.body?.note || 'Workflow resumed from source Canvas context.'),
    status: 'completed',
    createdAt: now,
  };
  const resumed: WorkCanvasWorkflowRun = {
    ...run,
    status: 'active',
    steps: [...run.steps, resumeStep],
    events: [
      ...(run.events || []),
      workflowEvent({
        type: 'resumed',
        actorId: authContext(req).userId,
        summary: resumeStep.summary,
        createdAt: now,
      }),
    ],
    updatedAt: now,
  };
  runs[index] = resumed;
  const updatedDraft = await updateWorkflowDraftAfterOperation(draft, { workflowRuns: runs });
  return res.json(
    envelope({
      draft: updatedDraft,
      workflowRun: resumed,
      readBack: {
        status: 'resumed',
        workflowRunId: resumed.id,
        draftId: draft.id,
        conversationId: draft.conversationId,
      },
    })
  );
});

router.post('/drafts/:draftId/workflows/:workflowRunId/run-next', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft)
    return res
      .status(404)
      .json({ error: 'Canvas draft not found', code: 'WORK_CANVAS_DRAFT_NOT_FOUND' });
  const baseUpdatedAt = requestedBaseUpdatedAt(req.body);
  if (hasDraftConflict(draft, baseUpdatedAt)) {
    return sendDraftConflict(res, draft, baseUpdatedAt, 'run_workflow_step');
  }
  const { userId, organizationId } = authContext(req);
  const runs = workflowRunsFromProvenance(draft.provenance || {});
  const index = runs.findIndex((run) => run.id === req.params.workflowRunId);
  if (index < 0) {
    return res.status(404).json({
      error: 'Workflow run not found',
      code: 'WORK_CANVAS_WORKFLOW_RUN_NOT_FOUND',
    });
  }
  const run = runs[index];
  if (run.draftId !== draft.id || run.conversationId !== draft.conversationId) {
    return res.status(409).json({
      error: 'Workflow context does not match this Canvas draft',
      code: 'WORK_CANVAS_WORKFLOW_CONTEXT_MISMATCH',
    });
  }
  if (run.status === 'completed' || run.status === 'failed') {
    return res.status(409).json({
      error: 'Workflow run is already in a terminal state',
      code: 'CANVAS_WORKFLOW_TERMINAL_STATE',
      recoverable: true,
      data: {
        workflowRunId: run.id,
        status: run.status,
        outputCount: run.outputs?.length || 0,
      },
    });
  }

  const pendingApproval = run.approvals.find((approval) => approval.status === 'pending');
  if (pendingApproval && req.body?.approved !== true) {
    return res.status(409).json({
      error: 'Workflow step requires approval before generating a durable output',
      code: 'CANVAS_WORKFLOW_APPROVAL_REQUIRED',
      recoverable: true,
      data: { workflowRunId: run.id, approval: pendingApproval },
    });
  }
  const reviewLifecycle = run.collaboration?.lifecycle || 'draft';
  const reviewGateRequired = Boolean(
    run.collaboration?.reviewerId || reviewLifecycle === 'in_review'
  );
  if (reviewGateRequired && reviewLifecycle !== 'approved') {
    logger.warn('[work-canvas] canvas.workflow.review_required', {
      draftId: draft.id,
      workflowRunId: run.id,
      lifecycle: reviewLifecycle,
    });
    return res.status(409).json({
      error: 'Workflow review lifecycle must be approved before generating a durable output',
      code: 'CANVAS_WORKFLOW_REVIEW_REQUIRED',
      recoverable: true,
      data: {
        workflowRunId: run.id,
        lifecycle: reviewLifecycle,
        reviewerId: run.collaboration?.reviewerId || null,
      },
    });
  }

  const now = new Date().toISOString();
  const version = await createVersionSnapshot(
    draft,
    'workflow_run_next_step',
    `Workflow step executed for ${run.title}`,
    userId
  );
  const outputType = workflowOutputType(run.template);
  const output = await createOutputResource(draft, outputType, userId, organizationId, version.id);
  const approvalStepId = pendingApproval?.stepId;
  const nextSteps = run.steps.map((step) => {
    if (approvalStepId && step.id === approvalStepId) {
      return { ...step, status: 'completed' as const, approvedAt: now };
    }
    if (step.kind === 'generated_artifact' && step.status === 'pending') {
      return {
        ...step,
        status: 'completed' as const,
        outputType: output.type,
        outputId: output.id,
        versionId: version.id,
      };
    }
    if (step.kind === 'downstream_conversion' && step.status === 'pending') {
      return {
        ...step,
        status: 'completed' as const,
        outputType: output.type,
        outputId: output.id,
        versionId: version.id,
      };
    }
    return step;
  });
  const completed: WorkCanvasWorkflowRun = {
    ...run,
    status: 'completed',
    steps: nextSteps,
    approvals: run.approvals.map((approval) =>
      pendingApproval && approval.stepId === pendingApproval.stepId
        ? { ...approval, status: 'approved' as const }
        : approval
    ),
    outputs: [
      ...run.outputs,
      {
        stepId:
          nextSteps.find(
            (step) => step.kind === 'generated_artifact' && step.outputId === output.id
          )?.id || run.id,
        type: output.type,
        id: output.id,
        title: output.title,
        url: output.url,
      },
    ],
    events: [
      ...(run.events || []),
      workflowEvent({
        type: 'approved',
        actorId: userId,
        summary: `Approved workflow checkpoint for ${run.title}.`,
        createdAt: now,
        metadata: { approvalStepId },
      }),
      workflowEvent({
        type: 'output_created',
        actorId: userId,
        summary: `Created ${output.type} output: ${output.title}.`,
        createdAt: now,
        metadata: { outputId: output.id, outputType: output.type, versionId: version.id },
      }),
    ],
    updatedAt: now,
  };
  runs[index] = completed;
  const updatedDraft = await updateWorkflowDraftAfterOperation(draft, { workflowRuns: runs });
  return res.json(
    envelope({
      draft: updatedDraft,
      workflowRun: completed,
      outputResource: output,
      version,
      readBack: {
        status: 'completed',
        workflowRunId: completed.id,
        outputId: output.id,
        outputType: output.type,
        sourceVersionId: version.id,
      },
    })
  );
});

router.patch(
  '/drafts/:draftId/workflows/:workflowRunId/collaboration',
  async (req: AuthRequest, res) => {
    const draft = await ownedDraft(req, req.params.draftId);
    if (!draft)
      return res
        .status(404)
        .json({ error: 'Canvas draft not found', code: 'WORK_CANVAS_DRAFT_NOT_FOUND' });
    const baseUpdatedAt = requestedBaseUpdatedAt(req.body);
    if (hasDraftConflict(draft, baseUpdatedAt)) {
      return sendDraftConflict(res, draft, baseUpdatedAt, 'update_workflow_collaboration');
    }
    const runs = workflowRunsFromProvenance(draft.provenance || {});
    const index = runs.findIndex((run) => run.id === req.params.workflowRunId);
    if (index < 0) {
      return res.status(404).json({
        error: 'Workflow run not found',
        code: 'WORK_CANVAS_WORKFLOW_RUN_NOT_FOUND',
      });
    }
    const run = runs[index];
    if (run.draftId !== draft.id || run.conversationId !== draft.conversationId) {
      return res.status(409).json({
        error: 'Workflow context does not match this Canvas draft',
        code: 'WORK_CANVAS_WORKFLOW_CONTEXT_MISMATCH',
      });
    }
    const lifecycle = String(req.body?.lifecycle || run.collaboration?.lifecycle || 'draft');
    if (!['draft', 'in_review', 'approved'].includes(lifecycle)) {
      return res.status(400).json({
        error: 'Workflow lifecycle must be draft, in_review, or approved',
        code: 'WORK_CANVAS_WORKFLOW_LIFECYCLE_INVALID',
      });
    }
    const now = new Date().toISOString();
    const updatedRun: WorkCanvasWorkflowRun = {
      ...run,
      collaboration: {
        ...(run.collaboration || {}),
        ownerId:
          typeof req.body?.ownerId === 'string'
            ? req.body.ownerId.trim() || null
            : run.collaboration?.ownerId || run.createdBy,
        reviewerId:
          typeof req.body?.reviewerId === 'string'
            ? req.body.reviewerId.trim() || null
            : run.collaboration?.reviewerId || null,
        lifecycle: lifecycle as 'draft' | 'in_review' | 'approved',
        comments: run.collaboration?.comments || [],
      },
      events: [
        ...(run.events || []),
        workflowEvent({
          type: 'collaboration_updated',
          actorId: authContext(req).userId,
          summary: `Workflow review metadata updated to ${lifecycle}.`,
          createdAt: now,
          metadata: {
            reviewerId:
              typeof req.body?.reviewerId === 'string'
                ? req.body.reviewerId.trim() || null
                : run.collaboration?.reviewerId || null,
          },
        }),
      ],
      updatedAt: now,
    };
    runs[index] = updatedRun;
    const updatedDraft = await updateWorkflowDraftAfterOperation(draft, { workflowRuns: runs });
    return res.json(
      envelope({
        draft: updatedDraft,
        workflowRun: updatedRun,
        readBack: { status: 'updated', workflowRunId: updatedRun.id },
      })
    );
  }
);

router.post('/drafts/:draftId/workflows/:workflowRunId/comments', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft)
    return res
      .status(404)
      .json({ error: 'Canvas draft not found', code: 'WORK_CANVAS_DRAFT_NOT_FOUND' });
  const baseUpdatedAt = requestedBaseUpdatedAt(req.body);
  if (hasDraftConflict(draft, baseUpdatedAt)) {
    return sendDraftConflict(res, draft, baseUpdatedAt, 'add_workflow_comment');
  }
  const { userId } = authContext(req);
  const runs = workflowRunsFromProvenance(draft.provenance || {});
  const index = runs.findIndex((run) => run.id === req.params.workflowRunId);
  if (index < 0) {
    return res.status(404).json({
      error: 'Workflow run not found',
      code: 'WORK_CANVAS_WORKFLOW_RUN_NOT_FOUND',
    });
  }
  const run = runs[index];
  if (run.draftId !== draft.id || run.conversationId !== draft.conversationId) {
    return res.status(409).json({
      error: 'Workflow context does not match this Canvas draft',
      code: 'WORK_CANVAS_WORKFLOW_CONTEXT_MISMATCH',
    });
  }
  const body = String(req.body?.body || '').trim();
  if (!body) {
    return res.status(400).json({
      error: 'Comment body is required',
      code: 'WORK_CANVAS_WORKFLOW_COMMENT_BODY_REQUIRED',
    });
  }
  const now = new Date().toISOString();
  const comment = {
    id: randomUUID(),
    authorId: userId,
    body: body.slice(0, 2000),
    createdAt: now,
  };
  const updatedRun: WorkCanvasWorkflowRun = {
    ...run,
    collaboration: {
      ownerId: run.collaboration?.ownerId || run.createdBy,
      reviewerId: run.collaboration?.reviewerId || null,
      lifecycle: run.collaboration?.lifecycle || 'draft',
      comments: [...(run.collaboration?.comments || []), comment],
    },
    events: [
      ...(run.events || []),
      workflowEvent({
        type: 'comment_added',
        actorId: userId,
        summary: 'Workflow comment added.',
        createdAt: now,
        metadata: { commentId: comment.id },
      }),
    ],
    updatedAt: now,
  };
  runs[index] = updatedRun;
  const updatedDraft = await updateWorkflowDraftAfterOperation(draft, { workflowRuns: runs });
  return res.status(201).json(
    envelope({
      draft: updatedDraft,
      workflowRun: updatedRun,
      comment,
      readBack: { status: 'commented', workflowRunId: updatedRun.id, commentId: comment.id },
    })
  );
});

router.get('/drafts/:draftId/source-canvas', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });

  const metadata = draft.provenance?.metadata as Record<string, unknown> | undefined;
  const source = metadata?.source as Record<string, unknown> | undefined;
  const sourceDraftId =
    typeof draft.provenance?.sourceDraftId === 'string'
      ? draft.provenance.sourceDraftId
      : typeof source?.draftId === 'string'
        ? source.draftId
        : null;

  if (!sourceDraftId) {
    return res.status(404).json({
      error: 'This Canvas draft does not have a source Canvas lineage.',
    });
  }

  const sourceDraft = await ownedDraft(req, sourceDraftId);
  if (!sourceDraft) return res.status(404).json({ error: 'Source Canvas draft not found' });

  return res.json(
    envelope({
      sourceDraft: {
        id: sourceDraft.id,
        title: sourceDraft.title,
        kind: sourceDraft.kind,
        lifecycleState: sourceDraft.lifecycleState,
        ownerId: sourceDraft.ownerId,
        updatedAt: sourceDraft.updatedAt,
        url: sourceCanvasUrl(sourceDraft.id),
      },
      sourceVersionId: typeof source?.versionId === 'string' ? source.versionId : null,
      openInSourceCanvasUrl: sourceCanvasUrl(sourceDraft.id),
    })
  );
});

router.get('/drafts/:draftId/export', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  const { userId } = authContext(req);
  const format = String(req.query.format || 'markdown').toLowerCase() as ExportFormat;
  const supportedFormats: ExportFormat[] = [
    'markdown',
    'csv',
    'json',
    'pdf',
    'docx',
    'xlsx',
    'pptx',
  ];

  if (!supportedFormats.includes(format)) {
    return res.status(422).json({
      error: `Canvas export format "${format}" is not available yet.`,
      recoverable: true,
      supportedFormats,
      message: 'Use Markdown, CSV, metadata JSON, PDF, DOCX, XLSX, or PPTX export.',
    });
  }

  const filenameBase = draft.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  const safeFilename = filenameBase || draft.id;

  const payload = await exportFormatPayload(draft, userId, format);
  res.setHeader('Content-Type', payload.contentType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${safeFilename}.${payload.extension}"`
  );
  res.setHeader('X-Canvas-Source-Draft', draft.id);
  return res.send(payload.body);
});

router.put('/drafts/:draftId', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  const baseUpdatedAt = requestedBaseUpdatedAt(req.body);
  if (hasMissingOrStaleBaseToken(draft, baseUpdatedAt)) {
    return sendDraftConflict(res, draft, baseUpdatedAt, 'save_draft');
  }
  const payload =
    req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
  // Z139 (full scope): undo the input-sanitizer's HTML-entity escaping before
  // storing rich text AND the title, otherwise every save re-escapes and
  // corrupts the canvas content/title.
  if (typeof payload.contentMd === 'string')
    payload.contentMd = decodeHtmlEntities(payload.contentMd);
  if (typeof payload.content === 'string') payload.content = decodeHtmlEntities(payload.content);
  if (payload.contentJson !== undefined)
    payload.contentJson = deepDecodeHtmlEntities(payload.contentJson);
  if (Array.isArray(payload.blocks)) payload.blocks = deepDecodeHtmlEntities(payload.blocks);
  if (typeof payload.title === 'string') payload.title = decodeHtmlEntities(payload.title);
  const nextKind = String(payload.kind || draft.kind) as DraftKind;
  const allowedKinds: DraftKind[] = [
    'markdown',
    'table',
    'checklist',
    'research',
    'decision',
    'document',
    'report',
    'sheet',
    'deck',
  ];
  const normalizedKind = allowedKinds.includes(nextKind) ? nextKind : draft.kind;
  const nextSaveState =
    payload.saveState === 'saved' ||
    payload.saveState === 'failed' ||
    payload.saveState === 'unsaved'
      ? payload.saveState
      : draft.saveState;
  const nextLifecycleState =
    payload.lifecycleState === 'draft' ||
    payload.lifecycleState === 'proposed' ||
    payload.lifecycleState === 'approved'
      ? payload.lifecycleState
      : draft.lifecycleState;
  const nextVisibility =
    payload.visibility === 'private' || payload.visibility === 'project'
      ? payload.visibility
      : draft.visibility;
  const nextAuditStatus =
    payload.auditStatus === 'not_required' || payload.auditStatus === 'logged'
      ? payload.auditStatus
      : draft.auditStatus;
  const updated: WorkCanvasDraft = {
    ...draft,
    conversationId:
      typeof payload.conversationId === 'string' && payload.conversationId.trim()
        ? payload.conversationId.trim()
        : draft.conversationId,
    kind: normalizedKind,
    title:
      typeof payload.title === 'string' && payload.title.trim()
        ? payload.title.trim()
        : draft.title,
    content:
      payload.content !== undefined
        ? payload.content
        : payload.contentMd !== undefined
          ? String(payload.contentMd || '')
          : draft.content,
    sources: Array.isArray(payload.sources) ? payload.sources : draft.sources,
    provenance:
      payload.provenance && typeof payload.provenance === 'object'
        ? (payload.provenance as Record<string, unknown>)
        : draft.provenance,
    projectId:
      payload.projectId === null || typeof payload.projectId === 'string'
        ? (payload.projectId as string | null)
        : draft.projectId,
    ownerId:
      payload.ownerId === null || typeof payload.ownerId === 'string'
        ? (payload.ownerId as string | null)
        : draft.ownerId,
    researchSessionId:
      payload.researchSessionId === null || typeof payload.researchSessionId === 'string'
        ? (payload.researchSessionId as string | null)
        : draft.researchSessionId,
    saveState: nextSaveState,
    lifecycleState: nextLifecycleState,
    visibility: nextVisibility,
    auditStatus: nextAuditStatus,
    canonicalFormat:
      payload.canonicalFormat === 'json'
        ? 'json'
        : payload.canonicalFormat === 'markdown'
          ? 'markdown'
          : draft.canonicalFormat,
    contentMd:
      typeof payload.contentMd === 'string'
        ? payload.contentMd
        : typeof payload.content === 'string'
          ? payload.content
          : draft.contentMd,
    contentJson: payload.contentJson !== undefined ? payload.contentJson : draft.contentJson,
    blocks: Array.isArray(payload.blocks)
      ? normalizeCanvasArtifactBlocks(payload.blocks)
      : draft.blocks,
    contentSchemaVersion:
      typeof payload.contentSchemaVersion === 'string'
        ? payload.contentSchemaVersion
        : draft.contentSchemaVersion,
    id: draft.id,
    organizationId: draft.organizationId,
    createdBy: draft.createdBy,
    updatedAt: new Date().toISOString(),
  };
  const canonicalWrite = buildCanvasCanonicalWrite(
    {
      kind: draft.kind,
      canonical_format: draft.canonicalFormat,
      content_json: JSON.stringify(draft.content),
      content_md: draft.contentMd,
      content_json_native:
        draft.contentJson === undefined ? null : JSON.stringify(draft.contentJson),
      blocks_json: draft.blocks.length ? JSON.stringify(draft.blocks) : null,
      content_schema_version: draft.contentSchemaVersion,
      markdown_projection_status: draft.markdownProjectionStatus,
      markdown_projected_at: draft.markdownProjectedAt,
      projection_error: draft.projectionError,
    },
    {
      canonicalFormat: updated.canonicalFormat,
      ...(payload.content !== undefined ? { content: payload.content } : {}),
      ...(payload.contentMd !== undefined ? { contentMd: String(payload.contentMd) } : {}),
      ...(payload.contentJson !== undefined ? { contentJson: payload.contentJson } : {}),
      ...(Array.isArray(payload.blocks) ? { blocks: updated.blocks } : {}),
      contentSchemaVersion: updated.contentSchemaVersion,
    }
  );
  updated.contentEnvelope = canonicalWrite.envelope;
  updated.canonicalFormat = updated.contentEnvelope.canonicalFormat;
  updated.contentMd = updated.contentEnvelope.contentMd;
  updated.contentJson = updated.contentEnvelope.contentJson;
  updated.content = updated.canonicalFormat === 'json' ? updated.contentJson : updated.contentMd;
  updated.blocks = normalizeCanvasArtifactBlocks(updated.contentEnvelope.blocks || []);
  updated.contentSchemaVersion = updated.contentEnvelope.contentSchemaVersion || null;
  updated.markdownProjectionStatus = updated.contentEnvelope.markdownProjectionStatus;
  updated.markdownProjectedAt = updated.contentEnvelope.markdownProjectedAt || null;
  updated.projectionError = updated.contentEnvelope.projectionError || null;
  // M01-P06 §8 — the pre-check above (hasMissingOrStaleBaseToken) reads the
  // draft, then compares in application memory: a SELECT-then-compare is NOT
  // CAS by itself (lesson from Notatnik's legacy writer — see AGENTS/memory).
  // Two concurrent PUTs can both pass that check against the same pre-write
  // `updated_at` before either commits. The second half is this WHERE clause:
  // it re-asserts `updated_at = <the token we validated>` atomically inside
  // the UPDATE itself, so only the writer that is still current can affect a
  // row. `changes === 0` means we lost that race — someone else's write
  // landed between our read and our write — and the request is rejected as a
  // conflict exactly like a stale token would be, instead of clobbering it.
  const writeResult = await dbRun(
    `UPDATE work_canvas_drafts
     SET conversation_id = ?, kind = ?, title = ?, content_json = ?, sources_json = ?,
         provenance_json = ?, project_id = ?, owner_id = ?, research_session_id = ?,
         artifact_id = ?, artifact_run_id = ?, artifact_version = ?, save_state = ?,
         lifecycle_state = ?, dirty_state = ?, visibility = ?, audit_status = ?,
         canonical_format = ?, content_md = ?, content_json_native = ?, blocks_json = ?, content_schema_version = ?,
         markdown_projection_status = ?, markdown_projected_at = ?, projection_error = ?, updated_at = ?
     WHERE id = ? AND organization_id = ? AND updated_at = ?`,
    [
      updated.conversationId,
      updated.kind,
      updated.title,
      canonicalWrite.content_json,
      JSON.stringify(updated.sources),
      JSON.stringify(updated.provenance),
      updated.projectId,
      updated.ownerId,
      updated.researchSessionId,
      updated.artifactId,
      updated.artifactRunId,
      updated.artifactVersion,
      updated.saveState,
      updated.lifecycleState,
      updated.dirtyState,
      updated.visibility,
      updated.auditStatus,
      canonicalWrite.canonical_format,
      canonicalWrite.content_md,
      canonicalWrite.content_json_native,
      canonicalWrite.blocks_json,
      canonicalWrite.content_schema_version,
      canonicalWrite.markdown_projection_status,
      canonicalWrite.markdown_projected_at,
      canonicalWrite.projection_error,
      updated.updatedAt,
      updated.id,
      updated.organizationId,
      draft.updatedAt,
    ],
    { fallback: false }
  );
  if (!writeResult || writeResult.changes === 0) {
    const raceRow = await dbGet<DraftRow>(
      `SELECT * FROM work_canvas_drafts WHERE id = ? AND organization_id = ?`,
      [draft.id, draft.organizationId],
      { fallback: false }
    );
    return sendDraftConflict(
      res,
      raceRow ? toDraft(raceRow) : draft,
      baseUpdatedAt,
      'save_draft'
    );
  }

  // C1.1 — autosave now snapshots a version on a sensible cadence. Without this,
  // PUT /drafts/:id (the only route the rich editor hits) never produced a
  // version, so the Versions panel and Restore were decorative — restore would
  // jump the user back to a potentially pre-historic state from /operations or
  // /restore. Cadence: every 5 minutes OR after ~500 chars of net change.
  try {
    const { userId } = authContext(req);
    const oldMd = String(draft.contentMd || '');
    const newMd = String(updated.contentMd || '');
    if (oldMd !== newMd) {
      const lastVersion = (await dbGet(
        `SELECT created_at, content_md FROM work_canvas_versions
         WHERE draft_id = ? ORDER BY created_at DESC LIMIT 1`,
        [updated.id]
      )) as { created_at?: string; content_md?: string } | null;
      const sinceMs = lastVersion?.created_at
        ? Date.now() - new Date(lastVersion.created_at).getTime()
        : Number.POSITIVE_INFINITY;
      const baselineMd = lastVersion?.content_md ?? oldMd;
      const charDelta = Math.abs(newMd.length - String(baselineMd || '').length);
      const FIVE_MIN = 5 * 60 * 1000;
      if (sinceMs >= FIVE_MIN || charDelta >= 500) {
        const summary = lastVersion ? 'Autosave snapshot' : 'Initial autosave';
        await createVersionSnapshot(updated, 'autosave', summary, userId);
      }
    }
  } catch (err: any) {
    // Non-fatal: a failed snapshot must not break the save.
    logger.warn('[WorkCanvas] autosave snapshot failed', { error: err?.message });
  }

  return res.json(envelope(updated, { auditEventId: `ae-${randomUUID()}` }));
});

router.post('/drafts/:draftId/proposals', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  const { organizationId, userId } = authContext(req);
  try {
    const proposal = await workCanvasService.createProposal({
      organizationId,
      actorUserId: userId,
      draftId: draft.id,
      target: String(req.body?.target || 'idea') as workCanvasService.WorkCanvasTarget,
      payload:
        req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : undefined,
      // FIX (Codex delta review, area 2): optional client-supplied
      // idempotency key — a double-click/retry on this same key returns
      // the SAME proposal instead of minting a second one. Omitting it
      // preserves the exact pre-fix behavior.
      clientIdempotencyKey:
        typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey : null,
    });
    return res.status(201).json(envelope(proposal, { auditEventId: `ae-${randomUUID()}` }));
  } catch (error) {
    return sendProposalServiceError(res, error);
  }
});

router.get('/drafts/:draftId/proposals', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  return res.json(
    envelope(
      await workCanvasService.listProposals({
        organizationId: authContext(req).organizationId,
        draftId: draft.id,
      })
    )
  );
});

router.post('/proposals/:proposalId/reject', async (req: AuthRequest, res) => {
  const { organizationId } = authContext(req);
  const proposal = await workCanvasService.getProposal({
    organizationId,
    proposalId: req.params.proposalId,
  });
  if (!proposal || !(await ownedDraft(req, proposal.draftId))) {
    return res.status(404).json({ error: 'Canvas proposal not found' });
  }
  try {
    // FIX (M01-P07A — audit hardening): this handler previously called
    // rejectProposal() with no auditEventId at all, so `audit_event_id`
    // stayed NULL in the database for every real reject that ever went
    // through this route — the column exists (and IS populated on other
    // work-canvas write paths, e.g. draft save/create) but was structurally
    // dead for proposal rejection. Mint one here, the same
    // `ae-${randomUUID()}` convention used elsewhere in this file (see the
    // draft create/save/operations handlers above), so a reject leaves the
    // same kind of durable audit marker an approve does.
    const auditEventId = `ae-${randomUUID()}`;
    const updated = await workCanvasService.rejectProposal({
      organizationId,
      proposalId: proposal.id,
      auditEventId,
      reason: typeof req.body?.reason === 'string' ? req.body.reason : undefined,
    });
    return res.json(
      envelope(updated, { readBack: updated.readBack, auditEventId: updated.auditEventId })
    );
  } catch (error) {
    return sendProposalServiceError(res, error);
  }
});

router.post('/proposals/:proposalId/approve', async (req: AuthRequest, res) => {
  const { organizationId, userId } = authContext(req);
  const proposal = await workCanvasService.getProposal({
    organizationId,
    proposalId: req.params.proposalId,
  });
  if (!proposal || !(await ownedDraft(req, proposal.draftId))) {
    return res.status(404).json({ error: 'Canvas proposal not found' });
  }
  if (!(await hasCanvasCapability(req, proposal.requiredCapability))) {
    logger.warn('[work-canvas] canvas.proposal.capability_denied', {
      proposalId: proposal.id,
      requiredCapability: proposal.requiredCapability,
      userId: authContext(req).userId,
    });
    return res.status(403).json({
      error: 'Canvas proposal approval requires additional capability',
      code: 'CANVAS_PROPOSAL_CAPABILITY_REQUIRED',
      recoverable: true,
      requiredCapability: proposal.requiredCapability,
    });
  }
  try {
    // FIX (M01-P07A — audit hardening): same gap as reject (see comment
    // there) — approve never minted an auditEventId either, so
    // `updated.auditEventId` echoed back in the response envelope below was
    // always null and the persisted `audit_event_id` column never recorded
    // an approval event.
    const auditEventId = `ae-${randomUUID()}`;
    const updated = await workCanvasService.approveProposal({
      organizationId,
      actorUserId: userId,
      proposalId: proposal.id,
      auditEventId,
    });
    return res.json(
      envelope(updated, { readBack: updated.readBack, auditEventId: updated.auditEventId })
    );
  } catch (error) {
    return sendProposalServiceError(res, error);
  }
});

router.get('/drafts/:draftId/versions', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  // B1 — cap the history payload: newest 50 snapshots are plenty for the
  // version-history UI and keep full contentMd rows from ballooning responses.
  const rows = await dbAll<VersionRow>(
    `SELECT * FROM work_canvas_versions WHERE draft_id = ? ORDER BY created_at DESC LIMIT 50`,
    [draft.id],
    { fallback: false }
  );
  return res.json(envelope(rows.map(toVersion)));
});

router.post('/drafts/:draftId/operations', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  const { userId } = authContext(req);
  try {
    const baseUpdatedAt = requestedBaseUpdatedAt(req.body);
    if (hasDraftConflict(draft, baseUpdatedAt)) {
      return sendDraftConflict(res, draft, baseUpdatedAt, 'apply_operation');
    }
    const operation = req.body?.operation;
    const operationType = String(operation?.type || '');
    const isBlockOperation = [
      'insert_block',
      'update_block',
      'delete_block',
      'convert_block',
      'generate_block_from_selection',
      'generate_artifact_from_dataset',
      'regenerate_projection',
    ].includes(operationType);
    const applied = isBlockOperation
      ? applyBlockOperation(draft, operation, userId)
      : applyEditOperation(draft, operation);
    const preview = operationPreview({
      proposedChange: applied.proposedChange,
      affectedBlocks: applied.affectedBlocks,
      beforeMd: draft.contentMd,
      afterMd: applied.contentMd,
      approvalRequired: applied.approvalRequired,
    });
    if (req.body?.previewOnly) {
      return res.json(envelope({ draft, preview }));
    }
    if (applied.approvalRequired && operation?.approved !== true) {
      return res.status(409).json({
        error: 'Canvas transformation requires approval before applying',
        data: { preview },
      });
    }
    const version = await createVersionSnapshot(draft, operationType, applied.summary, userId);
    const now = new Date().toISOString();
    const updatedEnvelope = createArtifactContentEnvelope({
      artifactType: draft.kind,
      canonicalFormat: draft.canonicalFormat,
      contentMd: applied.contentMd,
      contentJson: draft.contentJson,
      blocks: applied.blocks,
      contentSchemaVersion: draft.contentSchemaVersion || undefined,
    });
    const updated: WorkCanvasDraft = {
      ...draft,
      content: applied.contentMd,
      contentEnvelope: updatedEnvelope,
      canonicalFormat: updatedEnvelope.canonicalFormat,
      contentMd: updatedEnvelope.contentMd,
      contentJson: updatedEnvelope.contentJson,
      blocks: normalizeCanvasArtifactBlocks(updatedEnvelope.blocks || []),
      contentSchemaVersion: updatedEnvelope.contentSchemaVersion || null,
      markdownProjectionStatus: updatedEnvelope.markdownProjectionStatus,
      markdownProjectedAt: updatedEnvelope.markdownProjectedAt || null,
      projectionError: updatedEnvelope.projectionError || null,
      saveState: 'saved',
      dirtyState: 'clean',
      updatedAt: now,
    };
    // M01-P06 §8 — same atomic guard as PUT /drafts/:draftId: re-assert the
    // row's `updated_at` inside the UPDATE itself so a write that raced past
    // the `hasDraftConflict` pre-check above (which only compares against a
    // snapshot read at the top of this handler) still cannot silently land
    // on top of a concurrently-committed write.
    const opWriteResult = await dbRun(
      `UPDATE work_canvas_drafts
       SET content_json = ?, canonical_format = ?, content_md = ?, content_json_native = ?, blocks_json = ?,
           content_schema_version = ?, markdown_projection_status = ?, markdown_projected_at = ?,
           projection_error = ?, save_state = ?, dirty_state = ?, updated_at = ?
       WHERE id = ? AND organization_id = ? AND updated_at = ?`,
      [
        JSON.stringify(updated.content),
        updated.canonicalFormat,
        updated.contentMd,
        updated.contentJson === undefined ? null : JSON.stringify(updated.contentJson),
        updated.blocks.length > 0 ? JSON.stringify(updated.blocks) : null,
        updated.contentSchemaVersion,
        updated.markdownProjectionStatus,
        updated.markdownProjectedAt,
        updated.projectionError,
        updated.saveState,
        updated.dirtyState,
        updated.updatedAt,
        updated.id,
        updated.organizationId,
        draft.updatedAt,
      ],
      { fallback: false }
    );
    if (!opWriteResult || opWriteResult.changes === 0) {
      const raceRow = await dbGet<DraftRow>(
        `SELECT * FROM work_canvas_drafts WHERE id = ? AND organization_id = ?`,
        [draft.id, draft.organizationId],
        { fallback: false }
      );
      return sendDraftConflict(
        res,
        raceRow ? toDraft(raceRow) : draft,
        baseUpdatedAt,
        'apply_operation'
      );
    }
    return res.json(
      envelope({
        draft: updated,
        version,
        diff: diffSummary(draft.contentMd, updated.contentMd),
        preview: {
          ...preview,
          markdownDiff: diffSummary(draft.contentMd, updated.contentMd),
        },
      })
    );
  } catch (error) {
    logger.error('[work-canvas] apply_operation_failed', {
      err: error,
      correlationId: (req as unknown as { correlationId?: string }).correlationId,
    });
    return res.status(400).json({
      error: 'Failed to apply Canvas operation',
      code: 'CANVAS_OPERATION_APPLY_FAILED',
    });
  }
});

router.post('/drafts/:draftId/versions/:versionId/restore', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  const { userId } = authContext(req);
  const baseUpdatedAt = requestedBaseUpdatedAt(req.body);
  if (hasDraftConflict(draft, baseUpdatedAt)) {
    return sendDraftConflict(res, draft, baseUpdatedAt, 'restore_version');
  }
  const versionRow = await dbGet<VersionRow>(
    `SELECT * FROM work_canvas_versions WHERE id = ? AND draft_id = ?`,
    [req.params.versionId, draft.id],
    { fallback: false }
  );
  if (!versionRow) return res.status(404).json({ error: 'Canvas version not found' });
  const version = toVersion(versionRow);
  await createVersionSnapshot(draft, 'restore_version', `Restored version ${version.id}`, userId);
  const now = new Date().toISOString();
  const restoredFormat = inferCanvasVersionFormat(versionRow);
  const restoredWrite = buildCanvasCanonicalWrite(
    {
      kind: draft.kind,
      canonical_format: draft.canonicalFormat,
      content_json: JSON.stringify(draft.content),
      content_md: draft.contentMd,
      content_json_native:
        draft.contentJson === undefined ? null : JSON.stringify(draft.contentJson),
      blocks_json: draft.blocks.length ? JSON.stringify(draft.blocks) : null,
      content_schema_version: draft.contentSchemaVersion,
      markdown_projection_status: draft.markdownProjectionStatus,
      markdown_projected_at: draft.markdownProjectedAt,
      projection_error: draft.projectionError,
    },
    restoredFormat === 'json'
      ? {
          canonicalFormat: 'json',
          contentJson: version.contentJson,
          contentMd: version.contentMd,
          blocks: version.blocks,
          contentSchemaVersion: 'legacy/v0',
        }
      : {
          canonicalFormat: 'markdown',
          contentMd: version.contentMd,
          blocks: version.blocks,
          contentSchemaVersion: 'legacy/v0',
        }
  );
  const restoredEnvelope = restoredWrite.envelope;
  const restored: WorkCanvasDraft = {
    ...draft,
    content:
      restoredEnvelope.canonicalFormat === 'json'
        ? restoredEnvelope.contentJson
        : restoredEnvelope.contentMd,
    contentEnvelope: restoredEnvelope,
    canonicalFormat: restoredEnvelope.canonicalFormat,
    contentMd: restoredEnvelope.contentMd,
    contentJson: restoredEnvelope.contentJson,
    blocks: normalizeCanvasArtifactBlocks(restoredEnvelope.blocks || []),
    markdownProjectionStatus: restoredEnvelope.markdownProjectionStatus,
    markdownProjectedAt: restoredEnvelope.markdownProjectedAt || null,
    projectionError: restoredEnvelope.projectionError || null,
    saveState: 'saved',
    dirtyState: 'clean',
    updatedAt: now,
  };
  // M01-P06 §8 — same atomic guard as PUT /drafts/:draftId and /operations:
  // re-assert `updated_at` inside the UPDATE so a restore cannot silently
  // land on top of a write that committed after this handler's initial read.
  const restoreWriteResult = await dbRun(
    `UPDATE work_canvas_drafts
     SET content_json = ?, canonical_format = ?, content_md = ?, content_json_native = ?, blocks_json = ?, content_schema_version = ?,
         markdown_projection_status = ?, markdown_projected_at = ?, projection_error = ?,
         save_state = ?, dirty_state = ?, updated_at = ?
     WHERE id = ? AND organization_id = ? AND updated_at = ?`,
    [
      restoredWrite.content_json,
      restoredWrite.canonical_format,
      restoredWrite.content_md,
      restoredWrite.content_json_native,
      restoredWrite.blocks_json,
      restoredWrite.content_schema_version,
      restoredWrite.markdown_projection_status,
      restoredWrite.markdown_projected_at,
      restoredWrite.projection_error,
      restored.saveState,
      restored.dirtyState,
      restored.updatedAt,
      restored.id,
      restored.organizationId,
      draft.updatedAt,
    ],
    { fallback: false }
  );
  if (!restoreWriteResult || restoreWriteResult.changes === 0) {
    const raceRow = await dbGet<DraftRow>(
      `SELECT * FROM work_canvas_drafts WHERE id = ? AND organization_id = ?`,
      [draft.id, draft.organizationId],
      { fallback: false }
    );
    return sendDraftConflict(
      res,
      raceRow ? toDraft(raceRow) : draft,
      baseUpdatedAt,
      'restore_version'
    );
  }
  const readBackRow = await dbGet<DraftRow>(
    `SELECT * FROM work_canvas_drafts WHERE id = ? AND organization_id = ?`,
    [restored.id, restored.organizationId],
    { fallback: false }
  );
  if (!readBackRow) return res.status(500).json({ error: 'Canvas restore read-back failed' });
  return res.json(envelope({ draft: toDraft(readBackRow), restoredVersion: version }));
});

router.post('/drafts/:draftId/share', async (req: AuthRequest, res) => {
  // P0-2 — mirror the UI gate: minting a public link requires canvas.share,
  // not just draft ownership (direct API calls used to bypass the UI check).
  if (!(await requireCanvasCapability(req, res, 'canvas.share'))) return;
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  const token = randomUUID().replace(/-/g, '');
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const share = {
    token,
    // New shares land on the public, unauthenticated viewer (frontend route
    // /public/artifacts/:token backed by GET /api/public/artifacts/:token).
    // The legacy authenticated GET /shared/:token below keeps working for
    // links minted before this change.
    url: `/public/artifacts/${token}`,
    title: draft.title,
    createdAt,
    expiresAt,
  };
  const updated = await updateDraftAfterOperation(draft, { share });
  return res.json(envelope({ draft: updated, share }));
});

// Revoke a share: removes provenance.share from the draft (same read-modify-
// write path as the share POST above). Once the share object is gone, both
// the public viewer (GET /api/public/artifacts/:token) and the legacy
// authenticated GET /shared/:token resolve to 404 — `sharedDraftPayload` /
// `parseShare` treat a missing or null share as "no share".
router.delete('/drafts/:draftId/share', async (req: AuthRequest, res) => {
  // P0-2 — same capability as POST: revoke manages the share lifecycle too.
  if (!(await requireCanvasCapability(req, res, 'canvas.share'))) return;
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  if (!draft.provenance?.share) {
    // Idempotent: revoking an unshared draft is a no-op, not an error.
    return res.json(envelope({ draft, share: null }));
  }
  const updated = await updateDraftAfterOperation(draft, { share: null });
  return res.json(envelope({ draft: updated, share: null }));
});

router.get('/shared/:token', async (req: AuthRequest, res) => {
  await ensureStorage();
  const { organizationId } = authContext(req);
  const token = String(req.params.token || '').trim();
  if (!token) return res.status(400).json({ error: 'Share token is required' });
  // SEC-M02-4 (L-10): canvas share tokens are 32-char hex (randomUUID without
  // dashes — see POST /drafts/:draftId/share). Reject malformed tokens BEFORE
  // the `provenance_json LIKE '%<token>%'` scan: an unconstrained, user-shaped
  // LIKE pattern (e.g. '%' or a short fragment) would match unrelated drafts and
  // let a caller probe the org's share corpus. Same 404 as "not found" — no oracle.
  if (!/^[0-9a-f]{32}$/i.test(token)) {
    return res.status(404).json({ error: 'Shared Canvas draft not found' });
  }
  const rows = await dbAll<DraftRow>(
    `SELECT * FROM work_canvas_drafts
     WHERE organization_id = ? AND provenance_json LIKE ?
     ORDER BY updated_at DESC`,
    [organizationId, `%${token}%`],
    { fallback: false }
  );
  const match = rows.map(toDraft).find((draft) => sharedDraftPayload(draft)?.token === token);
  if (!match) {
    return res.status(404).json({ error: 'Shared Canvas draft not found' });
  }
  const share = sharedDraftPayload(match);
  if (!share) return res.status(404).json({ error: 'Shared Canvas draft not found' });
  if (Date.parse(share.expiresAt) < Date.now()) {
    return res.status(410).json({
      error: 'Shared Canvas link expired',
      code: 'CANVAS_SHARE_EXPIRED',
      recoverable: true,
      data: { token: share.token, expiredAt: share.expiresAt },
    });
  }
  return res.json(
    envelope({
      draftId: match.id,
      title: match.title,
      kind: match.kind,
      contentMd: match.contentMd,
      markdownProjectionStatus: match.markdownProjectionStatus,
      updatedAt: match.updatedAt,
      share,
    })
  );
});

router.post('/drafts/:draftId/save-to-workspace', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  const { organizationId, userId } = authContext(req);
  const target = String(req.body?.target || '') as WorkspaceTarget;
  // C3 — `decision` is fully implemented in createWorkspaceResource (real
  // INSERT into decisions). This guard was the only thing keeping the chat-
  // shell from being able to send to it; ecosystem audit flagged it as a
  // 1-line fix.
  // C4.1 — `task` added: createWorkspaceResource now has a task branch using
  // TaskService.createTask (canonical path).
  if (!['idea', 'note', 'initiative', 'decision', 'task'].includes(target)) {
    return res
      .status(400)
      .json({ error: 'target must be idea, note, initiative, decision, or task' });
  }
  // SEC-M02 (L-08): direct materialization must enforce the SAME
  // canvas.convert.<target> capability the panel gates on (`canSendToIdea` …)
  // and that the proposal-approval path enforces — otherwise a direct API call
  // bypasses the convert gate the UI shows.
  if (!(await requireCanvasCapability(req, res, `canvas.convert.${target}`))) return;

  try {
    const version = await createVersionSnapshot(
      draft,
      `save_to_workspace:${target}`,
      `Saved Canvas draft to ${target}`,
      userId
    );
    const linkedResource = await createWorkspaceResource(draft, target, userId, organizationId);
    const previousLinks =
      draft.provenance?.linkedWorkspaceResources &&
      typeof draft.provenance.linkedWorkspaceResources === 'object'
        ? (draft.provenance.linkedWorkspaceResources as Record<string, unknown>)
        : {};
    // C4 — provenance loop closure: `linkedWorkspaceResources` keeps only the
    // LAST entity per target (map keyed by target), so repeated promotes lose
    // history. `materializedTo[]` is the append-only ledger of everything this
    // draft materialized — the panel renders it as "Utworzone z tego dokumentu".
    const previousMaterialized = Array.isArray(draft.provenance?.materializedTo)
      ? (draft.provenance.materializedTo as unknown[])
      : [];
    const updatedDraft = await updateDraftAfterOperation(draft, {
      linkedWorkspaceResources: {
        ...previousLinks,
        [target]: {
          id: linkedResource.id,
          title: linkedResource.title,
          url: linkedResource.url,
          linkedAt: new Date().toISOString(),
        },
      },
      materializedTo: [
        ...previousMaterialized,
        {
          target,
          entityId: linkedResource.id,
          url: linkedResource.url,
          title: linkedResource.title,
          at: new Date().toISOString(),
        },
      ],
    });
    return res.json(
      envelope({
        draft: updatedDraft,
        linkedResource: {
          type: linkedResource.type,
          id: linkedResource.id,
          title: linkedResource.title,
          url: linkedResource.url,
        },
        readBack: linkedResource.readBack,
        version,
      })
    );
  } catch (error) {
    logger.error('[work-canvas] canvas.save.failed', {
      draftId: draft.id,
      target,
      error: error instanceof Error ? error.message : String(error),
    });
    // C8 — the shared materializer throws statusCode 403 +
    // CANVAS_CROSS_ORG_REFERENCE when a referenced entity (projectId / owner /
    // assignee) is missing or belongs to another organization. Surface it
    // instead of collapsing into a blanket 500.
    const errorRecord = error as { statusCode?: unknown; code?: unknown };
    if (errorRecord?.statusCode === 403) {
      return res.status(403).json({
        error: 'Referenced entity is outside organization',
        code: typeof errorRecord.code === 'string' ? errorRecord.code : 'CANVAS_FORBIDDEN',
        recoverable: true,
      });
    }
    return res.status(500).json({
      error: 'Failed to save Canvas to workspace',
    });
  }
});

router.post('/drafts/:draftId/create-output', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  const { organizationId, userId } = authContext(req);
  const outputType = String(req.body?.outputType || '') as OutputType;
  if (!['presentation', 'table', 'report'].includes(outputType)) {
    return res.status(400).json({ error: 'outputType must be presentation, table, or report' });
  }
  // SEC-M02 (L-08): enforce canvas.output.<type> server-side (the panel gates
  // canCreatePresentation/Table/Report on the same capability).
  if (!(await requireCanvasCapability(req, res, `canvas.output.${outputType}`))) return;

  try {
    const version = await createVersionSnapshot(
      draft,
      `create_output:${outputType}`,
      `Created ${outputType} output from Canvas draft`,
      userId
    );
    const outputResource = await createOutputResource(
      draft,
      outputType,
      userId,
      organizationId,
      version.id
    );
    const previousOutputs = Array.isArray(draft.provenance?.createdOutputs)
      ? draft.provenance.createdOutputs
      : [];
    const updatedDraft = await updateDraftAfterOperation(draft, {
      createdOutputs: [
        ...previousOutputs,
        {
          type: outputResource.type,
          id: outputResource.id,
          title: outputResource.title,
          url: outputResource.url,
          metadata: outputResource.metadata,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    return res.json(
      envelope({
        draft: updatedDraft,
        outputResource: {
          type: outputResource.type,
          id: outputResource.id,
          title: outputResource.title,
          url: outputResource.url,
          metadata: outputResource.metadata,
        },
        readBack: outputResource.readBack,
        version,
      })
    );
  } catch (error) {
    logger.error('[work-canvas] canvas.save.failed', {
      draftId: draft.id,
      outputType,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      error: 'Failed to create Canvas output',
    });
  }
});

router.post('/drafts/:draftId/research/finalize-report', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  if (draft.kind !== 'research') {
    return res.status(409).json({
      error: 'Research final report can only be created from a research Canvas draft',
      code: 'CANVAS_RESEARCH_NOT_ELIGIBLE',
      recoverable: true,
    });
  }

  const { organizationId, userId } = authContext(req);
  const now = new Date().toISOString();
  try {
    const version = await createVersionSnapshot(
      draft,
      'research_finalize_report',
      'Finalized research report from Canvas draft',
      userId
    );
    const outputResource = await createOutputResource(
      draft,
      'report',
      userId,
      organizationId,
      version.id
    );
    const evidenceSummary = (draft.blocks || [])
      .filter((block) => block.kind === 'research')
      .map((block) => {
        const record =
          block.data && typeof block.data === 'object'
            ? (block.data as Record<string, unknown>)
            : {};
        const sources = Array.isArray(record.sources) ? record.sources : [];
        return {
          blockId: block.id,
          title: block.title,
          sourceCount: sources.length,
          confidence:
            typeof record.confidence === 'string' && record.confidence.trim()
              ? record.confidence
              : 'unknown',
        };
      });
    const updatedDraft = await updateDraftAfterOperation(draft, {
      researchFinalReport: {
        status: 'promotion_recorded',
        sourceDraftId: draft.id,
        sourceVersionId: version.id,
        researchSessionId: draft.researchSessionId || null,
        reportDraftId: outputResource.id,
        reportTitle: outputResource.title,
        reportUrl: outputResource.url,
        finalizedAt: now,
        evidenceSummary,
      },
    });
    const readBack = {
      target: 'research_final_report',
      status: 'promotion_recorded',
      sourceDraftId: draft.id,
      sourceVersionId: version.id,
      researchSessionId: draft.researchSessionId,
      reportDraftId: outputResource.id,
      reportTitle: outputResource.title,
      reportUrl: outputResource.url,
      evidenceSummary,
    };
    logger.info('[work-canvas] canvas.research.final_report_promoted', {
      draftId: draft.id,
      reportDraftId: outputResource.id,
      researchSessionId: draft.researchSessionId,
      evidenceBlocks: evidenceSummary.length,
    });
    return res.json(
      envelope({
        draft: updatedDraft,
        reportResource: {
          type: outputResource.type,
          id: outputResource.id,
          title: outputResource.title,
          url: outputResource.url,
          metadata: outputResource.metadata,
        },
        readBack,
        version,
      })
    );
  } catch (error) {
    logger.error('[work-canvas] canvas.save.failed', {
      draftId: draft.id,
      target: 'research_final_report',
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      error: 'Failed to finalize Canvas research report',
    });
  }
});

/**
 * L-2 — Canvas → Table Studio bridge (for `kind='table'` drafts).
 *
 * Previously a `kind='table'` Canvas produced a sibling `work_canvas_drafts`
 * row containing the markdown table; Table Studio never saw it. This endpoint
 * promotes the table into a real Table Studio entry: `tp_bases` (auto-bootstrap
 * "Canvas Workspace" if needed), `tp_tables` (one per Canvas table), `tp_fields`
 * (typed via canvasTableSeed.buildCanvasTableSeed inference — date / number /
 * single_line_text / long_text), `tp_records` (one per markdown table row, with
 * cell values coerced to the inferred type).
 *
 * Only enabled for `kind='table'`. Narrative drafts get a 400 with a hint —
 * the audit's L-2 rationale (naïve column inference would make Table Studio
 * worse, not better) still applies for non-table kinds.
 */
router.post('/drafts/:draftId/send-to-table-studio', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  if (draft.kind !== 'table') {
    return res.status(400).json({
      error: 'Table Studio handoff requires a Canvas with kind=table',
      code: 'CANVAS_NOT_TABLE_KIND',
    });
  }
  // SEC-M02 (L-08): Table Studio handoff is a table output → canvas.output.table.
  if (!(await requireCanvasCapability(req, res, 'canvas.output.table'))) return;
  const { organizationId, userId } = authContext(req);
  const title = firstMarkdownHeading(draft.contentMd, draft.title || 'Canvas table');

  try {
    const materialized = await materializeCanvasTable({
      organizationId,
      actorUserId: userId,
      sourceDraftId: draft.id,
      title,
      contentMd: draft.contentMd,
    });
    const { baseId, tableId } = materialized;

    // Back-link on the Canvas draft.
    const previousLinks =
      draft.provenance?.linkedWorkspaceResources &&
      typeof draft.provenance.linkedWorkspaceResources === 'object'
        ? (draft.provenance.linkedWorkspaceResources as Record<string, unknown>)
        : {};
    const updatedDraft = await updateDraftAfterOperation(draft, {
      linkedWorkspaceResources: {
        ...previousLinks,
        table_studio: {
          id: tableId,
          title,
          url: `/table-studio?baseId=${encodeURIComponent(baseId)}&tableId=${encodeURIComponent(tableId)}`,
          linkedAt: new Date().toISOString(),
        },
      },
    });

    return res.json(
      envelope({
        draft: updatedDraft,
        linkedResource: {
          type: 'table_studio',
          id: tableId,
          title,
          url: `/table-studio?baseId=${encodeURIComponent(baseId)}&tableId=${encodeURIComponent(tableId)}`,
        },
        readBack: {
          target: 'table_studio',
          baseId,
          tableId,
          fieldCount: materialized.fieldCount,
          recordCount: materialized.recordCount,
          status: 'created',
        },
      })
    );
  } catch (error) {
    logger.error('[work-canvas] canvas.table_studio.failed', {
      draftId: draft.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      error: 'Failed to send Canvas to Table Studio',
    });
  }
});

/**
 * M-5 — Canvas → Outputs Library registration.
 *
 * Previously the `saveToOutputs` UI action downloaded a markdown blob and
 * redirected to /outputs (which didn't exist — see W2-E3) or /presentations
 * (which existed but had no record of the Canvas). Now this endpoint registers
 * the Canvas draft inside the canonical Outputs registry
 * (`v8_output_artifacts`, canonical_home='outputs_library') via
 * `artifactRegistryService.registerArtifactOrigin` — the same path
 * DocumentStudio and PresentationStudio use. The Outputs aggregate tab can
 * now list real Canvas-origin entries.
 *
 * Registers the Canvas under the same convention DocumentStudio (G5) and the
 * deliverables doc runtime (C7) use for registry-native documents:
 * outputType='report' + artifactFamily='document' + originRuntime='native_artifact'.
 * ('work_canvas' is NOT a valid runtime/family — RegisterArtifactOriginParamsSchema
 * and the DB CHECK constraints on v8_artifact_origin_links.origin_runtime /
 * v8_output_artifacts.artifact_family both reject it.) Canvas provenance lives
 * in originSummary.sourceType='work_canvas'. Registration is idempotent on
 * (organization, origin_runtime, origin_record_id) — calling twice produces a
 * single artifact and updates its metadata.
 */
router.post('/drafts/:draftId/register-in-outputs', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  const { organizationId, userId } = authContext(req);
  const title = firstMarkdownHeading(draft.contentMd, draft.title || 'Canvas output');

  try {
    const { registerArtifactOrigin } = await import('../services/v8/artifactRegistryService.js');
    const artifact = await registerArtifactOrigin({
      organizationId,
      outputType: 'report',
      artifactFamily: 'document',
      originRuntime: 'native_artifact',
      originRecordId: draft.id,
      titleSnapshot: title,
      ownerUserId: userId,
      createdBy: userId,
      visibilityScope: undefined,
      projectId: draft.projectId || null,
      originSummary: {
        sourceType: 'work_canvas',
        sourceTable: 'work_canvas_drafts',
        contentMdLength: (draft.contentMd || '').length,
      },
    });

    // X6 — W5 Transactional Outputs Registry: fire-and-forget parallel call to
    // ensure both v8_output_artifacts + v8_artifact_origin_links are registered
    // atomically. Runs alongside the existing registerArtifactOrigin path (additive,
    // idempotent). Fail-open: errors are swallowed so the primary response is unaffected.
    import('../services/v8/outputsTransactionalRegistry.js')
      .then(({ registerOutputArtifactTransactional }) =>
        registerOutputArtifactTransactional({
          organizationId,
          outputType: 'report',
          artifactFamily: 'document',
          originRuntime: 'native_artifact',
          originRecordId: draft.id,
          titleSnapshot: title,
          ownerUserId: userId,
          createdBy: userId,
          projectId: draft.projectId || null,
          originSummary: {
            sourceType: 'work_canvas',
            sourceTable: 'work_canvas_drafts',
            contentMdLength: (draft.contentMd || '').length,
          },
        })
      )
      .catch((x6Err: unknown) => {
        logger.warn('[work-canvas] X6 registerOutputArtifactTransactional failed (non-blocking)', {
          draftId: draft.id,
          error: x6Err instanceof Error ? x6Err.message : String(x6Err),
        });
      });

    const previousLinks =
      draft.provenance?.linkedWorkspaceResources &&
      typeof draft.provenance.linkedWorkspaceResources === 'object'
        ? (draft.provenance.linkedWorkspaceResources as Record<string, unknown>)
        : {};
    const updatedDraft = await updateDraftAfterOperation(draft, {
      linkedWorkspaceResources: {
        ...previousLinks,
        outputs_library: {
          id: artifact?.artifactId || draft.id,
          title,
          url: `/presentations?tab=outputs&artifactId=${encodeURIComponent(
            String(artifact?.artifactId || draft.id)
          )}`,
          linkedAt: new Date().toISOString(),
        },
      },
    });

    return res.json(
      envelope({
        draft: updatedDraft,
        linkedResource: {
          type: 'outputs_library',
          id: String(artifact?.artifactId || draft.id),
          title,
          url: `/presentations?tab=outputs&artifactId=${encodeURIComponent(
            String(artifact?.artifactId || draft.id)
          )}`,
        },
        readBack: {
          target: 'outputs_library',
          artifactId: artifact?.artifactId || null,
          status: 'registered',
        },
      })
    );
  } catch (error) {
    logger.error('[work-canvas] canvas.outputs.register_failed', {
      draftId: draft.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      error: 'Failed to register Canvas in Outputs',
    });
  }
});

/**
 * L-1 — Canvas → DocumentStudio bridge.
 *
 * Previously the only path from Canvas to DocumentStudio was: user downloads
 * .docx, manually uploads to DocumentStudio. The proper intake → plan →
 * generate pipeline was unreachable from the chat-shell. This endpoint wires
 * the Canvas draft directly into DocumentStudio's `materializeDocumentArtifact`
 * so the Canvas's markdown becomes a real DocumentStudio artifact with a back-
 * link to its source draft.
 *
 * The Canvas's markdown is forwarded as the `intake.description` so
 * DocumentStudio's narrative planner can section it normally; the sectionized
 * heading list from `markdownSections` is also passed as `sourceHints` so the
 * planner has structured context. The first-heading or draft title becomes
 * `intake.title`. The source draft id is recorded in `sourceRefs` so the
 * resulting artifact knows where it came from.
 */
router.post('/drafts/:draftId/send-to-document-studio', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  // SEC-M02 (L-08): Document Studio handoff produces a report output → canvas.output.report.
  if (!(await requireCanvasCapability(req, res, 'canvas.output.report'))) return;
  const { organizationId, userId } = authContext(req);

  const title = firstMarkdownHeading(draft.contentMd, draft.title || 'Canvas document');
  const sections = markdownSections(draft.contentMd).slice(0, 12);
  const language = String(req.body?.language || '').toLowerCase() === 'en' ? 'en' : 'pl';
  const documentType = String(req.body?.documentType || 'business_brief');
  const useLlm = req.body?.useLlm === true;

  try {
    const { materializeDocumentArtifact } =
      await import('../services/documentStudio/documentStudioService.js');
    // DocumentStudio accepts `description` as the narrative seed. We pass the
    // full markdown so the planner sees the prose; `sourceHints` carries the
    // section list as structured context so the planner can preserve the
    // user's heading topology when it builds the outline.
    const intake = {
      title,
      description: draft.contentMd || title,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      documentType: documentType as any,
      language,
      sourceHints: sections.map((section) => ({
        type: 'inline' as const,
        title: section.heading,
        excerpt: section.body.slice(0, 1200),
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const result = await materializeDocumentArtifact({
      organizationId,
      userId,
      intake,
      // Pass the source-draft id through sourceRefs so the artifact records
      // its origin (`work_canvas_drafts/<draftId>`) — visible in the Outputs
      // hub via artifactRegistryService.registerArtifactOrigin (which the
      // /generate route already calls).
      sourceRefs: [
        {
          sourceType: 'work_canvas',
          sourceId: draft.id,
          sourceTitle: title,
        },
      ],
      projectId: draft.projectId || null,
      useLlm,
    });

    // Record the back-link on the draft so Canvas's UI can show "Open in
    // DocumentStudio" on subsequent loads.
    const previousLinks =
      draft.provenance?.linkedWorkspaceResources &&
      typeof draft.provenance.linkedWorkspaceResources === 'object'
        ? (draft.provenance.linkedWorkspaceResources as Record<string, unknown>)
        : {};
    const updatedDraft = await updateDraftAfterOperation(draft, {
      linkedWorkspaceResources: {
        ...previousLinks,
        document_studio: {
          id: result.artifactId,
          title: String(result.schema?.title || title),
          url: `/documents/${encodeURIComponent(String(result.artifactId))}`,
          linkedAt: new Date().toISOString(),
        },
      },
    });

    return res.json(
      envelope({
        draft: updatedDraft,
        linkedResource: {
          type: 'document_studio',
          id: String(result.artifactId),
          title: String(result.schema?.title || title),
          url: `/documents/${encodeURIComponent(String(result.artifactId))}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        readBack: {
          target: 'document_studio',
          artifactId: result.artifactId,
          status: 'created',
        } as any,
      })
    );
  } catch (error) {
    logger.error('[work-canvas] canvas.document_studio.failed', {
      draftId: draft.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      error: 'Failed to send Canvas to Document Studio',
    });
  }
});

router.post('/drafts/:draftId/save-as-artifact', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  const { organizationId, userId } = authContext(req);
  const artifactId = `artifact-${randomUUID()}`;
  const artifactRunId = `run-${randomUUID()}`;
  const now = new Date().toISOString();
  const artifactPromotion = {
    runtime: 'wave5',
    status: 'promotion_recorded',
    artifactId,
    artifactRunId,
    artifactVersion: 1,
    source: {
      type: 'work_canvas',
      draftId: draft.id,
      title: draft.title,
      conversationId: draft.conversationId,
      researchSessionId: draft.researchSessionId,
    },
    promotedAt: now,
  };
  const updated: WorkCanvasDraft = {
    ...draft,
    artifactId,
    artifactRunId,
    artifactVersion: 1,
    saveState: 'saved',
    dirtyState: 'clean',
    auditStatus: 'logged',
    provenance: {
      ...draft.provenance,
      artifactPromotion,
    },
    updatedAt: now,
  };
  await dbRun(
    `UPDATE work_canvas_drafts
     SET artifact_id = ?, artifact_run_id = ?, artifact_version = ?, save_state = ?,
         dirty_state = ?, audit_status = ?, provenance_json = ?, updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [
      updated.artifactId,
      updated.artifactRunId,
      updated.artifactVersion,
      updated.saveState,
      updated.dirtyState,
      updated.auditStatus,
      JSON.stringify(updated.provenance),
      updated.updatedAt,
      updated.id,
      updated.organizationId,
    ],
    { fallback: false }
  );

  // X5 — W5 Unified Doc Entity: commit draft → wave5_artifacts transactionally.
  // Fail-open: if commitDraftToArtifact throws, the draft UPDATE above already
  // succeeded so the canvas is still saved; we just won't have a wave5_artifacts row.
  try {
    const { commitDraftToArtifact } =
      await import('../services/deliverables/unifiedDocEntityService.js');
    await commitDraftToArtifact({
      organizationId,
      draftId: draft.id,
      committedBy: userId,
    });
  } catch (x5Err) {
    logger.warn('[work-canvas] X5 commitDraftToArtifact failed (non-blocking)', {
      draftId: draft.id,
      error: x5Err instanceof Error ? x5Err.message : String(x5Err),
    });
  }

  const readBack = {
    target: 'artifact',
    targetObjectId: artifactId,
    status: 'promotion_recorded',
    runtime: 'wave5',
    artifactId,
    artifactRunId,
    artifactVersion: 1,
    sourceDraftId: draft.id,
    promotionStatus: 'promotion_recorded',
  };
  logger.info('[work-canvas] canvas.artifact.promotion_recorded', {
    draftId: draft.id,
    artifactId,
    artifactRunId,
    artifactVersion: 1,
  });
  return res.json(envelope(updated, { readBack, auditEventId: `ae-${randomUUID()}` }));
});

export default router;
