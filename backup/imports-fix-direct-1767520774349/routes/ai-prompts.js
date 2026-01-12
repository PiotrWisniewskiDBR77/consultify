import crypto from 'crypto';
/**
 * AI Prompts Management API
 * 
 * Routes for managing AI system prompts.
 * Super Admin only access.
 */

import express from 'express';
const router = express.Router();
import db from '../database.js';
import verifyToken from '../middleware/authMiddleware.js';
import { requireRole  } from '../middleware/rbac.js';

/**
 * GET /api/ai-prompts
 * List all prompts with optional filtering
 */
router.get('/', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
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
        
        // Parse JSON fields
        const parsedPrompts = prompts.map(p => ({
            ...p,
            variables: p.variables ? JSON.parse(p.variables) : [],
            is_active: Boolean(p.is_active)
        }));
        
        res.json({
            success: true,
            data: parsedPrompts,
            count: parsedPrompts.length
        });
    } catch (error) {
        console.error('[AI Prompts API] Error listing prompts:', error);
        res.status(500).json({ error: 'Failed to list prompts', details: error.message });
    }
});

/**
 * GET /api/ai-prompts/categories
 * Get list of prompt categories
 */
router.get('/categories', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const categories = await db.all(`
            SELECT DISTINCT category, COUNT(*) as count
            FROM ai_system_prompts
            GROUP BY category
            ORDER BY category
        `);
        
        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        console.error('[AI Prompts API] Error listing categories:', error);
        res.status(500).json({ error: 'Failed to list categories', details: error.message });
    }
});

/**
 * GET /api/ai-prompts/:id
 * Get single prompt details
 */
router.get('/:id', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { id } = req.params;
        
        const prompt = await db.get(`
            SELECT * FROM ai_system_prompts WHERE id = ?
        `, [id]);
        
        if (!prompt) {
            return res.status(404).json({ error: 'Prompt not found' });
        }
        
        // Get version history
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
        console.error('[AI Prompts API] Error getting prompt:', error);
        res.status(500).json({ error: 'Failed to get prompt', details: error.message });
    }
});

/**
 * POST /api/ai-prompts
 * Create new prompt
 */
router.post('/', verifyToken, requireRole(['super_admin']), async (req, res) => {
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
        
        // Create initial version record
        await db.run(`
            INSERT INTO ai_prompt_versions (id, prompt_id, version, template, created_at, created_by)
            VALUES (?, ?, 1, ?, datetime('now'), ?)
        `, [crypto.randomUUID(), id, template, req.user.id]);
        
        res.status(201).json({
            success: true,
            data: { id, name, category, version: 1 }
        });
    } catch (error) {
        console.error('[AI Prompts API] Error creating prompt:', error);
        res.status(500).json({ error: 'Failed to create prompt', details: error.message });
    }
});

/**
 * PUT /api/ai-prompts/:id
 * Update existing prompt
 */
router.put('/:id', verifyToken, requireRole(['super_admin']), async (req, res) => {
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
        
        // Store version history
        if (template && template !== existing.template) {
            await db.run(`
                INSERT INTO ai_prompt_versions (id, prompt_id, version, template, created_at, created_by)
                VALUES (?, ?, ?, ?, datetime('now'), ?)
            `, [crypto.randomUUID(), id, newVersion, template, req.user.id]);
        }
        
        res.json({
            success: true,
            data: { id, version: newVersion }
        });
    } catch (error) {
        console.error('[AI Prompts API] Error updating prompt:', error);
        res.status(500).json({ error: 'Failed to update prompt', details: error.message });
    }
});

/**
 * DELETE /api/ai-prompts/:id
 * Delete prompt (soft delete - sets is_active to false)
 */
router.delete('/:id', verifyToken, requireRole(['super_admin']), async (req, res) => {
    try {
        const { id } = req.params;
        
        await db.run(`
            UPDATE ai_system_prompts 
            SET is_active = 0, updated_at = datetime('now')
            WHERE id = ?
        `, [id]);
        
        res.json({ success: true, message: 'Prompt deactivated' });
    } catch (error) {
        console.error('[AI Prompts API] Error deleting prompt:', error);
        res.status(500).json({ error: 'Failed to delete prompt', details: error.message });
    }
});

/**
 * POST /api/ai-prompts/:id/test
 * Test prompt with sample variables
 */
router.post('/:id/test', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { variables = {} } = req.body;
        
        const prompt = await db.get(`SELECT * FROM ai_system_prompts WHERE id = ?`, [id]);
        if (!prompt) {
            return res.status(404).json({ error: 'Prompt not found' });
        }
        
        // Replace variables in template
        let renderedTemplate = prompt.template;
        for (const [key, value] of Object.entries(variables)) {
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
                characterCount: renderedTemplate.length
            }
        });
    } catch (error) {
        console.error('[AI Prompts API] Error testing prompt:', error);
        res.status(500).json({ error: 'Failed to test prompt', details: error.message });
    }
});

/**
 * POST /api/ai-prompts/:id/restore-version
 * Restore prompt to a previous version
 */
router.post('/:id/restore-version', verifyToken, requireRole(['super_admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { version } = req.body;
        
        if (!version) {
            return res.status(400).json({ error: 'Version number is required' });
        }
        
        const versionRecord = await db.get(`
            SELECT template FROM ai_prompt_versions 
            WHERE prompt_id = ? AND version = ?
        `, [id, version]);
        
        if (!versionRecord) {
            return res.status(404).json({ error: 'Version not found' });
        }
        
        const existing = await db.get(`SELECT version FROM ai_system_prompts WHERE id = ?`, [id]);
        const newVersion = existing.version + 1;
        
        await db.run(`
            UPDATE ai_system_prompts 
            SET template = ?, version = ?, updated_at = datetime('now')
            WHERE id = ?
        `, [versionRecord.template, newVersion, id]);
        
        // Record the restore as a new version
        await db.run(`
            INSERT INTO ai_prompt_versions (id, prompt_id, version, template, created_at, created_by)
            VALUES (?, ?, ?, ?, datetime('now'), ?)
        `, [crypto.randomUUID(), id, newVersion, versionRecord.template, req.user.id]);
        
        res.json({
            success: true,
            message: `Restored to version ${version}`,
            data: { currentVersion: newVersion }
        });
    } catch (error) {
        console.error('[AI Prompts API] Error restoring version:', error);
        res.status(500).json({ error: 'Failed to restore version', details: error.message });
    }
});

export default router;

