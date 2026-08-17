/**
 * Health Panel Admin Routes (HARVARD D-J ETAP 2)
 *
 * Internal "dowody działania" (proof-of-life) panel for org owners/admins.
 * Exposes the probe registry, a per-probe / all-probe runner, and a cached
 * summary for future monitoring. Probes are in-process round-trips against our
 * OWN API/DB (see services/health/healthProbeService.ts).
 *
 * Gating:
 *   - verifyToken + verifyAdmin  → org admin/owner (or superadmin) only.
 *   - isHealthPanelAllowedEnv()  → NEVER runs mutating probes on production.
 *
 * Mounted at /api/admin/health-panel (Gateway.ts).
 */
import { type NextFunction, type Response, Router } from 'express';

import verifyAdmin from '../../middleware/admin.middleware.js';
import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import {
  cacheProbeResult,
  getCachedResults,
  getProbeById,
  HEALTH_PROBES,
  type HealthProbeContext,
  isHealthPanelAllowedEnv,
  runAllProbes,
  runProbe,
  summarizeResults,
} from '../../services/health/healthProbeService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { get as dbGet } from '../../utils/DbPromise.js';

const router = Router();

router.use(verifyToken);
router.use(
  asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const organizationId = String(req.user?.organizationId || '').trim();
    const userId = String(req.user?.id || '').trim();
    if (!organizationId || !userId) {
      res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' });
      return;
    }

    try {
      const membership = await dbGet<{ status?: string }>(
        `SELECT status FROM organization_members
         WHERE organization_id = ? AND user_id = ?
         LIMIT 1`,
        [organizationId, userId],
        { fallback: false }
      );
      if (
        !membership ||
        String(membership.status || '')
          .trim()
          .toUpperCase() !== 'ACTIVE'
      ) {
        res.status(403).json({
          success: false,
          error: 'Active organization membership required',
          code: 'ADMIN_MEMBERSHIP_REQUIRED',
        });
        return;
      }
    } catch {
      res.status(503).json({
        success: false,
        error: 'Admin membership could not be verified',
        code: 'ADMIN_MEMBERSHIP_LOOKUP_FAILED',
      });
      return;
    }

    next();
  })
);
router.use(verifyAdmin);

function getContext(req: AuthRequest): HealthProbeContext | null {
  const organizationId = req.user?.organizationId || req.organizationId || '';
  const userId = req.user?.id || req.userId || '';
  if (!organizationId || !userId) return null;
  return { organizationId, userId };
}

function probeCatalog() {
  return HEALTH_PROBES.map((p) => ({
    probeId: p.id,
    module: p.module,
    title: p.title,
    description: p.description,
  }));
}

/**
 * GET /api/admin/health-panel/probes
 * Registry catalog + last cached results merged in.
 */
router.get(
  '/probes',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ctx = getContext(req);
    if (!ctx) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const results = await getCachedResults(ctx.organizationId);
    res.json({
      success: true,
      envAllowed: isHealthPanelAllowedEnv(),
      catalog: probeCatalog(),
      results,
      summary: summarizeResults(results),
    });
  })
);

/**
 * POST /api/admin/health-panel/run
 * Run ALL probes, cache and return results.
 */
router.post(
  '/run',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ctx = getContext(req);
    if (!ctx) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (!isHealthPanelAllowedEnv()) {
      return res.status(403).json({
        success: false,
        error: 'Health probes are disabled in this environment',
      });
    }
    const results = await runAllProbes(ctx);
    for (const r of results) {
      await cacheProbeResult(ctx, r);
    }
    res.json({ success: true, results, summary: summarizeResults(results) });
  })
);

/**
 * POST /api/admin/health-panel/run/:probeId
 * Run a single probe, cache and return its result.
 */
router.post(
  '/run/:probeId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ctx = getContext(req);
    if (!ctx) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (!isHealthPanelAllowedEnv()) {
      return res.status(403).json({
        success: false,
        error: 'Health probes are disabled in this environment',
      });
    }
    const probe = getProbeById(String(req.params.probeId));
    if (!probe) return res.status(404).json({ success: false, error: 'Unknown probe' });

    const result = await runProbe(probe, ctx);
    await cacheProbeResult(ctx, result);
    res.json({ success: true, result });
  })
);

/**
 * GET /api/admin/health-panel/summary
 * Rollup of last cached results (for future monitoring/alerting).
 */
router.get(
  '/summary',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ctx = getContext(req);
    if (!ctx) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const results = await getCachedResults(ctx.organizationId);
    const summary = summarizeResults(results);
    res.json({
      success: true,
      envAllowed: isHealthPanelAllowedEnv(),
      summary,
      probes: results.map((r) => ({
        probeId: r.probeId,
        module: r.module,
        title: r.title,
        status: r.status,
        durationMs: r.durationMs,
        ranAt: r.ranAt,
      })),
    });
  })
);

export default router;
