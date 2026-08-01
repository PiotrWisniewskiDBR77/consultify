/**
 * SystemHealth Routes
 * API endpoints for system health monitoring
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';

import { type AuthRequest } from '../middleware/auth.middleware.js';
import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { verifySuperAdmin } from '../middleware/superAdmin.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

let alertsTableReady = false;

async function ensureAlertsTable(): Promise<void> {
  if (alertsTableReady) return;
  const { run: dbRun } = await import('../utils/DbPromise.js');
  await dbRun(
    `CREATE TABLE IF NOT EXISTS system_health_alerts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      metric TEXT NOT NULL,
      threshold REAL NOT NULL,
      operator TEXT NOT NULL DEFAULT 'gt',
      enabled INTEGER NOT NULL DEFAULT 1,
      channels TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    [],
    { fallback: false }
  );
  alertsTableReady = true;
}

function alertRowToJson(row: any) {
  return {
    id: row.id,
    name: row.name,
    metric: row.metric,
    threshold: row.threshold,
    operator: row.operator,
    enabled: row.enabled === 1,
    channels: JSON.parse(row.channels || '[]'),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// Apply rate limiting
router.use(defaultRateLimiter);
import SystemHealthService from '../services/systemHealthService.js';
import logger from '../utils/Logger.js';

const serviceFallback = (
  _req: AuthRequest,
  res: Response,
  _readPayload?: Record<string, unknown>
) => {
  return res.status(503).json({
    success: false,
    error: 'System health service not available',
    code: 'SYSTEM_HEALTH_SERVICE_NOT_CONFIGURED',
  });
};

/**
 * REMOVED (SEC-PUB-002): `GET /api/system-health` — the router's BASE route.
 *
 * It was labelled "Basic health check (public)" and was indeed public: it was the
 * ONLY route on this router without `verifySuperAdmin`, while all ten siblings
 * have it. And it was not basic — it called the same `getDetailedHealth()` as the
 * guarded `/detailed`, so an anonymous caller received host memory, load average,
 * CPU count, runtime and database details, the error rate, and which AI providers
 * hold credentials.
 *
 * Deleted rather than guarded, because it was a duplicate: `/detailed` already
 * serves exactly this, correctly gated. No consumer exists — the SuperAdmin UI
 * calls `/system-health/services` and `/system-health/metrics`
 * (src/components/SuperAdmin/system/EnterpriseHealthMonitor.tsx), never the base
 * path.
 *
 * Public readiness lives at `GET /api/system/health` and answers
 * `{status, timestamp}` only.
 *
 * Coverage: tests/integration/publicSystemSurface.contract.test.ts
 */


/**
 * GET /api/system-health/detailed
 * Detailed health check (SuperAdmin only)
 */
router.get(
  '/detailed',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!SystemHealthService?.getDetailedHealth) {
      return serviceFallback(req, res, { health: {} });
    }

    try {
      const health = await SystemHealthService.getDetailedHealth();
      return res.json(health);
    } catch (error: unknown) {
      logger.error('[SystemHealth] Error:', error);
      return res.status(503).json({
        success: false,
        error: 'Health check failed',
        code: 'SYSTEM_HEALTH_DETAILED_READ_FAILED',
      });
    }
  })
);

/**
 * GET /api/system-health/metrics
 * Get system metrics (SuperAdmin only)
 */
router.get(
  '/metrics',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!SystemHealthService?.getMetrics) {
      return serviceFallback(req, res, { metrics: {} });
    }

    try {
      const metrics = await SystemHealthService.getMetrics();
      return res.json(metrics);
    } catch (error: unknown) {
      logger.error('[SystemHealth] Error fetching metrics:', error);
      return res.status(503).json({
        success: false,
        error: 'Failed to fetch system metrics',
        code: 'SYSTEM_HEALTH_METRICS_READ_FAILED',
      });
    }
  })
);

/**
 * GET /api/system-health/services
 * Get service status (SuperAdmin only)
 */
router.get(
  '/services',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!SystemHealthService?.getServiceStatus) {
      return serviceFallback(req, res, { services: [] });
    }

    try {
      const status = await SystemHealthService.getServiceStatus();
      return res.json(status);
    } catch (error: unknown) {
      logger.error('[SystemHealth] Error fetching service status:', error);
      return res.status(503).json({
        success: false,
        error: 'Failed to fetch service status',
        code: 'SYSTEM_HEALTH_SERVICES_READ_FAILED',
      });
    }
  })
);

/**
 * POST /api/system-health/refresh
 * Force refresh health data (SuperAdmin only)
 */
router.post(
  '/refresh',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!SystemHealthService?.getDetailedHealth) {
      return serviceFallback(req, res);
    }

    try {
      const health = await SystemHealthService.getDetailedHealth();
      return res.json(health);
    } catch (error: unknown) {
      logger.error('[SystemHealth] Error refreshing:', error);
      return res.status(503).json({
        success: false,
        error: 'Failed to refresh health data',
        code: 'SYSTEM_HEALTH_REFRESH_FAILED',
      });
    }
  })
);

