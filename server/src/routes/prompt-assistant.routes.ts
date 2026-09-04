/**
 * prompt-assistant Routes
 *
 * Complete implementation for SuperAdmin AI Intelligence UI.
 * Provides:
 * - System statistics for prompt library
 * - Prompt templates management
 * - Block builder for composable prompts
 * - Multi-language test bench
 * - AI-powered prompt assistant chat
 */
import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import promptAssembler from '../services/ai/promptAssembler.js';
import { all as dbAll, get as dbGet } from '../utils/DbPromise.js';
import { AppError } from '../utils/ErrorHandler.js';
import logger from '../utils/Logger.js';
import { mapAppErrorResponse } from '../middleware/appErrorMapper.js';

const router = Router();

router.use(verifyToken);

// ─────────────────────────────────────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/prompt-assistant/stats
 * Used by: src/views/superadmin/AIIntelligenceView.tsx
 */
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const prompts = (await dbGet<{ total: number }>(
      `SELECT COUNT(*) as total FROM ai_system_prompts WHERE is_active = 1`,
      []
    )) || { total: 0 };

    const totalPrompts = Number((prompts as any).total || 0);

    const blocks = (await dbGet<{ total: number }>(
      `SELECT COUNT(*) as total FROM ai_prompt_blocks WHERE is_active = 1`,
      []
    )) || { total: 0 };
    const activeBlocks = Number((blocks as any).total || 0);

    // Get feedback count if table exists
    let feedbackItems = 0;
    let avgRating = 0;
    try {
      const feedback = await dbGet<{ total: number; avg_rating: number }>(
        `SELECT COUNT(*) as total, AVG(rating) as avg_rating FROM ai_feedback WHERE created_at > datetime('now', '-30 days')`,
        []
      );
      if (feedback) {
        feedbackItems = Number((feedback as any).total || 0);
        avgRating = Number((feedback as any).avg_rating || 0);
      }
    } catch {
      // Table may not exist
    }

    return res.json({
      totalPrompts,
      activeBlocks,
      feedbackItems,
      avgRating: Math.round(avgRating * 10) / 10,
      languagesCovered: 6,
    });
  } catch (err: any) {
    logger.warn('[prompt-assistant] stats failed', err);
    return res.status(500).json({ error: 'Failed to fetch prompt assistant stats' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/prompt-assistant/templates
 * Used by: AIIntelligenceView.tsx - Prompt Templates tab
 */
router.get('/templates', async (req: AuthRequest, res: Response) => {
  try {
    const templates = await dbAll(
      `SELECT 
                id, key as code, name, content, description, category,
                system_prompt, user_prompt_template, variables,
                version, is_active, created_at, updated_at
             FROM ai_system_prompts 
             WHERE is_active = 1
             ORDER BY category, name`,
      []
    );

    return res.json({
      success: true,
      templates: (templates || []).map((t: any) => ({
        ...t,
        code: t.code || t.key || t.id,
        variables: t.variables ? JSON.parse(t.variables) : [],
        is_active: t.is_active === 1,
      })),
    });
  } catch (err: any) {
    logger.warn('[prompt-assistant] templates failed', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch templates' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/prompt-assistant/blocks
 * Used by: PromptBlockBuilder.tsx
 */
router.get('/blocks', async (req: AuthRequest, res: Response) => {
  try {
    const blocks = await dbAll(
      `SELECT id, name, description, category, content, variables, is_active, usage_count, created_at
             FROM ai_prompt_blocks 
             WHERE is_active = 1
             ORDER BY category, usage_count DESC, name`,
      []
    );

    // Define block categories
    const categories: Record<
      string,
      { name: string; description: string; icon: string; color: string }
    > = {
      ROLE: {
        name: 'Role Definition',
        description: 'Define AI persona and expertise',
        icon: 'user',
        color: 'blue',
      },
      BEHAVIOR: {
        name: 'Behavior Rules',
        description: 'Set response patterns and style',
        icon: 'settings',
        color: 'green',
      },
      OUTPUT: {
        name: 'Output Format',
        description: 'Specify response structure',
        icon: 'file-text',
        color: 'purple',
      },
      CONSTRAINT: {
        name: 'Constraints',
        description: 'Define boundaries and limits',
        icon: 'shield',
        color: 'red',
      },
      CONTEXT: {
        name: 'Context Injection',
        description: 'Add dynamic context',
        icon: 'database',
        color: 'orange',
      },
      TASK: {
        name: 'Task Instructions',
        description: 'Define specific tasks',
        icon: 'check-square',
        color: 'teal',
      },
    };

    return res.json({
      success: true,
      data: (blocks || []).map((b: any) => ({
        code: b.id,
        name: b.name,
        category: b.category || 'TASK',
        semantic: b.description || '',
        variables: b.variables ? JSON.parse(b.variables) : [],
        example: b.content?.slice(0, 200),
        usageCount: b.usage_count || 0,
      })),
      categories,
    });
  } catch (err: any) {
    logger.warn('[prompt-assistant] blocks failed', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch blocks' });
  }
});

/**
 * POST /api/prompt-assistant/blocks/preview
 * Generate preview from selected blocks
 */
router.post('/blocks/preview', async (req: AuthRequest, res: Response) => {
  try {
    const { blockCodes } = req.body;

    if (!blockCodes || !Array.isArray(blockCodes) || blockCodes.length === 0) {
      return res.json({ success: true, preview: '' });
    }

    const placeholders = blockCodes.map(() => '?').join(',');
    const blocks = await dbAll(
      `SELECT id, name, content, category FROM ai_prompt_blocks WHERE id IN (${placeholders}) AND is_active = 1`,
      blockCodes
    );

    // Sort blocks by the order they were requested
    const orderedBlocks = blockCodes
      .map((code: string) => (blocks || []).find((b: any) => b.id === code))
      .filter(Boolean);

    const preview = orderedBlocks.map((b: any) => `## ${b.name}\n${b.content}`).join('\n\n');

    return res.json({ success: true, preview });
  } catch (err: any) {
    logger.warn('[prompt-assistant] blocks preview failed', err);
    return res.status(500).json({ success: false, error: 'Failed to generate preview' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST BENCH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/prompt-assistant/test
 * Used by: PromptTestBench.tsx - Multi-language test
 */
router.post(
  '/test',
  requireRole('super_admin', 'admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { templateCode, sampleInput, languages } = req.body;

      if (!templateCode || !languages || !Array.isArray(languages)) {
        return res
          .status(400)
          .json({ success: false, error: 'templateCode and languages are required' });
      }

      // Get the template
      const template = (await dbGet(
        `SELECT * FROM ai_system_prompts WHERE key = ? OR id = ? OR name = ?`,
        [templateCode, templateCode, templateCode]
      )) as any;

      const { generateChatResponse } = await import('../services/aiService.js');

      const results = [];
      for (const lang of languages) {
        const prompt = [
          `Return a helpful response in language: ${String(lang)}.`,
          '',
          `Template code: ${String(templateCode)}`,
          template?.content
            ? `Template content:\n${String(template.content)}`
            : 'Template not found.',
          sampleInput ? `Sample input:\n${String(sampleInput)}` : '',
        ]
          .filter(Boolean)
          .join('\n');

        const r = await generateChatResponse({
          messages: [{ role: 'user', content: prompt }],
          systemPrompt: 'Return plain text only.',
          model: 'default',
          maxTokens: 600,
        });

        results.push({
          language: lang,
          success: true,
          response: r.content,
        });
      }

      const summary = { tested: results.length, passed: results.length };

      return res.json({
        success: true,
        data: { results, summary },
      });
    } catch (err: any) {
      logger.warn('[prompt-assistant] test failed', err);
      if (err instanceof AppError) {
        return res
          .status(err.statusCode)
          .json({ success: false, ...mapAppErrorResponse(err, undefined, 'error'), code: err.code });
      }
      return res.status(500).json({ success: false, error: 'Test execution failed' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// CHAT (Prompt Assistant)
// ─────────────────────────────────────────────────────────────────────────────

// In-memory conversation store (in production, use Redis or DB)
const conversations = new Map<string, Array<{ role: string; content: string }>>();

/**
 * POST /api/prompt-assistant/chat
 * Used by: PromptAssistantPanel.tsx
 */
router.post('/chat', async (req: AuthRequest, res: Response) => {
  try {
    const { message, promptId, promptContent, templateCode, conversationId } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // Get or create conversation
    const convId = conversationId || uuidv4();
    if (!conversations.has(convId)) {
      conversations.set(convId, []);
    }
    const history = conversations.get(convId)!;

    // Add user message to history
    history.push({ role: 'user', content: message });

    const { generateChatResponse } = await import('../services/aiService.js');

    const systemPrompt = 'You are a helpful prompt engineering assistant.';
    const r = await generateChatResponse({
      messages: history.map((m) => ({ role: m.role as any, content: m.content })),
      systemPrompt,
      model: 'default',
      maxTokens: 800,
    });

    history.push({ role: 'assistant', content: r.content });
    if (history.length > 20) conversations.set(convId, history.slice(-20));

    return res.json({
      success: true,
      data: {
        conversationId: convId,
        message: r.content,
        history: conversations.get(convId),
      },
    });
  } catch (err: any) {
    logger.warn('[prompt-assistant] chat failed', err);
    if (err instanceof AppError) {
      return res
        .status(err.statusCode)
        .json({ success: false, ...mapAppErrorResponse(err, undefined, 'error'), code: err.code });
    }
    return res.status(500).json({ success: false, error: 'Chat failed' });
  }
});

/**
 * DELETE /api/prompt-assistant/chat/history
 * Clear conversation history
 */
router.delete('/chat/history', async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId } = req.body;

    if (conversationId && conversations.has(conversationId)) {
      conversations.delete(conversationId);
    }

    return res.json({ success: true });
  } catch (err: any) {
    logger.warn('[prompt-assistant] clear history failed', err);
    return res.status(500).json({ success: false, error: 'Failed to clear history' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ASSEMBLER (T116) — Prompt compilation pipeline
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/prompt-assistant/assemble
 * Compile a full prompt using the Prompt Assembler pipeline.
 * Used by: test bench, preview, and production endpoints.
 */
router.post('/assemble', async (req: AuthRequest, res: Response) => {
  try {
    const { promptKey, blockCodes, variables, organizationId, language } = req.body;

    if (!promptKey) {
      return res.status(400).json({ success: false, error: 'promptKey is required' });
    }

    const result = await promptAssembler.preview({
      promptKey,
      blockCodes,
      variables,
      organizationId,
      language,
    });

    return res.json({ success: true, data: result });
  } catch (err: any) {
    logger.warn('[prompt-assistant] assemble failed', err);
    return res.status(500).json({ success: false, error: err?.message || 'Assembly failed' });
  }
});

export default router;
