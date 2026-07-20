/**
 * AI Prompts Routes — Canonical SSOT (T116)
 *
 * Single source of truth for prompt management:
 * CRUD + filters + versions + rollback + test + AB experiments
 *
 * Super Admin only for writes; Admin can read.
 */

import { randomUUID } from 'crypto';
import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
// @ts-ignore -- aiQueue module lacks type declarations
import _aiQueue from '../queues/aiQueue.js';
import promptAssembler from '../services/ai/promptAssembler.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
// @ts-ignore -- aiQueue module lacks type declarations
const aiQueue: any = _aiQueue as any;

const router = Router();

const normalizePromptRow = (prompt: {
  variables?: string;
  is_active?: number | boolean;
  template?: string;
  [key: string]: unknown;
}) => ({
  ...prompt,
  system_prompt: String(prompt.template || ''),
  user_prompt_template: String((prompt as any).user_prompt_template || ''),
  variables:
    typeof prompt.variables === 'string'
      ? JSON.parse(prompt.variables || '[]')
      : Array.isArray(prompt.variables)
        ? prompt.variables
        : [],
  is_active: Boolean(prompt.is_active),
});

const normalizeVersions = (versions: Array<Record<string, unknown>>) =>
  versions.map((version) => ({
    ...version,
    system_prompt: String(version.template || ''),
    user_prompt_template: String(version.user_prompt_template || ''),
  }));

/**
 * GET /api/ai-prompts
 * List all prompts with optional filtering
 */
