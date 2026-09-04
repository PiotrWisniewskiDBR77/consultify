/**
 * Table Platform — Public Form Intake Routes (Block D · EPIC-T14 · Sprint D-S2)
 *
 * Parallel JWT-tokenized public surface that lives alongside the existing
 * slug-based `publicFormRouter` (in table-platform.routes.ts). NO AUTH on
 * any endpoint here — that is intentional: these are recipient-facing.
 *
 * Mount: app.use('/api/table-platform', tablePlatformFormPublicRoutes)
 *
 * Endpoints (gated by `ENABLE_TABLE_FORM_INTAKE_JWT`):
 *
 *   GET  /public/forms/jwt/:token
 *     Verifies the JWT and returns the form context (target table id,
 *     allow-listed fields). Recipient form UI calls this on page load.
 *
 *   POST /public/forms/jwt/:token/submit
 *     Body: { data: Record<string, unknown> }
 *     Verifies the JWT, applies allow-list + rate limit, delegates to
 *     `FormService.submitForm`, writes an audit row.
 *
 * Hard-coded protections (also enforced in service):
 *   - express-rate-limit: 30 req / IP / minute (covers both endpoints).
 *   - Service-layer rate limit: 10 / minute, 100 / hour per (formId, ipHash).
 *
 * Public path provenance: every accepted submission writes a
 * `tp_form_submissions` audit row regardless of intake kind.
 */

import { createHash } from 'node:crypto';

import { type NextFunction, type Request, type Response, Router } from 'express';
import rateLimit from 'express-rate-limit';

import { featureFlags } from '../config/FeatureFlags.js';
import formIntakeService, { FormIntakeError } from '../services/tablePlatform/FormIntakeService.js';
import logger from '../utils/Logger.js';
import { mapAppErrorResponse } from '../middleware/appErrorMapper.js';

const router = Router();

const publicFormLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', code: 'RATE_LIMITED' },
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

function deriveIpHash(req: Request): string | null {
  const fwd = req.headers['x-forwarded-for'];
  const ip =
    (Array.isArray(fwd) ? fwd[0] : typeof fwd === 'string' ? fwd.split(',')[0] : null) ??
    req.ip ??
    req.socket?.remoteAddress ??
    null;
  if (!ip) return null;
  return createHash('sha256').update(`cf-form-intake-v1:${ip.trim()}`).digest('hex');
}

router.get(
  '/public/forms/jwt/:token',
  publicFormLimiter,
  requireIntakeEnabled,
  async (req: Request, res: Response) => {
    const token = String(req.params.token ?? '');
    if (!token) return res.status(400).json({ error: 'token is required' });
    try {
      const ctx = await formIntakeService.verifyJwt({ token });
      // Public consumers need only what is required to render the form. We
      // intentionally hide tenant identifiers + the JWT subject from the
      // response body. The subject is logged on the server side via the
      // submission audit row.
      return res.status(200).json({
        data: {
          formId: ctx.formId,
          formSlug: ctx.formSlug,
          targetTableId: ctx.targetTableId,
          fieldAllowList: ctx.fieldAllowList,
          publicLinkExpiresAt: ctx.publicLinkExpiresAt,
        },
      });
    } catch (e) {
      if (mapServiceError(e, res)) return;
      logger.warn('[FormPublicRoutes] verifyJwt failed', {
        error: (e as Error)?.message,
      });
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

router.post(
  '/public/forms/jwt/:token/submit',
  publicFormLimiter,
  requireIntakeEnabled,
  async (req: Request, res: Response) => {
    const token = String(req.params.token ?? '');
    if (!token) return res.status(400).json({ error: 'token is required' });
    const body = (req.body ?? {}) as Record<string, unknown>;
    const data = body.data;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'data object is required' });
    }
    const ipHash = deriveIpHash(req);

    try {
      const verified = await formIntakeService.verifyJwt({ token });
      const result = await formIntakeService.submitFromPublic({
        intakeKind: 'jwt',
        formId: verified.formId,
        data: data as Record<string, unknown>,
        clientIpHash: ipHash,
        jwtSubject: verified.jwtSubject,
      });
      if (result.status === 'rate_limited') {
        return res
          .status(429)
          .json({ error: 'Submission rate limit exceeded', code: 'RATE_LIMITED' });
      }
      if (result.status === 'rejected') {
        return res
          .status(400)
          .json({ error: result.failureReason ?? 'Submission rejected', code: 'REJECTED' });
      }
      return res.status(201).json({ data: { recordId: result.recordId } });
    } catch (e) {
      if (mapServiceError(e, res)) return;
      logger.error('[FormPublicRoutes] submit failed', {
        error: (e as Error)?.message,
      });
      return res.status(500).json({ error: 'Internal error' });
    }
  }
);

export default router;
