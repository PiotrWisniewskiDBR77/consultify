import { randomUUID } from 'node:crypto';

import { Router } from 'express';
import * as XLSX from 'xlsx';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
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
import { unifiedExportService } from '../services/export/UnifiedExportService.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { getTableColumns } from '../utils/dbSchema.js';
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
type WorkspaceTarget = 'idea' | 'note' | 'initiative' | 'decision';

// Proposal targets that approval can MATERIALIZE into a real entity. Targets
// outside this set (project_brief, research_report, client_deliverable, task —
// which need project/initiative context they don't have here) stay honest
// placeholders rather than being faked.
const MATERIALIZABLE_TARGETS: ReadonlySet<string> = new Set([
  'idea',
  'note',
  'initiative',
  'decision',
]);
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

function hasDraftConflict(draft: WorkCanvasDraft, baseUpdatedAt: string | null): boolean {
  return Boolean(baseUpdatedAt && draft.updatedAt && baseUpdatedAt !== draft.updatedAt);
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

const targetLabels: Record<string, string> = {
  idea: 'Idea',
  initiative: 'Initiative',
  task: 'Task',
  project_brief: 'Brief',
  decision: 'Decision',
  research_report: 'Research Report',
  client_deliverable: 'Client Deliverable',
};

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

function canUseWorkCanvasCapability(req: AuthRequest, capability: string): boolean {
  if (!capability.trim()) return true;
  if (typeof req.can === 'function') return req.can(capability);

  const role = String(req.userRole || req.user?.role || '').toUpperCase();
  return ['SUPERADMIN', 'OWNER', 'ADMIN', 'ADMINISTRATOR'].includes(role);
}

function envelope<T>(data: T, extra: Record<string, unknown> = {}) {
  return { success: true, data, ...extra };
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
  const legacyContent = parseJson(row.content_json, '');
  const contentJson = parseJson(row.content_json_native, undefined);
  const blocks = normalizeCanvasArtifactBlocks(parseJson(row.blocks_json, []));
  const contentEnvelope = createArtifactContentEnvelope({
    artifactType: row.kind,
    canonicalFormat: row.canonical_format || undefined,
    contentMd: row.content_md || (typeof legacyContent === 'string' ? legacyContent : ''),
    contentJson: contentJson ?? (row.canonical_format === 'json' ? legacyContent : undefined),
    blocks,
    contentSchemaVersion: row.content_schema_version || undefined,
  });
  const projectionStatus =
    row.markdown_projection_status || contentEnvelope.markdownProjectionStatus;
  return {
    id: row.id,
    organizationId: row.organization_id,
    createdBy: row.created_by,
    conversationId: row.conversation_id,
    kind: row.kind,
    title: row.title,
    content: parseJson(row.content_json, ''),
    contentEnvelope: {
      ...contentEnvelope,
      markdownProjectionStatus: projectionStatus,
      markdownProjectedAt: row.markdown_projected_at || contentEnvelope.markdownProjectedAt,
      projectionError: row.projection_error || contentEnvelope.projectionError,
    },
    canonicalFormat: contentEnvelope.canonicalFormat,
    contentMd: contentEnvelope.contentMd,
    contentJson: contentEnvelope.contentJson,
    blocks: contentEnvelope.blocks || blocks,
    contentSchemaVersion: row.content_schema_version,
    markdownProjectionStatus: projectionStatus,
    markdownProjectedAt: row.markdown_projected_at || contentEnvelope.markdownProjectedAt || null,
    projectionError: row.projection_error || contentEnvelope.projectionError || null,
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

async function insertDynamic(
  table: string,
  values: Record<string, unknown>,
  requiredColumns: string[] = ['id']
): Promise<void> {
  const cols = await getTableColumns(table);
  for (const col of requiredColumns) {
    if (!cols.has(col)) {
      throw new Error(`Required column ${table}.${col} is not available`);
    }
  }
  const entries = Object.entries(values).filter(([key]) => cols.has(key));
  if (entries.length === 0) throw new Error(`No compatible columns for ${table}`);
  await dbRun(
    `INSERT INTO ${table} (${entries.map(([key]) => key).join(', ')}) VALUES (${entries
      .map(() => '?')
      .join(', ')})`,
    entries.map(([, value]) => value),
    { fallback: false }
  );
}

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
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        [],
        { fallback: false }
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
        await dbRun(statement, [], { fallback: false });
      }
      await dbRun(
        `CREATE INDEX IF NOT EXISTS idx_work_canvas_drafts_org_updated
         ON work_canvas_drafts (organization_id, updated_at DESC)`,
        [],
        { fallback: false }
      );
      await dbRun(
        `CREATE INDEX IF NOT EXISTS idx_work_canvas_drafts_conversation
         ON work_canvas_drafts (organization_id, conversation_id)`,
        [],
        { fallback: false }
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
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        [],
        { fallback: false }
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
        { fallback: false }
      );
      await dbRun(
        'ALTER TABLE work_canvas_versions ADD COLUMN IF NOT EXISTS blocks_json TEXT',
        [],
        { fallback: false }
      );
      await dbRun(
        `CREATE INDEX IF NOT EXISTS idx_work_canvas_versions_draft_created
         ON work_canvas_versions (draft_id, created_at DESC)`,
        [],
        { fallback: false }
      );
    })();
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
    url: typeof record.url === 'string' ? record.url : `/work-canvas/shared/${token}`,
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

