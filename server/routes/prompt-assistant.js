/**
 * Prompt Assistant API Routes
 * 
 * Endpoints for the AI-powered prompt engineering assistant.
 * SuperAdmin only access.
 */

import express from 'express';
const router = express.Router();
import verifyToken from '../middleware/authMiddleware.js';
const { requireRole } = require('../middleware/rbac');
const { promptAssistant } = import('ai/promptAssistant.js');
const { promptTemplateService } = import('ai/promptTemplateService.js');
const { promptBlockLibrary, BLOCK_CATEGORIES } = import('ai/promptBlockLibrary.js');
const { variableResolver } = import('ai/variableResolver.js');
import { getDatabase } from '../src/database/Database.js';
const db = getDatabase();

// Database helpers
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

// ============================================================================
// Chat Endpoint - Interactive prompt engineering assistant
// ============================================================================

/**
 * POST /api/prompt-assistant/chat
 * Send a message to the prompt engineering assistant
 */
router.post('/chat', verifyToken, requireRole(['super_admin']), async (req, res) => {
    try {
        const { message, promptId, promptContent, templateCode, conversationId } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const result = await promptAssistant.processMessage(
            message,
            req.user.id,
            { promptId, promptContent, templateCode, conversationId }
        );

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[Prompt Assistant API] Chat error:', error);
        res.status(500).json({
            error: 'Failed to process message',
            details: error.message
        });
    }
});

/**
 * DELETE /api/prompt-assistant/chat/history
 * Clear conversation history
 */
router.delete('/chat/history', verifyToken, requireRole(['super_admin']), async (req, res) => {
    try {
        const { conversationId } = req.body;
        promptAssistant.clearHistory(req.user.id, conversationId);

        res.json({ success: true, message: 'History cleared' });
    } catch (error) {
        console.error('[Prompt Assistant API] Clear history error:', error);
        res.status(500).json({ error: 'Failed to clear history' });
    }
});

// ============================================================================
// Analysis Endpoints
// ============================================================================

/**
 * POST /api/prompt-assistant/analyze
 * Analyze a prompt for issues and improvements
 */
router.post('/analyze', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { promptContent, capability, templateCode } = req.body;

        if (!promptContent || !promptContent.trim()) {
            return res.status(400).json({ error: 'Prompt content is required' });
        }

        const analysis = await promptAssistant.analyzePrompt(promptContent, { capability, templateCode });

        res.json({
            success: true,
            data: analysis
        });
    } catch (error) {
        console.error('[Prompt Assistant API] Analysis error:', error);
        res.status(500).json({
            error: 'Failed to analyze prompt',
            details: error.message
        });
    }
});

/**
 * POST /api/prompt-assistant/improve
 * Get an improved version of a prompt
 */
router.post('/improve', verifyToken, requireRole(['super_admin']), async (req, res) => {
    try {
        const { promptContent, focusArea } = req.body;

        if (!promptContent || !promptContent.trim()) {
            return res.status(400).json({ error: 'Prompt content is required' });
        }

        const result = await promptAssistant.improvePrompt(promptContent, focusArea);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[Prompt Assistant API] Improve error:', error);
        res.status(500).json({
            error: 'Failed to improve prompt',
            details: error.message
        });
    }
});

// ============================================================================
// Testing Endpoints
// ============================================================================

/**
 * POST /api/prompt-assistant/test
 * Test a prompt template with sample input
 */
router.post('/test', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { templateCode, sampleInput, languages } = req.body;

        if (!templateCode) {
            return res.status(400).json({ error: 'Template code is required' });
        }

        if (!sampleInput || !sampleInput.trim()) {
            return res.status(400).json({ error: 'Sample input is required' });
        }

        const testLanguages = languages || ['en', 'pl', 'de'];
        const results = await promptAssistant.testPrompt(templateCode, sampleInput, testLanguages);

        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        console.error('[Prompt Assistant API] Test error:', error);
        res.status(500).json({
            error: 'Failed to test prompt',
            details: error.message
        });
    }
});

/**
 * POST /api/prompt-assistant/preview
 * Preview assembled prompt with sample context
 */
router.post('/preview', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { templateCode, language } = req.body;

        if (!templateCode) {
            return res.status(400).json({ error: 'Template code is required' });
        }

        const preview = await promptTemplateService.previewTemplate(templateCode, language || 'en');

        res.json({
            success: true,
            data: preview
        });
    } catch (error) {
        console.error('[Prompt Assistant API] Preview error:', error);
        res.status(500).json({
            error: 'Failed to preview template',
            details: error.message
        });
    }
});

// ============================================================================
// Block Management Endpoints
// ============================================================================

/**
 * GET /api/prompt-assistant/blocks
 * Get all available blocks
 */
