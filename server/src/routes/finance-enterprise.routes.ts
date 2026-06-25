/**
 * Finance Enterprise Routes (V4-FINC-01 through V4-FINC-07)
 *
 * Model versioning/scenarios, multi-dim planning, rolling forecast,
 * connectors, valuation audit, AI assumptions, ROI links.
 *
 * Base financial modeling CRUD remains in financial-modeling.routes.ts.
 */

import { type Response, Router } from 'express';
import { z } from 'zod';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { financeEnterpriseService } from '../services/financeEnterpriseService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(verifyToken);

const requireUser = (req: AuthRequest, res: Response): { userId: string; orgId: string } | null => {
  const userId = req.user?.id || req.userId;
  // SECURITY (RESPONSE-LEAK / AUTH-COVERAGE sweep — M16 Finance): the org MUST come
  // ONLY from the auth-middleware-validated context (req.user.organizationId /
  // req.organizationId). This previously fell back to the raw `x-organization-id`
  // header / `?organizationId` query param when both were empty. That fallback was
  // unvalidated: verifyToken admits a token with no resolvable ACTIVE org
  // (req.organizationId === ''), at which point an attacker could assert ANY org id
  // via the header/query and financeEnterpriseService would faithfully filter every
  // read/write by that asserted victim org — a cross-org data exposure. Service-layer
  // re-filtering does NOT help when the filter value is attacker-controlled. Trust only
  // the validated context; verifyToken already promotes a legitimate UI-selected
  // `x-organization-id` (membership-checked) into req.organizationId.
  const orgId = req.user?.organizationId || req.organizationId;
  if (!userId || !orgId) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return { userId, orgId };
};

// ============================================================
// V4-FINC-01: Model versioning + scenarios
// ============================================================

router.post(
  '/models/:modelId/versions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const schema = z.object({
      scenarioLabel: z.string().max(100).optional(),
      parentVersionId: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const version = await financeEnterpriseService.createModelVersion(
      identity.orgId,
      identity.userId,
      { modelId: req.params.modelId, ...parsed.data }
    );
    res.status(201).json(version);
  })
);

router.get(
  '/models/:modelId/versions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const versions = await financeEnterpriseService.getModelVersions(
      identity.orgId,
      req.params.modelId
    );
    res.json({ versions });
  })
);

router.get(
  '/versions/:fromId/compare/:toId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const result = await financeEnterpriseService.compareVersions(
      identity.orgId,
      req.params.fromId,
      req.params.toId
    );
    if (!result) {
      res.status(404).json({ error: 'Version not found' });
      return;
    }
    res.json(result);
  })
);

router.post(
  '/versions/:versionId/merge',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const ok = await financeEnterpriseService.mergeVersion(
      identity.orgId,
      req.params.versionId,
      identity.userId
    );
    if (!ok) {
      res.status(404).json({ error: 'Version not found' });
      return;
    }
    res.json({ ok: true });
  })
);

// ============================================================
// V4-FINC-02: Dimensions + allocations + consolidation
// ============================================================

router.post(
  '/dimensions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const schema = z.object({
      dimensionName: z.string().min(1).max(200),
      dimensionType: z.string().max(50).optional(),
      hierarchy: z.array(z.unknown()).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const dim = await financeEnterpriseService.createDimension(identity.orgId, parsed.data);
    res.status(201).json(dim);
  })
);

router.get(
  '/dimensions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const dimensions = await financeEnterpriseService.getDimensions(identity.orgId);
    res.json({ dimensions });
  })
);

router.post(
  '/models/:modelId/allocations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const schema = z.object({
      sourceDimensionId: z.string().optional(),
      targetDimensionId: z.string().optional(),
      allocationMethod: z.string().optional(),
      allocationRules: z.record(z.string(), z.unknown()).optional(),
      amount: z.number().optional(),
      period: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const alloc = await financeEnterpriseService.createAllocation(identity.orgId, {
        modelId: req.params.modelId,
        ...parsed.data,
      });
      res.status(201).json(alloc);
    } catch (error: any) {
      // SEC: foreign-org (or missing) modelId is rejected by the service → 404.
      if (String(error?.message || '').includes('not found')) {
        res.status(404).json({ error: 'Model not found' });
        return;
      }
      throw error;
    }
  })
);

router.get(
  '/models/:modelId/allocations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const allocations = await financeEnterpriseService.getAllocations(
      identity.orgId,
      req.params.modelId
    );
    res.json({ allocations });
  })
);

