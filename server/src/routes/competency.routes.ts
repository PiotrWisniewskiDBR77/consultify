import { type Response, Router } from 'express';

import type { AuthRequest } from '../middleware/auth.middleware.js';
import * as taxonomy from '../services/competencyTaxonomyService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

/* ================================================================== */
/*  Categories                                                         */
/* ================================================================== */

router.get(
  '/categories',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId || req.user?.organizationId || '';
    const categories = await taxonomy.getCategories(orgId);
    res.json({ categories });
  })
);

router.post(
  '/categories',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId || req.user?.organizationId || '';
    const category = await taxonomy.createCategory(orgId, {
      ...req.body,
      createdBy: req.userId || req.user?.id,
    });
    res.status(201).json({ category });
  })
);

router.put(
  '/categories/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId || req.user?.organizationId || '';
    const category = await taxonomy.updateCategory(orgId, req.params.id, req.body);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    res.json({ category });
  })
);

router.delete(
  '/categories/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId || req.user?.organizationId || '';
    await taxonomy.deleteCategory(orgId, req.params.id);
    res.json({ ok: true });
  })
);

router.post(
  '/categories/seed-defaults',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId || req.user?.organizationId || '';
    const categories = await taxonomy.seedDefaultCategories(orgId, req.userId || req.user?.id);
    res.json({ categories });
  })
);

/* ================================================================== */
/*  Levels                                                             */
/* ================================================================== */

router.get(
  '/levels',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId || req.user?.organizationId || '';
    const levels = await taxonomy.getLevels(orgId);
    res.json({ levels });
  })
);

router.post(
  '/levels/seed-defaults',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId || req.user?.organizationId || '';
    const levels = await taxonomy.seedDefaultLevels(orgId);
    res.json({ levels });
  })
);

router.put(
  '/levels/:levelValue',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId || req.user?.organizationId || '';
    const level = await taxonomy.upsertLevel(orgId, parseInt(req.params.levelValue, 10), req.body);
    res.json({ level });
  })
);

/* ================================================================== */
/*  Competencies (with stats)                                          */
/* ================================================================== */

router.get(
  '/competencies',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId || req.user?.organizationId || '';
    const categoryId = req.query.categoryId as string | undefined;
    const competencies = await taxonomy.getCompetenciesWithStats(orgId, categoryId);
    res.json({ competencies });
  })
);

router.put(
  '/competencies/:id/category',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId || req.user?.organizationId || '';
    await taxonomy.updateCompetencyCategory(orgId, req.params.id, req.body.categoryId ?? null);
    res.json({ ok: true });
  })
);

/* ================================================================== */
/*  Initiative Competency Requirements                                 */
/* ================================================================== */

router.get(
  '/initiatives/:initiativeId/requirements',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId || req.user?.organizationId || '';
    const requirements = await taxonomy.getInitiativeRequirements(orgId, req.params.initiativeId);
    res.json({ requirements });
  })
);

router.post(
  '/initiatives/:initiativeId/requirements',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId || req.user?.organizationId || '';
    const requirement = await taxonomy.addInitiativeRequirement(orgId, {
      ...req.body,
      initiativeId: req.params.initiativeId,
      createdBy: req.userId || req.user?.id,
    });
    res.status(201).json({ requirement });
  })
);

router.put(
  '/initiatives/:initiativeId/requirements/:reqId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId || req.user?.organizationId || '';
    await taxonomy.updateInitiativeRequirement(orgId, req.params.reqId, req.body);
    res.json({ ok: true });
  })
);

router.delete(
  '/initiatives/:initiativeId/requirements/:reqId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId || req.user?.organizationId || '';
    await taxonomy.deleteInitiativeRequirement(orgId, req.params.reqId);
    res.json({ ok: true });
  })
);

export default router;
