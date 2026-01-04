import crypto from 'crypto';
/**
 * AI Development Routes
 * 
 * Module 2: AI Development & Testing
 * Routes for prompts, intelligence, experiments, and knowledge base
 * 
 * This module provides unified API endpoints for AI development tools
 * while proxying to existing specialized endpoints for backward compatibility.
 */

import express from 'express';
const router = express.Router();
import verifyToken from '../middleware/authMiddleware.js';
import { requireRole  } from '../middleware/rbac.js';
import { getDatabase } from '../src/database/index.js';
const db = getDatabase();

// Import existing services
let abTestingService;
try {
    abTestingService = import('../services/ai/abTesting.js').abTestingService;
} catch (e) {
    console.warn('[AI Development] abTesting service not available');
}

let KnowledgeService;
try {
    KnowledgeService = import('knowledgeService.js');
} catch (e) {
    console.warn('[AI Development] Knowledge service not available');
}

// ==========================================
// PROMPTS ENDPOINTS
// ==========================================

/**
 * GET /api/ai-development/prompts
 * List all system prompts
 */
router.get('/prompts', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { category, search, is_active } = req.query;
        
        let query = `
            SELECT id, name, category, description, template, 
                   variables, is_active, version, created_at, updated_at
            FROM ai_system_prompts
            WHERE 1=1
        `;
        const params = [];
        
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
        
        const prompts = await db.all(query, params);
        
        res.json({
            success: true,
            data: prompts.map(p => ({
                ...p,
                variables: p.variables ? JSON.parse(p.variables) : [],
                is_active: Boolean(p.is_active)
            })),
            count: prompts.length
        });
    } catch (error) {
        console.error('[AI Development] Error listing prompts:', error);
        res.status(500).json({ error: 'Failed to list prompts', details: error.message });
    }
});

/**
 * GET /api/ai-development/prompts/categories
 * Get prompt categories
 */
router.get('/prompts/categories', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const categories = await db.all(`
            SELECT DISTINCT category, COUNT(*) as count
            FROM ai_system_prompts
            GROUP BY category
            ORDER BY category
        `);
        
        res.json({ success: true, data: categories });
    } catch (error) {
        console.error('[AI Development] Error listing categories:', error);
        res.status(500).json({ error: 'Failed to list categories', details: error.message });
    }
});

/**
 * GET /api/ai-development/prompts/:id
 * Get single prompt with version history
 */
router.get('/prompts/:id', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { id } = req.params;
        
        const prompt = await db.get(`SELECT * FROM ai_system_prompts WHERE id = ?`, [id]);
        if (!prompt) {
            return res.status(404).json({ error: 'Prompt not found' });
        }
        
        const versions = await db.all(`
            SELECT id, version, template, created_at, created_by
            FROM ai_prompt_versions
            WHERE prompt_id = ?
            ORDER BY version DESC
            LIMIT 10
        `, [id]);
        
        res.json({
            success: true,
            data: {
                ...prompt,
                variables: prompt.variables ? JSON.parse(prompt.variables) : [],
                is_active: Boolean(prompt.is_active),
                versions
            }
        });
    } catch (error) {
        console.error('[AI Development] Error getting prompt:', error);
        res.status(500).json({ error: 'Failed to get prompt', details: error.message });
    }
});

/**
 * POST /api/ai-development/prompts
 * Create new prompt
 */
router.post('/prompts', verifyToken, requireRole(['super_admin']), async (req, res) => {
    try {
        const { name, category, description, template, variables, is_active } = req.body;
        
        if (!name || !category || !template) {
            return res.status(400).json({ error: 'Name, category, and template are required' });
        }
        
        const id = crypto.randomUUID();
        
        await db.run(`
            INSERT INTO ai_system_prompts 
            (id, name, category, description, template, variables, is_active, version, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
        `, [id, name, category, description, template, JSON.stringify(variables || []), is_active !== false ? 1 : 0]);
        
        await db.run(`
            INSERT INTO ai_prompt_versions (id, prompt_id, version, template, created_at, created_by)
            VALUES (?, ?, 1, ?, datetime('now'), ?)
        `, [crypto.randomUUID(), id, template, req.user.id]);
        
        res.status(201).json({
            success: true,
            data: { id, name, category, version: 1 }
        });
    } catch (error) {
        console.error('[AI Development] Error creating prompt:', error);
        res.status(500).json({ error: 'Failed to create prompt', details: error.message });
    }
});

/**
 * PUT /api/ai-development/prompts/:id
 * Update prompt
 */