async function createWorkspaceResource(
  draft: WorkCanvasDraft,
  target: WorkspaceTarget,
  userId: string,
  organizationId: string
) {
  const title = firstMarkdownHeading(draft.contentMd, draft.title || 'Canvas document');
  const summary = markdownSummary(draft.contentMd, 5000);
  const now = new Date().toISOString();

  if (target === 'idea') {
    const ideaId = `idea-${Date.now()}-${randomUUID().slice(0, 8)}`;
    await insertDynamic(
      'my_ideas',
      {
        id: ideaId,
        user_id: userId,
        organization_id: organizationId,
        title,
        body: summary,
        seed_text: draft.contentMd,
        stage: 'spark',
        source_type: 'work_canvas',
        source_conversation_id: draft.conversationId,
        source_message_id: draft.id,
        created_at: now,
        updated_at: now,
      },
      ['id']
    );

    const mapId = `map-${Date.now()}-${randomUUID().slice(0, 8)}`;
    await insertDynamic(
      'my_idea_maps',
      {
        id: mapId,
        idea_id: ideaId,
        user_id: userId,
        organization_id: organizationId,
        nodes_json: '[]',
        edges_json: '[]',
        schema_version: 3,
        extensions_json: JSON.stringify({ source: 'work_canvas', draftId: draft.id }),
        created_at: now,
        updated_at: now,
      },
      ['id']
    );

    return {
      type: 'idea' as const,
      id: ideaId,
      title,
      url: `/my-work/ideas/${ideaId}`,
      readBack: { target, ideaId, mapId, status: 'created' },
    };
  }

  if (target === 'note') {
    const noteId = randomUUID();
    await insertDynamic(
      'notebook_pages',
      {
        id: noteId,
        owner_user_id: userId,
        user_id: userId,
        organization_id: organizationId,
        visibility: 'private',
        title,
        content_json: JSON.stringify({
          type: 'doc',
          content: [{ type: 'paragraph', text: draft.contentMd }],
        }),
        content_text: draft.contentMd,
        tags_json: JSON.stringify(['work-canvas']),
        icon: 'FileText',
        maturity: 'seed',
        status: 'active',
        capture_source: 'work_canvas',
        capture_metadata: JSON.stringify({ sourceType: 'work_canvas', sourceId: draft.id }),
        created_at: now,
        updated_at: now,
      },
      ['id']
    );
    return {
      type: 'note' as const,
      id: noteId,
      title,
      url: `/my-work/notebook/${noteId}`,
      readBack: { target, noteId, status: 'created' },
    };
  }

  if (target === 'decision') {
    const decisionId = randomUUID();
    // decisions.project_id is nullable; required NOT NULL cols are id,
    // organization_id, title, type, decision_maker_id, created_by.
    await insertDynamic(
      'decisions',
      {
        id: decisionId,
        organization_id: organizationId,
        project_id: null,
        title,
        description: summary,
        type: 'strategic',
        decision_maker_id: userId,
        decision_owner_id: userId,
        status: 'pending',
        created_by: userId,
        created_at: now,
        updated_at: now,
      },
      ['id']
    );
    return {
      type: 'decision' as const,
      id: decisionId,
      title,
      url: `/decisions/${decisionId}`,
      readBack: { target, decisionId, status: 'created' },
    };
  }

  const initiativeId = randomUUID();
  await insertDynamic(
    'initiatives',
    {
      id: initiativeId,
      organization_id: organizationId,
      user_id: userId,
      created_by: userId,
      owner_id: userId,
      owner_execution_id: userId,
      name: title,
      title,
      summary,
      description: summary,
      status: 'DRAFT',
      source_type: 'work_canvas',
      source_id: draft.id,
      created_at: now,
      updated_at: now,
    },
    ['id']
  );
  return {
    type: 'initiative' as const,
    id: initiativeId,
    title,
    url: `/initiatives/${initiativeId}`,
    readBack: { target, initiativeId, status: 'created' },
  };
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

async function createOutputResource(
  draft: WorkCanvasDraft,
  outputType: OutputType,
  userId: string,
  organizationId: string,
  sourceVersionId?: string
) {
  const title = firstMarkdownHeading(draft.contentMd, draft.title || 'Canvas output');
  const now = new Date().toISOString();

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
    await insertDynamic(
      'presentation_decks',
      {
        id: deckId,
        organization_id: organizationId,
        created_by: userId,
        title: `Presentation: ${title}`,
        deck_type: 'custom',
        theme: 'modern',
        slide_count: slides.length,
        status: 'draft',
        source_id: draft.id,
        source_refs_json: JSON.stringify(metadata),
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
    blocks: envelopeForOutput.blocks || [],
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
    { fallback: false }
  );
  const result = rows.map(toDraft);
  res.json(envelope(result));
});

router.post('/drafts', async (req: AuthRequest, res) => {
  await ensureStorage();
  const { organizationId, userId } = authContext(req);
  const now = new Date().toISOString();
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
  draft.blocks = draft.contentEnvelope.blocks || [];
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
  res.status(201).json(envelope(draft, { auditEventId: `ae-${randomUUID()}` }));
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
  if (hasDraftConflict(draft, baseUpdatedAt)) {
    return sendDraftConflict(res, draft, baseUpdatedAt, 'save_draft');
  }
  const payload =
    req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
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
  updated.contentEnvelope = createArtifactContentEnvelope({
    artifactType: normalizedKind,
    canonicalFormat: updated.canonicalFormat,
    contentMd:
      updated.contentMd ??
      (typeof updated.content === 'string' ? updated.content : updated.contentMd),
    contentJson: updated.contentJson,
    blocks: updated.blocks,
    contentSchemaVersion: updated.contentSchemaVersion || undefined,
  });
  updated.canonicalFormat = updated.contentEnvelope.canonicalFormat;
  updated.contentMd = updated.contentEnvelope.contentMd;
  updated.contentJson = updated.contentEnvelope.contentJson;
  updated.blocks = updated.contentEnvelope.blocks || [];
  updated.contentSchemaVersion = updated.contentEnvelope.contentSchemaVersion || null;
  updated.markdownProjectionStatus = updated.contentEnvelope.markdownProjectionStatus;
  updated.markdownProjectedAt = updated.contentEnvelope.markdownProjectedAt || null;
  updated.projectionError = updated.contentEnvelope.projectionError || null;
  await dbRun(
    `UPDATE work_canvas_drafts
     SET conversation_id = ?, kind = ?, title = ?, content_json = ?, sources_json = ?,
         provenance_json = ?, project_id = ?, owner_id = ?, research_session_id = ?,
         artifact_id = ?, artifact_run_id = ?, artifact_version = ?, save_state = ?,
         lifecycle_state = ?, dirty_state = ?, visibility = ?, audit_status = ?,
         canonical_format = ?, content_md = ?, content_json_native = ?, blocks_json = ?, content_schema_version = ?,
         markdown_projection_status = ?, markdown_projected_at = ?, projection_error = ?, updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [
      updated.conversationId,
      updated.kind,
      updated.title,
      JSON.stringify(updated.content),
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
      updated.canonicalFormat,
      updated.contentMd,
      updated.contentJson === undefined ? null : JSON.stringify(updated.contentJson),
      updated.blocks.length > 0 ? JSON.stringify(updated.blocks) : null,
      updated.contentSchemaVersion,
      updated.markdownProjectionStatus,
      updated.markdownProjectedAt,
      updated.projectionError,
      updated.updatedAt,
      updated.id,
      updated.organizationId,
    ],
    { fallback: false }
  );
  return res.json(envelope(updated, { auditEventId: `ae-${randomUUID()}` }));
});

router.post('/drafts/:draftId/proposals', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  const { organizationId, userId } = authContext(req);
  const target = String(req.body?.target || 'idea');
  const now = new Date().toISOString();
  const proposal: WorkCanvasProposal = {
    id: randomUUID(),
    draftId: draft.id,
    organizationId,
    createdBy: userId,
    target,
    title: `${targetLabels[target] || target}: ${draft.title}`,
    summary: `Proposal generated from canvas draft ${draft.id}.`,
    status: 'proposed',
    payload: req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : {},
    requiredCapability: target === 'task' ? 'canvas.convert.task' : 'canvas.convert.idea',
    targetObjectId: null,
    readBack: null,
    auditEventId: null,
    createdAt: now,
    updatedAt: now,
  };
  await dbRun(
    `INSERT INTO work_canvas_proposals (
      id, draft_id, organization_id, created_by, target, title, summary, status,
      payload_json, required_capability, target_object_id, read_back_json,
      audit_event_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      proposal.id,
      proposal.draftId,
      proposal.organizationId,
      proposal.createdBy,
      proposal.target,
      proposal.title,
      proposal.summary,
      proposal.status,
      JSON.stringify(proposal.payload),
      proposal.requiredCapability,
      proposal.targetObjectId,
      JSON.stringify(proposal.readBack),
      proposal.auditEventId,
      proposal.createdAt,
      proposal.updatedAt,
    ],
    { fallback: false }
  );
  return res.status(201).json(envelope(proposal, { auditEventId: `ae-${randomUUID()}` }));
});

router.get('/drafts/:draftId/proposals', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  return res.json(envelope(await draftProposals(draft.id)));
});