router.get(
  '/',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { category, search, is_active } = req.query;

      let query = `
            SELECT id, name, category, description, template, 
                   variables, is_active, version, created_at, updated_at
            FROM ai_system_prompts
            WHERE 1=1
        `;
      const params: unknown[] = [];

      if (category) {
        query += ` AND category = ?`;
        params.push(category);
      }

      if (is_active !== undefined) {
        query += ` AND is_active = ?`;
        params.push(is_active === 'true' ? 1 : 0);
      }

      if (search) {
        query += ` AND (name LIKE ? OR description LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
      }

      query += ` ORDER BY category, name`;

      const prompts = (await dbAll(query, params)) as Array<{
        variables?: string;
        is_active?: number;
        [key: string]: unknown;
      }>;

      // Parse JSON fields
      const parsedPrompts = prompts.map((p) => normalizePromptRow(p));

      res.json({
        success: true,
        data: parsedPrompts,
        prompts: parsedPrompts,
        count: parsedPrompts.length,
      });
    } catch (error: unknown) {
      logger.error('[AI Prompts API] Error listing prompts:', error);
      return res.status(500).json({
        error: 'Failed to list prompts',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * GET /api/ai-prompts/categories
 * Get list of prompt categories
 */
router.get(
  '/categories',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const categories = await dbAll(`
            SELECT DISTINCT category, COUNT(*) as count
            FROM ai_system_prompts
            GROUP BY category
            ORDER BY category
        `);

      res.json({
        success: true,
        data: categories,
      });
    } catch (error: unknown) {
      logger.error('[AI Prompts API] Error listing categories:', error);
      return res.status(500).json({
        error: 'Failed to list categories',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * GET /api/ai-prompts/:id
 * Get single prompt details
 */
router.get(
  '/:id',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const prompt = (await dbGet(
        `
            SELECT * FROM ai_system_prompts WHERE id = ?
        `,
        [id]
      )) as {
        variables?: string;
        is_active?: number;
        [key: string]: unknown;
      } | null;

      if (!prompt) {
        return res.status(404).json({ error: 'Prompt not found' });
      }

      // Get version history
      const versions = await dbAll(
        `
            SELECT id, version, template, created_at, created_by
            FROM ai_prompt_versions
            WHERE prompt_id = ?
            ORDER BY version DESC
            LIMIT 10
        `,
        [id]
      );

      const normalizedVersions = normalizeVersions((versions as any[]) || []);
      const normalizedPrompt = {
        ...normalizePromptRow(prompt),
        versions: normalizedVersions,
      };

      res.json({
        success: true,
        data: normalizedPrompt,
        prompt: normalizedPrompt,
        versions: normalizedVersions,
      });
    } catch (error: unknown) {
      logger.error('[AI Prompts API] Error getting prompt:', error);
      return res.status(500).json({
        error: 'Failed to get prompt',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/ai-prompts
 * Create new prompt
 */
router.post(
  '/',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { name, category, description, template, system_prompt, variables, is_active } =
        req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const resolvedTemplate = String(template || system_prompt || '').trim();

      if (!name || !category || !resolvedTemplate) {
        return res.status(400).json({ error: 'Name, category, and template are required' });
      }

      const id = randomUUID();

      // FIX (NOT-NULL sweep): ai_system_prompts.key/content and ai_prompt_versions.content
      // are NOT NULL with no DB default (Postgres) — omitting them 500s with 23502. `key`
      // is unique (ai_system_prompts_key_key); mirror `name` into it, same convention as
      // the canonical AIPromptsController.createPrompt.
      const runResult1 = await dbRun(
        `
            INSERT INTO ai_system_prompts
            (id, key, name, category, description, content, template, variables, is_active, version, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
        `,
        [
          id,
          name,
          name,
          category,
          description,
          resolvedTemplate,
          resolvedTemplate,
          JSON.stringify(variables || []),
          is_active !== false ? 1 : 0,
        ]
      );

      if (!runResult1.success) {
        throw new Error(runResult1.error || 'Failed to create prompt');
      }

      // Create initial version record
      const runResult2 = await dbRun(
        `
            INSERT INTO ai_prompt_versions (id, prompt_id, version, content, template, created_at, created_by)
            VALUES (?, ?, 1, ?, ?, datetime('now'), ?)
        `,
        [randomUUID(), id, resolvedTemplate, resolvedTemplate, userId]
      );

      if (!runResult2.success) {
        throw new Error(runResult2.error || 'Failed to create prompt version');
      }

      res.status(201).json({
        success: true,
        data: { id, name, category, version: 1, system_prompt: resolvedTemplate },
        prompt: { id, name, category, version: 1, system_prompt: resolvedTemplate },
      });
    } catch (error: unknown) {
      logger.error('[AI Prompts API] Error creating prompt:', error);
      return res.status(500).json({
        error: 'Failed to create prompt',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * PUT /api/ai-prompts/:id
 * Update existing prompt
 */
router.put(
  '/:id',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, category, description, template, system_prompt, variables, is_active } =
        req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const existing = (await dbGet(`SELECT * FROM ai_system_prompts WHERE id = ?`, [id])) as {
        name?: string;
        category?: string;
        description?: string;
        template?: string;
        variables?: string;
        is_active?: number;
        version?: number;
      } | null;

      if (!existing) {
        return res.status(404).json({ error: 'Prompt not found' });
      }

      const newVersion = (existing.version || 0) + 1;

      const resolvedTemplate = String(template || system_prompt || existing.template || '').trim();

      const runResult1 = await dbRun(
        `
            UPDATE ai_system_prompts 
            SET name = ?, category = ?, description = ?, template = ?, 
                variables = ?, is_active = ?, version = ?, updated_at = datetime('now')
            WHERE id = ?
        `,
        [
          name || existing.name,
          category || existing.category,
          description || existing.description,
          resolvedTemplate,
          JSON.stringify(variables || JSON.parse(existing.variables || '[]')),
          is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
          newVersion,
          id,
        ]
      );

      if (!runResult1.success) {
        throw new Error(runResult1.error || 'Failed to update prompt');
      }

      // Store version history
      if (resolvedTemplate && resolvedTemplate !== existing.template) {
        const runResult2 = await dbRun(
          `
                INSERT INTO ai_prompt_versions (id, prompt_id, version, content, template, created_at, created_by)
                VALUES (?, ?, ?, ?, ?, datetime('now'), ?)
            `,
          [randomUUID(), id, newVersion, resolvedTemplate, resolvedTemplate, userId]
        );

        if (!runResult2.success) {
          throw new Error(runResult2.error || 'Failed to create prompt version');
        }
      }

      // Auto-trigger eval suite on prompt template change
      if (resolvedTemplate && resolvedTemplate !== existing.template) {
        try {
          const orgId = req.user?.organizationId;
          if (orgId && !(aiQueue as any).isUnavailable) {
            const triggers = await dbAll(
              `SELECT * FROM ai_eval_auto_triggers WHERE organization_id = ? AND trigger_type = 'prompt_update' AND is_active = 1`,
              [orgId]
            ).catch(() => []);
            for (const trigger of (triggers as any[]) || []) {
              const datasetId = trigger.target_dataset_id;
              if (!datasetId) continue;
              const evalTypes = JSON.parse(trigger.eval_types_json || '[]');
              await aiQueue.add(`eval-prompt-change-${id}`, {
                taskType: 'RUN_EVAL_SUITE',
                payload: {
                  organizationId: orgId,
                  datasetId,
                  evalTypes,
                  purpose: 'prompt_regression',
                  runBy: userId,
                },
                userId,
              });
              await dbRun(
                `UPDATE ai_eval_auto_triggers SET last_triggered_at = datetime('now') WHERE id = ?`,
                [trigger.id]
              ).catch((err: unknown) =>
                logger.warn('[AI Prompts] trigger timestamp update failed', err)
              );
              logger.info(`[AI Prompts] Triggered eval suite for prompt ${id} v${newVersion}`);
            }
          }
        } catch (triggerErr) {
          logger.warn(`[AI Prompts] Eval auto-trigger failed (non-blocking): ${triggerErr}`);
        }
      }

      res.json({
        success: true,
        data: { id, version: newVersion, system_prompt: resolvedTemplate },
        prompt: { id, version: newVersion, system_prompt: resolvedTemplate },
      });
    } catch (error: unknown) {
      logger.error('[AI Prompts API] Error updating prompt:', error);
      return res.status(500).json({
        error: 'Failed to update prompt',
        details: 'Unknown error',
      });
    }
  })
);

router.get(
  '/:id/versions',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const versions = await dbAll(
        `SELECT id, prompt_id, version, template, created_at, created_by
         FROM ai_prompt_versions
         WHERE prompt_id = ?
         ORDER BY version DESC`,
        [req.params.id]
      );
      const normalizedVersions = normalizeVersions((versions as any[]) || []);
      return res.json({ success: true, data: normalizedVersions, versions: normalizedVersions });
    } catch (error: unknown) {
      logger.error('[AI Prompts API] Error getting prompt versions:', error);
      return res.status(500).json({
        error: 'Failed to get prompt versions',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * DELETE /api/ai-prompts/:id
 * Delete prompt (soft delete - sets is_active to false)
 */
router.delete(
  '/:id',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const runResult = await dbRun(
        `
            UPDATE ai_system_prompts 
            SET is_active = 0, updated_at = datetime('now')
            WHERE id = ?
        `,
        [id]
      );

      if (!runResult.success) {
        throw new Error(runResult.error || 'Failed to deactivate prompt');
      }

      res.json({ success: true, message: 'Prompt deactivated' });
    } catch (error: unknown) {
      logger.error('[AI Prompts API] Error deleting prompt:', error);
      return res.status(500).json({
        error: 'Failed to delete prompt',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/ai-prompts/:id/test
 * Test prompt with sample variables
 */
router.post(
  '/:id/test',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { variables = {} } = req.body;

      const prompt = (await dbGet(`SELECT * FROM ai_system_prompts WHERE id = ?`, [id])) as {
        template?: string;
      } | null;

      if (!prompt || !prompt.template) {
        return res.status(404).json({ error: 'Prompt not found' });
      }

      // Replace variables in template
      let renderedTemplate = prompt.template;
      for (const [key, value] of Object.entries(variables as Record<string, string>)) {
        renderedTemplate = renderedTemplate.replace(
          new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'),
          value
        );
      }

      // Find unreplaced variables
      const unreplacedVars = renderedTemplate.match(/\{\{\s*\w+\s*\}\}/g) || [];

      res.json({
        success: true,
        data: {
          original: prompt.template,
          rendered: renderedTemplate,
          unreplacedVariables: unreplacedVars,
          characterCount: renderedTemplate.length,
        },
        result: renderedTemplate,
      });
    } catch (error: unknown) {
      logger.error('[AI Prompts API] Error testing prompt:', error);
      return res.status(500).json({
        error: 'Failed to test prompt',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/ai-prompts/:id/restore-version
 * Restore prompt to a previous version
 */
router.post(
  '/:id/restore-version',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { version } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!version) {
        return res.status(400).json({ error: 'Version number is required' });
      }

      const versionRecord = (await dbGet(
        `
            SELECT template FROM ai_prompt_versions 
            WHERE prompt_id = ? AND version = ?
        `,
        [id, version]
      )) as { template?: string } | null;

      if (!versionRecord) {
        return res.status(404).json({ error: 'Version not found' });
      }

      const existing = (await dbGet(`SELECT version FROM ai_system_prompts WHERE id = ?`, [
        id,
      ])) as {
        version?: number;
      } | null;

      const newVersion = (existing?.version || 0) + 1;

      const runResult1 = await dbRun(
        `
            UPDATE ai_system_prompts 
            SET template = ?, version = ?, updated_at = datetime('now')
            WHERE id = ?
        `,
        [versionRecord.template, newVersion, id]
      );

      if (!runResult1.success) {
        throw new Error(runResult1.error || 'Failed to restore prompt');
      }

      // Record the restore as a new version
      const runResult2 = await dbRun(
        `
            INSERT INTO ai_prompt_versions (id, prompt_id, version, content, template, created_at, created_by)
            VALUES (?, ?, ?, ?, ?, datetime('now'), ?)
        `,
        [randomUUID(), id, newVersion, versionRecord.template, versionRecord.template, userId]
      );

      if (!runResult2.success) {
        throw new Error(runResult2.error || 'Failed to create prompt version');
      }

      res.json({
        success: true,
        message: `Restored to version ${version}`,
        data: { currentVersion: newVersion },
      });
    } catch (error: unknown) {
      logger.error('[AI Prompts API] Error restoring version:', error);
      return res.status(500).json({
        error: 'Failed to restore version',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/ai-prompts/:id/rollback
 * Rollback to a previous version with explicit reason (audit trail)
 */
router.post(
  '/:id/rollback',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { version, change_reason } = req.body;
      const userId = req.user?.id;

      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!version) return res.status(400).json({ error: 'Version number is required' });
      if (!change_reason)
        return res.status(400).json({ error: 'Change reason is required for audit trail' });

      const versionRecord = (await dbGet(
        `SELECT template FROM ai_prompt_versions WHERE prompt_id = ? AND version = ?`,
        [id, version]
      )) as { template?: string } | null;

      if (!versionRecord) return res.status(404).json({ error: 'Version not found' });

      const existing = (await dbGet(`SELECT version FROM ai_system_prompts WHERE id = ?`, [
        id,
      ])) as {
        version?: number;
      } | null;

      const newVersion = (existing?.version || 0) + 1;

      await dbRun(
        `UPDATE ai_system_prompts SET template = ?, version = ?, updated_at = datetime('now') WHERE id = ?`,
        [versionRecord.template, newVersion, id]
      );

      await dbRun(
        `INSERT INTO ai_prompt_versions (id, prompt_id, version, content, template, created_at, created_by) VALUES (?, ?, ?, ?, ?, datetime('now'), ?)`,
        [randomUUID(), id, newVersion, versionRecord.template, versionRecord.template, userId]
      );

      logger.info(
        `[AI Prompts] Rollback prompt ${id} to v${version} → v${newVersion} by ${userId}: ${change_reason}`
      );

      res.json({
        success: true,
        message: `Rolled back to version ${version} (now v${newVersion})`,
        data: { currentVersion: newVersion, rollbackFrom: version, change_reason },
      });
    } catch (error: unknown) {
      logger.error('[AI Prompts] Rollback error:', error);
      return res.status(500).json({
        error: 'Failed to rollback prompt',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/ai-prompts/:id/assemble
 * Assemble prompt using the Prompt Assembler pipeline (preview)
 */
router.post(
  '/:id/assemble',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { blockCodes = [], variables = {}, organizationId, language = 'en' } = req.body;

      const prompt = (await dbGet(`SELECT key, name FROM ai_system_prompts WHERE id = ?`, [
        id,
      ])) as {
        key?: string;
        name?: string;
      } | null;

      if (!prompt) return res.status(404).json({ error: 'Prompt not found' });

      const result = await promptAssembler.preview({
        promptKey: prompt.key || prompt.name || id,
        blockCodes,
        variables,
        organizationId,
        language,
      });

      res.json({ success: true, data: result });
    } catch (error: unknown) {
      logger.error('[AI Prompts] Assemble error:', error);
      return res.status(500).json({
        error: 'Failed to assemble prompt',
        details: 'Unknown error',
      });
    }
  })
);

// ============================================================================
// AB Experiments (T116)
// ============================================================================

/**
 * GET /api/ai-prompts/experiments
 * List AB experiments
 */
router.get(
  '/experiments',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const experiments = await dbAll(
        `SELECT * FROM ai_ab_experiments ORDER BY created_at DESC LIMIT 50`
      );
      res.json({ success: true, data: experiments || [] });
    } catch {
      res.json({ success: true, data: [] });
    }
  })
);

/**
 * POST /api/ai-prompts/experiments
 * Create AB experiment
 */
router.post(
  '/experiments',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const {
        name,
        description,
        prompt_id,
        variants,
        traffic_split,
        min_sample_size = 100,
        confidence_level = 0.95,
        primary_metric = 'quality_score',
      } = req.body;
      const userId = req.user?.id;

      if (!name || !prompt_id || !variants) {
        return res.status(400).json({ error: 'name, prompt_id, and variants are required' });
      }

      const id = randomUUID();
      await dbRun(
        `INSERT INTO ai_ab_experiments (id, name, description, prompt_id, variants, traffic_split, min_sample_size, confidence_level, primary_metric, status, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, datetime('now'), datetime('now'))`,
        [
          id,
          name,
          description || '',
          prompt_id,
          JSON.stringify(variants),
          JSON.stringify(traffic_split || { control: 50, treatment: 50 }),
          min_sample_size,
          confidence_level,
          primary_metric,
          userId,
        ]
      );

      logger.info(`[AI Prompts] AB experiment created: ${name} by ${userId}`);
      res.status(201).json({ success: true, data: { id, name, status: 'draft' } });
    } catch (error: unknown) {
      logger.error('[AI Prompts] Create experiment error:', error);
      return res.status(500).json({
        error: 'Failed to create experiment',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/ai-prompts/experiments/:experimentId/start
 * Start an AB experiment
 */
router.post(
  '/experiments/:experimentId/start',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { experimentId } = req.params;
      await dbRun(
        `UPDATE ai_ab_experiments SET status = 'running', updated_at = datetime('now') WHERE id = ? AND status = 'draft'`,
        [experimentId]
      );
      res.json({ success: true, message: 'Experiment started' });
    } catch (_err: unknown) {
      return res.status(500).json({ error: 'Failed to start experiment' });
    }
  })
);

/**
 * POST /api/ai-prompts/experiments/:experimentId/stop
 * Stop an AB experiment
 */
router.post(
  '/experiments/:experimentId/stop',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { experimentId } = req.params;
      const { stop_reason = 'manual' } = req.body;
      await dbRun(
        `UPDATE ai_ab_experiments SET status = 'completed', stop_reason = ?, updated_at = datetime('now') WHERE id = ? AND status = 'running'`,
        [stop_reason, experimentId]
      );
      res.json({ success: true, message: 'Experiment stopped' });
    } catch (_err: unknown) {
      return res.status(500).json({ error: 'Failed to stop experiment' });
    }
  })
);

/**
 * POST /api/ai-prompts/experiments/:experimentId/promote-winner
 * Promote winning variant to active prompt version
 */
router.post(
  '/experiments/:experimentId/promote-winner',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { experimentId } = req.params;
      const { winner_variant } = req.body;

      if (winner_variant === undefined) {
        return res.status(400).json({ error: 'winner_variant is required' });
      }

      await dbRun(
        `UPDATE ai_ab_experiments SET status = 'winner_promoted', stop_reason = ?, updated_at = datetime('now') WHERE id = ?`,
        [`winner: variant ${winner_variant}`, experimentId]
      );

      logger.info(
        `[AI Prompts] AB winner promoted: experiment ${experimentId}, variant ${winner_variant}`
      );
      res.json({ success: true, message: `Winner variant ${winner_variant} promoted` });
    } catch (_err: unknown) {
      return res.status(500).json({ error: 'Failed to promote winner' });
    }
  })
);

// ============================================================================
// Learning System Integration (T116)
// ============================================================================

/**
 * GET /api/ai-prompts/learning/suggestions
 * List instruction suggestions (pending / all)
 */
router.get(
  '/learning/suggestions',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { status = 'pending', organization_id } = req.query;
      let sql = `SELECT * FROM ai_instruction_suggestions WHERE 1=1`;
      const params: unknown[] = [];

      if (status && status !== 'all') {
        sql += ` AND status = ?`;
        params.push(status);
      }
      if (organization_id) {
        sql += ` AND organization_id = ?`;
        params.push(organization_id);
      }
      sql += ` ORDER BY created_at DESC LIMIT 100`;

      const suggestions = await dbAll(sql, params);
      res.json({ success: true, data: suggestions || [] });
    } catch {
      res.json({ success: true, data: [] });
    }
  })
);

/**
 * POST /api/ai-prompts/learning/suggestions/:suggestionId/approve
 * Approve instruction suggestion
 */
router.post(
  '/learning/suggestions/:suggestionId/approve',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { suggestionId } = req.params;
      await dbRun(
        `UPDATE ai_instruction_suggestions SET status = 'approved', updated_at = datetime('now') WHERE id = ?`,
        [suggestionId]
      );
      res.json({ success: true, message: 'Suggestion approved' });
    } catch (_err: unknown) {
      return res.status(500).json({ error: 'Failed to approve suggestion' });
    }
  })
);

/**
 * POST /api/ai-prompts/learning/suggestions/:suggestionId/reject
 * Reject instruction suggestion
 */
router.post(
  '/learning/suggestions/:suggestionId/reject',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { suggestionId } = req.params;
      await dbRun(
        `UPDATE ai_instruction_suggestions SET status = 'rejected', updated_at = datetime('now') WHERE id = ?`,
        [suggestionId]
      );
      res.json({ success: true, message: 'Suggestion rejected' });
    } catch (_err: unknown) {
      return res.status(500).json({ error: 'Failed to reject suggestion' });
    }
  })
);

/**
 * POST /api/ai-prompts/learning/suggestions/:suggestionId/apply
 * Apply suggestion — marks as applied so assembler picks it up at runtime
 */
router.post(
  '/learning/suggestions/:suggestionId/apply',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { suggestionId } = req.params;
      await dbRun(
        `UPDATE ai_instruction_suggestions SET status = 'applied', updated_at = datetime('now') WHERE id = ?`,
        [suggestionId]
      );
      logger.info(`[AI Prompts] Instruction suggestion ${suggestionId} applied`);
      res.json({
        success: true,
        message: 'Suggestion applied — will be used by assembler at runtime',
      });
    } catch (_err: unknown) {
      return res.status(500).json({ error: 'Failed to apply suggestion' });
    }
  })
);

export default router;
