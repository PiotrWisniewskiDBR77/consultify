/**
 * Enterprise Platform Routes
 * V4-ENT-05, V4-ENT-08
 */

import { Router, type Response } from 'express';
import { z } from 'zod';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { enterprisePlatformService } from '../services/enterprisePlatformService.js';

const router = Router();
router.use(verifyToken);

const requireUser = (req: AuthRequest, res: Response): { userId: string; orgId: string } | null => {
  const userId = req.user?.id || req.userId;
  const orgId = req.user?.organizationId || req.organizationId || (req.headers['x-organization-id'] as string) || (req.query.organizationId as string);
  if (!userId || !orgId) { res.status(401).json({ error: 'Authentication required' }); return null; }
  return { userId, orgId };
};

// ── ENT-05: Integration Hub ──

router.post('/connectors', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ connectorType: z.string(), connectorName: z.string(), configJson: z.record(z.string(), z.unknown()).optional(), secretsRef: z.string().optional(), allowlistDomains: z.array(z.string()).optional() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  res.status(201).json(await enterprisePlatformService.createConnector(id.orgId, { ...p.data, createdBy: id.userId }));
}));

router.get('/connectors', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  res.json({ connectors: await enterprisePlatformService.getConnectors(id.orgId) });
}));

router.get('/connectors/:connectorId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const c = await enterprisePlatformService.getConnector(id.orgId, req.params.connectorId);
  if (!c) { res.status(404).json({ error: 'Connector not found' }); return; }
  res.json(c);
}));

router.put('/connectors/:connectorId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  res.json(await enterprisePlatformService.updateConnector(id.orgId, req.params.connectorId, req.body));
}));

router.delete('/connectors/:connectorId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  res.json(await enterprisePlatformService.deleteConnector(id.orgId, req.params.connectorId));
}));

router.post('/connectors/:connectorId/health-check', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ healthStatus: z.string() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const result = await enterprisePlatformService.healthCheckConnector(id.orgId, req.params.connectorId, p.data.healthStatus);
  if (!result.ok) { res.status(404).json({ error: 'Connector not found' }); return; }
  res.json(result);
}));

router.post('/queue', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ connectorId: z.string(), direction: z.string().optional(), payloadJson: z.record(z.string(), z.unknown()), maxRetries: z.number().optional() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  res.status(201).json(await enterprisePlatformService.enqueueMessage(id.orgId, p.data));
}));

router.get('/queue', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const status = req.query.status as string | undefined;
  res.json({ items: await enterprisePlatformService.getQueueItems(id.orgId, status) });
}));

router.post('/queue/:itemId/process', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ success: z.boolean(), errorMessage: z.string().optional() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const result = await enterprisePlatformService.processQueueItem(id.orgId, req.params.itemId, p.data.success, p.data.errorMessage);
  if (!result.ok) { res.status(404).json({ error: 'Queue item not found' }); return; }
  res.json(result);
}));

router.post('/secrets', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ connectorId: z.string().optional(), secretKey: z.string(), encryptedValue: z.string() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  res.status(201).json(await enterprisePlatformService.storeSecret(id.orgId, p.data));
}));

router.get('/secrets', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const connectorId = req.query.connectorId as string | undefined;
  res.json({ keys: await enterprisePlatformService.getSecretKeys(id.orgId, connectorId) });
}));

router.delete('/secrets/:secretId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  res.json(await enterprisePlatformService.deleteSecret(id.orgId, req.params.secretId));
}));

// ── ENT-08: Observability ──

router.post('/metrics', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ metricName: z.string(), metricType: z.string().optional(), value: z.number(), labels: z.record(z.string(), z.unknown()).optional() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  res.status(201).json(await enterprisePlatformService.recordMetric({ ...p.data, organizationId: id.orgId }));
}));

router.get('/metrics/:metricName', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const since = req.query.since as string | undefined;
  res.json({ metrics: await enterprisePlatformService.getMetrics(id.orgId, req.params.metricName, since) });
}));

router.post('/slos', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ sloName: z.string(), targetPercentage: z.number(), windowDays: z.number().optional() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  res.status(201).json(await enterprisePlatformService.createSlo({ ...p.data, organizationId: id.orgId }));
}));

router.get('/slos', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  res.json({ slos: await enterprisePlatformService.getSlos(id.orgId) });
}));

router.put('/slos/:sloId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ currentPercentage: z.number(), budgetRemaining: z.number() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const result = await enterprisePlatformService.updateSloStatus(id.orgId, req.params.sloId, p.data.currentPercentage, p.data.budgetRemaining);
  if (!result.ok) { res.status(404).json({ error: 'SLO not found' }); return; }
  res.json(result);
}));

router.post('/traces', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ traceId: z.string(), spanId: z.string(), parentSpanId: z.string().optional(), operationName: z.string(), serviceName: z.string().optional(), durationMs: z.number().optional(), statusCode: z.string().optional(), attributes: z.record(z.string(), z.unknown()).optional(), startedAt: z.string().optional(), endedAt: z.string().optional() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  res.status(201).json(await enterprisePlatformService.recordTrace({ ...p.data, organizationId: id.orgId }));
}));

router.get('/traces/:traceId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  res.json({ spans: await enterprisePlatformService.getTrace(id.orgId, req.params.traceId) });
}));

router.post('/dr-drills', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ drillType: z.string(), scenario: z.string() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  res.status(201).json(await enterprisePlatformService.createDrDrill({ ...p.data, organizationId: id.orgId, conductedBy: id.userId }));
}));

router.put('/dr-drills/:drillId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  const s = z.object({ status: z.string(), resultsJson: z.record(z.string(), z.unknown()).optional() });
  const p = s.safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const result = await enterprisePlatformService.updateDrDrill(id.orgId, req.params.drillId, p.data);
  if (!result.ok) { res.status(404).json({ error: 'DR drill not found' }); return; }
  res.json(result);
}));

router.get('/dr-drills', asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = requireUser(req, res); if (!id) return;
  res.json({ drills: await enterprisePlatformService.getDrDrills(id.orgId) });
}));

export default router;