router.get('/blocks', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { category } = req.query;

        let blocks;
        if (category) {
            blocks = await promptBlockLibrary.getBlocksByCategory(category);
        } else {
            const allBlocks = await promptBlockLibrary.getAllBlocks();
            blocks = Object.entries(allBlocks).map(([code, block]) => ({
                code,
                ...block
            }));
        }

        res.json({
            success: true,
            data: blocks,
            categories: BLOCK_CATEGORIES
        });
    } catch (error) {
        console.error('[Prompt Assistant API] Get blocks error:', error);
        res.status(500).json({ error: 'Failed to get blocks' });
    }
});

/**
 * GET /api/prompt-assistant/blocks/categories
 * Get block categories
 */
router.get('/blocks/categories', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    res.json({
        success: true,
        data: BLOCK_CATEGORIES
    });
});

/**
 * POST /api/prompt-assistant/blocks/suggest
 * Get block suggestions for a requirement
 */
router.post('/blocks/suggest', verifyToken, requireRole(['super_admin']), async (req, res) => {
    try {
        const { requirement, category, currentBlocks } = req.body;

        if (!requirement || !requirement.trim()) {
            return res.status(400).json({ error: 'Requirement is required' });
        }

        const suggestions = await promptAssistant.suggestBlocks(requirement, { category, currentBlocks });

        res.json({
            success: true,
            data: suggestions
        });
    } catch (error) {
        console.error('[Prompt Assistant API] Suggest blocks error:', error);
        res.status(500).json({ error: 'Failed to suggest blocks' });
    }
});

/**
 * GET /api/prompt-assistant/blocks/search
 * Search blocks by keyword
 */
router.get('/blocks/search', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || !q.trim()) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        const results = await promptBlockLibrary.searchBlocks(q);

        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        console.error('[Prompt Assistant API] Search blocks error:', error);
        res.status(500).json({ error: 'Failed to search blocks' });
    }
});

/**
 * POST /api/prompt-assistant/blocks
 * Create a new block
 */
router.post('/blocks', verifyToken, requireRole(['super_admin']), async (req, res) => {
    try {
        const { code, category, name, semantic, variables, example } = req.body;

        if (!code || !category || !name || !semantic) {
            return res.status(400).json({
                error: 'code, category, name, and semantic are required'
            });
        }

        // Validate block
        const validation = promptBlockLibrary.validateBlock({ semantic, variables });
        if (!validation.valid) {
            return res.status(400).json({
                error: 'Block validation failed',
                issues: validation.issues
            });
        }

        const result = await promptBlockLibrary.createBlock({
            code, category, name, semantic, variables, example
        });

        res.status(201).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[Prompt Assistant API] Create block error:', error);
        res.status(500).json({
            error: 'Failed to create block',
            details: error.message
        });
    }
});

/**
 * PUT /api/prompt-assistant/blocks/:code
 * Update a block
 */
router.put('/blocks/:code', verifyToken, requireRole(['super_admin']), async (req, res) => {
    try {
        const { code } = req.params;
        const { name, semantic, variables, example } = req.body;

        // Validate if semantic provided
        if (semantic) {
            const validation = promptBlockLibrary.validateBlock({ semantic, variables: variables || [] });
            if (!validation.valid) {
                return res.status(400).json({
                    error: 'Block validation failed',
                    issues: validation.issues
                });
            }
        }

        const result = await promptBlockLibrary.updateBlock(code, { name, semantic, variables, example });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[Prompt Assistant API] Update block error:', error);
        res.status(500).json({
            error: 'Failed to update block',
            details: error.message
        });
    }
});

// ============================================================================
// Template Management Endpoints
// ============================================================================

/**
 * GET /api/prompt-assistant/templates
 * Get all templates
 */
router.get('/templates', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { category } = req.query;

        let templates;
        if (category) {
            templates = await promptTemplateService.getTemplatesByCategory(category);
        } else {
            templates = await promptTemplateService.getAllTemplates();
        }

        res.json({
            success: true,
            data: templates
        });
    } catch (error) {
        console.error('[Prompt Assistant API] Get templates error:', error);
        res.status(500).json({ error: 'Failed to get templates' });
    }
});

/**
 * GET /api/prompt-assistant/templates/:code
 * Get a specific template
 */
router.get('/templates/:code', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { code } = req.params;
        const template = await promptTemplateService.getTemplate(code);

        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        res.json({
            success: true,
            data: template
        });
    } catch (error) {
        console.error('[Prompt Assistant API] Get template error:', error);
        res.status(500).json({ error: 'Failed to get template' });
    }
});

/**
 * POST /api/prompt-assistant/templates
 * Create a new template
 */