router.post('/proposals/:proposalId/reject', async (req: AuthRequest, res) => {
  await ensureStorage();
  const proposalRow = await dbGet<ProposalRow>(
    `SELECT * FROM work_canvas_proposals WHERE id = ? AND organization_id = ?`,
    [req.params.proposalId, authContext(req).organizationId],
    { fallback: false }
  );
  const proposal = proposalRow ? toProposal(proposalRow) : null;
  if (!proposal || proposal.organizationId !== authContext(req).organizationId) {
    return res.status(404).json({ error: 'Canvas proposal not found' });
  }
  const updated: WorkCanvasProposal = {
    ...proposal,
    status: 'rejected',
    readBack: { target: proposal.target, status: 'rejected' },
    updatedAt: new Date().toISOString(),
  };
  await dbRun(
    `UPDATE work_canvas_proposals
     SET status = ?, read_back_json = ?, updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [
      updated.status,
      JSON.stringify(updated.readBack),
      updated.updatedAt,
      updated.id,
      updated.organizationId,
    ],
    { fallback: false }
  );
  return res.json(
    envelope(updated, { readBack: updated.readBack, auditEventId: `ae-${randomUUID()}` })
  );
});

router.post('/proposals/:proposalId/approve', async (req: AuthRequest, res) => {
  await ensureStorage();
  const proposalRow = await dbGet<ProposalRow>(
    `SELECT * FROM work_canvas_proposals WHERE id = ? AND organization_id = ?`,
    [req.params.proposalId, authContext(req).organizationId],
    { fallback: false }
  );
  const proposal = proposalRow ? toProposal(proposalRow) : null;
  if (!proposal || proposal.organizationId !== authContext(req).organizationId) {
    return res.status(404).json({ error: 'Canvas proposal not found' });
  }
  if (!canUseWorkCanvasCapability(req, proposal.requiredCapability)) {
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
  const auditEventId = `ae-${randomUUID()}`;
  let materializedId: string | null = null;
  let readBack: Record<string, unknown>;

  if (MATERIALIZABLE_TARGETS.has(proposal.target)) {
    // Governed materialization: approval now actually CREATES the target entity
    // (idea/note/initiative/decision) instead of leaving a placeholder.
    const draft = await ownedDraft(req, proposal.draftId);
    if (!draft) {
      return res.status(404).json({ error: 'Canvas draft for proposal not found' });
    }
    try {
      const { organizationId, userId } = authContext(req);
      const resource = await createWorkspaceResource(
        draft,
        proposal.target as WorkspaceTarget,
        userId,
        organizationId
      );
      materializedId = resource.id;
      readBack = {
        ...resource.readBack,
        target: proposal.target,
        targetObjectId: resource.id,
        status: 'approved',
        entityStatus: 'created',
        url: resource.url,
        auditEventId,
      };
    } catch (error) {
      logger.error('[work-canvas] canvas.proposal.materialize_failed', {
        proposalId: proposal.id,
        target: proposal.target,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({
        error: 'Failed to create the approved workspace resource.',
        code: 'CANVAS_PROPOSAL_MATERIALIZE_FAILED',
        recoverable: true,
      });
    }
  } else {
    // Honest placeholder for targets without a materialization home
    // (project_brief / research_report / client_deliverable / task).
    readBack = {
      target: proposal.target,
      targetObjectId: null,
      status: 'approved_with_placeholder',
      entityStatus: 'placeholder_pending_conversion',
      auditEventId,
    };
  }

  const updated: WorkCanvasProposal = {
    ...proposal,
    status: 'approved',
    targetObjectId: materializedId,
    readBack,
    auditEventId,
    updatedAt: new Date().toISOString(),
  };
  await dbRun(
    `UPDATE work_canvas_proposals
     SET status = ?, target_object_id = ?, read_back_json = ?, audit_event_id = ?, updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [
      updated.status,
      materializedId,
      JSON.stringify(updated.readBack),
      updated.auditEventId,
      updated.updatedAt,
      updated.id,
      updated.organizationId,
    ],
    { fallback: false }
  );
  return res.json(envelope(updated, { readBack, auditEventId: updated.auditEventId }));
});

