/**
 * Initiatives Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * All initiative-related API endpoints with Zod validation
 */

import { type Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import InitiativeControllerRaw from '../../controllers/InitiativeController.js';
const InitiativeController = InitiativeControllerRaw as any;
import { StaffingPlanController } from '../../controllers/StaffingPlanController.js';
import { verifyToken } from '../../middleware/auth.middleware.js';
import { requireOrgRole } from '../../middleware/rbac.middleware.js';
import { demoContextMiddleware } from '../../middleware/demoGuard.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import initiativeGenerationService from '../../services/initiativeGenerationService.js';
import initiativeSectionTypeService from '../../services/initiativeSectionTypeService.js';
import initiativeTemplateService from '../../services/initiativeTemplateService.js';
import blueprintService from '../../services/blueprintService.js';
import { getCapacityTimeline, getInitiativeCapacity } from '../../services/workloadCapacityService.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import {
  CreateInitiativeSchema,
  QuickUpdateInitiativeSchema,
  UpdateInitiativeSchema,
  UpdateInitiativeStatusSchema,
  UpdateInitiativeTemplateSchema,
} from '../../validators/initiative.validators.js';

const router = Router();
const notConfigured = (res: Response) =>
  res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
  });

// Apply rate limiting
router.use(apiAuthRateLimiter);

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
 * GET /api/initiatives/portfolio/rollups
 * V4-INIT-02: Get portfolio rollups by program (hierarchy)
 */
router.get('/portfolio/rollups', InitiativeController.getPortfolioRollups);

/**
 * GET /api/initiatives/portfolio/dependencies
 * Get initiative dependencies for timeline
 */
router.get('/portfolio/dependencies', InitiativeController.getPortfolioDependencies);

/**
 * POST /api/initiatives/portfolio/dependencies
 * Create initiative dependency
 */
router.post('/portfolio/dependencies', requireOrgRole('user'), InitiativeController.createPortfolioDependency);

/**
 * DELETE /api/initiatives/portfolio/dependencies/:id
 * Remove initiative dependency
 */
router.delete(
  '/portfolio/dependencies/:id',
  requireOrgRole('user'),
  InitiativeController.deletePortfolioDependency
);

// ==========================================
// V4-INIT-02: PROGRAM HIERARCHY CRUD
// ==========================================

router.get('/programs', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const rows = await queryHelpers.queryAll(
      `SELECT p.*,
              (SELECT COUNT(*) FROM initiatives i WHERE i.program_id = p.id AND i.organization_id = p.organization_id) AS initiative_count,
              (SELECT COUNT(*) FROM programs cp WHERE cp.parent_program_id = p.id) AS child_program_count
       FROM programs p
       WHERE p.organization_id = ?
       ORDER BY p.name ASC`,
      [String(orgId)]
    );

    const programs = rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      name: r.name,
      description: r.description,
      parentProgramId: r.parent_program_id || null,
      status: r.status,
      ownerUserId: r.owner_user_id || null,
      startDate: r.start_date || null,
      endDate: r.end_date || null,
      initiativeCount: Number(r.initiative_count) || 0,
      childProgramCount: Number(r.child_program_count) || 0,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return res.json({ programs });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch programs', message: err.message });
  }
});

