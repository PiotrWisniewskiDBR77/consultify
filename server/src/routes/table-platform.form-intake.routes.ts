/**
 * Table Platform — Form Intake (Admin) Routes (Block D · EPIC-T14 · Sprint D-S2)
 *
 * Authenticated, organization-scoped endpoints for managing the JWT intake
 * surface of a form. Public submission endpoints live in
 * `table-platform.form-public.routes.ts`.
 *
 * Mount: app.use('/api/table-platform', tablePlatformFormIntakeRoutes)
 *
 * All endpoints require auth + organization context, gated by
 * `ENABLE_TABLE_FORM_INTAKE_JWT`.
 *
 *   GET  /forms/:formId/intake
 *     Returns the intake context (target table, allow-list, expiry).
 *
 *   POST /forms/:formId/intake/jwt
 *     Body: { subject, expiresInSeconds?, hardExpiresAt? }
 *     Issues a JWT link for the recipient.
 *
 *   PUT  /forms/:formId/intake/allow-list
 *     Body: { allowList: string[] | null }
 *     Updates the field allow-list. NULL falls back to form.config.fields.
 */

import { type NextFunction, type Request, type Response, Router } from 'express';

import { featureFlags } from '../config/FeatureFlags.js';
import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import formIntakeService, { FormIntakeError } from '../services/tablePlatform/FormIntakeService.js';
import logger from '../utils/Logger.js';
import { mapAppErrorResponse } from '../middleware/appErrorMapper.js';

const router = Router();

router.use(verifyToken as any);

router.use((req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  if (!authReq.user || !authReq.userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (!authReq.organizationId) {
    res.status(403).json({ error: 'Organization context required' });
    return;
  }
  next();
});

function requireIntakeEnabled(req: Request, res: Response, next: NextFunction) {
  const flag = (featureFlags as unknown as Record<string, boolean | undefined>)
    .ENABLE_TABLE_FORM_INTAKE_JWT;
  if (flag !== true) {
    res.status(404).json({ error: 'Form intake is not enabled', code: 'FORM_INTAKE_DISABLED' });
    return;
  }
  next();
}

function mapServiceError(e: unknown, res: Response): boolean {
  if (e instanceof FormIntakeError) {
    res.status(e.status).json({ ...mapAppErrorResponse(e, undefined, 'error'), code: e.code });
    return true;
  }
  return false;
}

router.get('/forms/:formId/intake', requireIntakeEnabled, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const formId = String(req.params.formId ?? '');
  const orgId = String(authReq.organizationId ?? '');
  if (!formId) return res.status(400).json({ error: 'formId is required' });
  try {
    const ctx = await formIntakeService.getFormForAdmin(formId, orgId);
    return res.status(200).json({ data: ctx });
  } catch (e) {
    if (mapServiceError(e, res)) return;
    logger.error('[FormIntakeRoutes] get failed', {
      formId,
      error: (e as Error)?.message,
    });
    return res.status(500).json({ error: 'Internal error' });
  }
});

router.post(
  '/forms/:formId/intake/jwt',
  requireIntakeEnabled,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const formId = String(req.params.formId ?? '');
    const orgId = String(authReq.organizationId ?? '');
    if (!formId) return res.status(400).json({ error: 'formId is required' });
    const body = (req.body ?? {}) as Record<string, unknown>;
    const subject = typeof body.subject === 'string' ? body.subject : '';
    const expiresInSeconds =
      typeof body.expiresInSeconds === 'number' ? body.expiresInSeconds : undefined;
    const hardExpiresAt = typeof body.hardExpiresAt === 'string' ? body.hardExpiresAt : undefined;

    try {
      const issued = await formIntakeService.issueJwtLink({
        formId,
        organizationId: orgId,
        subject,
        expiresInSeconds,
        hardExpiresAt,
      });
      return res.status(201).json({ data: issued });
    } catch (e) {
      if (mapServiceError(e, res)) return;
      logger.error('[FormIntakeRoutes] issueJwt failed', {
        formId,
        error: (e as Error)?.message,
      });
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

router.put(
  '/forms/:formId/intake/allow-list',
  requireIntakeEnabled,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const formId = String(req.params.formId ?? '');
    const orgId = String(authReq.organizationId ?? '');
    if (!formId) return res.status(400).json({ error: 'formId is required' });
    const body = (req.body ?? {}) as Record<string, unknown>;
    const raw = body.allowList;
    let allowList: string[] | null;
    if (raw === null) {
      allowList = null;
    } else if (Array.isArray(raw)) {
      allowList = raw.filter((v): v is string => typeof v === 'string');
    } else {
      return res.status(400).json({ error: 'allowList must be an array or null' });
    }

    try {
      const ctx = await formIntakeService.setFieldAllowList(formId, orgId, allowList);
      return res.status(200).json({ data: ctx });
    } catch (e) {
      if (mapServiceError(e, res)) return;
      logger.error('[FormIntakeRoutes] setAllowList failed', {
        formId,
        error: (e as Error)?.message,
      });
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

export default router;
