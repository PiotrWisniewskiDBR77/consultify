/**
 * Initiatives Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * All initiative-related API endpoints with Zod validation
 */

import { Router } from 'express';

import InitiativeControllerRaw from '../../controllers/InitiativeController.js';
const InitiativeController = InitiativeControllerRaw as any;
import { verifyToken } from '../../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../../middleware/demoGuard.middleware.js';
import { authRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import initiativeTemplateService from '../../services/initiativeTemplateService.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import {
  CreateInitiativeSchema,
  QuickUpdateInitiativeSchema,
  UpdateInitiativeSchema,
  UpdateInitiativeStatusSchema,
  UpdateInitiativeTemplateSchema,
} from '../../validators/initiative.validators.js';

const router = Router();

// Apply rate limiting
router.use(authRateLimiter);

// Apply auth middleware to all routes
router.use(verifyToken);

// Apply demo context middleware (switches org to demo org if x-demo-mode header is set)
router.use(demoContextMiddleware);

// ==========================================
// INITIATIVE CRUD
// ==========================================

/**
 * GET /api/initiatives/portfolio
 * Get initiatives with portfolio stats
 */
router.get('/portfolio', InitiativeController.getPortfolioData);

/**
 * GET /api/initiatives/portfolio/dependencies
 * Get initiative dependencies for timeline
 */
router.get('/portfolio/dependencies', InitiativeController.getPortfolioDependencies);

/**
 * POST /api/initiatives/portfolio/dependencies
 * Create initiative dependency
 */
router.post('/portfolio/dependencies', InitiativeController.createPortfolioDependency);

/**
 * DELETE /api/initiatives/portfolio/dependencies/:id
 * Remove initiative dependency
 */
router.delete('/portfolio/dependencies/:id', InitiativeController.deletePortfolioDependency);

/**
 * GET /api/initiatives
 * Get all initiatives for organization
 */
router.get('/', InitiativeController.getInitiatives);

/**
 * GET /api/initiatives/templates
 * List initiative templates (public + org-scoped)
 */
router.get('/templates', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const category = req.query?.category ? String(req.query.category) : null;
    const templates = await initiativeTemplateService.getTemplates({
      category,
      organizationId: String(orgId),
      includePublic: true,
    });
    return res.json({ templates });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch templates', message: err.message });
  }
});

/**
 * GET /api/initiatives/templates/:templateId
 * Fetch template details (incl. cardScope)
 */
router.get('/templates/:templateId', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { templateId } = req.params;
    const tpl = await initiativeTemplateService.getTemplateById(String(templateId));
    if (!tpl) return res.status(404).json({ error: 'Template not found' });
    if (!tpl.isPublic && tpl.organizationId !== String(orgId)) {
      return res.status(404).json({ error: 'Template not found' });
    }
    return res.json({ template: tpl });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch template', message: err.message });
  }
});

/**
 * PATCH /api/initiatives/:id/template
 * Change initiative template (card scope).
 */
