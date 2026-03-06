/**
 * Assessment Enterprise Routes
 * V4-ASMT-04, V4-ASMT-05, V4-ASMT-06, V4-ASMT-07
 */

import { Router, type Response } from 'express';
import { z } from 'zod';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assessmentEnterpriseService } from '../services/assessmentEnterpriseService.js';

const router = Router();
router.use(verifyToken);

const requireUser = (req: AuthRequest, res: Response): { userId: string; orgId: string } | null => {
  const userId = req.user?.id || req.userId;
  const orgId = req.user?.organizationId || req.organizationId || (req.headers['x-organization-id'] as string) || (req.query.organizationId as string);
  if (!userId || !orgId) { res.status(401).json({ error: 'Authentication required' }); return null; }
  return { userId, orgId };
};

// ═══════════════════════════════════════════
// V4-ASMT-04: Findings + CAPA
// ═══════════════════════════════════════════

router.post('/assessments/:assessmentId/findings', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ findingType: z.string().optional(), severity: z.string().optional(), clauseRef: z.string().optional(), frameworkId: z.string().optional(), title: z.string(), description: z.string().optional(), evidenceRefs: z.array(z.string()).optional(), assignedTo: z.string().optional(), dueDate: z.string().optional() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const r = await assessmentEnterpriseService.createFinding(id.orgId, { ...p.data, assessmentId: req.params.assessmentId, createdBy: id.userId });
  res.status(201).json(r);
}));

router.get('/assessments/:assessmentId/findings', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const filters = { status: req.query.status as string, severity: req.query.severity as string, findingType: req.query.findingType as string, clauseRef: req.query.clauseRef as string };
  res.json({ findings: await assessmentEnterpriseService.getFindings(id.orgId, req.params.assessmentId, filters) });
}));

router.get('/findings/:findingId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const f = await assessmentEnterpriseService.getFinding(id.orgId, req.params.findingId);
  if (!f) { res.status(404).json({ error: 'Finding not found' }); return; }
  res.json(f);
}));

router.put('/findings/:findingId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  res.json(await assessmentEnterpriseService.updateFinding(id.orgId, req.params.findingId, req.body));
}));

router.post('/findings/:findingId/capa', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ actionType: z.string().optional(), title: z.string(), description: z.string().optional(), assignedTo: z.string().optional(), dueDate: z.string().optional(), verificationMethod: z.string().optional() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const r = await assessmentEnterpriseService.createCapaAction(id.orgId, { ...p.data, findingId: req.params.findingId });
  res.status(201).json(r);
}));

router.get('/findings/:findingId/capa', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  res.json({ actions: await assessmentEnterpriseService.getCapaActions(req.params.findingId) });
}));

router.put('/capa/:actionId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  res.json(await assessmentEnterpriseService.updateCapaAction(req.params.actionId, req.body));
}));

// ═══════════════════════════════════════════
// V4-ASMT-05: Evidence Clause Mapping + Audit
// ═══════════════════════════════════════════

router.post('/evidence/clause-map', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ evidenceId: z.string(), frameworkId: z.string(), clauseRef: z.string(), coverageLevel: z.string().optional(), notes: z.string().optional() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const r = await assessmentEnterpriseService.mapEvidenceToClause(id.orgId, { ...p.data, mappedBy: id.userId });
  res.status(201).json(r);
}));

router.get('/evidence/clause-map', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const filters = { evidenceId: req.query.evidenceId as string, frameworkId: req.query.frameworkId as string, clauseRef: req.query.clauseRef as string };
  res.json({ mappings: await assessmentEnterpriseService.getClauseMappings(id.orgId, filters) });
}));

router.delete('/evidence/clause-map/:mappingId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  res.json(await assessmentEnterpriseService.deleteClauseMapping(id.orgId, req.params.mappingId));
}));

router.get('/evidence/clause-coverage/:frameworkId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  res.json({ coverage: await assessmentEnterpriseService.getClauseCoverage(id.orgId, req.params.frameworkId) });
}));

router.post('/evidence/:evidenceId/access-log', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ action: z.string() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const r = await assessmentEnterpriseService.logEvidenceAccess(id.orgId, {
    evidenceId: req.params.evidenceId, userId: id.userId, action: p.data.action,
    ipAddress: req.ip, userAgent: req.headers['user-agent'],
  });
  res.status(201).json(r);
}));

