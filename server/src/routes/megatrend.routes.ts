/**
 * Megatrend Routes
 * API endpoints for the Megatrend Scanner module
 * 
 * Fully migrated to TypeScript ES modules
 */

import { Router, Response } from 'express';
import { verifyToken, type AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Megatrend Service interface
interface MegatrendServiceInterface {
    getBaselineTrends?: (industry?: string) => Promise<unknown>;
    getRadarData?: (industry?: string) => Promise<unknown>;
    getTrendDetail?: (id: string) => Promise<unknown>;
    createCustomTrend?: (data: unknown) => Promise<unknown>;
}

// Dynamic import for MegatrendService (may not be migrated yet)
let MegatrendService: MegatrendServiceInterface | null = null;

try {
    const megatrendModule = await import('../../models/megatrend.js');
    MegatrendService = (megatrendModule.default || megatrendModule) as MegatrendServiceInterface;
} catch {
    // Service may not exist or not migrated yet
    console.warn('[Megatrend] Service not available');
}

// All routes require authentication
router.use(verifyToken);

/**
 * GET /api/megatrends/baseline
 * Get baseline trends for industry
 */
router.get('/baseline', asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!MegatrendService?.getBaselineTrends) {
        return res.status(503).json({ error: 'Megatrend service not available' });
    }

    try {
        const industry = req.query.industry as string | undefined;
        const data = await MegatrendService.getBaselineTrends(industry);
        res.json(data);
    } catch (err: unknown) {
        console.error('[Megatrend] baseline error', err);
        res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
}));

/**
 * GET /api/megatrends/radar
 * Get radar data for industry
 */
router.get('/radar', asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!MegatrendService?.getRadarData) {
        return res.status(503).json({ error: 'Megatrend service not available' });
    }

    try {
        const industry = req.query.industry as string | undefined;
        const data = await MegatrendService.getRadarData(industry);
        res.json(data);
    } catch (err: unknown) {
        console.error('[Megatrend] radar error', err);
        res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
}));

/**
 * GET /api/megatrends/:id
 * Get trend detail by ID
 */
router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!MegatrendService?.getTrendDetail) {
        return res.status(503).json({ error: 'Megatrend service not available' });
    }

    try {
        const detail = await MegatrendService.getTrendDetail(req.params.id);
        if (!detail) {
            return res.status(404).json({ error: 'Trend not found' });
        }
        res.json(detail);
    } catch (err: unknown) {
        console.error('[Megatrend] detail error', err);
        res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
}));

/**
 * POST /api/megatrends/custom
 * Create custom trend
 */
router.post('/custom', asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!MegatrendService?.createCustomTrend) {
        return res.status(503).json({ error: 'Megatrend service not available' });
    }

    try {
        const companyId = (req.user as { companyId?: string; organizationId?: string })?.companyId || req.user?.organizationId;
        if (!companyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const created = await MegatrendService.createCustomTrend(req.body, companyId);
        res.status(201).json(created);
    } catch (err: unknown) {
        console.error('[Megatrend] create custom error', err);
        res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
}));

/**
 * PUT /api/megatrends/custom/:id
 * Update custom trend
 */
router.put('/custom/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!MegatrendService?.updateCustomTrend) {
        return res.status(503).json({ error: 'Megatrend service not available' });
    }

    try {
        const companyId = (req.user as { companyId?: string; organizationId?: string })?.companyId || req.user?.organizationId;
        if (!companyId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const updated = await MegatrendService.updateCustomTrend(req.params.id, req.body, companyId);
        if (!updated) {
            return res.status(404).json({ error: 'Custom trend not found' });
        }
        res.json(updated);
    } catch (err: unknown) {
        console.error('[Megatrend] update custom error', err);
        res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
}));

export default router;
