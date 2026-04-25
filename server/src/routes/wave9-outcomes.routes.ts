import { type Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import {
  buildWave9AIOpsDashboard,
  buildWave9FinanceScenarios,
  buildWave9Report,
  createWave9Outcome,
  listWave9AcceptanceRuns,
  listWave9Outcomes,
  recordWave9EvalRun,
  recordWave9Incident,
  recordWave9ProviderHealth,
  registerWave9AcceptanceRun,
  registerWave9Evidence,
  runWave9FinalAcceptance,
} from '../services/wave9OutcomeRuntimeService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

function getAuthContext(req: AuthRequest): { userId: string; organizationId: string } {
  const user = req.user as any;
  const userId = user?.id || user?.userId || req.userId;
  const organizationId = user?.organizationId || user?.organization_id || req.organizationId;
  if (!userId) throw new Error('Unauthorized');
  if (!organizationId) throw new Error('Organization context is required');
  return { userId, organizationId };
}

function requireAIOpsVerifier(req: AuthRequest): void {
  const user = req.user as any;
  const role = String(user?.role || user?.systemRole || '').toLowerCase();
  const isVerifier =
    role === 'admin' ||
    role === 'owner' ||
    role === 'superadmin' ||
    user?.isAdmin === true ||
    user?.isSuperAdmin === true;
  if (!isVerifier) {
    throw new Error('Wave 9 evidence registration requires AI Ops verifier privileges');
  }
}

router.post(
  '/evidence',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getAuthContext(req);
    requireAIOpsVerifier(req);
    const evidence = await registerWave9Evidence({
      organizationId,
      evidenceType: req.body.evidenceType || 'kpi',
      sourceType: String(req.body.sourceType || 'unknown'),
      sourceId: String(req.body.sourceId || ''),
      title: req.body.title ? String(req.body.title) : null,
      status: req.body.status || 'pass',
      verifiedBy: userId,
      verificationMethod: 'ai_ops_verified_route',
      payload: req.body.payload && typeof req.body.payload === 'object' ? req.body.payload : {},
    });
    return res.status(201).json({ success: true, evidence });
  })
);

router.get(
  '/outcomes',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getAuthContext(req);
    const outcomes = await listWave9Outcomes({ organizationId });
    return res.json({ success: true, outcomes });
  })
);

router.post(
  '/outcomes',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getAuthContext(req);
    const outcome = await createWave9Outcome({
      organizationId,
      userId,
      initiativeId: String(req.body.initiativeId || ''),
      taskIds: Array.isArray(req.body.taskIds) ? req.body.taskIds.map(String) : [],
      kpiName: String(req.body.kpiName || ''),
      ownerUserId: String(req.body.ownerUserId || userId),
      baseline: Number(req.body.baseline || 0),
      target: Number(req.body.target || 0),
      current: req.body.current == null ? null : Number(req.body.current),
      confidence: Number(req.body.confidence || 0.5),
      assumptions: Array.isArray(req.body.assumptions) ? req.body.assumptions.map(String) : [],
      sourceRefs: Array.isArray(req.body.sourceRefs)
        ? req.body.sourceRefs.map((source: any) => ({
            sourceType: String(source?.sourceType || 'unknown'),
            sourceId: String(source?.sourceId || ''),
            title: source?.title ? String(source.title) : null,
          }))
        : [],
      investment: req.body.investment == null ? null : Number(req.body.investment),
      annualBenefit: req.body.annualBenefit == null ? null : Number(req.body.annualBenefit),
    });
    return res.status(201).json({ success: true, outcome });
  })
);

router.get(
  '/outcomes/:outcomeId/scenarios',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getAuthContext(req);
    const scenarios = await buildWave9FinanceScenarios({
      organizationId,
      outcomeId: String(req.params.outcomeId || ''),
    });
    return res.json({ success: true, scenarios });
  })
);

router.post(
  '/reports',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getAuthContext(req);
    const report = await buildWave9Report({
      organizationId,
      outcomeId: String(req.body.outcomeId || ''),
      reportType: req.body.reportType || 'client_ready',
    });
    return res.json({ success: true, report });
  })
);