router.post(
  '/consolidations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const schema = z.object({
      name: z.string().min(1).max(200),
      sourceModelIds: z.array(z.string()),
      consolidationRules: z.record(z.string(), z.unknown()).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const cons = await financeEnterpriseService.createConsolidation(
        identity.orgId,
        identity.userId,
        parsed.data
      );
      res.status(201).json(cons);
    } catch (error: any) {
      // SEC: any foreign-org (or missing) id in sourceModelIds is rejected by the service → 404.
      if (String(error?.message || '').includes('not found')) {
        res.status(404).json({ error: 'Model not found' });
        return;
      }
      throw error;
    }
  })
);

router.get(
  '/consolidations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const consolidations = await financeEnterpriseService.getConsolidations(identity.orgId);
    res.json({ consolidations });
  })
);

// ============================================================
// V4-FINC-03: Budget + forecast + variance
// ============================================================

router.post(
  '/models/:modelId/budgets',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const schema = z.object({
      budgetType: z.string().optional(),
      fiscalYear: z.number().int(),
      versionLabel: z.string().optional(),
      plannedData: z.record(z.string(), z.unknown()),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const budget = await financeEnterpriseService.createBudgetVersion(
        identity.orgId,
        identity.userId,
        { modelId: req.params.modelId, ...parsed.data }
      );
      res.status(201).json(budget);
    } catch (error: any) {
      // SEC: foreign-org (or missing) modelId is rejected by the service → 404.
      if (String(error?.message || '').includes('not found')) {
        res.status(404).json({ error: 'Model not found' });
        return;
      }
      throw error;
    }
  })
);

router.get(
  '/models/:modelId/budgets',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const budgets = await financeEnterpriseService.getBudgetVersions(
      identity.orgId,
      req.params.modelId
    );
    res.json({ budgets });
  })
);

router.post(
  '/budgets/:budgetId/actuals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const schema = z.object({ actualData: z.record(z.string(), z.unknown()) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const ok = await financeEnterpriseService.updateBudgetActuals(
      identity.orgId,
      req.params.budgetId,
      parsed.data.actualData as Record<string, unknown>
    );
    if (!ok) {
      res.status(404).json({ error: 'Budget not found' });
      return;
    }
    res.json({ ok: true });
  })
);

router.post(
  '/budgets/:budgetId/approve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const result = await financeEnterpriseService.approveBudget(
      identity.orgId,
      req.params.budgetId,
      identity.userId
    );
    if (!result) {
      res.status(404).json({ error: 'Budget not found' });
      return;
    }
    res.json({ ok: true, id: result.id, status: result.status });
  })
);

router.post(
  '/models/:modelId/forecast-cycles',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const schema = z.object({
      cycleName: z.string().min(1).max(200),
      cycleType: z.string().optional(),
      forecastHorizonMonths: z.number().int().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const cycle = await financeEnterpriseService.createForecastCycle(identity.orgId, {
        modelId: req.params.modelId,
        ...parsed.data,
      });
      res.status(201).json(cycle);
    } catch (error: any) {
      // SEC: foreign-org (or missing) modelId is rejected by the service → 404.
      if (String(error?.message || '').includes('not found')) {
        res.status(404).json({ error: 'Model not found' });
        return;
      }
      throw error;
    }
  })
);

router.get(
  '/budgets/:budgetId/variance-alerts',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const alerts = await financeEnterpriseService.getVarianceAlerts(
      identity.orgId,
      req.params.budgetId
    );
    res.json({ alerts });
  })
);

// ============================================================
// V4-FINC-04: Connectors + sync
// ============================================================

router.post(
  '/connectors',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const schema = z.object({
      connectorType: z.enum(['excel', 'erp_sap', 'erp_oracle', 'csv', 'api']),
      name: z.string().min(1).max(200),
      config: z.record(z.string(), z.unknown()),
      syncDirection: z.enum(['import', 'export', 'bidirectional']).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const connector = await financeEnterpriseService.createConnector(
      identity.orgId,
      identity.userId,
      parsed.data
    );
    res.status(201).json(connector);
  })
);

router.get(
  '/connectors',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const connectors = await financeEnterpriseService.getConnectors(identity.orgId);
    res.json({ connectors });
  })
);

router.post(
  '/connectors/:connectorId/sync-log',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const schema = z.object({
      syncType: z.string(),
      recordsProcessed: z.number().int(),
      recordsCreated: z.number().int(),
      recordsUpdated: z.number().int(),
      recordsErrors: z.number().int(),
      errorDetails: z.array(z.unknown()).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const log = await financeEnterpriseService.logSync(
      identity.orgId,
      req.params.connectorId,
      parsed.data
    );
    res.status(201).json(log);
  })
);

