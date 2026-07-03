/**
 * Results Enterprise Routes (V4-RSLT-02, 04, 05, 06) — LEGACY (V4 path)
 *
 * @deprecated Mounted at /api/results-v4 for legacy ResultsReportingEnterpriseViews.
 * Do NOT add new routes here. New M15 analytics → /api/results-extended.
 * V4-RSLT-02, 04, 05, 06 (Schedules, Wallboards, Connectors, Enterprise reports).
 */

import { type Response, Router } from 'express';
import { z } from 'zod';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { resultsEnterpriseService } from '../services/resultsEnterpriseService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(verifyToken);

const requireUser = (req: AuthRequest, res: Response): { userId: string; orgId: string } | null => {
  const userId = req.user?.id || req.userId;
  const orgId =
    req.user?.organizationId ||
    req.organizationId ||
    (req.headers['x-organization-id'] as string) ||
    (req.query.organizationId as string);
  if (!userId || !orgId) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return { userId, orgId };
};

// ── RSLT-02: KPI connectors ──

router.post(
  '/kpi-connectors',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      connectorName: z.string().min(1),
      connectorType: z.enum(['api', 'csv', 'database', 'webhook', 'manual']).optional(),
      config: z.record(z.string(), z.unknown()),
      targetKpiIds: z.array(z.string()).optional(),
      scheduleCron: z.string().optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    res
      .status(201)
      .json(await resultsEnterpriseService.createConnector(id.orgId, id.userId, p.data));
  })
);

router.get(
  '/kpi-connectors',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    res.json({ connectors: await resultsEnterpriseService.getConnectors(id.orgId) });
  })
);

router.post(
  '/kpi-connectors/:connectorId/ingest',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      kpiId: z.string(),
      value: z.number(),
      period: z.string(),
      provenance: z.record(z.string(), z.unknown()).optional(),
      qualityScore: z.number().min(0).max(1).optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    try {
      res.status(201).json(
        await resultsEnterpriseService.ingestKPIValue(id.orgId, {
          connectorId: req.params.connectorId,
          ...p.data,
        })
      );
    } catch (error: any) {
      // SEC-3: a foreign-org (or missing) connector is rejected by the service → 404.
      if (String(error?.message || '').includes('not found')) {
        res.status(404).json({ error: 'Connector not found' });
        return;
      }
      throw error;
    }
  })
);

router.get(
  '/kpi-connectors/:connectorId/ingestion-log',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : 50;
    res.json({
      log: await resultsEnterpriseService.getIngestionLog(id.orgId, req.params.connectorId, limit),
    });
  })
);

router.post(
  '/kpi-connectors/:connectorId/run',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    try {
      res.json(
        await resultsEnterpriseService.runConnectorNow(id.orgId, req.params.connectorId, id.userId)
      );
    } catch (error: any) {
      if (String(error?.message || '').includes('not found')) {
        res.status(404).json({ error: 'Connector not found' });
        return;
      }
      throw error;
    }
  })
);

// ── RSLT-04: ROI evidence ──

router.post(
  '/roi-evidence',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      initiativeId: z.string().optional(),
      benefitId: z.string().optional(),
      evidenceType: z.enum(['measurement', 'estimate', 'forecast', 'audit']).optional(),
      value: z.number(),
      currency: z.string().optional(),
      period: z.string(),
      sourceDescription: z.string().optional(),
      provenanceAssumptions: z.array(z.unknown()).optional(),
      financeModelId: z.string().optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    try {
      res
        .status(201)
        .json(await resultsEnterpriseService.createROIEvidence(id.orgId, id.userId, p.data));
    } catch (error: any) {
      // SEC-3: a foreign-org (or missing) parent reference is rejected by the service → 404.
      if (String(error?.message || '').includes('not found')) {
        res.status(404).json({ error: 'Referenced parent not found' });
        return;
      }
      throw error;
    }
  })
);

router.get(
  '/roi-evidence',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const filters: { initiativeId?: string; benefitId?: string } = {};
    if (req.query.initiativeId) filters.initiativeId = String(req.query.initiativeId);
    if (req.query.benefitId) filters.benefitId = String(req.query.benefitId);
    res.json({ evidence: await resultsEnterpriseService.getROIEvidence(id.orgId, filters) });
  })
);