router.get('/drafts/:draftId/versions', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  const rows = await dbAll<VersionRow>(
    `SELECT * FROM work_canvas_versions WHERE draft_id = ? ORDER BY created_at DESC`,
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
      blocks: updatedEnvelope.blocks || [],
      contentSchemaVersion: updatedEnvelope.contentSchemaVersion || null,
      markdownProjectionStatus: updatedEnvelope.markdownProjectionStatus,
      markdownProjectedAt: updatedEnvelope.markdownProjectedAt || null,
      projectionError: updatedEnvelope.projectionError || null,
      saveState: 'saved',
      dirtyState: 'clean',
      updatedAt: now,
    };
    await dbRun(
      `UPDATE work_canvas_drafts
       SET content_json = ?, canonical_format = ?, content_md = ?, content_json_native = ?, blocks_json = ?,
           content_schema_version = ?, markdown_projection_status = ?, markdown_projected_at = ?,
           projection_error = ?, save_state = ?, dirty_state = ?, updated_at = ?
       WHERE id = ? AND organization_id = ?`,
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
      ],
      { fallback: false }
    );
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
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to apply Canvas operation',
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
  const restoredEnvelope = createArtifactContentEnvelope({
    artifactType: draft.kind,
    canonicalFormat: draft.canonicalFormat,
    contentMd: version.contentMd,
    contentJson: version.contentJson,
    blocks: version.blocks,
  });
  const restored: WorkCanvasDraft = {
    ...draft,
    content: version.contentMd,
    contentEnvelope: restoredEnvelope,
    canonicalFormat: restoredEnvelope.canonicalFormat,
    contentMd: restoredEnvelope.contentMd,
    contentJson: restoredEnvelope.contentJson,
    blocks: restoredEnvelope.blocks || [],
    markdownProjectionStatus: restoredEnvelope.markdownProjectionStatus,
    markdownProjectedAt: restoredEnvelope.markdownProjectedAt || null,
    projectionError: restoredEnvelope.projectionError || null,
    saveState: 'saved',
    dirtyState: 'clean',
    updatedAt: now,
  };
  await dbRun(
    `UPDATE work_canvas_drafts
     SET content_json = ?, canonical_format = ?, content_md = ?, content_json_native = ?, blocks_json = ?,
         markdown_projection_status = ?, markdown_projected_at = ?, projection_error = ?,
         save_state = ?, dirty_state = ?, updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [
      JSON.stringify(restored.content),
      restored.canonicalFormat,
      restored.contentMd,
      restored.contentJson === undefined ? null : JSON.stringify(restored.contentJson),
      restored.blocks.length > 0 ? JSON.stringify(restored.blocks) : null,
      restored.markdownProjectionStatus,
      restored.markdownProjectedAt,
      restored.projectionError,
      restored.saveState,
      restored.dirtyState,
      restored.updatedAt,
      restored.id,
      restored.organizationId,
    ],
    { fallback: false }
  );
  return res.json(envelope({ draft: restored, restoredVersion: version }));
});

router.post('/drafts/:draftId/share', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  const token = randomUUID().replace(/-/g, '');
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const share = {
    token,
    url: `/work-canvas/shared/${token}`,
    title: draft.title,
    createdAt,
    expiresAt,
  };
  const updated = await updateDraftAfterOperation(draft, { share });
  return res.json(envelope({ draft: updated, share }));
});

router.get('/shared/:token', async (req: AuthRequest, res) => {
  await ensureStorage();
  const { organizationId } = authContext(req);
  const token = String(req.params.token || '').trim();
  if (!token) return res.status(400).json({ error: 'Share token is required' });
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
  if (!['idea', 'note', 'initiative'].includes(target)) {
    return res.status(400).json({ error: 'target must be idea, note, or initiative' });
  }

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
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to save Canvas to workspace',
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
      error: error instanceof Error ? error.message : 'Failed to create Canvas output',
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
      error: error instanceof Error ? error.message : 'Failed to finalize Canvas research report',
    });
  }
});

router.post('/drafts/:draftId/save-as-artifact', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
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