// ── Health Alerts CRUD ──

router.get(
  '/alerts',
  verifySuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    // Fail-soft: lazy DDL must not surface as a bare 500 on a read.
    try {
      await ensureAlertsTable();
      const { all: dbAll } = await import('../utils/DbPromise.js');
      const rows = await dbAll('SELECT * FROM system_health_alerts ORDER BY created_at DESC', [], {
        fallback: true,
      });
      res.json(rows.map(alertRowToJson));
    } catch (err) {
      console.error('[systemHealth] GET /alerts failed (fail-soft, returning empty):', err);
      res.json([]);
    }
  })
);

router.post(
  '/alerts',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureAlertsTable();
    const { run: dbRun, get: dbGet } = await import('../utils/DbPromise.js');
    const { randomUUID } = await import('crypto');

    const { name, metric, threshold, operator, channels } = req.body;
    if (!name || !metric || threshold === undefined || !operator) {
      return res.status(400).json({ error: 'name, metric, threshold and operator are required' });
    }

    const id = randomUUID();
    const now = new Date().toISOString();

    await dbRun(
      `INSERT INTO system_health_alerts (id, name, metric, threshold, operator, enabled, channels, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [id, name, metric, threshold, operator, JSON.stringify(channels || []), now, now],
      { fallback: false }
    );

    const created = await dbGet('SELECT * FROM system_health_alerts WHERE id = ?', [id]);
    res.status(201).json(created ? alertRowToJson(created) : { id });
  })
);

router.put(
  '/alerts/:id',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureAlertsTable();
    const { run: dbRun, get: dbGet } = await import('../utils/DbPromise.js');

    const existing = await dbGet('SELECT * FROM system_health_alerts WHERE id = ?', [
      req.params.id,
    ]);
    if (!existing) return res.status(404).json({ error: 'Alert not found' });

    const { name, metric, threshold, operator, enabled, channels } = req.body;
    const now = new Date().toISOString();

    await dbRun(
      `UPDATE system_health_alerts SET name = ?, metric = ?, threshold = ?, operator = ?, enabled = ?, channels = ?, updated_at = ? WHERE id = ?`,
      [
        name ?? (existing as any).name,
        metric ?? (existing as any).metric,
        threshold !== undefined ? threshold : (existing as any).threshold,
        operator ?? (existing as any).operator,
        enabled !== undefined ? (enabled ? 1 : 0) : (existing as any).enabled,
        channels !== undefined ? JSON.stringify(channels) : (existing as any).channels,
        now,
        req.params.id,
      ],
      { fallback: false }
    );

    const updated = await dbGet('SELECT * FROM system_health_alerts WHERE id = ?', [req.params.id]);
    res.json(updated ? alertRowToJson(updated) : { id: req.params.id });
  })
);

router.put(
  '/alerts/:id/toggle',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureAlertsTable();
    const { run: dbRun, get: dbGet } = await import('../utils/DbPromise.js');

    const existing = await dbGet<any>('SELECT * FROM system_health_alerts WHERE id = ?', [
      req.params.id,
    ]);
    if (!existing) return res.status(404).json({ error: 'Alert not found' });

    const newEnabled = existing.enabled === 1 ? 0 : 1;
    const now = new Date().toISOString();

    await dbRun(
      'UPDATE system_health_alerts SET enabled = ?, updated_at = ? WHERE id = ?',
      [newEnabled, now, req.params.id],
      { fallback: false }
    );

    const updated = await dbGet('SELECT * FROM system_health_alerts WHERE id = ?', [req.params.id]);
    res.json(updated ? alertRowToJson(updated) : { id: req.params.id, enabled: newEnabled === 1 });
  })
);

router.delete(
  '/alerts/:id',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ensureAlertsTable();
    const { run: dbRun, get: dbGet } = await import('../utils/DbPromise.js');

    const existing = await dbGet('SELECT * FROM system_health_alerts WHERE id = ?', [
      req.params.id,
    ]);
    if (!existing) return res.status(404).json({ error: 'Alert not found' });

    await dbRun('DELETE FROM system_health_alerts WHERE id = ?', [req.params.id], {
      fallback: false,
    });
    res.json({ success: true });
  })
);

/**
 * GET /api/system-health/encryption
 * Encryption health check (SuperAdmin only)
 */
router.get(
  '/encryption',
  verifySuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      // Dynamic import to avoid circular dependencies
      const { KeyManagementService, getCurrentKeyVersion } =
        (await import('../services/encryption/index.js')) as any;

      const health = KeyManagementService.checkHealth();
      const keyStatus = KeyManagementService.getKeyStatus();
      const currentVersion = getCurrentKeyVersion();

      return res.json({
        healthy: health.healthy,
        currentKeyVersion: currentVersion,
        keyStatus,
        issues: health.issues,
        recommendations: health.recommendations,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('[SystemHealth] Encryption health check error:', error);
      return res.status(500).json({
        error: 'Encryption health check failed',
        healthy: false,
      });
    }
  })
);

export default router;