router.post('/templates', verifyToken, requireRole(['super_admin']), async (req, res) => {
    try {
        const { code, name, category, description, blocks, variableSchema, config } = req.body;

        if (!code || !name || !category) {
            return res.status(400).json({
                error: 'code, name, and category are required'
            });
        }

        const result = await promptTemplateService.createTemplate({
            code, name, category, description, blocks, variableSchema, config
        });

        res.status(201).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[Prompt Assistant API] Create template error:', error);
        res.status(500).json({
            error: 'Failed to create template',
            details: error.message
        });
    }
});

/**
 * PUT /api/prompt-assistant/templates/:code
 * Update a template
 */
router.put('/templates/:code', verifyToken, requireRole(['super_admin']), async (req, res) => {
    try {
        const { code } = req.params;
        const { name, description, blocks, variableSchema, config } = req.body;

        const result = await promptTemplateService.updateTemplate(code, {
            name, description, blocks, variableSchema, config
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[Prompt Assistant API] Update template error:', error);
        res.status(500).json({
            error: 'Failed to update template',
            details: error.message
        });
    }
});

/**
 * POST /api/prompt-assistant/templates/:code/validate
 * Validate a template
 */
router.post('/templates/:code/validate', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { code } = req.params;
        const { context } = req.body;

        const validation = await promptTemplateService.validateTemplate(code, context || {});

        res.json({
            success: true,
            data: validation
        });
    } catch (error) {
        console.error('[Prompt Assistant API] Validate template error:', error);
        res.status(500).json({
            error: 'Failed to validate template',
            details: error.message
        });
    }
});

// ============================================================================
// Variable Endpoints
// ============================================================================

/**
 * GET /api/prompt-assistant/variables
 * Get all available variables
 */
router.get('/variables', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const variables = await variableResolver.getAvailableVariables();

        res.json({
            success: true,
            data: variables
        });
    } catch (error) {
        console.error('[Prompt Assistant API] Get variables error:', error);
        res.status(500).json({ error: 'Failed to get variables' });
    }
});

/**
 * POST /api/prompt-assistant/variables/resolve
 * Resolve variables in a template string
 */
router.post('/variables/resolve', verifyToken, requireRole(['super_admin']), async (req, res) => {
    try {
        const { template, context } = req.body;

        if (!template) {
            return res.status(400).json({ error: 'Template is required' });
        }

        const resolved = await variableResolver.resolveTemplate(template, context || {});
        const validation = await variableResolver.validateVariables(template, context || {});

        res.json({
            success: true,
            data: {
                original: template,
                resolved,
                validation
            }
        });
    } catch (error) {
        console.error('[Prompt Assistant API] Resolve variables error:', error);
        res.status(500).json({
            error: 'Failed to resolve variables',
            details: error.message
        });
    }
});

// ============================================================================
// Stats Endpoints
// ============================================================================

/**
 * GET /api/prompt-assistant/stats
 * Get AI Intelligence system stats
 */
router.get('/stats', verifyToken, requireRole(['super_admin']), async (req, res) => {
    try {
        // Get counts from services
        const templates = await promptTemplateService.getAllTemplates();
        const allBlocks = await promptBlockLibrary.getAllBlocks();

        // Count active blocks
        const blocks = Object.values(allBlocks);
        const activeBlocks = blocks.filter(b => b.isActive !== false).length;

        // Get real feedback counts and stats from DB
        const feedbackStats = await dbGet(`
            SELECT 
                COUNT(*) as count,
                AVG(rating) as avg_rating
            FROM ai_feedback
        `);

        res.json({
            totalPrompts: Array.isArray(templates) ? templates.length : 0,
            activeBlocks,
            feedbackItems: feedbackStats?.count || 0,
            avgRating: feedbackStats?.avg_rating ? parseFloat(feedbackStats.avg_rating.toFixed(1)) : 0,
            languagesCovered: 6 // en, pl, de, fr, es, cn (based on implementation)
        });
    } catch (error) {
        console.error('[Prompt Assistant API] Stats error:', error);
        res.status(500).json({
            error: 'Failed to fetch AI stats'
        });
    }
});

// ============================================================================
// Feedback Endpoints
// ============================================================================

/**
 * POST /api/prompt-assistant/feedback
 * Record feedback for a prompt/template
 */
router.post('/feedback', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { templateId, rating, feedbackType, feedbackText, inputSample, outputSample, userLanguage } = req.body;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }

        const result = await promptAssistant.recordFeedback(templateId, {
            rating, feedbackType, feedbackText, inputSample, outputSample, userLanguage
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[Prompt Assistant API] Record feedback error:', error);
        res.status(500).json({ error: 'Failed to record feedback' });
    }
});

export default router;

