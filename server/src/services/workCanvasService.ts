import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import type { ArtifactContentEnvelopeV1 } from '../types/artifactContent.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import {
  buildCanvasCanonicalWrite,
  resolveCanvasCanonicalEnvelope,
} from './artifacts/canvasCanonicalPersistence.js';
import {
  acceptArtifactRunPlan,
  createArtifactRunFromChat,
  getArtifactRun,
  materializeArtifactRun,
  preflightArtifactRun,
} from './v8/artifactRegistryService.js';
import * as contextSnapshotService from './v8/contextSnapshotService.js';
import * as executionSpineService from './v8/executionSpineService.js';

export type WorkCanvasKind =
  | 'markdown'
  | 'table'
  | 'checklist'
  | 'research'
  | 'document'
  | 'sheet'
  | 'deck'
  | 'decision';

export type WorkCanvasTarget =
  | 'note'
  | 'table'
  | 'idea'
  | 'initiative'
  | 'task'
  | 'project_brief'
  | 'decision'
  | 'research_report'
  | 'client_deliverable'
  | 'kpi_roi_artifact';

export type WorkCanvasProposalStatus = 'proposed' | 'executing' | 'approved' | 'rejected';

export interface WorkCanvasDraftInput {
  conversationId: string;
  kind: WorkCanvasKind;
  title: string;
  content: unknown;
  sources?: unknown[];
  provenance?: Record<string, unknown>;
  clientId?: string | null;
  projectId?: string | null;
  ownerId?: string | null;
  researchSessionId?: string | null;
  artifactRunId?: string | null;
  artifactId?: string | null;
}

export interface WorkCanvasDraftRecord extends WorkCanvasDraftInput {
  id: string;
  organizationId: string;
  createdBy: string;
  saveState: 'unsaved' | 'saving' | 'saved' | 'failed';
  lifecycleState: 'draft' | 'in_review' | 'approved' | 'finalized';
  dirtyState: 'clean' | 'dirty' | 'stale' | 'conflicted';
  visibility: 'private' | 'project' | 'organization' | 'external';
  auditStatus: 'not_required' | 'pending' | 'recorded' | 'failed';
  artifactVersion: number | null;
  createdAt: string;
  updatedAt: string;
  contentEnvelope: ArtifactContentEnvelopeV1;
  canonicalFormat: 'markdown' | 'json';
  contentMd: string;
  contentJson?: unknown;
  blocks: unknown[];
  contentSchemaVersion: string | null;
  markdownProjectionStatus: ArtifactContentEnvelopeV1['markdownProjectionStatus'];
  markdownProjectedAt: string | null;
  projectionError: string | null;
}

export interface WorkCanvasProposalRecord {
  id: string;
  draftId: string;
  organizationId: string;
  createdBy: string;
  target: WorkCanvasTarget;
  title: string;
  summary: string;
  status: WorkCanvasProposalStatus;
  payload: Record<string, unknown>;
  requiredCapability: string;
  targetObjectId: string | null;
  readBack: Record<string, unknown> | null;
  auditEventId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkCanvasActionReadBack {
  status: string;
  proposalStatus?: 'approved' | 'rejected';
  entityStatus?: string | null;
  target: WorkCanvasTarget;
  targetObjectId: string | null;
  url?: string | null;
  title?: string;
  projectId?: string | null;
  ownerId?: string | null;
  assigneeId?: string | null;
  artifactId?: string | null;
  artifactRunId?: string | null;
  artifactVersion?: number | null;
  sourceDraftId: string;
  auditEventId?: string | null;
  reason?: string | null;
  code?: string;
}

type DraftRow = {
  id: string;
  organization_id: string;
  created_by: string;
  conversation_id: string;
  kind: WorkCanvasKind;
  title: string;
  content_json: string;
  sources_json: string | null;
  provenance_json: string | null;
  client_id: string | null;
  project_id: string | null;
  owner_id: string | null;
  research_session_id: string | null;
  artifact_run_id: string | null;
  artifact_id: string | null;
  artifact_version: number | null;
  save_state: WorkCanvasDraftRecord['saveState'];
  lifecycle_state: WorkCanvasDraftRecord['lifecycleState'];
  dirty_state: WorkCanvasDraftRecord['dirtyState'];
  visibility: WorkCanvasDraftRecord['visibility'];
  audit_status: WorkCanvasDraftRecord['auditStatus'];
  created_at: string;
  updated_at: string;
  canonical_format?: string | null;
  content_md?: string | null;
  content_json_native?: string | null;
  blocks_json?: string | null;
  content_schema_version?: string | null;
  markdown_projection_status?: string | null;
  markdown_projected_at?: string | null;
  projection_error?: string | null;
};

type ProposalRow = {
  id: string;
  draft_id: string;
  organization_id: string;
  created_by: string;
  target: WorkCanvasTarget;
  title: string;
  summary: string;
  status: WorkCanvasProposalStatus;
  payload_json: string | null;
  required_capability: string | null;
  target_object_id: string | null;
  read_back_json: string | null;
  audit_event_id: string | null;
  created_at: string;
  updated_at: string;
};

let schemaReady: Promise<void> | null = null;

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function contentHashForDraft(draft: Pick<WorkCanvasDraftRecord, 'content' | 'sources'>): string {
  return createHash('sha256')
    .update(stableJson({ content: draft.content, sources: draft.sources || [] }))
    .digest('hex');
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeDateTime(value: unknown): string | undefined {
  const raw = readString(value);
  if (!raw) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await dbRun(
        `CREATE TABLE IF NOT EXISTS work_canvas_drafts (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          created_by TEXT NOT NULL,
          conversation_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          title TEXT NOT NULL,
          content_json TEXT NOT NULL,
          sources_json TEXT,
          provenance_json TEXT,
          client_id TEXT,
          project_id TEXT,
          owner_id TEXT,
          research_session_id TEXT,
          artifact_run_id TEXT,
          artifact_id TEXT,
          artifact_version INTEGER,
          save_state TEXT NOT NULL,
          lifecycle_state TEXT NOT NULL,
          dirty_state TEXT NOT NULL,
          visibility TEXT NOT NULL,
          audit_status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`,
        []
      );
      // content_md normally arrives via the routes-layer ALTER; updateDraft now
      // writes it directly, so the column must exist even when this service
      // boots before any work-canvas route ran.
      await dbRun('ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS content_md TEXT', []);
      await dbRun(
        "ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS canonical_format TEXT NOT NULL DEFAULT 'markdown'",
        []
      );
      await dbRun(
        'ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS content_json_native TEXT',
        []
      );
      await dbRun('ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS blocks_json TEXT', []);
      await dbRun(
        'ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS content_schema_version TEXT',
        []
      );
      await dbRun(
        'ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS markdown_projection_status TEXT',
        []
      );
      await dbRun(
        'ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS markdown_projected_at TEXT',
        []
      );
      await dbRun(
        'ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS projection_error TEXT',
        []
      );
      await dbRun(
        `CREATE TABLE IF NOT EXISTS work_canvas_proposals (
          id TEXT PRIMARY KEY,
          draft_id TEXT NOT NULL,
          organization_id TEXT NOT NULL,
          created_by TEXT NOT NULL,
          target TEXT NOT NULL,
          title TEXT NOT NULL,
          summary TEXT NOT NULL,
          status TEXT NOT NULL,
          payload_json TEXT,
          required_capability TEXT,
          target_object_id TEXT,
          read_back_json TEXT,
          audit_event_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`,
        []
      );
      await dbRun(
        `CREATE TABLE IF NOT EXISTS work_canvas_ideas (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          project_id TEXT,
          title TEXT NOT NULL,
          summary TEXT,
          source_draft_id TEXT NOT NULL,
          source_proposal_id TEXT NOT NULL,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`,
        []
      );
      await dbRun(
        `CREATE INDEX IF NOT EXISTS idx_work_canvas_drafts_org_conversation
         ON work_canvas_drafts (organization_id, conversation_id, updated_at)`,
        []
      );
      await dbRun(
        `CREATE INDEX IF NOT EXISTS idx_work_canvas_proposals_draft
         ON work_canvas_proposals (organization_id, draft_id, updated_at)`,
        []
      );
    })();
  }
  return schemaReady;
}