router.get(
  '/connectors/:connectorId/sync-log',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 100) : 20;
    const logs = await financeEnterpriseService.getSyncLog(
      identity.orgId,
      req.params.connectorId,
      limit
    );
    res.json({ logs });
  })
);

// ============================================================
// V4-FINC-05: Valuation snapshots + audit
// ============================================================

router.post(
  '/models/:modelId/valuations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const schema = z.object({
      valuationMethod: z.enum(['dcf', 'comparables', 'asset_based', 'custom']).optional(),
      inputs: z.record(z.string(), z.unknown()),
      outputs: z.record(z.string(), z.unknown()),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const snapshot = await financeEnterpriseService.createValuationSnapshot(
        identity.orgId,
        identity.userId,
        { modelId: req.params.modelId, ...parsed.data }
      );
      res.status(201).json(snapshot);
    } catch (error: any) {
      // SEC: foreign-org (or missing) modelId is rejected by the service → 404.
      if (String(error?.message || '').includes('not found')) {
        res.status(404).json({ error: 'Model not found' });
        return;
      }
      throw error;
    }
  })
);

router.get(
  '/models/:modelId/valuations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const snapshots = await financeEnterpriseService.getValuationSnapshots(
      identity.orgId,
      req.params.modelId
    );
    res.json({ snapshots });
  })
);

router.get(
  '/valuations/:snapshotId/audit',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const audit = await financeEnterpriseService.getValuationAudit(
      identity.orgId,
      req.params.snapshotId
    );
    res.json({ audit });
  })
);

// ============================================================
// V4-FINC-06: AI assumptions
// ============================================================

router.post(
  '/models/:modelId/ai-assumptions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const schema = z.object({
      assumptionKey: z.string().min(1).max(200),
      assumptionValue: z.string(),
      confidence: z.number().min(0).max(1).optional(),
      sourceCitations: z.array(z.unknown()).optional(),
      aiModelUsed: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const assumption = await financeEnterpriseService.createAIAssumption(identity.orgId, {
        modelId: req.params.modelId,
        ...parsed.data,
      });
      res.status(201).json(assumption);
    } catch (error: any) {
      // SEC: foreign-org (or missing) modelId is rejected by the service → 404.
      if (String(error?.message || '').includes('not found')) {
        res.status(404).json({ error: 'Model not found' });
        return;
      }
      throw error;
    }
  })
);

router.get(
  '/models/:modelId/ai-assumptions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const assumptions = await financeEnterpriseService.getAIAssumptions(
      identity.orgId,
      req.params.modelId
    );
    res.json({ assumptions });
  })
);

router.post(
  '/ai-assumptions/:assumptionId/accept',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const ok = await financeEnterpriseService.acceptAIAssumption(
      identity.orgId,
      req.params.assumptionId,
      identity.userId
    );
    if (!ok) {
      res.status(404).json({ error: 'Assumption not found' });
      return;
    }
    res.json({ ok: true });
  })
);

// ============================================================
// V4-FINC-07: ROI links
// ============================================================

router.post(
  '/models/:modelId/roi-links',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const schema = z.object({
      initiativeId: z.string().optional(),
      benefitId: z.string().optional(),
      assumptionIds: z.array(z.string()).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const link = await financeEnterpriseService.createROILink(identity.orgId, {
        modelId: req.params.modelId,
        ...parsed.data,
      });
      res.status(201).json(link);
    } catch (error: any) {
      // SEC: foreign-org (or missing) modelId is rejected by the service → 404.
      if (String(error?.message || '').includes('not found')) {
        res.status(404).json({ error: 'Model not found' });
        return;
      }
      throw error;
    }
  })
);

router.get(
  '/models/:modelId/roi-links',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const links = await financeEnterpriseService.getROILinks(identity.orgId, req.params.modelId);
    res.json({ links });
  })
);

router.post(
  '/roi-links/:linkId/realize',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const schema = z.object({ realizedValue: z.number(), evidence: z.array(z.unknown()) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const ok = await financeEnterpriseService.captureRealizedValue(
      identity.orgId,
      req.params.linkId,
      parsed.data
    );
    if (!ok) {
      res.status(404).json({ error: 'ROI link not found' });
      return;
    }
    res.json({ ok: true });
  })
);

export default router;
