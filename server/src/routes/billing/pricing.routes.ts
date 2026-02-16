/**
 * Pricing Routes
 * API endpoints for managing pricing tiers and plans
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { isAuthenticated, verifyToken } from '../../middleware/auth.middleware.js';
import { verifySuperAdmin } from '../../middleware/superAdmin.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();

/**
 * GET /api/billing/pricing
 * Get all pricing tiers (public)
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const tiers = await dbAll(`
    SELECT id, name, description, price_monthly, price_yearly, currency, 
           features, limits, is_active, display_order, created_at
    FROM pricing_tiers
    WHERE is_active = 1
    ORDER BY display_order ASC
  `);

    res.json(tiers || []);
  })
);

/**
 * GET /api/billing/pricing/:id
 * Get specific pricing tier
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const tier = await dbGet(
      `
    SELECT id, name, description, price_monthly, price_yearly, currency,
           features, limits, is_active, display_order, created_at, updated_at
    FROM pricing_tiers
    WHERE id = ?
  `,
      [id]
    );

    if (!tier) {
      return res.status(404).json({ error: 'Pricing tier not found' });
    }

    res.json(tier);
  })
);

/**
 * POST /api/billing/pricing
 * Create new pricing tier (SuperAdmin only)
 */
router.post(
  '/',
  verifyToken,
  verifySuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const {
      name,
      description,
      priceMonthly,
      priceYearly,
      currency = 'USD',
      features,
      limits,
      displayOrder,
    } = req.body;

    if (!name || priceMonthly === undefined) {
      return res.status(400).json({ error: 'Name and monthly price are required' });
    }

    const id = uuidv4();

    const result = await dbRun(
      `
    INSERT INTO pricing_tiers (id, name, description, price_monthly, price_yearly, 
                               currency, features, limits, is_active, display_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))
  `,
      [
        id,
        name,
        description || '',
        priceMonthly,
        priceYearly || priceMonthly * 10,
        currency,
        JSON.stringify(features || []),
        JSON.stringify(limits || {}),
        displayOrder || 0,
      ]
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to create pricing tier');
    }

    logger.info(`[Pricing] Created tier: ${name} (${id})`);
    res.status(201).json({ success: true, id, name });
  })
);

/**
 * PUT /api/billing/pricing/:id
 * Update pricing tier (SuperAdmin only)
 */
router.put(
  '/:id',
  verifyToken,
  verifySuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const {
      name,
      description,
      priceMonthly,
      priceYearly,
      currency,
      features,
      limits,
      isActive,
      displayOrder,
    } = req.body;

    const existing = await dbGet('SELECT id FROM pricing_tiers WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Pricing tier not found' });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (priceMonthly !== undefined) {
      updates.push('price_monthly = ?');
      params.push(priceMonthly);
    }
    if (priceYearly !== undefined) {
      updates.push('price_yearly = ?');
      params.push(priceYearly);
    }
    if (currency !== undefined) {
      updates.push('currency = ?');
      params.push(currency);
    }
    if (features !== undefined) {
      updates.push('features = ?');
      params.push(JSON.stringify(features));
    }
    if (limits !== undefined) {
      updates.push('limits = ?');
      params.push(JSON.stringify(limits));
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(isActive ? 1 : 0);
    }
    if (displayOrder !== undefined) {
      updates.push('display_order = ?');
      params.push(displayOrder);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push("updated_at = datetime('now')");
    params.push(id);

    const result = await dbRun(
      `
    UPDATE pricing_tiers SET ${updates.join(', ')} WHERE id = ?
  `,
      params
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to update pricing tier');
    }

    logger.info(`[Pricing] Updated tier: ${id}`);
    res.json({ success: true });
  })
);

/**
 * DELETE /api/billing/pricing/:id
 * Delete pricing tier (SuperAdmin only)
 */
router.delete(
  '/:id',
  verifyToken,
  verifySuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    // Soft delete by setting is_active = 0
    const result = await dbRun(
      `
    UPDATE pricing_tiers SET is_active = 0, updated_at = datetime('now') WHERE id = ?
  `,
      [id]
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to delete pricing tier');
    }

    logger.info(`[Pricing] Deleted tier: ${id}`);
    res.json({ success: true });
  })
);

/**
 * GET /api/billing/pricing/compare
 * Compare pricing tiers
 */
router.get(
  '/compare/all',
  asyncHandler(async (req: Request, res: Response) => {
    const tiers = await dbAll(`
    SELECT id, name, price_monthly, price_yearly, features, limits
    FROM pricing_tiers
    WHERE is_active = 1
    ORDER BY display_order ASC
  `);

    // Extract unique feature keys for comparison matrix
    const allFeatures = new Set<string>();
    (tiers || []).forEach((tier: any) => {
      try {
        const features = JSON.parse(tier.features || '[]');
        features.forEach((f: any) => allFeatures.add(typeof f === 'string' ? f : f.name));
      } catch {}
    });

    res.json({
      tiers: tiers || [],
      featureKeys: Array.from(allFeatures),
    });
  })
);

export default router;
