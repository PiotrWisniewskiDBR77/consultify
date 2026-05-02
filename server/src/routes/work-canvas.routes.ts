import { randomUUID } from 'node:crypto';

import { Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';

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

const drafts = new Map<string, WorkCanvasDraft>();
const proposals = new Map<string, WorkCanvasProposal>();

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

function ownedDraft(req: AuthRequest, draftId: string): WorkCanvasDraft | null {
  const { organizationId } = authContext(req);
  const draft = drafts.get(draftId);
  if (!draft || draft.organizationId !== organizationId) return null;
  return draft;
}

router.use(verifyToken);

router.get('/drafts', (req: AuthRequest, res) => {
  const { organizationId, userId } = authContext(req);
  const conversationId = req.query.conversationId ? String(req.query.conversationId) : null;
  const result = Array.from(drafts.values())
    .filter((draft) => draft.organizationId === organizationId)
    .filter((draft) => !conversationId || draft.conversationId === conversationId)
    .filter((draft) => !draft.projectId || draft.createdBy === userId || Boolean(req.query.projectId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  res.json(envelope(result));
});

router.post('/drafts', (req: AuthRequest, res) => {
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
    provenance: req.body?.provenance && typeof req.body.provenance === 'object' ? req.body.provenance : {},
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
  drafts.set(draft.id, draft);
  res.status(201).json(envelope(draft, { auditEventId: `ae-${randomUUID()}` }));
});

router.get('/drafts/:draftId', (req: AuthRequest, res) => {
  const draft = ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  const draftProposals = Array.from(proposals.values()).filter((proposal) => proposal.draftId === draft.id);
  return res.json(envelope({ draft, proposals: draftProposals }));
});

router.put('/drafts/:draftId', (req: AuthRequest, res) => {
  const draft = ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  const updated: WorkCanvasDraft = {
    ...draft,
    ...req.body,
    id: draft.id,
    organizationId: draft.organizationId,
    createdBy: draft.createdBy,
    updatedAt: new Date().toISOString(),
  };
  drafts.set(updated.id, updated);
  return res.json(envelope(updated, { auditEventId: `ae-${randomUUID()}` }));
});

router.post('/drafts/:draftId/proposals', (req: AuthRequest, res) => {
  const draft = ownedDraft(req, req.params.draftId);
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
  proposals.set(proposal.id, proposal);
  return res.status(201).json(envelope(proposal, { auditEventId: `ae-${randomUUID()}` }));
});

router.get('/drafts/:draftId/proposals', (req: AuthRequest, res) => {
  const draft = ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  return res.json(envelope(Array.from(proposals.values()).filter((proposal) => proposal.draftId === draft.id)));
});

router.post('/proposals/:proposalId/reject', (req: AuthRequest, res) => {
  const proposal = proposals.get(req.params.proposalId);
  if (!proposal || proposal.organizationId !== authContext(req).organizationId) {
    return res.status(404).json({ error: 'Canvas proposal not found' });
  }
  const updated: WorkCanvasProposal = {
    ...proposal,
    status: 'rejected',
    readBack: { target: proposal.target, status: 'rejected' },
    updatedAt: new Date().toISOString(),
  };
  proposals.set(updated.id, updated);
  return res.json(envelope(updated, { readBack: updated.readBack, auditEventId: `ae-${randomUUID()}` }));
});

router.post('/proposals/:proposalId/approve', (req: AuthRequest, res) => {
  const proposal = proposals.get(req.params.proposalId);
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
  proposals.set(updated.id, updated);
  return res.json(envelope(updated, { readBack, auditEventId: updated.auditEventId }));
});

router.post('/drafts/:draftId/save-as-artifact', (req: AuthRequest, res) => {
  const draft = ownedDraft(req, req.params.draftId);
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
  drafts.set(updated.id, updated);
  const readBack = {
    target: 'artifact',
    targetObjectId: artifactId,
    status: 'saved',
    artifactVersion: 1,
  };
  return res.json(envelope(updated, { readBack, auditEventId: `ae-${randomUUID()}` }));
});

export default router;
