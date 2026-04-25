import { type Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import {
  buildWave7ConnectorHealth,
  disconnectWave7Connector,
  executeWave7ConnectorTool,
  getWave7ConnectorCatalog,
  linkWave7ConnectorToExternal,
  listWave7ConnectorRuns,
  listWave7Connectors,
  registerWave7Connector,
  reindexWave7Connector,
  updateWave7Connector,
} from '../services/wave7ConnectorRuntimeService.js';
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

router.get(
  '/catalog',
  verifyToken,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const catalog = await getWave7ConnectorCatalog();
    return res.json({ success: true, catalog });
  })
);

router.get(
  '/',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getAuthContext(req);
    const connectors = await listWave7Connectors({
      organizationId,
      projectId: req.query.projectId ? String(req.query.projectId) : null,
    });
    return res.json({ success: true, connectors });
  })
);

router.post(
  '/',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getAuthContext(req);
    const connector = await registerWave7Connector({
      organizationId,
      userId,
      provider: String(req.body.provider || ''),
      status: req.body.status || 'connected',
      scopes: Array.isArray(req.body.scopes) ? req.body.scopes.map(String) : ['read'],
      projectIds: Array.isArray(req.body.projectIds) ? req.body.projectIds.map(String) : [],
      tenantPolicy:
        req.body.tenantPolicy && typeof req.body.tenantPolicy === 'object'
          ? req.body.tenantPolicy
          : { acl: 'tenant' },
      freshnessTtlMinutes: req.body.freshnessTtlMinutes
        ? Number(req.body.freshnessTtlMinutes)
        : 240,
      tokenExpiresAt:
        req.body.tokenExpiresAt !== undefined
          ? String(req.body.tokenExpiresAt || '') || null
          : null,
      reconnectRequired: req.body.reconnectRequired === true,
    });
    return res.status(201).json({ success: true, connector });
  })
);

router.patch(
  '/:connectorId',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getAuthContext(req);
    const connector = await updateWave7Connector({
      organizationId,
      connectorId: String(req.params.connectorId || ''),
      status: req.body.status,
      externalConnectorId:
        req.body.externalConnectorId !== undefined
          ? String(req.body.externalConnectorId || '')
          : undefined,
      projectIds: Array.isArray(req.body.projectIds) ? req.body.projectIds.map(String) : undefined,
      failureState:
        req.body.failureState !== undefined ? String(req.body.failureState || '') : undefined,
      tokenExpiresAt:
        req.body.tokenExpiresAt !== undefined
          ? String(req.body.tokenExpiresAt || '') || null
          : undefined,
      reconnectRequired:
        req.body.reconnectRequired !== undefined ? req.body.reconnectRequired === true : undefined,
      accessRevokedAt:
        req.body.accessRevokedAt !== undefined
          ? String(req.body.accessRevokedAt || '') || null
          : undefined,
      revokedReason:
        req.body.revokedReason !== undefined
          ? String(req.body.revokedReason || '') || null
          : undefined,
    });
    if (!connector) return res.status(404).json({ success: false, error: 'Connector not found' });
    return res.json({ success: true, connector });
  })
);

router.post(
  '/:connectorId/link',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getAuthContext(req);
    const connector = await linkWave7ConnectorToExternal({
      organizationId,
      connectorId: String(req.params.connectorId || ''),
      externalConnectorId: String(req.body.externalConnectorId || ''),
    });
    return res.json({ success: true, connector });
  })
);

router.post(
  '/:connectorId/disconnect',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getAuthContext(req);
    const connector = await disconnectWave7Connector({
      organizationId,
      connectorId: String(req.params.connectorId || ''),
    });
    if (!connector) return res.status(404).json({ success: false, error: 'Connector not found' });
    return res.json({ success: true, connector });
  })
);

router.post(
  '/:connectorId/reindex',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getAuthContext(req);
    const result = await reindexWave7Connector({
      organizationId,
      userId,
      connectorId: String(req.params.connectorId || ''),
    });
    return res.status(result.allowed ? 202 : 403).json({ success: result.allowed, ...result });
  })
);

router.post(
  '/execute',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getAuthContext(req);
    const result = await executeWave7ConnectorTool({
      organizationId,
      userId,
      connectorId: String(req.body.connectorId || ''),
      toolName: String(req.body.toolName || 'connector_search'),
      toolKind: req.body.toolKind || 'search',
      query: req.body.query || null,
      projectId: req.body.projectId || null,
      aiRunId: req.body.aiRunId || null,
      payload: req.body.payload && typeof req.body.payload === 'object' ? req.body.payload : {},
    });
    return res.status(result.allowed ? 200 : 403).json({ success: result.allowed, ...result });
  })
);

router.get(
  '/runs',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getAuthContext(req);
    const runs = await listWave7ConnectorRuns({
      organizationId,
      limit: req.query.limit ? Number(req.query.limit) : 50,
    });
    return res.json({ success: true, runs });
  })
);

router.get(
  '/health',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getAuthContext(req);
    const health = await buildWave7ConnectorHealth({ organizationId });
    return res.json({ success: true, health });
  })
);

export default router;
