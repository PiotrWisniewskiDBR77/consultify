/**
 * T054 — Financial Modeling Routes
 *
 * Endpoints:
 *   POST   /models                    — Create model
 *   GET    /models                    — List models for org
 *   GET    /models/:id                — Get model with events
 *   PUT    /models/:id                — Update model metadata/assumptions
 *   DELETE /models/:id                — Delete draft model
 *   POST   /models/:id/compute        — Compute outputs + validations
 *   POST   /models/:id/approve        — Approve model (requires passing validations)
 *   POST   /models/:id/submit-review  — Submit for review
 *   POST   /models/:id/refresh-source — Re-pull historical lines from bound source (S6.4d)
 *
 *   POST   /models/:id/events         — Add economic event
 *   PUT    /events/:eventId           — Update event
 *   DELETE /events/:eventId           — Delete event
 *   GET    /models/:id/events         — List events
 *
 *   GET    /models/:id/outputs        — Get computed outputs
 *   GET    /models/:id/validations    — Get validation results
 */

import { Request, Response, Router } from 'express';
import { z } from 'zod';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import {
  getFinanceTraceId,
  logFinanceError,
  logFinanceEvent,
} from '../services/financeDiagnosticsService.js';
import {
  addEvent,
  approveModel,
  computeModel,
  createModel,
  deleteEvent,
  getModel,
  getModelAssumptionsStatus,
  getOutputs,
  getValidations,
  listEvents,
  listModels,
  persistComputeResult,
  reseedModelFromSource,
  updateEvent,
  updateModel,
} from '../services/financialModelingService.js';
import { serializeRowPeriodFields } from '../services/financePeriodFormat.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { get as dbGet } from '../utils/DbPromise.js';
import { run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

// ════════════════════════════════════════════════
// Zod validation schemas (defense-in-depth — Wave 5 M16 hardening)
// Fields mirror exactly what the route handlers / financialModelingService
// consume. `.strict()` rejects unexpected/extra keys with 400.
// ════════════════════════════════════════════════

const EVENT_TYPES = [
  'revenue',
  'cogs',
  'opex',
  'capex_purchase',
  'depreciation_run',
  'debt_drawdown',
  'debt_repayment',
  'interest_accrual',
  'tax_accrual',
  'tax_payment',
  'wc_change',
  'equity_injection',
  'dividend',
] as const;

const CF_CLASSIFICATIONS = ['operating', 'investing', 'financing', 'none'] as const;

const RECURRENCES = ['one_time', 'monthly', 'quarterly', 'annual'] as const;

const GRANULARITIES = ['monthly', 'quarterly', 'annual'] as const;

const jsonRecordSchema = z.record(z.string(), z.unknown());

// Exported for the Health Panel model-grounding probe (asserts sourceStatementId
// stays an accepted field). See services/health/healthProbeService.ts.
export const createModelSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    startDate: z.string().trim().min(1).max(40),
    description: z.string().max(5000).nullish(),
    currency: z.string().trim().max(10).optional(),
    horizonMonths: z.number().int().positive().max(1200).optional(),
    granularity: z.enum(GRANULARITIES).optional(),
    scenario: z.string().trim().max(40).optional(),
    assumptions: jsonRecordSchema.optional(),
    projectId: z.string().max(64).nullish(),
    initiativeId: z.string().max(64).nullish(),
    sourceStatementId: z.string().max(64).nullish(),
    sourceStatementPackId: z.string().max(64).nullish(),
  })
  .strict();

// updateModel() allowlists these columns; assumptions handled separately.
const updateModelSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(5000).nullish(),
    currency: z.string().trim().max(10).optional(),
    horizon_months: z.number().int().positive().max(1200).optional(),
    start_date: z.string().trim().min(1).max(40).optional(),
    granularity: z.enum(GRANULARITIES).optional(),
    scenario: z.string().trim().max(40).optional(),
    // Approval-state guard: `approved` is reachable ONLY via POST /:id/approve
    // (recompute + validation gate + snapshot + approver + version bump). A
    // metadata update must not forge it. draft↔review self-service transitions
    // stay open; the service layer (updateModel) drops `approved` defensively too.
    status: z.enum(['draft', 'review']).optional(),
    assumptions: jsonRecordSchema.optional(),
  })
  .strict();

