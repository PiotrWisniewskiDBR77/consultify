/**
 * Conversations API Routes
 * 
 * CRUD operations for AI Chat conversation history management.
 * Supports conversation organization, search, and PMO context linking.
 * 
 * Refactored for SQLite compatibility.
 */

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

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

// ==================== LIST CONVERSATIONS ====================
/**
 * GET /api/conversations
 * List user's conversations with filtering and pagination
 */
router.get('/', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const {
            archived = 'false',
            starred,
            projectId,
            search,
            limit = 50,
            offset = 0
        } = req.query;

        let query = `
            SELECT 
                id, title, title_source, project_id, starred, archived,
                tags, pmo_context, message_count, last_message_preview,
                last_message_at, created_at, updated_at
            FROM conversations
            WHERE user_id = ?
        `;
        const params = [userId];

        // Filter by archived status
        if (archived === 'false') {
            query += ` AND (archived = 0 OR archived IS NULL)`;
        } else if (archived === 'true') {
            query += ` AND archived = 1`;
        }

        // Filter by starred
        if (starred === 'true') {
            query += ` AND starred = 1`;
        }

        // Filter by project
        if (projectId) {
            query += ` AND project_id = ?`;
            params.push(projectId);
        }

        // Full-text search on title (simplified for SQLite)
        if (search && search.trim()) {
            query += ` AND title LIKE ?`;
            params.push(`%${search.trim()}%`);
        }

        // Order: starred first, then by last activity
        query += ` ORDER BY starred DESC, COALESCE(last_message_at, updated_at) DESC`;

        // Pagination
        query += ` LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const conversations = await dbAll(query, params);

        // Get total count for pagination
        let countQuery = `SELECT COUNT(*) as count FROM conversations WHERE user_id = ?`;
        const countParams = [userId];
        
        if (archived === 'false') {
            countQuery += ` AND (archived = 0 OR archived IS NULL)`;
        } else if (archived === 'true') {
            countQuery += ` AND archived = 1`;
        }

        const countResult = await dbGet(countQuery, countParams);

        res.json({
            conversations,
            total: countResult?.count || 0,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (err) {
        console.error('[Conversations] List error:', err);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

// ==================== CREATE CONVERSATION ====================
/**
 * POST /api/conversations
 * Create a new conversation
 */
router.post('/', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const organizationId = req.organizationId;
        const { title = 'New conversation', projectId, pmoContext = {} } = req.body;
        const id = uuidv4();
        const now = new Date().toISOString();

        await dbRun(`
            INSERT INTO conversations (id, user_id, organization_id, project_id, title, pmo_context, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, userId, organizationId, projectId || null, title, JSON.stringify(pmoContext), now, now]);

        const newConv = await dbGet(`SELECT * FROM conversations WHERE id = ?`, [id]);
        res.status(201).json(newConv);
    } catch (err) {
        console.error('[Conversations] Create error:', err);
        res.status(500).json({ error: 'Failed to create conversation' });
    }
});

// ==================== GET CONVERSATION WITH MESSAGES ====================
/**
 * GET /api/conversations/:id
 * Get a single conversation with all its messages
 */
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        // Fetch conversation
        const conversation = await dbGet(`
            SELECT * FROM conversations
            WHERE id = ? AND user_id = ?
        `, [id, userId]);

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Fetch messages
        const messages = await dbAll(`
            SELECT id, role, content, message_type, metadata, token_count, model_used, created_at
            FROM conversation_messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC
        `, [id]);

        res.json({
            ...conversation,
            messages
        });
    } catch (err) {
        console.error('[Conversations] Get error:', err);
        res.status(500).json({ error: 'Failed to fetch conversation' });
    }
});

// ==================== UPDATE CONVERSATION ====================
/**
 * PATCH /api/conversations/:id
 * Update conversation metadata (title, starred, archived, tags, pmoContext)
 */
