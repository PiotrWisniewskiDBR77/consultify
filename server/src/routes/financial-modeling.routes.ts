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
import { verifyToken, isAuthenticated } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';
import {
  createModel, getModel, listModels, updateModel, approveModel,
  addEvent, updateEvent, deleteEvent, listEvents,
  computeModel, persistComputeResult,
  getOutputs, getValidations,
} from '../services/financialModelingService.js';
import { run as dbRun } from '../utils/DbPromise.js';

const router = Router();
interface AuthRequest extends Request { user?: { id: string; organizationId: string }; }

// ════════════════════════════════════════════════
// Models CRUD
// ════════════════════════════════════════════════

router.post('/models', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const orgId = req.user?.organizationId!;
  const userId = req.user?.id!;
  const { name, description, currency, horizonMonths, startDate, granularity, scenario, assumptions, projectId, initiativeId } = req.body;
  if (!name || !startDate) return res.status(400).json({ error: 'name and startDate required' });

  const id = await createModel({
    organizationId: orgId, projectId, initiativeId,
    name, description, currency, horizonMonths, startDate, granularity, scenario, assumptions,
    createdBy: userId,
  });

  logger.info(`[FinancialModeling] Model created: ${id} by ${userId}`);
  res.status(201).json({ success: true, id });
}));

router.get('/models', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const models = await listModels(req.user?.organizationId!);
  res.json(models);
}));

router.get('/models/:id', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const model = await getModel(req.params.id);
  if (!model) return res.status(404).json({ error: 'Model not found' });

  const events = await listEvents(req.params.id);
  res.json({ ...model, events });
}));

router.put('/models/:id', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const model = await getModel(req.params.id);
  if (!model) return res.status(404).json({ error: 'Model not found' });

  await updateModel(req.params.id, req.body);
  res.json({ success: true });
}));

router.delete('/models/:id', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const model = await getModel(req.params.id);
  if (!model) return res.status(404).json({ error: 'Model not found' });
  if (model.status === 'approved') return res.status(400).json({ error: 'Cannot delete approved model. Archive it instead.' });

  await dbRun(`DELETE FROM financial_model_outputs WHERE model_id = ?`, [req.params.id]);
  await dbRun(`DELETE FROM financial_model_validations WHERE model_id = ?`, [req.params.id]);
  await dbRun(`DELETE FROM financial_model_events WHERE model_id = ?`, [req.params.id]);
  await dbRun(`DELETE FROM financial_models WHERE id = ?`, [req.params.id]);

  res.json({ success: true, deleted: req.params.id });
}));

// ════════════════════════════════════════════════
// Compute & Workflow
// ════════════════════════════════════════════════

router.post('/models/:id/compute', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const model = await getModel(req.params.id);
  if (!model) return res.status(404).json({ error: 'Model not found' });

  try {
    const result = await computeModel(req.params.id);
    await persistComputeResult(req.params.id, result, model.scenario || 'base');

    res.json({
      success: true,
      overallStatus: result.overallStatus,
      periodCount: result.periods.length,
      validationSummary: {
        total: result.validations.length,
        pass: result.validations.filter(v => v.status === 'pass').length,
        fail: result.validations.filter(v => v.status === 'fail').length,
        warning: result.validations.filter(v => v.status === 'warning').length,
      },
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Computation failed', detail: e.message });
  }
}));

router.post('/models/:id/submit-review', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const model = await getModel(req.params.id);
  if (!model) return res.status(404).json({ error: 'Model not found' });
  if (model.status !== 'draft') return res.status(400).json({ error: 'Only draft models can be submitted for review' });

  await updateModel(req.params.id, { status: 'review' });
  res.json({ success: true, status: 'review' });
}));

router.post('/models/:id/approve', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await approveModel(req.params.id, req.user?.id!);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json({ success: true, status: 'approved' });
}));

// ════════════════════════════════════════════════
// Events CRUD
// ════════════════════════════════════════════════

router.post('/models/:id/events', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const model = await getModel(req.params.id);
  if (!model) return res.status(404).json({ error: 'Model not found' });

  const { eventType, name, description, amount, periodStart, periodEnd, recurrence, growthRate, cfClassification, postingRules, parameters, sortOrder } = req.body;
  if (!eventType || !name || amount === undefined || !periodStart || !cfClassification) {
    return res.status(400).json({ error: 'eventType, name, amount, periodStart, cfClassification required' });
  }

  const id = await addEvent({
    modelId: req.params.id, eventType, name, description, amount, periodStart, periodEnd,
    recurrence, growthRate, cfClassification, postingRules, parameters, sortOrder,
    createdBy: req.user?.id,
  });

  res.status(201).json({ success: true, id });
}));

router.get('/models/:id/events', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const events = await listEvents(req.params.id);
  res.json(events);
}));

router.put('/events/:eventId', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  await updateEvent(req.params.eventId, req.body);
  res.json({ success: true });
}));

router.delete('/events/:eventId', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  await deleteEvent(req.params.eventId);
  res.json({ success: true });
}));

// ════════════════════════════════════════════════
// Outputs & Validations
// ════════════════════════════════════════════════

router.get('/models/:id/outputs', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const scenario = req.query.scenario as string | undefined;
  const outputs = await getOutputs(req.params.id, scenario);

  // Group by period → statement type → lines
  const grouped: Record<string, Record<string, Array<{ lineCode: string; lineName: string; value: number }>>> = {};
  for (const row of outputs) {
    if (!grouped[row.period_label]) grouped[row.period_label] = {};
    if (!grouped[row.period_label][row.statement_type]) grouped[row.period_label][row.statement_type] = [];
    grouped[row.period_label][row.statement_type].push({
      lineCode: row.line_code, lineName: row.line_name, value: row.value,
    });
  }

  res.json({ raw: outputs, grouped });
}));

router.get('/models/:id/validations', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const validations = await getValidations(req.params.id);
  const summary = {
    total: validations.length,
    pass: validations.filter((v: any) => v.status === 'pass').length,
    fail: validations.filter((v: any) => v.status === 'fail').length,
    warning: validations.filter((v: any) => v.status === 'warning').length,
  };
  res.json({ validations, summary });
}));

export default router;
