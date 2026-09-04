import { randomUUID } from 'node:crypto';

import { type NextFunction, type Response, Router } from 'express';

import verifyAdmin from '../../middleware/admin.middleware.js';
import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { requireAudit } from '../../middleware/requireAudit.middleware.js';
import { serviceAccountService } from '../../services/tablePlatform/ServiceAccountService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { get as dbGet } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import { validateUUID } from '../../utils/validation.js';

const router = Router();

function requestCorrelationId(req: AuthRequest): string {
  const existing =
    (req as AuthRequest & { correlationId?: unknown }).correlationId ?? req.get('X-Correlation-ID');
  return typeof existing === 'string' && existing.trim() ? existing.trim() : randomUUID();
}

router.use((req: AuthRequest, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.statusCode < 400) return originalJson(body);
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const code =
      typeof payload.errorCode === 'string'
        ? payload.errorCode
        : typeof payload.code === 'string'
          ? payload.code
          : `HTTP_${res.statusCode}`;
    return originalJson({
      ...payload,
      errorCode: code,
      correlationId: requestCorrelationId(req),
    });
  }) as Response['json'];
  next();
});

router.use(verifyToken);
router.use(
  asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const organizationId = String(req.user?.organizationId || '').trim();
    const userId = String(req.user?.id || '').trim();
    if (!organizationId || !userId)
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
    const requestedOrgId = String(req.query.orgId || organizationId).trim();
    if (requestedOrgId !== organizationId)
      return res.status(403).json({
        success: false,
        code: 'ADMIN_BOUNDARY_VIOLATION',
        error: 'Cross-organization admin access is blocked',
      });
    const membership = await dbGet<{ role?: string; status?: string }>(
      'SELECT role, status FROM organization_members WHERE organization_id = ? AND user_id = ? LIMIT 1',
      [organizationId, userId],
      { fallback: false }
    );
    if (!membership || String(membership.status).toUpperCase() !== 'ACTIVE')
      return res.status(403).json({ success: false, code: 'ADMIN_MEMBERSHIP_REQUIRED' });
    if (!['OWNER', 'ADMIN'].includes(String(membership.role).toUpperCase()))
      return res.status(403).json({ success: false, code: 'ADMIN_ACCESS_REQUIRED' });
    next();
  })
);
router.use(verifyAdmin);
router.use(requireAudit);

function auditUnavailable(res: Response) {
  return res.status(503).json({
    success: false,
    code: 'AUDIT_UNAVAILABLE',
    operationApplied: true,
    error: 'Operation completed but its audit record could not be persisted',
  });
}

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = String(req.user?.organizationId || '');
    if (!validateUUID(organizationId)) return res.json({ success: true, data: [] });
    return res.json({
      success: true,
      data: await serviceAccountService.listServiceAccounts(organizationId),
    });
  })
);

router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = String(req.user?.organizationId || '');
    const name = String(req.body?.name || '').trim();
    const scopes = Array.isArray(req.body?.scopes)
      ? req.body.scopes.map(String).filter(Boolean)
      : [];
    if (!validateUUID(organizationId))
      return res.status(400).json({ success: false, code: 'INVALID_IDENTIFIER' });
    if (!name || scopes.length === 0)
      return res.status(400).json({ success: false, error: 'name and scopes are required' });
    const result = await serviceAccountService.createServiceAccount(organizationId, {
      name,
      description: String(req.body?.description || '').trim() || undefined,
      scopes,
      expiresInDays: Number(req.body?.expiresInDays) || undefined,
      createdBy: req.user?.id,
    });
    try {
      await req.emitAuditEvent?.({
        action: 'service_account.created',
        resourceType: 'service_account',
        resourceId: result.account.id,
        after: { active: true, scopes },
        metadata: { scopes, expiresInDays: Number(req.body?.expiresInDays) || null },
      });
    } catch {
      return auditUnavailable(res);
    }
    return res.status(201).json({ success: true, data: result });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = String(req.user?.organizationId || '');
    if (!validateUUID(organizationId))
      return res.status(400).json({ success: false, code: 'INVALID_IDENTIFIER' });
    const found = await dbGet<{ id: string }>(
      'SELECT id FROM tp_service_accounts WHERE id = ? AND organization_id = ?',
      [req.params.id, organizationId],
      { fallback: false }
    );
    if (!found) return res.status(404).json({ success: false, error: 'Service account not found' });
    await serviceAccountService.revokeServiceAccount(req.params.id);
    const readback = await serviceAccountService.listServiceAccounts(organizationId);
    if (readback.some((account) => account.id === req.params.id))
      return res.status(409).json({ success: false, error: 'Service account was not revoked' });
    try {
      await req.emitAuditEvent?.({
        action: 'service_account.revoked',
        resourceType: 'service_account',
        resourceId: req.params.id,
        before: { active: true },
        after: { active: false },
      });
    } catch {
      return auditUnavailable(res);
    }
    return res.status(204).send();
  })
);

router.use((error: unknown, req: AuthRequest, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;
  // Ten lokalny handler przechwytuje blad ZAMIAST errorHandlerMiddleware, ktory jako jedyny
  // robi logger.error. Bez tego wpisu wyjatek gines bez sladu — odbior 04.09 zmierzyl, ze
  // POST i DELETE dla organizacji spoza UUID zwracaly 500 i nikt sie o tym nie dowiadywal.
  const correlationId =
    (req.headers['x-correlation-id'] as string | undefined) ?? randomUUID();
  logger.error('[service-accounts] nieobsluzony blad trasy', {
    correlationId,
    method: req.method,
    path: req.originalUrl,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  return res.status(500).json({ success: false, code: 'INTERNAL_ERROR', correlationId });
});

export default router;