const createEventSchema = z
  .object({
    eventType: z.enum(EVENT_TYPES),
    name: z.string().trim().min(1).max(200),
    amount: z.number(),
    periodStart: z.string().trim().min(1).max(40),
    cfClassification: z.enum(CF_CLASSIFICATIONS),
    description: z.string().max(5000).nullish(),
    periodEnd: z.string().trim().max(40).nullish(),
    recurrence: z.enum(RECURRENCES).optional(),
    growthRate: z.number().optional(),
    postingRules: jsonRecordSchema.optional(),
    parameters: jsonRecordSchema.optional(),
    sortOrder: z.number().int().optional(),
  })
  .strict();

// updateEvent() allowlists these columns; posting_rules/parameters separate.
const updateEventSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(5000).nullish(),
    amount: z.number().optional(),
    period_start: z.string().trim().min(1).max(40).optional(),
    period_end: z.string().trim().max(40).nullish(),
    recurrence: z.enum(RECURRENCES).optional(),
    growth_rate: z.number().optional(),
    cf_classification: z.enum(CF_CLASSIFICATIONS).optional(),
    sort_order: z.number().int().optional(),
    is_active: z.union([z.boolean(), z.number().int()]).optional(),
    event_type: z.enum(EVENT_TYPES).optional(),
    posting_rules: jsonRecordSchema.optional(),
    parameters: jsonRecordSchema.optional(),
  })
  .strict();

// ════════════════════════════════════════════════
// Models CRUD
// ════════════════════════════════════════════════

router.post(
  '/models',
  verifyToken,
  isAuthenticated,
  validateBody(createModelSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });
    const traceId = getFinanceTraceId((req as any).correlationId);
    const {
      name,
      description,
      currency,
      horizonMonths,
      startDate,
      granularity,
      scenario,
      assumptions,
      projectId,
      initiativeId,
      sourceStatementId,
      sourceStatementPackId,
    } = req.body;

    logFinanceEvent('model.create.started', {
      traceId,
      organizationId: orgId,
      userId,
      name,
      currency,
      horizonMonths,
      startDate,
      granularity,
      scenario,
      projectId,
      initiativeId,
      sourceStatementId,
      sourceStatementPackId,
    });

    try {
      const id = await createModel({
        organizationId: orgId,
        projectId,
        initiativeId,
        name,
        description,
        currency,
        horizonMonths,
        startDate,
        granularity,
        scenario,
        assumptions,
        createdBy: userId,
        sourceStatementId,
        sourceStatementPackId,
      });

      logFinanceEvent('model.create.completed', {
        traceId,
        modelId: id,
        organizationId: orgId,
        userId,
        name,
        seedType: sourceStatementPackId
          ? 'statement_pack'
          : sourceStatementId
            ? 'statement'
            : 'manual',
        sourceStatementId: sourceStatementId || null,
        sourceStatementPackId: sourceStatementPackId || null,
      });

      logger.info(`[FinancialModeling] Model created: ${id} by ${userId}`);
      res.status(201).json({ success: true, id });
    } catch (e: any) {
      logFinanceError('model.create.failed', e, {
        traceId,
        organizationId: orgId,
        userId,
        name,
      });
      const message = String(e?.message || 'Model creation failed');
      // Cross-org FK / missing-seed references → 404 (the referenced
      // project/initiative/statement is not visible to the caller's org).
      if (/not found/i.test(message)) {
        return res.status(404).json({ error: message });
      }
      if (
        message.includes('Statement') ||
        message.includes('critical lines') ||
        message.includes('seed')
      ) {
        return res.status(400).json({ error: message });
      }
      throw e;
    }
  })
);

router.get(
  '/models',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const models = await listModels(orgId);
    res.json(models);
  })
);

