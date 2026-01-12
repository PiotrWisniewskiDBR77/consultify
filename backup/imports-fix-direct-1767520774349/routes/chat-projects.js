/**
 * Chat Projects API Routes
 * 
 * CRUD operations for organizing conversations into projects/folders
 * Similar to Claude AI's project organization feature.
 */

import express from 'express';
const router = express.Router();
import verifyToken from '../middleware/authMiddleware.js';
import db from '../database.js';
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

// ==================== LIST PROJECTS ====================
/**
 * GET /api/chat-projects
 * List user's chat projects
 */
router.get('/', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;

        const projects = await dbAll(`
            SELECT 
                cp.*,
                (SELECT COUNT(*) FROM conversations c WHERE c.chat_project_id = cp.id) as conversation_count
            FROM chat_projects cp
            WHERE cp.user_id = ?
            ORDER BY cp.updated_at DESC
        `, [userId]);

        res.json({ projects });
    } catch (err) {
        console.error('[ChatProjects] List error:', err);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// ==================== GET PROJECT ====================
/**
 * GET /api/chat-projects/:id
 * Get a single project with its conversations
 */
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        const project = await dbGet(`
            SELECT * FROM chat_projects
            WHERE id = ? AND user_id = ?
        `, [id, userId]);

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Fetch conversations in this project
        const conversations = await dbAll(`
            SELECT 
                id, title, title_source, starred, archived,
                message_count, last_message_preview, last_message_at,
                created_at, updated_at
            FROM conversations
            WHERE chat_project_id = ? AND user_id = ?
            ORDER BY COALESCE(last_message_at, updated_at) DESC
        `, [id, userId]);

        res.json({
            ...project,
            conversations
        });
    } catch (err) {
        console.error('[ChatProjects] Get error:', err);
        res.status(500).json({ error: 'Failed to fetch project' });
    }
});

// ==================== CREATE PROJECT ====================
/**
 * POST /api/chat-projects
 * Create a new chat project
 */
router.post('/', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const organizationId = req.organizationId;
        const { name, description, color, icon } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Project name is required' });
        }

        const id = uuidv4();
        const now = new Date().toISOString();

        await dbRun(`
            INSERT INTO chat_projects (id, user_id, organization_id, name, description, color, icon, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id,
            userId,
            organizationId || null,
            name.trim(),
            description || null,
            color || '#6366f1',
            icon || 'folder',
            now,
            now
        ]);

        const newProject = await dbGet(`SELECT * FROM chat_projects WHERE id = ?`, [id]);
        res.status(201).json(newProject);
    } catch (err) {
        console.error('[ChatProjects] Create error:', err);
        res.status(500).json({ error: 'Failed to create project' });
    }
});

// ==================== UPDATE PROJECT ====================
/**
 * PATCH /api/chat-projects/:id
 * Update project metadata
 */
router.patch('/:id', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const { name, description, color, icon } = req.body;

        // Build dynamic update query
        const updates = [];
        const params = [];

        if (name !== undefined) {
            updates.push(`name = ?`);
            params.push(name.trim());
        }

        if (description !== undefined) {
            updates.push(`description = ?`);
            params.push(description);
        }

        if (color !== undefined) {
            updates.push(`color = ?`);
            params.push(color);
        }

        if (icon !== undefined) {
            updates.push(`icon = ?`);
            params.push(icon);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updates.push(`updated_at = ?`);
        params.push(new Date().toISOString());
        params.push(id, userId);

        const result = await dbRun(`
            UPDATE chat_projects
            SET ${updates.join(', ')}
            WHERE id = ? AND user_id = ?
        `, params);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const updated = await dbGet(`SELECT * FROM chat_projects WHERE id = ?`, [id]);
        res.json(updated);
    } catch (err) {
        console.error('[ChatProjects] Update error:', err);
        res.status(500).json({ error: 'Failed to update project' });
    }
});

// ==================== DELETE PROJECT ====================
/**
 * DELETE /api/chat-projects/:id
 * Delete a project (conversations are NOT deleted, just unlinked)
 */
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        // First, unlink all conversations from this project
        await dbRun(`
            UPDATE conversations
            SET chat_project_id = NULL, updated_at = ?
            WHERE chat_project_id = ? AND user_id = ?
        `, [new Date().toISOString(), id, userId]);

        // Then delete the project
        const result = await dbRun(`
            DELETE FROM chat_projects
            WHERE id = ? AND user_id = ?
        `, [id, userId]);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.json({ success: true, deleted: id });
    } catch (err) {
        console.error('[ChatProjects] Delete error:', err);
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

// ==================== ADD CONVERSATION TO PROJECT ====================
/**
 * POST /api/chat-projects/:id/conversations
 * Move a conversation to this project
 */
router.post('/:id/conversations', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const { conversationId } = req.body;

        if (!conversationId) {
            return res.status(400).json({ error: 'conversationId is required' });
        }

        // Verify project belongs to user
        const project = await dbGet(`
            SELECT id FROM chat_projects WHERE id = ? AND user_id = ?
        `, [id, userId]);

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Verify conversation belongs to user
        const conversation = await dbGet(`
            SELECT id FROM conversations WHERE id = ? AND user_id = ?
        `, [conversationId, userId]);

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Update conversation's project
        await dbRun(`
            UPDATE conversations
            SET chat_project_id = ?, updated_at = ?
            WHERE id = ?
        `, [id, new Date().toISOString(), conversationId]);

        // Update project's updated_at
        await dbRun(`
            UPDATE chat_projects
            SET updated_at = ?
            WHERE id = ?
        `, [new Date().toISOString(), id]);

        res.json({ success: true, conversationId, projectId: id });
    } catch (err) {
        console.error('[ChatProjects] Add conversation error:', err);
        res.status(500).json({ error: 'Failed to add conversation to project' });
    }
});

// ==================== REMOVE CONVERSATION FROM PROJECT ====================
/**
 * DELETE /api/chat-projects/:id/conversations/:convId
 * Remove a conversation from a project (doesn't delete the conversation)
 */
router.delete('/:id/conversations/:convId', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { id, convId } = req.params;

        // Verify and update conversation
        const result = await dbRun(`
            UPDATE conversations
            SET chat_project_id = NULL, updated_at = ?
            WHERE id = ? AND user_id = ? AND chat_project_id = ?
        `, [new Date().toISOString(), convId, userId, id]);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Conversation not found in project' });
        }

        res.json({ success: true, conversationId: convId, projectId: id });
    } catch (err) {
        console.error('[ChatProjects] Remove conversation error:', err);
        res.status(500).json({ error: 'Failed to remove conversation from project' });
    }
});

export default router;