function mapDraft(row: DraftRow): WorkCanvasDraftRecord {
  const contentEnvelope = resolveCanvasCanonicalEnvelope(row);
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
    blocks: contentEnvelope.blocks || [],
    contentSchemaVersion: contentEnvelope.contentSchemaVersion,
    markdownProjectionStatus: contentEnvelope.markdownProjectionStatus,
    markdownProjectedAt: contentEnvelope.markdownProjectedAt || null,
    projectionError: contentEnvelope.projectionError || null,
    sources: parseJson(row.sources_json, []),
    provenance: parseJson(row.provenance_json, {}),
    clientId: row.client_id,
    projectId: row.project_id,
    ownerId: row.owner_id,
    researchSessionId: row.research_session_id,
    artifactRunId: row.artifact_run_id,
    artifactId: row.artifact_id,
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

function mapProposal(row: ProposalRow): WorkCanvasProposalRecord {
  return {
    id: row.id,
    draftId: row.draft_id,
    organizationId: row.organization_id,
    createdBy: row.created_by,
    target: row.target,
    title: row.title,
    summary: row.summary,
    status: row.status,
    payload: parseJson(row.payload_json, {}),
    requiredCapability: row.required_capability || requiredCapabilityForTarget(row.target),
    targetObjectId: row.target_object_id,
    readBack: parseJson(row.read_back_json, null),
    auditEventId: row.audit_event_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function requiredCapabilityForTarget(target: WorkCanvasTarget): string {
  switch (target) {
    case 'task':
      return 'canvas.convert.task';
    case 'initiative':
      return 'canvas.convert.initiative';
    case 'decision':
      return 'canvas.convert.decision';
    case 'idea':
      return 'canvas.convert.idea';
    case 'table':
      return 'canvas.output.table';
    case 'project_brief':
    case 'client_deliverable':
      return 'artifact.create';
    case 'research_report':
      return 'canvas.convert.note';
    case 'kpi_roi_artifact':
      return 'artifact.create';
    default:
      return 'canvas.convert.note';
  }
}

export async function listDrafts(params: {
  organizationId: string;
  actorUserId?: string | null;
  conversationId?: string | null;
  projectId?: string | null;
  limit?: number;
}): Promise<WorkCanvasDraftRecord[]> {
  await ensureSchema();
  const limit = Math.min(100, Math.max(1, params.limit || 25));
  const where = ['organization_id = ?'];
  const queryParams: unknown[] = [params.organizationId];
  if (params.conversationId) {
    where.push('conversation_id = ?');
    queryParams.push(params.conversationId);
  }
  if (params.projectId) {
    where.push('project_id = ?');
    queryParams.push(params.projectId);
  } else if (params.actorUserId) {
    // Without an explicit project scope, only return the caller's own drafts.
    where.push('created_by = ?');
    queryParams.push(params.actorUserId);
  }
  queryParams.push(limit);
  const rows = await dbAll<DraftRow>(
    `SELECT * FROM work_canvas_drafts
     WHERE ${where.join(' AND ')}
     ORDER BY updated_at DESC
     LIMIT ?`,
    queryParams
  );
  return rows.map(mapDraft);
}

export async function getDraft(params: {
  organizationId: string;
  draftId: string;
}): Promise<WorkCanvasDraftRecord | null> {
  await ensureSchema();
  const row = await dbGet<DraftRow>(
    `SELECT * FROM work_canvas_drafts WHERE id = ? AND organization_id = ?`,
    [params.draftId, params.organizationId]
  );
  return row ? mapDraft(row) : null;
}

export async function createDraft(params: {
  organizationId: string;
  actorUserId: string;
  input: WorkCanvasDraftInput;
}): Promise<WorkCanvasDraftRecord> {
  await ensureSchema();
  const id = uuidv4();
  const now = nowIso();
  const canonical = buildCanvasCanonicalWrite(
    {
      kind: params.input.kind,
      canonical_format: typeof params.input.content === 'string' ? 'markdown' : 'json',
    },
    {
      canonicalFormat: typeof params.input.content === 'string' ? 'markdown' : 'json',
      content: params.input.content ?? '',
    }
  );
  await dbRun(
    `INSERT INTO work_canvas_drafts (
      id, organization_id, created_by, conversation_id, kind, title, content_json,
      canonical_format, content_md, content_json_native, blocks_json, content_schema_version,
      markdown_projection_status, markdown_projected_at, projection_error,
      sources_json, provenance_json, client_id, project_id, owner_id,
      research_session_id, artifact_run_id, artifact_id, artifact_version,
      save_state, lifecycle_state, dirty_state, visibility, audit_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.organizationId,
      params.actorUserId,
      params.input.conversationId,
      params.input.kind,
      params.input.title,
      canonical.content_json,
      canonical.canonical_format,
      canonical.content_md,
      canonical.content_json_native,
      canonical.blocks_json,
      canonical.content_schema_version,
      canonical.markdown_projection_status,
      canonical.markdown_projected_at,
      canonical.projection_error,
      JSON.stringify(params.input.sources || []),
      JSON.stringify(params.input.provenance || { conversationId: params.input.conversationId }),
      params.input.clientId || null,
      params.input.projectId || null,
      params.input.ownerId || null,
      params.input.researchSessionId || null,
      params.input.artifactRunId || null,
      params.input.artifactId || null,
      null,
      'unsaved',
      'draft',
      'dirty',
      'project',
      'not_required',
      now,
      now,
    ]
  );
  const draft = await getDraft({ organizationId: params.organizationId, draftId: id });
  if (!draft) throw new Error('Canvas draft read-back failed');
  return draft;
}

export async function updateDraft(params: {
  organizationId: string;
  draftId: string;
  patch: Partial<WorkCanvasDraftInput>;
}): Promise<WorkCanvasDraftRecord> {
  await ensureSchema();
  const existing = await getDraft(params);
  if (!existing) throw Object.assign(new Error('Canvas draft not found'), { statusCode: 404 });
  const now = nowIso();
  const nextContent = params.patch.content !== undefined ? params.patch.content : existing.content;
  const canonical = buildCanvasCanonicalWrite(
    {
      kind: existing.kind,
      canonical_format: existing.canonicalFormat,
      content_json: JSON.stringify(existing.content),
      content_md: existing.contentMd,
      content_json_native:
        existing.contentJson === undefined ? null : JSON.stringify(existing.contentJson),
      blocks_json: existing.blocks.length ? JSON.stringify(existing.blocks) : null,
      content_schema_version: existing.contentSchemaVersion,
      markdown_projection_status: existing.markdownProjectionStatus,
      markdown_projected_at: existing.markdownProjectedAt,
      projection_error: existing.projectionError,
    },
    { content: nextContent, canonicalFormat: typeof nextContent === 'string' ? 'markdown' : 'json' }
  );
  await dbRun(
    `UPDATE work_canvas_drafts
     SET kind = ?, title = ?, content_json = ?, canonical_format = ?, content_md = ?,
         content_json_native = ?, blocks_json = ?, content_schema_version = ?,
         markdown_projection_status = ?, markdown_projected_at = ?, projection_error = ?,
         sources_json = ?, provenance_json = ?,
         client_id = ?, project_id = ?, owner_id = ?, research_session_id = ?,
         artifact_run_id = ?, artifact_id = ?, dirty_state = ?, updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [
      params.patch.kind || existing.kind,
      params.patch.title || existing.title,
      canonical.content_json,
      canonical.canonical_format,
      canonical.content_md,
      canonical.content_json_native,
      canonical.blocks_json,
      canonical.content_schema_version,
      canonical.markdown_projection_status,
      canonical.markdown_projected_at,
      canonical.projection_error,
      JSON.stringify(params.patch.sources || existing.sources || []),
      JSON.stringify(params.patch.provenance || existing.provenance || {}),
      params.patch.clientId ?? existing.clientId ?? null,
      params.patch.projectId ?? existing.projectId ?? null,
      params.patch.ownerId ?? existing.ownerId ?? null,
      params.patch.researchSessionId ?? existing.researchSessionId ?? null,
      params.patch.artifactRunId ?? existing.artifactRunId ?? null,
      params.patch.artifactId ?? existing.artifactId ?? null,
      'dirty',
      now,
      params.draftId,
      params.organizationId,
    ]
  );
  const updated = await getDraft({
    organizationId: params.organizationId,
    draftId: params.draftId,
  });
  if (!updated) throw new Error('Canvas draft read-back failed');
  return updated;
}

export async function markDraftSavedAsArtifact(params: {
  organizationId: string;
  draftId: string;
  artifactId?: string | null;
  artifactRunId?: string | null;
  artifactVersion?: number | null;
  provenance?: Record<string, unknown> | null;
  auditEventId?: string | null;
}): Promise<WorkCanvasDraftRecord> {
  await ensureSchema();
  const existing = await getDraft(params);
  if (!existing) throw Object.assign(new Error('Canvas draft not found'), { statusCode: 404 });
  const now = nowIso();
  if (!params.artifactId) {
    throw Object.assign(new Error('Canonical artifact id is required'), { statusCode: 502 });
  }
  const nextArtifactId = params.artifactId;
  const nextVersion = params.artifactVersion ?? Number(existing.artifactVersion || 0) + 1;
  await dbRun(
    `UPDATE work_canvas_drafts
     SET save_state = ?, lifecycle_state = ?, dirty_state = ?, audit_status = ?,
         artifact_id = ?, artifact_run_id = ?, artifact_version = ?, provenance_json = ?, updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [
      'saved',
      existing.lifecycleState || 'draft',
      'clean',
      params.auditEventId ? 'recorded' : 'pending',
      nextArtifactId,
      params.artifactRunId || existing.artifactRunId || null,
      nextVersion,
      JSON.stringify({
        ...(existing.provenance || {}),
        ...(params.provenance || {}),
        artifactId: nextArtifactId,
        artifactRunId: params.artifactRunId || existing.artifactRunId || null,
        sourceSummary: 'Saved from V10 Expanded Canvas through V8 artifact runtime',
      }),
      now,
      params.draftId,
      params.organizationId,
    ]
  );
  const saved = await getDraft({ organizationId: params.organizationId, draftId: params.draftId });
  if (!saved) throw new Error('Canvas draft read-back failed');
  return saved;
}

export async function markDraftArtifactSaveFailed(params: {
  organizationId: string;
  draftId: string;
  reason: string;
  auditEventId?: string | null;
}): Promise<WorkCanvasDraftRecord> {
  await ensureSchema();
  const existing = await getDraft(params);
  if (!existing) throw Object.assign(new Error('Canvas draft not found'), { statusCode: 404 });
  const now = nowIso();
  await dbRun(
    `UPDATE work_canvas_drafts
     SET save_state = ?, dirty_state = ?, audit_status = ?, provenance_json = ?, updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [
      'failed',
      existing.dirtyState || 'dirty',
      params.auditEventId ? 'recorded' : 'failed',
      JSON.stringify({
        ...(existing.provenance || {}),
        artifactSaveFailure: params.reason,
        failedAt: now,
      }),
      now,
      params.draftId,
      params.organizationId,
    ]
  );
  const failed = await getDraft({ organizationId: params.organizationId, draftId: params.draftId });
  if (!failed) throw new Error('Canvas draft read-back failed');
  return failed;
}

function artifactPlanForCanvas(kind: WorkCanvasKind): {
  requestedArtifactFamily: 'document' | 'presentation' | 'sheet';
  requestedOutputType: 'report' | 'presentation' | 'sheet';
} {
  if (kind === 'deck') {
    return { requestedArtifactFamily: 'presentation', requestedOutputType: 'presentation' };
  }
  if (kind === 'table' || kind === 'sheet') {
    return { requestedArtifactFamily: 'sheet', requestedOutputType: 'sheet' };
  }
  return { requestedArtifactFamily: 'document', requestedOutputType: 'report' };
}

async function ensureCanvasContextSnapshot(params: {
  draft: WorkCanvasDraftRecord;
  actorUserId: string;
}): Promise<string> {
  const existing =
    typeof params.draft.provenance?.contextSnapshotId === 'string'
      ? params.draft.provenance.contextSnapshotId
      : null;
  if (existing) return existing;

  const snapshot = await contextSnapshotService.captureSnapshot({
    workspaceId: params.draft.projectId || params.draft.organizationId,
    organizationId: params.draft.organizationId,
    projectId: params.draft.projectId || null,
    conversationId: params.draft.conversationId,
    executionRunId: null,
    artifactRefs: params.draft.artifactId
      ? [
          {
            artifactId: params.draft.artifactId,
            artifactType: params.draft.kind,
            artifactModule: 'work_canvas',
            relationship: 'source',
          },
        ]
      : [],
    effectiveScopeRef: params.draft.projectId
      ? `project:${params.draft.projectId}`
      : `organization:${params.draft.organizationId}`,
    resolvedRoleRef: 'work_canvas',
    initiatorUserId: params.actorUserId,
    consumerClass: 'execution',
    privacyMode: false,
    sourceContextRefs: [
      {
        sourceId: params.draft.id,
        scopeType: params.draft.projectId ? 'organization' : 'user_private',
        sourceKind: 'tool',
        freshnessAt: params.draft.updatedAt,
      },
    ],
  });
  return snapshot.snapshotId;
}

export async function saveDraftAsArtifact(params: {
  organizationId: string;
  actorUserId: string;
  draftId: string;
  auditEventId?: string | null;
}): Promise<{ draft: WorkCanvasDraftRecord; readBack: WorkCanvasActionReadBack }> {
  await ensureSchema();
  const draft = await getDraft({ organizationId: params.organizationId, draftId: params.draftId });
  if (!draft) throw Object.assign(new Error('Canvas draft not found'), { statusCode: 404 });

  try {
    const contextSnapshotId = await ensureCanvasContextSnapshot({
      draft,
      actorUserId: params.actorUserId,
    });
    const plan = artifactPlanForCanvas(draft.kind);
    const existingRun = draft.artifactRunId
      ? await getArtifactRun(draft.artifactRunId, params.organizationId)
      : null;
    const shouldCreateRun =
      !existingRun ||
      ['completed', 'failed', 'cancelled', 'rejected'].includes(existingRun.runStatus);
    const planned = shouldCreateRun
      ? await createArtifactRunFromChat({
          organizationId: params.organizationId,
          userId: params.actorUserId,
          conversationId: draft.conversationId,
          contextSnapshotId,
          goal: draft.title,
          requestedArtifactFamily: plan.requestedArtifactFamily,
          requestedOutputType: plan.requestedOutputType,
        }).then((created) => created.run)
      : existingRun;
    if (!planned) {
      throw new Error(`ArtifactRun ${draft.artifactRunId} not found`);
    }

    await preflightArtifactRun({
      runId: planned.runId,
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
    });
    const accepted = await acceptArtifactRunPlan({
      runId: planned.runId,
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
    });
    await executionSpineService.submitForReview(
      accepted.executionRunId,
      params.organizationId,
      params.actorUserId
    );
    await executionSpineService.approveRun(
      accepted.executionRunId,
      params.organizationId,
      params.actorUserId,
      'V10 Work Canvas save-as-artifact approved by explicit user action'
    );
    const materialized = await materializeArtifactRun({
      runId: accepted.runId,
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      title: draft.title,
      description: readString(
        (draft.content as Record<string, unknown>)?.summary,
        `Materialized from canvas draft ${draft.id}`
      ),
      sourceType: plan.requestedOutputType === 'report' ? 'TOOL' : undefined,
      sourceId: plan.requestedOutputType === 'report' ? draft.id : undefined,
      sourceName: draft.title,
      config:
        plan.requestedOutputType === 'sheet'
          ? { tableName: draft.title }
          : { canvasDraftId: draft.id, canvasKind: draft.kind },
    });
    if (!materialized.artifactId) {
      throw new Error('V8 materialization completed without canonical artifact id');
    }

    const saved = await markDraftSavedAsArtifact({
      organizationId: params.organizationId,
      draftId: draft.id,
      artifactId: materialized.artifactId,
      artifactRunId: materialized.runId,
      artifactVersion: Number(draft.artifactVersion || 0) + 1,
      auditEventId: params.auditEventId || null,
      provenance: {
        contextSnapshotId,
        executionRunId: materialized.executionRunId,
        artifactPlan: materialized.plan,
      },
    });
    return {
      draft: saved,
      readBack: {
        status: 'saved',
        target: 'project_brief',
        targetObjectId: materialized.artifactId,
        title: saved.title,
        projectId: saved.projectId,
        artifactId: materialized.artifactId,
        artifactRunId: materialized.runId,
        artifactVersion: saved.artifactVersion,
        url: `/presentations?tab=outputs&artifactId=${encodeURIComponent(materialized.artifactId)}`,
        sourceDraftId: saved.id,
        auditEventId: params.auditEventId || null,
      },
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'V8 artifact materialization failed';
    const failed = await markDraftArtifactSaveFailed({
      organizationId: params.organizationId,
      draftId: draft.id,
      reason,
      auditEventId: params.auditEventId || null,
    });
    throw Object.assign(new Error(reason), {
      statusCode: 502,
      code: 'V8_ARTIFACT_SAVE_FAILED',
      draft: failed,
    });
  }
}

export async function createProposal(params: {
  organizationId: string;
  actorUserId: string;
  draftId: string;
  target: WorkCanvasTarget;
  payload?: Record<string, unknown>;
  /**
   * FIX (Codex delta review, area 2 — "create-time idempotency"): optional,
   * client-generated key (one per "Propose"/"Confirm" button press).
   * Backward compatible — omitting it preserves the exact pre-fix behavior
   * (always a fresh proposal). When supplied, a repeated/concurrent call
   * with the SAME (organizationId, draftId, clientIdempotencyKey) is
   * guaranteed by a DB-level partial unique index (migration 800), not
   * merely a prior SELECT, to resolve to the SAME proposal row — see the
   * `INSERT ... ON CONFLICT DO NOTHING` + re-SELECT below.
   */
  clientIdempotencyKey?: string | null;
}): Promise<WorkCanvasProposalRecord> {
  await ensureSchema();
  const draft = await getDraft({ organizationId: params.organizationId, draftId: params.draftId });
  if (!draft) throw Object.assign(new Error('Canvas draft not found'), { statusCode: 404 });
  const id = uuidv4();
  const now = nowIso();
  const label = params.target.replace(/_/g, ' ');
  // Fingerprint only caller-owned fields. Derived draft fields can change
  // between retries of the same logical operation and are intentionally
  // excluded from idempotency-key reuse validation.
  const callerFingerprint = stableJson(params.payload || {});
  const payload = {
    title: `${label}: ${draft.title}`,
    summary: `Proposal generated from canvas draft ${draft.id}.`,
    sourceDraftId: draft.id,
    artifactId: draft.artifactId || null,
    draftUpdatedAt: draft.updatedAt,
    contentHash: contentHashForDraft(draft),
    provenance: draft.provenance || {},
    ...(params.payload || {}),
    callerFingerprint,
  };
  const requiredCapability = requiredCapabilityForTarget(params.target);
  const clientIdempotencyKey =
    typeof params.clientIdempotencyKey === 'string' && params.clientIdempotencyKey.trim()
      ? params.clientIdempotencyKey.trim().slice(0, 200)
      : null;

  if (!clientIdempotencyKey) {
    await dbRun(
      `INSERT INTO work_canvas_proposals (
        id, draft_id, organization_id, created_by, target, title, summary, status,
        payload_json, required_capability, target_object_id, read_back_json,
        audit_event_id, client_idempotency_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        draft.id,
        params.organizationId,
        params.actorUserId,
        params.target,
        String(payload.title),
        String(payload.summary),
        'proposed',
        JSON.stringify(payload),
        requiredCapability,
        null,
        null,
        null,
        null,
        now,
        now,
      ]
    );
    const proposal = await getProposal({ organizationId: params.organizationId, proposalId: id });
    if (!proposal) throw new Error('Canvas proposal read-back failed');
    return proposal;
  }

  // Idempotent path: the partial unique index on
  // (organization_id, draft_id, client_idempotency_key) — not this
  // application-level check — is what makes two truly concurrent identical
  // calls safe. Exactly one INSERT wins; the other(s) hit the constraint,
  // `DO NOTHING` skips their write, and every caller re-SELECTs the SAME
  // authoritative row by the key regardless of which one "won".
  await dbRun(
    `INSERT INTO work_canvas_proposals (
      id, draft_id, organization_id, created_by, target, title, summary, status,
      payload_json, required_capability, target_object_id, read_back_json,
      audit_event_id, client_idempotency_key, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (organization_id, draft_id, client_idempotency_key)
      WHERE client_idempotency_key IS NOT NULL DO NOTHING`,
    [
      id,
      draft.id,
      params.organizationId,
      params.actorUserId,
      params.target,
      String(payload.title),
      String(payload.summary),
      'proposed',
      JSON.stringify(payload),
      requiredCapability,
      null,
      null,
      null,
      clientIdempotencyKey,
      now,
      now,
    ],
    { fallback: false }
  );
  const proposal = await dbGet<ProposalRow>(
    `SELECT * FROM work_canvas_proposals
      WHERE organization_id = ? AND draft_id = ? AND client_idempotency_key = ?`,
    [params.organizationId, draft.id, clientIdempotencyKey],
    { fallback: false }
  );
  if (!proposal) throw new Error('Canvas proposal read-back failed');
  if (proposal.target !== params.target) {
    throw Object.assign(new Error('Idempotency key already used for a different target'), {
      statusCode: 409,
      code: 'IDEMPOTENCY_KEY_REUSED',
    });
  }
  const existingPayload = parseJson<Record<string, unknown>>(proposal.payload_json, {});
  if (
    typeof existingPayload.callerFingerprint === 'string' &&
    existingPayload.callerFingerprint !== callerFingerprint
  ) {
    throw Object.assign(new Error('Idempotency key already used for a different request payload'), {
      statusCode: 409,
      code: 'IDEMPOTENCY_KEY_REUSED',
    });
  }
  return mapProposal(proposal);
}

export async function getProposal(params: {
  organizationId: string;
  proposalId: string;
}): Promise<WorkCanvasProposalRecord | null> {
  await ensureSchema();
  const row = await dbGet<ProposalRow>(
    `SELECT * FROM work_canvas_proposals WHERE id = ? AND organization_id = ?`,
    [params.proposalId, params.organizationId]
  );
  return row ? mapProposal(row) : null;
}

export async function listProposals(params: {
  organizationId: string;
  draftId: string;
}): Promise<WorkCanvasProposalRecord[]> {
  await ensureSchema();
  const rows = await dbAll<ProposalRow>(
    `SELECT * FROM work_canvas_proposals
     WHERE organization_id = ? AND draft_id = ?
     ORDER BY updated_at DESC`,
    [params.organizationId, params.draftId]
  );
  return rows.map(mapProposal);
}

function assertProposalFresh(
  proposal: WorkCanvasProposalRecord,
  draft: WorkCanvasDraftRecord
): void {
  const expectedHash = readString(proposal.payload.contentHash);
  const expectedUpdatedAt = readString(proposal.payload.draftUpdatedAt);
  const currentHash = contentHashForDraft(draft);
  if (
    (expectedHash && expectedHash !== currentHash) ||
    (expectedUpdatedAt && expectedUpdatedAt !== draft.updatedAt)
  ) {
    throw Object.assign(new Error('Canvas proposal is stale because the draft changed'), {
      statusCode: 409,
      code: 'STALE_CANVAS_PROPOSAL',
      recovery: 'Regenerate or review the proposal against the current canvas draft.',
    });
  }
}

/**
 * FIX FINDING M01-021 (owned by M01-P07B — see
 * M01_P07B_OWNER_HANDOFFS_REPORT.md for the full contract; diagnosed in
 * M01-P07A, see M01-P07A_PROPOSAL_LIFECYCLE_REPORT.md §2.3/§10.1). This used
 * to INSERT exclusively into `work_canvas_ideas`, a table nothing else in
 * the codebase ever SELECTs from (verified: grep for `work_canvas_ideas`
 * across server/src turns up only this file's own CREATE TABLE + that one
 * INSERT — it was write-only). Meanwhile `confirmTargetObjectReadBack('idea',
 * ...)` below in this same file correctly checks the REAL, product-facing
 * `my_ideas` table — the one `server/src/routes/my-work.routes.ts`, the Idea
 * Map, and Radar ranking all actually read. Every "Canvas -> Idea" approval
 * deterministically failed its own read-back with
 * CANVAS_HANDOFF_READBACK_MISSING (500, claim reverted to `proposed`,
 * retried forever with the identical outcome — never transient).
 *
 * Fix: route through `canvasMaterialize.ts::materializeOrThrow` with
 * `target: 'idea'` — the SAME shared materializer `/save-to-workspace`'s
 * `createWorkspaceResource` already uses for `target=idea` (see M-7 comment
 * on `commitProposalToDomain` below: "single materialization core" — every
 * OTHER target already went through it; `idea` was the one branch that
 * never got wired up). That path already writes the REAL `my_ideas` +
 * `my_idea_maps` rows `confirmTargetObjectReadBack` expects, in production,
 * today, for the identical `save-to-workspace` flow. No new table, no new
 * column, no cross-module contract change, no M02 code touched — this
 * closes the one un-wired branch of an already-correct, already-shipped
 * writer.
 */
async function createCanvasIdea(params: {
  organizationId: string;
  actorUserId: string;
  draft: WorkCanvasDraftRecord;
  proposal: WorkCanvasProposalRecord;
}): Promise<WorkCanvasActionReadBack> {
  const title = readString(params.proposal.payload.title, params.proposal.title);
  const summary = readString(params.proposal.payload.summary, params.proposal.summary);

  const { materializeOrThrow } = await import('./canvasMaterialize.js');
  const materialized = await materializeOrThrow(
    {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      target: 'idea',
      title,
      contentMd: params.draft.contentMd || summary || title,
      summary: summary || title,
      projectId: params.draft.projectId || null,
      sourceDraftId: params.draft.id,
      sourceConversationId: params.draft.conversationId,
      sourceType: 'canvas_proposal',
      // M01-P07C (M01-033): a proposal can only ever be approved once — the
      // CAS claim in `approveProposal` ('proposed' -> 'executing') already
      // guarantees this call site runs at most once per `proposal.id` under
      // normal operation. Passing it through as the idempotency key closes
      // the remaining gap: if `approveProposal`'s own state-machine update
      // is ever retried (client resubmits after a lost HTTP response) before
      // it reaches `commitProposalToDomain` a second time, or two concurrent
      // approve calls both win their own CAS claim due to a bug upstream,
      // `materializeWorkspaceTarget`'s pinned transaction now guarantees
      // exactly one idea/map/receipt for this proposal rather than two.
      idempotencyKey: params.proposal.id,
    },
    { writer: 'proposal_approval' }
  );

  // Best-effort ADDITIVE Canvas-side provenance record: `source_draft_id` /
  // `source_proposal_id` linkage that `my_ideas` has no column for. Must
  // NEVER fail the approval — by the time this runs the real owner object
  // (`my_ideas` row, confirmed by `materializeOrThrow`'s own writer) already
  // exists; this is lineage only, same best-effort contract as
  // `appendDraftMaterializedTo` just below in this file.
  // `{ fallback: false }` is load-bearing, not decorative, here too: dbRun's
  // default (`fallback: true`) resolves `{ success: false, error }` on a
  // failed INSERT WITHOUT throwing, so this try/catch would never fire and a
  // silently-dropped provenance row would look identical to a written one.
  //
  // M01-P07C boundary decision: this insert is DELIBERATELY left outside
  // `materializeWorkspaceTarget`'s pinned idea+map+receipt transaction. It
  // targets a DIFFERENT table (`work_canvas_ideas`, Canvas-side lineage —
  // not a My Work owner object) with an EXPLICIT "must never fail approval"
  // contract from M01-021 (see that fix's comment above `createCanvasIdea`).
  // Folding a caller-specific side write into the shared materializer's
  // transaction would break the "every target reduces identically, single
  // materialization core" design this module documents at file top, and
  // would turn a documented best-effort write into one whose failure now
  // rolls back an already-confirmed owner object. M01-033 is about the
  // owner writes (idea, map) and their receipt never landing partially —
  // this row is neither; it is out of scope for this fix by design, not by
  // oversight.

  try {
    await dbRun(
      `INSERT INTO work_canvas_ideas (
        id, organization_id, project_id, title, summary, source_draft_id,
        source_proposal_id, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        params.organizationId,
        params.draft.projectId || null,
        title,
        summary || null,
        params.draft.id,
        params.proposal.id,
        params.actorUserId,
        nowIso(),
        nowIso(),
      ],
      { fallback: false }
    );
  } catch (error) {
    logger.warn('[workCanvas] work_canvas_ideas provenance insert failed (idea already created)', {
      draftId: params.draft.id,
      proposalId: params.proposal.id,
      ideaId: materialized.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    status: 'created',
    entityStatus: 'created',
    target: 'idea',
    targetObjectId: materialized.id,
    title: materialized.title,
    url: materialized.url,
    projectId: params.draft.projectId,
    ownerId: params.draft.ownerId,
    sourceDraftId: params.draft.id,
  };
}

/**
 * C4 — provenance loop closure for the proposal-approval writer. The
 * /save-to-workspace route records `provenance.materializedTo[]` on the draft
 * via `updateDraftAfterOperation`; this is the equivalent for proposals, which
 * live in a different code path (commitProposalToDomain) but share the same
 * `work_canvas_drafts` table. Best-effort: a failed provenance write must not
 * fail the approval — the entity already exists.
 */
async function appendDraftMaterializedTo(params: {
  organizationId: string;
  draft: WorkCanvasDraftRecord;
  entry: { target: string; entityId: string; url: string; title: string; at: string };
}): Promise<void> {
  try {
    const previous = Array.isArray(params.draft.provenance?.materializedTo)
      ? (params.draft.provenance?.materializedTo as unknown[])
      : [];
    await dbRun(
      `UPDATE work_canvas_drafts
       SET provenance_json = ?, updated_at = ?
       WHERE id = ? AND organization_id = ?`,
      [
        JSON.stringify({
          ...(params.draft.provenance || {}),
          materializedTo: [...previous, params.entry],
        }),
        nowIso(),
        params.draft.id,
        params.organizationId,
      ]
    );
  } catch (error) {
    logger.warn('[workCanvas] provenance.materializedTo append failed', {
      draftId: params.draft.id,
      target: params.entry.target,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function commitProposalToDomain(params: {
  organizationId: string;
  actorUserId: string;
  proposal: WorkCanvasProposalRecord;
  draft: WorkCanvasDraftRecord;
  auditEventId?: string | null;
}): Promise<WorkCanvasActionReadBack> {
  const title = readString(params.proposal.payload.title, params.proposal.title);
  const description = readString(params.proposal.payload.description, params.proposal.summary);
  const projectId = readString(params.proposal.payload.projectId, params.draft.projectId || '');
  const ownerId = readString(
    params.proposal.payload.ownerId,
    params.draft.ownerId || params.actorUserId
  );
  const assigneeId = readString(params.proposal.payload.assigneeId, ownerId);

  if (params.proposal.target === 'table') {
    if (params.draft.kind !== 'table') {
      throw Object.assign(new Error('Table handoff requires a Canvas with kind=table'), {
        statusCode: 400,
        code: 'CANVAS_NOT_TABLE_KIND',
      });
    }
    const { materializeCanvasTable } = await import('./canvasTableMaterialize.js');
    const table = await materializeCanvasTable({
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      sourceDraftId: params.draft.id,
      title,
      contentMd: params.draft.contentMd,
    });
    await appendDraftMaterializedTo({
      organizationId: params.organizationId,
      draft: params.draft,
      entry: {
        target: 'table',
        entityId: table.tableId,
        url: table.url,
        title,
        at: nowIso(),
      },
    });
    return {
      status: 'created',
      entityStatus: 'created',
      target: 'table',
      targetObjectId: table.tableId,
      title,
      url: table.url,
      sourceDraftId: params.draft.id,
    };
  }

  // M-7 — task / initiative / decision / note now route through the SAME
  // shared materializer that /save-to-workspace uses
  // (services/canvasMaterialize.ts). Previously this switch had its own
  // hand-rolled branches with a divergent `note → unsupported` outcome; both
  // writers now produce identical entities (the note audit fix lands here
  // too: the proposal-approval path can now create notes via notebookService).
  if (
    params.proposal.target === 'task' ||
    params.proposal.target === 'initiative' ||
    params.proposal.target === 'decision' ||
    params.proposal.target === 'note'
  ) {
    const { materializeOrThrow } = await import('./canvasMaterialize.js');
    const dueDate = normalizeDateTime(params.proposal.payload.dueDate);
    const priority =
      params.proposal.payload.priority === 'low' ||
      params.proposal.payload.priority === 'high' ||
      params.proposal.payload.priority === 'critical'
        ? (params.proposal.payload.priority as 'low' | 'high' | 'critical')
        : 'medium';
    const decisionTypeRaw = params.proposal.payload.decisionType;
    const decisionType =
      decisionTypeRaw === 'GO_NO_GO' ||
      decisionTypeRaw === 'RESOURCE_ALLOCATION' ||
      decisionTypeRaw === 'OTHER'
        ? (decisionTypeRaw as 'GO_NO_GO' | 'RESOURCE_ALLOCATION' | 'OTHER')
        : 'APPROVAL';
    const materialized = await materializeOrThrow(
      {
        organizationId: params.organizationId,
        actorUserId: params.actorUserId,
        target: params.proposal.target,
        title,
        contentMd: params.draft.contentMd || description || title,
        summary: description || title,
        projectId: projectId || null,
        sourceDraftId: params.draft.id,
        decisionType,
        taskPriority: priority,
        taskAssigneeId: assigneeId || undefined,
        taskDueDate: dueDate || undefined,
        ownerId: ownerId || undefined,
      },
      { writer: 'proposal_approval' }
    );
    // C4 — record the materialization on the source draft's provenance ledger
    // (same shape as the /save-to-workspace writer).
    await appendDraftMaterializedTo({
      organizationId: params.organizationId,
      draft: params.draft,
      entry: {
        target: params.proposal.target,
        entityId: materialized.id,
        url: materialized.url,
        title: materialized.title,
        at: nowIso(),
      },
    });
    return {
      status: 'created',
      entityStatus: 'created',
      target: params.proposal.target,
      targetObjectId: materialized.id,
      title: materialized.title,
      url: materialized.url,
      projectId: projectId || params.draft.projectId,
      ownerId: ownerId || undefined,
      assigneeId: assigneeId || undefined,
      artifactId: params.draft.artifactId,
      sourceDraftId: params.draft.id,
    };
  }

  switch (params.proposal.target) {
    case 'idea':
      return createCanvasIdea(params);
    case 'project_brief':
    case 'client_deliverable':
    case 'research_report':
    case 'kpi_roi_artifact': {
      const saved = await saveDraftAsArtifact({
        organizationId: params.organizationId,
        actorUserId: params.actorUserId,
        draftId: params.draft.id,
        auditEventId: params.auditEventId || null,
      });
      return {
        ...saved.readBack,
        target: params.proposal.target,
      };
    }
    default:
      return createCanvasIdea({
        organizationId: params.organizationId,
        actorUserId: params.actorUserId,
        draft: params.draft,
        proposal: params.proposal,
      });
  }
}

export async function rejectProposal(params: {
  organizationId: string;
  proposalId: string;
  auditEventId?: string | null;
  reason?: string | null;
}): Promise<WorkCanvasProposalRecord> {
  await ensureSchema();
  const existing = await getProposal(params);
  if (!existing) throw Object.assign(new Error('Canvas proposal not found'), { statusCode: 404 });
  // NARROWED (M01-P07A review, §4.2): keep the ORIGINAL state-machine scope
  // — only a proposal still in `proposed` can ever be rejected. A prior
  // revision of this guard read `if (status === 'approved' || status ===
  // 'rejected') return existing`, which let a proposal in `executing` fall
  // through to the CAS-guarded UPDATE below. That UPDATE's own `AND status =
  // 'proposed'` clause would have made it a no-op for `executing` too (so no
  // actual state got corrupted), but it silently WIDENED which states this
  // function attempts to act on — `executing` belongs to P07B's territory,
  // and expanding reject's reach into it was not part of "harden the reject
  // path", it was an unreviewed state-machine change. Restored to the exact
  // pre-P07A scope; the CAS fix itself (the guarded UPDATE below) is
  // unchanged and still closes the real race against approve.
  if (existing.status !== 'proposed') return existing;
  const now = nowIso();
  const readBack: WorkCanvasActionReadBack = {
    status: 'rejected',
    target: existing.target,
    targetObjectId: null,
    sourceDraftId: existing.draftId,
    reason: params.reason || 'Rejected by user',
    auditEventId: params.auditEventId || null,
  };
  // FIX (M01-P07A — CAS hardening): the previous version read `existing`,
  // then ran an UNCONDITIONAL UPDATE ... WHERE id = ? AND organization_id = ?
  // with no status guard. That is a genuine TOCTOU race against
  // approveProposal's own CAS claim (`WHERE status = 'proposed'`): if an
  // approve call won the race between this function's read and its write —
  // moving the row through 'executing' and on to 'approved' with a REAL
  // target_object_id already materialized — this UPDATE would still fire
  // unconditionally and overwrite that row back to status='rejected' with
  // target_object_id=null, silently orphaning the just-created domain object
  // (task/idea/decision/table/...) while telling the caller/UI the proposal
  // was never actioned. Guarding the UPDATE itself with
  // `AND status = 'proposed'` makes the transition atomic and gives exactly
  // one winner for any concurrent approve/reject pair, matching the same CAS
  // pattern approveProposal already uses for its own claim.
  const claim = await dbRun(
    `UPDATE work_canvas_proposals
     SET status = ?, target_object_id = ?, read_back_json = ?, audit_event_id = ?, updated_at = ?
     WHERE id = ? AND organization_id = ? AND status = 'proposed'`,
    [
      'rejected',
      null,
      JSON.stringify(readBack),
      params.auditEventId || null,
      now,
      params.proposalId,
      params.organizationId,
    ],
    { fallback: false }
  );
  if (claim.changes !== 1) {
    // Someone else (approve, or a concurrent reject) already resolved this
    // proposal between our read and our write — return the CURRENT
    // authoritative row instead of forcing a rejection over it.
    const latest = await getProposal({
      organizationId: params.organizationId,
      proposalId: params.proposalId,
    });
    if (latest) return latest;
    throw Object.assign(new Error('Canvas proposal not found'), { statusCode: 404 });
  }
  const rejected = await getProposal({
    organizationId: params.organizationId,
    proposalId: params.proposalId,
  });
  if (!rejected) throw new Error('Canvas proposal read-back failed');
  return rejected;
}

/**
 * FIX (Codex delta review, 2026-08-02, area 1 — "independent owner
 * read-back"): `approveProposal` previously trusted `commitProposalToDomain`'s
 * return value alone before flipping a proposal to `approved` — no
 * confirming SELECT against the target's own canonical table ever ran. That
 * is the exact same structural gap already proven to fail for real elsewhere
 * in this codebase (Teresa Copilot's `executeProposal`/`performHandoff`
 * marks a proposal `completed` whenever the handoff call doesn't throw, even
 * when the handler internally fell back to an id that was never written
 * anywhere). This helper performs one small, per-target confirming read,
 * scoped by `organizationId` (tenant isolation) — split by target rather
 * than adding elaborate conditionals inline in `approveProposal`.
 *
 * Scope note: `project_brief` / `client_deliverable` / `research_report` /
 * `kpi_roi_artifact` route through a SEPARATE, already-gated pipeline
 * (`saveDraftAsArtifact` → `materializeArtifactRun`, its own preflight +
 * execution-spine validation) — out of scope for this fix (the delta review
 * did not identify a defect there, and rebuilding that pipeline's read-back
 * semantics is a materially larger change than what was asked for). Those
 * targets fall through to `true` here unchanged.
 */
async function confirmTargetObjectReadBack(
  target: WorkCanvasTarget,
  targetObjectId: string,
  organizationId: string
): Promise<boolean> {
  // `{ fallback: false }` on every query below is load-bearing, not
  // decorative: dbGet's default (`fallback: true`) silently resolves ANY
  // query error (bad column, timeout, whatever) to `null` — indistinguishable
  // from a genuine "row not found". That would make this very read-back
  // fix susceptible to the identical silent-swallow failure mode it exists
  // to close off elsewhere (a real error masquerading as "target missing").
  switch (target) {
    case 'idea': {
      const row = await dbGet<{ id: string }>(
        `SELECT id FROM my_ideas WHERE id = ? AND organization_id = ?`,
        [targetObjectId, organizationId],
        { fallback: false }
      );
      return Boolean(row);
    }
    case 'note': {
      const row = await dbGet<{ id: string }>(
        `SELECT id FROM notebook_pages WHERE id = ? AND organization_id = ?`,
        [targetObjectId, organizationId],
        { fallback: false }
      );
      return Boolean(row);
    }
    case 'task': {
      const row = await dbGet<{ id: string }>(
        `SELECT id FROM tasks WHERE id = ? AND organization_id = ?`,
        [targetObjectId, organizationId],
        { fallback: false }
      );
      return Boolean(row);
    }
    case 'decision': {
      const row = await dbGet<{ id: string }>(
        `SELECT id FROM decisions WHERE id = ? AND organization_id = ?`,
        [targetObjectId, organizationId],
        { fallback: false }
      );
      return Boolean(row);
    }
    case 'initiative': {
      const row = await dbGet<{ id: string }>(
        `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
        [targetObjectId, organizationId],
        { fallback: false }
      );
      return Boolean(row);
    }
    case 'table': {
      const row = await dbGet<{ id: string }>(
        `SELECT t.id FROM tp_tables t JOIN tp_bases b ON b.id = t.base_id
          WHERE t.id = ? AND b.organization_id = ?`,
        [targetObjectId, organizationId],
        { fallback: false }
      );
      return Boolean(row);
    }
    default:
      return true;
  }
}

export async function approveProposal(params: {
  organizationId: string;
  proposalId: string;
  actorUserId: string;
  auditEventId?: string | null;
}): Promise<WorkCanvasProposalRecord> {
  await ensureSchema();
  if (!params.actorUserId) {
    throw Object.assign(new Error('Actor user is required to approve canvas proposal'), {
      statusCode: 403,
      code: 'CANVAS_ACTOR_REQUIRED',
    });
  }
  const existing = await getProposal(params);
  if (!existing) throw Object.assign(new Error('Canvas proposal not found'), { statusCode: 404 });
  if (existing.status === 'approved' || existing.status === 'rejected') {
    return existing;
  }
  if (existing.status === 'executing') {
    throw Object.assign(new Error('Canvas proposal execution already in progress'), {
      statusCode: 409,
      code: 'CANVAS_PROPOSAL_ALREADY_CLAIMED',
    });
  }
  const draft = await getDraft({
    organizationId: params.organizationId,
    draftId: existing.draftId,
  });
  if (!draft) throw Object.assign(new Error('Canvas draft not found'), { statusCode: 404 });
  assertProposalFresh(existing, draft);
  const claim = await dbRun(
    `UPDATE work_canvas_proposals SET status = ?, updated_at = ?
     WHERE id = ? AND organization_id = ? AND status = 'proposed'`,
    ['executing', nowIso(), params.proposalId, params.organizationId],
    { fallback: false }
  );
  if (claim.changes !== 1) {
    const latest = await getProposal(params);
    if (latest?.status === 'approved' || latest?.status === 'rejected') return latest;
    throw Object.assign(new Error('Canvas proposal execution already in progress'), {
      statusCode: 409,
      code: 'CANVAS_PROPOSAL_ALREADY_CLAIMED',
    });
  }
  const revertClaimToProposed = async (): Promise<void> => {
    await dbRun(
      `UPDATE work_canvas_proposals SET status = 'proposed', updated_at = ?
       WHERE id = ? AND organization_id = ? AND status = 'executing'`,
      [nowIso(), params.proposalId, params.organizationId],
      { fallback: false }
    );
  };

  let readBack: WorkCanvasActionReadBack;
  try {
    readBack = await commitProposalToDomain({
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      proposal: existing,
      draft,
      auditEventId: params.auditEventId || null,
    });
  } catch (error) {
    await revertClaimToProposed();
    throw error;
  }

  // FIX (independent owner read-back, Codex delta review area 1): never
  // trust commitProposalToDomain's return value alone — confirm the target
  // object genuinely exists, tenant-scoped, before this proposal can ever
  // reach `approved`. A missing object reverts the claim (retryable, same
  // recovery path as a thrown materialize error above) and surfaces a
  // controlled, recognizable error instead of a fabricated success.
  if (readBack.targetObjectId) {
    const confirmed = await confirmTargetObjectReadBack(
      readBack.target,
      readBack.targetObjectId,
      params.organizationId
    );
    if (!confirmed) {
      await revertClaimToProposed();
      throw Object.assign(
        new Error(
          `Materialized ${readBack.target} object (${readBack.targetObjectId}) could not be confirmed by an independent read-back`
        ),
        { statusCode: 500, code: 'CANVAS_HANDOFF_READBACK_MISSING' }
      );
    }
  }
  const now = nowIso();
  const approvedReadBack = {
    ...readBack,
    status: 'approved',
    proposalStatus: 'approved',
    entityStatus: readBack.entityStatus || readBack.status || null,
    auditEventId: params.auditEventId || null,
  };
  await dbRun(
    `UPDATE work_canvas_proposals
     SET status = ?, target_object_id = ?, read_back_json = ?, audit_event_id = ?, updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [
      'approved',
      readBack.targetObjectId,
      JSON.stringify(approvedReadBack),
      params.auditEventId || null,
      now,
      params.proposalId,
      params.organizationId,
    ]
  );
  const decided = await getProposal({
    organizationId: params.organizationId,
    proposalId: params.proposalId,
  });
  if (!decided) throw new Error('Canvas proposal read-back failed');
  return decided;
}

export async function decideProposal(params: {
  organizationId: string;
  proposalId: string;
  actorUserId?: string;
  status: 'approved' | 'rejected';
  auditEventId?: string | null;
  reason?: string | null;
}): Promise<WorkCanvasProposalRecord> {
  if (params.status === 'rejected') return rejectProposal(params);
  if (!params.actorUserId) {
    throw Object.assign(new Error('Actor user is required to approve canvas proposal'), {
      statusCode: 403,
      code: 'CANVAS_ACTOR_REQUIRED',
    });
  }
  return approveProposal({
    organizationId: params.organizationId,
    proposalId: params.proposalId,
    actorUserId: params.actorUserId || '',
    auditEventId: params.auditEventId || null,
  });
}