router.put('/prompts/:id', verifyToken, requireRole(['super_admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, category, description, template, variables, is_active } = req.body;
        
        const existing = await db.get(`SELECT * FROM ai_system_prompts WHERE id = ?`, [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Prompt not found' });
        }
        
        const newVersion = existing.version + 1;
        
        await db.run(`
            UPDATE ai_system_prompts 
            SET name = ?, category = ?, description = ?, template = ?, 
                variables = ?, is_active = ?, version = ?, updated_at = datetime('now')
            WHERE id = ?
        `, [
            name || existing.name,
            category || existing.category,
            description || existing.description,
            template || existing.template,
            JSON.stringify(variables || JSON.parse(existing.variables || '[]')),
            is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
            newVersion,
            id
        ]);
        
        if (template && template !== existing.template) {
            await db.run(`
                INSERT INTO ai_prompt_versions (id, prompt_id, version, template, created_at, created_by)
                VALUES (?, ?, ?, ?, datetime('now'), ?)
            `, [crypto.randomUUID(), id, newVersion, template, req.user.id]);
        }
        
        res.json({ success: true, data: { id, version: newVersion } });
    } catch (error) {
        console.error('[AI Development] Error updating prompt:', error);
        res.status(500).json({ error: 'Failed to update prompt', details: error.message });
    }
});

/**
 * POST /api/ai-development/prompts/:id/test
 * Test prompt with variables
 */
router.post('/prompts/:id/test', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { variables = {} } = req.body;
        
        const prompt = await db.get(`SELECT * FROM ai_system_prompts WHERE id = ?`, [id]);
        if (!prompt) {
            return res.status(404).json({ error: 'Prompt not found' });
        }
        
        let renderedTemplate = prompt.template;
        for (const [key, value] of Object.entries(variables)) {
            renderedTemplate = renderedTemplate.replace(
                new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'),
                value
            );
        }
        
        const unreplacedVars = renderedTemplate.match(/\{\{\s*\w+\s*\}\}/g) || [];
        
        res.json({
            success: true,
            data: {
                original: prompt.template,
                rendered: renderedTemplate,
                unreplacedVariables: unreplacedVars,
                characterCount: renderedTemplate.length
            }
        });
    } catch (error) {
        console.error('[AI Development] Error testing prompt:', error);
        res.status(500).json({ error: 'Failed to test prompt', details: error.message });
    }
});

// ==========================================
// EXPERIMENTS ENDPOINTS
// ==========================================

/**
 * GET /api/ai-development/experiments
 * List A/B testing experiments
 */
router.get('/experiments', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        if (!abTestingService) {
            return res.status(503).json({ error: 'A/B Testing service not available' });
        }
        
        const { status, promptId } = req.query;
        const experiments = await abTestingService.listExperiments({ status, promptId });
        
        res.json({
            success: true,
            data: experiments.map(e => ({
                ...e,
                variants: JSON.parse(e.variants || '[]'),
                traffic_split: JSON.parse(e.traffic_split || '[]')
            }))
        });
    } catch (error) {
        console.error('[AI Development] Error listing experiments:', error);
        res.status(500).json({ error: 'Failed to list experiments', details: error.message });
    }
});

/**
 * POST /api/ai-development/experiments
 * Create new experiment
 */
router.post('/experiments', verifyToken, requireRole(['super_admin']), async (req, res) => {
    try {
        if (!abTestingService) {
            return res.status(503).json({ error: 'A/B Testing service not available' });
        }
        
        const result = await abTestingService.createExperiment({
            ...req.body,
            createdBy: req.user.id
        });
        
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        console.error('[AI Development] Error creating experiment:', error);
        res.status(500).json({ error: 'Failed to create experiment', details: error.message });
    }
});

/**
 * GET /api/ai-development/experiments/:id
 * Get experiment with statistics
 */
router.get('/experiments/:id', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        if (!abTestingService) {
            return res.status(503).json({ error: 'A/B Testing service not available' });
        }
        
        const stats = await abTestingService.getExperimentStats(req.params.id);
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('[AI Development] Error getting experiment:', error);
        res.status(500).json({ error: 'Failed to get experiment', details: error.message });
    }
});

/**
 * POST /api/ai-development/experiments/:id/start
 * Start experiment
 */
router.post('/experiments/:id/start', verifyToken, requireRole(['super_admin']), async (req, res) => {
    try {
        if (!abTestingService) {
            return res.status(503).json({ error: 'A/B Testing service not available' });
        }
        
        const result = await abTestingService.startExperiment(req.params.id, req.user.id);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[AI Development] Error starting experiment:', error);
        res.status(500).json({ error: 'Failed to start experiment', details: error.message });
    }
});

/**
 * POST /api/ai-development/experiments/:id/stop
 * Stop experiment
 */
router.post('/experiments/:id/stop', verifyToken, requireRole(['super_admin']), async (req, res) => {
    try {
        if (!abTestingService) {
            return res.status(503).json({ error: 'A/B Testing service not available' });
        }
        
        const { reason = 'manual' } = req.body;
        const result = await abTestingService.stopExperiment(req.params.id, reason);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[AI Development] Error stopping experiment:', error);
        res.status(500).json({ error: 'Failed to stop experiment', details: error.message });
    }
});

// ==========================================
// KNOWLEDGE BASE ENDPOINTS
// ==========================================

/**
 * GET /api/ai-development/knowledge/candidates
 * Get knowledge candidates
 */