router.patch(
  '/:id/template',
  validateBody(UpdateInitiativeTemplateSchema),
  async (req: any, res: any) => {
    try {
      const orgId = req.user?.organizationId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const { id } = req.params;
      const templateId = req.body?.templateId ?? null;

      // Validate template visibility if provided
      if (templateId) {
        const tpl = await initiativeTemplateService.getTemplateById(String(templateId));
        if (!tpl) return res.status(400).json({ error: 'Invalid templateId' });
        if (!tpl.isPublic && tpl.organizationId !== String(orgId)) {
          return res.status(403).json({ error: 'Template not available for this organization' });
        }
      }

      const existing = await queryHelpers.queryOne<any>(
        `SELECT id FROM initiatives WHERE id = ? AND organization_id = ? LIMIT 1`,
        [String(id), String(orgId)]
      );
      if (!existing) return res.status(404).json({ error: 'Initiative not found' });

      await queryHelpers.queryRun(
        `UPDATE initiatives SET initiative_template_id = ? WHERE id = ? AND organization_id = ?`,
        [templateId ? String(templateId) : null, String(id), String(orgId)]
      );
      return res.json({
        id: String(id),
        initiativeTemplateId: templateId ? String(templateId) : null,
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to update template', message: err.message });
    }
  }
);

/**
 * POST /api/initiatives
 * Create a new initiative
 */
router.post('/', validateBody(CreateInitiativeSchema), InitiativeController.createInitiative);

/**
 * GET /api/initiatives/by-status/:statuses
 * Get initiatives filtered by comma-separated statuses
 * Used by Benefits module - MUST be before /:id route
 */
router.get('/by-status/:statuses', InitiativeController.getInitiativesByStatus);

/**
 * GET /api/initiatives/:id
 * Get single initiative by ID
 */
router.get('/:id', InitiativeController.getInitiativeById);

/**
 * PUT /api/initiatives/:id
 * Update initiative
 */
router.put('/:id', validateBody(UpdateInitiativeSchema), InitiativeController.updateInitiative);

/**
 * PATCH /api/initiatives/:id/status
 * Update initiative status
 */
router.patch(
  '/:id/status',
  validateBody(UpdateInitiativeStatusSchema),
  InitiativeController.updateInitiativeStatus
);

/**
 * PATCH /api/initiatives/:id/quick-update
 * Quick update initiative fields
 */
router.patch(
  '/:id/quick-update',
  validateBody(QuickUpdateInitiativeSchema),
  InitiativeController.quickUpdateInitiative
);

// ==========================================
// FLOW-INITIATIVE-001: STATUS TRANSITIONS
// ==========================================

/**
 * GET /api/initiatives/:id/readiness
 * Check if initiative is ready for review
 */
router.get('/:id/readiness', InitiativeController.checkReadiness);

/**
 * POST /api/initiatives/:id/submit-review
 * Submit initiative for review
 */
router.post('/:id/submit-review', InitiativeController.submitForReview);

/**
 * POST /api/initiatives/:id/approve
 * Approve initiative
 */
router.post('/:id/approve', InitiativeController.approveInitiative);

/**
 * POST /api/initiatives/:id/reject
 * Reject initiative (back to planning)
 */
router.post('/:id/reject', InitiativeController.rejectInitiative);

/**
 * POST /api/initiatives/:id/start-execution
 * Start execution phase
 */
router.post('/:id/start-execution', InitiativeController.startExecution);

/**
 * POST /api/initiatives/:id/block
 * Block initiative
 */
router.post('/:id/block', InitiativeController.blockInitiative);

/**
 * POST /api/initiatives/:id/unblock
 * Unblock initiative
 */
router.post('/:id/unblock', InitiativeController.unblockInitiative);

/**
 * POST /api/initiatives/:id/complete
 * Mark initiative as done
 */
router.post('/:id/complete', InitiativeController.completeInitiative);

/**
 * POST /api/initiatives/:id/move
 * Move initiative to different project
 */
router.post('/:id/move', InitiativeController.moveInitiative);

/**
 * POST /api/initiatives/:id/archive
 * Archive initiative
 */
router.post('/:id/archive', InitiativeController.archiveInitiative);

// ==========================================
// BENEFITS MODULE: KPI ENDPOINTS
// ==========================================

/**
 * GET /api/initiatives/:id/kpis
 * Get KPIs for an initiative
 */
router.get('/:id/kpis', InitiativeController.getInitiativeKpis);

/**
 * POST /api/initiatives/:id/kpis
 * Create a new KPI for an initiative
 */
router.post('/:id/kpis', InitiativeController.createInitiativeKpi);

// ==========================================
// ROADMAP MODULE: MILESTONES ENDPOINTS
// ==========================================

/**
 * GET /api/initiatives/:id/milestones
 * Get all milestones for an initiative
 */
router.get('/:id/milestones', InitiativeController.getMilestones);

/**
 * POST /api/initiatives/:id/milestones
 * Create a new milestone for an initiative
 */
router.post('/:id/milestones', InitiativeController.createMilestone);

/**
 * PUT /api/initiatives/:id/milestones/:milestoneId
 * Update a milestone
 */
router.put('/:id/milestones/:milestoneId', InitiativeController.updateMilestone);

/**
 * DELETE /api/initiatives/:id/milestones/:milestoneId
 * Delete a milestone
 */
router.delete('/:id/milestones/:milestoneId', InitiativeController.deleteMilestone);

// ==========================================
// ROADMAP MODULE: RESOURCES ENDPOINTS
// ==========================================

/**
 * GET /api/initiatives/:id/resources
 * Get resources allocated to an initiative
 */
router.get('/:id/resources', InitiativeController.getResources);

/**
 * POST /api/initiatives/:id/resources
 * Add a resource to an initiative
 */
router.post('/:id/resources', InitiativeController.addResource);

// ==========================================
// P0: RAID / Stakeholders / Watchers / History
// ==========================================

router.get('/:id/stakeholders', InitiativeController.getStakeholders);
router.post('/:id/stakeholders', InitiativeController.addStakeholder);
router.delete('/:id/stakeholders/:stakeholderId', InitiativeController.deleteStakeholder);

router.get('/:id/watchers', InitiativeController.getWatchers);
router.post('/:id/watchers', InitiativeController.addWatcher);
router.delete('/:id/watchers/:watcherId', InitiativeController.deleteWatcher);

router.get('/:id/raid', InitiativeController.getRaid);
router.post('/:id/raid', InitiativeController.createRaidItem);
router.patch('/:id/raid/:raidId', InitiativeController.updateRaidItem);
router.delete('/:id/raid/:raidId', InitiativeController.deleteRaidItem);

router.get('/:id/history', InitiativeController.getHistory);

export default router;