router.get(
  '/models/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const modelId = String(req.params.id);
    const model = await getModel(modelId, req.user?.organizationId);
    if (!model) return res.status(404).json({ error: 'Model not found' });

    const sourceStatement =
      model.source_statement_id != null
        ? await (async () => {
            try {
              return await dbGet(
                `SELECT id, statement_type, period_start, period_end, period_label, currency, scaling, source_file_name, status, readiness_status
                 FROM financial_statements
                 WHERE id = ?`,
                [model.source_statement_id]
              );
            } catch {
              return dbGet(
                `SELECT id, statement_type, period_start, period_end, period_label, currency, scaling, source_file_name, status
                 FROM financial_statements
                 WHERE id = ?`,
                [model.source_statement_id]
              );
            }
          })()
        : null;
    const sourceStatementPack =
      model.source_statement_pack_id != null
        ? await dbGet(
            `SELECT id, entity_name, period_start, period_end, period_label, currency, scaling,
                    pack_status, pack_readiness_status, pack_readiness_score
             FROM financial_statement_packs
             WHERE id = ?`,
            [model.source_statement_pack_id]
          )
        : null;
    const events = await listEvents(modelId);
    res.json({
      ...model,
      events,
      // FIN-005: same Date leak as the v8 model-detail route — see there.
      source_statement: sourceStatement ? serializeRowPeriodFields(sourceStatement) : null,
      source_statement_pack: sourceStatementPack
        ? serializeRowPeriodFields(sourceStatementPack)
        : null,
    });
  })
);

/**
 * GET /api/financial-modeling/models/:id/assumptions-status
 * #82f — jawny status założeń modelu (assumptionsRegistry / Z114): dla driverów
 * baseline P&L + otwarcia bilansu — czy „imported" (z pakietu/sprawozdania), „ai_assumed"
 * (domyślne, do przeglądu) czy „missing". Read-only, nic nie przelicza. Fail-soft:
 * błąd silnika → { available:false }, nie 500 (read endpoint, wzorzec report-section/lineage).
 */
router.get(
  '/models/:id/assumptions-status',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const modelId = String(req.params.id);
    try {
      const result = await getModelAssumptionsStatus(modelId, req.user?.organizationId);
      if (!result) return res.status(404).json({ error: 'Model not found' });
      res.json(result);
    } catch (e: any) {
      logger.warn(
        `[FinancialModeling] assumptions-status degraded to unavailable for model ${modelId}: ${e?.message || e}`
      );
      res.json({
        modelId,
        available: false,
        isGrounded: false,
        seedSource: null,
        assumptions: [],
        coverage: null,
      });
    }
  })
);

router.put(
  '/models/:id',
  verifyToken,
  isAuthenticated,
  validateBody(updateModelSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const modelId = String(req.params.id);
    const model = await getModel(modelId, req.user?.organizationId);
    if (!model) return res.status(404).json({ error: 'Model not found' });

    await updateModel(modelId, req.body);
    res.json({ success: true });
  })
);

// S6.4d — Refresh a grounded model's assumptions from its bound source
// statement / pack (re-pull historical lines). No body.
router.post(
  '/models/:id/refresh-source',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });
    const modelId = String(req.params.id);
    const traceId = getFinanceTraceId((req as any).correlationId);

    try {
      const result = await reseedModelFromSource(modelId, orgId);
      logFinanceEvent('model.refreshSource.completed', {
        traceId,
        modelId,
        organizationId: orgId,
        userId,
        seededFrom: result.seededFrom,
      });
      res.json({ success: true, ...result });
    } catch (e: any) {
      logFinanceError('model.refreshSource.failed', e, {
        traceId,
        modelId,
        organizationId: orgId,
        userId,
      });
      const message = String(e?.message || 'Refresh from source failed');
      if (/not found/i.test(message)) {
        return res.status(404).json({ error: message });
      }
      if (
        message.includes('no source') ||
        message.includes('approved') ||
        message.includes('critical lines') ||
        message.includes('statement-ready')
      ) {
        return res.status(400).json({ error: message });
      }
      throw e;
    }
  })
);