router.post(
  '/provider-health',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getAuthContext(req);
    const health = await recordWave9ProviderHealth({
      organizationId,
      provider: String(req.body.provider || 'unknown'),
      model: req.body.model || null,
      status: req.body.status || 'healthy',
      latencyMs: req.body.latencyMs == null ? null : Number(req.body.latencyMs),
      errorRate: req.body.errorRate == null ? null : Number(req.body.errorRate),
      costUsd: req.body.costUsd == null ? null : Number(req.body.costUsd),
    });
    return res.status(201).json({ success: true, health });
  })
);

router.post(
  '/eval-runs',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getAuthContext(req);
    const evalRun = await recordWave9EvalRun({
      organizationId,
      promptKey: String(req.body.promptKey || ''),
      promptVersion: req.body.promptVersion || null,
      category: req.body.category || 'golden_prompt',
      status: req.body.status || 'pass',
      score: req.body.score == null ? null : Number(req.body.score),
      hallucinationCheckPassed:
        req.body.hallucinationCheckPassed == null
          ? null
          : req.body.hallucinationCheckPassed === true,
      toolMisuseCheckPassed:
        req.body.toolMisuseCheckPassed == null ? null : req.body.toolMisuseCheckPassed === true,
      runRef: req.body.runRef || null,
      details: req.body.details && typeof req.body.details === 'object' ? req.body.details : {},
    });
    return res.status(201).json({ success: true, evalRun });
  })
);

router.get(
  '/acceptance-runs',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getAuthContext(req);
    const acceptanceRuns = await listWave9AcceptanceRuns({ organizationId });
    return res.json({ success: true, acceptanceRuns });
  })
);

router.post(
  '/acceptance-runs',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getAuthContext(req);
    requireAIOpsVerifier(req);
    const acceptanceRun = await registerWave9AcceptanceRun({
      organizationId,
      runType: req.body.runType,
      status: req.body.status || 'pass',
      runRef: req.body.runRef || null,
      buildId: req.body.buildId || null,
      commitSha: req.body.commitSha || null,
      verifiedBy: req.body.verifiedBy ? String(req.body.verifiedBy) : userId,
      verificationMethod: req.body.verificationMethod || 'ai_ops_verified_route',
      payload: req.body.payload && typeof req.body.payload === 'object' ? req.body.payload : {},
    });
    return res.status(201).json({ success: true, acceptanceRun });
  })
);

router.post(
  '/incidents',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getAuthContext(req);
    const incident = await recordWave9Incident({
      organizationId,
      severity: req.body.severity || 'medium',
      title: String(req.body.title || 'AI Ops incident'),
      rollbackFlag: req.body.rollbackFlag || null,
      playbook:
        req.body.playbook && typeof req.body.playbook === 'object' ? req.body.playbook : undefined,
    });
    return res.status(201).json({ success: true, incident });
  })
);

router.get(
  '/aiops',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getAuthContext(req);
    const dashboard = await buildWave9AIOpsDashboard({ organizationId });
    return res.json({ success: true, dashboard });
  })
);

router.post(
  '/acceptance',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getAuthContext(req);
    const result = await runWave9FinalAcceptance({
      organizationId,
      userId,
      regressionPassed: req.body.regressionPassed === true,
      cisoPackPassed: req.body.cisoPackPassed === true,
      businessPersonaPackPassed: req.body.businessPersonaPackPassed === true,
      providerHealthOk: req.body.providerHealthOk === true,
      complianceAuditPassed: req.body.complianceAuditPassed === true,
      openP0: Number(req.body.openP0 || 0),
      openP1: Number(req.body.openP1 || 0),
      evidenceRefs:
        req.body.evidenceRefs && typeof req.body.evidenceRefs === 'object'
          ? req.body.evidenceRefs
          : {},
      acceptanceRunRefs:
        req.body.acceptanceRunRefs && typeof req.body.acceptanceRunRefs === 'object'
          ? req.body.acceptanceRunRefs
          : {},
      acceptedLimitations: Array.isArray(req.body.acceptedLimitations)
        ? req.body.acceptedLimitations.map(String)
        : [],
    });
    return res.status(result.decision === 'BLOCKED' ? 409 : 201).json({ success: true, ...result });
  })
);

export default router;
