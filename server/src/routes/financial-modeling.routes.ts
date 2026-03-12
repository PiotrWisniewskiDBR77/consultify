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

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import {
  addEvent,
  approveModel,
  computeModel,
  createModel,
  deleteEvent,
  getModel,
  getOutputs,
  getValidations,
  listEvents,
  listModels,
  persistComputeResult,
  updateEvent,
  updateModel,
} from '../services/financialModelingService.js';
import {
  getFinanceTraceId,
  logFinanceError,
  logFinanceEvent,
} from '../services/financeDiagnosticsService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { get as dbGet } from '../utils/DbPromise.js';
import { run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

// ════════════════════════════════════════════════
// Models CRUD
// ════════════════════════════════════════════════

router.post(
  '/models',
  verifyToken,
  isAuthenticated,
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
    } = req.body;
    if (!name || !startDate) return res.status(400).json({ error: 'name and startDate required' });

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
      });

      logFinanceEvent('model.create.completed', {
        traceId,
        modelId: id,
        organizationId: orgId,
        userId,
        name,
        seedType: sourceStatementId ? 'statement' : 'manual',
        sourceStatementId: sourceStatementId || null,
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
    const model = await getModel(modelId);
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
    const events = await listEvents(modelId);
    res.json({ ...model, events, source_statement: sourceStatement || null });
  })
);

router.put(
  '/models/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const modelId = String(req.params.id);
    const model = await getModel(modelId);
    if (!model) return res.status(404).json({ error: 'Model not found' });

    await updateModel(modelId, req.body);
    res.json({ success: true });
  })
);

router.delete(
  '/models/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const modelId = String(req.params.id);
    const model = await getModel(modelId);
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
    const model = await getModel(modelId);
    if (!model) return res.status(404).json({ error: 'Model not found' });
    const traceId = getFinanceTraceId((req as any).correlationId);

    logFinanceEvent('model.compute.started', {
      traceId,
      modelId,
      scenario: model.scenario,
      granularity: model.granularity,
      status: model.status,
      seedType: model.source_statement_id ? 'statement' : 'manual',
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
        seedType: model.source_statement_id ? 'statement' : 'manual',
        sourceStatementId: model.source_statement_id || null,
      });

      res.json({
        success: true,
        overallStatus: result.overallStatus,
        periodCount: result.periods.length,
        validationSummary,
      });
    } catch (e: any) {
      logFinanceError('model.compute.failed', e, { traceId, modelId });
      return res.status(500).json({ error: 'Computation failed', detail: e.message });
    }
  })
);

router.post(
  '/models/:id/submit-review',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const modelId = String(req.params.id);
    const model = await getModel(modelId);
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

    const result = await approveModel(String(req.params.id), userId);
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
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const modelId = String(req.params.id);
    const model = await getModel(modelId);
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
    if (!eventType || !name || amount === undefined || !periodStart || !cfClassification) {
      return res
        .status(400)
        .json({ error: 'eventType, name, amount, periodStart, cfClassification required' });
    }

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
    const events = await listEvents(String(req.params.id));
    res.json(events);
  })
);

router.put(
  '/events/:eventId',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await updateEvent(String(req.params.eventId), req.body);
    res.json({ success: true });
  })
);

router.delete(
  '/events/:eventId',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await deleteEvent(String(req.params.eventId));
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
    const scenario = req.query.scenario as string | undefined;
    const outputs = await getOutputs(String(req.params.id), scenario);

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
    const validations = await getValidations(String(req.params.id));
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