router.delete(
  '/models/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const modelId = String(req.params.id);
    const model = await getModel(modelId, req.user?.organizationId);
    if (!model) return res.status(404).json({ error: 'Model not found' });
    if (model.status === 'approved')
      return res.status(400).json({ error: 'Cannot delete approved model. Archive it instead.' });

    await dbRun(`DELETE FROM financial_model_outputs WHERE model_id = ?`, [modelId]);
    await dbRun(`DELETE FROM financial_model_validations WHERE model_id = ?`, [modelId]);
    await dbRun(`DELETE FROM financial_model_events WHERE model_id = ?`, [modelId]);
    await dbRun(`DELETE FROM financial_models WHERE id = ?`, [modelId]);

    res.json({ success: true, deleted: modelId });
  })
);

// ════════════════════════════════════════════════
// Compute & Workflow
// ════════════════════════════════════════════════

router.post(
  '/models/:id/compute',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const modelId = String(req.params.id);
    const model = await getModel(modelId, req.user?.organizationId);
    if (!model) return res.status(404).json({ error: 'Model not found' });
    const traceId = getFinanceTraceId((req as any).correlationId);

    logFinanceEvent('model.compute.started', {
      traceId,
      modelId,
      scenario: model.scenario,
      granularity: model.granularity,
      status: model.status,
      seedType: model.source_statement_pack_id
        ? 'statement_pack'
        : model.source_statement_id
          ? 'statement'
          : 'manual',
    });

    try {
      const result = await computeModel(modelId);
      await persistComputeResult(modelId, result, model.scenario || 'base');
      const validationSummary = {
        total: result.validations.length,
        pass: result.validations.filter((v) => v.status === 'pass').length,
        fail: result.validations.filter((v) => v.status === 'fail').length,
        warning: result.validations.filter((v) => v.status === 'warning').length,
      };

      logFinanceEvent('model.compute.completed', {
        traceId,
        modelId,
        overallStatus: result.overallStatus,
        periodCount: result.periods.length,
        validationSummary,
        seedType: model.source_statement_pack_id
          ? 'statement_pack'
          : model.source_statement_id
            ? 'statement'
            : 'manual',
        sourceStatementId: model.source_statement_id || null,
        sourceStatementPackId: model.source_statement_pack_id || null,
      });

      res.json({
        success: true,
        overallStatus: result.overallStatus,
        periodCount: result.periods.length,
        validationSummary,
      });
    } catch (e: any) {
      logFinanceError('model.compute.failed', e, { traceId, modelId });
      // H6.4 500-leak sweep: `e.message` can carry DB-driver text or internal
      // structure — never echo it to the client. The failure is already
      // logged server-side above with `traceId` for correlation.
      return res.status(500).json({
        error: 'Computation failed',
        code: 'FINANCE_MODEL_COMPUTE_FAILED',
        traceId,
      });
    }
  })
);

router.post(
  '/models/:id/submit-review',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const modelId = String(req.params.id);
    const model = await getModel(modelId, req.user?.organizationId);
    if (!model) return res.status(404).json({ error: 'Model not found' });
    if (model.status !== 'draft')
      return res.status(400).json({ error: 'Only draft models can be submitted for review' });

    await updateModel(modelId, { status: 'review' });
    res.json({ success: true, status: 'review' });
  })
);

router.post(
  '/models/:id/approve',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const modelId = String(req.params.id);
    const model = await getModel(modelId, req.user?.organizationId);
    if (!model) return res.status(404).json({ error: 'Model not found' });

    const result = await approveModel(modelId, userId);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true, status: 'approved' });
  })
);

// ════════════════════════════════════════════════
// Events CRUD
// ════════════════════════════════════════════════

