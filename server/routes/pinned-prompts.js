/**
 * Pinned Prompts API Routes
 * 
 * CRUD operations for user's frequently used AI prompts.
 */

import express from 'express';
const router = express.Router();
import verifyToken from '../middleware/authMiddleware.js';
import { getDatabase } from '../src/database/index.js';
const db = getDatabase();

import { v4 as uuidv4 } from 'uuid';

// Helper: Promisify db.all
const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
});

// Helper: Promisify db.get
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row || null));
});

// Helper: Promisify db.run
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
    });
});

// ==================== GET ALL PINNED PROMPTS ====================
/**
 * GET /api/pinned-prompts
 * List user's pinned prompts, sorted by usage
 */
router.get('/', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { category, limit = 20 } = req.query;

        let query = `
            SELECT id, prompt, label, category, usage_count, last_used_at, created_at
            FROM pinned_prompts
            WHERE user_id = ?
        `;
        const params = [userId];

        if (category) {
            query += ` AND category = ?`;
            params.push(category);
        }

        query += ` ORDER BY usage_count DESC, created_at DESC LIMIT ?`;
        params.push(parseInt(limit));

        const prompts = await dbAll(query, params);

        res.json({
            prompts,
            total: prompts.length
        });
    } catch (err) {
        console.error('[PinnedPrompts] List error:', err);
        res.status(500).json({ error: 'Failed to fetch pinned prompts' });
    }
});

// ==================== CREATE PINNED PROMPT ====================
/**
 * POST /api/pinned-prompts
 * Create a new pinned prompt
 */
router.post('/', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const organizationId = req.organizationId;
        const { prompt, label, category = 'general' } = req.body;

        if (!prompt || prompt.trim().length === 0) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // Check for duplicates
        const existing = await dbGet(`
            SELECT id FROM pinned_prompts
            WHERE user_id = ? AND prompt = ?
        `, [userId, prompt.trim()]);

        if (existing) {
            return res.status(409).json({ 
                error: 'Prompt already pinned',
                existingId: existing.id 
            });
        }

        const id = uuidv4();
        const now = new Date().toISOString();

        await dbRun(`
            INSERT INTO pinned_prompts (id, user_id, organization_id, prompt, label, category, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, userId, organizationId, prompt.trim(), label || null, category, now, now]);

        const created = await dbGet(`SELECT * FROM pinned_prompts WHERE id = ?`, [id]);
        res.status(201).json(created);
    } catch (err) {
        console.error('[PinnedPrompts] Create error:', err);
        res.status(500).json({ error: 'Failed to create pinned prompt' });
    }
});

// ==================== UPDATE PINNED PROMPT ====================
/**
 * PATCH /api/pinned-prompts/:id
 * Update a pinned prompt (label, category)
 */
router.patch('/:id', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const { label, category } = req.body;

        // Verify ownership
        const existing = await dbGet(`
            SELECT id FROM pinned_prompts
            WHERE id = ? AND user_id = ?
        `, [id, userId]);

        if (!existing) {
            return res.status(404).json({ error: 'Pinned prompt not found' });
        }

        const updates = [];
        const params = [];

        if (label !== undefined) {
            updates.push('label = ?');
            params.push(label);
        }
        if (category !== undefined) {
            updates.push('category = ?');
            params.push(category);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updates.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(id);

        await dbRun(`
            UPDATE pinned_prompts
            SET ${updates.join(', ')}
            WHERE id = ?
        `, params);

        const updated = await dbGet(`SELECT * FROM pinned_prompts WHERE id = ?`, [id]);
        res.json(updated);
    } catch (err) {
        console.error('[PinnedPrompts] Update error:', err);
        res.status(500).json({ error: 'Failed to update pinned prompt' });
    }
});

// ==================== USE PINNED PROMPT ====================
/**
 * POST /api/pinned-prompts/:id/use
 * Increment usage counter when prompt is used
 */
router.post('/:id/use', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        const result = await dbRun(`
            UPDATE pinned_prompts
            SET usage_count = usage_count + 1,
                last_used_at = ?
            WHERE id = ? AND user_id = ?
        `, [new Date().toISOString(), id, userId]);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Pinned prompt not found' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[PinnedPrompts] Use error:', err);
        res.status(500).json({ error: 'Failed to update usage' });
    }
});

// ==================== DELETE PINNED PROMPT ====================
/**
 * DELETE /api/pinned-prompts/:id
 * Delete a pinned prompt
 */
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        const result = await dbRun(`
            DELETE FROM pinned_prompts
            WHERE id = ? AND user_id = ?
        `, [id, userId]);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Pinned prompt not found' });
        }

        res.json({ success: true, deleted: id });
    } catch (err) {
        console.error('[PinnedPrompts] Delete error:', err);
        res.status(500).json({ error: 'Failed to delete pinned prompt' });
    }
});

export default router;