router.get('/evidence/access-log', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const evidenceId = req.query.evidenceId as string | undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 100;
  res.json({ log: await assessmentEnterpriseService.getEvidenceAccessLog(id.orgId, evidenceId, limit) });
}));

// ═══════════════════════════════════════════
// V4-ASMT-06: AI Scoring + Eval Harness
// ═══════════════════════════════════════════

router.post('/assessments/:assessmentId/scoring-proposals', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ axisId: z.string().optional(), questionId: z.string().optional(), proposedScore: z.number(), currentScore: z.number().optional(), citations: z.array(z.string()).optional(), reasoning: z.string().optional(), confidence: z.number().optional(), aiModelUsed: z.string().optional() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const r = await assessmentEnterpriseService.createScoringProposal(id.orgId, { ...p.data, assessmentId: req.params.assessmentId });
  res.status(201).json(r);
}));

router.get('/assessments/:assessmentId/scoring-proposals', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const status = req.query.status as string | undefined;
  res.json({ proposals: await assessmentEnterpriseService.getScoringProposals(id.orgId, req.params.assessmentId, status) });
}));

router.post('/scoring-proposals/:proposalId/review', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ status: z.enum(['accepted', 'rejected']) });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  res.json(await assessmentEnterpriseService.reviewScoringProposal(req.params.proposalId, { ...p.data, reviewedBy: id.userId }));
}));

router.post('/eval/datasets', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ frameworkId: z.string(), name: z.string(), description: z.string().optional(), goldenItems: z.array(z.record(z.unknown())).optional() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const r = await assessmentEnterpriseService.createEvalDataset(id.orgId, { ...p.data, createdBy: id.userId });
  res.status(201).json(r);
}));

router.get('/eval/datasets', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const frameworkId = req.query.frameworkId as string | undefined;
  res.json({ datasets: await assessmentEnterpriseService.getEvalDatasets(id.orgId, frameworkId) });
}));

router.post('/eval/runs', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ datasetId: z.string(), aiModelUsed: z.string().optional(), accuracy: z.number().optional(), precisionScore: z.number().optional(), recall: z.number().optional(), f1Score: z.number().optional(), detailsJson: z.record(z.unknown()).optional() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const r = await assessmentEnterpriseService.createEvalRun(id.orgId, { ...p.data, runBy: id.userId });
  res.status(201).json(r);
}));

router.get('/eval/datasets/:datasetId/runs', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  res.json({ runs: await assessmentEnterpriseService.getEvalRuns(req.params.datasetId) });
}));

router.get('/eval/runs/:runIdA/compare/:runIdB', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const r = await assessmentEnterpriseService.compareEvalRuns(req.params.runIdA, req.params.runIdB);
  if (!r) { res.status(404).json({ error: 'One or both runs not found' }); return; }
  res.json(r);
}));

// ═══════════════════════════════════════════
// V4-ASMT-07: Report Reviews + Diff
// ═══════════════════════════════════════════

router.post('/assessments/:assessmentId/reviews', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ versionId: z.string(), reviewerId: z.string() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const r = await assessmentEnterpriseService.requestReview(id.orgId, { ...p.data, assessmentId: req.params.assessmentId });
  res.status(201).json(r);
}));

router.get('/assessments/:assessmentId/reviews', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const versionId = req.query.versionId as string | undefined;
  res.json({ reviews: await assessmentEnterpriseService.getReviews(id.orgId, req.params.assessmentId, versionId) });
}));

router.post('/reviews/:reviewId/sign-off', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ comments: z.string().optional() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  res.json(await assessmentEnterpriseService.signOff(req.params.reviewId, id.userId, p.data));
}));

router.post('/reviews/:reviewId/reject', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ comments: z.string() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  res.json(await assessmentEnterpriseService.rejectReview(req.params.reviewId, id.userId, p.data));
}));

router.get('/assessments/:assessmentId/versions/:fromVersionId/diff/:toVersionId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const diff = await assessmentEnterpriseService.getVersionDiff(id.orgId, req.params.assessmentId, req.params.fromVersionId, req.params.toVersionId);
  if (!diff) { res.status(404).json({ error: 'Version(s) not found' }); return; }
  res.json(diff);
}));

export default router;