router.post(
  '/models/:id/events',
  verifyToken,
  isAuthenticated,
  validateBody(createEventSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const modelId = String(req.params.id);
    const model = await getModel(modelId, req.user?.organizationId);
    if (!model) return res.status(404).json({ error: 'Model not found' });
    const traceId = getFinanceTraceId((req as any).correlationId);

    const {
      eventType,
      name,
      description,
      amount,
      periodStart,
      periodEnd,
      recurrence,
      growthRate,
      cfClassification,
      postingRules,
      parameters,
      sortOrder,
    } = req.body;

    logFinanceEvent('model.event.create.started', {
      traceId,
      modelId,
      eventType,
      name,
      amount,
      periodStart,
      periodEnd,
      recurrence,
      growthRate,
      cfClassification,
    });

    const id = await addEvent({
      modelId,
      eventType,
      name,
      description,
      amount,
      periodStart,
      periodEnd,
      recurrence,
      growthRate,
      cfClassification,
      postingRules,
      parameters,
      sortOrder,
      createdBy: req.user?.id,
    });

    logFinanceEvent('model.event.create.completed', {
      traceId,
      modelId,
      eventId: id,
      eventType,
      name,
    });

    res.status(201).json({ success: true, id });
  })
);

router.get(
  '/models/:id/events',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const modelId = String(req.params.id);
    const model = await getModel(modelId, req.user?.organizationId);
    if (!model) return res.status(404).json({ error: 'Model not found' });
    const events = await listEvents(modelId);
    res.json(events);
  })
);

router.put(
  '/events/:eventId',
  verifyToken,
  isAuthenticated,
  validateBody(updateEventSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const eventId = String(req.params.eventId);
    const owned = await dbGet(
      `SELECT e.id
       FROM financial_model_events e
       INNER JOIN financial_models m ON m.id = e.model_id
       WHERE e.id = ? AND m.organization_id = ?`,
      [eventId, req.user?.organizationId]
    );
    if (!owned) return res.status(404).json({ error: 'Event not found' });
    await updateEvent(eventId, req.body);
    res.json({ success: true });
  })
);

router.delete(
  '/events/:eventId',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const eventId = String(req.params.eventId);
    const owned = await dbGet(
      `SELECT e.id
       FROM financial_model_events e
       INNER JOIN financial_models m ON m.id = e.model_id
       WHERE e.id = ? AND m.organization_id = ?`,
      [eventId, req.user?.organizationId]
    );
    if (!owned) return res.status(404).json({ error: 'Event not found' });
    await deleteEvent(eventId);
    res.json({ success: true });
  })
);

// ════════════════════════════════════════════════
// Outputs & Validations
// ════════════════════════════════════════════════

router.get(
  '/models/:id/outputs',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const modelId = String(req.params.id);
    const model = await getModel(modelId, req.user?.organizationId);
    if (!model) return res.status(404).json({ error: 'Model not found' });
    const scenario = req.query.scenario as string | undefined;
    const outputs = await getOutputs(modelId, scenario);

    // Group by period → statement type → lines
    const grouped: Record<
      string,
      Record<string, Array<{ lineCode: string; lineName: string; value: number }>>
    > = {};
    for (const row of outputs) {
      if (!grouped[row.period_label]) grouped[row.period_label] = {};
      if (!grouped[row.period_label][row.statement_type])
        grouped[row.period_label][row.statement_type] = [];
      grouped[row.period_label][row.statement_type].push({
        lineCode: row.line_code,
        lineName: row.line_name,
        value: row.value,
      });
    }

    res.json({ raw: outputs, grouped });
  })
);

router.get(
  '/models/:id/validations',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const modelId = String(req.params.id);
    const model = await getModel(modelId, req.user?.organizationId);
    if (!model) return res.status(404).json({ error: 'Model not found' });
    const validations = await getValidations(modelId);
    const summary = {
      total: validations.length,
      pass: validations.filter((v: any) => v.status === 'pass').length,
      fail: validations.filter((v: any) => v.status === 'fail').length,
      warning: validations.filter((v: any) => v.status === 'warning').length,
    };
    res.json({ validations, summary });
  })
);

export default router;
