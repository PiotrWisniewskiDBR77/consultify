import { randomUUID } from 'node:crypto';

import { Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

const router = Router();

type DraftKind =
  | 'markdown'
  | 'table'
  | 'checklist'
  | 'research'
  | 'decision'
  | 'document'
  | 'sheet'
  | 'deck';
type ProposalStatus = 'proposed' | 'approved' | 'rejected';

interface WorkCanvasDraft {
  id: string;
  organizationId: string;
  createdBy: string;
  conversationId: string;
  kind: DraftKind;
  title: string;
  content: unknown;
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

type DraftRow = {
  id: string;
  organization_id: string;
  created_by: string;
  conversation_id: string;
  kind: DraftKind;
  title: string;
  content_json: string | null;
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

function authContext(req: AuthRequest) {
  return {
    userId: req.userId || req.user?.id || 'unknown-user',
    organizationId: req.organizationId || req.user?.organizationId || 'unknown-org',
  };
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

function toDraft(row: DraftRow): WorkCanvasDraft {
  return {
    id: row.id,
    organizationId: row.organization_id,
    createdBy: row.created_by,
    conversationId: row.conversation_id,
    kind: row.kind,
    title: row.title,
    content: parseJson(row.content_json, ''),
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
    })();
  }
  return storageReadyPromise;
}

async function ownedDraft(req: AuthRequest, draftId: string): Promise<WorkCanvasDraft | null> {
  await ensureStorage();
  const { organizationId } = authContext(req);
  const row = await dbGet<DraftRow>(
    `SELECT * FROM work_canvas_drafts WHERE id = ? AND organization_id = ?`,
    [draftId, organizationId],
    { fallback: false }
  );
  return row ? toDraft(row) : null;
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
  whereParts.push('(project_id IS NULL OR created_by = ?');
  queryParams.push(userId);
  if (projectId) {
    whereParts.push('OR project_id = ?');
    queryParams.push(projectId);
  }
  whereParts.push(')');
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
  await dbRun(
    `INSERT INTO work_canvas_drafts (
      id, organization_id, created_by, conversation_id, kind, title, content_json,
      sources_json, provenance_json, project_id, owner_id, research_session_id,
      artifact_id, artifact_run_id, artifact_version, save_state, lifecycle_state,
      dirty_state, visibility, audit_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      draft.id,
      draft.organizationId,
      draft.createdBy,
      draft.conversationId,
      draft.kind,
      draft.title,
      JSON.stringify(draft.content),
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

router.put('/drafts/:draftId', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  const updated: WorkCanvasDraft = {
    ...draft,
    ...req.body,
    id: draft.id,
    organizationId: draft.organizationId,
    createdBy: draft.createdBy,
    updatedAt: new Date().toISOString(),
  };
  await dbRun(
    `UPDATE work_canvas_drafts
     SET conversation_id = ?, kind = ?, title = ?, content_json = ?, sources_json = ?,
         provenance_json = ?, project_id = ?, owner_id = ?, research_session_id = ?,
         artifact_id = ?, artifact_run_id = ?, artifact_version = ?, save_state = ?,
         lifecycle_state = ?, dirty_state = ?, visibility = ?, audit_status = ?, updated_at = ?
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
  const targetObjectId = `${proposal.target}-${randomUUID()}`;
  const readBack = {
    target: proposal.target,
    targetObjectId,
    status: 'approved',
    entityStatus: 'created',
    auditEventId: `ae-${randomUUID()}`,
  };
  const updated: WorkCanvasProposal = {
    ...proposal,
    status: 'approved',
    targetObjectId,
    readBack,
    auditEventId: String(readBack.auditEventId),
    updatedAt: new Date().toISOString(),
  };
  await dbRun(
    `UPDATE work_canvas_proposals
     SET status = ?, target_object_id = ?, read_back_json = ?, audit_event_id = ?, updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [
      updated.status,
      updated.targetObjectId,
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

router.post('/drafts/:draftId/save-as-artifact', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  const artifactId = `artifact-${randomUUID()}`;
  const updated: WorkCanvasDraft = {
    ...draft,
    artifactId,
    artifactRunId: `run-${randomUUID()}`,
    artifactVersion: 1,
    saveState: 'saved',
    dirtyState: 'clean',
    auditStatus: 'logged',
    updatedAt: new Date().toISOString(),
  };
  await dbRun(
    `UPDATE work_canvas_drafts
     SET artifact_id = ?, artifact_run_id = ?, artifact_version = ?, save_state = ?,
         dirty_state = ?, audit_status = ?, updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [
      updated.artifactId,
      updated.artifactRunId,
      updated.artifactVersion,
      updated.saveState,
      updated.dirtyState,
      updated.auditStatus,
      updated.updatedAt,
      updated.id,
      updated.organizationId,
    ],
    { fallback: false }
  );
  const readBack = {
    target: 'artifact',
    targetObjectId: artifactId,
    status: 'saved',
    artifactVersion: 1,
  };
  return res.json(envelope(updated, { readBack, auditEventId: `ae-${randomUUID()}` }));
});

export default router;