router.post('/programs', requireOrgRole('user'), async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { name, description, parentProgramId, status, ownerUserId, startDate, endDate } =
      req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    if (parentProgramId) {
      const parent = await queryHelpers.queryOne(
        `SELECT id FROM programs WHERE id = ? AND organization_id = ?`,
        [String(parentProgramId), String(orgId)]
      );
      if (!parent) return res.status(400).json({ error: 'Parent program not found' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    await queryHelpers.queryRun(
      `INSERT INTO programs (id, organization_id, name, description, parent_program_id, status, owner_user_id, start_date, end_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        String(orgId),
        name.trim(),
        description || null,
        parentProgramId || null,
        status || 'active',
        ownerUserId || null,
        startDate || null,
        endDate || null,
        now,
        now,
      ]
    );

    return res.status(201).json({
      id,
      organizationId: String(orgId),
      name: name.trim(),
      description: description || null,
      parentProgramId: parentProgramId || null,
      status: status || 'active',
      ownerUserId: ownerUserId || null,
      startDate: startDate || null,
      endDate: endDate || null,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create program', message: err.message });
  }
});

router.get('/programs/:programId', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { programId } = req.params;
    const program = (await queryHelpers.queryOne(
      `SELECT * FROM programs WHERE id = ? AND organization_id = ?`,
      [String(programId), String(orgId)]
    )) as any;
    if (!program) return res.status(404).json({ error: 'Program not found' });

    const childPrograms = await queryHelpers.queryAll(
      `SELECT p.*,
              (SELECT COUNT(*) FROM initiatives i WHERE i.program_id = p.id AND i.organization_id = p.organization_id) AS initiative_count
       FROM programs p
       WHERE p.parent_program_id = ? AND p.organization_id = ?
       ORDER BY p.name ASC`,
      [String(programId), String(orgId)]
    );

    const initiatives = await queryHelpers.queryAll(
      `SELECT id, name, title, status, priority, progress,
              COALESCE(cost_capex, 0) + COALESCE(cost_opex, 0) AS budget,
              COALESCE(business_value, 0) AS value
       FROM initiatives
       WHERE program_id = ? AND organization_id = ?
       ORDER BY name ASC`,
      [String(programId), String(orgId)]
    );

    return res.json({
      program: {
        id: program.id,
        organizationId: program.organization_id,
        name: program.name,
        description: program.description,
        parentProgramId: program.parent_program_id || null,
        status: program.status,
        ownerUserId: program.owner_user_id || null,
        startDate: program.start_date || null,
        endDate: program.end_date || null,
        createdAt: program.created_at,
        updatedAt: program.updated_at,
      },
      childPrograms: childPrograms.map((cp: any) => ({
        id: cp.id,
        name: cp.name,
        status: cp.status,
        parentProgramId: cp.parent_program_id,
        initiativeCount: Number(cp.initiative_count) || 0,
      })),
      initiatives: initiatives.map((i: any) => ({
        id: i.id,
        name: i.name || i.title,
        status: i.status,
        priority: i.priority,
        progress: Number(i.progress) || 0,
        budget: Number(i.budget) || 0,
        value: Number(i.value) || 0,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch program', message: err.message });
  }
});

router.put('/programs/:programId', requireOrgRole('user'), async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { programId } = req.params;
    const existing = await queryHelpers.queryOne(
      `SELECT id FROM programs WHERE id = ? AND organization_id = ?`,
      [String(programId), String(orgId)]
    );
    if (!existing) return res.status(404).json({ error: 'Program not found' });

    const { name, description, parentProgramId, status, ownerUserId, startDate, endDate } =
      req.body;

    if (parentProgramId === programId) {
      return res.status(400).json({ error: 'Program cannot be its own parent' });
    }

    if (parentProgramId) {
      const parent = await queryHelpers.queryOne(
        `SELECT id FROM programs WHERE id = ? AND organization_id = ?`,
        [String(parentProgramId), String(orgId)]
      );
      if (!parent) return res.status(400).json({ error: 'Parent program not found' });
    }

    const now = new Date().toISOString();
    await queryHelpers.queryRun(
      `UPDATE programs
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           parent_program_id = ?,
           status = COALESCE(?, status),
           owner_user_id = ?,
           start_date = ?,
           end_date = ?,
           updated_at = ?
       WHERE id = ? AND organization_id = ?`,
      [
        name || null,
        description !== undefined ? description : null,
        parentProgramId !== undefined ? parentProgramId || null : null,
        status || null,
        ownerUserId !== undefined ? ownerUserId || null : null,
        startDate !== undefined ? startDate || null : null,
        endDate !== undefined ? endDate || null : null,
        now,
        String(programId),
        String(orgId),
      ]
    );

    const updated = (await queryHelpers.queryOne(
      `SELECT * FROM programs WHERE id = ? AND organization_id = ?`,
      [String(programId), String(orgId)]
    )) as any;

    return res.json({
      id: updated.id,
      organizationId: updated.organization_id,
      name: updated.name,
      description: updated.description,
      parentProgramId: updated.parent_program_id || null,
      status: updated.status,
      ownerUserId: updated.owner_user_id || null,
      startDate: updated.start_date || null,
      endDate: updated.end_date || null,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update program', message: err.message });
  }
});

router.delete('/programs/:programId', requireOrgRole('user'), async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { programId } = req.params;
    const existing = await queryHelpers.queryOne(
      `SELECT id FROM programs WHERE id = ? AND organization_id = ?`,
      [String(programId), String(orgId)]
    );
    if (!existing) return res.status(404).json({ error: 'Program not found' });

    const initiativeCount = (await queryHelpers.queryOne(
      `SELECT COUNT(*) AS cnt FROM initiatives WHERE program_id = ? AND organization_id = ?`,
      [String(programId), String(orgId)]
    )) as any;
    if (Number(initiativeCount?.cnt) > 0) {
      return res.status(409).json({
        error: 'Cannot delete program with linked initiatives. Reassign or remove them first.',
      });
    }

    const childCount = (await queryHelpers.queryOne(
      `SELECT COUNT(*) AS cnt FROM programs WHERE parent_program_id = ?`,
      [String(programId)]
    )) as any;
    if (Number(childCount?.cnt) > 0) {
      return res.status(409).json({
        error: 'Cannot delete program with child programs. Reassign or remove them first.',
      });
    }

    await queryHelpers.queryRun(
      `DELETE FROM programs WHERE id = ? AND organization_id = ?`,
      [String(programId), String(orgId)]
    );

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete program', message: err.message });
  }
});

// ==========================================
// INITIATIVE CRUD
// ==========================================

/**
 * GET /api/initiatives
 * Get all initiatives for organization
 */
router.get('/', InitiativeController.getInitiatives);

/**
 * POST /api/initiatives/:id/duplicate
 * Duplicate a single initiative (lightweight copy; keeps assessment/report linkage).
 *
 * Note: This intentionally duplicates only the main `initiatives` row and does not clone
 * deep project-management sub-entities (tasks, RAID, etc.). Those can be re-generated later.
 */
router.post('/:id/duplicate', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const originalId = String(req.params.id || '');
    const original = (await queryHelpers.queryOne(
      `SELECT * FROM initiatives WHERE id = ? AND organization_id = ?`,
      [originalId, String(orgId)]
    )) as any;
    if (!original) return res.status(404).json({ error: 'Initiative not found' });

    const now = new Date().toISOString();
    const newId = uuidv4();
    const baseTitle = String(original.title || original.name || 'Initiative');
    const newTitle = req.body?.title ? String(req.body.title) : `${baseTitle} (Copy)`;

    // SQLite-first: duplicate using actual table columns to avoid NOT NULL surprises.
    let cols: string[] = [];
    try {
      const info = (await queryHelpers.queryAll(`PRAGMA table_info(initiatives)`)) as Array<{
        name?: string;
      }>;
      cols = (info || []).map((r) => String(r.name || '')).filter(Boolean);
    } catch {
      cols = [];
    }

    if (cols.length === 0) {
      // Fallback minimal insert (best-effort)
      await queryHelpers.queryRun(
        `INSERT INTO initiatives (id, organization_id, title, status, created_at, updated_at)
         VALUES (?, ?, ?, 'DRAFT', ?, ?)`,
        [newId, String(orgId), newTitle, now, now]
      );
      return res.status(201).json({ id: newId });
    }

    const insertCols: string[] = [];
    const insertVals: any[] = [];
    for (const c of cols) {
      insertCols.push(c);
      if (c === 'id') insertVals.push(newId);
      else if (c === 'organization_id') insertVals.push(String(orgId));
      else if (c === 'title') insertVals.push(newTitle);
      else if (c === 'name') insertVals.push(newTitle);
      else if (c === 'status') insertVals.push('DRAFT');
      else if (c === 'created_at') insertVals.push(now);
      else if (c === 'updated_at') insertVals.push(now);
      else if (c === 'created_by')
        insertVals.push(String(userId || original.created_by || 'system'));
      else if (c === 'updated_by')
        insertVals.push(String(userId || original.updated_by || 'system'));
      else insertVals.push(original[c] ?? null);
    }

    const placeholders = insertCols.map(() => '?').join(', ');
    await queryHelpers.queryRun(
      `INSERT INTO initiatives (${insertCols.join(', ')}) VALUES (${placeholders})`,
      insertVals
    );

    return res.status(201).json({ id: newId });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to duplicate initiative', message: err.message });
  }
});

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

// ==========================================
// V4-INIT-03: BLUEPRINT WBS & VALIDATION
// ==========================================

/**
 * GET /api/initiatives/templates/:templateId/wbs
 * Get WBS tree for a blueprint template
 */
router.get('/templates/:templateId/wbs', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { templateId } = req.params;
    const tree = await blueprintService.getWbsTree(String(templateId));
    return res.json({ wbs: tree });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch WBS', message: err.message });
  }
});

/**
 * POST /api/initiatives/templates/:templateId/wbs
 * Add a WBS item to a blueprint template
 */
router.post('/templates/:templateId/wbs', requireOrgRole('user'), async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { templateId } = req.params;
    const { parentId, title, itemType, level, sortOrder, estimatedHours, deliverables, acceptanceCriteria, assignedRole } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title is required' });
    }

    const item = await blueprintService.addWbsItem(String(templateId), {
      parentId, title: title.trim(), itemType, level, sortOrder,
      estimatedHours, deliverables, acceptanceCriteria, assignedRole,
    });
    return res.status(201).json({ item });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to add WBS item', message: err.message });
  }
});

/**
 * PUT /api/initiatives/templates/:templateId/wbs/:itemId
 * Update a WBS item
 */
router.put('/templates/:templateId/wbs/:itemId', requireOrgRole('user'), async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { templateId, itemId } = req.params;
    const item = await blueprintService.updateWbsItem(String(templateId), String(itemId), req.body);
    if (!item) return res.status(404).json({ error: 'WBS item not found' });
    return res.json({ item });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update WBS item', message: err.message });
  }
});

/**
 * DELETE /api/initiatives/templates/:templateId/wbs/:itemId
 * Delete a WBS item (cascades to children)
 */
router.delete('/templates/:templateId/wbs/:itemId', requireOrgRole('user'), async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { templateId, itemId } = req.params;
    const deleted = await blueprintService.deleteWbsItem(String(templateId), String(itemId));
    if (!deleted) return res.status(404).json({ error: 'WBS item not found' });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete WBS item', message: err.message });
  }
});

/**
 * POST /api/initiatives/templates/:templateId/wbs/reorder
 * Reorder WBS items
 */
router.post('/templates/:templateId/wbs/reorder', requireOrgRole('user'), async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { templateId } = req.params;
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items array is required' });
    }

    await blueprintService.reorderWbsItems(String(templateId), items);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to reorder WBS items', message: err.message });
  }
});

/**
 * GET /api/initiatives/templates/:templateId/validate
 * Validate blueprint completeness
 */
router.get('/templates/:templateId/validate', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { templateId } = req.params;
    const validation = await blueprintService.validateBlueprint(String(templateId));
    return res.json(validation);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to validate blueprint', message: err.message });
  }
});

/**
 * POST /api/initiatives/templates/:templateId/clone
 * Deep clone a blueprint template (including WBS items)
 */
router.post('/templates/:templateId/clone', requireOrgRole('user'), async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { templateId } = req.params;
    const result = await blueprintService.cloneBlueprint(String(templateId), String(orgId), String(userId));
    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to clone blueprint', message: err.message });
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
 * POST /api/initiatives/:id/apply-template
 * Apply a template to an initiative: creates suggested tasks, milestones, decisions, KPIs, RAID items
 */
router.post('/:id/apply-template', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const { templateId } = req.body;
    if (!templateId) return res.status(400).json({ error: 'templateId is required' });

    // Verify initiative exists
    const initiative = (await queryHelpers.queryOne(
      `SELECT id, name, title FROM initiatives WHERE id = ? AND organization_id = ?`,
      [String(id), String(orgId)]
    )) as any;
    if (!initiative) return res.status(404).json({ error: 'Initiative not found' });

    // Fetch template
    const template = await initiativeTemplateService.getTemplateById(String(templateId));
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const now = new Date().toISOString();
    const created = { tasks: 0, milestones: 0, decisions: 0, kpis: 0, raidItems: 0 };

    // 1. Create suggested tasks (V3: suggestedTaskItems)
    const taskItems = template.suggestedTaskItems || [];
    for (const task of taskItems) {
      try {
        const taskId = uuidv4();
        await queryHelpers.queryRun(
          `INSERT INTO tasks (id, organization_id, initiative_id, title, type, priority, status, step_phase, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'TODO', ?, ?, ?, ?)`,
          [
            taskId,
            String(orgId),
            String(id),
            String(task.title || 'Untitled task'),
            String(task.taskType || task.type || 'general'),
            String(task.priority || 'medium'),
            String(task.stepPhase || task.phase || null),
            String(userId || 'system'),
            now,
            now,
          ]
        );
        created.tasks++;
      } catch {
        // table schema may differ — skip individual failures
      }
    }

    // Fallback: V1 suggestedTasks (simple string array)
    if (taskItems.length === 0 && template.suggestedTasks?.length) {
      for (const taskTitle of template.suggestedTasks) {
        try {
          const taskId = uuidv4();
          await queryHelpers.queryRun(
            `INSERT INTO tasks (id, organization_id, initiative_id, title, status, created_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'TODO', ?, ?, ?)`,
            [
              taskId,
              String(orgId),
              String(id),
              String(taskTitle),
              String(userId || 'system'),
              now,
              now,
            ]
          );
          created.tasks++;
        } catch {
          // skip
        }
      }
    }

    // 2. Create suggested milestones
    const milestones = template.suggestedMilestones || [];
    for (let i = 0; i < milestones.length; i++) {
      const ms = milestones[i];
      try {
        const msId = uuidv4();
        await queryHelpers.queryRun(
          `INSERT INTO initiative_milestones (id, initiative_id, organization_id, name, description, status, is_gate, order_index, created_at)
           VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`,
          [
            msId,
            String(id),
            String(orgId),
            String(ms.name || `Milestone ${i + 1}`),
            String(ms.description || ''),
            ms.isGate ? 1 : 0,
            ms.order ?? i,
            now,
          ]
        );
        created.milestones++;
      } catch {
        // skip
      }
    }

    // 3. Create suggested decisions (gate decisions)
    const decisions = template.suggestedDecisions || [];
    for (const dec of decisions) {
      try {
        const decId = uuidv4();
        await queryHelpers.queryRun(
          `INSERT INTO decisions (id, organization_id, initiative_id, title, type, priority, status, pmo_domain, trigger_status, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
          [
            decId,
            String(orgId),
            String(id),
            String(dec.title || 'Untitled decision'),
            String(dec.type || 'APPROVAL'),
            String(dec.priority || 'medium'),
            String(dec.pmoDomain || dec.pmo_domain || null),
            String(dec.triggerStatus || dec.trigger_status || null),
            String(userId || 'system'),
            now,
            now,
          ]
        );
        created.decisions++;
      } catch {
        // skip — decisions table schema may vary
      }
    }

    // 4. Create suggested KPIs
    const kpis = template.suggestedKpis || [];
    for (const kpi of kpis) {
      try {
        const kpiId = uuidv4();
        await queryHelpers.queryRun(
          `INSERT INTO initiative_kpis (id, initiative_id, organization_id, name, unit, target_value, frequency, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            kpiId,
            String(id),
            String(orgId),
            String(kpi.name || 'Untitled KPI'),
            String(kpi.unit || '%'),
            kpi.targetValue ?? kpi.target_value ?? null,
            String(kpi.frequency || kpi.measurementFrequency || 'monthly'),
            now,
          ]
        );
        created.kpis++;
      } catch {
        // skip
      }
    }

    // 5. Create RAID template items
    const raidItems = template.raidTemplates || [];
    for (const item of raidItems) {
      try {
        const raidId = uuidv4();
        await queryHelpers.queryRun(
          `INSERT INTO raid_items (id, initiative_id, organization_id, type, title, description, severity, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?)`,
          [
            raidId,
            String(id),
            String(orgId),
            String(item.type || 'RISK').toUpperCase(),
            String(item.title || 'Untitled'),
            String(item.description || ''),
            String(item.impact || item.severity || 'MEDIUM').toUpperCase(),
            now,
            now,
          ]
        );
        created.raidItems++;
      } catch {
        // skip
      }
    }

    // Update initiative template reference
    await queryHelpers.queryRun(
      `UPDATE initiatives SET initiative_template_id = ?, updated_at = ? WHERE id = ? AND organization_id = ?`,
      [String(templateId), now, String(id), String(orgId)]
    );

    return res.json({
      success: true,
      initiativeId: id,
      templateId,
      templateName: template.name,
      created,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to apply template', message: err.message });
  }
});

/**
 * POST /api/initiatives/:id/apply-blueprint
 * Enhanced apply that includes WBS tasks, milestone dependencies, role templates, and DoD per level
 */
router.post('/:id/apply-blueprint', requireOrgRole('user'), async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const { templateId } = req.body;
    if (!templateId) return res.status(400).json({ error: 'templateId is required' });

    const initiative = await queryHelpers.queryOne(
      `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
      [String(id), String(orgId)]
    );
    if (!initiative) return res.status(404).json({ error: 'Initiative not found' });

    const template = await initiativeTemplateService.getTemplateById(String(templateId));
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const wbsResult = await blueprintService.applyWbs(String(templateId), String(id), String(orgId), String(userId));
    const msResult = await blueprintService.applyMilestoneDependencies(String(templateId), String(id), String(orgId));
    const roleResult = await blueprintService.applyRoleTemplates(String(templateId), String(id), String(orgId), String(userId));
    const dodResult = await blueprintService.applyDoDPerLevel(String(templateId), String(id));

    await queryHelpers.queryRun(
      `UPDATE initiatives SET initiative_template_id = ?, updated_at = ? WHERE id = ? AND organization_id = ?`,
      [String(templateId), new Date().toISOString(), String(id), String(orgId)]
    );

    return res.json({
      success: true,
      initiativeId: id,
      templateId,
      templateName: template.name,
      applied: {
        tasksCreated: wbsResult.tasksCreated,
        milestonesCreated: msResult.milestonesCreated,
        rolesCreated: roleResult.rolesCreated,
        dodLevelsApplied: dodResult.levelsApplied,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to apply blueprint', message: err.message });
  }
});

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
    return res
      .status(500)
      .json({ error: 'Failed to duplicate section type', message: err.message });
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
    const statusCodeRaw = Number(err?.statusCode ?? err?.status ?? 500);
    const statusCode =
      Number.isFinite(statusCodeRaw) && statusCodeRaw >= 100 && statusCodeRaw <= 599
        ? statusCodeRaw
        : 500;

    if (statusCode === 503 || err?.code === 'FEATURE_UNAVAILABLE') {
      return notConfigured(res);
    }

    return res.status(statusCode).json({
      error: 'Failed to generate section content',
      message: err?.message,
    });
  }
});

/**
 * POST /api/initiatives/readiness-analysis
 * AI-powered readiness analysis for the next gate
 * Body: { initiativeId }
 */
router.post('/readiness-analysis', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { initiativeId } = req.body;
    if (!initiativeId) return res.status(400).json({ error: 'initiativeId is required' });

    // Fetch initiative + related data
    const initiative = (await queryHelpers.queryOne(
      `SELECT * FROM initiatives WHERE id = ? AND organization_id = ?`,
      [String(initiativeId), String(orgId)]
    )) as any;
    if (!initiative) return res.status(404).json({ error: 'Initiative not found' });

    // Gather context
    let taskCount = 0;
    let taskDone = 0;
    let decisionCount = 0;
    let decisionApproved = 0;
    let raidCritical = 0;

    try {
      const taskRows = await queryHelpers.queryAll<any>(
        `SELECT status FROM tasks WHERE initiative_id = ? AND organization_id = ?`,
        [String(initiativeId), String(orgId)]
      );
      taskCount = taskRows.length;
      taskDone = taskRows.filter((t: any) => ['done', 'DONE'].includes(t.status)).length;
    } catch {
      /* tasks table may not exist */
    }

    try {
      const decRows = await queryHelpers.queryAll<any>(
        `SELECT status FROM decisions WHERE initiative_id = ? AND organization_id = ?`,
        [String(initiativeId), String(orgId)]
      );
      decisionCount = decRows.length;
      decisionApproved = decRows.filter((d: any) =>
        ['approved', 'APPROVED'].includes(d.status)
      ).length;
    } catch {
      /* */
    }

    try {
      const raidRows = await queryHelpers.queryAll<any>(
        `SELECT severity FROM raid_items WHERE initiative_id = ? AND organization_id = ? AND status != 'RESOLVED'`,
        [String(initiativeId), String(orgId)]
      );
      raidCritical = raidRows.filter((r: any) =>
        ['HIGH', 'CRITICAL'].includes(String(r.severity || '').toUpperCase())
      ).length;
    } catch {
      /* */
    }

    // Generate AI readiness analysis
    const result = await initiativeGenerationService.generateSectionContent(
      'gates',
      {
        initiativeId: String(initiativeId),
        initiativeName: initiative.name || initiative.title || 'Initiative',
        summary: initiative.summary || '',
        problemStatement: initiative.problem_statement || '',
        status: initiative.status || 'DRAFT',
        completedTasks: taskDone,
        totalTasks: taskCount,
        openRisks: raidCritical,
        openDecisions: decisionCount - decisionApproved,
        language: req.body.language || 'en',
      },
      String(orgId)
    );

    return res.json({
      analysis: result.content,
      parsedAnalysis: result.parsedContent,
      metrics: {
        tasksProgress: taskCount > 0 ? Math.round((taskDone / taskCount) * 100) : 0,
        decisionsApproved: decisionApproved,
        decisionsPending: decisionCount - decisionApproved,
        criticalRisks: raidCritical,
        hasOwner: !!initiative.owner_business_id || !!initiative.owner_execution_id,
        hasTimeline: !!initiative.planned_start_date && !!initiative.planned_end_date,
        hasSummary: !!(initiative.summary || '').trim(),
        hasProblemStatement: !!(initiative.problem_statement || '').trim(),
      },
      model: result.model,
    });
  } catch (err: any) {
    const statusCodeRaw = Number(err?.statusCode ?? err?.status ?? 500);
    const statusCode =
      Number.isFinite(statusCodeRaw) && statusCodeRaw >= 100 && statusCodeRaw <= 599
        ? statusCodeRaw
        : 500;

    if (statusCode === 503 || err?.code === 'FEATURE_UNAVAILABLE') {
      return notConfigured(res);
    }

    return res
      .status(statusCode)
      .json({ error: 'Failed to analyze readiness', message: err?.message });
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
    const statusCodeRaw = Number(err?.statusCode ?? err?.status ?? 500);
    const statusCode =
      Number.isFinite(statusCodeRaw) && statusCodeRaw >= 100 && statusCodeRaw <= 599
        ? statusCodeRaw
        : 500;

    if (statusCode === 503 || err?.code === 'FEATURE_UNAVAILABLE') {
      return notConfigured(res);
    }

    return res.status(statusCode).json({
      error: 'Failed to suggest sections',
      message: err?.message,
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

/**
 * PATCH /api/initiatives/:id
 * Backwards-compatible alias for clients that used a generic PATCH.
 *
 * - If the payload contains `status`, delegate to the canonical `/status` handler
 *   (keeps transition validation + governance rules).
 * - Otherwise, delegate to the canonical update handler (same as PUT, but accepts partial payloads).
 */
router.patch('/:id', (req, res, next) => {
  const body = (req as any)?.body || {};
  const hasStatus = body && Object.prototype.hasOwnProperty.call(body, 'status');

  if (hasStatus) {
    return (validateBody(UpdateInitiativeStatusSchema) as any)(req, res, (err?: unknown) => {
      if (err) return next(err);
      return (InitiativeController.updateInitiativeStatus as any)(req, res, next);
    });
  }

  return (validateBody(UpdateInitiativeSchema) as any)(req, res, (err?: unknown) => {
    if (err) return next(err);
    return (InitiativeController.updateInitiative as any)(req, res, next);
  });
});

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
// V4-EXEC-04: INITIATIVE CAPACITY
// ==========================================

router.get('/:id/capacity', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const capacity = await getInitiativeCapacity(String(orgId), String(req.params.id));
    return res.json(capacity);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch initiative capacity', message: err.message });
  }
});

router.get('/:id/capacity/timeline', async (req: any, res: any) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const timeline = await getCapacityTimeline(String(orgId), String(req.params.id));
    return res.json({ weeks: timeline });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch capacity timeline', message: err.message });
  }
});

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
// ROADMAP MODULE: SCHEDULE BASELINES (Timeline lock)
// ==========================================

/**
 * GET /api/initiatives/:id/schedule-baselines
 * List schedule baseline snapshots
 */
router.get('/:id/schedule-baselines', InitiativeController.getScheduleBaselines);

/**
 * GET /api/initiatives/:id/schedule-baselines/:version
 * Get a single baseline snapshot (by version)
 */
router.get('/:id/schedule-baselines/:version', InitiativeController.getScheduleBaseline);

// ==========================================
// ROADMAP MODULE: RESOURCES ENDPOINTS
// ==========================================

const ResourcesAiApplyLogSchema = z.object({
  scope: z.enum(['budget', 'fte', 'tools', 'intangibles', 'all']),
  budgetAdded: z.number().int().min(0),
  fteAdded: z.number().int().min(0),
  toolsAdded: z.number().int().min(0),
  intangiblesAdded: z.number().int().min(0),
  note: z.string().nullable().optional(),
});

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

/**
 * DELETE /api/initiatives/:id/resources/:resourceId
 * Remove a resource from an initiative
 */
router.delete('/:id/resources/:resourceId', InitiativeController.deleteResource);

/**
 * PUT /api/initiatives/:id/resources/:resourceId
 * Update a resource in an initiative
 */
router.put('/:id/resources/:resourceId', InitiativeController.updateResource);

/**
 * POST /api/initiatives/:id/resources/ai-apply-log
 * Write a single audit entry after applying AI proposals.
 */
router.post(
  '/:id/resources/ai-apply-log',
  validateBody(ResourcesAiApplyLogSchema),
  InitiativeController.logResourcesAiApply
);

// ==========================================
// V4-INIT-05: STAFFING PLANS
// ==========================================

router.get('/:id/staffing-plans', StaffingPlanController.listPlans);
router.post('/:id/staffing-plans', requireOrgRole('user'), StaffingPlanController.createPlan);
router.get('/:id/staffing-plans/:planId', StaffingPlanController.getPlan);
router.put('/:id/staffing-plans/:planId', requireOrgRole('user'), StaffingPlanController.updatePlan);
router.delete('/:id/staffing-plans/:planId', requireOrgRole('user'), StaffingPlanController.deletePlan);

router.post('/:id/staffing-plans/:planId/roles', requireOrgRole('user'), StaffingPlanController.addRole);
router.put('/:id/staffing-plans/:planId/roles/:roleId', requireOrgRole('user'), StaffingPlanController.updateRole);
router.delete('/:id/staffing-plans/:planId/roles/:roleId', requireOrgRole('user'), StaffingPlanController.deleteRole);

router.get('/:id/staffing-plans/:planId/gaps', StaffingPlanController.getGaps);
router.post('/:id/staffing-plans/:planId/sync-capacity', requireOrgRole('user'), StaffingPlanController.syncCapacity);

// ==========================================
// ROADMAP MODULE: BUDGET ITEMS ENDPOINTS
// ==========================================

/**
 * GET /api/initiatives/:id/budget-items
 * Get all budget items for an initiative
 */
router.get('/:id/budget-items', InitiativeController.getBudgetItems);

/**
 * POST /api/initiatives/:id/budget-items
 * Add a budget item to an initiative
 */
router.post('/:id/budget-items', InitiativeController.addBudgetItem);

/**
 * PUT /api/initiatives/:id/budget-items/:itemId
 * Update a budget item
 */
router.put('/:id/budget-items/:itemId', InitiativeController.updateBudgetItem);

/**
 * DELETE /api/initiatives/:id/budget-items/:itemId
 * Delete a budget item
 */
router.delete('/:id/budget-items/:itemId', InitiativeController.deleteBudgetItem);

// ==========================================
// ROADMAP MODULE: TOOLS ENDPOINTS
// ==========================================

/**
 * GET /api/initiatives/:id/tools
 * Get all tools for an initiative
 */
router.get('/:id/tools', InitiativeController.getTools);

/**
 * POST /api/initiatives/:id/tools
 * Add a tool to an initiative
 */
router.post('/:id/tools', InitiativeController.addTool);

/**
 * PUT /api/initiatives/:id/tools/:toolId
 * Update a tool
 */
router.put('/:id/tools/:toolId', InitiativeController.updateTool);

/**
 * DELETE /api/initiatives/:id/tools/:toolId
 * Delete a tool
 */
router.delete('/:id/tools/:toolId', InitiativeController.deleteTool);

// ==========================================
// ROADMAP MODULE: INTANGIBLE ASSETS ENDPOINTS
// ==========================================

/**
 * GET /api/initiatives/:id/intangible-assets
 * Get all intangible assets for an initiative
 */
router.get('/:id/intangible-assets', InitiativeController.getIntangibleAssets);

/**
 * POST /api/initiatives/:id/intangible-assets
 * Add an intangible asset to an initiative
 */
router.post('/:id/intangible-assets', InitiativeController.addIntangibleAsset);

/**
 * PUT /api/initiatives/:id/intangible-assets/:assetId
 * Update an intangible asset
 */
router.put('/:id/intangible-assets/:assetId', InitiativeController.updateIntangibleAsset);

/**
 * DELETE /api/initiatives/:id/intangible-assets/:assetId
 * Delete an intangible asset
 */
router.delete('/:id/intangible-assets/:assetId', InitiativeController.deleteIntangibleAsset);

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

// ==========================================
// INITIATIVE COMMENTS
// ==========================================

router.get('/:id/comments', InitiativeController.getInitiativeComments);
router.post('/:id/comments', InitiativeController.addInitiativeComment);
router.delete('/:id/comments/:commentId', InitiativeController.deleteInitiativeComment);

// ==========================================
// INITIATIVE TASK DEPENDENCIES (aggregated)
// ==========================================

/**
 * GET /api/initiatives/:id/task-dependencies
 * Aggregate task dependencies within the initiative (for Dependencies section).
 */
router.get('/:id/task-dependencies', InitiativeController.getInitiativeTaskDependencies);

// ==========================================
// Gate Roles & Governance
// ==========================================

router.get('/:id/gate-roles', InitiativeController.getGateRoles);
router.put('/:id/gate-roles', InitiativeController.updateGateRoles);
router.get('/:id/gate-readiness-check', InitiativeController.getGateReadinessCheck);
router.get('/:id/status-history', InitiativeController.getStatusHistory);

export default router;