router.patch('/:id', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const { title, starred, archived, tags, pmoContext } = req.body;

        // Build dynamic update query
        const updates = [];
        const params = [];

        if (title !== undefined) {
            updates.push(`title = ?`);
            params.push(title);
            updates.push(`title_source = 'user'`);
        }

        if (starred !== undefined) {
            updates.push(`starred = ?`);
            params.push(starred ? 1 : 0);
        }

        if (archived !== undefined) {
            updates.push(`archived = ?`);
            params.push(archived ? 1 : 0);
        }

        if (tags !== undefined) {
            updates.push(`tags = ?`);
            params.push(tags);
        }

        if (pmoContext !== undefined) {
            updates.push(`pmo_context = ?`);
            params.push(JSON.stringify(pmoContext));
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updates.push(`updated_at = ?`);
        params.push(new Date().toISOString());
        params.push(id, userId);

        const result = await dbRun(`
            UPDATE conversations
            SET ${updates.join(', ')}
            WHERE id = ? AND user_id = ?
        `, params);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        const updated = await dbGet(`SELECT * FROM conversations WHERE id = ?`, [id]);
        res.json(updated);
    } catch (err) {
        console.error('[Conversations] Update error:', err);
        res.status(500).json({ error: 'Failed to update conversation' });
    }
});

// ==================== DELETE CONVERSATION ====================
/**
 * DELETE /api/conversations/:id
 * Permanently delete a conversation and all its messages
 */
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        const result = await dbRun(`
            DELETE FROM conversations
            WHERE id = ? AND user_id = ?
        `, [id, userId]);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        res.json({ success: true, deleted: id });
    } catch (err) {
        console.error('[Conversations] Delete error:', err);
        res.status(500).json({ error: 'Failed to delete conversation' });
    }
});

// ==================== ADD MESSAGE TO CONVERSATION ====================
/**
 * POST /api/conversations/:id/messages
 * Add a message to an existing conversation
 */
