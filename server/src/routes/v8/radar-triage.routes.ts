/**
 * P06-B: Radar Triage Cockpit routes
 * Namespace: /api/v8/radar-triage
 */

import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

/** §2.3.8 — documented HTTP surface for Radar Triage clients (contract checklist). */
export const P06_RADAR_TRIAGE_HTTP_STATUSES = [
  200, 206, 400, 401, 403, 409, 412, 429, 503, 504,
] as const;

function triageMeta() {
  return { version: 'v8' as const, contract: 'radar_triage_v1' };
}

router.get(
  '/signals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { getTriageSignals } = await import('../../services/v8/radarTriageService.js');
    const filters: Record<string, string> = {};
    if (req.query.category) filters.category = String(req.query.category);
    if (req.query.priorityLevel) filters.priorityLevel = String(req.query.priorityLevel);
    if (req.query.triageState) filters.triageState = String(req.query.triageState);
    const signals = await getTriageSignals(organizationId, filters as any);
    return res.json({ data: signals, meta: triageMeta() });
  })
);

router.post(
  '/signals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { category, bands, whyNow, evidence, uncertaintyBoundary, handoffPayload } =
      req.body || {};
    if (!category || !bands || !whyNow || !evidence) {
      return res.status(400).json({
        error: 'category, bands, whyNow, evidence required',
        code: 'P06_SIGNAL_PARAMS_REQUIRED',
      });
    }
    const { createTriageSignal } = await import('../../services/v8/radarTriageService.js');
    const signal = await createTriageSignal({
      organizationId,
      category,
      bands,
      whyNow,
      evidence,
      uncertaintyBoundary,
      handoffPayload,
    });
    return res.json({ data: signal, meta: triageMeta() });
  })
);

router.get(
  '/signals/:signalId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const signalId = req.params.signalId?.trim();
    if (!signalId)
      return res.status(400).json({ error: 'signalId required', code: 'P06_SIGNAL_ID_REQUIRED' });
    const { getTriageSignal } = await import('../../services/v8/radarTriageService.js');
    const signal = await getTriageSignal(signalId, organizationId);
    if (!signal)
      return res.status(404).json({ error: 'Signal not found', code: 'P06_SIGNAL_NOT_FOUND' });
    return res.json({ data: signal, meta: triageMeta() });
  })
);

router.post(
  '/signals/:signalId/handoff',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const signalId = req.params.signalId?.trim();
    if (!signalId)
      return res.status(400).json({ error: 'signalId required', code: 'P06_SIGNAL_ID_REQUIRED' });
    const { executeHandoff } = await import('../../services/v8/radarTriageService.js');
    const result = await executeHandoff(signalId, organizationId);
    return res.json({ data: result, meta: triageMeta() });
  })
);

export default router;