router.post(
  '/roi-evidence/:evidenceId/verify',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const ok = await resultsEnterpriseService.verifyROIEvidence(
      id.orgId,
      req.params.evidenceId,
      id.userId
    );
    if (!ok) {
      res.status(404).json({ error: 'Evidence not found' });
      return;
    }
    res.json({ ok: true });
  })
);

// ── RSLT-05: Scheduled KPI reporting ──

router.post(
  '/kpi-report-schedules',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      reportName: z.string().min(1),
      templateConfig: z.record(z.string(), z.unknown()).optional(),
      kpiIds: z.array(z.string()),
      scheduleCron: z.string().optional(),
      sendAt: z.string().optional(),
      recipientPolicy: z.record(z.string(), z.unknown()),
      approvalRequired: z.boolean().optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    res
      .status(201)
      .json(await resultsEnterpriseService.createReportSchedule(id.orgId, id.userId, p.data));
  })
);

router.get(
  '/kpi-report-schedules',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    res.json({ schedules: await resultsEnterpriseService.getReportSchedules(id.orgId) });
  })
);

router.get(
  '/kpi-report-schedules/:scheduleId/delivery-log',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : 50;
    res.json({
      deliveries: await resultsEnterpriseService.getScheduleDeliveryLog(
        id.orgId,
        req.params.scheduleId,
        limit
      ),
    });
  })
);

router.post(
  '/kpi-report-schedules/:scheduleId/approve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const ok = await resultsEnterpriseService.approveReportSchedule(
      id.orgId,
      req.params.scheduleId,
      id.userId
    );
    if (!ok) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }
    res.json({ ok: true });
  })
);

router.post(
  '/kpi-report-schedules/:scheduleId/run',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    try {
      res.json(
        await resultsEnterpriseService.runReportScheduleNow(
          id.orgId,
          req.params.scheduleId,
          id.userId
        )
      );
    } catch (error: any) {
      if (String(error?.message || '').includes('not found')) {
        res.status(404).json({ error: 'Schedule not found' });
        return;
      }
      throw error;
    }
  })
);

router.post(
  '/runtime/run-due',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    res.json(await resultsEnterpriseService.runDueWork(id.orgId));
  })
);

// ── RSLT-06: Wallboard ──

router.post(
  '/wallboards',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      name: z.string().min(1),
      layoutConfig: z.record(z.string(), z.unknown()).optional(),
      kpiIds: z.array(z.string()),
      refreshIntervalSeconds: z.number().int().optional(),
      autoRotationSeconds: z.number().int().optional(),
      alertThresholds: z.record(z.string(), z.unknown()).optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    res
      .status(201)
      .json(await resultsEnterpriseService.createWallboard(id.orgId, id.userId, p.data));
  })
);

router.get(
  '/wallboards',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    res.json({ wallboards: await resultsEnterpriseService.getWallboards(id.orgId) });
  })
);

router.get(
  '/wallboards/:wallboardId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const wb = await resultsEnterpriseService.getWallboard(id.orgId, req.params.wallboardId);
    if (!wb) {
      res.status(404).json({ error: 'Wallboard not found' });
      return;
    }
    res.json(wb);
  })
);

router.post(
  '/wallboards/:wallboardId/alerts',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      kpiId: z.string(),
      alertType: z.string().optional(),
      thresholdValue: z.number(),
      currentValue: z.number(),
      severity: z.enum(['info', 'warning', 'critical']).optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    try {
      res.status(201).json(
        await resultsEnterpriseService.createWallboardAlert(id.orgId, {
          wallboardId: req.params.wallboardId,
          ...p.data,
        })
      );
    } catch (error: any) {
      // SEC-3: a foreign-org (or missing) wallboard is rejected by the service → 404.
      if (String(error?.message || '').includes('not found')) {
        res.status(404).json({ error: 'Wallboard not found' });
        return;
      }
      throw error;
    }
  })
);

router.get(
  '/wallboards/:wallboardId/alerts',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    res.json({
      alerts: await resultsEnterpriseService.getWallboardAlerts(id.orgId, req.params.wallboardId),
    });
  })
);

export default router;
