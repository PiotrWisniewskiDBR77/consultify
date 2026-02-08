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
import initiativeGenerationService from '../../services/initiativeGenerationService.js';
import initiativeSectionTypeService from '../../services/initiativeSectionTypeService.js';
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
 * POST /api/initiatives/templates
 * Create a new initiative template (org-scoped)
 */
router.post('/templates', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const template = await initiativeTemplateService.createTemplate(
      { ...req.body, organizationId: String(orgId) },
      String(userId)
    );
    return res.status(201).json({ template });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create template', message: err.message });
  }
});

/**
 * PUT /api/initiatives/templates/:templateId
 * Update an initiative template (org-scoped only)
 */
router.put('/templates/:templateId', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { templateId } = req.params;
    const existing = await initiativeTemplateService.getTemplateById(String(templateId));
    if (!existing) return res.status(404).json({ error: 'Template not found' });
    if (existing.isPublic && !existing.organizationId) {
      return res.status(403).json({ error: 'Cannot edit system templates' });
    }
    if (existing.organizationId && existing.organizationId !== String(orgId)) {
      return res.status(403).json({ error: 'Not authorized to edit this template' });
    }

    const updated = await initiativeTemplateService.updateTemplate(
      String(templateId),
      req.body,
      req.user?.id
    );
    return res.json({ template: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update template', message: err.message });
  }
});

/**
 * DELETE /api/initiatives/templates/:templateId
 * Delete an initiative template (org-scoped only, cannot delete system)
 */
router.delete('/templates/:templateId', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { templateId } = req.params;
    const existing = await initiativeTemplateService.getTemplateById(String(templateId));
    if (!existing) return res.status(404).json({ error: 'Template not found' });
    if (existing.isPublic && !existing.organizationId) {
      return res.status(403).json({ error: 'Cannot delete system templates' });
    }
    if (existing.organizationId && existing.organizationId !== String(orgId)) {
      return res.status(403).json({ error: 'Not authorized to delete this template' });
    }

    await initiativeTemplateService.deleteTemplate(String(templateId));
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete template', message: err.message });
  }
});

/**
 * POST /api/initiatives/templates/:templateId/duplicate
 * Duplicate a template to the org scope
 */
router.post('/templates/:templateId/duplicate', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { templateId } = req.params;
    const source = await initiativeTemplateService.getTemplateById(String(templateId));
    if (!source) return res.status(404).json({ error: 'Source template not found' });

    const newName = req.body?.name || `${source.name} (Copy)`;

    // Create a duplicate as org-scoped
    const duplicate = await initiativeTemplateService.createTemplate(
      {
        name: newName,
        category: source.category,
        description: source.description || undefined,
        applicableAxes: source.applicableAxes,
        problemStructured: source.problemStructured || undefined,
        targetState: source.targetState || undefined,
        killCriteria: source.killCriteria,
        suggestedTasks: source.suggestedTasks,
        suggestedRoles: source.suggestedRoles,
        typicalTimeline: source.typicalTimeline || undefined,
        typicalBudgetRange: source.typicalBudgetRange || undefined,
        isPublic: false,
        organizationId: String(orgId),
      },
      String(userId)
    );
    return res.status(201).json({ template: duplicate });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to duplicate template', message: err.message });
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

// ==========================================
// INITIATIVE SECTION TYPES (Library)
// ==========================================

/**
 * GET /api/initiatives/section-types
 * List all section types (system + org-specific)
 */
router.get('/section-types', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    const sectionTypes = await initiativeSectionTypeService.getAllSectionTypes(orgId);
    return res.json(sectionTypes);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch section types', message: err.message });
  }
});

/**
 * GET /api/initiatives/section-types/:id
 * Get single section type by ID
 */
router.get('/section-types/:id', async (req: any, res: any) => {
  try {
    const sectionType = await initiativeSectionTypeService.getSectionTypeById(req.params.id);
    if (!sectionType) return res.status(404).json({ error: 'Section type not found' });
    return res.json(sectionType);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch section type', message: err.message });
  }
});

/**
 * POST /api/initiatives/section-types
 * Create a new organization section type
 */
router.post('/section-types', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const created = await initiativeSectionTypeService.createSectionType({
      ...req.body,
      organizationId: orgId,
      createdBy: req.user?.id,
    });
    return res.status(201).json(created);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create section type', message: err.message });
  }
});

/**
 * PUT /api/initiatives/section-types/:id
 * Update an organization section type
 */
router.put('/section-types/:id', async (req: any, res: any) => {
  try {
    const updated = await initiativeSectionTypeService.updateSectionType(req.params.id, req.body);
    return res.json(updated);
  } catch (err: any) {
    if (err.message?.includes('system')) {
      return res.status(403).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Failed to update section type', message: err.message });
  }
});

/**
 * DELETE /api/initiatives/section-types/:id
 * Deactivate a section type (soft delete)
 */
router.delete('/section-types/:id', async (req: any, res: any) => {
  try {
    await initiativeSectionTypeService.deleteSectionType(req.params.id);
    return res.json({ success: true });
  } catch (err: any) {
    if (err.message?.includes('system')) {
      return res.status(403).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Failed to delete section type', message: err.message });
  }
});

/**
 * POST /api/initiatives/section-types/:id/duplicate
 * Duplicate a section type to organization
 */
router.post('/section-types/:id/duplicate', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const duplicated = await initiativeSectionTypeService.duplicateSectionType(
      req.params.id,
      orgId,
      req.user?.id
    );
    return res.status(201).json(duplicated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to duplicate section type', message: err.message });
  }
});

// ==========================================
// AI GENERATION ENDPOINTS
// ==========================================

/**
 * POST /api/initiatives/generate-section
 * Generate AI content for a specific initiative section
 * Body: { sectionKey, initiativeId?, initiativeName, summary?, language?, ... }
 */
router.post('/generate-section', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { sectionKey, ...context } = req.body;
    if (!sectionKey) {
      return res.status(400).json({ error: 'sectionKey is required' });
    }

    const result = await initiativeGenerationService.generateSectionContent(
      sectionKey,
      { ...context, language: context.language || 'en' },
      String(orgId)
    );

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({
      error: 'Failed to generate section content',
      message: err.message,
    });
  }
});

/**
 * POST /api/initiatives/suggest-sections
 * Get AI suggestions for which sections to enable
 * Body: { initiativeName, summary?, category?, module? }
 */
router.post('/suggest-sections', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const suggestions = await initiativeGenerationService.suggestSections(
      { ...req.body, language: req.body.language || 'en' },
      String(orgId)
    );

    return res.json({ suggestions });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Failed to suggest sections',
      message: err.message,
    });
  }
});

// ==========================================
// INITIATIVE CRUD
// ==========================================

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