router.post('/:id/messages', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const {
            role,
            content,
            messageType = 'text',
            metadata = {},
            tokenCount,
            modelUsed
        } = req.body;

        if (!role || !content) {
            return res.status(400).json({ error: 'role and content are required' });
        }

        if (!['user', 'ai'].includes(role)) {
            return res.status(400).json({ error: 'role must be "user" or "ai"' });
        }

        // Verify conversation belongs to user
        const conv = await dbGet(`
            SELECT id FROM conversations WHERE id = ? AND user_id = ?
        `, [id, userId]);

        if (!conv) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Insert message
        const msgId = uuidv4();
        const now = new Date().toISOString();
        
        await dbRun(`
            INSERT INTO conversation_messages (id, conversation_id, role, content, message_type, metadata, token_count, model_used, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [msgId, id, role, content, messageType, JSON.stringify(metadata), tokenCount || null, modelUsed || null, now]);

        // Update conversation stats
        await dbRun(`
            UPDATE conversations 
            SET message_count = COALESCE(message_count, 0) + 1,
                last_message_preview = ?,
                last_message_at = ?,
                updated_at = ?
            WHERE id = ?
        `, [content.substring(0, 100), now, now, id]);

        const newMessage = await dbGet(`SELECT * FROM conversation_messages WHERE id = ?`, [msgId]);
        res.status(201).json(newMessage);
    } catch (err) {
        console.error('[Conversations] Add message error:', err);
        res.status(500).json({ error: 'Failed to add message' });
    }
});

// ==================== GENERATE TITLE ====================
/**
 * POST /api/conversations/:id/title/generate
 * Auto-generate a title from conversation messages using AI
 */
router.post('/:id/title/generate', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        // Fetch conversation and verify ownership
        const conv = await dbGet(`
            SELECT id, title_source FROM conversations
            WHERE id = ? AND user_id = ?
        `, [id, userId]);

        if (!conv) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Don't regenerate if user manually edited title
        if (conv.title_source === 'user') {
            return res.json({ 
                skipped: true, 
                reason: 'Title was manually edited by user' 
            });
        }

        // Fetch first few messages for context
        const messages = await dbAll(`
            SELECT role, content FROM conversation_messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC
            LIMIT 6
        `, [id]);

        if (messages.length < 2) {
            return res.json({ 
                skipped: true, 
                reason: 'Not enough messages to generate title' 
            });
        }

        // Use title generator service
        const titleGenerator = require('../services/ai/titleGenerator');
        const generatedTitle = await titleGenerator.generateConversationTitle(messages);

        // Update conversation with new title
        await dbRun(`
            UPDATE conversations SET title = ?, title_source = 'auto'
            WHERE id = ?
        `, [generatedTitle, id]);

        res.json({ title: generatedTitle });
    } catch (err) {
        console.error('[Conversations] Generate title error:', err);
        res.status(500).json({ error: 'Failed to generate title' });
    }
});

// ==================== BULK OPERATIONS ====================
/**
 * POST /api/conversations/bulk
 * Perform bulk operations (archive, delete, star)
 */
router.post('/bulk', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { ids, action } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'ids array is required' });
        }

        if (!['archive', 'unarchive', 'delete', 'star', 'unstar'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action' });
        }

        const placeholders = ids.map(() => '?').join(', ');
        let sql;
        const params = [userId, ...ids];

        switch (action) {
            case 'archive':
                sql = `UPDATE conversations SET archived = 1 WHERE user_id = ? AND id IN (${placeholders})`;
                break;
            case 'unarchive':
                sql = `UPDATE conversations SET archived = 0 WHERE user_id = ? AND id IN (${placeholders})`;
                break;
            case 'star':
                sql = `UPDATE conversations SET starred = 1 WHERE user_id = ? AND id IN (${placeholders})`;
                break;
            case 'unstar':
                sql = `UPDATE conversations SET starred = 0 WHERE user_id = ? AND id IN (${placeholders})`;
                break;
            case 'delete':
                sql = `DELETE FROM conversations WHERE user_id = ? AND id IN (${placeholders})`;
                break;
        }

        const result = await dbRun(sql, params);

        res.json({ 
            success: true, 
            affected: result.changes,
            ids
        });
    } catch (err) {
        console.error('[Conversations] Bulk operation error:', err);
        res.status(500).json({ error: 'Failed to perform bulk operation' });
    }
});

// ==================== MIGRATE FROM LOCALSTORAGE ====================
/**
 * POST /api/conversations/migrate
 * Migrate conversations from localStorage to database
 */
router.post('/migrate', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const organizationId = req.organizationId;
        const { conversations } = req.body;

        if (!conversations || !Array.isArray(conversations)) {
            return res.status(400).json({ error: 'conversations array is required' });
        }

        const migrated = [];

        for (const conv of conversations) {
            const { projectId, messages } = conv;
            
            if (!messages || messages.length === 0) continue;

            const conversationId = uuidv4();
            const now = new Date().toISOString();

            // Create conversation
            await dbRun(`
                INSERT INTO conversations (id, user_id, organization_id, project_id, title, title_source, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'Imported conversation', 'auto', ?, ?)
            `, [conversationId, userId, organizationId, projectId || null, now, now]);

            // Insert all messages
            for (const msg of messages) {
                const msgId = uuidv4();
                await dbRun(`
                    INSERT INTO conversation_messages (id, conversation_id, role, content, created_at)
                    VALUES (?, ?, ?, ?, ?)
                `, [
                    msgId,
                    conversationId,
                    msg.role,
                    msg.content,
                    msg.timestamp || now
                ]);
            }

            migrated.push({ conversationId, messageCount: messages.length });
        }

        res.json({ success: true, migrated });
    } catch (err) {
        console.error('[Conversations] Migration error:', err);
        res.status(500).json({ error: 'Failed to migrate conversations' });
    }
});

module.exports = router;