router.get('/knowledge/candidates', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        if (!KnowledgeService) {
            return res.status(503).json({ error: 'Knowledge service not available' });
        }
        
        const status = req.query.status || 'pending';
        const items = await KnowledgeService.getCandidates(status);
        res.json({ success: true, data: items });
    } catch (error) {
        console.error('[AI Development] Error listing knowledge candidates:', error);
        res.status(500).json({ error: 'Failed to list candidates', details: error.message });
    }
});

/**
 * POST /api/ai-development/knowledge/candidates
 * Submit knowledge candidate
 */
router.post('/knowledge/candidates', verifyToken, async (req, res) => {
    try {
        if (!KnowledgeService) {
            return res.status(503).json({ error: 'Knowledge service not available' });
        }
        
        const { content, reasoning, source, relatedAxis, originContext } = req.body;
        const id = await KnowledgeService.addCandidate(content, reasoning, source, relatedAxis, originContext);
        res.json({ success: true, data: { id }, message: 'Candidate submitted' });
    } catch (error) {
        console.error('[AI Development] Error submitting candidate:', error);
        res.status(500).json({ error: 'Failed to submit candidate', details: error.message });
    }
});

/**
 * PUT /api/ai-development/knowledge/candidates/:id/status
 * Update candidate status (approve/reject)
 */
router.put('/knowledge/candidates/:id/status', verifyToken, requireRole(['super_admin']), async (req, res) => {
    try {
        if (!KnowledgeService) {
            return res.status(503).json({ error: 'Knowledge service not available' });
        }
        
        const { status, adminComment } = req.body;
        await KnowledgeService.updateCandidateStatus(req.params.id, status, adminComment);
        res.json({ success: true, message: 'Status updated' });
    } catch (error) {
        console.error('[AI Development] Error updating candidate status:', error);
        res.status(500).json({ error: 'Failed to update status', details: error.message });
    }
});

/**
 * GET /api/ai-development/knowledge/approved
 * Get approved knowledge items
 */
router.get('/knowledge/approved', verifyToken, async (req, res) => {
    try {
        if (!KnowledgeService) {
            return res.status(503).json({ error: 'Knowledge service not available' });
        }
        
        const filters = {};
        if (req.query.category) filters.category = req.query.category;
        
        const ideas = await KnowledgeService.getApprovedIdeas(filters);
        res.json({ success: true, data: ideas });
    } catch (error) {
        console.error('[AI Development] Error getting approved ideas:', error);
        res.status(500).json({ error: 'Failed to get approved ideas', details: error.message });
    }
});

// ==========================================
// INTELLIGENCE ENDPOINTS
// ==========================================

/**
 * GET /api/ai-development/intelligence/config
 * Get AI intelligence configuration
 */
router.get('/intelligence/config', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const config = await db.get(`
            SELECT * FROM ai_settings WHERE key = 'intelligence_config'
        `);
        
        res.json({
            success: true,
            data: config ? JSON.parse(config.value) : {
                enabledFeatures: ['contextual_suggestions', 'auto_completion', 'smart_routing'],
                aggressiveness: 'balanced',
                learningEnabled: true
            }
        });
    } catch (error) {
        console.error('[AI Development] Error getting intelligence config:', error);
        res.status(500).json({ error: 'Failed to get config', details: error.message });
    }
});

/**
 * PUT /api/ai-development/intelligence/config
 * Update AI intelligence configuration
 */
router.put('/intelligence/config', verifyToken, requireRole(['super_admin']), async (req, res) => {
    try {
        const config = req.body;
        
        await db.run(`
            INSERT OR REPLACE INTO ai_settings (key, value, updated_at)
            VALUES ('intelligence_config', ?, datetime('now'))
        `, [JSON.stringify(config)]);
        
        res.json({ success: true, message: 'Configuration updated' });
    } catch (error) {
        console.error('[AI Development] Error updating intelligence config:', error);
        res.status(500).json({ error: 'Failed to update config', details: error.message });
    }
});

// ==========================================
// SUMMARY ENDPOINT
// ==========================================

/**
 * GET /api/ai-development/summary
 * Get development module summary statistics
 */
router.get('/summary', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const [promptStats, experimentStats, knowledgeStats] = await Promise.all([
            db.get(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
                    COUNT(DISTINCT category) as categories
                FROM ai_system_prompts
            `),
            db.get(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
                FROM ai_ab_experiments
            `).catch(() => ({ total: 0, running: 0, completed: 0 })),
            db.get(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
                FROM knowledge_candidates
            `).catch(() => ({ total: 0, approved: 0, pending: 0 }))
        ]);
        
        res.json({
            success: true,
            data: {
                prompts: promptStats || { total: 0, active: 0, categories: 0 },
                experiments: experimentStats || { total: 0, running: 0, completed: 0 },
                knowledge: knowledgeStats || { total: 0, approved: 0, pending: 0 }
            }
        });
    } catch (error) {
        console.error('[AI Development] Error getting summary:', error);
        res.status(500).json({ error: 'Failed to get summary', details: error.message });
    }
});

export default router;









