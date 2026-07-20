// @ts-nocheck
/**
 * AI Development Routes
 * Module 2: AI Development & Testing
 * Routes for prompts, intelligence, experiments, and knowledge base
 *
 * Fully migrated to TypeScript ES modules
 */

import { randomUUID } from 'crypto';
import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// Apply rate limiting
const router = Router();

const serviceFallback = (
  _req: AuthRequest,
  res: Response,
  _feature: string,
  _readPayload?: Record<string, unknown>
) => {
  return res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
  });
};

// Service interfaces
interface ABTestingServiceInterface {
  listExperiments?: (filters: { status?: string; promptId?: string }) => Promise<
    Array<{
      variants?: string;
      traffic_split?: string;
      [key: string]: unknown;
    }>
  >;
  createExperiment?: (data: { createdBy: string; [key: string]: unknown }) => Promise<unknown>;
  getExperimentStats?: (id: string) => Promise<unknown>;
  startExperiment?: (id: string, userId: string) => Promise<unknown>;
  stopExperiment?: (id: string, reason: string) => Promise<unknown>;
}

interface KnowledgeServiceInterface {
  getCandidates?: (status: string) => Promise<unknown[]>;
  addCandidate?: (
    content: string,
    reasoning?: string,
    source?: string,
    relatedAxis?: string,
    originContext?: string
  ) => Promise<string>;
  updateCandidateStatus?: (id: string, status: string, adminComment?: string) => Promise<void>;
  getApprovedIdeas?: (filters: { category?: string }) => Promise<unknown[]>;
}

// Dynamic imports for services (may not be migrated yet)
let abTestingService: ABTestingServiceInterface | null = null;
const KnowledgeService: KnowledgeServiceInterface | null = null;

try {
  const abTestingModule = (await import('../../services/ai/abTesting.js')) as any;
  const module = abTestingModule.default || abTestingModule;
  abTestingService = (module.abTestingService || module) as ABTestingServiceInterface;
} catch {
  logger.warn('[AI Development Routes] abTestingService not available');
}

// try {
//     const knowledgeModule = (await import('../../services/knowledgeService.js')) as any;
//     KnowledgeService = (knowledgeModule.default || knowledgeModule) as KnowledgeServiceInterface;
// } catch {
//     logger.warn('[AI Development Routes] KnowledgeService not available');
// }

// ==========================================
// PROMPTS ENDPOINTS
// ==========================================

/**
 * GET /api/ai-development/prompts
 * List all system prompts
 */
router.get(
  '/prompts',
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

      return res.json({
        success: true,
        data: prompts.map((p) => ({
          ...p,
          variables: p.variables ? JSON.parse(p.variables) : [],
          is_active: Boolean(p.is_active),
        })),
        count: prompts.length,
      });
    } catch (error: unknown) {
      logger.error('[AI Development] Error listing prompts:', error);
      return res.status(500).json({
        error: 'Failed to list prompts',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * GET /api/ai-development/prompts/categories
 * Get prompt categories
 */
router.get(
  '/prompts/categories',
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

      return res.json({ success: true, data: categories });
    } catch (error: unknown) {
      logger.error('[AI Development] Error listing categories:', error);
      return res.status(500).json({
        error: 'Failed to list categories',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * GET /api/ai-development/prompts/:id
 * Get single prompt with version history
 */
router.get(
  '/prompts/:id',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const prompt = (await dbGet(`SELECT * FROM ai_system_prompts WHERE id = ?`, [id])) as {
        variables?: string;
        is_active?: number;
        [key: string]: unknown;
      } | null;

      if (!prompt) {
        return res.status(404).json({ error: 'Prompt not found' });
      }

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

      return res.json({
        success: true,
        data: {
          ...prompt,
          variables: prompt.variables ? JSON.parse(prompt.variables) : [],
          is_active: Boolean(prompt.is_active),
          versions,
        },
      });
    } catch (error: unknown) {
      logger.error('[AI Development] Error getting prompt:', error);
      return res.status(500).json({
        error: 'Failed to get prompt',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/ai-development/prompts
 * Create new prompt
 */
router.post(
  '/prompts',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { name, category, description, template, variables, is_active } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!name || !category || !template) {
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
          template,
          template,
          JSON.stringify(variables || []),
          is_active !== false ? 1 : 0,
        ]
      );

      if (!runResult1.success) {
        throw new Error(runResult1.error || 'Failed to create prompt');
      }

      // FIX (42703): ai_prompt_versions has no created_at/created_by columns —
      // the audit columns are named changed_at/changed_by.
      const runResult2 = await dbRun(
        `
            INSERT INTO ai_prompt_versions (id, prompt_id, version, content, template, changed_at, changed_by)
            VALUES (?, ?, 1, ?, ?, datetime('now'), ?)
        `,
        [randomUUID(), id, template, template, userId]
      );

      if (!runResult2.success) {
        throw new Error(runResult2.error || 'Failed to create prompt version');
      }

      return res.status(201).json({
        success: true,
        data: { id, name, category, version: 1 },
      });
    } catch (error: unknown) {
      logger.error('[AI Development] Error creating prompt:', error);
      return res.status(500).json({
        error: 'Failed to create prompt',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * PUT /api/ai-development/prompts/:id
 * Update prompt
 */
router.put(
  '/prompts/:id',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, category, description, template, variables, is_active } = req.body;
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
          template || existing.template,
          JSON.stringify(variables || JSON.parse(existing.variables || '[]')),
          is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
          newVersion,
          id,
        ]
      );

      if (!runResult1.success) {
        throw new Error(runResult1.error || 'Failed to update prompt');
      }

      if (template && template !== existing.template) {
        // FIX (42703): ai_prompt_versions has no created_at/created_by columns —
        // the audit columns are named changed_at/changed_by.
        const runResult2 = await dbRun(
          `
                INSERT INTO ai_prompt_versions (id, prompt_id, version, content, template, changed_at, changed_by)
                VALUES (?, ?, ?, ?, ?, datetime('now'), ?)
            `,
          [randomUUID(), id, newVersion, template, template, userId]
        );

        if (!runResult2.success) {
          throw new Error(runResult2.error || 'Failed to create prompt version');
        }
      }

      return res.json({ success: true, data: { id, version: newVersion } });
    } catch (error: unknown) {
      logger.error('[AI Development] Error updating prompt:', error);
      return res.status(500).json({
        error: 'Failed to update prompt',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/ai-development/prompts/:id/test
 * Test prompt with variables
 */
router.post(
  '/prompts/:id/test',
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

      let renderedTemplate = prompt.template;
      for (const [key, value] of Object.entries(variables as Record<string, string>)) {
        renderedTemplate = renderedTemplate.replace(
          new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'),
          value
        );
      }

      const unreplacedVars = renderedTemplate.match(/\{\{\s*\w+\s*\}\}/g) || [];

      return res.json({
        success: true,
        data: {
          original: prompt.template,
          rendered: renderedTemplate,
          unreplacedVariables: unreplacedVars,
          characterCount: renderedTemplate.length,
        },
      });
    } catch (error: unknown) {
      logger.error('[AI Development] Error testing prompt:', error);
      return res.status(500).json({
        error: 'Failed to test prompt',
        details: 'Unknown error',
      });
    }
  })
);

// ==========================================
// EXPERIMENTS ENDPOINTS
// ==========================================

/**
 * GET /api/ai-development/experiments
 * List A/B testing experiments
 */
router.get(
  '/experiments',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!abTestingService?.listExperiments) {
      return serviceFallback(req, res, 'ai-development-ab-testing', { data: [] });
    }

    try {
      const { status, promptId } = req.query;
      const experiments = await abTestingService.listExperiments({
        status: status as string | undefined,
        promptId: promptId as string | undefined,
      });

      return res.json({
        success: true,
        data: experiments.map((e) => ({
          ...e,
          variants: JSON.parse((e.variants as string) || '[]'),
          traffic_split: JSON.parse((e.traffic_split as string) || '[]'),
        })),
      });
    } catch (error: unknown) {
      logger.error('[AI Development] Error listing experiments:', error);
      return res.status(500).json({
        error: 'Failed to list experiments',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/ai-development/experiments
 * Create new experiment
 */
router.post(
  '/experiments',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!abTestingService?.createExperiment) {
      return serviceFallback(req, res, 'ai-development-ab-testing');
    }

    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const result = await abTestingService.createExperiment({
        ...req.body,
        createdBy: userId,
      });

      return res.status(201).json({ success: true, data: result });
    } catch (error: unknown) {
      logger.error('[AI Development] Error creating experiment:', error);
      return res.status(500).json({
        error: 'Failed to create experiment',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * GET /api/ai-development/experiments/:id
 * Get experiment with statistics
 */
router.get(
  '/experiments/:id',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!abTestingService?.getExperimentStats) {
      return serviceFallback(req, res, 'ai-development-ab-testing', { data: null });
    }

    try {
      const stats = await abTestingService.getExperimentStats(req.params.id);
      return res.json({ success: true, data: stats });
    } catch (error: unknown) {
      logger.error('[AI Development] Error getting experiment:', error);
      return res.status(500).json({
        error: 'Failed to get experiment',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/ai-development/experiments/:id/start
 * Start experiment
 */
router.post(
  '/experiments/:id/start',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!abTestingService?.startExperiment) {
      return serviceFallback(req, res, 'ai-development-ab-testing');
    }

    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const result = await abTestingService.startExperiment(req.params.id, userId);
      return res.json({ success: true, data: result });
    } catch (error: unknown) {
      logger.error('[AI Development] Error starting experiment:', error);
      return res.status(500).json({
        error: 'Failed to start experiment',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/ai-development/experiments/:id/stop
 * Stop experiment
 */
router.post(
  '/experiments/:id/stop',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!abTestingService?.stopExperiment) {
      return serviceFallback(req, res, 'ai-development-ab-testing');
    }

    try {
      const { reason = 'manual' } = req.body;
      const result = await abTestingService.stopExperiment(req.params.id, reason);
      return res.json({ success: true, data: result });
    } catch (error: unknown) {
      logger.error('[AI Development] Error stopping experiment:', error);
      return res.status(500).json({
        error: 'Failed to stop experiment',
        details: 'Unknown error',
      });
    }
  })
);

// ==========================================
// KNOWLEDGE BASE ENDPOINTS
// ==========================================

/**
 * GET /api/ai-development/knowledge/candidates
 * Get knowledge candidates
 */
router.get(
  '/knowledge/candidates',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.getCandidates) {
      return serviceFallback(req, res, 'ai-development-knowledge', { data: [] });
    }

    try {
      const status = (req.query.status as string) || 'pending';
      const items = await KnowledgeService.getCandidates(status);
      return res.json({ success: true, data: items });
    } catch (error: unknown) {
      logger.error('[AI Development] Error listing knowledge candidates:', error);
      return res.status(500).json({
        error: 'Failed to list candidates',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/ai-development/knowledge/candidates
 * Submit knowledge candidate
 */
router.post(
  '/knowledge/candidates',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.addCandidate) {
      return serviceFallback(req, res, 'ai-development-knowledge');
    }

    try {
      const { content, reasoning, source, relatedAxis, originContext } = req.body;
      const id = await KnowledgeService.addCandidate(
        content,
        reasoning,
        source,
        relatedAxis,
        originContext
      );
      return res.json({ success: true, data: { id }, message: 'Candidate submitted' });
    } catch (error: unknown) {
      logger.error('[AI Development] Error submitting candidate:', error);
      return res.status(500).json({
        error: 'Failed to submit candidate',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * PUT /api/ai-development/knowledge/candidates/:id/status
 * Update candidate status (approve/reject)
 */
router.put(
  '/knowledge/candidates/:id/status',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.updateCandidateStatus) {
      return serviceFallback(req, res, 'ai-development-knowledge');
    }

    try {
      const { status, adminComment } = req.body;
      await KnowledgeService.updateCandidateStatus(req.params.id, status, adminComment);
      return res.json({ success: true, message: 'Status updated' });
    } catch (error: unknown) {
      logger.error('[AI Development] Error updating candidate status:', error);
      return res.status(500).json({
        error: 'Failed to update status',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * GET /api/ai-development/knowledge/approved
 * Get approved knowledge items
 */
router.get(
  '/knowledge/approved',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!KnowledgeService?.getApprovedIdeas) {
      return serviceFallback(req, res, 'ai-development-knowledge', { data: [] });
    }

    try {
      const filters: { category?: string } = {};
      if (req.query.category) {
        filters.category = req.query.category as string;
      }

      const ideas = await KnowledgeService.getApprovedIdeas(filters);
      return res.json({ success: true, data: ideas });
    } catch (error: unknown) {
      logger.error('[AI Development] Error getting approved ideas:', error);
      return res.status(500).json({
        error: 'Failed to get approved ideas',
        details: 'Unknown error',
      });
    }
  })
);

// ==========================================
// INTELLIGENCE ENDPOINTS
// ==========================================

/**
 * GET /api/ai-development/intelligence/config
 * Get AI intelligence configuration
 */
router.get(
  '/intelligence/config',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const config = (await dbGet(`
            SELECT * FROM ai_settings WHERE key = 'intelligence_config'
        `)) as { value?: string } | null;

      return res.json({
        success: true,
        data: config?.value
          ? JSON.parse(config.value)
          : {
              enabledFeatures: ['contextual_suggestions', 'auto_completion', 'smart_routing'],
              aggressiveness: 'balanced',
              learningEnabled: true,
            },
      });
    } catch (error: unknown) {
      logger.error('[AI Development] Error getting intelligence config:', error);
      return res.status(500).json({
        error: 'Failed to get config',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * PUT /api/ai-development/intelligence/config
 * Update AI intelligence configuration
 */
router.put(
  '/intelligence/config',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const config = req.body;

      const runResult = await dbRun(
        `
            INSERT OR REPLACE INTO ai_settings (key, value, updated_at)
            VALUES ('intelligence_config', ?, datetime('now'))
        `,
        [JSON.stringify(config)]
      );

      if (!runResult.success) {
        throw new Error(runResult.error || 'Failed to update config');
      }

      return res.json({ success: true, message: 'Configuration updated' });
    } catch (error: unknown) {
      logger.error('[AI Development] Error updating intelligence config:', error);
      return res.status(500).json({
        error: 'Failed to update config',
        details: 'Unknown error',
      });
    }
  })
);

// ==========================================
// SUMMARY ENDPOINT
// ==========================================

/**
 * GET /api/ai-development/summary
 * Get development module summary statistics
 */
router.get(
  '/summary',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      const [promptStats, experimentStats, knowledgeStats] = await Promise.all([
        dbGet(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
                    COUNT(DISTINCT category) as categories
                FROM ai_system_prompts
            `) as Promise<{ total?: number; active?: number; categories?: number }>,
        dbGet(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
                FROM ai_ab_experiments
            `).catch(() => ({ total: 0, running: 0, completed: 0 })) as Promise<{
          total?: number;
          running?: number;
          completed?: number;
        }>,
        dbGet(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
                FROM knowledge_candidates
            `).catch(() => ({ total: 0, approved: 0, pending: 0 })) as Promise<{
          total?: number;
          approved?: number;
          pending?: number;
        }>,
      ]);

      return res.json({
        success: true,
        data: {
          prompts: promptStats || { total: 0, active: 0, categories: 0 },
          experiments: experimentStats || { total: 0, running: 0, completed: 0 },
          knowledge: knowledgeStats || { total: 0, approved: 0, pending: 0 },
        },
      });
    } catch (error: unknown) {
      logger.error('[AI Development] Error getting summary:', error);
      return res.status(500).json({
        error: 'Failed to get summary',
        details: 'Unknown error',
      });
    }
  })
);

export default router;
